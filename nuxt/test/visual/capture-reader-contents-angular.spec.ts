import { createHash } from "node:crypto"
import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Request, type Route } from "@playwright/test"

import {
  readerPageHtmlByIndex,
  readerPartsWorkInfoResponse,
  sharedReaderCss,
  workReaderCss
} from "../fixtures/reader-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"
import { allowedShellStaticRequests } from "./angular-reader-shell-static"

test.use({ serviceWorkers: "block" })

const angularPort = Number(process.env.LITTB_ANGULAR_TEST_PORT || 3046)
const authorityOrigin = `http://127.0.0.1:${angularPort}`
const readerPath = "/författare/SöderbergH/titlar/DoktorGlasParts/sida/-2/etext"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const allowedShellDocuments = [
  `${authorityOrigin}${readerPath}`,
  `${authorityOrigin}${readerPath}?innehall`
].map(value => new URL(value))

const existingReaderBaselineManifest = {
  "reader-hit-ordinary-desktop.png": "cd159a40e3240784a49e26c66a84e7596c160fe8c0a2049fa7d99482d7dacae2",
  "reader-hit-ordinary-mobile.png": "6704cc0c2c0f45fe911f6fa2423613205571af744fdbf0cea79884cef5e2527c",
  "reader-hit-phrase-middle-desktop.png": "76036ed9a8b90c08f33d958c7e72ca42ef87ae880c7adfa87f8dd8864f63a3bc",
  "reader-hit-phrase-middle-mobile.png": "768d1511029e338e2639056ffd6fb9b51225f3d14e52b6954409ca2961f72a7d",
  "reader-hit-single-first-desktop.png": "bed4ccdd519256e789ea08b3e9b43f58e94bdefee4863e918a323888f5a1bf58",
  "reader-hit-single-first-mobile.png": "ee5319adad7855afddb16df53ed0f242c22194bdc520136f0c97df3a3d55572d",
  "reader-faksimil-default-desktop.png": "19991017ec6c326207faadeb205a08272f2b4f254b99c5487765e79a09c799e5",
  "reader-faksimil-default-mobile.png": "088f887690d3fab179906ccbec53ef2cf1f766b13ee9be65efebe3fae1863a84",
  "reader-faksimil-large-desktop.png": "cb13435ba3c77c40d001d2f55b80a53932ab37b07d73f28b61e403ebf990a922",
  "reader-faksimil-large-mobile.png": "0470d4d1d97a5efe0e5410cc596cc5e30589ecf1f2bc70348cb940aebf9d1739"
} as const

const readerContentsBaselineManifest = {
  "reader-contents-closed-desktop.png": "d4a0b28793b5ceb151d7831ee3d69f13e311dae1e3d860914cd7a7fe739297e2",
  "reader-contents-closed-mobile.png": "f2eb46f2b574e0b6283aa53f8a6d70ce520f9c64a7ced6468ae7da83facaa632",
  "reader-contents-open-desktop.png": "76fc17211cc6e4f35393590e19e6673f83019dcea9517326f3c6904c83681793",
  "reader-contents-open-mobile.png": "3c0f9db2ef3dab36a89cc9f708311c2a01363bc9646eb5bbeef160776e5d2287"
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
    authorid: "MörikeE",
    authorid_norm: "MorikeE",
    full_name: "Eduard Mörike",
    surname: "Mörike",
    searchable: true
  },
  {
    authorid: "RilkeRM",
    authorid_norm: "RilkeRM",
    full_name: "Rainer Maria Rilke",
    surname: "Rilke",
    searchable: true
  },
  {
    authorid: "ShelleyPB",
    authorid_norm: "ShelleyPB",
    full_name: "Percy Bysshe Shelley",
    surname: "Shelley",
    searchable: true
  }
] as const

const legacyWork = (() => {
  const frozen = readerPartsWorkInfoResponse.data[0]!
  const mainAuthor = authors[0]
  return {
    ...frozen,
    titleid: "DoktorGlasParts",
    work_titleid: "DoktorGlasParts",
    page_count: frozen.pages.length,
    pagestep: 1,
    pages: frozen.pages.map(page => ({ ...page, imagenumber: page.pageindex })),
    authors: [mainAuthor],
    main_author: mainAuthor,
    work_authors: [mainAuthor],
    export: [],
    errata: "<table></table>",
    sourcedesc: "",
    mediatypes: ["etext"],
    searchable: true,
    keyword: [],
    texttype: "prose"
  }
})()

type Ledger = {
  authors: string[]
  background: string[]
  fonts: string[]
  gtm: string[]
  ornament: string[]
  pages: string[]
  problems: string[]
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

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex")
}

async function assertBaselineManifest(manifest: Record<string, string>) {
  const directory = resolve(import.meta.dirname, "baselines")
  for (const [filename, expectedHash] of Object.entries(manifest)) {
    const bytes = await readFile(resolve(directory, filename))
    expect(sha256(bytes), filename).toBe(expectedHash)
  }
}

