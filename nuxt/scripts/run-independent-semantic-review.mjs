import { spawn, spawnSync } from "node:child_process"
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

import {
  parseEvidence,
  recordEvidence,
  serializeLedger,
  validateLedger
} from "./semantic-review/ledger.mjs"
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

function reconcileRetiredPackets(entries) {
  const ledger = readLedger()
  if (ledger?.version !== 1 || !Array.isArray(ledger.records)
    || Object.keys(ledger).toSorted().join(",") !== "records,version") {
    throw new Error("Semantic review ledger has an invalid shape")
  }
  const records = JSON.parse(serializeLedger(ledger.records)).records
  const currentIds = new Set(entries.map(entry => entry.packet.id))
  const retained = records.filter(record => currentIds.has(record.packetId))
  if (retained.length === records.length) return

  atomicWrite(ledgerPath, serializeLedger(retained))
  const retainedEvidence = new Set(retained.map(record => record.evidencePath))
  for (const record of records) {
    if (!currentIds.has(record.packetId) && !retainedEvidence.has(record.evidencePath)) {
      rmSync(resolve(root, record.evidencePath), { force: true })
    }
  }
  console.log(`Retired semantic review packets: ${records.length - retained.length}`)
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

function reviewerModel() {
  const model = process.env.SEMANTIC_REVIEW_MODEL ?? "gpt-5.5"
  if (!model || /[\r\n]/u.test(model)) throw new Error("SEMANTIC_REVIEW_MODEL must be one model name")
  return model
}

function reviewerConcurrency() {
  const raw = process.env.SEMANTIC_REVIEW_CONCURRENCY ?? "3"
  if (!/^[1-4]$/u.test(raw)) {
    throw new Error("SEMANTIC_REVIEW_CONCURRENCY must be an integer from 1 through 4")
  }
  return Number(raw)
}

function evidenceValidationMessage(error, evidence, packet) {
  const message = error instanceof Error ? error.message : String(error)
  const match = /^Finding (.+) line is outside unit range$/u.exec(message)
  if (!match || !Array.isArray(evidence?.findings)) return message
  const finding = evidence.findings.find(candidate => candidate?.id === match[1])
  const unit = packet.units.find(candidate => candidate.id === finding?.unitId)
  if (!finding || !unit || !Array.isArray(unit.lines)) return message
  const citedLine = Number(finding.line)
  const distance = ([start, end]) => citedLine < start
    ? start - citedLine
    : citedLine > end ? citedLine - end : 0
  const nearest = unit.lines
    .toSorted((left, right) => distance(left) - distance(right))
    .slice(0, 8)
    .toSorted((left, right) => left[0] - right[0])
    .map(([start, end]) => start === end ? String(start) : `${start}-${end}`)
    .join(", ")
  return `${message}; ${finding.id} cited ${finding.path}:${citedLine} for ${finding.unitId}; `
    + `owned physical lines nearest cited line: ${nearest}`
}

function reviewPrompt({ packetPath, author, reviewer, validationError = null }) {
  const prompt = [
    "Perform an independent semantic code review of exactly one generated packet.",
    `Review contract: \`${contractPath}\``,
    `Packet JSON: \`${packetPath}\``,
    `Evidence author must be exactly: ${author}`,
    `Evidence reviewer must be exactly: ${reviewer}`,
    "Inspect the current source, direct callers, dependencies, types, and relevant tests named by the packet.",
    "Cite findings only on physical lines listed in the owned unit's lines ranges.",
    "Use read-only commands. Return only JSON matching the supplied schema.",
    "Do not review or summarize any other packet."
  ]
  if (validationError) {
    const boundedError = validationError.replace(/[\r\n]+/gu, " ").slice(0, 500)
    prompt.push(
      `Previous evidence was rejected by the strict validator: ${boundedError}`,
      "This is the final retry. Cite a finding only when its path, unitId, and physical line are owned by that packet unit; otherwise omit it."
    )
  }
  return prompt.join("\n")
}

function reviewerProcess(command, args, input) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command[0], args, {
      cwd: root,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    })
    const chunks = { stdout: [], stderr: [] }
    let size = 0
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
    }, 30 * 60 * 1000)
    const collect = streamName => chunk => {
      size += chunk.length
      if (size > 64 * 1024 * 1024) {
        child.kill("SIGTERM")
        reject(new Error("Independent reviewer output exceeded 64 MiB"))
        return
      }
      chunks[streamName].push(chunk)
    }
    child.stdout.on("data", collect("stdout"))
    child.stderr.on("data", collect("stderr"))
    child.on("error", error => {
      clearTimeout(timeout)
      reject(new Error(`Independent reviewer could not start: ${error.message}`))
    })
    child.on("close", (status, signal) => {
      clearTimeout(timeout)
      const output = {
        status,
        signal,
        stdout: Buffer.concat(chunks.stdout).toString("utf8"),
        stderr: Buffer.concat(chunks.stderr).toString("utf8")
      }
      if (timedOut) reject(new Error("Independent reviewer timed out after 30 minutes"))
      else resolvePromise(output)
    })
    child.stdin.end(input)
  })
}

