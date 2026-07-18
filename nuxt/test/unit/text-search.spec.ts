import { describe, expect, test } from "vitest"

import {
  acceptTextSearchCountResponse,
  acceptTextSearchOptionsResponse,
  acceptTextSearchResultsResponse,
  buildTextSearchCountRequest,
  buildTextSearchOptionsRequest,
  buildTextSearchReaderHref,
  buildTextSearchResultsRequest,
  compactTextSearchLeftContext,
  isTextSearchPunctuation,
  parseTextSearchRouteQuery,
  resetTextSearchQuery,
  serializeTextSearchRouteState,
  textSearchCountRequestIdentity,
  textSearchFilterQuery,
  textSearchOptionsRequestIdentity,
  textSearchPageQuery,
  textSearchResultsRequestIdentity,
  textSearchRouteIdentity,
  textSearchSubmitQuery
} from "../../app/lib/text-search"

describe("text search route state", () => {
  test("parses, bounds, deduplicates, and independently resets malformed route fields", () => {
    const state = parseTextSearchRouteQuery({
      fras: "  frihet  ",
      traffsida: "10001",
      avancerad: "yes",
      forfattare: "StrindbergA,StrindbergA,bad/id,LagerlöfS",
      titlar: "lb238704,lb278171",
      kön: "unknown",
      languages: "language:swe,language:nld,language:swe,proofread:true",
      keywords: "texttype:roman,keyword:Unknown,keyword:Rösträtt",
      authorkeyword: "LagerlöfS",
      intervall: "1950,1850",
      sok_filter: "StrindbergA",
      infix: "1",
      lemma: "false",
      ej_modern: "0",
      fuzzy: "anything",
      keyword: ["source:sol", "provider:secret", "keyword:Drama:webben"]
    })

    expect(state).toEqual({
      phrase: "frihet",
      page: 1,
      advanced: true,
      authorIds: ["StrindbergA", "LagerlöfS"],
      workIds: ["lb238704", "lb278171"],
      gender: null,
      languages: ["language:swe", "proofread:true"],
      categories: ["texttype:roman", "keyword:Rösträtt"],
      aboutAuthorIds: ["LagerlöfS"],
      yearRange: null,
      facetAuthorId: "StrindbergA",
      prefix: true,
      suffix: true,
      infix: true,
      wordFormOnly: true,
      includeModernized: true,
      fuzzy: true,
      legacyFilters: [
        { field: "source", value: "sol" },
        { field: "keyword", value: "Drama:webben" }
      ]
    })
  })

  test("serializes canonical values and preserves unknown raw entries exactly", () => {
    const raw = {
      unknown: ["one", null, "two"] as const,
      empty: null,
      prefix: "false",
      fras: "old"
    }
    const state = parseTextSearchRouteQuery({
      fras: " frihet ",
      traffsida: "2",
      avancerad: null,
      kön: "female",
      intervall: "1850,1950",
      infix: "1",
      lemma: "1",
      ej_modern: "1",
      keyword: "source:sol"
    })

    expect(serializeTextSearchRouteState(state, raw)).toEqual({
      unknown: ["one", null, "two"],
      empty: null,
      fras: "frihet",
      traffsida: "2",
      avancerad: "1",
      kön: "female",
      intervall: "1850,1950",
      infix: "1",
      lemma: "1",
      ej_modern: "1",
      keyword: "source:sol"
    })
  })

  test("keeps transition ownership narrow", () => {
    const raw = {
      fras: "old",
      traffsida: "7",
      sok_filter: "AuthorA",
      keywords: "texttype:roman",
      unknown: ["keep", null] as const
    }

    expect(textSearchSubmitQuery(raw, "  new phrase ")).toEqual({
      fras: "new phrase",
      keywords: "texttype:roman",
      unknown: ["keep", null]
    })
    expect(textSearchFilterQuery(raw, { gender: "female" })).toEqual({
      fras: "old",
      sok_filter: "AuthorA",
      keywords: "texttype:roman",
      unknown: ["keep", null],
      kön: "female"
    })
    expect(textSearchPageQuery(raw, 4)).toEqual({ ...raw, traffsida: "4" })
    expect(resetTextSearchQuery(raw)).toEqual({ unknown: ["keep", null] })
    expect(textSearchSubmitQuery(raw, " ")).toEqual({
      keywords: "texttype:roman",
      unknown: ["keep", null]
    })
    expect(textSearchSubmitQuery(raw, "x".repeat(201))).toEqual({
      keywords: "texttype:roman",
      unknown: ["keep", null]
    })
  })

  test("builds exact generated requests without fuzzy or provider controls", () => {
    const state = parseTextSearchRouteQuery({
      fras: "frihet",
      traffsida: "2",
      forfattare: "AuthorA",
      titlar: "lb1",
      kön: "all",
      languages: "language:swe",
      keywords: "texttype:roman",
      authorkeyword: "AuthorB",
      intervall: "1850,1950",
      sok_filter: "AuthorC",
      infix: "1",
      lemma: "1",
      ej_modern: "1",
      fuzzy: "1",
      keyword: "source:sol"
    })

    expect(buildTextSearchResultsRequest(state, 10)).toEqual({
      query: "frihet", page: 2, page_size: 30, highlight_limit: 10,
      prefix: true, suffix: true, word_form_only: false, include_modernized: false,
      author_ids: ["AuthorA"], about_author_ids: ["AuthorB"], work_ids: ["lb1"],
      languages: ["language:swe"], categories: ["texttype:roman"],
      legacy_filters: [{ field: "source", value: "sol" }],
      facet_author_id: "AuthorC", year_from: 1850, year_to: 1950
    })
    expect(buildTextSearchCountRequest(state)).toEqual({
      query: "frihet", prefix: true, suffix: true,
      word_form_only: false, include_modernized: false,
      author_ids: ["AuthorA"], about_author_ids: ["AuthorB"], work_ids: ["lb1"],
      languages: ["language:swe"], categories: ["texttype:roman"],
      legacy_filters: [{ field: "source", value: "sol" }],
      facet_author_id: "AuthorC", year_from: 1850, year_to: 1950
    })
    expect(buildTextSearchOptionsRequest(state, {
      titleFilter: "  lager  ", titleLimit: 500, includeStaticOptions: false,
      selectedWorkIds: ["lb2", "lb2", "bad/id"]
    })).toEqual({
      query: "frihet", title_filter: "lager", title_limit: 500,
      include_static_options: false, selected_work_ids: ["lb2"],
      prefix: true, suffix: true, word_form_only: false, include_modernized: false,
      author_ids: ["AuthorA"], about_author_ids: ["AuthorB"], work_ids: ["lb1"],
      languages: ["language:swe"], categories: ["texttype:roman"],
      legacy_filters: [{ field: "source", value: "sol" }],
      facet_author_id: "AuthorC", year_from: 1850, year_to: 1950
    })
    expect(JSON.stringify(buildTextSearchResultsRequest(state))).not.toContain("fuzzy")
  })

  test("creates order-stable identities for every relevant route and request input", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet", infix: "1" })
    const results = buildTextSearchResultsRequest(state)
    const reordered = Object.fromEntries(Object.entries(results).reverse()) as typeof results

    expect(textSearchResultsRequestIdentity(results)).toBe(
      textSearchResultsRequestIdentity(reordered)
    )
    expect(textSearchResultsRequestIdentity({ ...results, page: 2 })).not.toBe(
      textSearchResultsRequestIdentity(results)
    )
    expect(textSearchCountRequestIdentity(buildTextSearchCountRequest(state))).not.toBe(
      textSearchResultsRequestIdentity(results)
    )
    expect(textSearchOptionsRequestIdentity(buildTextSearchOptionsRequest(state))).not.toBe(
      textSearchCountRequestIdentity(buildTextSearchCountRequest(state))
    )
    expect(textSearchRouteIdentity({ ...state, fuzzy: true })).not.toBe(
      textSearchRouteIdentity(state)
    )
  })

  test("strictly accepts results only for the matching request identity", () => {
    const request = buildTextSearchResultsRequest(
      parseTextSearchRouteQuery({ fras: "frihet" })
    )
    const identity = textSearchResultsRequestIdentity(request)
    const response = {
      query: "frihet", page: 1, page_size: 30, total_work_hits: 1,
      author_facets: [{ author_id: "AuthorA", name_for_index: "A, Author", count: 1 }],
      works: [{
        lbworkid: "lb1", author_id: "AuthorA", author_name: "Author A",
        title: "Work", title_id: "work", mediatype: "etext",
        has_more_highlights: false,
        highlights: [{
          left_context: [{ word: "i", page_name: "12", word_id: "w12_3" }],
          match: [{ word: "frihet", page_name: "12", word_id: "w12_4" }],
          right_context: [{ word: ".", page_name: "12", word_id: "w12_5" }]
        }]
      }]
    }

    expect(acceptTextSearchResultsResponse(response, request, identity)).toEqual(response)
    expect(acceptTextSearchResultsResponse(response, request, "stale")).toBeNull()

    for (const mutate of [
      (copy: any) => { copy.raw = true },
      (copy: any) => { copy.works[0].source = {} },
      (copy: any) => { copy.works[0].highlights[0].match[0].lemma = "fri" },
      (copy: any) => { copy.query = "other" },
      (copy: any) => { copy.page = 2 },
      (copy: any) => { copy.works[0].mediatype = "audio" },
      (copy: any) => { copy.works[0].lbworkid = "bad/id" },
      (copy: any) => { copy.works.push(structuredClone(copy.works[0])) },
      (copy: any) => { copy.author_facets.push(structuredClone(copy.author_facets[0])) },
      (copy: any) => { copy.works[0].highlights[0].match.push(
        { word: "nu", page_name: "12", word_id: "w12_2" }
      ) },
      (copy: any) => { copy.works[0].highlights[0].right_context[0].page_name = "13" },
      (copy: any) => {
        for (const key of ["left_context", "match", "right_context"]) {
          for (const word of copy.works[0].highlights[0][key]) word.page_name = "12\n13"
        }
      },
      (copy: any) => { copy.total_work_hits = 0 }
    ]) {
      const malformed = structuredClone(response)
      mutate(malformed)
      expect(acceptTextSearchResultsResponse(malformed, request, identity)).toBeNull()
    }
  })

  test("strictly accepts count and options responses with bounded recursive rows", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const countRequest = buildTextSearchCountRequest(state)
    const countIdentity = textSearchCountRequestIdentity(countRequest)
    const count = { query: "frihet", total_documents: 2, total_highlights: 3 }
    expect(acceptTextSearchCountResponse(count, countRequest, countIdentity)).toEqual(count)
    expect(acceptTextSearchCountResponse({ ...count, extra: true }, countRequest, countIdentity))
      .toBeNull()
    expect(acceptTextSearchCountResponse({ ...count, query: "other" }, countRequest, countIdentity))
      .toBeNull()
    expect(acceptTextSearchCountResponse(count, countRequest, "stale")).toBeNull()

    const optionsRequest = buildTextSearchOptionsRequest(state)
    const optionsIdentity = textSearchOptionsRequestIdentity(optionsRequest)
    const options = {
      title_options: [{ work_id: "lb1", title: "Work", author_name: "Author" }],
      title_total: 1,
      title_author_facets: [{ author_id: "AuthorA", name_for_index: "A, Author", count: 1 }],
      authors: [{
        author_id: "AuthorA", name_for_index: "A, Author",
        birth_year: "1850", death_year: null
      }],
      about_authors: [], year_from: 1850, year_to: 1950
    }
    expect(acceptTextSearchOptionsResponse(options, optionsRequest, optionsIdentity))
      .toEqual(options)
    expect(acceptTextSearchOptionsResponse(options, optionsRequest, "stale")).toBeNull()

    const selectedWorkIds = Array.from({ length: 50 }, (_, index) => `lb${index}`)
    const boundaryRequest = buildTextSearchOptionsRequest(state, {
      titleLimit: 500,
      selectedWorkIds
    })
    const boundaryIdentity = textSearchOptionsRequestIdentity(boundaryRequest)
    const boundaryOptions = {
      ...options,
      title_options: Array.from({ length: 550 }, (_, index) => ({
        work_id: `lb${index}`,
        title: `Work ${index}`,
        author_name: "Author"
      })),
      title_total: 500,
      title_author_facets: [],
      authors: []
    }
    expect(acceptTextSearchOptionsResponse(
      boundaryOptions,
      boundaryRequest,
      boundaryIdentity
    )).toEqual(boundaryOptions)
    expect(acceptTextSearchOptionsResponse({
      ...boundaryOptions,
      title_options: [
        ...boundaryOptions.title_options,
        { work_id: "lb550", title: "Overflow", author_name: "Author" }
      ]
    }, boundaryRequest, boundaryIdentity)).toBeNull()

    for (const mutate of [
      (copy: any) => { delete copy.year_to },
      (copy: any) => { copy.title_options[0].raw = true },
      (copy: any) => { copy.authors[0].author_id = "bad/id" },
      (copy: any) => { copy.title_options.push(structuredClone(copy.title_options[0])) },
      (copy: any) => { copy.title_author_facets.push(structuredClone(copy.title_author_facets[0])) },
      (copy: any) => { copy.authors.push(structuredClone(copy.authors[0])) },
      (copy: any) => { copy.year_from = 2200; copy.year_to = 1000 },
      (copy: any) => { copy.title_total = -1 }
    ]) {
      const malformed = structuredClone(options)
      mutate(malformed)
      expect(acceptTextSearchOptionsResponse(malformed, optionsRequest, optionsIdentity))
        .toBeNull()
    }
  })

  test("matches Angular context compaction, long-token removal, and punctuation", () => {
    const word = (text: string, ordinal: number) => ({
      word: text, page_name: "1", word_id: `w1_${ordinal}`
    })
    const context = [
      word("1234567890", 1), word("abcdefghij", 2), word("klmnopqrst", 3),
      word("uvwxyzABCD", 4), word("tail", 5)
    ]
    expect(compactTextSearchLeftContext(context).map(item => item.word)).toEqual([
      "abcdefghij", "klmnopqrst", "uvwxyzABCD", "tail"
    ])
    expect(compactTextSearchLeftContext([
      word("x".repeat(30), 1), word("short", 2)
    ])).toEqual([word("short", 2)])
    expect(context.map(item => item.word)).toEqual([
      "1234567890", "abcdefghij", "klmnopqrst", "uvwxyzABCD", "tail"
    ])
    expect([",", ".", ";", ":", "!", "?", "..."].every(isTextSearchPunctuation))
      .toBe(true)
    expect(["…", "-", "..", "word"].some(isTextSearchPunctuation)).toBe(false)
  })

  test("builds an RFC3986 Reader link with canonical and safe legacy state", () => {
    const state = parseTextSearchRouteQuery({
      fras: "frihet & rätt",
      traffsida: "2",
      forfattare: "AuthorA",
      titlar: "lb1",
      kön: "female",
      languages: "language:swe",
      keywords: "texttype:roman",
      authorkeyword: "AuthorB",
      intervall: "1850,1950",
      sok_filter: "AuthorC",
      infix: "1",
      lemma: "1",
      ej_modern: "1",
      fuzzy: "1",
      unknown: "must-not-leak"
    })
    const work = {
      lbworkid: "lb!1", author_id: "Author!A", author_name: "Author A",
      title: "Work", title_id: "title*(one)", mediatype: "etext" as const,
      has_more_highlights: false, highlights: []
    }
    const highlight = {
      left_context: [],
      match: [
        { word: "frihet", page_name: "page! one", word_id: "w12_4" },
        { word: "rätt", page_name: "page! one", word_id: "w12_5" }
      ],
      right_context: []
    }
    const href = buildTextSearchReaderHref(work, highlight, 0, state)
    const url = new URL(href, "https://example.test")

    expect(url.pathname).toBe(
      "/f%C3%B6rfattare/Author%21A/titlar/title%2A%28one%29/sida/page%21%20one/etext"
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "frihet & rätt", hit: "0", lemma: "1", ej_modern: "1",
      prefix: "1", suffix: "1", traff: "w12_4", traffslut: "w12_5",
      s_query: "frihet & rätt", s_lbworkid: "lb!1", s_mediatype: "etext",
      s_word_form_only: "false", s_include_modernized: "false", hit_index: "0",
      s_from: "30", s_to: "59", s_prefix: "true", s_suffix: "true",
      s_page: "2", s_page_size: "30", s_author_ids: "AuthorA",
      s_about_author_ids: "AuthorB", s_work_ids: "lb1", s_gender: "female",
      s_year_from: "1850", s_year_to: "1950", s_languages: "language:swe",
      s_categories: "texttype:roman", s_facet_author_id: "AuthorC"
    })
    expect(href).not.toContain("unknown")
    expect(href).not.toContain("fuzzy")
    expect(href).not.toContain("text_filter")
    expect(href).not.toContain("sort")
  })
})
