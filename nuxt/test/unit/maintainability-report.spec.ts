import { describe, expect, test } from "vitest"

import {
  renderReviewJson,
  renderReviewMarkdown
} from "../../scripts/maintainability/report.mjs"

function finding(overrides: Record<string, unknown> = {}) {
  return {
    fingerprint: "f-library",
    tool: "sonarjs",
    rule: "cognitive-complexity",
    severity: "advisory",
    path: "app/pages/bibliotek.vue",
    line: 440,
    column: 3,
    identity: "cognitive-complexity>12",
    message: "Complexity is 24; maximum is 12.",
    measured: 24,
    threshold: 12,
    changedLineOverlap: true,
    dependencyEdges: [{ from: "app/lib/library.ts", to: "app/pages/bibliotek.vue" }],
    unit: {
      id: "app/pages/bibliotek.vue::function::fetchLibraryPageData",
      kind: "function",
      name: "fetchLibraryPageData",
      path: "app/pages/bibliotek.vue",
      startLine: 434,
      endLine: 463
    },
    ...overrides
  }
}

function report(reverse = false) {
  const libraryFinding = finding()
  const readerFinding = finding({
    fingerprint: "f-reader",
    tool: "knip",
    rule: "exports",
    severity: "info",
    path: "app/lib/reader.ts",
    line: 20,
    column: 1,
    identity: "exports:legacyReader",
    message: "Unused exports: legacyReader",
    measured: undefined,
    threshold: undefined,
    changedLineOverlap: false,
    dependencyEdges: undefined,
    unit: {
      id: "app/lib/reader.ts::function::legacyReader",
      kind: "function",
      name: "legacyReader",
      path: "app/lib/reader.ts",
      startLine: 20,
      endLine: 25
    }
  })
  const units = [
    {
      unit: libraryFinding.unit,
      findings: [libraryFinding],
      score: 20,
      changedLineOverlap: true,
      tools: ["sonarjs"],
      rules: ["sonarjs/cognitive-complexity"],
      selectionReasons: ["12 total threshold excess", "overlaps changed lines"]
    },
    {
      unit: readerFinding.unit,
      findings: [readerFinding],
      score: 3,
      changedLineOverlap: false,
      tools: ["knip"],
      rules: ["knip/exports"],
      selectionReasons: []
    }
  ]
  return {
    currentFindings: reverse ? [readerFinding, libraryFinding] : [libraryFinding, readerFinding],
    newFindings: [libraryFinding],
    knownFindings: [readerFinding],
    resolvedFingerprints: ["z-resolved", "a-resolved"],
    rankedUnits: reverse ? units.toReversed() : units
  }
}

describe("maintainability review packet", () => {
  test("renders the complete deterministic JSON contract without copied source", () => {
    const rendered = renderReviewJson(report())
    const packet = JSON.parse(rendered)

    expect(packet).toMatchObject({
      version: 1,
      summary: { current: 2, new: 1, known: 1, resolved: 2 },
      resolvedFingerprints: ["a-resolved", "z-resolved"]
    })
    expect(packet.units[0]).toMatchObject({
      id: "app/pages/bibliotek.vue::function::fetchLibraryPageData",
      path: "app/pages/bibliotek.vue",
      startLine: 434,
      endLine: 463,
      score: 20,
      changedLineOverlap: true,
      selectionReasons: ["12 total threshold excess", "overlaps changed lines"],
      findings: [{
        tool: "sonarjs",
        rule: "cognitive-complexity",
        line: 440,
        dependencyEdges: [{ from: "app/lib/library.ts", to: "app/pages/bibliotek.vue" }]
      }]
    })
    expect(rendered).not.toContain("source")
    expect(rendered.endsWith("\n")).toBe(true)
  })

  test("renders equivalent Markdown evidence without embedding source", () => {
    const rendered = renderReviewMarkdown(report())

    expect(rendered).toContain("Current findings | 2")
    expect(rendered).toContain("`app/pages/bibliotek.vue::function::fetchLibraryPageData`")
    expect(rendered).toContain("Lines | 434–463")
    expect(rendered).toContain("sonarjs/cognitive-complexity")
    expect(rendered).toContain("app/lib/library.ts → app/pages/bibliotek.vue")
    expect(rendered).toContain("12 total threshold excess; overlaps changed lines")
    expect(rendered).not.toContain("```ts")
    expect(rendered.endsWith("\n")).toBe(true)
  })

  test("is byte-identical regardless of insertion order", () => {
    expect(renderReviewJson(report(true))).toBe(renderReviewJson(report(false)))
    expect(renderReviewMarkdown(report(true))).toBe(renderReviewMarkdown(report(false)))
  })
})
