import { describe, expect, it } from "vitest"

import {
  libraryAuthorTooltipText,
  MAX_LIBRARY_TOOLTIP_LENGTH,
  safeLibraryTooltipText,
  usefulLibraryTooltipText
} from "../../app/lib/library-tooltip"

describe("library tooltip metadata", () => {
  it("retains distinct bounded text without interpreting markup", () => {
    expect(usefulLibraryTooltipText("Doktor Glas. Roman", "Doktor Glas"))
      .toBe("Doktor Glas. Roman")
    expect(safeLibraryTooltipText("<b>text only</b>")).toBe("<b>text only</b>")
  })

  it("rejects absent, equal, padded, controlled, and oversized text", () => {
    expect(usefulLibraryTooltipText("Doktor Glas", "Doktor Glas")).toBe("")
    expect(safeLibraryTooltipText(" padded ")).toBe("")
    expect(safeLibraryTooltipText("unsafe\u0007text")).toBe("")
    expect(safeLibraryTooltipText("x".repeat(MAX_LIBRARY_TOOLTIP_LENGTH + 1))).toBe("")
  })

  it.each([
    "unsafe\u0080text",
    "unsafe\u009ftext",
    "unsafe\ud800text",
    "unsafe\udffftext",
    "unsafe\ud800X\udc00text"
  ])("rejects C1 controls and malformed Unicode: %j", value => {
    expect(safeLibraryTooltipText(value)).toBe("")
    expect(usefulLibraryTooltipText(value, "visible text")).toBe("")
  })

  it("preserves a valid astral pair byte-for-byte", () => {
    expect(safeLibraryTooltipText("Titel 😀")).toBe("Titel 😀")
    expect(usefulLibraryTooltipText("Titel 😀", "Titel")).toBe("Titel 😀")
  })

  it("rejects an unsafe author name before composing its tooltip", () => {
    expect(libraryAuthorTooltipText({
      full_name: "Författare\u0085Namn",
      birth_year: "1900",
      death_year: null
    }, "Författare")).toBe("")
  })

  it("builds the legacy complete author label and ignores placeholder years", () => {
    expect(libraryAuthorTooltipText({
      full_name: "Hjalmar Söderberg",
      birth: { plain: "1869" },
      death: { plain: "1941" }
    }, "Söderberg")).toBe("Hjalmar Söderberg (1869-1941)")
    expect(libraryAuthorTooltipText({
      full_name: "Hjalmar Söderberg",
      birth: { plain: "0000" }
    }, "Hjalmar Söderberg")).toBe("")
  })
})
