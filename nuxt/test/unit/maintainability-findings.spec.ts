import { describe, expect, test } from "vitest"

import {
  compareWithBaseline,
  fingerprintFinding,
  rankReviewUnits,
  serializeBaseline
} from "../../scripts/maintainability/findings.mjs"

const loadUnit = {
  id: "app/pages/example.vue::function::load",
  kind: "function",
  name: "load",
  path: "app/pages/example.vue",
  startLine: 30,
  endLine: 80
}

function finding(overrides: Record<string, unknown> = {}) {
  return {
    tool: "sonarjs",
    rule: "cognitive-complexity",
    severity: "advisory",
    path: "app/pages/example.vue",
    line: 40,
    column: 3,
    unit: loadUnit,
    identity: "complexity>12",
    message: "Cognitive Complexity is 24; allowed 12",
    measured: 24,
    threshold: 12,
    changedLineOverlap: false,
    ...overrides
  }
}

describe("maintainability finding model", () => {
  test("fingerprints semantic identity without source positions", () => {
    const expected = "3477522d3da79077e7294dd2e0c03de6e082c93520f919f4c26cc01e0893bbf8"

    expect(fingerprintFinding(finding())).toBe(expected)
    expect(fingerprintFinding(finding({ line: 90, column: 20 }))).toBe(expected)
    expect(fingerprintFinding(finding({ rule: "max-lines-per-function" }))).not.toBe(expected)
    expect(fingerprintFinding(finding({ identity: "complexity>20" }))).not.toBe(expected)
    expect(fingerprintFinding(finding({ unit: { ...loadUnit, id: `${loadUnit.id}.inner` } })))
      .not.toBe(expected)
  })

  test("partitions new, known, and resolved findings", () => {
    const known = finding()
    const added = finding({
      tool: "knip",
      rule: "exports",
      severity: "info",
      identity: "unused:load",
      message: "Unused export load",
      measured: null,
      threshold: null
    })
    const baseline = {
      version: 1,
      findings: [
        {
          fingerprint: fingerprintFinding(known),
          tool: known.tool,
          rule: known.rule,
          path: known.path,
          unitId: known.unit.id,
          identity: known.identity
        },
        {
          fingerprint: "resolved-fingerprint",
          tool: "knip",
          rule: "files",
          path: "app/old.ts",
          unitId: "app/old.ts::module::app/old.ts",
          identity: "unused-file"
        }
      ]
    }

    const result = compareWithBaseline([known, known, added], baseline)

    expect(result.current).toHaveLength(2)
    expect(result.knownFindings.map(item => item.fingerprint))
      .toEqual([fingerprintFinding(known)])
    expect(result.newFindings.map(item => item.fingerprint))
      .toEqual([fingerprintFinding(added)])
    expect(result.resolvedFingerprints).toEqual(["resolved-fingerprint"])
  })

  test("ranks cross-tool agreement above an isolated blocking finding", () => {
    const corroborating = finding({
      tool: "knip",
      rule: "exports",
      severity: "info",
      identity: "unused:load",
      measured: null,
      threshold: null,
      changedLineOverlap: true
    })
    const isolated = finding({
      tool: "ast-grep",
      rule: "identity-adapter",
      severity: "blocking",
      path: "app/isolated.ts",
      unit: {
        id: "app/isolated.ts::function::adapter",
        kind: "function",
        name: "adapter",
        path: "app/isolated.ts",
        startLine: 1,
        endLine: 5
      },
      identity: "identity-adapter",
      measured: null,
      threshold: null
    })

    const ranked = rankReviewUnits([isolated, finding(), corroborating, finding()])

    expect(ranked).toHaveLength(2)
    expect(ranked[0]).toMatchObject({
      unit: loadUnit,
      score: 28,
      changedLineOverlap: true,
      tools: ["knip", "sonarjs"]
    })
    expect(ranked[0]!.findings).toHaveLength(2)
    expect(ranked[1]).toMatchObject({ score: 10 })
  })

  test("serializes a sorted baseline with a final newline", () => {
    const later = finding({ tool: "z-tool", rule: "z-rule", identity: "z" })
    const earlier = finding({ tool: "a-tool", rule: "a-rule", identity: "a" })

    const serialized = serializeBaseline([later, earlier, earlier])
    const parsed = JSON.parse(serialized) as {
      version: number
      findings: Array<{ tool: string, fingerprint: string }>
    }

    expect(serialized.endsWith("\n")).toBe(true)
    expect(parsed.version).toBe(1)
    expect(parsed.findings).toHaveLength(2)
    expect(parsed.findings.map(item => item.tool)).toEqual(["a-tool", "z-tool"])
  })

  test("deduplicates findings without losing changed-line evidence", () => {
    const ranked = rankReviewUnits([
      finding({ line: 40, changedLineOverlap: false }),
      finding({ line: 90, changedLineOverlap: true })
    ])

    expect(ranked).toHaveLength(1)
    expect(ranked[0]).toMatchObject({ changedLineOverlap: true, score: 20 })
    expect(ranked[0]!.findings).toHaveLength(1)
  })
})
