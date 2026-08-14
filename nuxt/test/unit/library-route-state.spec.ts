import { describe, expect, it } from "vitest"

import { parseLibraryRouteState } from "../../app/lib/library/navigation"
import {
  libraryRequestState,
  libraryStateKey,
  parseLibraryPageRouteState
} from "../../app/lib/library/route-state"

const filters = Object.freeze({ marker: "advanced" })

describe("parseLibraryRouteState", () => {
  it.each([
    ["/bibliotek", {}, "all", "relevans", 1],
    ["/bibliotek", { sida: "0" }, "all", "relevans", 1],
    ["/bibliotek", { sida: "2" }, "all", "relevans", 2],
    ["/bibliotek", { sida: "100" }, "all", "relevans", 100],
    ["/bibliotek", { sida: "101" }, "all", "relevans", 1],
    ["/bibliotek", { visa: "authors", sort: "namn", sida: "7" }, "authors", "namn", 1],
    ["/bibliotek", { visa: "parts", sort: "forfattare", sida: "3" }, "parts", "forfattare", 3],
    ["/bibliotek", { visa: "latest", sort: "titlar", hide1800: null }, "latest", "nytillkommet", 1],
    ["/bibliotek", { visa: "pdf", sort: "kronologi", sida: "100" }, "pdf", "kronologi", 100],
    ["/epub", { visa: "works", sort: "invalid", sida: "101" }, "epub", "popularitet", 1]
  ])("normalizes %s %o", (path, query, mode, sort, page) => {
    expect(parseLibraryRouteState(path, query, filters)).toMatchObject({
      mode,
      sort,
      page,
      advancedFilters: filters
    })
  })

  it("gives source download mode authority over the requested tab", () => {
    expect(parseLibraryRouteState(
      "/bibliotek",
      { visa: "pdf", nedladdning: "1", avancerat: null, filter: "strindberg" },
      filters
    )).toEqual({
      standalone: false,
      mode: "works",
      filter: "strindberg",
      sort: "popularitet",
      page: 1,
      hide1800: false,
      downloadMode: true,
      advanced: true,
      advancedFilters: filters
    })
  })

  it("normalizes advanced route fields against the accepted option authority", () => {
    expect(parseLibraryPageRouteState("/bibliotek", {
      visa: "works",
      kön: "female",
      keywords: "keyword:one,keyword:two",
      keywords_aux: "keyword:two",
      about_authors: "author-1",
      mediatypes: "mediatype:etext",
      languages: "language:swe",
      intervall: "1850,1900"
    }, {
      chronologyBounds: { from: 1800, to: 2000 },
      collectionValues: new Set(["keyword:one", "keyword:two"]),
      aboutAuthorIds: new Set(["author-1"]),
      mediaValues: new Set(["mediatype:etext"]),
      languageValues: new Set(["language:swe"])
    })).toMatchObject({
      mode: "works",
      advancedFilters: {
        gender: "female",
        keywords: ["keyword:one", "keyword:two"],
        narrowingKeywords: ["keyword:two"],
        aboutAuthorIds: ["author-1"],
        media: ["mediatype:etext"],
        languages: ["language:swe"],
        yearRange: [1850, 1900]
      }
    })
  })

  it("drops duplicate, unavailable, and full-bound advanced route values atomically", () => {
    expect(parseLibraryPageRouteState("/bibliotek", {
      kön: "other",
      keywords: "keyword:one,keyword:one",
      keywords_aux: "keyword:missing",
      about_authors: "author-missing",
      mediatypes: "mediatype:missing",
      languages: "language:missing",
      intervall: "1800,2000"
    }, {
      chronologyBounds: { from: 1800, to: 2000 },
      collectionValues: new Set(["keyword:one"]),
      aboutAuthorIds: new Set(["author-1"]),
      mediaValues: new Set(["mediatype:etext"]),
      languageValues: new Set(["language:swe"])
    }).advancedFilters).toEqual({
      gender: "",
      keywords: [],
      narrowingKeywords: [],
      aboutAuthorIds: [],
      media: [],
      languages: [],
      yearRange: null
    })
  })

  it("projects request paging and navigation identity from normalized route state", () => {
    const routeState = parseLibraryPageRouteState("/bibliotek", {
      visa: "authors",
      sort: "namn",
      sida: "7"
    }, {
      chronologyBounds: null,
      collectionValues: new Set(),
      aboutAuthorIds: new Set(),
      mediaValues: new Set(),
      languageValues: new Set()
    })
    const requestState = libraryRequestState(routeState)

    expect(requestState.page).toBe(1)
    expect(libraryStateKey(requestState)).toBe(JSON.stringify([
      false,
      "authors",
      "",
      "namn",
      1,
      false,
      false,
      requestState.advancedFilters
    ]))
  })
})
