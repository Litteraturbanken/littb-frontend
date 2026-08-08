import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { dirname, resolve } from "node:path"

import { parseEvidence, recordEvidence, validateLedger } from "./semantic-review/ledger.mjs"
import { discoverAuthoredSources } from "./semantic-review/source-inventory.mjs"

const root = process.cwd()
const semanticCli = resolve(import.meta.dirname, "run-semantic-review.mjs")
const reportDirectory = resolve(root, ".quality/semantic-review")
const packetDirectory = resolve(reportDirectory, "packets")
const ledgerPath = resolve(root, "quality/semantic-review-ledger.json")
const schemaPath = resolve(root, "quality/semantic-review-evidence.schema.json")
const contractPath = resolve(root, "quality/semantic-review-contract.md")

function parseArguments(args) {
  let author = null
  let reviewer = null
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`)
    if (flag === "--author" && author === null) author = value
    else if (flag === "--reviewer" && reviewer === null) reviewer = value
    else throw new Error(`Unknown or duplicate independent review argument: ${flag}`)
  }
  if (!author || !reviewer) throw new Error("Independent review requires --author and --reviewer")
  if (author === reviewer) throw new Error("Independent review author and reviewer must differ")
  if (/[\r\n]/u.test(author) || /[\r\n]/u.test(reviewer)) throw new Error("Invalid reviewer identity")
  return { author, reviewer }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function artifactName(id) {
  return sha256(id)
}

function atomicWrite(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, value)
  renameSync(temporary, path)
}

function refreshInventory() {
  const result = spawnSync(process.execPath, [semanticCli, "inventory"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024
  })
  if (result.error) throw new Error(`Semantic review inventory could not start: ${result.error.message}`)
  if (result.status !== 0) {
    throw new Error(`Semantic review inventory failed: ${(result.stderr || result.stdout).trim()}`)
  }
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    throw new Error(`${label} is not valid JSON`)
  }
}

function currentPackets() {
  const index = readJson(resolve(reportDirectory, "index.json"), "Semantic review index")
  if (index?.version !== 1 || !Array.isArray(index.packets)) {
    throw new Error("Semantic review index has an invalid shape")
  }
  return index.packets.map(summary => {
    const path = resolve(packetDirectory, `${artifactName(summary.id)}.json`)
    const artifact = readJson(path, `Semantic review packet ${summary.id}`)
    if (artifact?.version !== 1 || artifact.packet?.id !== summary.id) {
      throw new Error(`Semantic review packet does not match index: ${summary.id}`)
    }
    return { packet: artifact.packet, path }
  })
}

function readLedger() {
  return readJson(ledgerPath, "Semantic review ledger")
}

function evidenceMap(ledger) {
  const map = new Map()
  for (const record of ledger.records ?? []) {
    if (typeof record.evidencePath !== "string") continue
    const path = resolve(root, record.evidencePath)
    if (existsSync(path)) map.set(record.evidencePath, readFileSync(path, "utf8"))
  }
  return map
}

function sourceSnapshot() {
  return new Map(discoverAuthoredSources(root).map(record => [record.path, sha256(record.source)]))
}

function assertSourceSnapshot(before) {
  const after = sourceSnapshot()
  if (before.size !== after.size) throw new Error("Independent reviewer changed production sources")
  for (const [path, fingerprint] of before) {
    if (after.get(path) !== fingerprint) throw new Error(`Independent reviewer changed production source: ${path}`)
  }
}

function reviewerCommand() {
  if (!process.env.SEMANTIC_REVIEW_COMMAND) return ["codex", "exec"]
  let command
  try {
    command = JSON.parse(process.env.SEMANTIC_REVIEW_COMMAND)
  } catch {
    throw new Error("SEMANTIC_REVIEW_COMMAND must be a JSON argument array")
  }
  if (!Array.isArray(command) || command.length === 0
    || command.some(argument => typeof argument !== "string" || !argument)) {
    throw new Error("SEMANTIC_REVIEW_COMMAND must be a nonempty JSON argument array")
  }
  return command
}

function reviewPrompt({ packetPath, author, reviewer }) {
  return [
    "Perform an independent semantic code review of exactly one generated packet.",
    `Review contract: \`${contractPath}\``,
    `Packet JSON: \`${packetPath}\``,
    `Evidence author must be exactly: ${author}`,
    `Evidence reviewer must be exactly: ${reviewer}`,
    "Inspect the current source, direct callers, dependencies, types, and relevant tests named by the packet.",
    "Use read-only commands. Return only JSON matching the supplied schema.",
    "Do not review or summarize any other packet."
  ].join("\n")
}

