import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Request, type Route } from "@playwright/test"

import {
  readerPageHtmlByIndex,
  readerWorkInfoResponse,
  sharedReaderCss,
  workReaderCss
} from "../fixtures/reader-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9000"
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const allowedShellDocuments = [
  `${authorityOrigin}${readerPath}`,
  `${authorityOrigin}${readerPath}?s_query=glas&s_lbworkid=lb-reader-doktor-glas&s_mediatype=etext&s_word_form_only=true&hit_index=0`,
  `${authorityOrigin}${readerPath}?s_query=doktor%20glas&s_lbworkid=lb-reader-doktor-glas&s_mediatype=etext&s_word_form_only=true&hit_index=1`
].map(value => new URL(value))

const frontendRoot = resolve(import.meta.dirname, "../../..")
const fsRoot = `/@fs${frontendRoot}`
const allowedShellStaticRequests = new Set([
  `${fsRoot}/node_modules/.vite/deps/angular-animate.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-aria.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-route.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-spinner.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-touch.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_buttons.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_collapse.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_dropdown.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_modal.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_pagination.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_popover.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_tooltip.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-bootstrap_src_typeahead.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular-ui-select2_src_select2__js.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angular.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/angularjs-slider.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/bodybuilder.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-43VAUSZK.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-MSAYGMWU.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-NMJR4R66.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-O2IEGSCI.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-SX436VLB.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-UIMFB7KA.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/chunk-ZLALJZVY.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/jquery.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/lodash.js?v=d83e272d`,
  `${fsRoot}/node_modules/.vite/deps/underscore__string.js?v=d83e272d`,
  `${fsRoot}/node_modules/angular-ui-bootstrap/src/position/position.css`,
  `${fsRoot}/node_modules/angular-ui-bootstrap/src/tooltip/tooltip.css`,
  `${fsRoot}/node_modules/angular-ui-bootstrap/src/typeahead/typeahead.css`,
  `${fsRoot}/node_modules/angularjs-slider/dist/rzslider.css`,
  `${fsRoot}/node_modules/font-awesome/fonts/fontawesome-webfont.woff2?v=4.4.0`,
  `${fsRoot}/node_modules/font-awesome/scss/font-awesome.scss`,
  `${fsRoot}/node_modules/select2/dist/css/select2.css`,
  `${fsRoot}/node_modules/vite/dist/client/env.mjs`,
  "/@vite/client",
  "/img/SA_logo_type.svg",
  "/img/SA_logo_type.svg?import&url",
  "/img/dramawebben_svart.svg?import&url",
  "/img/lb_logga_nyavagar_2.2021.svg?import&url",
  "/lib/FileSaver.js",
  "/lib/angular-ellipsis.js",
  "/lib/angular-locale_sv-se.js",
  "/lib/jquery.ui.position.js",
  "/lib/select2.js",
  "/main.js",
  "/scripts/app.js",
  "/scripts/components/about-page/index.js",
  "/scripts/components/author-info-page/index.js",
  "/scripts/components/autocomplete-global/index.js",
  "/scripts/components/contact-form/index.js",
  "/scripts/components/help-page/index.js",
  "/scripts/components/history-page/index.js",
  "/scripts/components/id-page/index.js",
  "/scripts/components/lexicon-global/index.js",
  "/scripts/components/library/downloadPopover.html?import&url",
  "/scripts/components/library/library.html?import&url",
  "/scripts/components/library/works_list.html?import&url",
  "/scripts/components/page-start/index.js",
  "/scripts/components/presentations-page/index.js",
  "/scripts/components/reader/reader.html?import&raw",
  "/scripts/components/reader/reader.scss",
  "/scripts/components/reader/readingModule.js",
  "/scripts/components/reader/reading_controller.js",
  "/scripts/components/search/template.html?import&url",
  "/scripts/components/sla-biblinfo/index.js",
  "/scripts/components/sla-omtexterna/index.js",
  "/scripts/components/stats-page/index.js",
  "/scripts/controllers.js",
  "/scripts/directives.js",
  "/scripts/dramaweb_controller.js",
  "/scripts/features/stats/popularWorks.mjs",
  "/scripts/library_controller.js",
  "/scripts/query.ts",
  "/scripts/search_controller.js",
  "/scripts/services.js",
  "/scripts/services/backend.js",
  "/scripts/util.js",
  "/styles/bootstrap.scss",
  "/styles/styles.scss",
  "/styles/tailwind.css",
  "/views/about.html?import&url",
  "/views/authorInfo.html?import&url",
  "/views/contactForm.html?import&url",
  "/views/dramaweb.html?import&url",
  "/views/help.html?import&url",
  "/views/id.html?import&url",
  "/views/presentations.html?import&url",
  "/views/search.html?import&url",
  "/views/sla/biblinfo.html?import&url",
  "/views/sourceInfo.html?import&url",
  "/views/start.html?import&raw",
  "/views/stats.html?import&url"
])

