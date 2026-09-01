import { expect, test, type APIRequestContext, type Page } from "../fixtures/angular-visual-test"

import { waitForVisualAssets } from "../helpers/visual"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin
const slaRoute = "/f%C3%B6rfattare/Lagerl%C3%B6fS/omtexterna"

const expectedDocumentRequests = [
  {
    kind: "descriptor",
    path: "/private-v2/authors/Lagerl%C3%B6fS/documents/omtexterna"
  },
  { kind: "content", path: "/red/sla/omtexterna.html" }
] as const

const emptyDataLedgers = [
  { path: "/_requests", field: "requests" },
  { path: "/_contact_submissions", field: "contactSubmissions" },
  { path: "/_quick_search_requests", field: "queries" },
  { path: "/_work_lookup_requests", field: "requests" },
  { path: "/_author_resolve_requests", field: "requests" },
  { path: "/_author_profile_requests", field: "requests" },
  { path: "/_author_works_requests", field: "requests" },
  { path: "/_home_requests", field: "requests" },
  { path: "/_presentation_requests", field: "requests" },
  { path: "/_litteraturkartan_requests", field: "requests" },
  { path: "/_reader_requests", field: "requests" },
  { path: "/_reader_metadata_requests", field: "requests" },
  { path: "/_reader_html_requests", field: "requests" },
  { path: "/_reader_ocr_requests", field: "requests" },
  { path: "/_reader_jpeg_requests", field: "requests" },
  { path: "/_reader_hit_requests", field: "requests" },
  { path: "/_export_faksimil_requests", field: "requests" },
  { path: "/_library_relevance_requests", field: "requests" },
  { path: "/_library_query_requests", field: "requests" },
  { path: "/_dramawebben_document_requests", field: "requests" },
  { path: "/_dramawebben_document_redirect_target_requests", field: "requests" },
  { path: "/_dramawebben_excluded_data_requests", field: "requests" },
  { path: "/_sla_excluded_data_requests", field: "requests" },
  { path: "/_author_document_asset_requests", field: "requests" },
  { path: "/_author_document_redirect_target_requests", field: "requests" },
  { path: "/_legacy_author_route_requests", field: "requests" },
  { path: "/_author_document_pdf_requests", field: "requests" },
  { path: "/_text_search/requests", field: "textSearchOperations" }
] as const

const expectedLinks = [
  ["/författare/LagerlöfS/omtexterna/TextkritiskaRiktlinjer.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/TextkritiskVerkstad.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/OmSelmaLagerlofArkivet.html", "_top"],
  ["/författare/LagerlöfS/titlar/Körkarlen2012/sida/III/faksimil", "_top"],
  ["/författare/LagerlöfS/titlar/GöstaBerlingsSaga1SLA/sida/I/etext", "_top"],
  ["/författare/LagerlöfS/titlar/OsynligaLänkarSLA/sida/I/etext", "_top"],
  ["/författare/LagerlöfS/omtexterna/Introduktion.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/Adaptioner.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/ForeGostaBerling.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/BrevOmGBS.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/SprakandringarGBS.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/AndringarGBS.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/ForskningOchLitthist.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/TextkritiskGBS.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/ManuskriptGBS.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/Oversattningar.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/IllustrationerOchOmslag.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/Recensioner.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/OLintroduktion.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/TextkritiskOL1894.html", "_top"],
  ["/författare/LagerlöfS/omtexterna/MsTillOL.html", "_top"]
] as const

