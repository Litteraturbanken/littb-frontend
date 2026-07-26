import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Request, type Route } from "@playwright/test"

import {
  libraryPartsResponse,
  libraryQueryPageOneResponse,
  libraryWorksResponse
} from "../fixtures/library-query-data.mjs"
import { libraryDefaultResults } from "../fixtures/library-relevance-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = `http://127.0.0.1:${process.env.LITTB_ANGULAR_LIBRARY_PORT || 9000}`
const queryPath = "/api/query_string/etext,faksimil,pdf"
const relevancePath = "/api/relevance/etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress"
const allowedShellDocuments = new Set([
  `${authorityOrigin}/bibliotek?visa=epub&sort=popularitet`,
  `${authorityOrigin}/bibliotek?avancerat=1`,
  `${authorityOrigin}/bibliotek?avancerat=1&nedladdning=1`,
  `${authorityOrigin}/epub?visa=epub&sort=popularitet`
])
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const epubInclude = "lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain,main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type,work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword"
const partsInclude = "lbworkid,titlepath,title,titleid,work_titleid,shorttitle,mediatype,searchable,sort_date_imprint.plain,main_author.authorid,main_author.surname,main_author.type,startpagename,sort_date.plain,export,authors,work_authors"
const expectedActiveQuery = {
  author_aggregation: "true",
  exclude: "text,parts,sourcedesc,pages,errata",
  from: "0",
  imported_aggregation: "false",
  include: epubInclude,
  partial_string: "true",
  q: "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian (has_epub:true)",
  sort_field: "popularity|desc",
  suggest: "true",
  to: "100"
}
const expectedDownloadQuery = {
  author_aggregation: "true",
  exclude: "text,parts,sourcedesc,pages,errata",
  from: "0",
  imported_aggregation: "false",
  include: epubInclude,
  partial_string: "true",
  q: "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian (export>type:(xml OR txt OR workdb))",
  sort_field: "popularity|desc",
  suggest: "true",
  to: "100"
}
const expectedRelevanceQuery = {
  exclude: "text,parts,sourcedesc,pages,errata,intro,workintro,content,article.ArticleText,works,intro_text,bibliography_types,wikidata.wikipedia_text,content_vector",
  from: "0",
  q: "",
  show_all: "false",
  sid: "true",
  sort_field: "_score|desc",
  to: "100",
  vectorize: "true"
}
const expectedInactiveMainQueries = [
  {
    author_aggregation: "true",
    exclude: "text,parts,sourcedesc,pages,errata",
    from: "0",
    imported_aggregation: "false",
    include: epubInclude,
    partial_string: "true",
    q: "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian *",
    sort_field: "popularity|desc",
    suggest: "true",
    to: "0"
  },
  {
    author_aggregation: "true",
    exclude: "text,parts,sourcedesc,pages,errata",
    from: "0",
    imported_aggregation: "false",
    include: epubInclude,
    partial_string: "true",
    q: "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian (has_epub:true)",
    sort_field: "popularity|desc",
    suggest: "true",
    to: "0"
  },
  {
    author_aggregation: "true",
    exclude: "text,parts,sourcedesc,pages,errata",
    from: "0",
    imported_aggregation: "false",
    include: epubInclude,
    partial_string: "true",
    pdfOnly: "true",
    q: "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian (((export>type:pdf AND license:pd) OR mediatype:pdf))",
    sort_field: "popularity|desc",
    suggest: "true",
    to: "0"
  }
]
const expectedInactivePartsQuery = {
  author_aggregation: "true",
  exclude: "text,parts,sourcedesc,pages,errata",
  from: "0",
  include: partsInclude,
  partial_string: "true",
  q: "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian *",
  sort_field: "sortkey|asc",
  suggest: "true",
  to: "0"
}

type Ledger = {
  activeQueries: string[]
  allowedShellRequests: string[]
  backgroundRequests: string[]
  bootstrapRequests: string[]
  countQueries: string[]
  problems: string[]
  unexpected: string[]
}

function sortedQuery(url: URL) {
  return Object.fromEntries(
    [...url.searchParams.entries()].sort(([left], [right]) => left.localeCompare(right))
  )
}

