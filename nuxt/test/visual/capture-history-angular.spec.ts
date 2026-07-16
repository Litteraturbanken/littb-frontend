import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Page } from "@playwright/test"

import {
  historyAuthorSummaries,
  historyVisualRecords,
  historyVisualStorage
} from "../fixtures/history-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9000"
const legacyAuthorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const expectedAuthorRequest = {
  method: "GET",
  origin: authorityOrigin,
  path: "/api/get_authors",
  query: [["exclude", legacyAuthorExclude]]
}
const fontRequest = {
  origin: "https://cloud.typography.com",
  path: "/7426274/770508/css/fonts.css"
}
const gtmRequest = {
  origin: "https://www.googletagmanager.com",
  path: "/gtag/js",
  query: [["id", "UA-132486790-1"]]
}
const productionProxyPrefixes = [
  "/api",
  "/red",
  "/txt",
  "/export",
  "/query",
  "/bilder",
  "/css",
  "/sla-bibliografi",
  "/authordb",
  "/xhr",
  "/ws",
  "/so",
  "/litteraturkartan/",
  "/skolan",
  "/cdn-cgi/image/"
]

type ObservedRequest = {
  method: string
  origin: string
  path: string
  query: string[][]
}

const legacyAuthors = historyAuthorSummaries.map(author => ({
  authorid: author.author_id,
  full_name: author.full_name,
  surname: author.surname
}))

async function seedHistory(page: Page) {
  await page.addInitScript(value => {
    localStorage.setItem("lastPageViews", value)
  }, historyVisualStorage)
}

async function expectHistoryReady(page: Page) {
  await expect(page.locator("body.focus.page-history.ready")).toHaveCount(1)
  await expect(page.getByRole("heading", { name: "Senast lästa verk", exact: true }))
    .toBeVisible()

  const rows = page.locator("#mainview ul > li")
  await expect(rows).toHaveCount(historyVisualRecords.length)
  for (const [index, record] of historyVisualRecords.entries()) {
    const author = historyAuthorSummaries.find(item => item.author_id === record.author)
    const anchor = rows.nth(index).locator("a")
    await expect(anchor).toHaveText(`${author?.full_name ?? ""} – ${record.label}`)
    await expect(anchor).toHaveAttribute("href", record.url)
  }

  for (const selector of [
    "body",
    ".lb-logo",
    "#leftCorridor",
    "#mainview",
    "#mainview h1",
    "#mainview ul",
    "#mainview ul > li",
    "#mainview ul > li a"
  ]) {
    await expect(page.locator(selector).first()).toBeVisible()
  }

  await expect(page.locator(".lb-logo")).toHaveCSS("--logo-l-color", "#7A1400")
  await expect(page.locator(".lb-logo")).toHaveCSS("--logo-b-color", "black")
}

test("captures the populated Angular History authority", async ({ page }, testInfo) => {
  const authorityFonts = await readFile(
    resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")
  )
  const authorRequests: ObservedRequest[] = []
  const bootstrapRequests: string[] = []
  const unexpectedApplicationRequests: string[] = []
  const productionEscapes: string[] = []

  await seedHistory(page)
  await page.route("**/*", route => {
    const request = route.request()
    const url = new URL(request.url())
    const requestLabel = `${request.method()} ${request.url()}`
    const observedRequest = {
      method: request.method(),
      origin: url.origin,
      path: url.pathname,
      query: [...url.searchParams.entries()]
    }
    const expectedFontRequest = request.method() === "GET"
      && url.origin === fontRequest.origin
      && url.pathname === fontRequest.path
      && url.search === ""
    const expectedGtmRequest = request.method() === "GET"
      && url.origin === gtmRequest.origin
      && url.pathname === gtmRequest.path
      && JSON.stringify(observedRequest.query) === JSON.stringify(gtmRequest.query)

    if (expectedFontRequest) {
      bootstrapRequests.push("authority-fonts")
      return route.fulfill({
        status: 200,
        contentType: "text/css; charset=utf-8",
        body: authorityFonts
      })
    }
    if (expectedGtmRequest) {
      bootstrapRequests.push("empty-gtm")
      return route.fulfill({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: ""
      })
    }
    if (url.origin !== authorityOrigin) {
      productionEscapes.push(requestLabel)
      return route.abort("blockedbyclient")
    }
    if (JSON.stringify(observedRequest) === JSON.stringify(expectedAuthorRequest)) {
      authorRequests.push(observedRequest)
      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ data: legacyAuthors })
      })
    }
    if (request.method() === "GET" && url.pathname === "/red/css/etext.css" && !url.search) {
      bootstrapRequests.push(url.pathname)
      return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" })
    }
    if (request.method() === "GET"
      && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml"
      && JSON.stringify(observedRequest.query) === JSON.stringify([["username", "app"]])) {
      bootstrapRequests.push(url.pathname)
      return route.fulfill({
        status: 200,
        contentType: "application/xml; charset=utf-8",
        body: "<backgrounds />"
      })
    }
    if (productionProxyPrefixes.some(prefix => url.pathname.startsWith(prefix))) {
      if (url.pathname.startsWith("/api")) unexpectedApplicationRequests.push(requestLabel)
      productionEscapes.push(requestLabel)
      return route.abort("blockedbyclient")
    }
    return route.continue()
  })

  const response = await page.goto("/historik", { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  await expectHistoryReady(page)
  await waitForVisualAssets(page)
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
  expect(authorRequests).toEqual([expectedAuthorRequest])
  expect(bootstrapRequests.sort()).toEqual([
    "/red/bilder/bakgrundsbilder/backgrounds.xml",
    "/red/css/etext.css",
    "authority-fonts",
    "empty-gtm"
  ])
  expect(unexpectedApplicationRequests).toEqual([])
  expect(productionEscapes).toEqual([])

  const directory = resolve(import.meta.dirname, "baselines")
  await mkdir(directory, { recursive: true })
  const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
  await page.screenshot({
    path: resolve(directory, `history-populated-${device}.png`),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css"
  })

  expect(authorRequests).toEqual([expectedAuthorRequest])
  expect(unexpectedApplicationRequests).toEqual([])
  expect(productionEscapes).toEqual([])
})