async function resetLedgers(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_document_requests`),
    request.delete(`${fixture}/_author_document_failure`),
    request.delete(`${fixture}/_author_document_delay`),
    ...emptyDataLedgers.map(ledger => request.delete(`${fixture}${ledger.path}`))
  ])
}

async function fixtureRequests(request: APIRequestContext, path: string) {
  const response = await request.get(`${fixture}${path}`)
  expect(response.status(), path).toBe(200)
  return await response.json()
}

async function expectExactLedgers(request: APIRequestContext) {
  expect((await fixtureRequests(request, "/_author_document_requests")).requests)
    .toEqual(expectedDocumentRequests)
  for (const ledger of emptyDataLedgers) {
    const payload = await fixtureRequests(request, ledger.path)
    if (ledger.field === "textSearchOperations") {
      expect(payload, ledger.path).toEqual({
        results: [], options: [], chronology: []
      })
    } else {
      expect(payload[ledger.field], ledger.path).toEqual([])
    }
  }
}

function collectProblems(page: Page) {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration|unhandled/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  return problems
}

async function decodedPageBackground(page: Page) {
  return await page.locator("html").evaluate(async root => {
    const backgroundImage = getComputedStyle(root).backgroundImage
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

test.beforeEach(async ({ request }) => resetLedgers(request))
test.afterEach(async ({ request }) => resetLedgers(request))

test("matches the Angular SLA omtexterna authority", async ({ page, request }, testInfo) => {
  const appOrigin = new URL(testInfo.project.use.baseURL as string).origin
  const problems = collectProblems(page)
  const browserApiRequests: string[] = []
  const browserContentRequests: string[] = []
  const frameworkMetadataRequests: string[] = []
  const productionRequests: string[] = []
  const rejectedFirewallProbes: string[] = []
  const unexpectedRequests: string[] = []
  let probing = false

  await page.route("**/*", route => {
    const browserRequest = route.request()
    const url = new URL(browserRequest.url())
    const label = `${browserRequest.method()} ${browserRequest.url()}`
    const isDataRequest = ["fetch", "xhr", "eventsource", "websocket"]
      .includes(browserRequest.resourceType())
    const isNuxtDevMetadata = browserRequest.method() === "GET"
      && url.origin === appOrigin
      && url.pathname === "/_nuxt/builds/meta/dev.json"
      && url.search === ""
    const productionOrigin = url.hostname === "litteraturbanken.se"
      || url.hostname.endsWith(".litteraturbanken.se")

    if (productionOrigin) {
      productionRequests.push(label)
      return route.abort("blockedbyclient")
    }
    if (url.pathname.startsWith("/api/")
      || url.pathname.startsWith("/private-v2/")
      || url.pathname.startsWith("/v2/")) {
      browserApiRequests.push(label)
      return route.abort("blockedbyclient")
    }
    if (url.pathname.startsWith("/red/")
      || url.pathname.startsWith("/legacy-api/")
      || url.pathname.startsWith("/export/")) {
      browserContentRequests.push(label)
      return route.abort("blockedbyclient")
    }
    if (isNuxtDevMetadata) {
      frameworkMetadataRequests.push(label)
      return route.fallback()
    }
    if (url.port === "4100"
      || isDataRequest
      || !["127.0.0.1", "localhost"].includes(url.hostname)) {
      if (probing) rejectedFirewallProbes.push(label)
      else unexpectedRequests.push(label)
      return route.abort("blockedbyclient")
    }
    return route.fallback()
  })

  const response = await page.goto(slaRoute, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expect(page.locator("body")).toHaveClass("focus page-authorInfo site-sla ready")
  await expect(page.getByRole("heading", {
    name: "Utgåvor och andra vetenskapliga texter i Selma Lagerlöf-arkivet",
    exact: true
  }).first()).toBeVisible()
  await expect(page.locator("#mainview > .contents > div > h1"))
    .toHaveText("Selma Lagerlöf (1858-1940)")
  await expect(page.locator("#mainview > .contents > div > h1")).toBeVisible()
  await expect(page.locator("#mainview > .contents > div > nav > ul.links")).toBeHidden()
  await expect(page.locator(".portrait_container, .portrait")).toHaveCount(0)
  expect(await page.locator(".page_content .content.unbox a.ulink").evaluateAll(links => links.map(
    link => [link.getAttribute("href"), link.getAttribute("target")]
  ))).toEqual(expectedLinks)

  await waitForVisualAssets(page)
  expect(await page.evaluate(async () => {
    await document.fonts.ready
    return document.fonts.status
  })).toBe("loaded")
  const background = await decodedPageBackground(page)
  expect(new URL(background.url!).pathname).toMatch(/\/forf2_bkg(?:\.[A-Za-z0-9_-]+)?\.jpg$/u)
  expect({
    naturalWidth: background.naturalWidth,
    naturalHeight: background.naturalHeight
  }).toEqual({ naturalWidth: 2_464, naturalHeight: 1_953 })

  const crossOriginProbe = "http://127.0.0.1:31999/_nuxt/builds/meta/dev.json"
  expect(problems).toEqual([])
  probing = true
  const probeResult = await page.evaluate(async url => {
    try {
      await fetch(url)
      return true
    } catch {
      return false
    }
  }, crossOriginProbe)
  probing = false
  expect(probeResult).toBe(false)
  expect(rejectedFirewallProbes).toEqual([`GET ${crossOriginProbe}`])
  expect(problems).toEqual([
    "console error: Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector"
  ])
  problems.length = 0

  await expectExactLedgers(request)
  expect(browserApiRequests).toEqual([])
  expect(browserContentRequests).toEqual([])
  expect(frameworkMetadataRequests.every(
    label => label === `GET ${appOrigin}/_nuxt/builds/meta/dev.json`
  )).toBe(true)
  expect(frameworkMetadataRequests.length).toBeLessThanOrEqual(2)
  expect(productionRequests).toEqual([])
  expect(unexpectedRequests).toEqual([])
  expect(problems).toEqual([])

  const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
  await expect(page).toHaveScreenshot(`author-document-omtexterna-${device}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    threshold: 0,
    maxDiffPixels: 0
  })

  await expectExactLedgers(request)
  expect(browserApiRequests).toEqual([])
  expect(browserContentRequests).toEqual([])
  expect(frameworkMetadataRequests.every(
    label => label === `GET ${appOrigin}/_nuxt/builds/meta/dev.json`
  )).toBe(true)
  expect(frameworkMetadataRequests.length).toBeLessThanOrEqual(2)
  expect(productionRequests).toEqual([])
  expect(unexpectedRequests).toEqual([])
  expect(problems).toEqual([])
})
