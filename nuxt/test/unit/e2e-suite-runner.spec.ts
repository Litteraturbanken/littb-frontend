import { describe, expect, test } from "vitest"

import {
  collectedTestCount,
  createE2eSuitePhases
} from "../../scripts/run-e2e-suite.mjs"

describe("E2E suite lanes", () => {
  test("uses three behavior shards followed by two visual shards", () => {
    expect(createE2eSuitePhases(["--reporter=line"], {})).toEqual([
      {
        args: [
          "--project=desktop-chromium",
          "--project=mobile-chromium",
          "--project=chromium-typography",
          "--project=firefox-typography",
          "--project=webkit-typography",
          "--reporter=line"
        ],
        env: {
          LITTB_E2E_LANE: "behavior",
          LITTB_PLAYWRIGHT_SHARDS: "3"
        }
      },
      {
        args: [
          "--project=desktop-chromium",
          "--project=mobile-chromium",
          "--reporter=line"
        ],
        env: {
          LITTB_E2E_LANE: "visual",
          LITTB_PLAYWRIGHT_SHARDS: "2"
        }
      }
    ])
  })

  test("honors a global constrained shard override for both lanes", () => {
    const phases = createE2eSuitePhases([], { LITTB_PLAYWRIGHT_SHARDS: "1" })

    expect(phases.map(phase => phase.env.LITTB_PLAYWRIGHT_SHARDS)).toEqual(["1", "1"])
  })

  test("honors independent behavior and visual shard overrides", () => {
    const phases = createE2eSuitePhases([], {
      LITTB_E2E_BEHAVIOR_SHARDS: "4",
      LITTB_E2E_VISUAL_SHARDS: "1"
    })

    expect(phases.map(phase => phase.env.LITTB_PLAYWRIGHT_SHARDS)).toEqual(["4", "1"])
  })

  test("intersects explicit project selections with each lane", () => {
    const phases = createE2eSuitePhases([
      "--project=webkit-typography",
      "--grep",
      "kerning"
    ], {})

    expect(phases).toHaveLength(1)
    expect(phases[0]?.args).toEqual([
      "--project=webkit-typography",
      "--grep",
      "kerning"
    ])
    expect(phases[0]?.env.LITTB_E2E_LANE).toBe("behavior")
  })

  test("keeps shared explicit projects in both lanes without duplicating flags", () => {
    const phases = createE2eSuitePhases(["--project=desktop-chromium"], {})

    expect(phases).toHaveLength(2)
    expect(phases.map(phase => phase.args)).toEqual([
      ["--project=desktop-chromium"],
      ["--project=desktop-chromium"]
    ])
  })

  test("parses Playwright list totals and rejects missing summaries", () => {
    expect(collectedTestCount("Listing tests:\nTotal: 1,025 tests in 55 files\n")).toBe(1_025)
    expect(() => collectedTestCount("Listing tests:\n")).toThrow(/collection total/u)
  })
})