function label(route: Route) {
  return `${route.request().method()} ${route.request().url()}`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isAllowedShellRequest(request: Request, url: URL) {
  if (request.method() !== "GET" || url.origin !== authorityOrigin) {
    return false
  }
  if (allowedShellDocuments.has(url.toString())) {
    return true
  }
  if (["/@vite/client", "/main.js"].includes(url.pathname)) {
    return true
  }
  return [
    "/@fs/",
    "/@id/",
    "/node_modules/.vite/",
    "/lib/",
    "/scripts/",
    "/styles/",
    "/views/",
    "/img/",
    "/assets/"
  ].some(prefix => url.pathname.startsWith(prefix))
}

async function routeAuthorityRequest(
  route: Route,
  ledger: Ledger,
  fixtures: {
    authorityFonts: Buffer
    libraryBackground: Buffer
    populatedCounts?: boolean
    standaloneBackground: Buffer
  }
) {
  const request = route.request()
  const url = new URL(request.url())
  const requestLabel = label(route)

  if (request.method() === "GET" && url.origin === authorityOrigin && url.pathname === queryPath) {
    const query = sortedQuery(url)
    if (JSON.stringify(query) === JSON.stringify(expectedDownloadQuery)) {
      ledger.activeQueries.push(requestLabel)
      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          ...libraryWorksResponse,
          author_aggregation: [
            { authorid: "SöderbergH" },
            { authorid: "GeijerEGA" },
            { authorid: "BauerJ" }
          ],
          imported_aggregation: []
        })
      })
    }
    if (JSON.stringify(query) === JSON.stringify(expectedActiveQuery)) {
      ledger.activeQueries.push(requestLabel)
      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(libraryQueryPageOneResponse)
      })
    }
    const inactiveMainQueryIndex = expectedInactiveMainQueries.findIndex(expected =>
      JSON.stringify(query) === JSON.stringify(expected)
    )
    if (inactiveMainQueryIndex >= 0) {
      ledger.countQueries.push(requestLabel)
      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(fixtures.populatedCounts && inactiveMainQueryIndex === 0
          ? {
              ...libraryWorksResponse,
              data: [],
              author_aggregation: [
                { authorid: "SöderbergH" },
                { authorid: "GeijerEGA" },
                { authorid: "BauerJ" }
              ]
            }
          : { data: [], hits: 0, distinct_hits: 0, suggest: [], author_aggregation: [] })
      })
    }
    ledger.unexpected.push(requestLabel)
    return route.abort("blockedbyclient")
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === relevancePath) {
    const query = sortedQuery(url)
    if (JSON.stringify(query) === JSON.stringify(expectedRelevanceQuery)) {
      ledger.activeQueries.push(requestLabel)
      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ data: libraryDefaultResults, hits: 3, suggest: [] })
      })
    }
    ledger.unexpected.push(requestLabel)
    return route.abort("blockedbyclient")
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/api/query_string/etext-part,faksimil-part"
    && JSON.stringify(sortedQuery(url)) === JSON.stringify(expectedInactivePartsQuery)) {
    ledger.countQueries.push(requestLabel)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(fixtures.populatedCounts
        ? { ...libraryPartsResponse, data: [] }
        : { data: [], hits: 0, distinct_hits: 0, suggest: [], author_aggregation: [] })
    })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/api/get_authors"
    && JSON.stringify(sortedQuery(url)) === JSON.stringify({ exclude: authorExclude })) {
    ledger.bootstrapRequests.push(requestLabel)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        data: [
          ...libraryQueryPageOneResponse.data.map(item => item.main_author),
          ...(fixtures.populatedCounts
            ? [{ authorid: "PoetP", full_name: "P. Poet", surname: "Poet" }]
            : [])
        ]
      })
    })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/api/get_authorkeywords" && url.search === "") {
    ledger.bootstrapRequests.push(requestLabel)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: "[]"
    })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/api/list_all/author"
    && JSON.stringify(sortedQuery(url)) === JSON.stringify({
      filter_string: "",
      suggest: "true",
      to: "0"
    })) {
    ledger.bootstrapRequests.push(requestLabel)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ data: [], hits: 0, suggest: [] })
    })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/api/imprint_range" && url.search === "") {
    ledger.bootstrapRequests.push(requestLabel)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        start_year: { value_as_string: "1800" },
        end_year: { value_as_string: "2026" }
      })
    })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname.startsWith("/api/log_library/") && url.search === "") {
    ledger.bootstrapRequests.push(requestLabel)
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg") {
    ledger.backgroundRequests.push(requestLabel)
    return route.fulfill({ status: 200, contentType: "image/jpeg", body: fixtures.libraryBackground })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/red/bilder/bakgrundsbilder/ljudlandskap.jpg") {
    ledger.backgroundRequests.push(requestLabel)
    return route.fulfill({ status: 200, contentType: "image/jpeg", body: fixtures.standaloneBackground })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml"
    && JSON.stringify([...url.searchParams.entries()]) === JSON.stringify([["username", "app"]])) {
    ledger.bootstrapRequests.push(requestLabel)
    return route.fulfill({
      status: 200,
      contentType: "application/xml; charset=utf-8",
      body: "<backgrounds />"
    })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/red/css/etext.css" && url.search === "") {
    ledger.bootstrapRequests.push(requestLabel)
    return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" })
  }
  if (request.method() === "GET" && url.hostname === "cloud.typography.com") {
    ledger.bootstrapRequests.push(requestLabel)
    return route.fulfill({
      status: 200,
      contentType: "text/css; charset=utf-8",
      body: fixtures.authorityFonts
    })
  }
  if (request.method() === "GET" && url.hostname === "www.googletagmanager.com") {
    ledger.bootstrapRequests.push(requestLabel)
    return route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: "" })
  }
  if (isAllowedShellRequest(request, url)) {
    ledger.allowedShellRequests.push(requestLabel)
    return route.continue()
  }
  ledger.unexpected.push(requestLabel)
  return route.abort("blockedbyclient")
}

