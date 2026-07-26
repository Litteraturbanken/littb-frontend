import { describe, expect, it } from "vitest"
import {
  DEFAULT_LIBRARY_HREF,
  rememberedLibraryHref
} from "../../app/lib/library-navigation"

describe("rememberedLibraryHref", () => {
  it("keeps the canonical Library path and its exact query bytes", () => {
    const href = "/bibliotek?unknown=first&unknown=second&encoded=%2F&empty="

    expect(rememberedLibraryHref(href)).toBe(href)
    expect(rememberedLibraryHref(DEFAULT_LIBRARY_HREF)).toBe(DEFAULT_LIBRARY_HREF)
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
    "/bibliotek?unsafe=%5C"
  ])("rejects non-canonical or unsafe href %s", href => {
    expect(rememberedLibraryHref(href)).toBeNull()
  })
})
