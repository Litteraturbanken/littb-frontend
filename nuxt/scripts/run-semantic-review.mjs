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

import { buildMaintainabilityReport } from "./run-maintainability.mjs"
import { enrichReviewPackets } from "./semantic-review/context.mjs"
import { recordEvidence, validateLedger } from "./semantic-review/ledger.mjs"
import {
  materializeReviewPacket,
  renderPacketIndex,
  renderPacketJson,
  renderPacketMarkdown
} from "./semantic-review/packets.mjs"
import { planReviewPackets } from "./semantic-review/packet-planner.mjs"
import { discoverAuthoredSources, inventorySource } from "./semantic-review/source-inventory.mjs"

const root = process.cwd()
const reportDirectory = resolve(root, ".quality/semantic-review")
const ledgerPath = resolve(root, "quality/semantic-review-ledger.json")

function compareText(left, right) {
  return String(left).localeCompare(String(right), "en")
}

function parseArguments(args) {
  const command = args[0]
  if (!command || !["check", "inventory", "packet", "queue", "record"].includes(command)) {
    throw new Error(`Unknown semantic review command: ${String(command)}`)
  }
  const rest = args.slice(1)
  if (["check", "inventory", "queue"].includes(command)) {
    if (rest.length > 0) throw new Error(`${command} does not accept arguments`)
    return { command, id: null, evidence: null }
  }
  let id = null
  let evidence = null
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index]
    const value = rest[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`)
    if (flag === "--id" && id === null) id = value
    else if (flag === "--evidence" && evidence === null) evidence = value
    else throw new Error(`Unknown or duplicate semantic review argument: ${flag}`)
  }
  if (id !== null && (!id.includes("::packet::") || id.split("/").includes("..") || /[\r\n]/u.test(id))) {
    throw new Error(`Invalid packet ID: ${id}`)
  }
  if (command === "packet" && (!id || evidence)) throw new Error("packet requires --id")
  if (command === "record" && (!id || !evidence)) throw new Error("record requires --id and --evidence")
  return { command, id, evidence }
}

function maintainabilityContext() {
  const { rankedUnits } = buildMaintainabilityReport()
  return {
    units: rankedUnits.map(item => ({ id: item.unit.id, findings: item.findings }))
  }
}

function currentReview() {
  const sources = discoverAuthoredSources(root).map(inventorySource)
  const planned = planReviewPackets(sources)
  const packets = enrichReviewPackets({
    root,
    sources,
    packets: planned,
    maintainability: maintainabilityContext()
  })
  const materialized = packets.map(packet => materializeReviewPacket(packet, sources))
  return { sources, packets, materialized }
}

function atomicWrite(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, value)
  renameSync(temporary, path)
}

function artifactName(id) {
  return createHash("sha256").update(id).digest("hex")
}

function writeInventory(review) {
  const temporary = `${reportDirectory}.${process.pid}.tmp`
  const backup = `${reportDirectory}.${process.pid}.bak`
  rmSync(temporary, { recursive: true, force: true })
  rmSync(backup, { recursive: true, force: true })
  mkdirSync(resolve(temporary, "packets"), { recursive: true })
  writeFileSync(resolve(temporary, "index.json"), renderPacketIndex(review.packets, review.sources))
  for (const packet of review.packets) {
    const name = artifactName(packet.id)
    writeFileSync(resolve(temporary, "packets", `${name}.json`), renderPacketJson(packet, review.sources))
    writeFileSync(resolve(temporary, "packets", `${name}.md`), renderPacketMarkdown(packet, review.sources))
  }
  if (existsSync(reportDirectory)) renameSync(reportDirectory, backup)
  try {
    renameSync(temporary, reportDirectory)
    rmSync(backup, { recursive: true, force: true })
  } catch (error) {
    if (!existsSync(reportDirectory) && existsSync(backup)) renameSync(backup, reportDirectory)
    throw error
  }
}

function readLedger() {
  if (!existsSync(ledgerPath)) throw new Error("Semantic review ledger is missing")
  try {
    return JSON.parse(readFileSync(ledgerPath, "utf8"))
  } catch {
    throw new Error("Semantic review ledger is not valid JSON")
  }
}

function evidenceMap(ledger) {
  const evidence = new Map()
  for (const record of ledger.records ?? []) {
    if (typeof record.evidencePath !== "string") continue
    const path = resolve(root, record.evidencePath)
    if (existsSync(path)) evidence.set(record.evidencePath, readFileSync(path, "utf8"))
  }
  return evidence
}

function ledgerReport(review) {
  const ledger = readLedger()
  return validateLedger({
    ledger,
    packets: review.materialized,
    evidenceByPath: evidenceMap(ledger)
  })
}

function remaining(report) {
  return report.unreviewed.length
    + report.stale.length
    + report.changesRequested.length
    + report.oversized.length
}

function printReport(report) {
  console.log([
    `approved=${report.approved.length}`,
    `unreviewed=${report.unreviewed.length}`,
    `stale=${report.stale.length}`,
    `changes-requested=${report.changesRequested.length}`,
    `oversized=${report.oversized.length}`
  ].join(" "))
}

function queue(review) {
  const report = ledgerReport(review)
  printReport(report)
  const stateById = new Map()
  for (const [state, ids] of [
    ["changes-requested", report.changesRequested],
    ["stale", report.stale],
    ["oversized", report.oversized],
    ["unreviewed", report.unreviewed]
  ]) {
    for (const id of ids) if (!stateById.has(id)) stateById.set(id, state)
  }
  if (stateById.size === 0) {
    console.log("No semantic review work remains")
    return 0
  }
  for (const packet of review.materialized
    .filter(item => stateById.has(item.id))
    .sort((left, right) => right.riskScore - left.riskScore || compareText(left.id, right.id))
    .slice(0, 20)) {
    console.log(`- ${stateById.get(packet.id)} risk=${packet.riskScore} ${packet.id}`)
  }
  return 1
}

function validateEvidencePath(path) {
  if (typeof path !== "string"
    || !/^quality\/semantic-reviews\/[a-z0-9][a-z0-9._-]*\.json$/u.test(path)
    || path.split("/").includes("..")) {
    throw new Error(`Invalid review evidence path: ${String(path)}`)
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  const review = currentReview()
  if (options.command === "inventory") {
    writeInventory(review)
    const unitCount = review.sources.reduce((total, source) => total + source.units.length, 0)
    console.log(`Semantic review inventory: packets=${review.packets.length} units=${unitCount}`)
    return 0
  }
  if (options.command === "packet") {
    const packet = review.packets.find(item => item.id === options.id)
    if (!packet) throw new Error(`Unknown semantic review packet: ${options.id}`)
    process.stdout.write(renderPacketMarkdown(packet, review.sources))
    return 0
  }
  if (options.command === "record") {
    validateEvidencePath(options.evidence)
    const packet = review.materialized.find(item => item.id === options.id)
    if (!packet) throw new Error(`Unknown semantic review packet: ${options.id}`)
    const evidencePath = resolve(root, options.evidence)
    if (!existsSync(evidencePath)) throw new Error(`Missing review evidence: ${options.evidence}`)
    const serialized = recordEvidence({
      ledger: readLedger(),
      packet,
      evidencePath: options.evidence,
      evidenceText: readFileSync(evidencePath, "utf8")
    })
    atomicWrite(ledgerPath, serialized)
    console.log(`Recorded semantic review: ${packet.id}`)
    return 0
  }
  if (options.command === "queue") return queue(review)
  const report = ledgerReport(review)
  printReport(report)
  return remaining(report) === 0 ? 0 : 1
}

try {
  process.exitCode = main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 2
}
