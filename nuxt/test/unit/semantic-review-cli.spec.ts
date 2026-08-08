import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

const cli = resolve(import.meta.dirname, "../../scripts/run-semantic-review.mjs")
const roots: string[] = []

function write(root: string, path: string, value: string): void {
  const target = resolve(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, value)
}

function createRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "littb-semantic-cli-"))
  roots.push(root)
  write(root, "app/lib/books.ts", "export function loadBooks() { return ['Doktor Glas'] }\n")
  write(root, "quality/maintainability-baseline.json", "{\n  \"version\": 1,\n  \"findings\": []\n}\n")
  write(root, "quality/semantic-review-ledger.json", "{\n  \"version\": 1,\n  \"records\": []\n}\n")
  write(root, "fixture-tool.mjs", [
    "const tool = process.argv[2]",
    "const payloads = {",
    "  eslint: [],",
    "  knip: { issues: [] },",
    "  dependencyCruiser: { modules: [], summary: { violations: [] } },",
    "  astGrep: []",
    "}",
    "process.stdout.write(JSON.stringify(payloads[tool]))"
  ].join("\n"))
  return root
}

function run(root: string, args: string[]) {
  const fixture = resolve(root, "fixture-tool.mjs")
  const commands = Object.fromEntries(
    ["eslint", "knip", "dependencyCruiser", "astGrep"]
      .map(tool => [tool, [process.execPath, fixture, tool]])
  )
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "",
      MAINTAINABILITY_TOOL_FIXTURES: JSON.stringify(commands)
    }
  })
}

function files(root: string, path: string): string[] {
  const directory = resolve(root, path)
  if (!existsSync(directory)) return []
  return readdirSync(directory, { recursive: true, withFileTypes: false })
    .map(item => String(item))
    .toSorted()
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("semantic review CLI", () => {
  test("inventory writes a complete ignored packet set without changing the ledger", () => {
    const root = createRoot()
    const ledgerBefore = readFileSync(resolve(root, "quality/semantic-review-ledger.json"), "utf8")

    const result = run(root, ["inventory"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("packets=1 units=1")
    const index = JSON.parse(readFileSync(resolve(root, ".quality/semantic-review/index.json"), "utf8"))
    expect(index).toMatchObject({ version: 1, summary: { packets: 1 } })
    expect(files(root, ".quality/semantic-review/packets")).toHaveLength(2)
    expect(readFileSync(resolve(root, "quality/semantic-review-ledger.json"), "utf8"))
      .toBe(ledgerBefore)
  })

  test("queue and check are read-only and fail while the current packet is unreviewed", () => {
    const root = createRoot()
    expect(run(root, ["inventory"]).status).toBe(0)
    const before = files(root, ".quality")

    const queue = run(root, ["queue"])
    const check = run(root, ["check"])

    expect(queue.status).toBe(1)
    expect(queue.stdout).toContain("unreviewed")
    expect(check.status).toBe(1)
    expect(check.stdout).toContain("approved=0 unreviewed=1")
    expect(files(root, ".quality")).toEqual(before)
  })

  test("renders exactly one requested packet without writing", () => {
    const root = createRoot()
    expect(run(root, ["inventory"]).status).toBe(0)
    const index = JSON.parse(readFileSync(resolve(root, ".quality/semantic-review/index.json"), "utf8"))
    const id = index.packets[0].id
    const before = files(root, ".quality")

    const result = run(root, ["packet", "--id", id])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("# Semantic review packet")
    expect(result.stdout).toContain(id)
    expect(files(root, ".quality")).toEqual(before)
  })

  test("records existing validated evidence and makes check and queue green", () => {
    const root = createRoot()
    expect(run(root, ["inventory"]).status).toBe(0)
    const packetFile = files(root, ".quality/semantic-review/packets")
      .find(path => path.endsWith(".json"))!
    const generated = JSON.parse(readFileSync(
      resolve(root, ".quality/semantic-review/packets", packetFile),
      "utf8"
    ))
    const packet = generated.packet
    const evidencePath = "quality/semantic-reviews/books.json"
    write(root, evidencePath, `${JSON.stringify({
      version: 1,
      packetId: packet.id,
      packetFingerprint: packet.fingerprint,
      author: "implementation-agent",
      reviewer: "independent-codex-review",
      method: "codex-read-only",
      verdict: "approved",
      findings: [],
      verification: ["yarn vitest run test/unit/books.spec.ts"]
    }, null, 2)}\n`)
    const evidenceBefore = readFileSync(resolve(root, evidencePath), "utf8")

    const record = run(root, ["record", "--id", packet.id, "--evidence", evidencePath])
    const check = run(root, ["check"])
    const queue = run(root, ["queue"])

    expect(record.status).toBe(0)
    expect(JSON.parse(readFileSync(resolve(root, "quality/semantic-review-ledger.json"), "utf8")))
      .toMatchObject({ version: 1, records: [{ packetId: packet.id, state: "approved" }] })
    expect(readFileSync(resolve(root, evidencePath), "utf8")).toBe(evidenceBefore)
    expect(check.status).toBe(0)
    expect(check.stdout).toContain("approved=1 unreviewed=0")
    expect(queue.status).toBe(0)
    expect(queue.stdout).toContain("No semantic review work remains")
  })

  test.each([
    [["unknown"], "Unknown semantic review command"],
    [["inventory", "--id", "x"], "inventory does not accept arguments"],
    [["packet"], "packet requires --id"],
    [["packet", "--id", "../escape"], "Invalid packet ID"],
    [["record", "--id", "app/lib/books.ts::packet::loadBooks"], "record requires --id and --evidence"],
    [["record", "--id", "app/lib/books.ts::packet::loadBooks", "--evidence", "../evidence.json"], "Invalid review evidence path"]
  ])("fails closed for arguments %j", (args, message) => {
    const result = run(createRoot(), args)

    expect(result.status).toBe(2)
    expect(result.stderr).toContain(message)
  })
})
