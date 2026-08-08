import { describe, expect, test } from "vitest"

import {
  parseAstGrepFindings,
  parseDependencyCruiserFindings,
  parseEslintFindings,
  parseKnipFindings
} from "../../scripts/maintainability/adapters.mjs"

const root = "/repo/nuxt"

describe("maintainability analyzer adapters", () => {
  test("normalizes SonarJS diagnostics without line numbers in their identity", () => {
    const findings = parseEslintFindings([{
      filePath: `${root}/app/pages/large.vue`,
      messages: [{
        ruleId: "sonarjs/cognitive-complexity",
        severity: 1,
        message: "Refactor this function to reduce its Cognitive Complexity from 24 to the 12 allowed.",
        line: 14,
        column: 3,
        endLine: 90,
        endColumn: 4
      }]
    }], { root })

    expect(findings).toEqual([expect.objectContaining({
      tool: "sonarjs",
      rule: "cognitive-complexity",
      severity: "advisory",
      path: "app/pages/large.vue",
      line: 14,
      column: 3,
      identity: "cognitive-complexity>12",
      measured: 24,
      threshold: 12
    })])
    expect(findings[0]!.identity).not.toContain("14")
  })

  test.each([
    [
      "cyclomatic JSON payload",
      "sonarjs/cyclomatic-complexity",
      JSON.stringify({ message: "Function has a complexity of 15 which is greater than 12 authorized.", cost: 3, secondaryLocations: [] }),
      "cyclomatic-complexity>12",
      15,
      12
    ],
    [
      "maximum function lines",
      "sonarjs/max-lines-per-function",
      "This function has 123 lines, which is greater than the 80 lines authorized. Split it into smaller functions.",
      "max-lines-per-function>80",
      123,
      80
    ]
  ])("normalizes the real SonarJS %s shape", (_name, ruleId, message, identity, measured, threshold) => {
    const [finding] = parseEslintFindings([{
      filePath: `${root}/app/lib/example.ts`,
      messages: [{ ruleId, severity: 1, message, line: 8, column: 2 }]
    }], { root })

    expect(finding).toEqual(expect.objectContaining({ identity, measured, threshold }))
  })

  test("normalizes each authored Knip issue category", () => {
    const findings = parseKnipFindings({ issues: [{
      file: "app/lib/library/view-model.ts",
      dependencies: [{ name: "unused-package", line: 3, col: 8, pos: 42 }],
      devDependencies: [],
      exports: [{ name: "unusedExport", line: 9, col: 17, pos: 120 }],
      files: [],
      optionalPeerDependencies: [],
      types: [{ name: "UnusedType", line: 15, col: 13, pos: 220 }],
      unlisted: [{ name: "direct-package", line: 21, col: 8, pos: 310 }]
    }] }, { root })

    expect(findings).toEqual([
      expect.objectContaining({ rule: "dependencies", path: "app/lib/library/view-model.ts", line: 3, column: 8, identity: "dependencies:unused-package" }),
      expect.objectContaining({ rule: "exports", path: "app/lib/library/view-model.ts", line: 9, column: 17, identity: "exports:unusedExport" }),
      expect.objectContaining({ rule: "types", path: "app/lib/library/view-model.ts", line: 15, column: 13, identity: "types:UnusedType" }),
      expect.objectContaining({ rule: "unlisted", path: "app/lib/library/view-model.ts", line: 21, column: 8, identity: "unlisted:direct-package" })
    ])
    expect(findings.every(finding => finding.tool === "knip" && finding.severity === "info")).toBe(true)
  })

  test("normalizes dependency-cruiser violations including stable edges", () => {
    const findings = parseDependencyCruiserFindings({
      modules: [],
      summary: {
        violations: [{
          type: "dependency",
          from: "app/lib/fetch.ts",
          to: "server/api/private.ts",
          rule: { name: "not-to-server", severity: "error" }
        }]
      }
    }, { root })

    expect(findings).toEqual([expect.objectContaining({
      tool: "dependency-cruiser",
      rule: "not-to-server",
      severity: "blocking",
      path: "app/lib/fetch.ts",
      line: 1,
      column: 1,
      identity: "not-to-server:app/lib/fetch.ts->server/api/private.ts",
      dependencyEdges: [{ from: "app/lib/fetch.ts", to: "server/api/private.ts" }]
    })])
  })

  test("normalizes ast-grep matches by rule and syntax kind", () => {
    const findings = parseAstGrepFindings([{
      text: "case \"authors\": return { mode: view.mode, response: view.response }",
      range: {
        byteOffset: { start: 100, end: 150 },
        start: { line: 20, column: 2 },
        end: { line: 22, column: 3 }
      },
      file: "app/pages/bibliotek.vue",
      lines: "case \"authors\": return { mode: view.mode, response: view.response }",
      charCount: { leading: 2, trailing: 0 },
      language: "TypeScript",
      metaVariables: { single: {}, multi: {}, transformed: {} },
      ruleId: "no-identity-discriminator-switch",
      severity: "error",
      note: null,
      message: "Discriminator branches must perform a real transformation."
    }], { root })

    expect(findings).toEqual([expect.objectContaining({
      tool: "ast-grep",
      rule: "no-identity-discriminator-switch",
      severity: "blocking",
      path: "app/pages/bibliotek.vue",
      line: 21,
      column: 3,
      identity: "no-identity-discriminator-switch:TypeScript:SwitchCase"
    })])
  })

  test.each([
    ["ESLint", () => parseEslintFindings([{ filePath: "x", messages: [{}] }], { root })],
    ["Knip", () => parseKnipFindings({ issues: [{ file: "x", exports: [{}] }] }, { root })],
    ["dependency-cruiser", () => parseDependencyCruiserFindings({ summary: { violations: [{}] } }, { root })],
    ["ast-grep", () => parseAstGrepFindings([{ file: "x" }], { root })]
  ])("fails closed for malformed %s diagnostics", (tool, parse) => {
    expect(parse).toThrow(`Invalid ${tool} diagnostic at index 0`)
  })

  test("fails closed when a configured Sonar metric message changes shape", () => {
    expect(() => parseEslintFindings([{
      filePath: `${root}/app/lib/example.ts`,
      messages: [{
        ruleId: "sonarjs/cognitive-complexity",
        severity: 1,
        message: "This message no longer exposes its metric.",
        line: 1,
        column: 1
      }]
    }], { root })).toThrow("Invalid ESLint diagnostic at index 0")
  })

  test.each([
    ["message", { message: undefined }],
    ["language", { language: undefined }]
  ])("fails closed when ast-grep omits %s", (_name, replacement) => {
    const diagnostic = {
      text: "case 'a': return value",
      range: { start: { line: 1, column: 1 } },
      file: "app/example.ts",
      language: "TypeScript",
      ruleId: "example-rule",
      severity: "error",
      message: "Example",
      ...replacement
    }
    expect(() => parseAstGrepFindings([diagnostic], { root }))
      .toThrow("Invalid ast-grep diagnostic at index 0")
  })
})
