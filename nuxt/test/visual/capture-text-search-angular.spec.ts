import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Page, type Route } from "@playwright/test"

import {
  textSearchAboutAuthors,
  textSearchAuthors,
  textSearchBackgroundBase64,
  textSearchCountResponse,
  textSearchImprintRange,
  textSearchNoHitCountResponse,
  textSearchNoHitResponse,
  textSearchResultsResponse,
  textSearchTitleQueryResponse
} from "../fixtures/text-search-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9000"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const backgroundPath = "/red/bilder/bakgrundsbilder/sok_bkg.jpg"
const searchInclude = "authors,title,titlepath,titleid,mediatype,lbworkid"
const titleInclude = "shorttitle,title,lbworkid,authors.authorid,mediatype,searchable"
const advancedTextFilter = JSON.stringify({
  "main_author.gender": "female",
  "sort_date_imprint.date:range": "1879,1912",
  language: ["swe"],
  texttype: ["roman"],
  "authorkeyword>authorid": ["LagerlöfS"],
  "authors>authorid": ["StrindbergA"]
})
const expectedAdvancedTitleQuery = [
  ["author_aggregation", "true"],
  ["exclude", "text,parts,sourcedesc,pages,errata"],
  ["from", "0"],
  ["include", titleInclude],
  [
    "q",
    "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian (sort_date_imprint.date:[1879 TO 1912] OR birth.date:[1879 TO 1912] OR death.date:[1879 TO 1912]) AND (authorkeyword>(authorid:LagerlöfS)) AND (authors>(authorid:StrindbergA)) AND (language:swe) AND (texttype:roman) AND (authors.gender:female) AND (searchable:true)"
  ],
  ["sort_field", "sortkey|asc"],
  ["to", "30"]
]
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
const expectedViteProxyPrefixes = [
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
const expectedBootstrapRequestSignatures = [
  "GET https://cloud.typography.com/7426274/770508/css/fonts.css",
  "GET https://www.googletagmanager.com/gtag/js?id=UA-132486790-1",
  `GET ${authorityOrigin}/red/bilder/bakgrundsbilder/backgrounds.xml?username=app`,
  `GET ${authorityOrigin}/red/css/etext.css`
]

type VisualCase = {
  name: "pristine" | "results" | "advanced" | "no-hit"
  route: string
  query: string | null
  advanced: boolean
  noHit: boolean
}

type RequestRecord = {
  method: string
  path: string
  query: string[][]
}

type AbortRoute = Pick<Route, "abort">

function abortProductionProxyRequest(
  route: AbortRoute,
  record: RequestRecord,
  label: string,
  blockedRequests: string[]
): Promise<void> | null {
  if (!productionProxyPrefixes.some(prefix => record.path.startsWith(prefix))) return null

  blockedRequests.push(label)
  return route.abort("blockedbyclient")
}

function expectExactBootstrapRequests(actual: string[]) {
  expect([...actual].sort()).toEqual([...expectedBootstrapRequestSignatures].sort())
}

const visualCases: VisualCase[] = [
  {
    name: "pristine",
    route: "/sök",
    query: null,
    advanced: false,
    noHit: false
  },
  {
    name: "results",
    route: "/sök?fras=frihet",
    query: "frihet",
    advanced: false,
    noHit: false
  },
  {
    name: "advanced",
    route: "/sök?fras=frihet&avancerad&forfattare=StrindbergA&titlar=lb238704&kön=female&languages=language:swe&keywords=texttype:roman&authorkeyword=LagerlöfS&intervall=1879,1912",
    query: "frihet",
    advanced: true,
    noHit: false
  },
  {
    name: "no-hit",
    route: "/sök?fras=inga",
    query: "inga",
    advanced: false,
    noHit: true
  }
]

const sameEntries = (actual: string[][], expected: string[][]) =>
  JSON.stringify(actual) === JSON.stringify(expected)

function requestRecord(method: string, url: URL): RequestRecord {
  return {
    method,
    path: decodeURIComponent(url.pathname),
    query: [...url.searchParams.entries()]
  }
}

function responseFor(visualCase: VisualCase) {
  return visualCase.noHit ? textSearchNoHitResponse : textSearchResultsResponse
}

function countResponseFor(visualCase: VisualCase) {
  return visualCase.noHit ? textSearchNoHitCountResponse : textSearchCountResponse
}

function expectedSearchQuery(visualCase: VisualCase): string[][] {
  const query = [
    ["from", "0"],
    ["include", searchInclude],
    ["number_of_fragments", "6"],
    ["sort_field", "main_author.name_for_index.lowercase"],
    ["text_filter", visualCase.advanced ? advancedTextFilter : "{}"],
    ["to", "29"],
    ["word_form_only", "true"]
  ]
  if (visualCase.advanced) query.push(["work_ids", "lb238704"])
  return query
}

function expectedSearchCountQuery(visualCase: VisualCase): string[][] {
  const query = [
    ["include", searchInclude],
    ["text_filter", visualCase.advanced ? advancedTextFilter : "{}"],
    ["word_form_only", "true"]
  ]
  if (visualCase.advanced) query.push(["work_ids", "lb238704"])
  return query
}

async function expectSearchReady(page: Page, visualCase: VisualCase) {
  await expect(page.locator("body.focus.page-search.ready")).toHaveCount(1)
  await expect(page.getByRole("heading", { name: "Sök i texterna", exact: true }))
    .toBeVisible()
  await expect(page.locator(".preloader")).toBeHidden()
  await expect(page.locator("search-page > div")).not.toHaveClass(/\bsearching\b/)
  await expect(page.locator(".chronology_inputs input").first()).toHaveValue(
    visualCase.advanced ? "1879" : "1800"
  )
  await expect(page.locator(".chronology_inputs input").last()).toHaveValue(
    visualCase.advanced ? "1912" : "1950"
  )

  const queryInput = page.locator(".submit_form input").first()
  await expect(queryInput).toHaveValue(visualCase.query ?? "")
  if (visualCase.advanced) {
    await expect(page.locator(".bottom_row")).toBeVisible()
  } else {
    await expect(page.locator(".bottom_row")).toBeHidden()
  }

  if (visualCase.query === null) {
    await expect(page.locator("#results .results")).toBeHidden()
    await expect(page.getByText("Din sökning gav inga träffar", { exact: true })).toHaveCount(0)
  } else if (visualCase.noHit) {
    await expect(page.getByText("Din sökning gav inga träffar", { exact: true })).toBeVisible()
    await expect(page.locator("#results .results tr")).toHaveCount(0)
  } else {
    await expect(page.locator("#results .results tr.header")).toHaveCount(0)
    await expect(page.locator("#results .results td.header")).toHaveCount(2)
    await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true }))
      .toBeVisible()
    await expect(page.locator("#results .overflow .more", { hasText: "Visa fler" }))
      .toBeVisible()
    await expect(page.locator(".navigator li")).toHaveCount(3)
    await expect(page.locator(".hits")).toHaveText("8")
  }

  if (visualCase.advanced) {
    await expect(page.locator(".auth_select_container .select2-selection__choice"))
      .toContainText("Strindberg")
    await expect(page.locator(".left .title_select_container .select2-selection__choice"))
      .toContainText("Röda rummet")
    await expect(page.locator(".about_select_container .select2-selection__choice"))
      .toContainText("Lagerlöf")
    await expect(page.locator(".lang_select_container .select2-selection__choice"))
      .toContainText("Svenska")
    await expect(page.locator(".right .title_select_container .select2-selection__choice"))
      .toContainText("Romaner")

    // Authority defect: the route initializes authors.gender while the select binds
    // main_author.gender, so the requested female choice is not reflected in the UI.
    await expect(page.locator("select.gender_select")).toHaveValue("")
  }

  await waitForVisualAssets(page)
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
  await expect.poll(() => page.evaluate(() => {
    const background = getComputedStyle(document.documentElement).backgroundImage
    return background.includes("/red/bilder/bakgrundsbilder/sok_bkg.jpg")
  })).toBe(true)
}

