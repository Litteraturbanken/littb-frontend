import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

import type { operations } from "../../app/lib/api/generated/lbapi"
import { libraryImprintYearCases } from "../helpers/library-imprint-year-cases"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
type LibrarySearchRequest = operations["v2_post_library_search"]["requestBody"]["content"]["application/json"]
type LibraryCountRequest = operations["v2_post_library_counts"]["requestBody"]["content"]["application/json"]
type LibraryFilters = LibrarySearchRequest["filters"]

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_library_relevance_requests`),
    request.delete(`${fixture}/_library_query_requests`),
    request.delete(`${fixture}/_library_v2/requests`),
    request.delete(`${fixture}/_library_v2/failures`),
    request.delete(`${fixture}/_library_v2/delays`)
  ])
}

async function legacyRelevanceRequests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_library_relevance_requests`)).json()).requests as
    Array<{ path: string, query: Record<string, string> }>
}

async function legacyQueryRequests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_library_query_requests`)).json()).requests as
    Array<{ path: string, query: Record<string, string> }>
}

async function libraryV2Requests(request: APIRequestContext) {
  return await (await request.get(`${fixture}/_library_v2/requests`)).json() as {
    options: Array<{ method: string, path: string, scope: string }>
    search: Array<{
      method: string
      path: string
      scope: string
      body: LibrarySearchRequest
    }>
    counts: Array<{ method: string, path: string, scope: string, body: LibraryCountRequest }>
  }
}

function filters(overrides: Partial<LibraryFilters> = {}): LibraryFilters {
  return {
    query: "",
    gender: null,
    categories: [],
    narrowing_categories: [],
    about_author_ids: [],
    media: [],
    languages: [],
    year_from: null,
    year_to: null,
    ...overrides
  }
}

function selectedChipTitles(document: Document, selector: string) {
  return [...document.querySelectorAll(`${selector} .select2-selection__choice`)]
    .map(chip => chip.getAttribute("title"))
}

function epubRows(document: Document) {
  return [...document.querySelectorAll("[data-library-epub-row]")].map(row => ({
    title: row.querySelector("[data-library-epub-title]")?.textContent?.trim(),
    titleHref: row.querySelector("[data-library-epub-title]")?.getAttribute("href"),
    year: row.querySelector("[data-library-epub-year]")?.textContent?.trim(),
    author: row.querySelector("[data-library-epub-author]")?.textContent?.trim(),
    authorHref: row.querySelector("[data-library-epub-author]")?.getAttribute("href"),
    downloadHref: row.querySelector("[data-library-epub-download]")?.getAttribute("href")
  }))
}

function pdfRows(document: Document) {
  return [...document.querySelectorAll("[data-library-pdf-row]")].map(row => ({
    title: row.querySelector("[data-library-pdf-title]")?.textContent?.trim(),
    titleHref: row.querySelector("[data-library-pdf-title]")?.getAttribute("href"),
    year: row.querySelector("[data-library-pdf-year]")?.textContent?.trim(),
    author: row.querySelector("[data-library-pdf-author]")?.textContent?.trim(),
    authorHref: row.querySelector("[data-library-pdf-author]")?.getAttribute("href"),
    downloadHref: row.querySelector("[data-library-pdf-download]")?.getAttribute("href"),
    download: row.querySelector("[data-library-pdf-download]")?.getAttribute("download"),
    target: row.querySelector("[data-library-pdf-download]")?.getAttribute("target")
  }))
}

test.beforeEach(async ({ request }) => reset(request))

test("SSR renders the default Library slice from typed private options and search", async ({
  request
}) => {
  const response = await request.get("/bibliotek?filter=R%C3%B6da%20rummet&sort=relevans")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.title).toBe("Biblioteket – Titlar och författare | Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe("Blädda bland Litteraturbankens författare och titlar.")
  expect(document.body.className).toBe("focus page-library ready")
  expect(document.documentElement.getAttribute("style"))
    .toContain("/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg")
  expect(document.querySelector("h1")?.textContent?.trim()).toBe("Botanisera i biblioteket")
  expect(document.querySelector<HTMLInputElement>("[data-library-filter]")?.value)
    .toBe("Röda rummet")
  expect([...document.querySelectorAll("[data-library-tab]")].map(node => node.textContent?.trim()))
    .toEqual([
      "Alla träffar", "Nytt", "Författare: 156", "Verk: 3",
      "Dikt, novell, etc.: 0", "Epub: 201", "PDF: 201"
    ])
  expect(document.querySelectorAll("[data-library-result]")).toHaveLength(1)
  expect(document.querySelector('[data-library-result] a[href*="RodaRummet"]')?.textContent?.trim())
    .toBe("Röda rummet")
  expect(document.querySelectorAll("[data-library-highlight]")).toHaveLength(3)
  expect(document.querySelector("[data-library-highlight-hit]")?.textContent).toBe("rummet")
  expect([...document.querySelectorAll("[data-library-highlight-hit]")]
    .map(node => node.textContent)).toContain("Strindberg")
  expect(document.querySelector("[data-library-highlight] script")).toBeNull()
  expect(document.querySelector("[data-library-highlight] img")).toBeNull()
  expect(document.querySelectorAll("[data-library-highlight]")[2]?.textContent)
    .toContain("<script>farligt</script><img src=x>")

  const ledger = await libraryV2Requests(request)
  expect(ledger.options).toEqual([{
    method: "GET",
    path: "/private-v2/library/options",
    scope: "private"
  }])
  expect(ledger.search.map(entry => entry.body)).toEqual([{
    mode: "all",
    filters: filters({ query: "Röda rummet" }),
    sort: "relevance",
    reverse: false,
    page: 1
  }, {
    mode: "authors",
    filters: filters({ query: "Röda rummet" }),
    sort: "popularity",
    reverse: false,
    limit: 150
  }])
  expect(ledger.counts.map(entry => entry.body)).toEqual([
    { mode: "works", filters: filters({ query: "Röda rummet" }) },
    { mode: "parts", filters: filters({ query: "Röda rummet" }) },
    { mode: "epub", filters: filters({ query: "Röda rummet" }) },
    { mode: "pdf", filters: filters({ query: "Röda rummet" }) }
  ])
  expect(ledger.search[0]).toMatchObject({
    method: "POST",
    path: "/private-v2/library/search",
    scope: "private"
  })
  expect(await legacyRelevanceRequests(request)).toEqual([])
  expect(await legacyQueryRequests(request)).toEqual([])
})

test("SSR owns every ordinary Strindberg tab summary under one filter", async ({ request }) => {
  const response = await request.get("/bibliotek?filter=strindberg")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  const tabText = (mode: string) => document
    .querySelector(`[data-library-tab="${mode}"]`)?.textContent?.trim()
  expect(tabText("authors")).toBe("Författare: 7")
  expect(tabText("works")).toBe("Verk: 465")
  expect(tabText("parts")).toBe("Dikt, novell, etc.: 1039")
  expect(tabText("epub")).toBe("Epub: 136")
  expect(tabText("pdf")).toBe("PDF: 265")

  const ledger = await libraryV2Requests(request)
  expect(ledger.search.map(entry => entry.body)).toEqual(expect.arrayContaining([
    { mode: "all", filters: filters({ query: "strindberg" }), sort: "relevance", reverse: false, page: 1 },
    { mode: "authors", filters: filters({ query: "strindberg" }), sort: "popularity", reverse: false, limit: 150 }
  ]))
  expect(ledger.counts.map(entry => entry.body)).toEqual(expect.arrayContaining([
    { mode: "works", filters: filters({ query: "strindberg" }) },
    { mode: "parts", filters: filters({ query: "strindberg" }) },
    { mode: "epub", filters: filters({ query: "strindberg" }) },
    { mode: "pdf", filters: filters({ query: "strindberg" }) }
  ]))
})

test("SSR sends advanced Library filters as one exact typed body", async ({ request }) => {
  const response = await request.get(
    "/bibliotek?filter=R%C3%B6da&sort=forfattare&avancerat=1&k%C3%B6n=female" +
    "&keywords=texttype%3Aroman%2Cprovenance.library%3ASA" +
    "&keywords_aux=keyword%3AHumor%2Ctexttype%3Abrev%3Bbrevsamling" +
    "&about_authors=LagerlofS" +
    "&mediatypes=mediatype%3Aetext%2Chas_epub%3Atrue" +
    "&languages=language%3Aswe%2Cproofread%3Afalse&intervall=1900%2C1910"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector("[data-library-advanced]")?.getAttribute("aria-expanded"))
    .toBe("true")
  expect(document.querySelector<HTMLOptionElement>("[data-library-gender] option[selected]")?.value)
    .toBe("female")
  expect(selectedChipTitles(document, "[data-library-keywords]")).toEqual([
    "Romaner", "Svenska Akademien"
  ])
  expect(selectedChipTitles(document, "[data-library-narrowing]")).toEqual([
    "Humoristiska verk", "Brev"
  ])
  expect(selectedChipTitles(document, "[data-library-about-authors]")).toEqual([
    "Selma Lagerlöf"
  ])
  expect(selectedChipTitles(document, "[data-library-media]")).toEqual(["Etext", "Epub"])
  expect(selectedChipTitles(document, "[data-library-languages]")).toEqual([
    "Svenska", "Ej korrekturläst"
  ])
  expect([...document.querySelectorAll<HTMLInputElement>(
    "[data-library-chronology-range] input[type=range]"
  )].map(input => [input.getAttribute("min"), input.getAttribute("max"), input.value]))
    .toEqual([["1800", "2026", "1900"], ["1800", "2026", "1910"]])

  const searchBodies = (await libraryV2Requests(request)).search.map(entry => entry.body)
  expect(searchBodies).toEqual([{
    mode: "all",
    filters: filters({
      query: "Röda",
      gender: "female",
      categories: ["texttype:roman", "provenance.library:SA"],
      narrowing_categories: ["keyword:Humor", "texttype:brev;brevsamling"],
      about_author_ids: ["LagerlofS"],
      media: ["mediatype:etext", "has_epub:true"],
      languages: ["language:swe", "proofread:false"],
      year_from: 1900,
      year_to: 1910
    }),
    sort: "author",
    reverse: false,
    page: 1
  }, {
    mode: "authors",
    filters: filters({
      query: "Röda",
      gender: "female",
      categories: ["texttype:roman", "provenance.library:SA"],
      narrowing_categories: ["keyword:Humor", "texttype:brev;brevsamling"],
      about_author_ids: ["LagerlofS"],
      media: ["mediatype:etext", "has_epub:true"],
      languages: ["language:swe", "proofread:false"],
      year_from: 1900,
      year_to: 1910
    }),
    sort: "popularity",
    reverse: false,
    limit: 150
  }])
  expect((await libraryV2Requests(request)).search[0]).toMatchObject({
    method: "POST",
    path: "/private-v2/library/search",
    scope: "private"
  })
})

test("SSR keeps chronology available when only about-author options fail", async ({ request }) => {
  await request.put(`${fixture}/_library_v2/failures`, {
    data: { operation: "options", section: "about_authors" }
  })

  const document = parseHTML(await (await request.get(
    "/bibliotek?avancerat=1&intervall=1850%2C1900"
  )).text()).document

  expect(document.querySelector("[data-library-about-authors]")).toBeNull()
  expect(document.querySelector("[data-library-chronology-unavailable]")).toBeNull()
  expect([...document.querySelectorAll<HTMLInputElement>(
    "[data-library-chronology-range] input[type=range]"
  )].map(input => input.value)).toEqual(["1850", "1900"])
  expect((await libraryV2Requests(request)).search[0]?.body.filters).toEqual(filters({
    year_from: 1850,
    year_to: 1900
  }))
})

test("SSR keeps about-author options available when only chronology fails", async ({ request }) => {
  await request.put(`${fixture}/_library_v2/failures`, {
    data: { operation: "options", section: "chronology" }
  })

  const document = parseHTML(await (await request.get(
    "/bibliotek?avancerat=1&about_authors=LagerlofS&intervall=1850%2C1900"
  )).text()).document

  expect(document.querySelector("[data-library-chronology-unavailable]")?.textContent?.trim())
    .toBe("Tidslinjen kunde inte hämtas.")
  expect(document.querySelector("[data-library-chronology-range]")).toBeNull()
  expect(selectedChipTitles(document, "[data-library-about-authors]")).toEqual([
    "Selma Lagerlöf"
  ])
  expect((await libraryV2Requests(request)).search[0]?.body.filters).toEqual(filters({
    about_author_ids: ["LagerlofS"]
  }))
})

test("SSR still renders primary results when all optional metadata is unavailable", async ({
  request
}) => {
  await request.put(`${fixture}/_library_v2/failures`, {
    data: { operation: "options", section: "chronology" }
  })
  await request.put(`${fixture}/_library_v2/failures`, {
    data: { operation: "options", section: "about_authors" }
  })

  const document = parseHTML(await (await request.get("/bibliotek?avancerat=1")).text()).document

  expect(document.querySelectorAll("[data-library-result]")).toHaveLength(3)
  expect(document.querySelector("[data-library-about-authors]")).toBeNull()
  expect(document.querySelector("[data-library-chronology-unavailable]")?.textContent?.trim())
    .toBe("Tidslinjen kunde inte hämtas.")
  expect((await libraryV2Requests(request)).search).toHaveLength(2)
})

test("SSR distinguishes a typed empty success from a typed primary failure", async ({ request }) => {
  const empty = parseHTML(await (await request.get("/bibliotek?filter=inga")).text()).document
  expect(empty.querySelector("[data-library-empty]")?.textContent?.trim()).toBe("Inga träffar.")
  expect(empty.querySelector("[data-library-error]")).toBeNull()
  expect(empty.querySelectorAll("[data-library-result]")).toHaveLength(0)
  expect((await libraryV2Requests(request)).search[0]?.body.filters.query).toBe("inga")

  await reset(request)
  await request.put(`${fixture}/_library_v2/failures`, {
    data: { operation: "search", mode: "all" }
  })
  const failed = parseHTML(await (await request.get("/bibliotek?filter=failed")).text()).document
  expect(failed.querySelector("[data-library-error]")?.textContent?.trim())
    .toBe("Ett fel uppstod.")
  expect(failed.querySelector("[data-library-empty]")).toBeNull()
  expect(failed.querySelectorAll("[data-library-result]")).toHaveLength(0)
  expect((await libraryV2Requests(request)).search.map(entry => entry.body)).toEqual([{
      mode: "all",
      filters: filters({ query: "failed" }),
      sort: "relevance",
      reverse: false,
      page: 1
  }, {
    mode: "authors",
    filters: filters({ query: "failed" }),
    sort: "popularity",
    reverse: false,
    limit: 150
  }])
})

for (const item of libraryImprintYearCases) {
  test(`SSR ${item.mode} imprint year is a stateful first-page chronology link`, async ({
    request
  }) => {
    const document = parseHTML(await (await request.get(item.path)).text()).document
    const link = document.querySelector<HTMLAnchorElement>("[data-library-imprint-year]")

    expect(link?.textContent?.trim()).toBe(item.year)
    const target = new URL(link!.href, "http://litteraturbanken.test")
    expect(target.pathname).toBe("/bibliotek")
    expect(target.searchParams.get("intervall")).toBe(`${item.year},${item.year}`)
    expect(target.searchParams.has("sida")).toBe(false)
    expect(target.searchParams.get("avancerat")).toBe("1")
    expect(target.searchParams.get("kön")).toBe("female")
    expect(target.searchParams.getAll("keep")).toEqual(["one", "two"])
    expect(target.searchParams.get("filter")).toBe(
      item.mode === "all" ? "all-pagination" : null
    )
    expect(target.searchParams.get("visa")).toBe(item.mode === "all" ? null : item.mode)
    expect(target.searchParams.get("sort")).toBe(item.sort)
    expect(target.searchParams.has("hide1800")).toBe(item.mode === "latest")
  })
}

test("SSR leaves author lifespan text inert in the mixed all-results view", async ({ request }) => {
  const document = parseHTML(await (await request.get("/bibliotek?filter=Selma")).text()).document
  const row = document.querySelector("[data-library-result]")

  expect(row?.textContent).toContain("1858–1940")
  expect(row?.querySelector("[data-library-imprint-year]")).toBeNull()
})

test("SSR renders authors, works, parts, and latest from discriminated search responses", async ({
  request
}) => {
  const cases: Array<{
    path: string
    mode: LibrarySearchRequest["mode"]
    selector: string
    text: string
    body: LibrarySearchRequest
  }> = [
    {
      path: "/bibliotek?visa=authors&sort=namn",
      mode: "authors",
      selector: "[data-library-author-row]",
      text: "Söderberg, Hjalmar",
      body: { mode: "authors", filters: filters(), sort: "name", reverse: false, limit: 150 }
    },
    {
      path: "/bibliotek?visa=works&sort=popularitet",
      mode: "works",
      selector: "[data-library-work-row]",
      text: "Doktor Glas",
      body: {
        mode: "works",
        filters: filters(),
        sort: "popularity",
        reverse: false,
        page: 1,
        source_only: false
      }
    },
    {
      path: "/bibliotek?visa=parts&sort=titlar&sida=2",
      mode: "parts",
      selector: "[data-library-part-row]",
      text: "En novell",
      body: { mode: "parts", filters: filters(), sort: "title", reverse: false, page: 2 }
    },
    {
      path: "/bibliotek?visa=latest&hide1800&sida=2",
      mode: "latest",
      selector: "[data-library-latest-row]",
      text: "Doktor Glas",
      body: { mode: "latest", filters: filters(), reverse: false, page: 2, hide_1800: true }
    }
  ]

  for (const item of cases) {
    await reset(request)
    const response = await request.get(item.path)
    expect(response.status(), item.mode).toBe(200)
    const { document } = parseHTML(await response.text())

    expect(document.querySelector(`[data-library-tab="${item.mode}"]`)?.getAttribute("aria-current"), item.mode)
      .toBe("page")
    expect(document.querySelector(item.selector)?.textContent, item.mode).toContain(item.text)
    if (item.mode === "authors") {
      expect(document.querySelector('[data-library-tab="authors"]')?.textContent?.trim())
        .toBe("Författare: 156")
    }
    if (item.mode === "works") {
      expect([...document.querySelector(item.selector)!.querySelectorAll("[data-library-work-actions] a")]
        .map(link => link.textContent?.trim())).toEqual([
          "Läs som etext", "Läs som faksimil", "Ladda ner epub", "Ladda ner pdf",
          "Gör en sökning i verket", "Läs mer om verket"
        ])
    }
    if (item.mode === "latest") {
      expect(document.querySelector("[data-library-latest-header]")?.textContent?.trim())
        .toBe("18 juli 2026 (3 verk)")
    }

    const searchBodies = (await libraryV2Requests(request)).search.map(entry => entry.body)
    expect(searchBodies).toContainEqual(item.body)
    expect(searchBodies).toContainEqual({
      mode: "authors", filters: filters(), sort: "popularity", reverse: false, limit: 150
    })
  }
})

test("download mode forces typed Works source-only search without changing its shell", async ({
  request
}) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=pdf&nedladdning=1"
  )).text()).document

  expect(document.querySelector(".dl_mode")).not.toBeNull()
  expect(document.querySelector('[data-library-tab="works"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(document.querySelectorAll("[data-library-source-checkbox]")).toHaveLength(3)
  expect((await libraryV2Requests(request)).search[0]?.body).toEqual({
    mode: "works",
    filters: filters(),
    sort: "popularity",
    reverse: false,
    page: 1,
    source_only: true
  })
})

test("SSR renders EPUB immediately with a null inactive PDF count", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=epub&sort=popularitet&filter=Selma"
  )).text()).document

  expect(document.querySelector('[data-library-tab="epub"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect([...document.querySelectorAll("[data-library-tab]")].map(node => node.textContent?.trim()))
    .toEqual([
      "Alla träffar", "Nytt", "Författare: 1", "Verk: 1",
      "Dikt, novell, etc.: 0", "Epub: 1", "PDF: 1"
    ])
  expect(epubRows(document)).toEqual([{
    title: "Gösta Berlings saga",
    titleHref: "/f%C3%B6rfattare/LagerlofS/titlar/GostaBerlingsSaga/etext?om-boken",
    year: "1891",
    author: "Lagerlöf",
    authorHref: "/f%C3%B6rfattare/LagerlofS",
    downloadHref: "/txt/epub/LagerlofS_GostaBerlingsSaga.epub"
  }])
  const row = document.querySelector("[data-library-epub-row]")
  expect(row?.querySelector('[data-library-tooltip-kind="title"]')
    ?.getAttribute("data-library-tooltip-content")).toBe("Gösta Berlings saga. Roman")
  expect(row?.querySelector('[data-library-tooltip-kind="author"]')
    ?.getAttribute("data-library-tooltip-content")).toBe("Selma Lagerlöf (1858-1940)")
  expect(document.querySelector('[role="tooltip"]')).toBeNull()
  expect((await libraryV2Requests(request)).search[0]?.body).toEqual({
    mode: "epub",
    filters: filters({ query: "Selma" }),
    sort: "popularity",
    reverse: false,
    page: 1
  })
  expect(await legacyQueryRequests(request)).toEqual([])
})

test("SSR renders PDF immediately with a null inactive EPUB count", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=pdf&sort=kronologi&sida=2"
  )).text()).document

  expect(document.querySelector('[data-library-tab="pdf"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(document.querySelector('[data-library-tab="epub"]')?.textContent?.trim()).toBe("Epub: 201")
  expect(document.querySelector('[data-library-tab="pdf"]')?.textContent?.trim()).toBe("PDF: 201")
  expect(pdfRows(document)).toEqual([{
    title: "Doktor Glas",
    titleHref: "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/faksimil?om-boken",
    year: "1905",
    author: "Söderberg",
    authorHref: "/f%C3%B6rfattare/S%C3%B6derbergH",
    downloadHref: "/export/faksimil/lb-DoktorGlas.pdf",
    download: "SöderbergH_DoktorGlas.pdf",
    target: "_self"
  }])
  expect((await libraryV2Requests(request)).search[0]?.body).toEqual({
    mode: "pdf",
    filters: filters(),
    sort: "chronology",
    reverse: false,
    page: 2
  })
  expect(await legacyQueryRequests(request)).toEqual([])
})

test("standalone EPUB keeps its shell and uses the same typed primary owner", async ({ request }) => {
  const document = parseHTML(await (await request.get("/epub")).text()).document

  expect(document.title).toBe("E-böcker för nedladdning | Litteraturbanken")
  expect(document.body.className).toBe("focus page-epub ready")
  expect(document.documentElement.getAttribute("style")).toContain("background-image:none")
  expect(document.querySelector("h1")?.textContent?.trim()).toBe("Hämta e-böcker")
  expect([...document.querySelectorAll("[data-library-tab]")].map(tab => tab.textContent?.trim()))
    .toEqual(["Epub: 201", "PDF"])
  expect(epubRows(document)).toHaveLength(3)
  expect((await libraryV2Requests(request)).search[0]?.body).toEqual({
    mode: "epub",
    filters: filters(),
    sort: "popularity",
    reverse: false,
    page: 1
  })
  expect(await legacyRelevanceRequests(request)).toEqual([])
  expect(await legacyQueryRequests(request)).toEqual([])
})

test("SSR maps supported relevance and download sort routes to typed enums", async ({ request }) => {
  const cases: Array<{ path: string, body: LibrarySearchRequest }> = [
    {
      path: "/bibliotek?sort=relevans",
      body: { mode: "all", filters: filters(), sort: "relevance", reverse: false, page: 1 }
    },
    {
      path: "/bibliotek?sort=forfattare",
      body: { mode: "all", filters: filters(), sort: "author", reverse: false, page: 1 }
    },
    {
      path: "/bibliotek?sort=titlar",
      body: { mode: "all", filters: filters(), sort: "title", reverse: false, page: 1 }
    },
    {
      path: "/bibliotek?sort=kronologi",
      body: { mode: "all", filters: filters(), sort: "chronology", reverse: false, page: 1 }
    },
    {
      path: "/bibliotek?visa=epub&sort=forfattare",
      body: {
        mode: "epub", filters: filters(), sort: "author", reverse: false, page: 1
      }
    },
    {
      path: "/bibliotek?visa=epub&sort=titlar",
      body: { mode: "epub", filters: filters(), sort: "title", reverse: false, page: 1 }
    },
    {
      path: "/bibliotek?visa=pdf&sort=popularitet",
      body: {
        mode: "pdf", filters: filters(), sort: "popularity", reverse: false, page: 1
      }
    },
    {
      path: "/bibliotek?visa=pdf&sort=kronologi",
      body: {
        mode: "pdf", filters: filters(), sort: "chronology", reverse: false, page: 1
      }
    }
  ]

  for (const item of cases) {
    await reset(request)
    expect((await request.get(item.path)).status()).toBe(200)
    expect((await libraryV2Requests(request)).search[0]?.body).toEqual(item.body)
  }
})

test("SSR normalizes unsupported sorts and pages outside the typed boundary", async ({ request }) => {
  for (const page of ["saknas", "0", "-2", "1.5", "101"]) {
    await reset(request)
    const response = await request.get(
      `/bibliotek?visa=pdf&sort=saknas&sida=${page}&keep=ja`
    )
    expect(response.status(), page).toBe(200)
    expect((await libraryV2Requests(request)).search[0]?.body, page).toEqual({
      mode: "pdf",
      filters: filters(),
      sort: "popularity",
      reverse: false,
      page: 1
    })
  }
})

test("SSR preserves repeated query keys in typed pagination hrefs", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?keep&keep=ja&visa=epub&filter=paged&sort=popularitet&sida=2"
  )).text()).document

  expect(document.querySelector('[data-library-page="2"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(document.querySelector('[data-library-page="1"]')?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&visa=epub&filter=paged&sort=popularitet&sida=1")
  expect(document.querySelector("[data-library-pagination-previous]")?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&visa=epub&filter=paged&sort=popularitet&sida=1")
  expect(document.querySelector("[data-library-pagination-next]")?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&visa=epub&filter=paged&sort=popularitet&sida=3")
  expect(document.querySelector('[data-library-sort="titlar"]')?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&visa=epub&filter=paged&sort=titlar&sida=1")
  expect((await libraryV2Requests(request)).search[0]?.body).toEqual({
    mode: "epub",
    filters: filters({ query: "paged" }),
    sort: "popularity",
    reverse: false,
    page: 2
  })
})

test("SSR renders and requests the second all-results page with preserved query keys", async ({
  request
}) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?keep&keep=ja&filter=all-pagination&sida=2"
  )).text()).document

  expect(document.querySelectorAll("[data-library-result]")).toHaveLength(1)
  expect(document.querySelector("[data-library-result]")?.textContent)
    .toContain("Den unika träffen på sida två")
  expect(document.querySelector('[data-library-page="2"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(document.querySelector('[data-library-page="1"]')?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&filter=all-pagination&sida=1")
  expect(document.querySelector("[data-library-pagination-previous]")?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&filter=all-pagination&sida=1")
  expect(document.querySelector("[data-library-pagination-next]")?.getAttribute("aria-disabled"))
    .toBe("true")
  expect((await libraryV2Requests(request)).search[0]?.body).toEqual({
    mode: "all",
    filters: filters({ query: "all-pagination" }),
    sort: "relevance",
    reverse: false,
    page: 2
  })
})

test("SSR canonicalizes all-results pages against response hits and preserves query keys", async ({
  request
}) => {
  const response = await request.get(
    "/bibliotek?keep&keep=ja&filter=all-pagination&sida=100"
  )
  const document = parseHTML(await response.text()).document
  const url = new URL(response.url())

  expect(url.pathname).toBe("/bibliotek")
  expect(url.searchParams.getAll("keep")).toEqual(["", "ja"])
  expect(url.searchParams.get("filter")).toBe("all-pagination")
  expect(url.searchParams.get("sida")).toBe("2")
  expect(document.querySelectorAll("[data-library-result]")).toHaveLength(1)
  expect(document.querySelector("[data-library-result]")?.textContent)
    .toContain("Den unika träffen på sida två")
  expect(document.querySelector('[data-library-page="2"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect((await libraryV2Requests(request)).search
    .filter(entry => entry.body.mode === "all")
    .map(entry => entry.body.page)).toEqual([100, 2])
})

test("SSR canonicalizes empty and out-of-schema all-results pages without redirect loops", async ({
  request
}) => {
  for (const { filter, page, expectedPages } of [
    { filter: "inga", page: 2, expectedPages: [2, 1] },
    { filter: "all-pagination", page: 0, expectedPages: [1, 1] },
    { filter: "all-pagination", page: 101, expectedPages: [1, 1] }
  ]) {
    await reset(request)
    const response = await request.get(
      `/bibliotek?keep=ja&filter=${filter}&sida=${page}`
    )
    const url = new URL(response.url())

    expect(url.pathname).toBe("/bibliotek")
    expect(url.searchParams.get("keep")).toBe("ja")
    expect(url.searchParams.get("filter")).toBe(filter)
    expect(url.searchParams.has("sida")).toBe(false)
    expect((await libraryV2Requests(request)).search
      .filter(entry => entry.body.mode === "all")
      .map(entry => entry.body.page)).toEqual(expectedPages)
  }
})

test("SSR caps rendered pagination at the v2 page maximum", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=pdf&filter=bounded&sort=popularitet&sida=100"
  )).text()).document

  expect(document.querySelector('[data-library-page="100"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(document.querySelector('[data-library-page="101"]')).toBeNull()
  expect(document.querySelector("[data-library-pagination-next]")?.getAttribute("aria-disabled"))
    .toBe("true")
  expect((await libraryV2Requests(request)).search[0]?.body).toEqual({
    mode: "pdf",
    filters: filters({ query: "bounded" }),
    sort: "popularity",
    reverse: false,
    page: 100
  })
})

test("standalone EPUB defaults unsupported mode, sort, and page values", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/epub?visa=unsupported&sort=saknas&sida=101"
  )).text()).document

  expect(document.querySelector('[data-library-tab="epub"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(epubRows(document)).toHaveLength(3)
  expect((await libraryV2Requests(request)).search[0]?.body).toEqual({
    mode: "epub",
    filters: filters(),
    sort: "popularity",
    reverse: false,
    page: 1
  })
})

test("Library route aliases preserve supported query bytes", async ({ request }) => {
  const redirect = await request.get(
    "/titlar?visa=works&keywords=texttype%3Aroman&keep=ja",
    { maxRedirects: 0 }
  )
  expect(redirect.status()).toBe(308)
  expect(redirect.headers().location)
    .toBe("/bibliotek?visa=works&keywords=texttype:roman&keep=ja")
})
