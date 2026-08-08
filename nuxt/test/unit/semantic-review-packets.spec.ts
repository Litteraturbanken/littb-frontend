import { describe, expect, test } from "vitest"

import {
  fingerprintPacket,
  materializeReviewPacket,
  renderPacketIndex,
  renderPacketJson,
  renderPacketMarkdown
} from "../../scripts/semantic-review/packets.mjs"
import { planReviewPackets } from "../../scripts/semantic-review/packet-planner.mjs"
import { inventorySource } from "../../scripts/semantic-review/source-inventory.mjs"

function source(path: string, text: string) {
  return inventorySource({ path, source: text })
}

function packetFor(sources: ReturnType<typeof source>[]) {
  const packet = planReviewPackets(sources)[0]!
  return {
    ...packet,
    imports: ["app/lib/client.ts"],
    callers: ["app/pages/index.vue"],
    typeBoundaries: ["app/lib/api/generated/lbapi.ts#components"],
    tests: [{ path: "test/unit/books.spec.ts", evidence: "import" }],
    riskFlags: ["api-boundary"],
    riskScore: 8,
    maintainabilityFindings: []
  }
}

describe("semantic review packets", () => {
  test("keeps a named unit fingerprint stable across unrelated line movement", () => {
    const originalSources = [source("app/lib/books.ts", [
      "export function loadBooks() {",
      "  return ['Doktor Glas']",
      "}"
    ].join("\n"))]
    const movedSources = [source("app/lib/books.ts", [
      "",
      "",
      "export function loadBooks() {",
      "  return ['Doktor Glas']",
      "}"
    ].join("\n"))]

    expect(fingerprintPacket(packetFor(originalSources), originalSources))
      .toBe(fingerprintPacket(packetFor(movedSources), movedSources))
  })

  test("invalidates the fingerprint on implementation, ownership, contract, or neighbor changes", () => {
    const sources = [source("app/lib/books.ts", [
      "export function loadBooks(limit: number) {",
      "  return ['Doktor Glas'].slice(0, limit)",
      "}"
    ].join("\n"))]
    const packet = packetFor(sources)
    const current = fingerprintPacket(packet, sources)

    const changedSources = [source("app/lib/books.ts", [
      "export function loadBooks(limit: number) {",
      "  return ['Doktor Glas', 'Martin Bircks ungdom'].slice(0, limit)",
      "}"
    ].join("\n"))]
    const contractSources = [source("app/lib/books.ts", [
      "export function loadBooks(limit: string) {",
      "  return ['Doktor Glas'].slice(0, Number(limit))",
      "}"
    ].join("\n"))]

    expect(fingerprintPacket(packetFor(changedSources), changedSources)).not.toBe(current)
    expect(fingerprintPacket(packetFor(contractSources), contractSources)).not.toBe(current)
    expect(fingerprintPacket({ ...packet, rootUnitIds: [] }, sources)).not.toBe(current)
    expect(fingerprintPacket({ ...packet, imports: ["app/lib/other-client.ts"] }, sources))
      .not.toBe(current)
    expect(fingerprintPacket({ ...packet, callers: ["app/pages/other.vue"] }, sources))
      .not.toBe(current)
  })

  test("does not fingerprint attached test context", () => {
    const sources = [source("app/lib/books.ts", "export const books = ['Doktor Glas']\n")]
    const packet = packetFor(sources)

    expect(fingerprintPacket(packet, sources)).toBe(fingerprintPacket({
      ...packet,
      tests: [{ path: "test/unit/renamed-books.spec.ts", evidence: "basename" }]
    }, sources))
  })

  test("materializes current locations without copying implementation source", () => {
    const sources = [source("app/lib/books.ts", [
      "export function loadBooks() {",
      "  return ['Doktor Glas']",
      "}"
    ].join("\n"))]
    const materialized = materializeReviewPacket(packetFor(sources), sources)

    expect(materialized).toMatchObject({
      id: "app/lib/books.ts::packet::loadBooks",
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      units: [{
        id: "app/lib/books.ts::function::loadBooks",
        path: "app/lib/books.ts",
        startLine: 1,
        endLine: 3,
        root: true,
        exported: true
      }]
    })
    expect(JSON.stringify(materialized)).not.toContain("Doktor Glas")
  })

  test("renders deterministic JSON, Markdown, and index artifacts", () => {
    const alphaSources = [source("shared/alpha.ts", "export const alpha = true\n")]
    const zetaSources = [source("shared/zeta.ts", "export const zeta = true\n")]
    const alpha = packetFor(alphaSources)
    const zeta = { ...packetFor(zetaSources), riskScore: 12, riskFlags: ["route", "untested"] }
    const allSources = [...zetaSources, ...alphaSources]

    const forward = renderPacketIndex([alpha, zeta], allSources)
    const reverse = renderPacketIndex([zeta, alpha], allSources.toReversed())
    const json = renderPacketJson(alpha, alphaSources)
    const markdown = renderPacketMarkdown(alpha, alphaSources)

    expect(forward).toBe(reverse)
    expect(JSON.parse(forward)).toMatchObject({
      version: 1,
      summary: { packets: 2, oversized: 0, productionLines: 2 },
      packets: [
        { id: "shared/zeta.ts::packet::module", riskScore: 12 },
        { id: "shared/alpha.ts::packet::module", riskScore: 8 }
      ]
    })
    expect(JSON.parse(json)).toMatchObject({
      version: 1,
      packet: { id: "shared/alpha.ts::packet::module" }
    })
    expect(markdown).toContain("# Semantic review packet")
    expect(markdown).toContain("`shared/alpha.ts::module::shared/alpha.ts`")
    expect(markdown).toContain("quality/semantic-review-contract.md")
    for (const artifact of [forward, json, markdown]) {
      expect(artifact.endsWith("\n")).toBe(true)
      expect(artifact).not.toContain(process.cwd())
      expect(artifact).not.toMatch(/20\d\d-\d\d-\d\dT/u)
    }
  })
})