async function routeAuthorityRequest(route: Route, ledger: Ledger, authorityFonts: Buffer) {
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
      authorid: "SöderbergH",
      exclude: "content_vector",
      titlepath: "DoktorGlasParts"
    })
  ) {
    ledger.work.push(label)
    return route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ hits: 1, data: [legacyWork] })
    })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/txt/lb-reader-doktor-glas-parts/res_00003.html" &&
    queryEquals(url, { username: "app" })
  ) {
    ledger.pages.push(label)
    return route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<html><body>${readerPageHtmlByIndex[2]}</body></html>`
    })
  }
  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/txt/lb-reader-doktor-glas-parts/res_00004.html" &&
    url.search === ""
  ) {
    ledger.pages.push(label)
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<html />" })
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
    url.pathname === "/txt/css/lb-reader-doktor-glas-parts-etext.css" &&
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
  if (isAllowedShellRequest(request, url)) {
    ledger.shell.push(label)
    return route.continue()
  }

  ledger.unexpected.push(label)
  return route.abort("blockedbyclient")
}

test.beforeAll(async () => {
  await assertBaselineManifest(existingReaderBaselineManifest)
  await assertBaselineManifest(readerContentsBaselineManifest)
})

test.afterAll(async () => {
  await assertBaselineManifest(existingReaderBaselineManifest)
  await assertBaselineManifest(readerContentsBaselineManifest)
})

const visualCases = [
  { name: "closed", angularRoute: readerPath, open: false },
  { name: "open", angularRoute: `${readerPath}?innehall`, open: true }
] as const

for (const visualCase of visualCases) {
  test(`captures the Angular Reader contents ${visualCase.name} authority`, async ({ browser, page }, testInfo) => {
    const authorityFonts = await readFile(
      resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")
    )
    const ledger = emptyLedger()
    const probeLedger = emptyLedger()
    const probePage = await browser.newPage()
    await probePage.route("**/*", route => routeAuthorityRequest(route, probeLedger, authorityFonts))

    const exactWork = new URL("/api/get_work_info", authorityOrigin)
    exactWork.searchParams.set("authorid", "SöderbergH")
    exactWork.searchParams.set("exclude", "content_vector")
    exactWork.searchParams.set("titlepath", "DoktorGlasParts")
    const extraMetadata = new URL(exactWork)
    extraMetadata.searchParams.set("extra", "blocked")
    const duplicateMetadata = new URL(exactWork)
    duplicateMetadata.searchParams.append("authorid", "SöderbergH")
    const extraAuthors = new URL("/api/get_authors", authorityOrigin)
    extraAuthors.searchParams.set("exclude", authorExclude)
    extraAuthors.searchParams.set("extra", "blocked")
    const duplicateAuthors = new URL("/api/get_authors", authorityOrigin)
    duplicateAuthors.searchParams.append("exclude", authorExclude)
    duplicateAuthors.searchParams.append("exclude", authorExclude)
    const undeclaredAuthor = new URL("/api/get_author/Unknown", authorityOrigin)
    const unlistedPage = new URL(
      "/txt/lb-reader-doktor-glas-parts/res_00005.html?username=app",
      authorityOrigin
    )
    const unlistedStyle = new URL("/txt/css/unlisted-reader-etext.css", authorityOrigin)
    const unlistedStatic = new URL("/assets/reader-contents-negative-probe.js", authorityOrigin)
    const faksimil = new URL("/txt/lb-reader-doktor-glas-parts/faksimil/3.jpg", authorityOrigin)
    const ocr = new URL("/api/reader_ocr/lb-reader-doktor-glas-parts/3", authorityOrigin)
    const search = new URL(
      "/api/search_document/lb-reader-doktor-glas-parts/etext/glas/?init_hits=20&word_form_only=true",
      authorityOrigin
    )
    const reorderedShellDocument = new URL(allowedShellDocuments[1]!)
    const reorderedEntries = [...reorderedShellDocument.searchParams.entries()].reverse()
    reorderedShellDocument.search = ""
    for (const [key, value] of reorderedEntries) reorderedShellDocument.searchParams.append(key, value)
    const duplicatedShellDocument = new URL(reorderedShellDocument)
    duplicatedShellDocument.searchParams.append("innehall", "")
    const extraShellDocument = new URL(reorderedShellDocument)
    extraShellDocument.searchParams.set("extra", "blocked")
    expect(isAllowedShellDocument(reorderedShellDocument)).toBe(true)
    expect(isAllowedShellDocument(duplicatedShellDocument)).toBe(false)
    expect(isAllowedShellDocument(extraShellDocument)).toBe(false)

    const blockedProbeUrls = [
      extraMetadata,
      duplicateMetadata,
      extraAuthors,
      duplicateAuthors,
      undeclaredAuthor,
      unlistedPage,
      unlistedStyle,
      unlistedStatic,
      faksimil,
      ocr,
      search,
      duplicatedShellDocument,
      extraShellDocument
    ]
    for (const probeUrl of blockedProbeUrls) {
      await probePage.goto(probeUrl.toString()).catch(() => null)
    }
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

    const currentPart = page.locator("#toolkit-right .current_part")
    await expect(currentPart.locator(".navtitle")).toHaveText("Överlappningen")
    await expect(currentPart.locator(".header")).toContainText("Rilke, Shelley")
    const currentPartAuthors = currentPart.locator(".header a[ng-repeat]")
    await expect(currentPartAuthors).toHaveCount(2)
    await expect(currentPartAuthors.nth(0)).toHaveAttribute("href", "/författare/RilkeRM")
    await expect(currentPartAuthors.nth(1)).toHaveAttribute("href", "/författare/ShelleyPB")

    const pager = page.locator("#toolkit-right .pager_ctrls")
    const prevPart = pager.locator("a.prev_part")
    const nextPart = pager.locator("a.next_part")
    const firstPage = pager.getByText("Gå till första sidan", { exact: true })
    const lastPage = pager.getByText("Gå till sista sidan", { exact: true })
    const basePagePath = "/författare/SöderbergH/titlar/DoktorGlasParts/sida"
    const contentsSuffix = visualCase.open ? "?innehall" : ""
    await expect(prevPart).toHaveAttribute("href", `${basePagePath}/-3/etext${contentsSuffix}`)
    await expect(nextPart).toHaveAttribute("href", `${basePagePath}/3/etext${contentsSuffix}`)
    await expect(firstPage).toHaveAttribute("href", `${basePagePath}/-3/etext${contentsSuffix}`)
    await expect(lastPage).toHaveAttribute("href", `${basePagePath}/5/etext${contentsSuffix}`)
    await expect(prevPart).not.toHaveClass(/\bdisabled\b/)
    await expect(nextPart).not.toHaveClass(/\bdisabled\b/)
    await expect(firstPage).not.toHaveClass(/\bdisabled\b/)
    await expect(lastPage).not.toHaveClass(/\bdisabled\b/)
    await expect(page.getByText("Innehållsförteckning", { exact: true })).toBeVisible()

    const chaptersWindow = page.locator(".chapters.modal")
    if (visualCase.open) {
      await expect(chaptersWindow).toHaveCount(1)
      await expect(chaptersWindow).toBeVisible()
      await expect(page.locator(".chapters-modal .header h2.author")).toHaveText("Hjalmar Söderberg")
      await expect(page.locator(".chapters-modal .header h2.title")).toHaveText(
        "Doktor Glas delar. Roman (1905)"
      )
      const rows = page.locator(".chapters-modal .part_menu > li")
      await expect(rows).toHaveCount(5)
      await expect(rows.locator("a")).toHaveText([
        "Yttre delen",
        "Mellandelen",
        "Överlappningen",
        "Senare delen",
        "Samma start"
      ])
      expect(await rows.evaluateAll(elements => elements.map(element =>
        [...element.querySelectorAll("span.author")].map(author =>
          (author.textContent || "").replace(/[,\s]+$/g, "").trim()
        )
      ))).toEqual([
        ["Söderberg"],
        ["Mörike"],
        ["Rilke", "Shelley"],
        ["Söderberg"],
        ["Mörike"]
      ])
      const expectedStarts = ["-4", "-3", "-2", "3", "3"]
      for (const [index, start] of expectedStarts.entries()) {
        await expect(rows.nth(index).locator("a")).toHaveAttribute(
          "href",
          `${basePagePath}/${start}/etext?innehall`
        )
      }
      await expect(page.locator(".chapters-modal button.close_btn")).toHaveText("Stäng")
      await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/)
      await expect(page.locator(".modal-backdrop")).toHaveCount(1)
      await expect(page.locator(".modal-backdrop")).toHaveClass(/\bin\b/)
    } else {
      await expect(chaptersWindow).toHaveCount(0)
      await expect(page.locator("body")).not.toHaveClass(/\bmodal-open\b/)
      await expect(page.locator(".modal-backdrop")).toHaveCount(0)
    }

    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    await expect(page.locator("html")).toHaveCSS("background-image", "none")
    expect(await page.locator("img").evaluateAll(images => images.every(image => image.complete))).toBe(true)

    expect(ledger.authors).toHaveLength(1)
    expect(ledger.work).toHaveLength(1)
    expect(ledger.pages.filter(label => label.includes("res_00003.html?username=app"))).toHaveLength(1)
    expect(ledger.pages.filter(label => label.endsWith("res_00004.html"))).toHaveLength(1)
    expect(ledger.pages).toHaveLength(2)
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
    expect(probeLedger.unexpected).toEqual(blockedProbeUrls.map(url => `GET ${url.toString()}`))

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `reader-contents-${visualCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })

    expect(ledger.unexpected).toEqual([])
    expect(ledger.problems).toEqual([])
  })
}
