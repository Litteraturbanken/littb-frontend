import { createHash } from "node:crypto"
import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Request, type Route } from "@playwright/test"

import {
  readerFacsimileJpegFile,
  readerPageHtmlByIndex,
  readerWorkInfoResponse,
  sharedReaderCss,
  workReaderCss
} from "../fixtures/reader-data.mjs"
import {
  sourceInfoLicenses,
  sourceInfoProvenance
} from "../fixtures/reader-source-info-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"
import { allowedShellStaticRequests } from "./angular-reader-shell-static"

test.use({ serviceWorkers: "block" })

const angularPort = Number(process.env.LITTB_ANGULAR_TEST_PORT || 3049)
const authorityOrigin = `http://127.0.0.1:${angularPort}`
const normalPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const dramaPath = "/författare/AlmlöfN/titlar/Affarer/sida/-2/faksimil"
const longPath = "/författare/LongErrataA/titlar/LongErrata/sida/-2/etext"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const allowedShellDocuments = [
  normalPath,
  `${normalPath}?om-boken`,
  `${dramaPath}?om-boken`,
  `${longPath}?om-boken`
].map(path => new URL(path, authorityOrigin))
const allowedSourceInfoShellStaticRequests = new Set([
  ...allowedShellStaticRequests,
  "/img/dramawebben_svart.svg",
  "/views/sourceInfo.html"
])

const existingClosedReaderManifest = {
  "reader-hit-ordinary-desktop.png": "cd159a40e3240784a49e26c66a84e7596c160fe8c0a2049fa7d99482d7dacae2",
  "reader-hit-ordinary-mobile.png": "6704cc0c2c0f45fe911f6fa2423613205571af744fdbf0cea79884cef5e2527c"
} as const

const transparentPixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
)

const authors = [
  {
    authorid: "SöderbergH",
    authorid_norm: "SoderbergH",
    full_name: "Hjalmar Söderberg",
    surname: "Söderberg",
    searchable: true
  },
  {
    authorid: "AlmlöfN",
    authorid_norm: "AlmlofN",
    full_name: "Nils Almlöf",
    surname: "Almlöf",
    searchable: true
  },
  {
    authorid: "LongErrataA",
    authorid_norm: "LongErrataA",
    full_name: "Rita Redaktör",
    surname: "Redaktör",
    searchable: true,
    type: "editor"
  },
  {
    authorid: "DramaRedaktionen",
    authorid_norm: "DramaRedaktionen",
    full_name: "Dramawebbens redaktion",
    surname: "Redaktionen",
    searchable: false
  },
  {
    authorid: "LindgrenU",
    authorid_norm: "LindgrenU",
    full_name: "Ulrika Lindgren",
    surname: "Lindgren",
    searchable: true
  }
] as const

const normalAuthor = authors[0]
const dramaAuthor = authors[1]
const longAuthor = authors[2]
const baseWork = readerWorkInfoResponse.data[0]!

function errataTable(rows: number) {
  return `<table>${Array.from({ length: rows }, (_, index) =>
    `<tr><td>sid. ${index + 1}</td><td>rättning <em>${index + 1}</em></td></tr>`
  ).join("")}</table>`
}

function etextWork({
  author,
  lbworkid,
  title,
  titlepath,
  source,
  errata,
  provenance
}: {
  author: typeof normalAuthor | typeof longAuthor
  lbworkid: string
  title: string
  titlepath: string
  source: string
  errata: string
  provenance: { library: string, signum?: string, text2?: boolean }[]
}) {
  return {
    ...structuredClone(baseWork),
    authors: [author],
    main_author: author,
    work_authors: [author],
    lbworkid,
    title,
    shorttitle: title.replace(/\. Roman$/, ""),
    titlepath,
    titleid: titlepath,
    work_titleid: titlepath,
    mediatype: "etext",
    mediatypes: ["etext", "faksimil"],
    export: [{ type: "epub", size: 530557 }],
    errata,
    sourcedesc: source,
    license: "cc-0",
    librisid: titlepath === "DoktorGlas" ? "1728740" : null,
    urn: `urn:nbn:se:lb-${lbworkid}-etext`,
    printed: true,
    provenance,
    searchable: true,
    keyword: [],
    texttype: "roman"
  }
}

