import { describe, expect, it } from "vitest"

import {
  hasC0OrC1Control,
  hasC0OrDelete,
  hasEcmaWhitespace,
  hasHtmlUnsafeCodeUnit,
  hasLoneSurrogate,
  removeC0AndSpace
} from "../../shared/utils/text-safety"

describe("text safety predicates", () => {
  it.each([
    ["U+0000", "\u0000", true, true, true, false, false],
    ["U+0008", "\u0008", true, true, true, false, false],
    ["U+0009", "\u0009", true, true, false, false, true],
    ["U+000A", "\u000a", true, true, false, false, true],
    ["U+000B", "\u000b", true, true, true, false, true],
    ["U+000C", "\u000c", true, true, true, false, true],
    ["U+000D", "\u000d", true, true, false, false, true],
    ["U+000E", "\u000e", true, true, true, false, false],
    ["U+001F", "\u001f", true, true, true, false, false],
    ["U+0020", "\u0020", false, false, false, false, true],
    ["U+007F", "\u007f", true, true, true, false, false],
    ["U+0080", "\u0080", false, true, true, false, false],
    ["U+009F", "\u009f", false, true, true, false, false],
    ["paired emoji", "😀", false, false, false, false, false],
    ["lone high surrogate", "\ud800", false, false, true, true, false],
    ["lone low surrogate", "\udfff", false, false, true, true, false]
  ])(
    "classifies the %s boundary exactly",
    (_label, value, c0OrDelete, c0OrC1, htmlUnsafe, loneSurrogate, whitespace) => {
      expect(hasC0OrDelete(value)).toBe(c0OrDelete)
      expect(hasC0OrC1Control(value)).toBe(c0OrC1)
      expect(hasHtmlUnsafeCodeUnit(value)).toBe(htmlUnsafe)
      expect(hasLoneSurrogate(value)).toBe(loneSurrogate)
      expect(hasEcmaWhitespace(value)).toBe(whitespace)
    }
  )

  it("preserves HTML-safe TAB, LF, and CR", () => {
    expect(hasHtmlUnsafeCodeUnit("\t\n\r")).toBe(false)
    expect(hasHtmlUnsafeCodeUnit("\u000b")).toBe(true)
  })

  it("accepts paired surrogates and rejects either half alone", () => {
    expect(hasLoneSurrogate("😀")).toBe(false)
    expect(hasLoneSurrogate("\ud800")).toBe(true)
  })

  it("removes every C0 code unit and space from scheme probes", () => {
    expect(removeC0AndSpace("\u0000 \tjava\nscript")).toBe("javascript")
  })
})