const legacyWork = (() => {
  const frozen = readerWorkInfoResponse.data[0]!
  const author = {
    authorid: "SöderbergH",
    authorid_norm: "SoderbergH",
    full_name: "Hjalmar Söderberg",
    surname: "Söderberg",
    searchable: true
  }
  return {
    ...frozen,
    titleid: "DoktorGlas",
    work_titleid: "DoktorGlas",
    endpagename: "-1",
    page_count: 3,
    pagestep: 1,
    pages: frozen.pages.map(page => ({ ...page, imagenumber: page.pageindex })),
    parts: [{
      startpagename: "-3",
      endpagename: "-1",
      title: "Doktor Glas",
      navtitle: "Doktor Glas",
      shorttitle: "Doktor Glas",
      authors: [{ authorid: author.authorid }]
    }],
    authors: [author],
    main_author: author,
    work_authors: [author],
    export: [],
    errata: "<table></table>",
    sourcedesc: "",
    mediatypes: ["etext"],
    searchable: true,
    keyword: [],
    texttype: "prose"
  }
})()

const phraseHits = [
  { order: 0, highlights: [{ ix: 1, n: "-3", wid: "w1_1" }] },
  { order: 1, highlights: [
    { ix: 2, n: "-2", wid: "w2_1" },
    { ix: 2, n: "-2", wid: "w2_2" }
  ] },
  { order: 2, highlights: [{ ix: 2, n: "-2", wid: "w2_2" }] },
  { order: 3, highlights: [{ ix: 3, n: "-1", wid: "w3_1" }] },
  { order: 4, highlights: [{ ix: 3, n: "-1", wid: "w3_2" }] }
]

const transparentPixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
)

type Ledger = {
  authors: string[]
  background: string[]
  fonts: string[]
  gtm: string[]
  ornament: string[]
  pages: string[]
  problems: string[]
  search: string[]
  shell: string[]
  styles: string[]
  unexpected: string[]
  work: string[]
}

function emptyLedger(): Ledger {
  return {
    authors: [],
    background: [],
    fonts: [],
    gtm: [],
    ornament: [],
    pages: [],
    problems: [],
    search: [],
    shell: [],
    styles: [],
    unexpected: [],
    work: []
  }
}

function requestLabel(route: Route) {
  return `${route.request().method()} ${route.request().url()}`
}

function sortedQueryEntries(entries: Iterable<[string, string]>) {
  return [...entries].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
  )
}

function queryEquals(url: URL, expected: Record<string, string>) {
  return JSON.stringify(sortedQueryEntries(url.searchParams.entries())) === JSON.stringify(
    sortedQueryEntries(Object.entries(expected))
  )
}

function isAllowedShellDocument(url: URL) {
  return allowedShellDocuments.some(expected =>
    url.origin === expected.origin &&
    url.pathname === expected.pathname &&
    JSON.stringify(sortedQueryEntries(url.searchParams.entries())) === JSON.stringify(
      sortedQueryEntries(expected.searchParams.entries())
    )
  )
}

