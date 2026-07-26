import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test"

import {
  readerFacsimileJpegFile,
  readerFacsimileWorkInfoResponse,
  readerPageHtmlByIndex,
  readerWorkInfoResponse,
  sharedReaderCss,
  workReaderCss
} from "../fixtures/reader-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityPort = Number(process.env.LITTB_ANGULAR_TEST_PORT || 3051)
const authorityOrigin = `http://127.0.0.1:${authorityPort}`
const etextPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const facsimilePath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"
const nyaVagarPath = "/författare/SöderbergH/titlar/NyaVagarReader/sida/-2/etext"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"

const authors = [
  {
    authorid: "SöderbergH",
    authorid_norm: "SoderbergH",
    full_name: "Hjalmar Söderberg",
    surname: "Söderberg",
    searchable: true
  },
  {
    authorid: "LagerlöfS",
    authorid_norm: "LagerlofS",
    full_name: "Selma Lagerlöf",
    surname: "Lagerlöf",
    searchable: true
  }
] as const

function legacyEtext(titlepath: "DoktorGlas" | "NyaVagarReader") {
  const author = authors[0]
  const frozen = structuredClone(readerWorkInfoResponse.data[0])
  return {
    ...frozen,
    authors: [author],
    endpagename: "-1",
    errata: "<table></table>",
    export: [],
    keyword: titlepath === "NyaVagarReader" ? ["1800"] : [],
    main_author: author,
    mediatypes: ["etext"],
    page_count: 3,
    pagestep: 1,
    pages: frozen.pages.map(page => ({ ...page, imagenumber: page.pageindex })),
    parts: [{
      authors: [{ authorid: author.authorid }],
      endpagename: "-1",
      navtitle: "Doktor Glas",
      shorttitle: "Doktor Glas",
      startpagename: "-3",
      title: "Doktor Glas"
    }],
    shorttitle: titlepath === "DoktorGlas" ? "Doktor Glas" : titlepath,
    sourcedesc: "",
    title: `${titlepath === "DoktorGlas" ? "Doktor Glas" : titlepath}. Roman`,
    titleid: titlepath,
    titlepath,
    work_authors: [author],
    work_titleid: titlepath
  }
}

function legacyFacsimile() {
  const author = authors[1]
  const frozen = structuredClone(readerFacsimileWorkInfoResponse.data[0])
  return {
    ...frozen,
    authors: [author],
    endpagename: "5",
    errata: "<table></table>",
    export: [],
    keyword: [],
    main_author: author,
    mediatypes: ["faksimil"],
    page_count: 3,
    pagestep: 1,
    parts: [{
      authors: [{ authorid: author.authorid }],
      endpagename: "5",
      navtitle: "Gösta Berlings saga",
      shorttitle: "Gösta Berlings saga",
      startpagename: "1",
      title: "Gösta Berlings saga"
    }],
    sourcedesc: "",
    titleid: "GostaBerlingsSaga",
    work_authors: [author],
    work_titleid: "GostaBerlingsSaga"
  }
}

const works = {
  DoktorGlas: legacyEtext("DoktorGlas"),
  GostaBerlingsSaga: legacyFacsimile(),
  NyaVagarReader: legacyEtext("NyaVagarReader")
} as const

type Ledger = {
  problems: string[]
  semantic: string[]
  unexpected: string[]
}

function queryEquals(url: URL, expected: Record<string, string>) {
  return JSON.stringify([...url.searchParams.entries()].sort()) === JSON.stringify(
    Object.entries(expected).sort()
  )
}