for (const visualCase of [
  {
    name: "library-epub",
    route: "/bibliotek?visa=epub&sort=popularitet",
    bodyClass: "page-library",
    heading: "Botanisera i biblioteket",
    tabs: ["Alla träffar", "Nytt", "Författare", "Verk", "Dikt, novell, etc.", "Epub", "PDF"],
    background: /biblioteket_bakgrund\.jpg/
  },
  {
    name: "standalone-epub",
    route: "/epub?visa=epub&sort=popularitet",
    bodyClass: "page-epub",
    heading: "Hämta e-böcker",
    tabs: ["Epub", "PDF"],
    background: "none"
  }
] as const) {
  test(`captures the canonical Angular ${visualCase.name} authority`, async ({ browser, page }, testInfo) => {
    const [authorityFonts, libraryBackground, standaloneBackground] = await Promise.all([
      readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
      readFile(resolve(import.meta.dirname, "../fixtures/library-content/biblioteket_bakgrund.jpg")),
      readFile(resolve(import.meta.dirname, "../fixtures/library-content/ljudlandskap.jpg"))
    ])
    const ledger: Ledger = {
      activeQueries: [],
      allowedShellRequests: [],
      backgroundRequests: [],
      bootstrapRequests: [],
      countQueries: [],
      problems: [],
      unexpected: []
    }

    const probeLedger: Ledger = {
      activeQueries: [],
      allowedShellRequests: [],
      backgroundRequests: [],
      bootstrapRequests: [],
      countQueries: [],
      problems: [],
      unexpected: []
    }
    const probePage = await browser.newPage()
    await probePage.route("**/*", route => routeAuthorityRequest(route, probeLedger, {
      authorityFonts,
      libraryBackground,
      standaloneBackground
    }))
    const mutatedCountUrl = new URL(queryPath, authorityOrigin)
    mutatedCountUrl.searchParams.set("from", "0")
    mutatedCountUrl.searchParams.set("to", "0")
    mutatedCountUrl.searchParams.set("q", "mutated-authority-probe")
    await probePage.goto(`${authorityOrigin}/data.json`).catch(() => null)
    await probePage.goto(mutatedCountUrl.toString()).catch(() => null)
    await probePage.close()

    page.on("pageerror", error => ledger.problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) {
        ledger.problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })
    await page.route("**/*", route => routeAuthorityRequest(route, ledger, {
      authorityFonts,
      libraryBackground,
      standaloneBackground
    }))

    const response = await page.goto(visualCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect.poll(async () => ({
      readyBodies: await page.locator(`body.focus.${visualCase.bodyClass}.ready`).count(),
      unexpected: ledger.unexpected
    })).toEqual({ readyBodies: 1, unexpected: [] })
    await expect(page.getByRole("heading", { name: visualCase.heading, exact: true })).toBeVisible()
    const visibleTabs = page.locator("#controls .btn-group > button:visible")
    await expect(visibleTabs).toHaveCount(visualCase.tabs.length)
    for (const tab of visualCase.tabs) {
      await expect(visibleTabs.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(tab)}`) }))
        .toHaveCount(1)
    }
    await expect(page.locator("#controls .btn-group > button.active")).toContainText("Epub")
    await expect.poll(() => ledger.unexpected).toEqual([])
    await expect(page.locator(".work_link")).toHaveCount(libraryQueryPageOneResponse.data.length)
    await expect(page.getByRole("link", { name: "Hämta", exact: true })).toHaveCount(
      libraryQueryPageOneResponse.data.length
    )
    await expect.poll(() => page.locator(".more_container").evaluateAll(elements =>
      elements.every(element => getComputedStyle(element).display === "none")
    )).toBe(true)
    await waitForVisualAssets(page)
    await expect(page.locator("html")).toHaveCSS("background-image", visualCase.background)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    expect(ledger.activeQueries).toHaveLength(1)
    expect(ledger.allowedShellRequests.some(request => request.includes(visualCase.route.split("?")[0])))
      .toBe(true)
    expect(ledger.allowedShellRequests.some(request => request.includes("/main.js"))).toBe(true)
    expect(ledger.countQueries.length).toBe(visualCase.name === "library-epub" ? 3 : 1)
    expect(ledger.unexpected).toEqual([])
    expect(ledger.problems).toEqual([])
    expect(probeLedger.unexpected).toEqual([
      `GET ${authorityOrigin}/data.json`,
      `GET ${mutatedCountUrl.toString()}`
    ])
    expect(probeLedger.countQueries).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.screenshot({
      path: resolve(directory, `${visualCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })

    expect(ledger.unexpected).toEqual([])
    expect(ledger.problems).toEqual([])
  })
}

