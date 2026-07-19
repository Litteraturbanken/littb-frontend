import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Page } from "@playwright/test"

import {
  dramawebbenCatalogAuthors,
  dramawebbenCatalogExpected,
  dramawebbenCatalogResponse
} from "../fixtures/dramawebben-catalog-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9000"
const frontendRoot = resolve(import.meta.dirname, "../../..")
const fsRoot = `/@fs${frontendRoot}`
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const dramaFilter = JSON.stringify({
  "provenance.library": "Dramawebben",
  texttype: "drama"
})
const expectedDramaEntries = [
  ["author_aggregation", "true"],
  ["exclude", "text,parts,sourcedesc,pages,errata"],
  ["filter_and", dramaFilter],
  ["include", "shorttitle,title,lbworkid,titlepath,authors,titleid,mediatype,dramawebben,keyword,startpagename,sortkey"],
  ["show_all", "true"],
  ["sort_field", "sortkey|asc"],
  ["to", "10000"]
] as const

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
  `${fsRoot}/node_modules/font-awesome/scss/font-awesome.scss`,
  `${fsRoot}/node_modules/select2/dist/css/select2.css`,
  `${fsRoot}/node_modules/vite/dist/client/env.mjs`,
  "/@vite/client",
  "/img/SA_logo_type.svg",
  "/img/SA_logo_type.svg?import&url",
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
  "/views/dramaweb.html",
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

type CatalogCase = {
  kind: "plays" | "authors" | "ranges"
  route: string
  openRanges: boolean
}

const catalogCases: CatalogCase[] = [
  { kind: "plays", route: "/dramawebben/pjäser", openRanges: false },
  { kind: "authors", route: "/dramawebben/pjäser?visa=författare", openRanges: false },
  { kind: "ranges", route: "/dramawebben/pjäser", openRanges: true }
]

function staticKey(url: URL) {
  return `${url.pathname}${url.search}`
}

function exactEntries(url: URL, expected: ReadonlyArray<readonly [string, string]>) {
  return JSON.stringify([...url.searchParams.entries()]) === JSON.stringify(expected)
}

async function waitForCatalog(page: Page, expectedRows: readonly string[]) {
  const table = page.locator("dramaweb-page table.contenttable")
  await expect(table).toBeVisible()
  await expect(table.locator("tr")).toHaveCount(expectedRows.length)
  await expect.poll(async () => await table.locator("tr").evaluateAll(rows => rows.map(
    row => row.textContent?.replace(/\s+/gu, " ").trim()
  ))).toEqual(expectedRows)
}

let authorityFonts: Buffer
let dramaBackground: Buffer
let dramaFadeBackground: Buffer
let dramaLogo: Buffer
const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XOSQAAAAAElFTkSuQmCC",
  "base64"
)

test.beforeAll(async () => {
  ;[authorityFonts, dramaBackground, dramaFadeBackground, dramaLogo] = await Promise.all([
    readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
    readFile(resolve(import.meta.dirname, "../../../app/img/dramawebben.jpg")),
    readFile(resolve(import.meta.dirname, "../../../app/img/dramawebben_fade.jpg")),
    readFile(resolve(import.meta.dirname, "../../../app/img/dramawebben_vit.svg"))
  ])
})

