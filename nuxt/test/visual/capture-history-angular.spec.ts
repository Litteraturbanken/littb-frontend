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
  const authorRequests: string[] = []
  const bootstrapRequests: string[] = []
  const unexpectedApplicationRequests: string[] = []
  const productionEscapes: string[] = []

  await seedHistory(page)
  await page.route("**/*", route => {
    const request = route.request()
    const url = new URL(request.url())
    const requestLabel = `${request.method()} ${request.url()}`

    if (url.pathname === "/api/get_authors") {
      authorRequests.push(`${request.method()} ${url.pathname}${url.search}`)
      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ data: legacyAuthors })
      })
    }
    if (url.pathname === "/red/css/etext.css") {
      bootstrapRequests.push(url.pathname)
      return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" })
    }
    if (url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml") {
      bootstrapRequests.push(url.pathname)
      return route.fulfill({
        status: 200,
        contentType: "application/xml; charset=utf-8",
        body: "<backgrounds />"
      })
    }
    if (url.hostname === "cloud.typography.com") {
      bootstrapRequests.push("authority-fonts")
      return route.fulfill({
        status: 200,
        contentType: "text/css; charset=utf-8",
        body: authorityFonts
      })
    }
    if (url.hostname === "www.googletagmanager.com") {
      bootstrapRequests.push("empty-gtm")
      return route.fulfill({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: ""
      })
    }
    if (url.pathname.startsWith("/api/")) {
      unexpectedApplicationRequests.push(requestLabel)
      return route.abort("blockedbyclient")
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
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
  expect(authorRequests).toHaveLength(1)
  expect(authorRequests[0]).toMatch(/^GET \/api\/get_authors\?exclude=/)
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

  expect(authorRequests).toHaveLength(1)
  expect(unexpectedApplicationRequests).toEqual([])
  expect(productionEscapes).toEqual([])
})
