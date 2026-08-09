import { createHash } from "node:crypto"

import { describe, expect, test } from "vitest"

import {
  parseEvidence,
  recordEvidence,
  serializeLedger,
  validateLedger
} from "../../scripts/semantic-review/ledger.mjs"

function packet(overrides: Record<string, unknown> = {}) {
  return {
    id: "app/lib/books.ts::packet::loadBooks",
    fingerprint: "a".repeat(64),
    productionLines: 20,
    oversized: false,
    waiver: null,
    riskScore: 8,
    riskFlags: ["api-boundary"],
    paths: ["app/lib/books.ts"],
    imports: [],
    callers: [],
    typeBoundaries: [],
    tests: [],
    maintainabilityFindings: [],
    units: [{
      id: "app/lib/books.ts::function::loadBooks",
      kind: "function",
      name: "loadBooks",
      path: "app/lib/books.ts",
      startLine: 10,
      endLine: 29,
      lines: [[10, 29]],
      root: true,
      exported: true
    }],
    ...overrides
  }
}

function finding(overrides: Record<string, unknown> = {}) {
  return {
    id: "finding-1",
    severity: "minor",
    category: "complexity",
    path: "app/lib/books.ts",
    unitId: "app/lib/books.ts::function::loadBooks",
    line: 15,
    summary: "A branch can be deleted",
    consequence: "The duplicate branch obscures the request contract.",
    evidence: "Both branches return the same value.",
    recommendation: "Return the shared value directly.",
    status: "resolved",
    resolution: "Removed the duplicate branch.",
    resolutionCommit: "0123456789abcdef0123456789abcdef01234567",
    verification: ["yarn vitest run test/unit/books.spec.ts"],
    ...overrides
  }
}

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    packetId: "app/lib/books.ts::packet::loadBooks",
    packetFingerprint: "a".repeat(64),
    author: "implementation-agent",
    reviewer: "independent-codex-review",
    method: "codex-read-only",
    verdict: "approved",
    findings: [],
    verification: ["yarn vitest run test/unit/books.spec.ts"],
    ...overrides
  }
}

function evidenceText(value = evidence()): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function record(value = evidence()) {
  const text = evidenceText(value)
  return {
    packetId: value.packetId,
    fingerprint: value.packetFingerprint,
    state: value.verdict,
    reviewer: value.reviewer,
    method: value.method,
    evidencePath: "quality/semantic-reviews/books.json",
    evidenceHash: createHash("sha256").update(text).digest("hex"),
    findingIds: value.findings.map(item => item.id).toSorted(),
    verification: [...value.verification].toSorted()
  }
}