function invokeReviewer({ packetEntry, author, reviewer }) {
  const outputPath = resolve(reportDirectory, `.review-${process.pid}-${artifactName(packetEntry.packet.id)}.json`)
  rmSync(outputPath, { force: true })
  const command = reviewerCommand()
  const args = [
    ...command.slice(1),
    "--ephemeral",
    "--sandbox", "read-only",
    "--cd", root,
    "--output-schema", schemaPath,
    "--output-last-message", outputPath,
    "-"
  ]
  const before = sourceSnapshot()
  const result = spawnSync(command[0], args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    input: reviewPrompt({ packetPath: packetEntry.path, author, reviewer }),
    maxBuffer: 64 * 1024 * 1024,
    timeout: 30 * 60 * 1000
  })
  assertSourceSnapshot(before)
  if (result.error) throw new Error(`Independent reviewer could not start: ${result.error.message}`)
  if (result.signal || result.status === null) {
    throw new Error(`Independent reviewer terminated by ${result.signal ?? "an unknown signal"}`)
  }
  if (result.status !== 0) {
    throw new Error(`Independent reviewer exited ${result.status}: ${(result.stderr || result.stdout).trim()}`)
  }
  if (!existsSync(outputPath)) throw new Error("Independent reviewer did not produce evidence")
  const text = readFileSync(outputPath, "utf8")
  rmSync(outputPath, { force: true })
  let evidence
  try {
    evidence = JSON.parse(text)
  } catch {
    throw new Error("Independent reviewer output is not valid JSON")
  }
  if (evidence.author !== author || evidence.reviewer !== reviewer) {
    throw new Error("Independent reviewer identities do not match the requested review")
  }
  parseEvidence(evidence, packetEntry.packet)
  return { evidence, text }
}

function saveEvidence(packet, text) {
  const relativePath = `quality/semantic-reviews/${artifactName(packet.id)}.json`
  atomicWrite(resolve(root, relativePath), text)
  const serialized = recordEvidence({
    ledger: readLedger(),
    packet,
    evidencePath: relativePath,
    evidenceText: text
  })
  atomicWrite(ledgerPath, serialized)
}

function currentReport(entries) {
  const ledger = readLedger()
  return validateLedger({
    ledger,
    packets: entries.map(entry => entry.packet),
    evidenceByPath: evidenceMap(ledger)
  })
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  if (!existsSync(schemaPath) || !existsSync(contractPath)) {
    throw new Error("Semantic review schema or contract is missing")
  }
  refreshInventory()
  const entries = currentPackets()
  let report = currentReport(entries)
  if (report.changesRequested.length > 0) {
    console.log(`Semantic review remains changes-requested: ${report.changesRequested[0]}`)
    return 1
  }
  const approved = new Set(report.approved)
  for (const entry of entries) {
    if (approved.has(entry.packet.id)) continue
    if (entry.packet.oversized && !entry.packet.waiver) {
      console.log(`Semantic review packet is oversized: ${entry.packet.id}`)
      return 1
    }
    const { evidence, text } = invokeReviewer({ packetEntry: entry, ...options })
    saveEvidence(entry.packet, text)
    console.log(`${evidence.verdict}: ${entry.packet.id}`)
    if (evidence.verdict === "changes-requested") return 1
    approved.add(entry.packet.id)
  }
  report = currentReport(entries)
  if (report.unreviewed.length || report.stale.length || report.changesRequested.length || report.oversized.length) {
    console.log("Independent semantic review remains incomplete")
    return 1
  }
  console.log("No independent semantic review work remains")
  return 0
}

try {
  process.exitCode = main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 2
}
