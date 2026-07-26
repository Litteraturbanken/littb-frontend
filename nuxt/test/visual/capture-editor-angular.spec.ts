import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Route } from "@playwright/test"

import {
  readerFacsimileJpegFile,
  sharedReaderCss
} from "../fixtures/reader-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9017"
const editorPath = "/editor/lb-editor-doktor/ix/1/f"
const scanPath = "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"

const author = {
  authorid: "SöderbergH",
  authorid_norm: "SoderbergH",
  full_name: "Hjalmar Söderberg",
  surname: "Söderberg",
  searchable: true
}

const editorWork = {
  authors: [author],
  endpagename: "-1",
  errata: "<table></table>",
  export: [],
  faksimil_sizes: [3],
  lbworkid: "lb-editor-doktor",
  main_author: author,
  mediatype: "faksimil",
  page_count: 3,
  pages: [
    { pagename: "-3", pageindex: 0, imagenumber: 1 },
    { pagename: "-2", pageindex: 1, imagenumber: 2 },
    { pagename: "-1", pageindex: 2, imagenumber: 3 }
  ],
  pagestep: 1,
  parts: [],
  searchable: true,
  shorttitle: "Doktor Glas",
  sort_date_imprint: { plain: "1905" },
  sourcedesc: "",
  startpagename: "-2",
  title: "Doktor Glas. Roman",
  titleid: "DoktorGlas",
  titlepath: "DoktorGlas",
  width: { size_3: 625 },
  work_authors: [author],
  work_titleid: "DoktorGlas"
}

type Ledger = {
  metadata: string[]
  authors: string[]
  images: string[]
  overlays: string[]
  problems: string[]
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
    ledger.authors.push(label)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ data: [author] })
    })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/api/get_work_info"
    && queryEquals(url, { exclude: "content_vector", lbworkid: "lb-editor-doktor" })) {
    ledger.metadata.push(label)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ hits: 1, data: [editorWork] })
    })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && /^\/txt\/lb-editor-doktor\/lb-editor-doktor_3\/lb-editor-doktor_3_000[23]\.jpeg$/u.test(url.pathname)) {
    ledger.images.push(label)
    return route.fulfill({ status: 200, contentType: "image/jpeg", body: scan })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/txt/lb-editor-doktor/ocr_00001.html"
    && queryEquals(url, { username: "app" })) {
    ledger.overlays.push(label)
    return route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: '<body><div data-size="2500x3600"><span class="w" style="left:300px;top:300px">OCR</span></div></body>'
    })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/red/css/etext.css") {
    return route.fulfill({ status: 200, contentType: "text/css", body: sharedReaderCss })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml") {
    return route.fulfill({ status: 200, contentType: "application/xml", body: "<backgrounds />" })
  }
  if (request.method() === "GET" && url.origin === "https://cloud.typography.com"
    && url.pathname === "/7426274/770508/css/fonts.css") {
    return route.fulfill({ status: 200, contentType: "text/css", body: fonts })
  }
  if (request.method() === "GET" && url.origin === "https://www.googletagmanager.com") {
    return route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
  }
  if (request.method() === "GET" && url.origin === authorityOrigin
    && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/txt/")) {
    return route.continue()
  }

  ledger.unexpected.push(label)
  return route.abort("blockedbyclient")
}

test("captures deterministic Angular editor authority", async ({ page }, testInfo) => {
  const [fonts, scan] = await Promise.all([
    readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
    readFile(readerFacsimileJpegFile)
  ])
  const ledger: Ledger = {
    metadata: [], authors: [], images: [], overlays: [], problems: [], unexpected: []
  }
  page.on("pageerror", error => ledger.problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) {
      ledger.problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  await page.route("**/*", route => routeAuthority(route, ledger, fonts, scan))

  const response = await page.goto(editorPath, { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  await expect.poll(async () => ({
    ready: await page.locator("body.page-reading.ready").count(),
    editor: await page.locator("reading .reader_main.editor.first_load:not(.searching)").count(),
    unexpected: ledger.unexpected
  })).toEqual({ ready: 1, editor: 1, unexpected: [] })

  const image = page.locator("reading img.faksimil")
  await expect(image).toHaveAttribute("src", scanPath)
  await expect(image).toHaveCSS("width", "625px")
  await expect(page.getByRole("link", { name: "Stäng editor" })).toHaveAttribute(
    "href",
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/faksimil"
  )
  const slider = page.getByRole("slider")
  await expect(slider).toHaveAttribute("aria-valuenow", "1")
  await waitForVisualAssets(page)
  await image.evaluate(async element => (element as HTMLImageElement).decode())
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")

  expect(ledger.metadata).toHaveLength(1)
  expect(ledger.authors).toHaveLength(1)
  expect(ledger.images.length).toBeGreaterThanOrEqual(1)
  expect(ledger.overlays).toHaveLength(2)
  expect(ledger.unexpected).toEqual([])
  expect(ledger.problems).toEqual([])
  expect(await slider.evaluate(element => {
    const root = element.closest(".rzslider")
    if (!(root instanceof HTMLElement)) return false
    root.style.setProperty("opacity", "0", "important")
    return true
  })).toBe(true)

  const directory = resolve(import.meta.dirname, "baselines")
  await mkdir(directory, { recursive: true })
  const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
  await page.screenshot({
    path: resolve(directory, `editor-reader-${device}.png`),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css"
  })
})