describe("semantic review ledger", () => {
  test("accepts bounded independent evidence for the current packet", () => {
    expect(parseEvidence(evidence({ findings: [finding()] }), packet())).toMatchObject({
      verdict: "approved",
      findings: [{ id: "finding-1", status: "resolved" }]
    })
  })

  test.each([
    ["unknown evidence field", { ...evidence(), surprise: true }, "unknown field"],
    ["self review", evidence({ reviewer: "implementation-agent" }), "must be independent"],
    ["duplicate finding IDs", evidence({ findings: [finding(), finding()] }), "Duplicate finding ID"],
    ["foreign path", evidence({ findings: [finding({ path: "app/lib/other.ts" })] }), "outside packet paths"],
    ["foreign unit", evidence({ findings: [finding({ unitId: "app/lib/books.ts::function::other" })] }), "outside packet units"],
    ["line outside unit", evidence({ findings: [finding({ line: 30 })] }), "outside unit range"],
    ["line in an unowned gap", evidence({ findings: [finding()] }), "outside unit range", packet({
      units: [{
        ...packet().units[0],
        lines: [[10, 12], [20, 29]]
      }]
    })],
    ["empty verification", evidence({ verification: [""] }), "verification command"],
    ["multiline verification", evidence({ verification: ["yarn lint\nrm -rf build"] }), "verification command"],
    ["approved unresolved Important", evidence({
      findings: [finding({ severity: "important", status: "unresolved", resolution: null, resolutionCommit: null })]
    }), "cannot approve unresolved Important or Critical findings"]
  ])("rejects %s", (_label, value, message, boundedPacket = packet()) => {
    expect(() => parseEvidence(value, boundedPacket)).toThrow(message)
  })

  test("reports missing, stale, changes-requested, and oversized approvals", () => {
    const currentEvidence = evidenceText()
    const currentRecord = record()
    const evidenceByPath = new Map([[currentRecord.evidencePath, currentEvidence]])

    expect(validateLedger({
      ledger: { version: 1, records: [] },
      packets: [packet()],
      evidenceByPath: new Map()
    })).toMatchObject({ unreviewed: [packet().id] })

    const staleEvidenceValue = evidence({ findings: [
      finding(),
      finding({ id: "finding-2", line: 25 })
    ] })
    const staleRecord = record(staleEvidenceValue)
    expect(validateLedger({
      ledger: { version: 1, records: [staleRecord] },
      packets: [packet({
        fingerprint: "b".repeat(64),
        units: [{ ...packet().units[0], startLine: 100, endLine: 119, lines: [[100, 119]] }]
      })],
      evidenceByPath: new Map([[staleRecord.evidencePath, evidenceText(staleEvidenceValue)]])
    })).toMatchObject({ stale: [packet().id] })

    const requested = evidence({ verdict: "changes-requested", findings: [finding({
      severity: "important",
      status: "unresolved",
      resolution: null,
      resolutionCommit: null
    })] })
    const requestedRecord = record(requested)
    expect(validateLedger({
      ledger: { version: 1, records: [requestedRecord] },
      packets: [packet()],
      evidenceByPath: new Map([[requestedRecord.evidencePath, evidenceText(requested)]])
    })).toMatchObject({ changesRequested: [packet().id] })

    expect(validateLedger({
      ledger: { version: 1, records: [currentRecord] },
      packets: [packet({ oversized: true })],
      evidenceByPath
    })).toMatchObject({ oversized: [packet().id] })
  })

  test("rejects missing and hash-mismatched evidence", () => {
    const currentRecord = record()
    expect(() => validateLedger({
      ledger: { version: 1, records: [currentRecord] },
      packets: [packet()],
      evidenceByPath: new Map()
    })).toThrow("Missing review evidence")
    expect(() => validateLedger({
      ledger: { version: 1, records: [currentRecord] },
      packets: [packet()],
      evidenceByPath: new Map([[currentRecord.evidencePath, `${evidenceText()} `]])
    })).toThrow("Review evidence hash mismatch")
  })

  test("records exactly one validated evidence document and serializes canonically", () => {
    const firstPacket = packet()
    const nextPacket = packet({
      id: "app/lib/authors.ts::packet::loadAuthors",
      fingerprint: "b".repeat(64),
      paths: ["app/lib/authors.ts"],
      units: [{
        id: "app/lib/authors.ts::function::loadAuthors",
        kind: "function",
        name: "loadAuthors",
        path: "app/lib/authors.ts",
        startLine: 1,
        endLine: 5,
        lines: [[1, 5]],
        root: true,
        exported: true
      }]
    })
    const firstEvidence = evidenceText()
    const firstLedger = JSON.parse(recordEvidence({
      ledger: { version: 1, records: [] },
      packet: firstPacket,
      evidencePath: "quality/semantic-reviews/books.json",
      evidenceText: firstEvidence
    }))
    const nextEvidenceValue = evidence({
      packetId: nextPacket.id,
      packetFingerprint: nextPacket.fingerprint,
      findings: []
    })
    const nextEvidence = evidenceText(nextEvidenceValue)
    const withBoth = recordEvidence({
      ledger: firstLedger,
      packet: nextPacket,
      evidencePath: "quality/semantic-reviews/authors.json",
      evidenceText: nextEvidence
    })

    expect(JSON.parse(withBoth).records.map((item: { packetId: string }) => item.packetId)).toEqual([
      nextPacket.id,
      firstPacket.id
    ])
    expect(withBoth).toBe(serializeLedger(JSON.parse(withBoth).records.toReversed()))
    expect(withBoth.endsWith("\n")).toBe(true)
  })
})
