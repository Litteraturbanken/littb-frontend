import { describe, expect, test } from "vitest"

import { createSsrSuitePhases } from "../../scripts/run-ssr-suite.mjs"

describe("SSR suite phases", () => {
  test("shards independent specs before running Reader shorthand serially", () => {
    expect(createSsrSuitePhases(["--reporter=dot"])).toEqual([
      {
        args: ["--config=playwright.config.ts", "--project=ssr", "--reporter=dot"],
        env: { LITTB_SSR_EXCLUDE_STATEFUL: "1" }
      },
      {
        args: [
          "--config=playwright.config.ts",
          "--project=ssr",
          "test/ssr/reader-shorthand.spec.ts",
          "--reporter=dot"
        ],
        env: {
          LITTB_SSR_EXCLUDE_STATEFUL: "0",
          LITTB_PLAYWRIGHT_SHARDS: "1"
        }
      },
      {
        args: [
          "--config=playwright.ssr.config.ts",
          "--project=ssr-staging",
          "--reporter=dot"
        ],
        env: { LITTB_PLAYWRIGHT_SHARDS: "1" }
      }
    ])
  })
})
