import { describe, expect, test } from "vitest"

import {
  isReaderMissingPageName,
  maximumReaderMissingPageNameLength
} from "../../shared/utils/reader-missing-page"

describe("Reader missing-page label", () => {
  test("accepts bounded text to display as escaped content", () => {
    expect(isReaderMissingPageName("A&B'<script>alert(1)</script>")).toBe(true)
  })

  test("accepts the exact maximum and rejects unbounded or control-bearing names", () => {
    const maximum = "x".repeat(maximumReaderMissingPageNameLength)
    expect(isReaderMissingPageName(maximum)).toBe(true)

    for (const invalid of [
      "",
      "x".repeat(maximumReaderMissingPageNameLength + 1),
      "unsafe\npage",
      "unsafe\u0080page",
      null,
      ["page"]
    ]) {
      expect(isReaderMissingPageName(invalid)).toBe(false)
    }
  })
})
