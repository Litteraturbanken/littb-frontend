import { describe, expect, test } from "vitest"

import { acceptsBrotliEncoding } from "../../server/utils/response-compression"

describe("Brotli content negotiation", () => {
  test.each([
    [undefined, false],
    ["", false],
    ["br", true],
    ["BR", true],
    ["gzip, br", true],
    ["gzip;q=0.9, Br;q=0.25", true],
    ["br;q=0", false],
    ["gzip;q=1, br;q=0", false],
    ["br;q=bogus", false],
    ["br;q=-0.1", false],
    ["br;q=1.1", false],
    ["br;q=0.1234", false],
    ["br;level=1", false]
  ])("parses %j as %s", (header, accepted) => {
    expect(acceptsBrotliEncoding(header)).toBe(accepted)
  })
})
