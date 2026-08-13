import { describe, expect, it } from "vitest"
import {
  DEFAULT_LIBRARY_HREF,
  isCanonicalPastedWorkId,
  libraryWorkIdFilterHref,
  rememberedLibraryHref
} from "../../app/lib/library-navigation"

describe("rememberedLibraryHref", () => {
  it("keeps the canonical Library path and its exact query bytes", () => {
    const href = "/bibliotek?unknown=first&unknown=second&encoded=%2F&empty="

    expect(rememberedLibraryHref(href)).toBe(href)
    expect(rememberedLibraryHref(DEFAULT_LIBRARY_HREF)).toBe(DEFAULT_LIBRARY_HREF)
    expect(rememberedLibraryHref("/bibliotek?emoji=😀")).toBe("/bibliotek?emoji=😀")
    expect(rememberedLibraryHref("/bibliotek?emoji=%F0%9F%98%80"))
      .toBe("/bibliotek?emoji=%F0%9F%98%80")
  })

  it("removes fragments while retaining the canonical query", () => {
    expect(rememberedLibraryHref("/bibliotek?mode=all#results")).toBe(
      "/bibliotek?mode=all"
    )
  })

  it.each([
    "/",
    "/epub?visa=epub",
    "/bibliotek/verk",
    "/%62ibliotek",
    "https://example.test/bibliotek",
    "//example.test/bibliotek",
    "/bibliotek?broken=%ZZ",
    "/bibliotek?unsafe=%00",
    "/bibliotek?unsafe=%5C",
    "/bibliotek?unsafe=\u0080",
    "/bibliotek?unsafe=%C2%80",
    "/bibliotek?unsafe=\ud800",
    "/bibliotek?unsafe=\udc00"
  ])("rejects non-canonical or unsafe href %s", href => {
    expect(rememberedLibraryHref(href)).toBeNull()
  })

  it("serializes ordered work ids using the legacy Library query shape", () => {
    expect(libraryWorkIdFilterHref(["lb12", "lbAbC_34"]))
      .toBe("/bibliotek?filter=lbworkid:lb12%20OR%20lbworkid:lbAbC_34&visa=works&sort=popularitet")
    expect(libraryWorkIdFilterHref([])).toBeNull()
    expect(libraryWorkIdFilterHref(["lb-unsafe"])).toBeNull()
  })

  it("shares the exact pasted work-id length boundary", () => {
    const maximum = `lb${"x".repeat(97)}`
    const tooLong = `lb${"x".repeat(98)}`
    expect(isCanonicalPastedWorkId(maximum)).toBe(true)
    expect(isCanonicalPastedWorkId(tooLong)).toBe(false)
    expect(libraryWorkIdFilterHref([maximum, "lb2"])).not.toBeNull()
    expect(libraryWorkIdFilterHref([tooLong, "lb2"])).toBeNull()
  })
})
