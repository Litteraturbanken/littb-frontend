import { describe, expect, test } from "vitest"

import {
  encodeValidatedRouteSegment,
  validRouteSegment
} from "../../shared/utils/route-segment"

describe("shared route segment policy", () => {
  test.each([
    ["AlmlöfN", 100, true],
    ["Fröken Julie", 200, true],
    [".", 200, false],
    ["..", 200, false],
    ["Book%2FPart", 200, false],
    ["Book/Part", 200, false],
    ["Book\\Part", 200, false],
    [" Book", 200, false],
    ["Book\u0000Part", 200, false],
    ["Book\u0085Part", 200, false],
    ["Book\ud800Part", 200, false],
    ["x".repeat(101), 100, false]
  ])("classifies %s within maximum %i as safe=%s", (value, maximum, expected) => {
    expect(validRouteSegment(value, maximum)).toBe(expected)
  })

  test("encodes validated segment characters using RFC3986 percent escapes", () => {
    expect(encodeValidatedRouteSegment("Fröken Julie!'()*")).toBe(
      "Fr%C3%B6ken%20Julie%21%27%28%29%2A"
    )
  })
})