const normalEtext = etextWork({
  author: normalAuthor,
  lbworkid: "lb1728740",
  title: "Doktor Glas. Roman",
  titlepath: "DoktorGlas",
  source: "<p>Albert Bonniers förlag, Stockholm 1905.</p>",
  errata: errataTable(2),
  provenance: [{ library: "GUB", signum: "Litt. Sv." }]
})

const normalFacsimile = {
  ...structuredClone(normalEtext),
  mediatype: "faksimil",
  export: [],
  errata: "<table></table>",
  urn: "urn:nbn:se:lb-lb1728740-faksimil"
}

const longEtext = {
  ...etextWork({
    author: longAuthor,
    lbworkid: "lbLongErrata1",
    title: "Lång errata",
    titlepath: "LongErrata",
    source: [
      "<p>En utförlig källbeskrivning för den långa granskningsbilden.</p>",
      "<p>Den andra paragrafen bevarar indrag, radavstånd och modalens typografi.</p>",
      "<p>Den tredje paragrafen gör scrolläget entydigt även på desktop.</p>"
    ].join(""),
    errata: errataTable(10),
    provenance: [
      { library: "GUB", signum: "Litt. Sv." },
      { library: "KB", signum: "Sv. saml. 12" },
      { library: "Dramawebben", text2: true }
    ]
  }),
  workintro: [
    "<p>Detta är en längre redaktionell inledning.</p>",
    "<p>Den används bara för att frysa det nedre scrolläget.</p>"
  ].join(""),
  workintro_author: "DramaRedaktionen"
}

const dramaFacsimile = {
  ...structuredClone(baseWork),
  authors: [dramaAuthor],
  main_author: dramaAuthor,
  work_authors: [dramaAuthor],
  lbworkid: "lb31230",
  title: "Affärer",
  shorttitle: "Affärer",
  titlepath: "Affarer",
  titleid: "Affarer",
  work_titleid: "Affarer",
  mediatype: "faksimil",
  faksimil_sizes: [1, 2, 3, 4],
  width: { size_1: 350, size_2: 450, size_3: 625, size_4: 900, size_5: 1250 },
  pages: [
    { pagename: "-2", pageindex: 1, imagenumber: 1 },
    { pagename: "-1", pageindex: 2, imagenumber: 2 }
  ],
  page_count: 2,
  startpagename: "-2",
  endpagename: "-1",
  parts: [{
    authors: [{ authorid: "AlmlöfN" }],
    endpagename: "-1",
    navtitle: "Affärer",
    shorttitle: "Affärer",
    startpagename: "-2",
    title: "Affärer",
    titleid: "Affarer"
  }],
  export: [
    { type: "epub", size: 68719476736 }
  ],
  errata: "<table></table>",
  sourcedesc: "<p>Stockholm, 1871.</p><sourcedesc-author>DramaRedaktionen</sourcedesc-author>",
  workintro: "<p>En komedi i fem akter.</p><p><strong>Affärer</strong> uruppfördes 1871.</p>",
  workintro_author: "LindgrenU",
  license: "pd",
  librisid: null,
  urn: "urn:nbn:se:lb-lb31230-faksimil",
  printed: true,
  provenance: [
    { library: "KB", signum: "Sv. teater 204" },
    { library: "Dramawebben", text2: true }
  ],
  searchable: false,
  keyword: [],
  texttype: "drama",
  dramawebben: {
    number_of_pages: "204",
    number_of_acts: "5",
    number_of_roles: "15",
    male_roles: "11",
    female_roles: "5",
    roles: ["<i>Direktören</i>, grosshandlare", "<span class='role'>Anna</span>, hans dotter"],
    history: "<p>Uruppförd på <a href='https://example.test/teater'>Kungliga teatern</a>.</p>"
  }
}

