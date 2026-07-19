import { createHash } from "node:crypto"
import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Page } from "@playwright/test"

import { dramawebbenCases } from "../fixtures/dramawebben-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9000"
const managedOrigin = "https://red.litteraturbanken.se"
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

function shellStaticKey(url: URL) {
  return `${url.pathname}${url.search}`
}

function exactEntries(url: URL, expected: ReadonlyArray<readonly [string, string]>) {
  return JSON.stringify([...url.searchParams.entries()]) === JSON.stringify(expected)
}

async function decodedBodyBackground(page: Page) {
  return await page.locator("body.page-dramaweb").evaluate(async body => {
    const backgroundImage = getComputedStyle(body).backgroundImage
    const match = backgroundImage.match(/^url\(["']?(.+?)["']?\)$/u)
    if (!match) {
      return { backgroundImage, url: null, naturalWidth: 0, naturalHeight: 0 }
    }

    const image = new Image()
    image.src = new URL(match[1]!, document.baseURI).href
    await image.decode()
    return {
      backgroundImage,
      url: image.src,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight
    }
  })
}

type Fixture = {
  body: Buffer
  sourceHash: string
}

let authorityFonts: Buffer
let dramaBackground: Buffer
let dramaFadeBackground: Buffer
let dramaLogo: Buffer
let managedFixtures: Map<string, Fixture>

test.beforeAll(async () => {
  ;[authorityFonts, dramaBackground, dramaFadeBackground, dramaLogo] = await Promise.all([
    readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
    readFile(resolve(import.meta.dirname, "../../../app/img/dramawebben.jpg")),
    readFile(resolve(import.meta.dirname, "../../../app/img/dramawebben_fade.jpg")),
    readFile(resolve(import.meta.dirname, "../../../app/img/dramawebben_vit.svg"))
  ])
  managedFixtures = new Map(await Promise.all(dramawebbenCases
    .filter(documentCase => documentCase.sourcePath !== null)
    .map(async documentCase => {
      const body = await readFile(resolve(
        import.meta.dirname,
        `../fixtures/dramawebben-content/${documentCase.fixture}`
      ))
      expect(createHash("sha256").update(body).digest("hex")).toBe(documentCase.sourceHash)
      return [documentCase.sourcePath, { body, sourceHash: documentCase.sourceHash }] as const
    })))
})

for (const documentCase of dramawebbenCases) {
  test(`captures the Angular Dramawebben ${documentCase.kind} authority`, async ({ page }, testInfo) => {
    expect(testInfo.project.use.baseURL).toBe(authorityOrigin)
    const expectedShellDocument = new URL(documentCase.route, authorityOrigin)
    const shellRequests: string[] = []
    const authorRequests: string[] = []
    const dramaRequests: string[] = []
    const managedRequests: string[] = []
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
          body: JSON.stringify({ data: [] })
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/api/list_all/etext,faksimil,pdf,infopost"
        && exactEntries(url, expectedDramaEntries)) {
        dramaRequests.push(label)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ data: [], author_aggregation: [] })
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.search === "" && managedFixtures.has(url.pathname)) {
        managedRequests.push(label)
        return route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: managedFixtures.get(url.pathname)!.body
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
        && (url.href === expectedShellDocument.href
          || allowedShellStaticRequests.has(shellStaticKey(url)))) {
        shellRequests.push(label)
        return route.continue()
      }

      if (probing) {
        rejectedProbes.push(label)
      } else if (url.origin !== authorityOrigin) {
        productionRequests.push(label)
      } else {
        unexpectedRequests.push(label)
      }
      return route.abort("blockedbyclient")
    })

    const response = await page.goto(documentCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    const expectedBodyClasses = documentCase.kind === "start"
      ? ["focus", "page-dramaweb", "ready"]
      : ["drama-dramasubpage", "focus", "page-dramaweb", "ready"]
    await expect.poll(async () => (await page.locator("body").getAttribute("class"))
      ?.split(/\s+/u).filter(value => value && value !== "ng-scope").sort())
      .toEqual(expectedBodyClasses)
    await expect(page.locator("dramaweb-page > div").nth(1)).toHaveClass(
      documentCase.kind === "start" ? "startpage" : "subpage"
    )
    await expect(page.locator("dramaweb-page .logo img")).toHaveAttribute(
      "src",
      "../img/dramawebben_vit.svg"
    )
    await expect(page.locator("dramaweb-page .logo img")).toHaveJSProperty("complete", true)
    await expect(page.locator("dramaweb-page .logo h2")).toHaveText(
      "Fri svensk dramatik hos Litteraturbanken"
    )
    if (documentCase.kind === "start") {
      await expect(page.locator("dramaweb-page .logo h2")).toBeVisible()
    } else {
      await expect(page.locator("dramaweb-page .logo h2")).toBeHidden()
    }

    await expect(page.locator("dramaweb-page ul.links a")).toHaveText([
      "Pjäser",
      "Mer läsning",
      documentCase.kind === "start" ? "Sök i pjäserna" : "Sök",
      documentCase.kind === "start" ? "Om dramawebben" : "Om",
      "Till Litteraturbanken"
    ])
    expect(await page.locator("dramaweb-page ul.links a").evaluateAll(links => links.map(
      link => link.getAttribute("href")
    ))).toEqual([
      "/dramawebben/pjäser",
      "/dramawebben/kringtexter",
      "/sok?avancerad&keywords=keyword:Dramawebben",
      "/dramawebben/om",
      "/"
    ])
    expect(await page.locator("dramaweb-page ul.links li.active a").evaluateAll(links => links.map(
      link => link.getAttribute("href")
    ))).toEqual(documentCase.kind === "kringtexter" ? ["/dramawebben/kringtexter"] : [])
    if (documentCase.heading) {
      await expect(page.getByRole("heading", { name: documentCase.heading, exact: true })).toBeVisible()
    } else {
      await expect(page.locator("dramaweb-page .page_content")).toBeEmpty()
    }

    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    const expectedBackgroundPath = documentCase.kind === "start"
      ? "/img/dramawebben.jpg"
      : "/img/dramawebben_fade.jpg"
    const background = await decodedBodyBackground(page)
    expect(background.url).toBe(`${authorityOrigin}${expectedBackgroundPath}`)
    expect({
      naturalWidth: background.naturalWidth,
      naturalHeight: background.naturalHeight
    }).toEqual({ naturalWidth: 2012, naturalHeight: 1308 })
    await expect.poll(() => unexpectedRequests).toEqual([])

    expect(authorRequests).toHaveLength(1)
    expect(dramaRequests).toHaveLength(1)
    const dramaUrl = new URL(dramaRequests[0]!.replace(/^GET /u, ""))
    expect([...dramaUrl.searchParams.entries()]).toEqual(expectedDramaEntries)
    expect(dramaUrl.searchParams.getAll("filter_and")).toEqual([dramaFilter])
    expect(managedRequests).toEqual(documentCase.sourcePath
      ? [`GET ${authorityOrigin}${documentCase.sourcePath}`]
      : [])
    expect(bootstrapRequests.sort()).toEqual([
      `GET ${authorityOrigin}/red/bilder/bakgrundsbilder/backgrounds.xml?username=app`,
      `GET ${authorityOrigin}/red/css/etext.css`,
      "GET https://cloud.typography.com/7426274/770508/css/fonts.css",
      "GET https://www.googletagmanager.com/gtag/js?id=UA-132486790-1"
    ].sort())
    expect(assetRequests.sort()).toEqual([
      `GET ${authorityOrigin}/img/dramawebben_vit.svg`,
      `GET ${authorityOrigin}/img/dramawebben.jpg`,
      ...(documentCase.kind === "start"
        ? []
        : [`GET ${authorityOrigin}/img/dramawebben_fade.jpg`]),
      `GET ${authorityOrigin}${expectedBackgroundPath}`
    ].sort())
    const shellUrls = shellRequests.map(label => new URL(label.replace(/^GET /u, "")))
    expect(shellUrls.filter(url => url.href === expectedShellDocument.href)).toHaveLength(1)
    expect(shellUrls.filter(url => allowedShellStaticRequests.has(shellStaticKey(url)))
      .map(shellStaticKey).sort()).toEqual([...allowedShellStaticRequests].sort())
    expect(shellRequests).toHaveLength(allowedShellStaticRequests.size + 1)
    expect(unexpectedRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(problems).toEqual([])

    const reversedFilter = JSON.stringify({ texttype: "drama", "provenance.library": "Dramawebben" })
    const dramaPath = "/api/list_all/etext,faksimil,pdf,infopost"
    const duplicateFilter = new URL(dramaPath, authorityOrigin)
    for (const [key, value] of expectedDramaEntries) duplicateFilter.searchParams.append(key, value)
    duplicateFilter.searchParams.append("filter_and", dramaFilter)
    const reorderedFilter = new URL(duplicateFilter)
    reorderedFilter.searchParams.delete("filter_and")
    reorderedFilter.searchParams.append("filter_and", reversedFilter)
    const probes = [
      { method: "GET", url: `${authorityOrigin}/scripts/task-1-unlisted.js` },
      { method: "GET", url: `${authorityOrigin}/views/task-1-unlisted.html?import&url` },
      { method: "GET", url: `${authorityOrigin}/api/task-1-unlisted` },
      { method: "GET", url: `${authorityOrigin}/red/dramawebben/om.html?extra=1` },
      { method: "POST", url: `${authorityOrigin}/red/dramawebben/om.html` },
      { method: "GET", url: `${authorityOrigin}/red/dramawebben/om/redirect` },
      { method: "GET", url: duplicateFilter.href },
      { method: "GET", url: reorderedFilter.href },
      { method: "POST", url: new URL(dramaPath, authorityOrigin).href },
      { method: "GET", url: `${managedOrigin}/red/dramawebben/om.html` },
      { method: "GET", url: "http://cloud.typography.com/7426274/770508/css/fonts.css" },
      { method: "GET", url: "https://cloud.typography.com:444/7426274/770508/css/fonts.css" },
      { method: "GET", url: "http://www.googletagmanager.com/gtag/js?id=UA-132486790-1" },
      { method: "GET", url: "https://www.googletagmanager.com:444/gtag/js?id=UA-132486790-1" }
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
      path: resolve(directory, `dramawebben-${documentCase.kind}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })
  })
}
