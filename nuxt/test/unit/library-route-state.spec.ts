import { describe, expect, it } from "vitest"

import { parseLibraryRouteState } from "../../app/lib/library/navigation"

const filters = Object.freeze({ marker: "advanced" })

describe("parseLibraryRouteState", () => {
  it.each([
    ["/bibliotek", {}, "all", "relevans", 1],
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
})
