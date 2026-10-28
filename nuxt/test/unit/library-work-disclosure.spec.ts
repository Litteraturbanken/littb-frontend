import { describe, expect, test } from "vitest"
import { expandedLibraryWork, libraryWorkDisclosureQuery } from "../../app/lib/library/work-disclosure"

const first = { key: "first", titlePath: "SamladeSkrifter", mainAuthorId: "SöderbergH" }
const second = { key: "second", titlePath: "SamladeSkrifter", mainAuthorId: "StrindbergA" }

describe("library work disclosure URL identity", () => {
  test("requires both canonical titlepath and main author when titles collide", () => {
    expect(expandedLibraryWork([first, second], { title: first.titlePath })).toBe("")
    expect(expandedLibraryWork([first, second], { title: first.titlePath, title_author: first.mainAuthorId })).toBe("first")
    expect(expandedLibraryWork([first, second], { title: second.titlePath, title_author: second.mainAuthorId })).toBe("second")
    expect(expandedLibraryWork([first, second], { title: first.titlePath, title_author: "ReaderAlias" })).toBe("")
    expect(expandedLibraryWork([first], { title: first.titlePath })).toBe("first")
    expect(expandedLibraryWork([first], { title: first.titlePath, title_author: second.mainAuthorId })).toBe("")
  })
  test("switches/closes both fields and preserves repeated unrelated search state", () => {
    const query = { title: first.titlePath, title_author: first.mainAuthorId, keep: ["first", "second"], fras: "kyrka & slott", avancerat: null }
    expect(libraryWorkDisclosureQuery(query, second, true)).toEqual({ ...query, title_author: second.mainAuthorId })
    expect(libraryWorkDisclosureQuery(query, second, false)).toEqual({ keep: query.keep, fras: query.fras, avancerat: null })
    expect(query.title_author).toBe(first.mainAuthorId)
  })
})
