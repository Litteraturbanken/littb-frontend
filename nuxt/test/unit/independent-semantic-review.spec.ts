import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

const runner = resolve(import.meta.dirname, "../../scripts/run-independent-semantic-review.mjs")
const schema = readFileSync(
  resolve(import.meta.dirname, "../../quality/semantic-review-evidence.schema.json"),
  "utf8"
)
const roots: string[] = []

function write(root: string, path: string, value: string): void {
  const target = resolve(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, value)
}

function createRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "littb-independent-review-"))
  roots.push(root)
  write(root, "app/lib/books.ts", "export function loadBooks() { return ['Doktor Glas'] }\n")
  write(root, "quality/maintainability-baseline.json", "{\n  \"version\": 1,\n  \"findings\": []\n}\n")
  write(root, "quality/semantic-review-ledger.json", "{\n  \"version\": 1,\n  \"records\": []\n}\n")
  write(root, "quality/semantic-review-evidence.schema.json", schema)
  write(root, "quality/semantic-review-contract.md", "Review one packet.\n")
  write(root, "fixture-tool.mjs", [
    "const tool = process.argv[2]",
    "const payloads = { eslint: [], knip: { issues: [] }, dependencyCruiser: { modules: [], summary: { violations: [] } }, astGrep: [] }",
    "process.stdout.write(JSON.stringify(payloads[tool]))"
  ].join("\n"))
  write(root, "fixture-reviewer.mjs", [
    "import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'",
    "const args = process.argv.slice(2)",
    "const prompt = readFileSync(0, 'utf8')",
    "appendFileSync(process.env.REVIEW_FIXTURE_LOG, `${JSON.stringify({ args, prompt, startedAt: Date.now() })}\\n`)",
    "const invocationCount = readFileSync(process.env.REVIEW_FIXTURE_LOG, 'utf8').trim().split('\\n').length",
    "const delay = Number(process.env.REVIEW_FIXTURE_DELAY || 0)",
    "if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay))",
    "const outputIndex = args.indexOf('--output-last-message')",
    "const output = args[outputIndex + 1]",
    "if (process.env.REVIEW_FIXTURE_MODE === 'malformed') { writeFileSync(output, 'not json'); process.exit(0) }",
    "const match = prompt.match(/Packet JSON: `([^`]+)`/)",
    "const packet = JSON.parse(readFileSync(match[1], 'utf8')).packet",
    "const invalidLine = process.env.REVIEW_FIXTURE_MODE === 'invalid-line-once' && invocationCount === 1",
    "const requested = process.env.REVIEW_FIXTURE_MODE === 'changes-requested' || invalidLine",
    "const unit = packet.units[0]",
    "const findings = requested ? [{",
    "  id: 'finding-1', severity: 'important', category: 'correctness', path: unit.path, unitId: unit.id, line: invalidLine ? unit.endLine + 1 : unit.startLine,",
    "  summary: 'Incorrect branch', consequence: 'The branch returns stale data.', evidence: 'The current branch ignores its input.',",
    "  recommendation: 'Use the current input.', status: 'unresolved', resolution: null, resolutionCommit: null,",
    "  verification: ['git diff --check']",
    "}] : []",
    "writeFileSync(output, `${JSON.stringify({",
    "  version: 1, packetId: packet.id, packetFingerprint: packet.fingerprint,",
    "  author: 'implementation-agent', reviewer: 'independent-codex-review', method: 'codex-read-only',",
    "  verdict: requested ? 'changes-requested' : 'approved', findings, verification: ['git diff --check']",
    "}, null, 2)}\\n`)"
  ].join("\n"))
  return root
}

