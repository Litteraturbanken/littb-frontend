import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const fixture = "http://127.0.0.1:4136"

const visualCases = [
  {
    name: "textkritiska-riktlinjer",
    articleId: "TextkritiskaRiktlinjer.html",
    title: "Textkritiska riktlinjer för Selma Lagerlöf-arkivet",
    byline: "Petra Söderlund",
    footnotes: 0,
    tables: 0
  },
  {
    name: "introduktion",
    articleId: "Introduktion.html",
    title: "Introduktion",
    byline: "Maria Karlsson",
    footnotes: 16,
    tables: 0
  },
  {
    name: "fore-gosta-berling",
    articleId: "ForeGostaBerling.html",
    title: "Tiden före Gösta Berlings saga",
    byline: "Lisbeth Stenberg",
    footnotes: 68,
    tables: 0
  },
  {
    name: "sprakandringar-gbs",
    articleId: "SprakandringarGBS.html",
    title: "Språkliga förändringar i Gösta Berlings saga",
    byline: "Carin Östman",
    footnotes: 5,
    tables: 6
  },
  {
    name: "about-archive",
    articleId: "AboutTheSLagerlofArchive.html",
    title: "About The Selma Lagerlöf Archive",
    byline: null,
    footnotes: 0,
    tables: 0
  }
] as const

const priorBaselineHashes = {
  "author-document-bibliografi-desktop.png": "6fecbaa1bebd416c28b47539d7fa87bbb7585458815ae731141f27e57306d34a",
  "author-document-bibliografi-mobile.png": "f1ff84fc2ed027dcfa237e083bb175c1e592e705f2043e63cdf2f2e81ee23406",
  "author-document-omtexterna-desktop.png": "28aea366a1f7ce94400b752638ed1c795043aa72d737ecaa8c2232fd52eccbb3",
  "author-document-omtexterna-mobile.png": "7caedcebe8097cc225226dcc626ff45eee777d60a95a60effd2985e3a16cbc35",
  "author-document-presentation-desktop.png": "e7ed508b2a90168c9c4542e6efb32e94656922ce4a0e28612a730662cca588e7",
  "author-document-presentation-mobile.png": "b755b3fc493e2d68d2b5e262dd636a6703a870bbc8e81276a09b103950519581",
  "author-document-semer-desktop.png": "1bf831130e8dbe685f100d6f4a28765fc0bf73c7bffd3b8c15227c3e61f8f0ca",
  "author-document-semer-mobile.png": "5bcbddbaa6abc3370a1900b833df728aeee6fa302d34454dfca271bcb1764dec"
} as const

const emptyLedgers = [
  { path: "/_author_document_requests", field: "requests" },
  { path: "/_author_document_asset_requests", field: "requests" },
  { path: "/_author_document_redirect_target_requests", field: "requests" },
  { path: "/_author_document_pdf_requests", field: "requests" },
  { path: "/_legacy_author_route_requests", field: "requests" },
  { path: "/_author_resolve_requests", field: "requests" },
  { path: "/_author_profile_requests", field: "requests" },
  { path: "/_author_works_requests", field: "requests" },
  { path: "/_work_lookup_requests", field: "requests" },
  { path: "/_litteraturkartan_requests", field: "requests" },
  { path: "/_library_relevance_requests", field: "requests" },
  { path: "/_library_query_requests", field: "requests" },
  { path: "/_reader_requests", field: "requests" },
  { path: "/_reader_metadata_requests", field: "requests" },
  { path: "/_reader_html_requests", field: "requests" },
  { path: "/_reader_ocr_requests", field: "requests" },
  { path: "/_reader_jpeg_requests", field: "requests" },
  { path: "/_reader_hit_requests", field: "requests" },
  { path: "/_export_faksimil_requests", field: "requests" },
  { path: "/_dramawebben_document_requests", field: "requests" },
  { path: "/_dramawebben_excluded_data_requests", field: "requests" },
  { path: "/_sla_excluded_data_requests", field: "requests" }
] as const