const dramaEtext = {
  ...structuredClone(dramaFacsimile),
  mediatype: "etext",
  faksimil_sizes: undefined,
  width: undefined,
  export: [{ type: "pdf", size: 4294967297 }],
  urn: "urn:nbn:se:lb-lb31230-etext"
}

const worksByIdentity = new Map([
  ["SöderbergH|DoktorGlas", [normalEtext, normalFacsimile]],
  ["AlmlöfN|Affarer", [dramaFacsimile, dramaEtext]],
  ["LongErrataA|LongErrata", [longEtext]]
])

type Ledger = {
  authors: string[]
  background: string[]
  fonts: string[]
  gtm: string[]
  images: string[]
  pages: string[]
  problems: string[]
  shell: string[]
  sourceStatic: string[]
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
    images: [],
    pages: [],
    problems: [],
    shell: [],
    sourceStatic: [],
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
  return isAllowedShellDocument(url) || allowedSourceInfoShellStaticRequests.has(shellStaticKey(url))
}

function workIdentity(url: URL) {
  const author = url.searchParams.get("authorid")
  const title = url.searchParams.get("titlepath")
  if (!author || !title) return null
  return `${author}|${title}`
}

function isReaderPage(url: URL) {
  return /^\/txt\/(lb1728740|lbLongErrata1)\/res_0000[123]\.html$/.test(url.pathname)
}

function isDramaScan(url: URL) {
  return /^\/txt\/lb31230\/lb31230_[1-5]\/lb31230_[1-5]_000[12]\.jpeg$/.test(url.pathname)
}

function isSourceImage(url: URL) {
  return /^\/txt\/(lb1728740|lb31230|lbLongErrata1)\/\1_(small|large)\.jpeg$/.test(url.pathname) ||
    [
      "/red/bilder/gemensamt/gublogga.png",
      "/red/bilder/gemensamt/kblogga.png",
      "/red/bilder/gemensamt/cc-128x128.png",
      "/red/bilder/gemensamt/cc0-128x128.png",
      "/red/bilder/gemensamt/cc-pd-128x128.png",
      "/red/bilder/gemensamt/dramawebben_svart.svg"
    ].includes(url.pathname)
}

async function routeAuthorityRequest(
  route: Route,
  ledger: Ledger,
  assets: { authorityFonts: Buffer, scan: Buffer, ccBy: Buffer, ccPublicDomain: Buffer }
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
      body: JSON.stringify({ data: authors })
    })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/api/get_work_info" &&
    queryEquals(url, {
      authorid: url.searchParams.get("authorid") ?? "",
      exclude: "content_vector",
      titlepath: url.searchParams.get("titlepath") ?? ""
    })
  ) {
    const works = worksByIdentity.get(workIdentity(url) ?? "")
    if (works) {
      ledger.work.push(label)
      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ hits: works.length, data: works })
      })
    }
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    isReaderPage(url) &&
    (queryEquals(url, { username: "app" }) || url.search === "")
  ) {
    ledger.pages.push(label)
    const pageIndex = Number(/res_0000([123])/.exec(url.pathname)?.[1] ?? 2) as 1 | 2 | 3
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
    /^\/txt\/css\/(lb1728740|lbLongErrata1)-etext\.css$/.test(url.pathname) &&
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
    ledger.images.push(label)
    return route.fulfill({ status: 200, contentType: "image/png", body: transparentPixel })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    isDramaScan(url) &&
    url.search === ""
  ) {
    ledger.images.push(label)
    return route.fulfill({ status: 200, contentType: "image/jpeg", body: assets.scan })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    isSourceImage(url) &&
    url.search === ""
  ) {
    ledger.images.push(label)
    if (url.pathname.endsWith(".svg")) {
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'
      })
    }
    const body = url.pathname.includes("cc0-") || url.pathname.includes("cc-pd-")
      ? assets.ccPublicDomain
      : url.pathname.includes("/red/bilder/gemensamt/")
        ? assets.ccBy
        : assets.scan
    return route.fulfill({
      status: 200,
      contentType: url.pathname.endsWith(".jpeg") ? "image/jpeg" : "image/png",
      body
    })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/red/etc/provenance/provenance.json" &&
    url.search === ""
  ) {
    ledger.sourceStatic.push(label)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(sourceInfoProvenance)
    })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/red/etc/license/license.json" &&
    url.search === ""
  ) {
    ledger.sourceStatic.push(label)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(sourceInfoLicenses)
    })
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
      body: assets.authorityFonts
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
  if (isAllowedShellRequest(request, url)) {
    ledger.shell.push(label)
    return route.continue()
  }

  ledger.unexpected.push(label)
  return route.abort("blockedbyclient")
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex")
}