async function invokeReviewer({ packetEntry, author, reviewer }) {
  const outputPath = resolve(reportDirectory, `.review-${process.pid}-${artifactName(packetEntry.packet.id)}.json`)
  const command = reviewerCommand()
  const args = [
    ...command.slice(1),
    "--ephemeral",
    "--model", reviewerModel(),
    "--sandbox", "read-only",
    "--cd", root,
    "--output-schema", schemaPath,
    "--output-last-message", outputPath,
    "-"
  ]
  let validationError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    rmSync(outputPath, { force: true })
    const before = sourceSnapshot()
    const result = await reviewerProcess(
      command,
      args,
      reviewPrompt({ packetPath: packetEntry.path, author, reviewer, validationError })
    )
    assertSourceSnapshot(before)
    if (result.signal || result.status === null) {
      throw new Error(`Independent reviewer terminated by ${result.signal ?? "an unknown signal"}`)
    }
    if (result.status !== 0) {
      throw new Error(`Independent reviewer exited ${result.status}: ${(result.stderr || result.stdout).trim()}`)
    }
    if (!existsSync(outputPath)) throw new Error("Independent reviewer did not produce evidence")
    const text = readFileSync(outputPath, "utf8")
    rmSync(outputPath, { force: true })
    let evidence = null
    try {
      evidence = JSON.parse(text)
      if (evidence.author !== author || evidence.reviewer !== reviewer) {
        throw new Error("Independent reviewer identities do not match the requested review")
      }
      parseEvidence(evidence, packetEntry.packet)
      return { evidence, text }
    } catch (error) {
      const normalized = error instanceof SyntaxError
        ? new Error("Independent reviewer output is not valid JSON")
        : error
      if (attempt === 1) throw normalized
      validationError = evidenceValidationMessage(normalized, evidence, packetEntry.packet)
    }
  }
  throw new Error("Independent reviewer exhausted its validation attempts")
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

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (!existsSync(schemaPath) || !existsSync(contractPath)) {
    throw new Error("Semantic review schema or contract is missing")
  }
  refreshInventory()
  const entries = currentPackets()
  reconcileRetiredPackets(entries)
  let report = currentReport(entries)
  if (report.changesRequested.length > 0) {
    console.log(`Semantic review remains changes-requested: ${report.changesRequested[0]}`)
    return 1
  }
  const approved = new Set(report.approved)
  const pending = entries.filter(entry => !approved.has(entry.packet.id))
  const concurrency = reviewerConcurrency()
  for (let index = 0; index < pending.length; index += concurrency) {
    const batch = pending.slice(index, index + concurrency)
    for (const entry of batch) {
      if (entry.packet.oversized && !entry.packet.waiver) {
        console.log(`Semantic review packet is oversized: ${entry.packet.id}`)
        return 1
      }
    }
    const reviewed = await Promise.all(batch.map(entry =>
      invokeReviewer({ packetEntry: entry, ...options })
    ))
    let changesRequested = false
    for (let offset = 0; offset < batch.length; offset += 1) {
      const entry = batch[offset]
      const { evidence, text } = reviewed[offset]
      saveEvidence(entry.packet, text)
      console.log(`${evidence.verdict}: ${entry.packet.id}`)
      approved.add(entry.packet.id)
      if (evidence.verdict === "changes-requested") changesRequested = true
    }
    if (changesRequested) return 1
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
  process.exitCode = await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 2
}
