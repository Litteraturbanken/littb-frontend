import { describe, expect, test } from "vitest"

import {
  maximumReaderMissingPageNameLength,
  readerMissingPageErrorCode,
  readerMissingPageErrorData,
  readerMissingPageName
} from "../../app/lib/reader-missing-page"

describe("Reader missing-page error payload", () => {
  test("round-trips bounded text without interpreting markup", () => {
    const pageName = "A&B'<script>alert(1)</script>"
    const data = readerMissingPageErrorData(pageName)

    expect(data).toEqual({ code: readerMissingPageErrorCode, pageName })
    expect(readerMissingPageName(data)).toBe(pageName)
  })

  test("accepts the exact maximum and rejects unbounded or control-bearing names", () => {
    const maximum = "x".repeat(maximumReaderMissingPageNameLength)
    expect(readerMissingPageName(readerMissingPageErrorData(maximum))).toBe(maximum)

    for (const invalid of [
      "",
      "x".repeat(maximumReaderMissingPageNameLength + 1),
      "unsafe\npage",
      "unsafe\u0080page",
      null,
      ["page"]
    ]) {
      expect(readerMissingPageErrorData(invalid)).toBeNull()
    }
  })

  test("rejects malformed and extended payloads", () => {
    for (const invalid of [
      null,
      { code: "other", pageName: "missing" },
      { code: readerMissingPageErrorCode, pageName: 3 },
      { code: readerMissingPageErrorCode, pageName: "missing", html: "<b>unsafe</b>" }
    ]) {
      expect(readerMissingPageName(invalid)).toBeNull()
    }
  })
})
