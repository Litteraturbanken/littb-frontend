import { describe, expect, test } from "vitest"

import {
  attachTextSearchReturnHref,
  DEFAULT_TEXT_SEARCH_HREF,
  parseTextSearchReturnHref,
  rawTextSearchReturnQuery,
  rememberedTextSearchHref
} from "../../app/lib/text-search-navigation"

describe("remembered text-search navigation", () => {
  test("uses the encoded search route as the SSR-safe default", () => {
    expect(DEFAULT_TEXT_SEARCH_HREF).toBe("/s%C3%B6k")
  })

  test.each([
    ["/sok", "/s%C3%B6k"],
    ["/sök?fras=röd%20sol&prefix", "/s%C3%B6k?fras=röd%20sol&prefix"],
    [
      "/s%C3%B6k?utm=keep&fras=R%C3%B6da%20rummet&avancerad=1",
      "/s%C3%B6k?utm=keep&fras=R%C3%B6da%20rummet&avancerad=1"
    ],
    ["/s%C3%B6k?fras=frihet#results", "/s%C3%B6k?fras=frihet"]
  ])("accepts %s without rewriting query bytes", (value, expected) => {
    expect(rememberedTextSearchHref(value)).toBe(expected)
  })

  test.each([
    "/",
    "/om/ide?fras=frihet",
    "/s%C3%B6k/extra?fras=frihet",
    "https://litteraturbanken.se/s%C3%B6k?fras=frihet"
  ])("rejects unrelated value %s", value => {
    expect(rememberedTextSearchHref(value)).toBeNull()
  })
})

describe("Reader search return navigation", () => {
  const reader = "/författare/A/titlar/T/sida/1/etext?q=frihet&hit=0"
  const origin = "/s%C3%B6k?fras=frihet&traffsida=2&utm=a+b&repeat=%2f&repeat=%2F"

  test("attaches and parses one exact raw Search origin through the shared boundary", () => {
    const attached = attachTextSearchReturnHref(reader, origin)

    expect(attached).toBe(
      "/författare/A/titlar/T/sida/1/etext?q=frihet&hit=0&" +
      "s_return=%2Fs%25C3%25B6k%3Ffras%3Dfrihet%26traffsida%3D2%26" +
      "utm%3Da%2Bb%26repeat%3D%252f%26repeat%3D%252F"
    )
    expect(parseTextSearchReturnHref(rawTextSearchReturnQuery(attached))).toBe(origin)
  })

  test("leaves invalid origins and Reader destinations unchanged", () => {
    expect(attachTextSearchReturnHref(
      reader,
      "https://example.test/s%C3%B6k?fras=frihet"
    )).toBe(reader)
    expect(attachTextSearchReturnHref(
      "https://example.test/reader",
      origin
    )).toBe("https://example.test/reader")
    expect(attachTextSearchReturnHref(
      `${reader}&s_return=existing`,
      origin
    )).toBe(`${reader}&s_return=existing`)
  })

  test("extracts one outer return value without normalizing its inner URL bytes", () => {
    expect(rawTextSearchReturnQuery(
      "/editor/lb/ix/1/f?s_return=%2Fs%25C3%25B6k%3Ffras%3Da%252Bb" +
      "%26keep%3D%252f%26keep%3D%252F"
    )).toEqual({
      s_return: "/s%C3%B6k?fras=a%2Bb&keep=%2f&keep=%2F"
    })
    expect(rawTextSearchReturnQuery("/reader?s_return=first&s_return=second"))
      .toEqual({ s_return: ["first", "second"] })
    expect(rawTextSearchReturnQuery("/reader?s_return=%E0%A4%A"))
      .toEqual({ s_return: null })
  })

  test("accepts one bounded search origin and rejects nested or duplicate owners", () => {
    expect(parseTextSearchReturnHref({
      s_return: "/s%C3%B6k?fras=R%C3%B6da%20rummet&prefix"
    })).toBe("/s%C3%B6k?fras=R%C3%B6da%20rummet&prefix")
    expect(parseTextSearchReturnHref({
      s_return: "/s%C3%B6k?fras=x&s_return=%2Fs%C3%B6k%3Ffras%3Dy"
    })).toBeNull()
    expect(parseTextSearchReturnHref({
      s_return: ["/s%C3%B6k?fras=x", "/s%C3%B6k?fras=y"]
    })).toBeNull()
  })
})


describe("production bookmark return navigation", () => {
  test("restores filters, pagination, and match settings without an s_return URL", () => {
    const href = parseTextSearchReturnHref({
      s_query: "kyrka", s_lbworkid: "lb3203777", hit_index: "0", s_from: "60", s_to: "89",
      s_work_ids: "lb3203777,lb1", s_authors: "AuthorC", s_prefix: "true", s_suffix: "true",
      s_include_modernized: "false", s_fuzzy: "true",
      s_keyword_aux: 'RAW:(keyword:"language-source" OR keyword:"translated" OR authors>type:translator),RAW:-language:swe',
      s_text_filter: JSON.stringify({
        "authors>authorid": ["AuthorA", "AuthorB"], "authorkeyword>authorid": ["AuthorD"],
        "main_author.gender": "female", "sort_date_imprint.date:range": "1248,2026",
        language: ["fin"], texttype: ["roman"], source: "sol", _exists: ["language"]
      })
    })
    expect(Object.fromEntries(new URL(href!, "https://example.test").searchParams)).toEqual({
      fras: "kyrka", traffsida: "3", titlar: "lb3203777,lb1", sok_filter: "AuthorC",
      lemma: "1", ej_modern: "1", prefix: "1", suffix: "1", fuzzy: "1",
      languages: "translation:true,foreign:true", forfattare: "AuthorA,AuthorB",
      authorkeyword: "AuthorD", kön: "female", intervall: "1248,2026",
      keyword: "language:fin,source:sol,texttype:roman"
    })
  })

  test("keeps explicit return validation authoritative and handles malformed legacy filters", () => {
    const bookmark = { s_query: "kyrka", s_lbworkid: "lb3203777", hit_index: "0", s_word_form_only: "true" }
    expect(parseTextSearchReturnHref({ ...bookmark, s_return: "//example.test" })).toBeNull()
    expect(parseTextSearchReturnHref({ ...bookmark, s_text_filter: "[object Object]" }))
      .toBe("/s%C3%B6k?fras=kyrka")
    expect(parseTextSearchReturnHref({ ...bookmark, s_query: ["one", "two"] })).toBeNull()
  })
})
