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

function collectedTests(lane?: "behavior" | "visual") {
  const projects = lane === "visual"
    ? ["desktop-chromium", "mobile-chromium"]
    : allProjects
  const output = execFileSync(process.execPath, [
    playwrightCli,
    "test",
    "--list",
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

  expect(baseline.size).toBe(1_025)
  expect(behavior.size).toBe(869)
  expect(visual.size).toBe(156)
  expect(overlap).toEqual(new Set())
  expect(combined).toEqual(baseline)
}, 30_000)