async function assertExistingClosedReaderManifest() {
  const directory = resolve(import.meta.dirname, "baselines")
  for (const [filename, expectedHash] of Object.entries(existingClosedReaderManifest)) {
    const bytes = await readFile(resolve(directory, filename))
    expect(sha256(bytes), filename).toBe(expectedHash)
  }
}

async function waitForScrollToSettle(page: Parameters<typeof waitForVisualAssets>[0]) {
  await page.waitForFunction(() => {
    const previous = window.sessionStorage.getItem("reader-authority-scroll")
    const current = `${window.scrollX}:${window.scrollY}`
    const stable = Number(window.sessionStorage.getItem("reader-authority-scroll-stable") ?? "0")
    window.sessionStorage.setItem("reader-authority-scroll", current)
    const nextStable = previous === current ? stable + 1 : 0
    window.sessionStorage.setItem("reader-authority-scroll-stable", String(nextStable))
    return nextStable >= 4
  }, null, { polling: 100 })
}

test.beforeAll(assertExistingClosedReaderManifest)
test.afterAll(assertExistingClosedReaderManifest)

const visualCases = [
  {
    name: "closed-normal",
    angularRoute: normalPath,
    mode: "closed"
  },
  {
    name: "normal",
    angularRoute: `${normalPath}?om-boken`,
    mode: "normal"
  },
  {
    name: "drama",
    angularRoute: `${dramaPath}?om-boken`,
    mode: "drama"
  },
  {
    name: "long-scroll",
    angularRoute: `${longPath}?om-boken`,
    mode: "long-scroll"
  }
] as const

