import { describe, expect, test } from "vitest"
import { readerDocumentTitle } from "../../app/lib/reader-document-title"

const reader = {
  title: "Svenska folksagor 2",
  imprintYear: "1903",
  pageName: "1",
  mediaType: "faksimil" as const,
  contributors: [
    { author_id: "BergF", full_name: "Fridtjuv Berg", surname: "Berg", author_type: "editor", role: null },
    { author_id: "NyströmJ", full_name: "Jenny Nyström", surname: "Nyström", author_type: "illustrator", role: null },
    { author_id: "WåhlströmH", full_name: "Hilda Wåhlström", surname: "Wåhlström", author_type: null, role: "illustrator" }
  ]
}

describe("reader document title", () => {
  test("formats the reported editors and illustrators with spaces and parentheses", () => {
    expect(readerDocumentTitle(reader, true)).toBe(
      "Fridtjuv Berg (red.), Jenny Nyström (ill.) & Hilda Wåhlström (ill.) – Svenska folksagor 2 (1903). Om boken | Litteraturbanken"
    )
  })

  test("restores the reading title when source information closes", () => {
    expect(readerDocumentTitle(reader, false)).toBe(
      "Svenska folksagor 2 sida 1 faksimil | Litteraturbanken"
    )
  })

  test("omits missing years and roles without empty punctuation", () => {
    expect(readerDocumentTitle({
      ...reader,
      imprintYear: null,
      contributors: [{ ...reader.contributors[0]!, author_type: null, role: null }]
    }, true)).toBe("Fridtjuv Berg – Svenska folksagor 2. Om boken | Litteraturbanken")
    expect(readerDocumentTitle({ ...reader, contributors: [] }, true)).toBe(
      "Svenska folksagor 2 (1903). Om boken | Litteraturbanken"
    )
    expect(readerDocumentTitle(null, true)).toBe("Litteraturbanken")
  })
})
