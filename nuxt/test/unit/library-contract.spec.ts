import { describe, expect, test } from "vitest"

import {
  buildLibraryCountRequest,
  buildLibraryFilters,
  buildLibrarySearchRequest,
  type LibraryAuthor,
  type LibraryFilterState,
  type LibrarySearchRequest,
  type LibrarySearchResponse
} from "../../app/lib/library"
import {
  formatLibrarySourceExportSize,
  toLibrarySearchView
} from "../../app/lib/library/view-model"
import { libraryAuthorTooltipText } from "../../app/lib/library-tooltip"
import { librarySortDirection } from "../../app/lib/library/component-models"

const filterState = {
  query: "  Selma  ",
  gender: "female",
  categories: ["texttype:roman"],
  narrowingCategories: ["keyword:Barnlitteratur"],
  aboutAuthorIds: ["LagerlofS"],
  media: ["mediatype:etext"],
  languages: ["language:swe"],
  yearRange: [1890, 1910]
} satisfies LibraryFilterState

const author = {
  author_id: "LagerlofS",
  full_name: "Lagerlöf, Selma",
  surname: "Lagerlöf",
  role: "editor",
  birth_year: "1858",
  death_year: "1940"
} satisfies LibraryAuthor

describe("typed Library boundary", () => {
  test.each([
    ["all", "relevans", "fallande"],
    ["all", "forfattare", "stigande"],
    ["all", "titlar", "stigande"],
    ["all", "kronologi", "fallande"],
    ["latest", "nytillkommet", "fallande"],
    ["authors", "namn", "stigande"],
    ["authors", "popularitet", "fallande"],
    ["authors", "kronologi", "stigande"],
    ["works", "forfattare", "stigande"],
    ["works", "titlar", "stigande"],
    ["works", "popularitet", "fallande"],
    ["works", "kronologi", "fallande"],
    ["parts", "forfattare", "stigande"],
    ["parts", "titlar", "stigande"],
    ["epub", "forfattare", "stigande"],
    ["epub", "titlar", "stigande"],
    ["epub", "popularitet", "fallande"],
    ["epub", "kronologi", "fallande"],
    ["pdf", "forfattare", "stigande"],
    ["pdf", "titlar", "stigande"],
    ["pdf", "popularitet", "fallande"],
    ["pdf", "kronologi", "fallande"]
  ] as const)("describes the %s %s sort from its backend default", (
    mode,
    key,
    expected
  ) => {
    expect(librarySortDirection(mode, key, false)).toBe(expected)
    expect(librarySortDirection(mode, key, true))
      .toBe(expected === "stigande" ? "fallande" : "stigande")
  })

  test("maps route filter state to the complete generated filters shape", () => {
    expect(buildLibraryFilters(filterState)).toEqual({
      query: "  Selma  ",
      gender: "female",
      categories: ["texttype:roman"],
      narrowing_categories: ["keyword:Barnlitteratur"],
      about_author_ids: ["LagerlofS"],
      media: ["mediatype:etext"],
      languages: ["language:swe"],
      year_from: 1890,
      year_to: 1910
    })
  })

  test("builds every search mode and maps Swedish sort keys", () => {
    const requests = [
      buildLibrarySearchRequest({ mode: "all", filters: filterState, sort: "relevans", reverse: false, page: 2 }),
      buildLibrarySearchRequest({ mode: "authors", filters: filterState, sort: "namn", reverse: true, limit: 150 }),
      buildLibrarySearchRequest({ mode: "works", filters: filterState, sort: "forfattare", reverse: false, page: 2, sourceOnly: true }),
      buildLibrarySearchRequest({ mode: "parts", filters: filterState, sort: "titlar", reverse: false, page: 3 }),
      buildLibrarySearchRequest({ mode: "latest", filters: filterState, reverse: false, page: 4, hide1800: true }),
      buildLibrarySearchRequest({ mode: "epub", filters: filterState, sort: "popularitet", reverse: false, page: 5 }),
      buildLibrarySearchRequest({ mode: "pdf", filters: filterState, sort: "kronologi", reverse: true, page: 6 })
    ] satisfies LibrarySearchRequest[]

    expect(requests.map(request => request.mode)).toEqual([
      "all", "authors", "works", "parts", "latest", "epub", "pdf"
    ])
    expect(requests.map(request => "sort" in request ? request.sort : null)).toEqual([
      "relevance", "name", "author", "title", null, "popularity", "chronology"
    ])
    expect(requests[0]).toMatchObject({ page: 2 })
    expect(requests[2]).toMatchObject({ page: 2, source_only: true })
    expect(requests[4]).toMatchObject({ page: 4, hide_1800: true })
  })

  test("builds each single-kind count request", () => {
    expect((["epub", "pdf", "works", "parts"] as const).map(mode =>
      buildLibraryCountRequest(mode, filterState)
    ).map(request => request.mode)).toEqual(["epub", "pdf", "works", "parts"])
  })

  test("normalizes author tooltip input", () => {
    expect(libraryAuthorTooltipText(author, "Lagerlöf")).toBe(
      "Lagerlöf, Selma (1858-1940)"
    )
  })

  test("maps all-result URLs and author contribution suffixes", () => {
    const response = {
      mode: "all",
      total_hits: 2,
      items: [
        {
          kind: "text",
          index: "etext-part",
          media_type: "etext",
          page_name: "12",
          reader_author_id: "LagerlofS",
          title_id: "GostaBerlingsSaga",
          title: "Gösta Berlings saga",
          short_title: "Gösta Berling",
          source_label: "E-text",
          imprint_year: "1891",
          main_author: author,
          highlights: [{ segments: [
            { text: "Selma ", hit: false },
            { text: "Lagerlöf", hit: true }
          ] }]
        },
        {
          kind: "pdf",
          work_id: "lb9999999",
          title: "Ett verk",
          short_title: null,
          source_label: "PDF",
          imprint_year: null,
          main_author: author,
          highlights: []
        }
      ]
    } satisfies LibrarySearchResponse

    const view = toLibrarySearchView(response)
    expect(view.mode).toBe("all")
    if (view.mode !== "all") throw new Error("expected all view")
    expect(view.response.data[0]).toMatchObject({
      primaryHref: "/f%C3%B6rfattare/LagerlofS/titlar/GostaBerlingsSaga/sida/12/etext",
      authorContribution: "(red.)"
    })
    expect(view.response.data[1].primaryHref).toBe("/txt/lb9999999/lb9999999.pdf")
    expect(view.response.data[0].highlights).toEqual([{ segments: [
      { text: "Selma ", hit: false },
      { text: "Lagerlöf", hit: true }
    ] }])
  })

  test.each([
    ["/presentationer/forfattare/StrindbergA.html", "/presentationer/forfattare/StrindbergA.html"],
    ["http://example.test/kringtext", "http://example.test/kringtext"],
    ["https://litteraturbanken.se/presentationer/kringtext", "https://litteraturbanken.se/presentationer/kringtext"],
    ["javascript:alert(1)", ""],
    ["data:text/html,unsafe", ""],
    ["//evil.test/kringtext", ""],
    ["https://user:secret@example.test/kringtext", ""],
    ["https://example.test/kring\u0000text", ""],
    ["https://example.test/%0Akringtext", ""],
    ["https://example.test/%E0%A4%A", ""],
    ["/presentationer/%5C%5Cevil.test", ""]
  ])("validates external all-result href %s", (url, expectedHref) => {
    const response = {
      mode: "all",
      total_hits: 1,
      items: [{
        kind: "presentation",
        source_label: "Kringtexter",
        title: "Extern träff",
        url,
        byline: "Litteraturbanken",
        highlights: []
      }]
    } satisfies LibrarySearchResponse

    const view = toLibrarySearchView(response)
    if (view.mode !== "all") throw new Error("expected all view")
    expect(view.response.data[0].primaryHref).toBe(expectedHref)
  })

  test("defensively hides zero author lifespan sentinels", () => {
    const response = {
      mode: "all",
      total_hits: 1,
      items: [{
        kind: "author",
        author_id: "UnknownA",
        name_for_index: "Okänd",
        popularity: 0,
        birth_year: 0,
        death_year: 0,
        highlights: []
      }]
    } satisfies LibrarySearchResponse

    const view = toLibrarySearchView(response)
    if (view.mode !== "all") throw new Error("expected all view")
    expect(view.response.data[0]).toMatchObject({
      yearLabel: "",
      mobileYearLabel: "",
      authorBirth: 0
    })
  })

  test("maps download URLs, RouteLocationRaw and spaced role suffix", () => {
    const response = {
      mode: "epub",
      total_hits: 1,
      total_works: 1,
      items: [{
        author,
        author_url: "/författare/LagerlofS/",
        download_filename: "gosta.epub",
        download_url: "/txt/epub/LagerlofS_GostaBerlingsSaga.epub",
        full_title: "Gösta Berlings saga: en berättelse",
        route_author_id: "LagerlofS",
        route_media_type: "etext",
        route_title_id: "GostaBerlingsSaga",
        title: "Gösta Berlings saga",
        title_url: "/författare/LagerlofS/titlar/GostaBerlingsSaga/",
        year: "1891"
      }]
    } satisfies LibrarySearchResponse

    const view = toLibrarySearchView(response)
    if (view.mode !== "epub") throw new Error("expected epub view")
    expect(view.response.data[0]).toMatchObject({
      titleHref: "/författare/LagerlofS/titlar/GostaBerlingsSaga/",
      authorHref: "/författare/LagerlofS/",
      downloadHref: "/txt/epub/LagerlofS_GostaBerlingsSaga.epub",
      roleSuffix: " (red.)",
      titleTo: {
        name: "författare-author-titlar-title-mediatype",
        params: { author: "LagerlofS", title: "GostaBerlingsSaga", mediatype: "etext" },
        query: { "om-boken": null }
      }
    })
  })

  test("preserves browse action order and labels source exports and sizes", () => {
    const response = {
      mode: "works",
      total_hits: 1,
      total_works: 1,
      items: [{
        actions: [
          { kind: "download", label: "Ladda ned", url: "/epub/a.epub", download_filename: "a.epub" },
          { kind: "read", label: "Läs", url: "/las/a", download_filename: null }
        ],
        author,
        author_url: "/författare/LagerlofS/",
        full_title: "Full titel",
        key: "work-1",
        route_author_id: "LagerlofS",
        route_media_type: "etext",
        route_title_id: "Titel",
        source_exports: [
          { format: "xml", media_type: "etext", size: 1024, work_id: "lb1" },
          { format: "pdf", media_type: "faksimil", size: 2_097_152, work_id: "lb2" }
        ],
        title: "Titel",
        title_path: "LagerlofS/Titel",
        title_url: "/författare/LagerlofS/titlar/Titel/",
        year: "1900"
      }]
    } satisfies LibrarySearchResponse

    const view = toLibrarySearchView(response)
    if (view.mode !== "works") throw new Error("expected works view")
    expect(view.response.data[0].actions.map(action => action.kind)).toEqual(["download", "read"])
    expect(view.response.data[0].sourceExports).toEqual([
      { lbworkid: "lb1", mediatype: "etext", type: "xml", size: 1024 },
      { lbworkid: "lb2", mediatype: "faksimil", type: "pdf", size: 2_097_152 }
    ])
    expect(formatLibrarySourceExportSize(0)).toBe("")
    expect(formatLibrarySourceExportSize(1024)).toBe("1 KB")
    expect(formatLibrarySourceExportSize(2_097_152)).toBe("2.00MB")
  })

  test.each([
    ["read", "/f%C3%B6rfattare/LagerlofS/titlar/Titel/sida/-2/etext", "/f%C3%B6rfattare/LagerlofS/titlar/Titel/sida/-2/etext"],
    ["about", "/f%C3%B6rfattare/LagerlofS/titlar/Titel/sida/-2/etext?om-boken#info", "/f%C3%B6rfattare/LagerlofS/titlar/Titel/sida/-2/etext?om-boken#info"],
    ["search", "/sok?forfattare=LagerlofS&titlar=lb1&avancerad#träffar", "/sok?forfattare=LagerlofS&titlar=lb1&avancerad#träffar"],
    ["search", "/sok?forfattare=LagerlofS#external-link", "/sok?forfattare=LagerlofS#external-link"],
    ["download", "/txt/epub/LagerlofS_Titel.epub", "/txt/epub/LagerlofS_Titel.epub"],
    ["download", "/txt/lb1/lb1.pdf", "/txt/lb1/lb1.pdf"],
    ["download", "/export/faksimil/lb1.pdf", "/export/faksimil/lb1.pdf"],
    ["read", "javascript:alert(1)", ""],
    ["read", "https://evil.test/reader", ""],
    ["search", "/#external", ""],
    ["search", "/#external-link", ""],
    ["search", "/#external%2dlink", ""],
    ["download", "//evil.test/book.epub", ""],
    ["download", "/txt/epub/../evil.epub", ""],
    ["download", "/txt/epub/%E0%A4%A.epub", ""],
    ["download", "/txt/epub/%5Cevil.epub", ""],
    ["download", "/txt/epub/book.epub?redirect=https://evil.test", ""]
  ] as const)("bounds %s Browse action %s", (kind, url, expectedHref) => {
    const response = {
      mode: "works",
      total_hits: 1,
      total_works: 1,
      items: [{
        actions: [{ kind, label: "Åtgärd", url, download_filename: kind === "download" ? "Titel.epub" : null }],
        author,
        author_url: "/författare/LagerlofS/",
        full_title: "Full titel",
        key: "work-1",
        route_author_id: "LagerlofS",
        route_media_type: "etext",
        route_title_id: "Titel",
        source_exports: [],
        title: "Titel",
        title_path: "LagerlofS/Titel",
        title_url: "/författare/LagerlofS/titlar/Titel/",
        year: "1900"
      }]
    } satisfies LibrarySearchResponse

    const view = toLibrarySearchView(response)
    if (view.mode !== "works") throw new Error("expected works view")
    expect(view.response.data[0].actions[0]?.href).toBe(expectedHref)
  })

  test.each([
    ["epub", "/txt/epub/LagerlofS_Titel.epub", "/txt/epub/LagerlofS_Titel.epub"],
    ["epub", "/export/faksimil/lb1.pdf", ""],
    ["pdf", "/txt/lb1/lb1.pdf", "/txt/lb1/lb1.pdf"],
    ["pdf", "/export/faksimil/lb1.pdf", "/export/faksimil/lb1.pdf"],
    ["pdf", "/txt/epub/disguised.pdf", ""],
    ["pdf", "https://evil.test/book.pdf", ""],
    ["pdf", "/txt/%2e%2e/evil.pdf", ""],
    ["pdf", "/txt/%00evil.pdf", ""],
    ["pdf", "/txt/lb1/lb1.pdf?download=1", ""]
  ] as const)("bounds %s result download %s", (mode, downloadUrl, expectedHref) => {
    const response = {
      mode,
      total_hits: 1,
      total_works: 1,
      items: [{
        author,
        author_url: "/författare/LagerlofS/",
        download_filename: `Titel.${mode}`,
        download_url: downloadUrl,
        full_title: "Full titel",
        route_author_id: "LagerlofS",
        route_media_type: "etext",
        route_title_id: "Titel",
        title: "Titel",
        title_url: "/författare/LagerlofS/titlar/Titel/",
        year: "1900"
      }]
    } satisfies LibrarySearchResponse

    const view = toLibrarySearchView(response)
    if (view.mode !== mode) throw new Error(`expected ${mode} view`)
    expect(view.response.data[0].downloadHref).toBe(expectedHref)
  })

  test("formats latest groups with Swedish dates and source counts", () => {
    const response = {
      mode: "latest",
      total_hits: 1,
      total_works: 1,
      groups: [{ imported_on: "2026-07-27", source_count: 3, items: [] }]
    } satisfies LibrarySearchResponse

    const view = toLibrarySearchView(response)
    if (view.mode !== "latest") throw new Error("expected latest view")
    expect(view.response.groups[0].label).toBe("27 juli 2026 (3 verk)")
  })
})