for (const visualCase of visualCases) {
  test(`captures the Angular Reader source-info ${visualCase.name} authority`, async ({
    browser,
    page
  }, testInfo) => {
    const [authorityFonts, scan, ccBy, ccPublicDomain] = await Promise.all([
      readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
      readFile(readerFacsimileJpegFile),
      readFile(resolve(import.meta.dirname, "../fixtures/about-content/cc_by.png")),
      readFile(resolve(import.meta.dirname, "../fixtures/about-content/cc_publicdomain.png"))
    ])
    const assets = { authorityFonts, scan, ccBy, ccPublicDomain }
    const ledger = emptyLedger()
    const probeLedger = emptyLedger()
    const probePage = await browser.newPage()
    await probePage.route("**/*", route => routeAuthorityRequest(route, probeLedger, assets))

    const validWork = new URL("/api/get_work_info", authorityOrigin)
    validWork.searchParams.set("authorid", "SöderbergH")
    validWork.searchParams.set("exclude", "content_vector")
    validWork.searchParams.set("titlepath", "DoktorGlas")
    const extraWork = new URL(validWork)
    extraWork.searchParams.set("extra", "blocked")
    const duplicateWork = new URL(validWork)
    duplicateWork.searchParams.append("authorid", "SöderbergH")
    const extraDocument = new URL(allowedShellDocuments[1]!)
    extraDocument.searchParams.set("extra", "blocked")
    const blockedProbeUrls = [
      extraWork,
      duplicateWork,
      extraDocument,
      new URL("/red/etc/license/other.json", authorityOrigin),
      new URL("/txt/lb1728740/lb1728740_medium.jpeg", authorityOrigin)
    ]
    for (const probe of blockedProbeUrls) {
      await probePage.goto(probe.toString()).catch(() => null)
    }
    await probePage.close()

    page.on("pageerror", error => ledger.problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) {
        ledger.problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })
    await page.route("**/*", route => routeAuthorityRequest(route, ledger, assets))

    const response = await page.goto(visualCase.angularRoute, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect.poll(async () => ({
      ready: await page.locator("body.page-reading.ready").count(),
      reader: await page.locator("reading .reader_main.first_load:not(.searching)").count(),
      unexpected: ledger.unexpected
    })).toEqual({ ready: 1, reader: 1, unexpected: [] })

    const modal = page.locator(".about.modal")
    if (visualCase.mode === "closed") {
      await expect(modal).toHaveCount(0)
      await expect(page.locator("body")).not.toHaveClass(/\bmodal-open\b/)
      await expect(page.locator(".modal-backdrop")).toHaveCount(0)
      expect(ledger.sourceStatic).toEqual([])
    } else {
      await expect(modal).toHaveCount(1)
      await expect(modal).toBeVisible()
      await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/)
      await expect(page.locator(".modal-backdrop.in")).toHaveCount(1)
      await expect(page.locator(".about-modal .preloader")).toBeHidden()
      await expect(page.locator(".about-modal .maincontent:not(.searching)")).toHaveCount(1)
      await expect(page.locator(".about-modal button.close_btn")).toHaveText("Stäng")
      await expect.poll(() => page.evaluate(() =>
        document.activeElement?.matches(".about.modal[role='dialog'][tabindex='-1']")
      )).toBe(true)

      const dialog = page.locator(".about.modal .modal-dialog")
      const dialogBox = await dialog.boundingBox()
      expect(dialogBox).not.toBeNull()
      if (testInfo.project.name === "angular-desktop") {
        expect(dialogBox!.width).toBeGreaterThanOrEqual(590)
        expect(dialogBox!.width).toBeLessThanOrEqual(610)
        expect(dialogBox!.y).toBeGreaterThanOrEqual(45)
        expect(dialogBox!.y).toBeLessThanOrEqual(55)
      } else {
        expect(dialogBox!.width).toBeGreaterThan(300)
        expect(dialogBox!.width).toBeLessThanOrEqual(testInfo.project.use.viewport!.width)
      }

      if (visualCase.mode === "normal") {
        await expect(page.locator(".about-modal h2.author")).toContainText("Hjalmar Söderberg")
        await expect(page.locator(".about-modal h2.title")).toHaveText("Doktor Glas. Roman")
        await expect(page.locator(".about-modal .errata_table tr")).toHaveCount(2)
        await expect(page.locator(".about-modal .provenance")).toHaveCount(1)
      } else if (visualCase.mode === "drama") {
        await expect(page.locator(".about-modal h2.author")).toContainText("Nils Almlöf")
        await expect(page.locator(".about-modal h2.title")).toHaveText("Affärer")
        await expect(page.locator(".about-modal .mediatypes_also")).toContainText("epub (65536 MB)")
        await expect(page.locator(".about-modal .mediatypes_also")).toContainText("pdf (4096 MB)")
        await expect(page.locator(".about-modal .dramaweb")).toBeVisible()
        await expect(page.locator(".about-modal .dramaweb .heading")).toHaveText([
          "Rollista",
          "Teaterkritik"
        ])
        await expect(page.locator(".about-modal .dw_logo")).toBeHidden()
        await expect(page.locator(".about-modal .introheader")).toHaveCount(0)
      } else {
        await expect(page.locator(".about-modal .errata_table tr")).toHaveCount(8)
        await page.locator(".about-modal .errata .toggle").getByText("Visa fler", { exact: true }).click()
        await expect(page.locator(".about-modal .errata_table tr")).toHaveCount(10)
        await expect(page.locator(".about-modal .provenance")).toHaveCount(3)
        await modal.evaluate(element => element.scrollTop = element.scrollHeight)
        await expect.poll(() => modal.evaluate(element => ({
          scrollTop: element.scrollTop,
          maximum: element.scrollHeight - element.clientHeight
        }))).toEqual({
          scrollTop: expect.any(Number),
          maximum: expect.any(Number)
        })
        const scroll = await modal.evaluate(element => ({
          scrollTop: element.scrollTop,
          maximum: element.scrollHeight - element.clientHeight
        }))
        expect(scroll.maximum).toBeGreaterThan(0)
        expect(scroll.scrollTop).toBe(scroll.maximum)
      }
      expect(ledger.sourceStatic.map(label => new URL(label.replace(/^GET /, "")).pathname).sort())
        .toEqual([
          "/red/etc/license/license.json",
          "/red/etc/provenance/provenance.json"
        ])
    }

    await waitForVisualAssets(page)
    await page.waitForTimeout(350)
    await waitForScrollToSettle(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    await expect(page.locator("html")).toHaveCSS("background-image", "none")
    expect(await page.locator("img").evaluateAll(images => images.every(image => image.complete))).toBe(true)

    expect(ledger.authors).toHaveLength(1)
    expect(ledger.work).toHaveLength(1)
    expect(ledger.background).toHaveLength(1)
    expect(ledger.fonts).toHaveLength(1)
    expect(ledger.gtm).toHaveLength(1)
    expect(ledger.pages.length + ledger.images.filter(label => label.includes("/lb31230_")).length)
      .toBeGreaterThan(0)
    const shellUrls = ledger.shell.map(label => new URL(label.replace(/^GET /, "")))
    expect(shellUrls.filter(url => isAllowedShellDocument(url))).toHaveLength(1)
    const shellStaticKeys = shellUrls
      .filter(url => allowedSourceInfoShellStaticRequests.has(shellStaticKey(url)))
      .map(shellStaticKey)
    for (const key of allowedShellStaticRequests) {
      expect(shellStaticKeys.filter(value => value === key), key).toHaveLength(1)
    }
    const sourceTemplateCount = shellStaticKeys.filter(key => key === "/views/sourceInfo.html").length
    const rawDramaLogoCount = shellStaticKeys.filter(key => key === "/img/dramawebben_svart.svg").length
    if (visualCase.mode === "closed") {
      expect(sourceTemplateCount).toBe(0)
      expect(rawDramaLogoCount).toBe(0)
    } else {
      expect(sourceTemplateCount).toBe(1)
      expect(rawDramaLogoCount).toBeGreaterThanOrEqual(1)
      expect(rawDramaLogoCount).toBeLessThanOrEqual(visualCase.mode === "drama" ? 2 : 1)
    }
    expect(shellStaticKeys).toHaveLength(
      allowedShellStaticRequests.size + sourceTemplateCount + rawDramaLogoCount
    )
    expect(ledger.shell).toHaveLength(shellStaticKeys.length + 1)
    expect(ledger.unexpected).toEqual([])
    expect(ledger.problems).toEqual([])
    expect(probeLedger.unexpected).toEqual(blockedProbeUrls.map(url => `GET ${url.toString()}`))

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    const screenshotOptions = {
      path: resolve(directory, `reader-source-info-${visualCase.name}-${device}.png`),
      animations: "disabled" as const,
      caret: "hide" as const,
      scale: "css" as const
    }
    if (visualCase.mode === "closed") {
      await page.screenshot({ ...screenshotOptions, fullPage: true })
    } else {
      await page.locator(".about.modal .modal-dialog").screenshot(screenshotOptions)
    }

    expect(ledger.unexpected).toEqual([])
    expect(ledger.problems).toEqual([])
  })
}
