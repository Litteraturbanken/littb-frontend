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
        download_url: "/epub/gosta.epub",
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
      downloadHref: "/epub/gosta.epub",
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
