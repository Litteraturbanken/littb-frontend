import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

const playwrightCli = fileURLToPath(import.meta.resolve("@playwright/test/cli"))
const allProjects = [
  "desktop-chromium",
  "mobile-chromium",
  "chromium-typography",
  "firefox-typography",
  "webkit-typography"
]

type E2eLane = "behavior" | "visual"

function collectedTests(lane?: E2eLane, shard?: `${number}/${number}`) {
  const projects = lane === "visual"
    ? ["desktop-chromium", "mobile-chromium"]
    : allProjects
  const output = execFileSync(process.execPath, [
    playwrightCli,
    "test",
    "--list",
    ...(shard ? [`--shard=${shard}`] : []),
    ...projects.map(project => `--project=${project}`)
  ], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    encoding: "utf8",
    env: {
      ...process.env,
      ...(lane ? { LITTB_E2E_LANE: lane } : {})
    },
    timeout: 30_000
  })

  return new Set(output.split("\n").filter(line => /^\s*\[[^\]]+\] › /u.test(line)))
}

test("behavior and visual lanes are a complete disjoint E2E partition", () => {
  const baseline = collectedTests()
  const behavior = collectedTests("behavior")
  const visual = collectedTests("visual")
  const overlap = new Set([...behavior].filter(identity => visual.has(identity)))
  const combined = new Set([...behavior, ...visual])

  expect(baseline.size).toBe(1_054)
  expect(behavior.size).toBe(898)
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
