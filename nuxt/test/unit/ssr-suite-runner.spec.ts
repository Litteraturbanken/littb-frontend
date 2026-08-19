import { describe, expect, test } from "vitest"

import { createSsrSuitePhases } from "../../scripts/run-ssr-suite.mjs"

describe("SSR suite phases", () => {
  test("shards independent specs before running Reader shorthand serially", () => {
    expect(createSsrSuitePhases(["--reporter=dot"])).toEqual([
      {
        args: ["--project=ssr", "--reporter=dot"],
        env: { LITTB_SSR_EXCLUDE_STATEFUL: "1" }
      },
      {
        args: [
          "--project=ssr",
          "test/ssr/reader-shorthand.spec.ts",
          "--reporter=dot"
        ],
        env: {
          LITTB_SSR_EXCLUDE_STATEFUL: "0",
          LITTB_PLAYWRIGHT_SHARDS: "1"
        }
      }
    ])
  })
})
