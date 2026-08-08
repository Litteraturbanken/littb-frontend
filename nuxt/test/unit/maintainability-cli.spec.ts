import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { afterEach, describe, expect, test } from "vitest"

const cli = resolve(import.meta.dirname, "../../scripts/run-maintainability.mjs")
const roots: string[] = []

function write(root: string, path: string, value: string): void {
  const target = resolve(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, value)
}

function createRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "littb-maintainability-"))
  roots.push(root)
  write(root, "app/example.ts", "export function suspect() { return true }\n")
  write(root, "quality/maintainability-baseline.json", "{\n  \"version\": 1,\n  \"findings\": []\n}\n")
  write(root, "fixture-tool.mjs", [
    "const tool = process.argv[2]",
    "const fixtures = JSON.parse(process.env.FIXTURE_PAYLOADS)",
    "const fixture = fixtures[tool]",
    "if (fixture.stderr) process.stderr.write(fixture.stderr)",
    "process.stdout.write(typeof fixture.output === 'string' ? fixture.output : JSON.stringify(fixture.output))",
    "process.exit(fixture.status ?? 0)"
  ].join("\n"))
  return root
}

function cleanPayloads() {
  return {
    eslint: { output: [] },
    knip: { output: { issues: [] } },
    dependencyCruiser: { output: { modules: [], summary: { violations: [] } } },
    astGrep: { output: [] }
  }
}

function eslintMessage(path = "app/example.ts", measured = 24) {
  return [{
    filePath: path,
    messages: [{
      ruleId: "sonarjs/cognitive-complexity",
      severity: 1,
      message: `Refactor this function to reduce its Cognitive Complexity from ${measured} to the 12 allowed.`,
      line: 1,
      column: 8
    }]
  }]
}

function run(root: string, payloads = cleanPayloads(), args: string[] = [], extraEnv: Record<string, string> = {}) {
  const fixture = resolve(root, "fixture-tool.mjs")
  const commands = Object.fromEntries(
    Object.keys(payloads).map(tool => [tool, [process.execPath, fixture, tool]])
  )
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "",
      MAINTAINABILITY_TOOL_FIXTURES: JSON.stringify(commands),
      FIXTURE_PAYLOADS: JSON.stringify(payloads),
      ...extraEnv
    }
  })
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true })
})

describe("maintainability CLI", () => {
  test("accepts a clean baseline and writes both review packets", () => {
    const root = createRoot()
    const result = run(root)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("new=0 known=0 resolved=0")
    expect(JSON.parse(readFileSync(resolve(root, ".quality/maintainability-review.json"), "utf8")))
      .toMatchObject({ version: 1, summary: { current: 0 } })
    expect(readFileSync(resolve(root, ".quality/maintainability-review.md"), "utf8"))
      .toContain("No review candidates.")
  })

  test("fails for a new finding while preserving the checked-in baseline", () => {
    const root = createRoot()
    const before = readFileSync(resolve(root, "quality/maintainability-baseline.json"), "utf8")
    const payloads = cleanPayloads()
    payloads.eslint.output = eslintMessage()

    const result = run(root, payloads)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("new=1 known=0 resolved=0")
    expect(readFileSync(resolve(root, "quality/maintainability-baseline.json"), "utf8")).toBe(before)
    const packet = JSON.parse(readFileSync(resolve(root, ".quality/maintainability-review.json"), "utf8"))
    expect(packet.units[0]).toMatchObject({
      id: "app/example.ts::function::suspect",
      findings: [{ status: "new" }]
    })
  })

  test("updates a sorted baseline explicitly and accepts known findings afterward", () => {
    const root = createRoot()
    const payloads = cleanPayloads()
    payloads.eslint.output = eslintMessage()

    const update = run(root, payloads, ["--update-baseline"])
    const baseline = JSON.parse(readFileSync(resolve(root, "quality/maintainability-baseline.json"), "utf8"))
    const ordinary = run(root, payloads)

    expect(update.status).toBe(0)
    expect(baseline.findings).toHaveLength(1)
    expect(baseline.findings.map((item: { fingerprint: string }) => item.fingerprint))
      .toEqual(baseline.findings.map((item: { fingerprint: string }) => item.fingerprint).toSorted())
    expect(ordinary.status).toBe(0)
    expect(ordinary.stdout).toContain("new=0 known=1 resolved=0")
  })

  test("reports resolved entries without rewriting the baseline", () => {
    const root = createRoot()
    const payloads = cleanPayloads()
    payloads.eslint.output = eslintMessage()
    expect(run(root, payloads, ["--update-baseline"]).status).toBe(0)
    const before = readFileSync(resolve(root, "quality/maintainability-baseline.json"), "utf8")

    const result = run(root)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("new=0 known=0 resolved=1")
    expect(readFileSync(resolve(root, "quality/maintainability-baseline.json"), "utf8")).toBe(before)
    const packet = JSON.parse(readFileSync(resolve(root, ".quality/maintainability-review.json"), "utf8"))
    expect(packet.resolvedFingerprints).toHaveLength(1)
  })

  test("fails closed for malformed tool output", () => {
    const root = createRoot()
    const payloads = cleanPayloads()
    payloads.eslint.output = "not-json"

    const result = run(root, payloads)

    expect(result.status).toBe(2)
    expect(result.stderr).toContain("eslint produced invalid JSON")
  })

  test("applies path filters only to the packet after the complete ratchet comparison", () => {
    const root = createRoot()
    write(root, "app/pages/alpha.ts", "export function alpha() { return true }\n")
    write(root, "app/lib/beta.ts", "export function beta() { return true }\n")
    const payloads = cleanPayloads()
    payloads.eslint.output = [
      ...eslintMessage("app/pages/alpha.ts", 20),
      ...eslintMessage("app/lib/beta.ts", 21)
    ]

    const result = run(root, payloads, ["--path", "app/pages"])
    const packet = JSON.parse(readFileSync(resolve(root, ".quality/maintainability-review.json"), "utf8"))

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("new=2 known=0 resolved=0")
    expect(packet.summary.new).toBe(1)
    expect(packet.units.map((unit: { path: string }) => unit.path)).toEqual(["app/pages/alpha.ts"])
  })

  test("rejects path-filtered canonical CI enforcement", () => {
    const root = createRoot()

    const result = run(root, cleanPayloads(), ["--path", "app/pages"], { CI: "1" })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain("--path is not allowed in CI")
  })
})