async function resetLedgers(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_sla_article_descriptor_requests`),
    request.delete(`${fixture}/_sla_article_source_requests`),
    request.delete(`${fixture}/_sla_article_descriptor_failure`),
    request.delete(`${fixture}/_sla_article_source_failure`),
    request.delete(`${fixture}/_sla_article_redirect_target_requests`),
    request.delete(`${fixture}/_sla_article_source_cancellations`),
    request.delete(`${fixture}/_sla_article_request_headers`),
    ...emptyLedgers.map(ledger => request.delete(`${fixture}${ledger.path}`))
  ])
}

async function fixtureRequests(request: APIRequestContext, resource: "descriptor" | "source") {
  const response = await request.get(`${fixture}/_sla_article_${resource}_requests`)
  expect(response.status()).toBe(200)
  return (await response.json() as {
    requests: Array<{ method: string, path: string }>
  }).requests
}

async function expectEmptyLedgers(request: APIRequestContext) {
  for (const ledger of emptyLedgers) {
    const response = await request.get(`${fixture}${ledger.path}`)
    expect(response.status(), ledger.path).toBe(200)
    const payload = await response.json()
    expect(payload[ledger.field], ledger.path).toEqual([])
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
    if (!match) return { url: null, width: 0, height: 0 }
    const image = new Image()
    image.src = new URL(match[1]!, document.baseURI).href
    await image.decode()
    return { url: image.src, width: image.naturalWidth, height: image.naturalHeight }
  })
}

test.beforeEach(async ({ request }) => resetLedgers(request))
test.afterEach(async ({ request }) => resetLedgers(request))

test("retains every prior author-document and SLA landing baseline byte", async () => {
  for (const [filename, expectedHash] of Object.entries(priorBaselineHashes)) {
    const bytes = await readFile(resolve(import.meta.dirname, `../visual/baselines/${filename}`))
    expect(createHash("sha256").update(bytes).digest("hex"), filename).toBe(expectedHash)
  }
})

for (const visualCase of visualCases) {
  test(`strictly matches Angular SLA article authority: ${visualCase.name}`, async ({
    page,
    request
  }, testInfo) => {
    const appOrigin = new URL(String(testInfo.project.use.baseURL)).origin
    const routePath
      = `/f%C3%B6rfattare/Lagerl%C3%B6fS/omtexterna/${visualCase.articleId}`
    const problems = collectProblems(page)
    const browserApiRequests: string[] = []
    const browserContentRequests: string[] = []
    const productionRequests: string[] = []
    const unexpectedDataRequests: string[] = []
    const frameworkMetadataRequests: string[] = []

    await page.route("**/*", route => {
      const browserRequest = route.request()
      const url = new URL(browserRequest.url())
      const label = `${browserRequest.method()} ${browserRequest.url()}`
      const isDataRequest = ["fetch", "xhr", "eventsource", "websocket"]
        .includes(browserRequest.resourceType())
      const isNuxtDevMetadata = browserRequest.method() === "GET"
        && url.origin === appOrigin
        && url.pathname === "/_nuxt/builds/meta/dev.json"
        && !url.search
      const productionOrigin = url.hostname === "litteraturbanken.se"
        || url.hostname.endsWith(".litteraturbanken.se")

      if (productionOrigin) {
        productionRequests.push(label)
        return route.abort("blockedbyclient")
      }
      if (/^\/(?:api|private-v2|v2)(?:\/|$)/u.test(url.pathname)) {
        browserApiRequests.push(label)
        return route.abort("blockedbyclient")
      }
      if (/^\/(?:red|legacy-api|export)(?:\/|$)/u.test(url.pathname)) {
        browserContentRequests.push(label)
        return route.abort("blockedbyclient")
      }
      if (isNuxtDevMetadata) {
        frameworkMetadataRequests.push(label)
        return route.continue()
      }
      if (url.port === "4136" || isDataRequest
        || !["127.0.0.1", "localhost"].includes(url.hostname)) {
        unexpectedDataRequests.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(routePath, { waitUntil: "networkidle" })
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle("Selma Lagerlöf, Om texterna | Litteraturbanken")
    await expect(page.locator('meta[name="description"]'))
      .toHaveAttribute("content", "Selma Lagerlöf, Om texterna")
    await expect(page.locator("body")).toHaveClass("focus page-authorInfo site-sla ready")
    await expect(page.locator("#mainview > .contents > div > h1"))
      .toHaveText("Selma Lagerlöf (1858-1940)")
    await expect(page.locator("#mainview > .contents > div > h1")).toBeVisible()
    await expect(page.locator("#mainview > .contents > div > nav > ul.links")).toBeHidden()
    await expect(page.locator(".portrait_container, .portrait")).toHaveCount(0)

    const content = page.locator(".page_content > .content.unbox")
    await expect(content).toHaveCount(1)
    await expect(content.getByRole("heading", {
      name: visualCase.title,
      exact: true
    }).first()).toBeVisible()
    if (visualCase.byline) {
      await expect(content.locator("h3.author").first()).toHaveText(visualCase.byline)
    } else {
      await expect(content.locator("h3.author")).toHaveCount(0)
    }
    await expect(content.locator("table")).toHaveCount(visualCase.tables)
    await expect(content.locator('a.footnote[href^="#ftn."]'))
      .toHaveCount(visualCase.footnotes)

    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    const background = await decodedPageBackground(page)
    expect(new URL(background.url!).pathname)
      .toMatch(/\/forf2_bkg(?:\.[A-Za-z0-9_-]+)?\.jpg$/u)
    expect({ width: background.width, height: background.height })
      .toEqual({ width: 2_464, height: 1_953 })

    expect(await fixtureRequests(request, "descriptor")).toEqual([{
      method: "GET",
      path:
        `/private-v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/${visualCase.articleId}`
    }])
    expect(await fixtureRequests(request, "source")).toEqual([{
      method: "GET",
      path: `/red/sla/${visualCase.articleId}`
    }])
    await expectEmptyLedgers(request)
    expect(browserApiRequests).toEqual([])
    expect(browserContentRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(unexpectedDataRequests).toEqual([])
    expect(problems).toEqual([])

    if (visualCase.footnotes > 0) {
      const reference = content.locator('a.footnote[href^="#ftn."]').first()
      const href = await reference.getAttribute("href")
      const beforeDescriptor = await fixtureRequests(request, "descriptor")
      const beforeSource = await fixtureRequests(request, "source")
      const beforeScrollY = await page.evaluate(() => scrollY)
      await reference.click()
      await expect.poll(() => new URL(page.url()).hash).toBe(href)
      await expect(content.locator(`[id="${href!.slice(1)}"]`)).toBeInViewport()
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(beforeScrollY)
      await expect(page.locator(".note_popover, [role=dialog]")).toHaveCount(0)
      expect(await fixtureRequests(request, "descriptor")).toEqual(beforeDescriptor)
      expect(await fixtureRequests(request, "source")).toEqual(beforeSource)
      await page.evaluate(() => {
        history.replaceState(history.state, "", `${location.pathname}${location.search}`)
        scrollTo(0, 0)
      })
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY")
    } else {
      await expect(page.locator(".note_popover, [role=dialog]")).toHaveCount(0)
    }

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`sla-article-${visualCase.name}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0,
      maxDiffPixels: 0
    })

    expect(browserApiRequests).toEqual([])
    expect(browserContentRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(unexpectedDataRequests).toEqual([])
    expect(frameworkMetadataRequests.every(
      label => label === `GET ${appOrigin}/_nuxt/builds/meta/dev.json`
    )).toBe(true)
    expect(problems).toEqual([])
  })
}
