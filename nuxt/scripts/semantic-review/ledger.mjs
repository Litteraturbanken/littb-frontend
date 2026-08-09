import { createHash } from "node:crypto"

const evidenceFields = [
  "author",
  "findings",
  "method",
  "packetFingerprint",
  "packetId",
  "reviewer",
  "verdict",
  "verification",
  "version"
]
const findingFields = [
  "category",
  "consequence",
  "evidence",
  "id",
  "line",
  "path",
  "recommendation",
  "resolution",
  "resolutionCommit",
  "severity",
  "status",
  "summary",
  "unitId",
  "verification"
]
const recordFields = [
  "evidenceHash",
  "evidencePath",
  "findingIds",
  "fingerprint",
  "method",
  "packetId",
  "reviewer",
  "state",
  "verification"
]
const severities = new Set(["critical", "important", "minor", "question"])
const categories = new Set([
  "accessibility",
  "complexity",
  "concurrency",
  "consistency",
  "correctness",
  "duplication",
  "security",
  "tests",
  "types"
])
const findingStatuses = new Set(["false-positive", "question", "resolved", "unresolved"])
const verdicts = new Set(["approved", "changes-requested"])

function compareText(left, right) {
  return String(left).localeCompare(String(right), "en")
}

function assertExactObject(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  const actual = Object.keys(value).sort(compareText)
  const expected = [...fields].sort(compareText)
  const unknown = actual.find(field => !expected.includes(field))
  if (unknown) throw new Error(`${label} has unknown field: ${unknown}`)
  const missing = expected.find(field => !actual.includes(field))
  if (missing) throw new Error(`${label} is missing field: ${missing}`)
}

function nonemptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} must be a nonempty string`)
  return value
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function assertFingerprint(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${label} must be a lowercase SHA-256`)
  }
}

