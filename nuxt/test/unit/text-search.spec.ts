import { describe, expect, test } from "vitest"

import {
  acceptTextSearchCountResponse,
  acceptTextSearchOptionsResponse,
  acceptTextSearchResultsResponse,
  attachTextSearchReturnHref,
  buildTextSearchCountRequest,
  buildTextSearchOptionsRequest,
  buildTextSearchReaderHref,
  buildTextSearchResultsRequest,
  compactTextSearchLeftContext,
  compactTextSearchRightContext,
  isTextSearchPunctuation,
  parseTextSearchRouteQuery,
  parseTextSearchReturnHref,
  prepareTextSearchHighlight,
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
import {
  cloneRecord,
  requiredArray,
  requiredRecord,
  type JsonRecord
} from "../helpers/malformed-json"

function resultsResponse() {
  return {
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
}

function optionsResponse() {
  return {
    title_options: [{ work_id: "lb1", title: "Work", author_name: "Author" }],
    title_total: 1,
    title_author_facets: [{ author_id: "AuthorA", name_for_index: "A, Author", count: 1 }],
    authors: [{
      author_id: "AuthorA", name_for_index: "A, Author",
      birth_year: "1850", death_year: null
    }],
    about_authors: [], year_from: 1850, year_to: 1950
  }
}

describe("text search return href", () => {
  const reader = "/författare/A/titlar/T/sida/1/etext?q=frihet&hit=0"
  const origin = "/s%C3%B6k?fras=frihet&traffsida=2&utm=a+b&repeat=%2f&repeat=%2F"

  test("attaches and parses the exact validated Search origin", () => {
    const attached = attachTextSearchReturnHref(reader, origin)

    expect(parseTextSearchReturnHref(
      Object.fromEntries(new URL(attached, "https://x").searchParams)
    )).toBe(origin)
  })

  test("accepts and preserves alternate raw encodings of the decoded Search path", () => {
    for (const encodedOrigin of [
      "/s%c3%b6k?fras=frihet",
      "/%73%C3%B6k?fras=frihet"
    ]) {
      const attached = attachTextSearchReturnHref(reader, encodedOrigin)
      expect(new URL(attached, "https://x").searchParams.get("s_return"))
        .toBe(encodedOrigin)
      expect(parseTextSearchReturnHref({ s_return: encodedOrigin })).toBe(encodedOrigin)
    }
  })

  test("rejects unsafe origins and leaves invalid attachments unchanged", () => {
    const invalidOrigins = [
      "https://example.test/s%C3%B6k?fras=frihet",
      "//example.test/s%C3%B6k?fras=frihet",
      "/bibliotek?fras=frihet",
      "/s%C3%B6k?fras=frihet#fragment",
      "/s%C3%B6k?fras=bad\\path",
      "/s%C3%B6k?fras=frihet\u0000",
      "/s%C3%B6k?fras=%E0%A4%A",
      "/s%C3%B6k",
      "/s%C3%B6k?fras=",
      `/s%C3%B6k?fras=${"x".repeat(201)}`,
      "/s%C3%B6k?fras=frihet&fras=igen",
      "/s%C3%B6k?fras=frihet&s_return=%2Fs%C3%B6k%3Ffras%3Dfrihet",
      `/s%C3%B6k?fras=frihet&x=${"x".repeat(8_200)}`
    ]

    for (const origin of invalidOrigins) {
      expect(attachTextSearchReturnHref(reader, origin)).toBe(reader)
      expect(parseTextSearchReturnHref({ s_return: origin })).toBeNull()
    }
    expect(attachTextSearchReturnHref("https://x/reader", origin)).toBe("https://x/reader")
    expect(parseTextSearchReturnHref({ s_return: [origin] })).toBeNull()
    expect(parseTextSearchReturnHref({ s_return: "" })).toBeNull()
  })
})

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

  test("accepts phrase and page endpoints and resets only invalid scalars", () => {
    expect(parseTextSearchRouteQuery({ fras: "x", traffsida: "1" }))
      .toMatchObject({ phrase: "x", page: 1 })
    expect(parseTextSearchRouteQuery({ fras: "x".repeat(200), traffsida: "10000" }))
      .toMatchObject({ phrase: "x".repeat(200), page: 10000 })

    for (const query of [
      { fras: " ", traffsida: "2" },
      { fras: "x".repeat(201), traffsida: "2" }
    ]) {
      expect(parseTextSearchRouteQuery(query)).toMatchObject({ phrase: null, page: 2 })
    }
    for (const traffsida of ["0", "10001", "1.5", "-1", " 2 "]) {
      expect(parseTextSearchRouteQuery({ fras: "keep", traffsida }))
        .toMatchObject({ phrase: "keep", page: 1 })
    }
  })

  test("bounds identifier lists at 50 after stable filtering and deduplication", () => {
    const identifiers = Array.from({ length: 51 }, (_, index) => `Author${index}`)
    const state = parseTextSearchRouteQuery({
      forfattare: [
        `${identifiers.join(",")},Author0,.,..,bad/id,bad%2Fid,bad\\id`,
        " bad,control\nvalue"
      ],
      titlar: `${identifiers.join(",")},lb-safe`,
      authorkeyword: `${identifiers.join(",")},AboutSafe`
    })

    expect(state.authorIds).toEqual(identifiers.slice(0, 50))
    expect(state.workIds).toEqual(identifiers.slice(0, 50))
    expect(state.aboutAuthorIds).toEqual(identifiers.slice(0, 50))
  })

  test("accepts 100-character identifiers and discards unsafe or oversized items", () => {
    const maximum = "x".repeat(100)
    const state = parseTextSearchRouteQuery({
      forfattare: [
        maximum, "x".repeat(101), ".", "..", "has space", "bad/id",
        "bad\\id", "bad%id", "control\nvalue"
      ].join(","),
      sok_filter: maximum
    })
    expect(state.authorIds).toEqual([maximum])
    expect(state.facetAuthorId).toBe(maximum)
    expect(parseTextSearchRouteQuery({ sok_filter: "x".repeat(101) }).facetAuthorId)
      .toBeNull()
  })

  test("keeps prefix and suffix independent while preserving infix as its own flag", () => {
    expect(parseTextSearchRouteQuery({ prefix: "1" })).toMatchObject({
      prefix: true, suffix: false, infix: false
    })
    expect(parseTextSearchRouteQuery({ suffix: null })).toMatchObject({
      prefix: false, suffix: true, infix: false
    })
    const infix = parseTextSearchRouteQuery({ infix: "yes", prefix: "false", suffix: "0" })
    expect(infix).toMatchObject({ prefix: true, suffix: true, infix: true })
    expect(serializeTextSearchRouteState(infix)).toEqual({ infix: "1" })
    expect(parseTextSearchRouteQuery({ prefix: "false", suffix: "0", infix: "false" }))
      .toMatchObject({ prefix: false, suffix: false, infix: false })
  })

  test("maps gender variants and all to the backend nullable gender", () => {
    expect(parseTextSearchRouteQuery({ kön: "female" }).gender).toBe("female")
    expect(parseTextSearchRouteQuery({ kön: "male" }).gender).toBe("male")
    expect(parseTextSearchRouteQuery({ kön: "all" }).gender).toBeNull()
    expect(parseTextSearchRouteQuery({ kön: "other" }).gender).toBeNull()
  })

  test("accepts inclusive year endpoints and resets malformed pairs atomically", () => {
    expect(parseTextSearchRouteQuery({ intervall: "1000,2200" }).yearRange)
      .toEqual([1000, 2200])
    expect(parseTextSearchRouteQuery({ intervall: "1850,1850" }).yearRange)
      .toEqual([1850, 1850])
    for (const intervall of [
      "999,2200", "1000,2201", "1900,1800", "1800", "1800,", "a,1900"
    ]) {
      expect(parseTextSearchRouteQuery({ fras: "keep", intervall }))
        .toMatchObject({ phrase: "keep", yearRange: null })
    }
  })

  test("bounds legacy filters at 20 and validates field, value, and author identifiers", () => {
    const entries = Array.from({ length: 21 }, (_, index) => `keyword:value${index}`)
    const state = parseTextSearchRouteQuery({
      keyword: [
        entries.join(","),
        `source:${"x".repeat(100)}`,
        `source:${"x".repeat(101)}`,
        "provider:secret,author_ids:bad/id,source:first:colon"
      ]
    })
    expect(state.legacyFilters).toHaveLength(20)
    expect(state.legacyFilters[0]).toEqual({ field: "keyword", value: "value0" })
    expect(state.legacyFilters.at(-1)).toEqual({ field: "keyword", value: "value19" })

    const firstColon = parseTextSearchRouteQuery({ keyword: "source:first:colon" })
    expect(firstColon.legacyFilters).toEqual([{ field: "source", value: "first:colon" }])
    expect(parseTextSearchRouteQuery({ keyword: `source:${"x".repeat(100)}` }).legacyFilters)
      .toHaveLength(1)
    expect(parseTextSearchRouteQuery({ keyword: `source:${"x".repeat(101)}` }).legacyFilters)
      .toEqual([])
  })

  test("accepts every generated language and category value in stable order", () => {
    const languages = [
      "modernized:true", "modernized:false", "translation:true", "original:true",
      "language:swe", "foreign:true", "language:eng", "language:deu",
      "language:fra", "language:lat", "language:smi", "proofread:true",
      "proofread:false"
    ]
    const categories = [
      "texttype:brev;brevsamling", "texttype:drama;dramasamling",
      "texttype:essä;essäsamling", "texttype:novellsamling;novell",
      "texttype:diktsamling;dikt", "texttype:roman",
      "texttype:sakprosa;kringtexter;avhandling;referensverk",
      "keyword:Barnlitteratur", "keyword:Biografika|texttype:brev;brevsamling",
      "keyword:Finlandssvenskt", "keyword:Flickböcker", "texttype:herdaminne",
      "keyword:Humor", "texttype:kistebrev", "texttype:kringtext",
      "texttype:kåseri;kåserisamling", "texttype:reseskildring", "keyword:Rösträtt",
      "keyword:Sapmi", "keyword:Folktryck", "keyword:sentpajorden",
      "keyword:OrdenPrövas", "keyword:LB-antologi", "keyword:1800",
      "source:bibliotekariesidor", "source:diktensmuseum", "keyword:Dramawebben",
      "source:skolan", "source:litteraturkartan", "source:ljudochbild", "source:sol",
      "keyword:SLS-FI", "provenance.library:SVELITT", "provenance.library:SA",
      "provenance.library:SFS", "provenance.library:SVA", "author_ids:KunglSamfundet",
      "provenance.library:SVS"
    ]
    const state = parseTextSearchRouteQuery({
      languages: [...languages, languages[0]!, "language:unknown"].join(","),
      keywords: [...categories, categories[0]!, "keyword:Unknown"].join(",")
    })
    expect(state.languages).toEqual(languages)
    expect(state.categories).toEqual(categories)
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

  const transitionQuery = {
    fras: "old",
    traffsida: "7",
    sok_filter: "AuthorA",
    keywords: "texttype:roman",
    unknown: ["keep", null] as const
  }

  test("submit changes the phrase and clears page and facet only", () => {
    expect(textSearchSubmitQuery(transitionQuery, "  new phrase ")).toEqual({
      fras: "new phrase",
      keywords: "texttype:roman",
      unknown: ["keep", null]
    })
    expect(textSearchSubmitQuery(transitionQuery, " ")).toEqual({
      keywords: "texttype:roman",
      unknown: ["keep", null]
    })
    expect(textSearchSubmitQuery(transitionQuery, "x".repeat(201))).toEqual({
      keywords: "texttype:roman",
      unknown: ["keep", null]
    })
  })

  test("filter changes state and clears page only", () => {
    expect(textSearchFilterQuery(transitionQuery, { gender: "female" })).toEqual({
      fras: "old",
      sok_filter: "AuthorA",
      keywords: "texttype:roman",
      unknown: ["keep", null],
      kön: "female"
    })
  })

  test("pagination changes only the page and bounds it", () => {
    expect(textSearchPageQuery(transitionQuery, 4)).toEqual({
      ...transitionQuery,
      traffsida: "4"
    })
    expect(textSearchPageQuery(transitionQuery, 1)).toEqual({
      fras: "old", sok_filter: "AuthorA", keywords: "texttype:roman",
      unknown: ["keep", null]
    })
    expect(textSearchPageQuery(transitionQuery, 10001)).toEqual({
      fras: "old", sok_filter: "AuthorA", keywords: "texttype:roman",
      unknown: ["keep", null]
    })
  })

  test("full reset removes known, unknown, and repeated query entries", () => {
    expect(resetTextSearchQuery(transitionQuery)).toEqual({})
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

  test("enforces result highlight and required phrase request bounds", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    expect(buildTextSearchResultsRequest(state, 5).highlight_limit).toBe(5)
    expect(buildTextSearchResultsRequest(state, 500).highlight_limit).toBe(500)
    for (const limit of [4, 501, 5.5]) {
      expect(() => buildTextSearchResultsRequest(state, limit)).toThrow(RangeError)
    }
    expect(() => buildTextSearchResultsRequest(parseTextSearchRouteQuery({})))
      .toThrow(TypeError)
  })

  test("enforces title filter, selected ID, and title-limit request bounds", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const selected = Array.from({ length: 51 }, (_, index) => `lb${index}`)
    expect(buildTextSearchOptionsRequest(state, {
      titleFilter: "x".repeat(200),
      selectedWorkIds: [...selected, "bad/id"],
      titleLimit: 500
    })).toMatchObject({
      title_filter: "x".repeat(200),
      selected_work_ids: selected.slice(0, 50),
      title_limit: 500
    })
    expect(() => buildTextSearchOptionsRequest(state, { titleFilter: "x".repeat(201) }))
      .toThrow(RangeError)
    expect(() => buildTextSearchOptionsRequest(state, { titleLimit: 31 as 30 }))
      .toThrow(RangeError)
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
    const response = resultsResponse()

    expect(acceptTextSearchResultsResponse(response, request, identity)).toEqual(response)
    expect(acceptTextSearchResultsResponse(response, request, "stale")).toBeNull()

  })

  test.each([
    { name: "extra root key", mutate: (copy: JsonRecord) => { copy.raw = true } },
    {
      name: "extra work key",
      mutate: (copy: JsonRecord) => {
        requiredRecord({ work: requiredArray(copy, "works")[0] }, "work").source = {}
      }
    },
    {
      name: "extra word key",
      mutate: (copy: JsonRecord) => {
        const work = requiredRecord({ work: requiredArray(copy, "works")[0] }, "work")
        const highlight = requiredRecord(
          { highlight: requiredArray(work, "highlights")[0] },
          "highlight"
        )
        requiredRecord({ word: requiredArray(highlight, "match")[0] }, "word").lemma = "fri"
      }
    },
    { name: "wrong query", mutate: (copy: JsonRecord) => { copy.query = "other" } },
    { name: "wrong page", mutate: (copy: JsonRecord) => { copy.page = 2 } },
    {
      name: "unsupported media",
      mutate: (copy: JsonRecord) => {
        requiredRecord({ work: requiredArray(copy, "works")[0] }, "work").mediatype = "audio"
      }
    },
    {
      name: "unsafe work ID",
      mutate: (copy: JsonRecord) => {
        requiredRecord({ work: requiredArray(copy, "works")[0] }, "work").lbworkid = "bad/id"
      }
    },
    {
      name: "duplicate work ID",
      mutate: (copy: JsonRecord) => {
        const works = requiredArray(copy, "works")
        works.push(structuredClone(works[0]))
        copy.total_work_hits = 2
      }
    },
    {
      name: "duplicate facet ID",
      mutate: (copy: JsonRecord) => {
        const facets = requiredArray(copy, "author_facets")
        facets.push(structuredClone(facets[0]))
      }
    },
    {
      name: "descending token order",
      mutate: (copy: JsonRecord) => {
        const work = requiredRecord({ work: requiredArray(copy, "works")[0] }, "work")
        const highlight = requiredRecord(
          { highlight: requiredArray(work, "highlights")[0] },
          "highlight"
        )
        requiredArray(highlight, "match").push({ word: "nu", page_name: "12", word_id: "w12_2" })
      }
    },
    {
      name: "mixed match page names",
      mutate: (copy: JsonRecord) => {
        const work = requiredRecord({ work: requiredArray(copy, "works")[0] }, "work")
        const highlight = requiredRecord(
          { highlight: requiredArray(work, "highlights")[0] },
          "highlight"
        )
        requiredArray(highlight, "match").push({ word: "nu", page_name: "13", word_id: "w12_5" })
      }
    },
    { name: "incoherent total", mutate: (copy: JsonRecord) => { copy.total_work_hits = 0 } }
  ])("rejects result responses with $name", ({ mutate }) => {
    const request = buildTextSearchResultsRequest(
      parseTextSearchRouteQuery({ fras: "frihet" })
    )
    const response = cloneRecord(resultsResponse())
    mutate(response)
    expect(acceptTextSearchResultsResponse(
      response,
      request,
      textSearchResultsRequestIdentity(request)
    )).toBeNull()
  })

  test.each([
    "w4", "", "w_4", "w4_", "w4_x", "w4_5/path", `w${"1".repeat(99)}_1`
  ])("rejects malformed word ID %j", wordId => {
    const request = buildTextSearchResultsRequest(
      parseTextSearchRouteQuery({ fras: "frihet" })
    )
    const identity = textSearchResultsRequestIdentity(request)
    const response = resultsResponse()
    response.works[0]!.highlights[0]!.match[0]!.word_id = wordId

    expect(acceptTextSearchResultsResponse(response, request, identity)).toBeNull()
  })

  test("accepts context crossing a page boundary", () => {
    const request = buildTextSearchResultsRequest(
      parseTextSearchRouteQuery({ fras: "frihet" })
    )
    const response = resultsResponse()
    response.works[0]!.highlights[0]!.right_context[0]!.page_name = "13"
    response.works[0]!.highlights[0]!.right_context[0]!.word_id = "w13_5"
    expect(acceptTextSearchResultsResponse(
      response,
      request,
      textSearchResultsRequestIdentity(request)
    )).toEqual(response)
  })

  test("accepts work-scoped word IDs for the matching work", () => {
    const request = buildTextSearchResultsRequest(
      parseTextSearchRouteQuery({ fras: "kyrka" })
    )
    const response = resultsResponse()
    response.query = "kyrka"
    response.works[0]!.lbworkid = "lb7604979"
    response.works[0]!.highlights[0] = {
      left_context: [
        { word: "Er", page_name: "13", word_id: "lb7604979_8650" }
      ],
      match: [
        { word: "kyrka", page_name: "13", word_id: "lb7604979_8654" }
      ],
      right_context: [
        { word: "i", page_name: "13", word_id: "lb7604979_8658" }
      ]
    }

    expect(acceptTextSearchResultsResponse(
      response,
      request,
      textSearchResultsRequestIdentity(request)
    )).toEqual(response)
  })

  test("rejects differently encoded word-page identities", () => {
    const request = buildTextSearchResultsRequest(
      parseTextSearchRouteQuery({ fras: "frihet" })
    )
    const response = resultsResponse()
    response.works[0]!.highlights[0]!.left_context = []
    response.works[0]!.highlights[0]!.match = [
      { word: "frihet", page_name: "12", word_id: "w01_4" },
      { word: "nu", page_name: "12", word_id: "w1_5" }
    ]
    response.works[0]!.highlights[0]!.right_context = []
    expect(acceptTextSearchResultsResponse(
      response,
      request,
      textSearchResultsRequestIdentity(request)
    )).toBeNull()
  })

  test.each([".", "..", "12/13", "12\\13", "12%2F13", "12\n13", " 12"])(
    "rejects unsafe page identity %j",
    pageName => {
      const request = buildTextSearchResultsRequest(
        parseTextSearchRouteQuery({ fras: "frihet" })
      )
      const response = resultsResponse()
      for (const key of ["left_context", "match", "right_context"] as const) {
        for (const word of response.works[0]!.highlights[0]![key]) word.page_name = pageName
      }
      expect(acceptTextSearchResultsResponse(
        response,
        request,
        textSearchResultsRequestIdentity(request)
      )).toBeNull()
    }
  )

  test("accepts 30 result works and rejects 31", () => {
    const request = buildTextSearchResultsRequest(
      parseTextSearchRouteQuery({ fras: "frihet" })
    )
    const identity = textSearchResultsRequestIdentity(request)
    const response = resultsResponse()
    response.works = Array.from({ length: 30 }, (_, index) => ({
      ...structuredClone(response.works[0]!),
      lbworkid: `lb${index}`,
      title_id: `work${index}`
    }))
    response.total_work_hits = 30
    expect(acceptTextSearchResultsResponse(response, request, identity)).toEqual(response)

    response.works.push({
      ...structuredClone(response.works[0]!),
      lbworkid: "lb30",
      title_id: "work30"
    })
    response.total_work_hits = 31
    expect(acceptTextSearchResultsResponse(response, request, identity)).toBeNull()
  })

  test.each(["left_context", "right_context"] as const)(
    "accepts five and rejects six %s tokens",
    contextKey => {
      const request = buildTextSearchResultsRequest(
        parseTextSearchRouteQuery({ fras: "frihet" })
      )
      const identity = textSearchResultsRequestIdentity(request)
      const response = resultsResponse()
      const highlight = response.works[0]!.highlights[0]!
      highlight.left_context = []
      highlight.match[0]!.word_id = "w12_10"
      highlight.right_context = []
      highlight[contextKey] = Array.from({ length: 5 }, (_, index) => ({
        word: String(index + 1).repeat(29),
        page_name: "12",
        word_id: `w12_${contextKey === "left_context" ? index + 1 : index + 11}`
      }))

      expect(acceptTextSearchResultsResponse(response, request, identity)).toEqual(response)

      highlight[contextKey].push({
        word: "6".repeat(29),
        page_name: "12",
        word_id: `w12_${contextKey === "left_context" ? 6 : 16}`
      })
      expect(acceptTextSearchResultsResponse(response, request, identity)).toBeNull()
    }
  )

  test("enforces the request highlight and match list caps", () => {
    const request = buildTextSearchResultsRequest(
      parseTextSearchRouteQuery({ fras: "frihet" }),
      5
    )
    const identity = textSearchResultsRequestIdentity(request)
    const response = resultsResponse()
    const highlight = response.works[0]!.highlights[0]!
    highlight.left_context = []
    highlight.match = Array.from({ length: 1000 }, (_, index) => ({
      word: "match", page_name: "12", word_id: `w12_${index + 1}`
    }))
    highlight.right_context = []
    expect(acceptTextSearchResultsResponse(response, request, identity)).toEqual(response)

    highlight.match.push({ word: "overflow", page_name: "12", word_id: "w12_1001" })
    expect(acceptTextSearchResultsResponse(response, request, identity)).toBeNull()

    const highlights = resultsResponse()
    highlights.works[0]!.highlights = Array.from(
      { length: 6 },
      () => structuredClone(highlights.works[0]!.highlights[0]!)
    )
    expect(acceptTextSearchResultsResponse(highlights, request, identity)).toBeNull()
  })

  test("accepts 500 highlights and rejects 501", () => {
    const request = buildTextSearchResultsRequest(
      parseTextSearchRouteQuery({ fras: "frihet" }),
      500
    )
    const identity = textSearchResultsRequestIdentity(request)
    const response = resultsResponse()
    response.works[0]!.highlights = Array.from(
      { length: 500 },
      () => structuredClone(response.works[0]!.highlights[0]!)
    )
    expect(acceptTextSearchResultsResponse(response, request, identity)).toEqual(response)
    response.works[0]!.highlights.push(structuredClone(response.works[0]!.highlights[0]!))
    expect(acceptTextSearchResultsResponse(response, request, identity)).toBeNull()
  })

  test("accepts 10000 result facets and rejects 10001", () => {
    const request = buildTextSearchResultsRequest(
      parseTextSearchRouteQuery({ fras: "frihet" })
    )
    const identity = textSearchResultsRequestIdentity(request)
    const response = resultsResponse()
    response.author_facets = Array.from({ length: 10_000 }, (_, index) => ({
      author_id: `Author${index}`, name_for_index: `Author ${index}`, count: 1
    }))
    expect(acceptTextSearchResultsResponse(response, request, identity)).toEqual(response)
    response.author_facets.push({
      author_id: "Author10000", name_for_index: "Author 10000", count: 1
    })
    expect(acceptTextSearchResultsResponse(response, request, identity)).toBeNull()
  })

  test("accepts count totals through the safe-integer cap", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const countRequest = buildTextSearchCountRequest(state)
    const countIdentity = textSearchCountRequestIdentity(countRequest)
    const count = {
      query: "frihet",
      total_documents: Number.MAX_SAFE_INTEGER,
      total_highlights: Number.MAX_SAFE_INTEGER
    }
    expect(acceptTextSearchCountResponse(count, countRequest, countIdentity)).toEqual(count)
  })

  test.each([
    { name: "extra key", value: { query: "frihet", total_documents: 2, total_highlights: 3, raw: true } },
    { name: "wrong query", value: { query: "other", total_documents: 2, total_highlights: 3 } },
    { name: "negative documents", value: { query: "frihet", total_documents: -1, total_highlights: 3 } },
    { name: "boolean highlights", value: { query: "frihet", total_documents: 2, total_highlights: true } },
    {
      name: "unsafe integer",
      value: { query: "frihet", total_documents: Number.MAX_SAFE_INTEGER + 1, total_highlights: 3 }
    }
  ])("rejects count responses with $name", ({ value }) => {
    const request = buildTextSearchCountRequest(parseTextSearchRouteQuery({ fras: "frihet" }))
    expect(acceptTextSearchCountResponse(
      value,
      request,
      textSearchCountRequestIdentity(request)
    )).toBeNull()
  })

  test("rejects count responses from a stale request", () => {
    const request = buildTextSearchCountRequest(parseTextSearchRouteQuery({ fras: "frihet" }))
    expect(acceptTextSearchCountResponse(
      { query: "frihet", total_documents: 2, total_highlights: 3 },
      request,
      "stale"
    )).toBeNull()
  })

  test("accepts strict options and the 50 selected plus 500 ordinary boundary", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })

    const optionsRequest = buildTextSearchOptionsRequest(state)
    const optionsIdentity = textSearchOptionsRequestIdentity(optionsRequest)
    const options = optionsResponse()
    expect(acceptTextSearchOptionsResponse(options, optionsRequest, optionsIdentity))
      .toEqual(options)

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
  })

  test("accepts 10000 static author rows per list and rejects 10001", () => {
    const request = buildTextSearchOptionsRequest(parseTextSearchRouteQuery({ fras: "frihet" }))
    const identity = textSearchOptionsRequestIdentity(request)
    const authorRows = Array.from({ length: 10_000 }, (_, index) => ({
      author_id: `Author${index}`,
      name_for_index: `Author ${index}`,
      birth_year: null,
      death_year: null
    }))
    const authors = {
      title_options: [], title_total: 0, title_author_facets: [],
      authors: authorRows, about_authors: [], year_from: null, year_to: null
    }
    expect(acceptTextSearchOptionsResponse(authors, request, identity)).toEqual(authors)
    authors.authors.push({
      author_id: "Author10000", name_for_index: "Author 10000",
      birth_year: null, death_year: null
    })
    expect(acceptTextSearchOptionsResponse(authors, request, identity)).toBeNull()

    const aboutAuthors = {
      title_options: [], title_total: 0, title_author_facets: [], authors: [],
      about_authors: authorRows.slice(0, 10_000), year_from: null, year_to: null
    }
    expect(acceptTextSearchOptionsResponse(aboutAuthors, request, identity))
      .toEqual(aboutAuthors)
    aboutAuthors.about_authors.push({
      author_id: "Author10000", name_for_index: "Author 10000",
      birth_year: null, death_year: null
    })
    expect(acceptTextSearchOptionsResponse(aboutAuthors, request, identity)).toBeNull()
  })

  test("accepts options responses with optional chronology bounds omitted", () => {
    const request = buildTextSearchOptionsRequest(parseTextSearchRouteQuery({ fras: "frihet" }))
    const response = optionsResponse()
    delete response.year_from
    delete response.year_to

    expect(acceptTextSearchOptionsResponse(
      response,
      request,
      textSearchOptionsRequestIdentity(request)
    )).toEqual(response)
  })

  test.each([
    {
      name: "extra title key",
      mutate: (copy: JsonRecord) => {
        requiredRecord({ title: requiredArray(copy, "title_options")[0] }, "title").raw = true
      }
    },
    {
      name: "unsafe author ID",
      mutate: (copy: JsonRecord) => {
        requiredRecord({ author: requiredArray(copy, "authors")[0] }, "author").author_id = "bad/id"
      }
    },
    {
      name: "duplicate title ID",
      mutate: (copy: JsonRecord) => {
        const titles = requiredArray(copy, "title_options")
        titles.push(structuredClone(titles[0]))
      }
    },
    {
      name: "duplicate facet ID",
      mutate: (copy: JsonRecord) => {
        const facets = requiredArray(copy, "title_author_facets")
        facets.push(structuredClone(facets[0]))
      }
    },
    {
      name: "duplicate author ID",
      mutate: (copy: JsonRecord) => {
        const authors = requiredArray(copy, "authors")
        authors.push(structuredClone(authors[0]))
      }
    },
    {
      name: "descending years",
      mutate: (copy: JsonRecord) => { copy.year_from = 2200; copy.year_to = 1000 }
    },
    { name: "negative total", mutate: (copy: JsonRecord) => { copy.title_total = -1 } }
  ])("rejects options responses with $name", ({ mutate }) => {
    const request = buildTextSearchOptionsRequest(
      parseTextSearchRouteQuery({ fras: "frihet" })
    )
    const response = cloneRecord(optionsResponse())
    mutate(response)
    expect(acceptTextSearchOptionsResponse(
      response,
      request,
      textSearchOptionsRequestIdentity(request)
    )).toBeNull()
  })

  test.each([
    { optionIds: ["lb-selected-2", "lb-selected-1"] },
    { optionIds: ["lb-selected-1"] },
    { optionIds: ["lb-ordinary", "lb-selected-1", "lb-selected-2"] }
  ])("rejects selected title prefix $optionIds", ({ optionIds }) => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const request = buildTextSearchOptionsRequest(state, {
      titleLimit: 30,
      selectedWorkIds: ["lb-selected-1", "lb-selected-2"]
    })
    const identity = textSearchOptionsRequestIdentity(request)
    const response = {
      title_options: optionIds.map(workId => ({ work_id: workId, title: workId, author_name: "Author" })),
      title_total: optionIds.includes("lb-ordinary") ? 1 : 0,
      title_author_facets: [], authors: [], about_authors: [],
      year_from: null, year_to: null
    }

    expect(acceptTextSearchOptionsResponse(response, request, identity)).toBeNull()
  })

  test("permits title_limit zero with only the requested selected prefix", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const request = buildTextSearchOptionsRequest(state, {
      titleLimit: 0,
      selectedWorkIds: ["lb-selected-1", "lb-selected-2"]
    })
    const response = {
      title_options: [
        { work_id: "lb-selected-1", title: "One", author_name: "Author" },
        { work_id: "lb-selected-2", title: "Two", author_name: "Author" }
      ],
      title_total: 0,
      title_author_facets: [], authors: [], about_authors: [],
      year_from: null, year_to: null
    }
    expect(acceptTextSearchOptionsResponse(
      response,
      request,
      textSearchOptionsRequestIdentity(request)
    )).toEqual(response)
  })

  test("rejects ordinary options beyond the request limit or filtered total", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const zeroLimit = buildTextSearchOptionsRequest(state, { titleLimit: 0 })
    expect(acceptTextSearchOptionsResponse(
      optionsResponse(),
      zeroLimit,
      textSearchOptionsRequestIdentity(zeroLimit)
    )).toBeNull()

    const request = buildTextSearchOptionsRequest(state, { titleLimit: 30 })
    const response = optionsResponse()
    response.title_options.push({ work_id: "lb2", title: "Two", author_name: "Author" })
    expect(acceptTextSearchOptionsResponse(
      response,
      request,
      textSearchOptionsRequestIdentity(request)
    )).toBeNull()
  })

  test("rejects ordinary options and facets when the filtered total is zero", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const request = buildTextSearchOptionsRequest(state)
    const ordinary = optionsResponse()
    ordinary.title_total = 0
    ordinary.title_author_facets = []
    expect(acceptTextSearchOptionsResponse(
      ordinary,
      request,
      textSearchOptionsRequestIdentity(request)
    )).toBeNull()

    const facet = optionsResponse()
    facet.title_options = []
    facet.title_total = 0
    expect(acceptTextSearchOptionsResponse(
      facet,
      request,
      textSearchOptionsRequestIdentity(request)
    )).toBeNull()
  })

  test("requires positive facet counts no greater than the filtered total", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const request = buildTextSearchOptionsRequest(state)
    for (const count of [0, 2]) {
      const response = optionsResponse()
      response.title_author_facets[0]!.count = count
      expect(acceptTextSearchOptionsResponse(
        response,
        request,
        textSearchOptionsRequestIdentity(request)
      )).toBeNull()
    }
  })

  test("compacts Angular left context toward 40 summed word characters", () => {
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
    expect(context.map(item => item.word)).toEqual([
      "1234567890", "abcdefghij", "klmnopqrst", "uvwxyzABCD", "tail"
    ])
  })

  test("removes 30-character context words on both sides", () => {
    const word = (text: string, ordinal: number) => ({
      word: text, page_name: "1", word_id: `w1_${ordinal}`
    })
    expect(compactTextSearchLeftContext([
      word("x".repeat(30), 1), word("short", 2)
    ])).toEqual([word("short", 2)])
    expect(compactTextSearchRightContext([
      word("short", 3), word("x".repeat(30), 4), word("tail", 5)
    ])).toEqual([word("short", 3), word("tail", 5)])
  })

  test("excludes discarded long words before budgeting left context", () => {
    const word = (text: string, ordinal: number) => ({
      word: text, page_name: "1", word_id: `w1_${ordinal}`
    })
    const context = [
      word("v".repeat(20), 1),
      word("x".repeat(30), 2),
      word("t".repeat(10), 3)
    ]

    expect(compactTextSearchLeftContext(context)).toEqual([
      word("v".repeat(20), 1),
      word("t".repeat(10), 3)
    ])
    expect(context).toEqual([
      word("v".repeat(20), 1),
      word("x".repeat(30), 2),
      word("t".repeat(10), 3)
    ])
  })

  test("preserves five 29-character right-context tokens in order without mutating input", () => {
    const rightContext = Array.from({ length: 5 }, (_, index) => ({
      word: String(index + 1).repeat(29),
      page_name: "1",
      word_id: `w1_${index + 3}`
    }))
    const highlight = {
      left_context: [{ word: "left", page_name: "1", word_id: "w1_1" }],
      match: [{ word: "match", page_name: "1", word_id: "w1_2" }],
      right_context: rightContext
    }
    const original = structuredClone(highlight)

    const prepared = prepareTextSearchHighlight(highlight)

    expect(prepared.right_context).toEqual(rightContext)
    expect(prepared.right_context.map(token => token.word)).toEqual([
      "1".repeat(29),
      "2".repeat(29),
      "3".repeat(29),
      "4".repeat(29),
      "5".repeat(29)
    ])
    expect(prepared.right_context).not.toBe(rightContext)
    expect(highlight).toEqual(original)
  })

  test("prepares contexts without removing or reordering match tokens", () => {
    const match = [
      { word: "first", page_name: "1", word_id: "w1_2" },
      { word: "x".repeat(30), page_name: "1", word_id: "w1_3" }
    ]
    const prepared = prepareTextSearchHighlight({
      left_context: [{ word: "x".repeat(30), page_name: "1", word_id: "w1_1" }],
      match,
      right_context: [{ word: "x".repeat(30), page_name: "1", word_id: "w1_4" }]
    })
    expect(prepared.left_context).toEqual([])
    expect(prepared.match).toEqual(match)
    expect(prepared.match).not.toBe(match)
    expect(prepared.right_context).toEqual([])
  })

  test("marks only the Angular punctuation allowlist", () => {
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
      keyword: "source:sol,keyword:Drama:webben",
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
      s_categories: "texttype:roman",
      s_legacy_filters: JSON.stringify([
        { field: "source", value: "sol" },
        { field: "keyword", value: "Drama:webben" }
      ]),
      s_facet_author_id: "AuthorC"
    })
    expect(href).not.toContain("unknown")
    expect(href).not.toContain("fuzzy")
    expect(href).not.toContain("text_filter")
    expect(href).not.toContain("sort")
  })

  test("preserves work-scoped word IDs in Reader hit parameters", () => {
    const state = parseTextSearchRouteQuery({ fras: "kyrka" })
    const work = {
      lbworkid: "lb7604979", author_id: "AuthorA", author_name: "Author A",
      title: "Work", title_id: "work", mediatype: "etext" as const,
      has_more_highlights: false, highlights: []
    }
    const highlight = {
      left_context: [],
      match: [
        { word: "kyrka", page_name: "13", word_id: "lb7604979_8654" },
        { word: "nu", page_name: "13", word_id: "lb7604979_8658" }
      ],
      right_context: []
    }

    const url = new URL(
      buildTextSearchReaderHref(work, highlight, 0, state),
      "https://example.test"
    )

    expect(url.pathname).toBe("/f%C3%B6rfattare/AuthorA/titlar/work/sida/13/etext")
    expect(url.searchParams.get("traff")).toBe("lb7604979_8654")
    expect(url.searchParams.get("traffslut")).toBe("lb7604979_8658")
  })

  test("builds faksimil Reader links at both zero-based hit boundaries", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const work = {
      lbworkid: "lb1", author_id: "AuthorA", author_name: "Author A",
      title: "Work", title_id: "work", mediatype: "faksimil" as const,
      has_more_highlights: false, highlights: []
    }
    const highlight = {
      left_context: [],
      match: [{ word: "frihet", page_name: "12", word_id: "w12_4" }],
      right_context: []
    }
    const first = new URL(
      buildTextSearchReaderHref(work, highlight, 0, state),
      "https://example.test"
    )
    const last = new URL(
      buildTextSearchReaderHref(work, highlight, 1_000_001, state),
      "https://example.test"
    )
    expect(first.pathname.endsWith("/12/faksimil")).toBe(true)
    expect(first.searchParams.get("hit")).toBe("0")
    expect(first.searchParams.get("s_mediatype")).toBe("faksimil")
    expect(last.searchParams.get("hit")).toBe("1000001")
    expect(last.searchParams.get("hit_index")).toBe("1000001")

    for (const hit of [-1, 1.5, 1_000_002]) {
      expect(() => buildTextSearchReaderHref(work, highlight, hit, state))
        .toThrow(RangeError)
    }
  })

  test("rejects malformed match IDs before constructing Reader marker parameters", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const work = {
      lbworkid: "lb1", author_id: "AuthorA", author_name: "Author A",
      title: "Work", title_id: "work", mediatype: "etext" as const,
      has_more_highlights: false, highlights: []
    }
    const highlight = {
      left_context: [],
      match: [{ word: "frihet", page_name: "12", word_id: "w4" }],
      right_context: []
    }
    expect(() => buildTextSearchReaderHref(work, highlight, 0, state)).toThrow(TypeError)
  })

  test("refuses Reader links with dot-segment page names", () => {
    const state = parseTextSearchRouteQuery({ fras: "frihet" })
    const work = {
      lbworkid: "lb1", author_id: "AuthorA", author_name: "Author A",
      title: "Work", title_id: "work", mediatype: "etext" as const,
      has_more_highlights: false, highlights: []
    }

    for (const pageName of [".", ".."]) {
      const highlight = {
        left_context: [],
        match: [{ word: "frihet", page_name: pageName, word_id: "w12_4" }],
        right_context: []
      }
      expect(() => buildTextSearchReaderHref(work, highlight, 0, state)).toThrow(TypeError)
    }
  })
})