for (const visualCase of [
  {
    name: "library-advanced",
    route: "/bibliotek?avancerat=1",
    activeTab: "Alla träffar",
    visibleTabs: 7,
    download: false
  },
  {
    name: "library-download",
    route: "/bibliotek?avancerat=1",
    activeTab: "Verk",
    visibleTabs: 4,
    download: true
  }
] as const) {
  test(`captures the canonical Angular ${visualCase.name} authority`, async ({ page }, testInfo) => {
    const [authorityFonts, libraryBackground, standaloneBackground] = await Promise.all([
      readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
      readFile(resolve(import.meta.dirname, "../fixtures/library-content/biblioteket_bakgrund.jpg")),
      readFile(resolve(import.meta.dirname, "../fixtures/library-content/ljudlandskap.jpg"))
    ])
    const ledger: Ledger = {
      activeQueries: [],
      allowedShellRequests: [],
      backgroundRequests: [],
      bootstrapRequests: [],
      countQueries: [],
      problems: [],
      unexpected: []
    }
    page.on("pageerror", error => ledger.problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) {
        ledger.problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })
    await page.route("**/*", route => routeAuthorityRequest(route, ledger, {
      authorityFonts,
      libraryBackground,
      populatedCounts: true,
      standaloneBackground
    }))

    const response = await page.goto(visualCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect.poll(async () => ({
      readyBodies: await page.locator("body.focus.page-library.ready").count(),
      unexpected: ledger.unexpected
    })).toEqual({ readyBodies: 1, unexpected: [] })
    await expect(page.locator("#controls .more_container.show_more").first()).toBeVisible()
    if (visualCase.download) {
      await page.getByText("Ladda ner källmaterial", { exact: true }).click()
    }
    const visibleTabs = page.locator("#controls .btn-group > button:visible")
    await expect(visibleTabs).toHaveCount(visualCase.visibleTabs)
    await expect(page.locator("#controls .btn-group > button.active"))
      .toContainText(visualCase.activeTab)

    if (visualCase.download) {
      await expect(page.locator(".work_link")).toHaveCount(3)
      await page.getByText("Välj alla verk i listan", { exact: true }).click()
      await expect(page.locator(".download_item")).toHaveCount(3)
      await page.getByRole("button", { name: /Välj format/ }).click()
      await expect(page.locator(".popover")).toBeVisible()
    } else {
      await expect(page.locator(".result.relevance tr")).toHaveCount(3)
    }

    await page.waitForLoadState("networkidle")
    await expect(page.locator(".spinner:visible")).toHaveCount(0)
    await page.evaluate(() => new Promise<void>(resolveFrame => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
    }))

    await waitForVisualAssets(page)
    await expect(page.locator("html")).toHaveCSS(
      "background-image",
      /biblioteket_bakgrund\.jpg/
    )
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    expect(ledger.activeQueries).toHaveLength(visualCase.download ? 2 : 1)
    expect(ledger.countQueries).toHaveLength(4)
    expect(ledger.unexpected).toEqual([])
    expect(ledger.problems.filter(problem =>
      problem !== "console warning: Sort state init failed all popularitet"
    )).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.screenshot({
      path: resolve(directory, `${visualCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })
  })
}
