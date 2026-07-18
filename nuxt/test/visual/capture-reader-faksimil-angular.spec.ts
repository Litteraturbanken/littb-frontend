import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Request, type Route } from "@playwright/test"

import {
  readerFacsimileJpegFile,
  readerFacsimileWorkInfoResponse,
  sharedReaderCss
} from "../fixtures/reader-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9015"
const readerPath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const allowedShellDocuments = [
  `${authorityOrigin}${readerPath}`,
  `${authorityOrigin}${readerPath}?storlek=4`
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
  const frozen = readerFacsimileWorkInfoResponse.data[0]!
  const author = {
    authorid: "LagerlöfS",
    authorid_norm: "LagerlofS",
    full_name: "Selma Lagerlöf",
    surname: "Lagerlöf",
    searchable: true
  }
  return {
    ...frozen,
    titleid: "GostaBerlingsSaga",
    work_titleid: "GostaBerlingsSaga",
    endpagename: "5",
    page_count: 3,
    pagestep: 1,
    parts: [{
      startpagename: "1",
      endpagename: "5",
      title: "Gösta Berlings saga",
      navtitle: "Gösta Berlings saga",
      shorttitle: "Gösta Berlings saga",
      authors: [{ authorid: author.authorid }]
    }],
    authors: [author],
    main_author: author,
    work_authors: [author],
    export: [],
    errata: "<table></table>",
    sourcedesc: "",
    mediatypes: ["faksimil"],
    searchable: false,
    keyword: [],
    texttype: "prose"
  }
})()

type Ledger = {
  authors: string[]
  background: string[]
  fonts: string[]
  gtm: string[]
  html: string[]
  images: string[]
  ocr: string[]
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
    html: [],
    images: [],
    ocr: [],
    problems: [],
    search: [],
    shell: [],
    styles: [],
    unexpected: [],
    work: []
  }
}