async function routeAuthority(
  route: Route,
  ledger: Ledger,
  fonts: Buffer,
  scan: Buffer
) {
  const request = route.request()
  const url = new URL(request.url())
  const label = `${request.method()} ${request.url()}`

  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/api/get_authors"
    && queryEquals(url, { exclude: authorExclude })) {
    ledger.semantic.push(label)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ data: authors })
    })
  }

  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/api/get_work_info") {
    const titlepath = url.searchParams.get("titlepath") as keyof typeof works | null
    const authorid = url.searchParams.get("authorid")
    if (titlepath && works[titlepath]
      && queryEquals(url, { authorid: authorid!, exclude: "content_vector", titlepath })) {
      ledger.semantic.push(label)
      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ hits: 1, data: [works[titlepath]] })
      })
    }
  }

  const etextMatch = /^\/txt\/(lb-reader-(?:doktor-glas|nya-vagar-reader))\/res_0000([123])\.html$/u
    .exec(url.pathname)
  if (request.method() === "GET" && url.origin === authorityOrigin && etextMatch
    && (queryEquals(url, { username: "app" }) || url.search === "")) {
    ledger.semantic.push(label)
    const pageIndex = Number(etextMatch[2]) as 1 | 2 | 3
    return route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<html><body>${readerPageHtmlByIndex[pageIndex]}</body></html>`
    })
  }

  if (request.method() === "GET" && url.origin === authorityOrigin
    && /^\/txt\/lb-reader-gosta-berlings-saga\/ocr_00001\.html$/u.test(url.pathname)
    && queryEquals(url, { username: "app" })) {
    ledger.semantic.push(label)
    return route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: '<body><div data-size="625x900"><span class="w">OCR fixture</span></div></body>'
    })
  }

  if (request.method() === "GET" && url.origin === authorityOrigin
    && /^\/txt\/lb-reader-gosta-berlings-saga\/lb-reader-gosta-berlings-saga_[1-5]\/lb-reader-gosta-berlings-saga_[1-5]_\d{4}\.jpeg$/u.test(url.pathname)) {
    ledger.semantic.push(label)
    return route.fulfill({ status: 200, contentType: "image/jpeg", body: scan })
  }

  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/red/css/etext.css") {
    ledger.semantic.push(label)
    return route.fulfill({ status: 200, contentType: "text/css", body: sharedReaderCss })
  }

  if (request.method() === "GET" && url.origin === authorityOrigin
    && /^\/txt\/css\/lb-reader-(?:doktor-glas|nya-vagar-reader)-etext\.css$/u.test(url.pathname)) {
    ledger.semantic.push(label)
    return route.fulfill({ status: 200, contentType: "text/css", body: workReaderCss })
  }

  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/bilder/ornament/reader-fixture.png") {
    ledger.semantic.push(label)
    return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    ) })
  }

  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml"
    && queryEquals(url, { username: "app" })) {
    return route.fulfill({ status: 200, contentType: "application/xml", body: "<backgrounds />" })
  }

  if (request.method() === "GET" && url.origin === "https://cloud.typography.com"
    && url.pathname === "/7426274/770508/css/fonts.css") {
    return route.fulfill({ status: 200, contentType: "text/css", body: fonts })
  }

  if (request.method() === "GET" && url.origin === "https://www.googletagmanager.com") {
    return route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
  }

  // The authority shell and every static asset are served by the local legacy Vite app.
  if (request.method() === "GET" && url.origin === authorityOrigin
    && !url.pathname.startsWith("/api/")
    && !url.pathname.startsWith("/txt/")
    && !url.pathname.startsWith("/red/")) {
    return route.continue()
  }

  ledger.unexpected.push(label)
  return route.abort("blockedbyclient")
}

async function prepareAuthority(page: Page) {
  const [fonts, scan] = await Promise.all([
    readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
    readFile(readerFacsimileJpegFile)
  ])
  const ledger: Ledger = { problems: [], semantic: [], unexpected: [] }
  page.on("pageerror", error => ledger.problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) {
      ledger.problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  await page.route("**/*", (route: Route) => routeAuthority(route, ledger, fonts, scan))
  return ledger
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await waitForVisualAssets(page)
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
  expect(await page.locator("img").evaluateAll(images =>
    images.every(image => image.complete))).toBe(true)
  const directory = resolve(import.meta.dirname, "baselines")
  await mkdir(directory, { recursive: true })
  const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
  await page.screenshot({
    path: resolve(directory, `${name}-${device}.png`),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css"
  })
}

test("captures Angular Läsfokus day and night authority", async ({ page }, testInfo) => {
  const ledger = await prepareAuthority(page)
  const response = await page.goto(etextPath, { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  await expect(page.locator("reading .reader_main.first_load:not(.searching)")).toContainText("DOKTOR GLAS")
  await page.getByText("Läsfokus", { exact: true }).click()
  await expect(page.locator("body.focus .reader_main.focus")).toBeVisible()
  await expect(page.locator("body > .bottomBar")).toBeVisible()
  await capture(page, testInfo, "reader-focus-day")

  await page.locator("body > .bottomBar .letters").click()
  const menu = page.locator("body > .popover .text_menu.text")
  await expect(menu).toBeVisible()
  await menu.getByText("Nattläge", { exact: true }).click()
  await expect(page.locator("body.focus.night")).toBeVisible()
  await expect(menu).toBeVisible()
  await capture(page, testInfo, "reader-focus-night")

  expect(ledger.semantic.length).toBeGreaterThan(0)
  expect(ledger.unexpected).toEqual([])
  expect(ledger.problems).toEqual([])
})

test("captures Angular normal Reader OCR authority", async ({ page }, testInfo) => {
  const ledger = await prepareAuthority(page)
  const response = await page.goto(`${facsimilePath}?ocr`, { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  const reader = page.locator("reading .reader_main.ocr.first_load:not(.searching)")
  await expect(reader.locator(".overlay")).toContainText("OCR fixture")
  await expect(reader.locator("img.faksimil")).toBeHidden()
  await capture(page, testInfo, "reader-ocr")

  expect(ledger.semantic.length).toBeGreaterThan(0)
  expect(ledger.unexpected).toEqual([])
  expect(ledger.problems).toEqual([])
})

test("captures Angular eligible Nya vägar authority", async ({ page }, testInfo) => {
  const ledger = await prepareAuthority(page)
  const response = await page.goto(nyaVagarPath, { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  await expect(page.locator("reading .reader_main.first_load:not(.searching)")).toContainText("DOKTOR GLAS")
  await expect(page.getByRole("link", { name: "Logotyp för Nya vägar" })).toBeVisible()
  await capture(page, testInfo, "reader-nya-vagar")

  expect(ledger.semantic.length).toBeGreaterThan(0)
  expect(ledger.unexpected).toEqual([])
  expect(ledger.problems).toEqual([])
})
