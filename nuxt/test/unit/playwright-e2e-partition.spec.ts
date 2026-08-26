import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, expect, test } from "vitest"

const playwrightCli = fileURLToPath(import.meta.resolve("@playwright/test/cli"))
const collectionReporter = fileURLToPath(new URL(
  "../helpers/playwright-collection-reporter.mjs",
  import.meta.url
))
const collectionRoot = mkdtempSync(join(tmpdir(), "littb-playwright-collection-"))
let collectionIndex = 0
const allProjects = [
  "desktop-chromium",
  "mobile-chromium",
  "chromium-typography",
  "firefox-typography",
  "webkit-typography"
]

type E2eLane = "behavior" | "visual"

function collectedTests(lane?: E2eLane, shard?: `${number}/${number}`) {
  const outputPath = join(collectionRoot, `${collectionIndex += 1}.json`)
  const projects = lane === "visual"
    ? ["desktop-chromium", "mobile-chromium"]
    : allProjects
  const env = {
    ...process.env,
    LITTB_PLAYWRIGHT_COLLECTION_FILE: outputPath
  }
  if (lane) env.LITTB_E2E_LANE = lane
  else delete env.LITTB_E2E_LANE
  execFileSync(process.execPath, [
    playwrightCli,
    "test",
    "--list",
    `--reporter=${collectionReporter}`,
    ...(shard ? [`--shard=${shard}`] : []),
    ...projects.map(project => `--project=${project}`)
  ], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    env,
    stdio: ["ignore", "ignore", "pipe"],
    timeout: 30_000
  })

  return new Set(JSON.parse(readFileSync(outputPath, "utf8")) as string[])
}

afterAll(() => rmSync(collectionRoot, { force: true, recursive: true }))

test("behavior and visual lanes are a complete disjoint E2E partition", () => {
  const baseline = collectedTests()
  const behavior = collectedTests("behavior")
  const visual = collectedTests("visual")
  const overlap = new Set([...behavior].filter(identity => visual.has(identity)))
  const combined = new Set([...behavior, ...visual])

  expect(baseline.size).toBe(1_059)
  expect(behavior.size).toBe(903)
  expect(visual.size).toBe(156)
  expect(overlap).toEqual(new Set())
  expect(combined).toEqual(baseline)
}, 30_000)

test("outer shards assign every lane identity exactly once", () => {
  for (const [lane, shardCount] of [
    ["behavior", 3],
    ["visual", 2]
  ] as const) {
    const laneTests = collectedTests(lane)
    const assignments = new Map<string, number>()
    for (let shard = 1; shard <= shardCount; shard += 1) {
      const shardTests = collectedTests(lane, `${shard}/${shardCount}`)
      expect(shardTests.size).toBeGreaterThan(0)
      for (const identity of shardTests) {
        assignments.set(identity, (assignments.get(identity) ?? 0) + 1)
      }
    }

    expect(new Set(assignments.keys())).toEqual(laneTests)
    expect([...assignments.values()].every(count => count === 1)).toBe(true)
  }
}, 30_000)