function validateVerification(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${label} must contain a verification command`)
  }
  for (const command of value) {
    if (typeof command !== "string" || !command.trim() || /[\r\n]/u.test(command)) {
      throw new TypeError(`${label} contains an invalid verification command`)
    }
  }
  return [...value]
}

function packetUnit(packet, finding) {
  if (!packet.paths.includes(finding.path)) {
    throw new Error(`Finding ${finding.id} is outside packet paths`)
  }
  const unit = packet.units.find(candidate => candidate.id === finding.unitId)
  if (!unit) throw new Error(`Finding ${finding.id} is outside packet units`)
  const lineIsOwned = Array.isArray(unit.lines)
    ? unit.lines.some(([start, end]) => start <= finding.line && finding.line <= end)
    : unit.startLine <= finding.line && finding.line <= unit.endLine
  if (!Number.isInteger(finding.line) || !lineIsOwned) {
    throw new Error(`Finding ${finding.id} line is outside unit range`)
  }
  return unit
}

function parseFinding(value, packet) {
  assertExactObject(value, findingFields, "Review finding")
  nonemptyString(value.id, "Finding id")
  if (!severities.has(value.severity)) throw new Error(`Invalid finding severity: ${String(value.severity)}`)
  if (!categories.has(value.category)) throw new Error(`Invalid finding category: ${String(value.category)}`)
  if (!findingStatuses.has(value.status)) throw new Error(`Invalid finding status: ${String(value.status)}`)
  for (const field of ["path", "unitId", "summary", "consequence", "evidence", "recommendation"]) {
    nonemptyString(value[field], `Finding ${field}`)
  }
  packetUnit(packet, value)
  validateVerification(value.verification, `Finding ${value.id}`)
  if (value.status === "resolved") {
    nonemptyString(value.resolution, `Finding ${value.id} resolution`)
    if (typeof value.resolutionCommit !== "string" || !/^[a-f0-9]{7,64}$/u.test(value.resolutionCommit)) {
      throw new Error(`Finding ${value.id} has an invalid resolution commit`)
    }
  } else {
    if (value.resolution !== null && (typeof value.resolution !== "string" || !value.resolution.trim())) {
      throw new Error(`Finding ${value.id} has an invalid resolution`)
    }
    if (value.resolutionCommit !== null) {
      throw new Error(`Finding ${value.id} cannot have a resolution commit`)
    }
  }
  return value
}

export function parseEvidence(value, packet) {
  assertExactObject(value, evidenceFields, "Review evidence")
  if (value.version !== 1) throw new Error("Review evidence must use schema version 1")
  if (value.packetId !== packet.id) throw new Error("Review evidence packet ID does not match")
  assertFingerprint(value.packetFingerprint, "Review evidence fingerprint")
  if (value.packetFingerprint !== packet.fingerprint) {
    throw new Error("Review evidence fingerprint does not match")
  }
  nonemptyString(value.author, "Review author")
  nonemptyString(value.reviewer, "Review reviewer")
  if (value.author === value.reviewer) throw new Error("Review evidence must be independent")
  if (value.method !== "codex-read-only") throw new Error("Review evidence method must be codex-read-only")
  if (!verdicts.has(value.verdict)) throw new Error(`Invalid review verdict: ${String(value.verdict)}`)
  if (!Array.isArray(value.findings)) throw new TypeError("Review findings must be an array")
  const identifiers = new Set()
  for (const finding of value.findings) {
    parseFinding(finding, packet)
    if (identifiers.has(finding.id)) throw new Error(`Duplicate finding ID: ${finding.id}`)
    identifiers.add(finding.id)
  }
  validateVerification(value.verification, "Review evidence")
  if (value.verdict === "approved" && value.findings.some(finding => (
    ["critical", "important"].includes(finding.severity) && finding.status === "unresolved"
  ))) {
    throw new Error("Review evidence cannot approve unresolved Important or Critical findings")
  }
  return value
}

function assertEvidencePath(path) {
  if (typeof path !== "string"
    || !/^quality\/semantic-reviews\/[a-z0-9][a-z0-9._-]*\.json$/u.test(path)
    || path.split("/").includes("..")) {
    throw new Error(`Invalid review evidence path: ${String(path)}`)
  }
}

function canonicalRecord(record) {
  assertExactObject(record, recordFields, "Review ledger record")
  assertFingerprint(record.fingerprint, "Ledger fingerprint")
  assertFingerprint(record.evidenceHash, "Ledger evidence hash")
  assertEvidencePath(record.evidencePath)
  nonemptyString(record.packetId, "Ledger packet ID")
  nonemptyString(record.reviewer, "Ledger reviewer")
  if (record.method !== "codex-read-only") throw new Error("Ledger method must be codex-read-only")
  if (!verdicts.has(record.state)) throw new Error(`Invalid ledger state: ${String(record.state)}`)
  if (!Array.isArray(record.findingIds)
    || record.findingIds.some(id => typeof id !== "string" || !id.trim())
    || new Set(record.findingIds).size !== record.findingIds.length) {
    throw new Error("Ledger finding IDs must be unique nonempty strings")
  }
  validateVerification(record.verification, "Ledger record")
  return {
    packetId: record.packetId,
    fingerprint: record.fingerprint,
    state: record.state,
    reviewer: record.reviewer,
    method: record.method,
    evidencePath: record.evidencePath,
    evidenceHash: record.evidenceHash,
    findingIds: [...record.findingIds].sort(compareText),
    verification: [...record.verification].sort(compareText)
  }
}

export function serializeLedger(records) {
  const canonical = records.map(canonicalRecord)
    .sort((left, right) => compareText(left.packetId, right.packetId))
  const seen = new Set()
  for (const record of canonical) {
    if (seen.has(record.packetId)) throw new Error(`Duplicate ledger packet: ${record.packetId}`)
    seen.add(record.packetId)
  }
  return `${JSON.stringify({ version: 1, records: canonical }, null, 2)}\n`
}

function parseLedger(ledger) {
  assertExactObject(ledger, ["records", "version"], "Review ledger")
  if (ledger.version !== 1 || !Array.isArray(ledger.records)) {
    throw new Error("Review ledger must use schema version 1 with records")
  }
  return JSON.parse(serializeLedger(ledger.records)).records
}

function recordMatchesEvidence(record, evidence) {
  const expectedIds = evidence.findings.map(finding => finding.id).sort(compareText)
  const expectedVerification = [...evidence.verification].sort(compareText)
  if (record.packetId !== evidence.packetId
    || record.fingerprint !== evidence.packetFingerprint
    || record.state !== evidence.verdict
    || record.reviewer !== evidence.reviewer
    || record.method !== evidence.method
    || JSON.stringify(record.findingIds) !== JSON.stringify(expectedIds)
    || JSON.stringify(record.verification) !== JSON.stringify(expectedVerification)) {
    throw new Error(`Ledger record does not match review evidence: ${record.packetId}`)
  }
}

function stalePacketSnapshot(record, evidence) {
  const units = new Map()
  for (const finding of evidence.findings ?? []) {
    if (!units.has(finding.unitId)) {
      units.set(finding.unitId, {
        id: finding.unitId,
        path: finding.path,
        startLine: finding.line,
        endLine: finding.line,
        lines: [[finding.line, finding.line]]
      })
      continue
    }
    const unit = units.get(finding.unitId)
    unit.startLine = Math.min(unit.startLine, finding.line)
    unit.endLine = Math.max(unit.endLine, finding.line)
    if (!unit.lines.some(([start]) => start === finding.line)) {
      unit.lines.push([finding.line, finding.line])
      unit.lines.sort((left, right) => left[0] - right[0])
    }
  }
  return {
    id: record.packetId,
    fingerprint: record.fingerprint,
    paths: [...new Set([...units.values()].map(unit => unit.path))],
    units: [...units.values()]
  }
}

export function validateLedger({ ledger, packets, evidenceByPath }) {
  const records = parseLedger(ledger)
  const packetById = new Map(packets.map(packet => [packet.id, packet]))
  const recordById = new Map(records.map(record => [record.packetId, record]))
  for (const record of records) {
    if (!packetById.has(record.packetId)) throw new Error(`Ledger references unknown packet: ${record.packetId}`)
    const evidenceText = evidenceByPath.get(record.evidencePath)
    if (typeof evidenceText !== "string") throw new Error(`Missing review evidence: ${record.evidencePath}`)
    if (sha256(evidenceText) !== record.evidenceHash) {
      throw new Error(`Review evidence hash mismatch: ${record.evidencePath}`)
    }
    let evidence
    try {
      evidence = JSON.parse(evidenceText)
    } catch {
      throw new Error(`Review evidence is not valid JSON: ${record.evidencePath}`)
    }
    const packet = packetById.get(record.packetId)
    parseEvidence(
      evidence,
      record.fingerprint === packet.fingerprint
        ? packet
        : stalePacketSnapshot(record, evidence)
    )
    recordMatchesEvidence(record, evidence)
  }
  const report = {
    approved: [],
    unreviewed: [],
    stale: [],
    changesRequested: [],
    oversized: [],
    errors: []
  }
  for (const packet of [...packets].sort((left, right) => compareText(left.id, right.id))) {
    const record = recordById.get(packet.id)
    if (!record) report.unreviewed.push(packet.id)
    else if (record.fingerprint !== packet.fingerprint) report.stale.push(packet.id)
    else if (record.state === "changes-requested") report.changesRequested.push(packet.id)
    else report.approved.push(packet.id)
    if (packet.oversized && !packet.waiver) report.oversized.push(packet.id)
  }
  return report
}

export function recordEvidence({ ledger, packet, evidencePath, evidenceText }) {
  assertEvidencePath(evidencePath)
  if (typeof evidenceText !== "string") throw new TypeError("Review evidence text must be a string")
  let evidence
  try {
    evidence = JSON.parse(evidenceText)
  } catch {
    throw new Error("Review evidence is not valid JSON")
  }
  parseEvidence(evidence, packet)
  const records = parseLedger(ledger).filter(record => record.packetId !== packet.id)
  records.push({
    packetId: packet.id,
    fingerprint: packet.fingerprint,
    state: evidence.verdict,
    reviewer: evidence.reviewer,
    method: evidence.method,
    evidencePath,
    evidenceHash: sha256(evidenceText),
    findingIds: evidence.findings.map(finding => finding.id).sort(compareText),
    verification: [...evidence.verification].sort(compareText)
  })
  return serializeLedger(records)
}
