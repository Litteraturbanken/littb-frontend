import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"

type ReaderHitRequest = { path: string, query: string }

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_editor_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_hit_requests`),
    request.delete(`${fixture}/_reader_hit_failure`),
    request.delete(`${fixture}/_reader_hit_delays`)
  ])
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

async function fixtureRequests(request: APIRequestContext, ledger: string): Promise<string[]> {
  return (await (await request.get(`${fixture}/${ledger}`)).json()).requests
}

async function readerHitRequests(request: APIRequestContext): Promise<ReaderHitRequest[]> {
  return (await (await request.get(`${fixture}/_reader_hit_requests`)).json()).requests
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration/i.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

const visualCases = [
  {
    name: "ordinary",
    route: readerPath,
    query: null,
    total: null,
    current: null,
    markerIds: [],
    previous: false,
    next: false
  },
  {
    name: "single-first",
    route: `${readerPath}?q=glas&hit=0`,
    query: "glas",
    total: 1,
    current: 1,
    markerIds: ["w2_2"],
    previous: false,
    next: false
  },
  {
    name: "phrase-middle",
    route: `${readerPath}?q=doktor%20glas&hit=1`,
    query: "doktor glas",
    total: 5,
    current: 2,
    markerIds: ["w2_1", "w2_2"],
    previous: true,
    next: true
  }
] as const

test.beforeEach(async ({ request }) => resetReader(request))

for (const visualCase of visualCases) {
  test(`matches the Angular Reader ${visualCase.name} authority`, async ({
    page,
    request
  }, testInfo) => {
    const problems = captureBrowserProblems(page)
    const forbidden: string[] = []
    const publicHitRequests: string[] = []
    await page.route("**/*", route => {
      const url = new URL(route.request().url())
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
        forbidden.push(`${route.request().method()} ${route.request().url()}`)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })
    page.on("request", browserRequest => {
      const url = new URL(browserRequest.url())
      if (url.pathname.includes("/works/lb-reader-doktor-glas/search-hits")) {
        publicHitRequests.push(browserRequest.url())
      }
    })

    const response = await page.goto(visualCase.route, { waitUntil: "networkidle" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body.focus.page-reading.ready")).toHaveCount(1)
    await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
    await expect(page.locator(".reader_main .etext.txt")).toContainText("HJALMAR SÖDERBERG")
    await expect(page.locator(".reader_main .markee")).toHaveCount(visualCase.markerIds.length)
    await expect(page.locator(".reader-context > div > .author")
      .getByRole("link", { name: "Hjalmar Söderberg", exact: true }))
      .toHaveCount(1)
    await expect(page.getByRole("navigation", { name: "Sidnavigering", exact: true }))
      .toHaveCount(1)
    await expect(page.locator("a button")).toHaveCount(0)
    const goto = page.locator(".reader-navigation .goto")
    await expect(goto).not.toHaveAttribute("aria-hidden", "true")
    await expect(goto.getByRole("button", { name: /Gå till sida/u })).toHaveCount(1)
    await expect(page.locator(".reader-navigation .expl")).toHaveAttribute("aria-hidden", "true")
    const subnav = page.locator("#toolkit-right .subnav")
    await expect(subnav).not.toHaveAttribute("aria-hidden", "true")
    await expect(subnav.getByRole("link")).toHaveText([
      "Innehållsförteckning",
      "Mer om boken",
      "Läsfokus",
      /Sök i författarens texter/u
    ])
    await expect(subnav.getByRole("button", { name: "Sök i verket", exact: true }))
      .toHaveCount(1)
    await expect(subnav.locator("li[aria-hidden='true']")).toHaveCount(0)

    const toolkit = page.locator("#toolkit > #search_nav")
    if (visualCase.query === null) {
      await expect(toolkit).toHaveCount(0)
      await expect(page.locator("#toolkit > .spinner_search")).toHaveCount(0)
      await expect(page.locator("#toolkit")).toBeEmpty()
      expect(await readerHitRequests(request)).toEqual([])
    } else {
      await expect(page.locator(".reader-search-state[aria-live], #search_nav [aria-live]"))
        .toHaveCount(1)
      await expect(toolkit).toHaveCount(1)
      await expect(toolkit).toBeVisible()
      await expect(page.locator("#toolkit > .spinner_search")).toHaveCount(1)
      await expect(page.locator("#toolkit > .spinner_search")).not.toHaveClass(/searching/)
      await expect(page.locator("#toolkit > .spinner_search")).toHaveCSS("opacity", "0")
      await expect(page.locator("#toolkit").locator(":scope > *")).toHaveCount(2)
      await expect(toolkit.locator(".num")).toHaveText(String(visualCase.total))
      await expect(toolkit).toContainText(`Träff ${visualCase.current}, sida -2`)
      await expect(toolkit.getByRole("link", { name: "Föregående sökträff" }))
        .toHaveCount(visualCase.previous ? 1 : 0)
      await expect(toolkit.getByRole("link", { name: "Nästa sökträff" }))
        .toHaveCount(visualCase.next ? 1 : 0)
      expect(await readerHitRequests(request)).toEqual([{
        path: "/private-v2/works/lb-reader-doktor-glas/search-hits",
        query: `media_type=etext&query=${encodeURIComponent(visualCase.query)}&offset=0&limit=3&word_forms=false&include_older_spellings=true&prefix=false&suffix=false`
      }])
      expect(publicHitRequests).toEqual([])
    }

    for (const [index, markerId] of visualCase.markerIds.entries()) {
      await expect(page.locator(`#${markerId}`)).toHaveClass(
        index % 2 === 1 ? /\bmarkee\b.*\bflip\b/ : /\bmarkee\b/
      )
    }
    if (visualCase.name === "single-first") {
      await expect(page.locator("#w2_2")).not.toHaveClass(/\bflip\b/)
    }

    const documents = await readerRequests(request)
    expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
      "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"
    ])
    expect(await fixtureRequests(request, "_reader_metadata_requests")).toEqual([])
    expect(await fixtureRequests(request, "_editor_manifest_requests")).toEqual([])
    expect(documents.filter(path => path.startsWith(
      "/txt/lb-reader-doktor-glas/res_00002.html?username=app"
    ))).toHaveLength(1)
    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    expect(await page.locator("img").evaluateAll(images => images.every(image => image.complete))).toBe(true)
    await expect(page.locator("html")).toHaveCSS("background-image", "none")
    if (testInfo.project.name === "mobile-chromium") {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeGreaterThan(390)
    }
    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`reader-hit-${visualCase.name}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      // The navigation links retain the Angular glyph layout while meeting the 24px touch floor.
      maxDiffPixels: 1_500
    })
    expect(forbidden).toEqual([])
    expect(problems).toEqual([])
  })
}