let authorityFonts: Buffer
let searchBackground: Buffer

test.beforeAll(async () => {
  authorityFonts = await readFile(
    resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")
  )
  searchBackground = Buffer.from(textSearchBackgroundBase64, "base64")
})

for (const visualCase of visualCases) {
  test(`captures the current Angular Text Search ${visualCase.name} authority`, async ({
    page
  }, testInfo) => {
    const shellRequests: RequestRecord[] = []
    const authorRequests: RequestRecord[] = []
    const aboutAuthorRequests: RequestRecord[] = []
    const imprintRequests: RequestRecord[] = []
    const titleQueryRequests: RequestRecord[] = []
    const searchRequests: RequestRecord[] = []
    const searchCountRequests: RequestRecord[] = []
    const bootstrapRequests: string[] = []
    const backgroundRequests: RequestRecord[] = []
    const forbiddenProductionRequests: string[] = []
    const unexpectedApplicationRequests: string[] = []
    const problems: string[] = []

    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) {
        problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })

    await page.route("**/*", route => {
      const request = route.request()
      const url = new URL(request.url())
      const record = requestRecord(request.method(), url)
      const label = `${request.method()} ${request.url()}`

      if (url.origin !== authorityOrigin) {
        if (request.method() === "GET"
          && url.origin === "https://cloud.typography.com"
          && url.pathname === "/7426274/770508/css/fonts.css"
          && url.search === "") {
          bootstrapRequests.push(label)
          return route.fulfill({
            status: 200,
            contentType: "text/css; charset=utf-8",
            body: authorityFonts
          })
        }
        if (request.method() === "GET"
          && url.origin === "https://www.googletagmanager.com"
          && url.pathname === "/gtag/js"
          && sameEntries(record.query, [["id", "UA-132486790-1"]])) {
          bootstrapRequests.push(label)
          return route.fulfill({
            status: 200,
            contentType: "application/javascript; charset=utf-8",
            body: ""
          })
        }
        forbiddenProductionRequests.push(label)
        return route.abort("blockedbyclient")
      }

      if (request.method() === "GET" && record.path === "/sök") {
        shellRequests.push(record)
        return route.continue()
      }
      if (request.method() === "GET"
        && record.path === "/api/get_authors"
        && sameEntries(record.query, [["exclude", authorExclude]])) {
        authorRequests.push(record)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ data: textSearchAuthors })
        })
      }
      if (request.method() === "GET"
        && record.path === "/api/get_authorkeywords"
        && record.query.length === 0) {
        aboutAuthorRequests.push(record)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify(textSearchAboutAuthors)
        })
      }
      if (request.method() === "GET"
        && record.path === "/api/imprint_range"
        && record.query.length === 0) {
        imprintRequests.push(record)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify(textSearchImprintRange)
        })
      }
      if (request.method() === "GET"
        && record.path === "/api/query_string/etext,faksimil"
        && visualCase.advanced
        && sameEntries(record.query, expectedAdvancedTitleQuery)) {
        titleQueryRequests.push(record)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify(textSearchTitleQueryResponse)
        })
      }
      if (request.method() === "GET"
        && visualCase.query !== null
        && record.path === `/api/search/${visualCase.query}`
        && sameEntries(record.query, expectedSearchQuery(visualCase))) {
        searchRequests.push(record)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify(responseFor(visualCase))
        })
      }
      if (request.method() === "GET"
        && visualCase.query !== null
        && record.path === `/api/search_count/${visualCase.query}`
        && sameEntries(record.query, expectedSearchCountQuery(visualCase))) {
        searchCountRequests.push(record)
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify(countResponseFor(visualCase))
        })
      }
      if (request.method() === "GET"
        && record.path === "/red/bilder/bakgrundsbilder/backgrounds.xml"
        && sameEntries(record.query, [["username", "app"]])) {
        bootstrapRequests.push(label)
        return route.fulfill({
          status: 200,
          contentType: "application/xml; charset=utf-8",
          body: `<?xml version="1.0" encoding="UTF-8"?>
            <backgrounds>
              <background target="/sök" url="${backgroundPath}" />
            </backgrounds>`
        })
      }
      if (request.method() === "GET"
        && record.path === backgroundPath
        && record.query.length === 0) {
        backgroundRequests.push(record)
        return route.fulfill({ status: 200, contentType: "image/jpeg", body: searchBackground })
      }
      if (request.method() === "GET"
        && record.path === "/red/css/etext.css"
        && record.query.length === 0) {
        bootstrapRequests.push(label)
        return route.fulfill({
          status: 200,
          contentType: "text/css; charset=utf-8",
          body: ""
        })
      }
      const proxyAbort = abortProductionProxyRequest(
        route,
        record,
        label,
        unexpectedApplicationRequests
      )
      if (proxyAbort) return proxyAbort
      return route.continue()
    })

    const response = await page.goto(visualCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expectSearchReady(page, visualCase)

    expect(shellRequests).toEqual([{
      method: "GET",
      path: "/sök",
      query: [...new URL(visualCase.route, authorityOrigin).searchParams.entries()]
    }])
    expect(authorRequests).toHaveLength(1)
    expect(aboutAuthorRequests).toHaveLength(1)
    expect(imprintRequests).toHaveLength(1)
    expect(titleQueryRequests).toEqual(visualCase.advanced ? [{
      method: "GET",
      path: "/api/query_string/etext,faksimil",
      query: expectedAdvancedTitleQuery
    }] : [])
    expect(searchRequests).toEqual(visualCase.query === null ? [] : [{
      method: "GET",
      path: `/api/search/${visualCase.query}`,
      query: expectedSearchQuery(visualCase)
    }])
    expect(searchCountRequests).toEqual(visualCase.query === null ? [] : [{
      method: "GET",
      path: `/api/search_count/${visualCase.query}`,
      query: expectedSearchCountQuery(visualCase)
    }])
    expectExactBootstrapRequests(bootstrapRequests)
    // The page loads the CSS background once; waitForVisualAssets decodes the same
    // exact mocked URL once more before capture.
    expect(backgroundRequests).toHaveLength(2)
    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedApplicationRequests).toEqual([])
    expect(problems).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `text-search-${visualCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })

    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedApplicationRequests).toEqual([])
    expect(problems).toEqual([])
  })
}

test("records Angular Text Search authority defects without normalizing them", async () => {
  const [template, controller] = await Promise.all([
    readFile(
      resolve(import.meta.dirname, "../../../app/scripts/components/search/template.html"),
      "utf8"
    ),
    readFile(resolve(import.meta.dirname, "../../../app/scripts/search_controller.js"), "utf8")
  ])

  expect(template).toContain(`ng-model="$ctrl.filters['main_author.gender']"`)
  expect(controller).toContain(`"authors.gender": $location.search()["kön"]`)
  expect(controller).toContain(`expr: "filters['authors.gender']"`)

  const advancedButton = template.match(
    /<button\s+class="bg-white border border-gray-500[\s\S]*?<\/button>/
  )?.[0]
  expect(advancedButton).toBeDefined()
  expect(advancedButton).not.toMatch(/\btype=/)
  expect(advancedButton).toContain("ng-click=\"$ctrl.advanced = !$ctrl.advanced\"")
})

test("firewall mirrors every configured Vite proxy namespace", async () => {
  const viteConfig = await readFile(resolve(import.meta.dirname, "../../../vite.config.mjs"), "utf8")
  const proxyBlock = viteConfig.match(/const proxy = \{([\s\S]*?)\n\}/)?.[1]
  expect(proxyBlock).toBeDefined()

  const configuredPrefixes = [...proxyBlock!.matchAll(/^\s*"([^"]+)": proxyTo\(/gm)]
    .map(match => match[1])

  expect(configuredPrefixes).toEqual(expectedViteProxyPrefixes)
  expect(productionProxyPrefixes).toEqual(configuredPrefixes)

  const recorded: string[] = []
  const abortReasons: string[] = []
  const route: AbortRoute = {
    abort: async reason => {
      abortReasons.push(reason ?? "")
    }
  } as AbortRoute

  const probes = configuredPrefixes.map(prefix => {
    const label = `GET ${authorityOrigin}${prefix}`
    return abortProductionProxyRequest(
      route,
      { method: "GET", path: prefix, query: [] },
      label,
      recorded
    )
  })

  expect(probes.every(Boolean)).toBe(true)
  await Promise.all(probes as Promise<void>[])
  expect(recorded).toEqual(configuredPrefixes.map(prefix => `GET ${authorityOrigin}${prefix}`))
  expect(abortReasons).toEqual(configuredPrefixes.map(() => "blockedbyclient"))

  for (const localAsset of [
    "/@vite/client",
    "/assets/index.js",
    "/src/main.js",
    "/views/search/template.html"
  ]) {
    expect(abortProductionProxyRequest(
      route,
      { method: "GET", path: localAsset, query: [] },
      `GET ${authorityOrigin}${localAsset}`,
      recorded
    )).toBeNull()
  }
  expect(recorded).toHaveLength(configuredPrefixes.length)
})

test("bootstrap ledger rejects a missing resource hidden by a duplicate", () => {
  const missingGtmWithDuplicateFont = [
    expectedBootstrapRequestSignatures[0],
    expectedBootstrapRequestSignatures[0],
    expectedBootstrapRequestSignatures[2],
    expectedBootstrapRequestSignatures[3]
  ]

  expect(() => expectExactBootstrapRequests(missingGtmWithDuplicateFont)).toThrow()
  expect(() => expectExactBootstrapRequests(expectedBootstrapRequestSignatures)).not.toThrow()
})