function shellStaticKey(url: URL) {
  return `${url.pathname}${url.search}`
}

function isAllowedShellRequest(request: Request, url: URL) {
  if (request.method() !== "GET" || url.origin !== authorityOrigin) return false
  return isAllowedShellDocument(url) || allowedShellStaticRequests.has(shellStaticKey(url))
}

function searchFixture(query: string) {
  if (query === "glas") {
    return [{ order: 0, highlights: [{ ix: 2, n: "-2", wid: "w2_2" }] }]
  }
  if (query === "doktor%20glas" || query === "doktor glas") return phraseHits
  return null
}

async function routeAuthorityRequest(
  route: Route,
  ledger: Ledger,
  authorityFonts: Buffer
) {
  const request = route.request()
  const url = new URL(request.url())
  const label = requestLabel(route)

  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/api/get_authors" &&
    queryEquals(url, { exclude: authorExclude })
  ) {
    ledger.authors.push(label)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ data: legacyWork.authors })
    })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/api/get_work_info" &&
    queryEquals(url, {
      authorid: "SöderbergH",
      exclude: "content_vector",
      titlepath: "DoktorGlas"
    })
  ) {
    ledger.work.push(label)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ hits: 1, data: [legacyWork] })
    })
  }
  const pageMatch = /^\/txt\/lb-reader-doktor-glas\/res_0000([123])\.html$/.exec(url.pathname)
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    pageMatch &&
    (
      queryEquals(url, { username: "app" }) ||
      (pageMatch[1] === "3" && url.search === "")
    )
  ) {
    ledger.pages.push(label)
    const pageIndex = Number(pageMatch[1]) as 1 | 2 | 3
    return route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<html><body>${readerPageHtmlByIndex[pageIndex]}</body></html>`
    })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/red/css/etext.css" &&
    url.search === ""
  ) {
    ledger.styles.push(label)
    return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: sharedReaderCss })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/txt/css/lb-reader-doktor-glas-etext.css" &&
    url.search === ""
  ) {
    ledger.styles.push(label)
    return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: workReaderCss })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/bilder/ornament/reader-fixture.png" &&
    url.search === ""
  ) {
    ledger.ornament.push(label)
    return route.fulfill({ status: 200, contentType: "image/png", body: transparentPixel })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml" &&
    queryEquals(url, { username: "app" })
  ) {
    ledger.background.push(label)
    return route.fulfill({
      status: 200,
      contentType: "application/xml; charset=utf-8",
      body: "<backgrounds />"
    })
  }
  if (
    request.method() === "GET" &&
    url.origin === "https://cloud.typography.com" &&
    url.pathname === "/7426274/770508/css/fonts.css" &&
    url.search === ""
  ) {
    ledger.fonts.push(label)
    return route.fulfill({
      status: 200,
      contentType: "text/css; charset=utf-8",
      body: authorityFonts
    })
  }
  if (
    request.method() === "GET" &&
    url.origin === "https://www.googletagmanager.com" &&
    url.pathname === "/gtag/js" &&
    queryEquals(url, { id: "UA-132486790-1" })
  ) {
    ledger.gtm.push(label)
    return route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: ""
    })
  }
  const searchMatch = /^\/api\/search_document\/lb-reader-doktor-glas\/etext\/([^/]+)\/$/.exec(
    url.pathname
  )
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    searchMatch &&
    queryEquals(url, { init_hits: "20", word_form_only: "true" })
  ) {
    const hits = searchFixture(searchMatch[1]!)
    if (hits) {
      ledger.search.push(label)
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        headers: { "cache-control": "no-cache" },
        body: [
          `data: ${JSON.stringify({ data: hits, num_highlights: hits.length })}\n\n`,
          `data: ${JSON.stringify({ total_hits: hits.length, search_id: "frozen-reader-hit" })}\n\n`
        ].join("")
      })
    }
  }
  if (isAllowedShellRequest(request, url)) {
    ledger.shell.push(label)
    return route.continue()
  }

  ledger.unexpected.push(label)
  return route.abort("blockedbyclient")
}

const visualCases = [
  {
    name: "ordinary",
    angularRoute: readerPath,
    query: null,
    hit: null,
    total: null,
    markerIds: []
  },
  {
    name: "single-first",
    angularRoute: `${readerPath}?s_query=glas&s_lbworkid=lb-reader-doktor-glas&s_mediatype=etext&s_word_form_only=true&hit_index=0`,
    query: "glas",
    hit: 0,
    total: 1,
    markerIds: ["w2_2"]
  },
  {
    name: "phrase-middle",
    angularRoute: `${readerPath}?s_query=doktor%20glas&s_lbworkid=lb-reader-doktor-glas&s_mediatype=etext&s_word_form_only=true&hit_index=1`,
    query: "doktor glas",
    hit: 1,
    total: 5,
    markerIds: ["w2_1", "w2_2"]
  }
] as const

for (const visualCase of visualCases) {
  test(`captures the Angular Reader ${visualCase.name} authority`, async ({ browser, page }, testInfo) => {
    const authorityFonts = await readFile(
      resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")
    )
    const ledger = emptyLedger()
    const probeLedger = emptyLedger()
    const probePage = await browser.newPage()
    await probePage.route("**/*", route => routeAuthorityRequest(route, probeLedger, authorityFonts))
    const extraMetadata = new URL("/api/get_work_info", authorityOrigin)
    extraMetadata.searchParams.set("authorid", "SöderbergH")
    extraMetadata.searchParams.set("exclude", "content_vector")
    extraMetadata.searchParams.set("titlepath", "DoktorGlas")
    extraMetadata.searchParams.set("extra", "blocked")
    const duplicateAuthors = new URL("/api/get_authors", authorityOrigin)
    duplicateAuthors.searchParams.append("exclude", authorExclude)
    duplicateAuthors.searchParams.append("exclude", authorExclude)
    const unlistedStatic = new URL("/assets/task-6-negative-probe.js", authorityOrigin)
    const reorderedShellDocument = new URL(allowedShellDocuments[1]!)
    const reorderedShellEntries = [...reorderedShellDocument.searchParams.entries()].reverse()
    reorderedShellDocument.search = ""
    for (const [key, value] of reorderedShellEntries) {
      reorderedShellDocument.searchParams.append(key, value)
    }
    const duplicateShellDocument = new URL(reorderedShellDocument)
    duplicateShellDocument.searchParams.append("s_query", "glas")
    expect(isAllowedShellDocument(reorderedShellDocument)).toBe(true)
    expect(isAllowedShellDocument(duplicateShellDocument)).toBe(false)
    const mutatedSearch = new URL(
      "/api/search_document/lb-reader-doktor-glas/etext/mutated/?init_hits=20&word_form_only=false",
      authorityOrigin
    )
    await probePage.goto(`${authorityOrigin}/data.json`).catch(() => null)
    await probePage.goto(extraMetadata.toString()).catch(() => null)
    await probePage.goto(mutatedSearch.toString()).catch(() => null)
    await probePage.goto(unlistedStatic.toString()).catch(() => null)
    await probePage.goto(duplicateAuthors.toString()).catch(() => null)
    await probePage.close()

    page.on("pageerror", error => ledger.problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) {
        ledger.problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })
    await page.route("**/*", route => routeAuthorityRequest(route, ledger, authorityFonts))

    const response = await page.goto(visualCase.angularRoute, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect.poll(async () => ({
      bodyClass: await page.locator("body").getAttribute("class"),
      ready: await page.locator("body.page-reading.ready").count(),
      reader: await page.locator("reading .reader_main.first_load:not(.searching)").count(),
      unexpected: ledger.unexpected
    })).toEqual({
      bodyClass: expect.stringContaining("ready"),
      ready: 1,
      reader: 1,
      unexpected: []
    })
    await expect(page.locator("reading .reader_main .etext.txt")).toContainText("DOKTOR GLAS")
    await expect(page.locator("reading .reader_main .etext.txt")).toContainText("HJALMAR SÖDERBERG")
    await expect(page.locator("reading .reader_main .markee")).toHaveCount(visualCase.markerIds.length)

    const toolkit = page.locator("#toolkit #search_nav")
    if (visualCase.query === null) {
      await expect(toolkit).toBeHidden()
      expect(ledger.search).toEqual([])
    } else {
      await expect(toolkit).toBeVisible()
      await expect(toolkit.locator(".num")).toHaveText(String(visualCase.total))
      await expect(toolkit).toContainText(`Träff ${visualCase.hit! + 1}, sida -2`)
      await expect(page.locator("#toolkit .spinner_search")).not.toHaveClass(/searching/)
      await expect(page.locator("#toolkit .spinner_search")).toHaveCSS("opacity", "0")
      await expect(page).toHaveURL(url => {
        const params = url.searchParams
        return params.get("s_query") === visualCase.query &&
          params.get("s_lbworkid") === "lb-reader-doktor-glas" &&
          params.get("s_mediatype") === "etext" &&
          params.get("s_word_form_only") === "true" &&
          params.get("hit_index") === String(visualCase.hit) &&
          params.get("traff") === visualCase.markerIds[0] &&
          params.get("traffslut") === visualCase.markerIds.at(-1)
      })
      expect(ledger.search).toHaveLength(1)
    }

    for (const [index, markerId] of visualCase.markerIds.entries()) {
      const expectedClass = index % 2 === 1 ? /\bmarkee\b.*\bflip\b/ : /\bmarkee\b/
      await expect(page.locator(`#${markerId}`)).toHaveClass(expectedClass)
    }
    if (visualCase.name === "single-first") {
      await expect(page.locator("#w2_2")).not.toHaveClass(/\bflip\b/)
    }

    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    await expect(page.locator("html")).toHaveCSS("background-image", "none")
    expect(await page.locator("img").evaluateAll(images => images.every(image => image.complete))).toBe(true)
    if (testInfo.project.name === "angular-mobile") {
      expect(await page.locator("reading .etext.txt").evaluate(element =>
        element.scrollWidth > element.clientWidth
      )).toBe(true)
    }

    expect(ledger.authors).toHaveLength(1)
    expect(ledger.work).toHaveLength(1)
    expect(ledger.pages.filter(label => label.includes("res_00002.html"))).toHaveLength(1)
    expect(ledger.styles).toHaveLength(2)
    expect(ledger.ornament).toHaveLength(1)
    expect(ledger.background).toHaveLength(1)
    expect(ledger.fonts).toHaveLength(1)
    expect(ledger.gtm).toHaveLength(1)
    const shellUrls = ledger.shell.map(label => new URL(label.replace(/^GET /, "")))
    expect(shellUrls.filter(url => isAllowedShellDocument(url))).toHaveLength(1)
    expect(shellUrls.filter(url => allowedShellStaticRequests.has(shellStaticKey(url)))
      .map(shellStaticKey)
      .sort()
    ).toEqual([...allowedShellStaticRequests].sort())
    expect(ledger.shell).toHaveLength(allowedShellStaticRequests.size + 1)
    expect(ledger.unexpected).toEqual([])
    expect(ledger.problems).toEqual([])
    expect(probeLedger.unexpected).toEqual([
      `GET ${authorityOrigin}/data.json`,
      `GET ${extraMetadata.toString()}`,
      `GET ${mutatedSearch.toString()}`,
      `GET ${unlistedStatic.toString()}`,
      `GET ${duplicateAuthors.toString()}`
    ])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `reader-hit-${visualCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })

    expect(ledger.unexpected).toEqual([])
    expect(ledger.problems).toEqual([])
  })
}