function scanPath(size: number, imageNumber: number) {
  const padded = String(imageNumber).padStart(4, "0")
  return `/txt/lb-reader-gosta-berlings-saga/lb-reader-gosta-berlings-saga_${size}/` +
    `lb-reader-gosta-berlings-saga_${size}_${padded}.jpeg`
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

async function routeAuthorityRequest(
  route: Route,
  ledger: Ledger,
  authorityFonts: Buffer,
  scanJpeg: Buffer,
  allowedImages: Set<string>
) {
  const request = route.request()
  const url = new URL(request.url())
  const label = requestLabel(route)

  if (
    request.method() === "GET" &&
    url.origin === authorityOrigin &&
    url.pathname === "/red/css/etext.css" &&
    url.search === ""
  ) {
    ledger.styles.push(label)
    return route.fulfill({
      status: 200,
      contentType: "text/css; charset=utf-8",
      body: sharedReaderCss
    })
  }
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
      authorid: "LagerlöfS",
      exclude: "content_vector",
      titlepath: "GostaBerlingsSaga"
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
    url.search === "" &&
    allowedImages.has(url.pathname)
  ) {
    ledger.images.push(label)
    return route.fulfill({ status: 200, contentType: "image/jpeg", body: scanJpeg })
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
  if (url.pathname.includes("/search_document/") || url.pathname.includes("/search-hits")) {
    ledger.search.push(label)
  }
  if (/\/txt\/[^/]+\/ocr_\d+\.html$/.test(url.pathname)) ledger.ocr.push(label)
  if (/\/txt\/[^/]+\/res_\d+\.html$/.test(url.pathname)) ledger.html.push(label)
  if (isAllowedShellRequest(request, url)) {
    ledger.shell.push(label)
    return route.continue()
  }

  ledger.unexpected.push(label)
  return route.abort("blockedbyclient")
}

const visualCases = [
  {
    name: "default",
    angularRoute: readerPath,
    size: 3,
    width: 625,
    srcset: `${scanPath(3, 9)} 1x,${scanPath(5, 9)} 2x`
  },
  {
    name: "large",
    angularRoute: `${readerPath}?storlek=4`,
    size: 4,
    width: 900,
    srcset: null
  }
] as const

for (const visualCase of visualCases) {
  test(`captures the Angular faksimil Reader ${visualCase.name} authority`, async ({
    browser,
    page
  }, testInfo) => {
    const [authorityFonts, scanJpeg] = await Promise.all([
      readFile(resolve(
        import.meta.dirname,
        "../../../app/styles/fonts/601526/32FBEBA806C948833.css"
      )),
      readFile(readerFacsimileJpegFile)
    ])
    const expectedCurrentSize = visualCase.size === 3 && testInfo.project.name === "angular-mobile"
      ? 5
      : visualCase.size
    const expectedPrefetchSize = visualCase.size === 3 ? 5 : 4
    const expectedImages = [
      scanPath(expectedCurrentSize, 9),
      scanPath(expectedPrefetchSize, 12)
    ]
    const allowedImages = new Set(expectedImages)
    const ledger = emptyLedger()
    const probeLedger = emptyLedger()
    const probePage = await browser.newPage()
    await probePage.route("**/*", route => routeAuthorityRequest(
      route,
      probeLedger,
      authorityFonts,
      scanJpeg,
      allowedImages
    ))
    const extraMetadata = new URL("/api/get_work_info", authorityOrigin)
    extraMetadata.searchParams.set("authorid", "LagerlöfS")
    extraMetadata.searchParams.set("exclude", "content_vector")
    extraMetadata.searchParams.set("titlepath", "GostaBerlingsSaga")
    extraMetadata.searchParams.set("extra", "blocked")
    const duplicateAuthors = new URL("/api/get_authors", authorityOrigin)
    duplicateAuthors.searchParams.append("exclude", authorExclude)
    duplicateAuthors.searchParams.append("exclude", authorExclude)
    const invalidImage = new URL(scanPath(2, 9), authorityOrigin)
    const ocrProbe = new URL(
      "/txt/lb-reader-gosta-berlings-saga/ocr_00001.html",
      authorityOrigin
    )
    const searchProbe = new URL(
      "/api/search_document/lb-reader-gosta-berlings-saga/faksimil/gosta/" +
        "?init_hits=20&word_form_only=true",
      authorityOrigin
    )
    const unlistedStatic = new URL("/assets/task-5-negative-probe.js", authorityOrigin)
    const reorderedShellDocument = new URL(allowedShellDocuments[1]!)
    const reorderedEntries = [...reorderedShellDocument.searchParams.entries()].reverse()
    reorderedShellDocument.search = ""
    for (const [key, value] of reorderedEntries) reorderedShellDocument.searchParams.append(key, value)
    const duplicateShellDocument = new URL(reorderedShellDocument)
    duplicateShellDocument.searchParams.append("storlek", "4")
    expect(isAllowedShellDocument(reorderedShellDocument)).toBe(true)
    expect(isAllowedShellDocument(duplicateShellDocument)).toBe(false)
    for (const probe of [
      new URL("/data.json", authorityOrigin),
      extraMetadata,
      invalidImage,
      ocrProbe,
      searchProbe,
      unlistedStatic,
      duplicateAuthors,
      duplicateShellDocument
    ]) {
      await probePage.goto(probe.toString()).catch(() => null)
    }
    await probePage.close()

    page.on("pageerror", error => ledger.problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) {
        ledger.problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })
    await page.route("**/*", route => routeAuthorityRequest(
      route,
      ledger,
      authorityFonts,
      scanJpeg,
      allowedImages
    ))

    const response = await page.goto(visualCase.angularRoute, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect.poll(async () => ({
      ready: await page.locator("body.page-reading.ready").count(),
      reader: await page.locator("reading .reader_main.first_load:not(.searching)").count(),
      unexpected: ledger.unexpected
    })).toEqual({ ready: 1, reader: 1, unexpected: [] })

    const image = page.locator("reading .img_area img.faksimil")
    await expect(image).toHaveAttribute("src", scanPath(visualCase.size, 9))
    if (visualCase.srcset) {
      await expect(image).toHaveAttribute("srcset", visualCase.srcset)
    } else {
      await expect(image).not.toHaveAttribute("srcset", /./)
    }
    await expect(image).not.toHaveAttribute("height", /./)
    await expect(image).toHaveCSS("width", `${visualCase.width}px`)
    await expect(page.locator("reading .img_area")).toHaveCSS("width", `${visualCase.width}px`)
    await expect(image).toHaveJSProperty(
      "currentSrc",
      `${authorityOrigin}${scanPath(expectedCurrentSize, 9)}`
    )

    const sizePicker = page.locator("#toolkit .size_picker").first()
    await expect(sizePicker.locator("h2")).toHaveText("Ändra storlek")
    await expect(sizePicker.getByRole("button", { name: "Mindre" })).toBeEnabled()
    await expect(sizePicker.getByRole("button", { name: "Större" })).toBeEnabled()
    const rotationPicker = page.locator("#toolkit .size_picker").nth(1)
    if (testInfo.project.name === "angular-mobile") {
      await expect(rotationPicker).toBeHidden()
    } else {
      await expect(rotationPicker).toBeVisible()
      await expect(rotationPicker.locator("h2")).toHaveText("Rotera")
      await expect(rotationPicker.getByRole("button", { name: "Vänster" })).toBeVisible()
      await expect(rotationPicker.getByRole("button", { name: "Höger" })).toBeVisible()
    }

    await waitForVisualAssets(page)
    await expect.poll(() => image.evaluate(element => {
      const scan = element as HTMLImageElement
      return scan.complete && scan.naturalWidth > 0 && scan.naturalHeight > 0
    })).toBe(true)
    await image.evaluate(async element => (element as HTMLImageElement).decode())
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    await expect(page.locator("html")).toHaveCSS("background-image", "none")
    const imageBox = await image.boundingBox()
    expect(imageBox?.width).toBe(visualCase.width)
    expect(imageBox?.height).toBeCloseTo(visualCase.width * 1308 / 1900, 1)
    if (testInfo.project.name === "angular-mobile") {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeGreaterThan(390)
    }

    expect(ledger.authors).toHaveLength(1)
    expect(ledger.work).toHaveLength(1)
    expect(ledger.images.map(label => new URL(label.replace(/^GET /, "")).pathname).sort())
      .toEqual([...expectedImages].sort())
    expect(ledger.html).toEqual([])
    expect(ledger.ocr).toEqual([])
    expect(ledger.search).toEqual([])
    expect(ledger.styles).toHaveLength(1)
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
    expect(probeLedger.ocr).toEqual([`GET ${ocrProbe.toString()}`])
    expect(probeLedger.search).toEqual([`GET ${searchProbe.toString()}`])
    expect(probeLedger.unexpected).toEqual([
      `GET ${authorityOrigin}/data.json`,
      `GET ${extraMetadata.toString()}`,
      `GET ${invalidImage.toString()}`,
      `GET ${ocrProbe.toString()}`,
      `GET ${searchProbe.toString()}`,
      `GET ${unlistedStatic.toString()}`,
      `GET ${duplicateAuthors.toString()}`,
      `GET ${duplicateShellDocument.toString()}`
    ])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `reader-faksimil-${visualCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })

    expect(ledger.unexpected).toEqual([])
    expect(ledger.problems).toEqual([])
  })
}