function run(root: string, mode = "approved", extraEnv: Record<string, string> = {}) {
  const tool = resolve(root, "fixture-tool.mjs")
  const reviewer = resolve(root, "fixture-reviewer.mjs")
  const log = resolve(root, "reviewer.log")
  const commands = Object.fromEntries(
    ["eslint", "knip", "dependencyCruiser", "astGrep"]
      .map(name => [name, [process.execPath, tool, name]])
  )
  const result = spawnSync(process.execPath, [
    runner,
    "--author", "implementation-agent",
    "--reviewer", "independent-codex-review"
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "",
      MAINTAINABILITY_TOOL_FIXTURES: JSON.stringify(commands),
      SEMANTIC_REVIEW_COMMAND: JSON.stringify([process.execPath, reviewer]),
      REVIEW_FIXTURE_LOG: log,
      REVIEW_FIXTURE_MODE: mode,
      ...extraEnv
    }
  })
  return { result, log }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("independent semantic review runner", () => {
  test("uses a structured-output-compatible schema for constant fields", () => {
    const document = JSON.parse(schema)

    expect(document.properties.version).toEqual({ type: "integer", const: 1 })
    expect(document.properties.method).toEqual({ type: "string", const: "codex-read-only" })
  })

  test("reviews one packet through an ephemeral read-only structured process", () => {
    const root = createRoot()
    const sourceBefore = readFileSync(resolve(root, "app/lib/books.ts"), "utf8")

    const { result, log } = run(root)

    expect(result.status).toBe(0)
    const invocation = JSON.parse(readFileSync(log, "utf8").trim())
    expect(invocation.args).toEqual(expect.arrayContaining([
      "--ephemeral",
      "--model",
      "gpt-5.5",
      "--sandbox",
      "read-only",
      "--output-schema",
      resolve(realpathSync(root), "quality/semantic-review-evidence.schema.json")
    ]))
    expect(invocation.prompt).toContain("Packet JSON: `")
    expect(invocation.prompt.match(/Packet JSON:/gu)).toHaveLength(1)
    expect(JSON.parse(readFileSync(resolve(root, "quality/semantic-review-ledger.json"), "utf8")))
      .toMatchObject({ records: [{ state: "approved", reviewer: "independent-codex-review" }] })
    expect(readFileSync(resolve(root, "app/lib/books.ts"), "utf8")).toBe(sourceBefore)
  })

  test("reviews a bounded packet batch concurrently and records it serially", () => {
    const root = createRoot()
    write(root, "app/lib/authors.ts", "export function loadAuthors() { return ['Söderberg'] }\n")

    const { result, log } = run(root, "approved", {
      SEMANTIC_REVIEW_CONCURRENCY: "2",
      REVIEW_FIXTURE_DELAY: "400"
    })

    expect(result.status).toBe(0)
    const invocations = readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line))
    expect(invocations).toHaveLength(2)
    expect(Math.abs(invocations[0].startedAt - invocations[1].startedAt)).toBeLessThan(300)
    expect(JSON.parse(readFileSync(resolve(root, "quality/semantic-review-ledger.json"), "utf8")))
      .toMatchObject({ records: [{ state: "approved" }, { state: "approved" }] })
  })

  test("rejects malformed reviewer output without recording an approval", () => {
    const root = createRoot()

    const { result } = run(root, "malformed")

    expect(result.status).toBe(2)
    expect(result.stderr).toContain("Independent reviewer output is not valid JSON")
    expect(readdirSync(resolve(root, ".quality/semantic-review")))
      .toContainEqual(expect.stringMatching(/^rejected-[a-f0-9]{64}\.txt$/u))
    expect(JSON.parse(readFileSync(resolve(root, "quality/semantic-review-ledger.json"), "utf8")))
      .toEqual({ version: 1, records: [] })
  })

  test("retries one semantically invalid review without weakening packet ownership", () => {
    const root = createRoot()

    const { result, log } = run(root, "invalid-line-once")

    expect(result.status).toBe(0)
    const invocations = readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line))
    expect(invocations).toHaveLength(2)
    expect(invocations[1].prompt).toContain("Finding finding-1 line is outside unit range")
    expect(invocations[1].prompt).toContain("owned physical lines nearest cited line:")
    expect(JSON.parse(readFileSync(resolve(root, "quality/semantic-review-ledger.json"), "utf8")))
      .toMatchObject({ records: [{ state: "approved" }] })
  })

  test("records changes-requested evidence and stops the audit", () => {
    const root = createRoot()

    const { result } = run(root, "changes-requested")

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("changes-requested")
    expect(JSON.parse(readFileSync(resolve(root, "quality/semantic-review-ledger.json"), "utf8")))
      .toMatchObject({ records: [{ state: "changes-requested", findingIds: ["finding-1"] }] })
  })

  test("re-reviews a current changes-requested packet", () => {
    const root = createRoot()
    const first = run(root, "changes-requested")
    expect(first.result.status).toBe(1)

    const second = run(root)

    expect(second.result.status).toBe(0)
    expect(readFileSync(second.log, "utf8").trim().split("\n")).toHaveLength(2)
    expect(JSON.parse(readFileSync(resolve(root, "quality/semantic-review-ledger.json"), "utf8")))
      .toMatchObject({ records: [{ state: "approved", findingIds: [] }] })
  })

  test("resumes without invoking the reviewer for a current approved packet", () => {
    const root = createRoot()
    const first = run(root)
    expect(first.result.status).toBe(0)
    const firstLog = readFileSync(first.log, "utf8")

    const second = run(root)

    expect(second.result.status).toBe(0)
    expect(readFileSync(second.log, "utf8")).toBe(firstLog)
    expect(second.result.stdout).toContain("No independent semantic review work remains")
  })

  test("retires evidence for a removed packet and reviews its replacement", () => {
    const root = createRoot()
    const first = run(root)
    expect(first.result.status).toBe(0)
    const oldEvidence = readdirSync(resolve(root, "quality/semantic-reviews"))
    expect(oldEvidence).toHaveLength(1)

    write(root, "app/lib/books.ts", "export function loadTitles() { return ['Doktor Glas'] }\n")
    const second = run(root)

    expect(second.result.status).toBe(0)
    expect(readFileSync(second.log, "utf8").trim().split("\n")).toHaveLength(2)
    const ledger = JSON.parse(readFileSync(
      resolve(root, "quality/semantic-review-ledger.json"),
      "utf8"
    ))
    expect(ledger.records).toHaveLength(1)
    expect(ledger.records[0].packetId).toContain("loadTitles")
    expect(readdirSync(resolve(root, "quality/semantic-reviews"))).toHaveLength(1)
  })

  test("retires stale evidence when a packet keeps its id but changes fingerprint", () => {
    const root = createRoot()
    const first = run(root)
    expect(first.result.status).toBe(0)
    const firstRecord = JSON.parse(readFileSync(
      resolve(root, "quality/semantic-review-ledger.json"),
      "utf8"
    )).records[0]

    write(root, "app/lib/books.ts", "export function loadBooks() { return ['Doktor Glas', 'Gertrud'] }\n")
    const second = run(root)

    expect(second.result.status).toBe(0)
    expect(readFileSync(second.log, "utf8").trim().split("\n")).toHaveLength(2)
    const records = JSON.parse(readFileSync(
      resolve(root, "quality/semantic-review-ledger.json"),
      "utf8"
    )).records
    expect(records).toHaveLength(1)
    expect(records[0].packetId).toBe(firstRecord.packetId)
    expect(records[0].fingerprint).not.toBe(firstRecord.fingerprint)
    expect(readdirSync(resolve(root, "quality/semantic-reviews"))).toHaveLength(1)
  })
})
