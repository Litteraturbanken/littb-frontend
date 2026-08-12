import { describe, expect, it } from "vitest"

import {
  isSafeHandoffSuffix,
  rawHandoffTarget
} from "../../server/utils/external-handoff"

describe("external handoff boundaries", () => {
  it("splits the raw target without interpreting encoded delimiters", () => {
    expect(rawHandoffTarget("/safe%3Fpart%23part?raw=%2F&empty=")).toEqual({
      pathname: "/safe%3Fpart%23part",
      search: "?raw=%2F&empty="
    })
    expect(rawHandoffTarget("/safe#fragment")).toBeNull()
  })

  it("bounds raw suffix length exactly", () => {
    expect(isSafeHandoffSuffix("a".repeat(8_192))).toBe(true)
    expect(isSafeHandoffSuffix("a".repeat(8_193))).toBe(false)
  })

  it("bounds repeated decoding and rejects unsafe decoded code units", () => {
    const nested = (passes: number) => {
      let value = "%41"
      for (let pass = 0; pass < passes; pass += 1) value = encodeURIComponent(value)
      return value
    }

    expect(isSafeHandoffSuffix(nested(14))).toBe(true)
    expect(isSafeHandoffSuffix(nested(15))).toBe(false)
    expect(isSafeHandoffSuffix("safe\ud800")).toBe(false)
  })
})