for (const catalogCase of catalogCases) {
  test(`captures the populated Angular Dramawebben ${catalogCase.kind} authority`, async ({ page }, testInfo) => {
    test.skip(catalogCase.openRanges && testInfo.project.name === "angular-mobile")

    const expectedDocument = new URL(catalogCase.route, authorityOrigin)
    const authorRequests: string[] = []
    const dramaRequests: string[] = []
    const shellRequests: string[] = []
    const bootstrapRequests: string[] = []
    const assetRequests: string[] = []
    const rejectedProbes: string[] = []
    const unexpectedRequests: string[] = []
    const productionRequests: string[] = []
    const problems: string[] = []
    let probing = false

    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (!probing && ["error", "warning"].includes(message.type())) {
        problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })

    await page.route("**/*", route => {
      const request = route.request()
      const url = new URL(request.url())
      const label = `${request.method()} ${request.url()}`

      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/api/get_authors"
        && exactEntries(url, [["exclude", authorExclude]])) {
        authorRequests.push(label)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ data: dramawebbenCatalogAuthors })
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/api/list_all/etext,faksimil,pdf,infopost"
        && exactEntries(url, expectedDramaEntries)) {
        dramaRequests.push(label)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify(dramawebbenCatalogResponse)
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml"
        && exactEntries(url, [["username", "app"]])) {
        bootstrapRequests.push(label)
        return route.fulfill({ status: 200, contentType: "application/xml", body: "<backgrounds />" })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/red/css/etext.css" && url.search === "") {
        bootstrapRequests.push(label)
        return route.fulfill({ status: 200, contentType: "text/css", body: "" })
      }
      if (request.method() === "GET" && url.origin === "https://cloud.typography.com"
        && url.pathname === "/7426274/770508/css/fonts.css" && url.search === "") {
        bootstrapRequests.push(label)
        return route.fulfill({ status: 200, contentType: "text/css", body: authorityFonts })
      }
      if (request.method() === "GET" && url.origin === "https://www.googletagmanager.com"
        && url.pathname === "/gtag/js"
        && exactEntries(url, [["id", "UA-132486790-1"]])) {
        bootstrapRequests.push(label)
        return route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.search === "" && url.pathname === "/img/dramawebben_vit.svg") {
        assetRequests.push(label)
        return route.fulfill({ status: 200, contentType: "image/svg+xml", body: dramaLogo })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.search === "" && url.pathname === "/components/select2/select2x2.png") {
        assetRequests.push(label)
        return route.fulfill({ status: 200, contentType: "image/png", body: transparentPng })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.search === ""
        && ["/img/dramawebben.jpg", "/img/dramawebben_fade.jpg"].includes(url.pathname)) {
        assetRequests.push(label)
        return route.fulfill({
          status: 200,
          contentType: "image/jpeg",
          body: url.pathname.endsWith("_fade.jpg") ? dramaFadeBackground : dramaBackground
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && (url.href === expectedDocument.href
          || allowedShellStaticRequests.has(staticKey(url)))) {
        shellRequests.push(label)
        return route.continue()
      }

      if (probing) rejectedProbes.push(label)
      else if (url.origin === authorityOrigin) unexpectedRequests.push(label)
      else productionRequests.push(label)
      return route.abort("blockedbyclient")
    })

    const response = await page.goto(catalogCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect.poll(async () => (await page.locator("body").getAttribute("class"))
      ?.split(/\s+/u).filter(value => value && value !== "ng-scope").sort())
      .toEqual(["drama-dramasubpage", "focus", "page-dramaweb", "ready"])
    await expect(page.locator("dramaweb-page ul.links li.active a"))
      .toHaveAttribute("href", "/dramawebben/pjäser")
    await expect(page.locator("dramaweb-page .page_content > div"))
      .toContainText("I Dramawebben hittar du pjäser som har mer metadata")

    const expectedRows = catalogCase.kind === "authors"
      ? dramawebbenCatalogExpected.authors
      : dramawebbenCatalogExpected.plays
    await waitForCatalog(page, expectedRows)

    if (catalogCase.openRanges) {
      const rangeButton = page.getByRole("button", { name: "Akter och roller", exact: true })
      await expect(rangeButton).toHaveCount(1)
      await rangeButton.click()
      await expect(page.locator(".controls .dropdown-menu")).toBeVisible()
      await expect(page.locator(".controls .dropdown-menu [role=menuitem]")).toHaveCount(7)
    } else {
      await expect(page.locator(".controls .btn-group.open")).toHaveCount(0)
      await expect(page.locator(".controls .dropdown-menu")).toHaveCSS("opacity", "0")
    }

    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    expect(authorRequests).toHaveLength(1)
    expect(dramaRequests).toHaveLength(1)
    expect([...new URL(authorRequests[0]!.replace(/^GET /u, "")).searchParams.entries()])
      .toEqual([["exclude", authorExclude]])
    expect([...new URL(dramaRequests[0]!.replace(/^GET /u, "")).searchParams.entries()])
      .toEqual(expectedDramaEntries)
    const shellUrls = shellRequests.map(label => new URL(label.replace(/^GET /u, "")))
    expect(shellUrls.filter(url => url.href === expectedDocument.href)).toHaveLength(1)
    expect(shellUrls.filter(url => allowedShellStaticRequests.has(staticKey(url)))
      .map(staticKey).sort()).toEqual([...allowedShellStaticRequests].sort())
    expect(shellRequests).toHaveLength(allowedShellStaticRequests.size + 1)
    expect(bootstrapRequests.sort()).toEqual([
      `GET ${authorityOrigin}/red/bilder/bakgrundsbilder/backgrounds.xml?username=app`,
      `GET ${authorityOrigin}/red/css/etext.css`,
      "GET https://cloud.typography.com/7426274/770508/css/fonts.css",
      "GET https://www.googletagmanager.com/gtag/js?id=UA-132486790-1"
    ].sort())
    expect(assetRequests.sort()).toEqual([
      `GET ${authorityOrigin}/img/dramawebben.jpg`,
      `GET ${authorityOrigin}/img/dramawebben_fade.jpg`,
      `GET ${authorityOrigin}/img/dramawebben_vit.svg`,
      ...(catalogCase.kind === "authors"
        ? []
        : [`GET ${authorityOrigin}/components/select2/select2x2.png`])
    ].sort())
    expect(unexpectedRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(problems).toEqual([])

    const duplicateFilter = new URL(
      "/api/list_all/etext,faksimil,pdf,infopost",
      authorityOrigin
    )
    for (const [key, value] of expectedDramaEntries) duplicateFilter.searchParams.append(key, value)
    duplicateFilter.searchParams.append("filter_and", dramaFilter)
    const probes = [
      { method: "GET", url: `${authorityOrigin}/scripts/dramawebben-catalog-unlisted.js` },
      { method: "GET", url: `${authorityOrigin}/api/dramawebben-catalog-unlisted` },
      { method: "GET", url: duplicateFilter.href },
      { method: "POST", url: expectedDocument.href },
      { method: "GET", url: "https://red.litteraturbanken.se/red/dramawebben/catalog-unlisted.html" }
    ]
    probing = true
    const probeResults = await page.evaluate(async values => await Promise.all(values.map(
      async probe => {
        try {
          await fetch(probe.url, { method: probe.method })
          return true
        } catch {
          return false
        }
      }
    )), probes)
    probing = false
    expect(probeResults).toEqual(probes.map(() => false))
    expect(rejectedProbes.sort()).toEqual(probes.map(
      probe => `${probe.method} ${new URL(probe.url).href}`
    ).sort())
    expect(unexpectedRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(problems).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `dramawebben-catalog-${catalogCase.kind}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })
  })
}
