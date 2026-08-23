import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || "4100"}`
const allRequests = [
  "/private-v2/epubs/popular?limit=30",
  "/private-v2/stats",
  "/private-v2/works/popular?limit=30"
]

async function resetFixture(request: APIRequestContext) {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
}

async function failResource(request: APIRequestContext, resource: string) {
  await request.put(`${fixture}/_failure`, { data: { resource } })
}

async function recordedRequests(request: APIRequestContext) {
  const body = await (await request.get(`${fixture}/_requests`)).json()
  return [...body.requests].sort()
}

async function openReadyPage(page: Page) {
  const problems = []
  page.on("console", message => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))

  const response = await page.goto("/om/statistik", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expect.poll(() => page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router?: unknown } } }
    }
    return Boolean(root.__vue_app__?.config.globalProperties.$router)
  })).toBe(true)
  await page.evaluate(() => document.fonts.ready)
  return problems
}

async function beginRouterPush(page: Page, path: string) {
  await page.evaluate(target => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: { globalProperties: { $router: { push: (path: string) => Promise<void> } } }
      }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    void router.push(target)
  }, path)
}

test.beforeEach(async ({ request }) => resetFixture(request))

test("mounts Statistics before all resources settle", async ({ page }) => {
  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { name: "Botanisera i biblioteket" })).toBeVisible()

  const expectedResources = new Set([
    "/api/v2/stats",
    "/api/v2/works/popular",
    "/api/v2/epubs/popular"
  ])
  const startedResources = new Set<string>()
  let releaseRequests = () => {}
  const requestGate = new Promise<void>(resolve => {
    releaseRequests = resolve
  })
  let markAllRequestsStarted = () => {}
  const allRequestsStarted = new Promise<void>(resolve => {
    markAllRequestsStarted = resolve
  })
  const gateResponse = async (route: Route) => {
    const response = await route.fetch()
    const pathname = new URL(route.request().url()).pathname
    startedResources.add(pathname)
    if ([...expectedResources].every(resource => startedResources.has(resource))) {
      markAllRequestsStarted()
    }
    await requestGate
    await route.fulfill({ response })
  }

  await page.route("**/api/v2/stats", gateResponse)
  await page.route("**/api/v2/works/popular**", gateResponse)
  await page.route("**/api/v2/epubs/popular**", gateResponse)
  try {
    await beginRouterPush(page, "/om/statistik")
    await allRequestsStarted

    await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toHaveCount(1)
    await expect(page.getByRole("status", { name: "Laddar statistik" })).toHaveCount(1)
    await expect(page.getByRole("heading", { name: "Botanisera i biblioteket" })).toHaveCount(0)
    await expect(page.locator(".content.stats")).toHaveCount(0)
    expect(startedResources).toEqual(expectedResources)

    releaseRequests()
    const lists = page.locator(".content.stats > ul")
    await expect(lists.nth(0).locator("li")).toHaveCount(6)
    await expect(lists.nth(1).locator("li")).toHaveCount(30)
    await expect(lists.nth(2).locator("li")).toHaveCount(30)
  } finally {
    releaseRequests()
    await page.unroute("**/api/v2/epubs/popular**", gateResponse)
    await page.unroute("**/api/v2/works/popular**", gateResponse)
    await page.unroute("**/api/v2/stats", gateResponse)
  }
})

test("renders exact copy, order, URLs, metadata, and no hydration errors", async ({
  page,
  request
}) => {
  const problems = await openReadyPage(page)
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Statistik för Litteraturbanken."
  )
  await expect(page.locator("body")).toHaveClass(/\bpage-about\b/)

  const lists = page.locator(".content.stats > ul")
  await expect(lists.nth(0).locator("li")).toHaveText([
    "16 237 verk",
    "5521 författare",
    "342 753 sidor etext",
    "2 737 882 sidor faksimil",
    "741 208 730 ord",
    "1513 epubfiler"
  ])

  const works = lists.nth(1).locator("li")
  const epubs = lists.nth(2).locator("li")
  await expect(works).toHaveCount(30)
  await expect(epubs).toHaveCount(30)
  await expect(works.first()).toContainText("1. Doktor Glas")
  await expect(works.last()).toContainText("30. Popular Work 30")
  await expect(epubs.first()).toContainText("1. Doktor Glas")
  await expect(epubs.last()).toContainText("30. EPUB Work 30")

  await expect(works.first().locator("a").first()).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
  )
  await expect(works.first().locator("a.author")).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH"
  )
  await expect(works.nth(3).locator("a").first()).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/Author4/titlar/PopularRoute4/faksimil"
  )
  const pdfWork = works.nth(5).locator("a").first()
  await expect(pdfWork).toHaveAttribute(
    "href",
    "/txt/lb-popular-6/lb-popular-6.pdf"
  )
  await expect(pdfWork).toHaveAttribute("target", "_self")
  expect(await pdfWork.getAttribute("download")).toBeNull()
  await expect(epubs.first().locator("a").first()).toHaveAttribute(
    "href",
    "/txt/epub/SoderbergH_DoktorGlas.epub"
  )
  await expect(epubs.first().locator("a").first()).toHaveAttribute("download", "")
  await expect(epubs.first().locator("a").first()).toHaveAttribute("target", "_self")
  await expect(epubs.last().locator("a").first()).toHaveAttribute(
    "href",
    "/txt/epub/EpubAuthor%2330_Epub.Work%3F30.epub"
  )

  expect(await recordedRequests(request)).toEqual(allRequests)
  expect(problems).toEqual([])
})

test("a Nuxt-owned popular work pushes history and Back restores Statistics", async ({
  page
}) => {
  const readerRoute = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
  const warmResponse = await page.goto(readerRoute, { waitUntil: "networkidle" })
  expect(warmResponse?.status()).toBe(200)
  await expect(page.locator(".reader_main")).toBeVisible()
  const problems = await openReadyPage(page)
  await page.evaluate(() => {
    Object.defineProperty(window, "__statisticsNavigationSentinel", { value: "alive" })
  })

  await page.locator(".content.stats > ul").nth(1).locator("li a").first().click()
  await expect(page).toHaveURL(readerRoute, { timeout: 60_000 })
  await expect(page.locator(".reader_main")).toBeVisible()
  expect(await page.evaluate(() => (
    window as Window & { __statisticsNavigationSentinel?: string }
  ).__statisticsNavigationSentinel ?? null)).toBe("alive")

  await page.goBack()
  await expect(page).toHaveURL("/om/statistik")
  await expect(page.locator(".content.stats > ul").nth(1).locator("li")).toHaveCount(30)
  expect(problems).toEqual([])
})

test("the development proxy maps the public browser base to backend v2", async ({
  page,
  request
}) => {
  await openReadyPage(page)
  await request.delete(`${fixture}/_requests`)

  const result = await page.evaluate(async () => {
    const response = await fetch("/api/v2/stats")
    return { status: response.status, body: await response.json() }
  })

  expect(result.status).toBe(200)
  expect(result.body.works).toBe(16237)
  expect(await recordedRequests(request)).toEqual(["/v2/stats"])
})

test("summary failure hides only the current statistics content", async ({
  page,
  request
}) => {
  await failResource(request, "stats")
  await openReadyPage(page)

  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()
  await expect(page.locator(".content.stats")).toHaveCount(0)
  expect(await recordedRequests(request)).toEqual(allRequests)
})

test("popular-work failure leaves that ranking empty", async ({ page, request }) => {
  await failResource(request, "works")
  await openReadyPage(page)

  const lists = page.locator(".content.stats > ul")
  await expect(lists.nth(0).locator("li")).toHaveCount(6)
  await expect(lists.nth(1).locator("li")).toHaveCount(0)
  await expect(lists.nth(2).locator("li")).toHaveCount(30)
  expect(await recordedRequests(request)).toEqual(allRequests)
})

test("popular-EPUB failure leaves that ranking empty", async ({ page, request }) => {
  await failResource(request, "epubs")
  await openReadyPage(page)

  const lists = page.locator(".content.stats > ul")
  await expect(lists.nth(0).locator("li")).toHaveCount(6)
  await expect(lists.nth(1).locator("li")).toHaveCount(30)
  await expect(lists.nth(2).locator("li")).toHaveCount(0)
  expect(await recordedRequests(request)).toEqual(allRequests)
})

test("client navigation omits malformed reader segments but retains file identities", async ({
  page,
  request
}) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await failResource(request, "malformed-stat-route-segments")
  await beginRouterPush(page, "/om/statistik")

  const lists = page.locator(".content.stats > ul")
  await expect(lists.nth(0).locator("li")).toHaveCount(6)
  await expect(lists.nth(1).locator("li")).toHaveCount(2)
  await expect(lists.nth(2).locator("li")).toHaveCount(1)
  await expect(lists.nth(1)).toContainText("Valid statistics work sibling")
  await expect(lists.nth(1)).toContainText("Valid percent PDF filename")
  await expect(lists.nth(2)).toContainText("Valid percent EPUB filename")

  for (const text of [
    "Malformed slash author statistics work",
    "Malformed backslash author statistics work",
    "Malformed percent author statistics work",
    "Malformed slash title statistics work",
    "Malformed backslash title statistics work",
    "Malformed percent title statistics work",
    "Malformed slash page statistics work",
    "Malformed backslash page statistics work",
    "Malformed percent page statistics work",
    "Malformed slash EPUB author",
    "Malformed backslash EPUB author",
    "Malformed percent EPUB author"
  ]) await expect(page.getByText(text, { exact: true })).toHaveCount(0)

  await expect(lists.nth(1).getByRole("link", { name: "Valid statistics work sibling" }))
    .toHaveAttribute(
      "href",
      "/f%C3%B6rfattare/ValidStatisticsAuthor/titlar/ValidStatisticsWork/sida/1/etext"
    )
  await expect(lists.nth(1).getByRole("link", { name: "Valid percent PDF filename" }))
    .toHaveAttribute("href", "/txt/valid%25statistics-pdf/valid%25statistics-pdf.pdf")
  await expect(lists.nth(2).getByRole("link", { name: "Valid percent EPUB filename" }))
    .toHaveAttribute("href", "/txt/epub/ValidEpubAuthor_Valid%25StatisticsEpub.epub")
  const hrefs = await page.locator(".content.stats a").evaluateAll(links => (
    links.map(link => link.getAttribute("href") ?? "")
  ))
  for (const escaped of ["%2F", "%5C", "%25"]) {
    expect(hrefs.some(href => href.includes(`Unsafe${escaped}`))).toBe(false)
  }
})

test("client navigation omits malformed EPUB display fields", async ({ page, request }) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await failResource(request, "malformed-stat-epub-fields")
  await beginRouterPush(page, "/om/statistik")

  const epubs = page.locator(".content.stats > ul").nth(2).locator("li")
  await expect(epubs).toHaveCount(2)
  await expect(epubs.nth(0)).toContainText("Valid nullable EPUB fields")
  await expect(epubs.nth(0)).toContainText("Valid Nullable EPUB Author")
  await expect(epubs.nth(1)).toContainText("Valid populated EPUB fields")
  await expect(epubs.nth(1)).toContainText("Populated")
  await expect(page.locator(".content.stats")).not.toContainText("undefined")

  const linkLabels = await epubs.locator("a").allTextContents()
  expect(linkLabels).toHaveLength(4)
  expect(linkLabels.every(label => label.trim().length > 0)).toBe(true)
})

test("client navigation omits malformed work fields", async ({ page, request }) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await failResource(request, "malformed-stat-work-fields")
  await beginRouterPush(page, "/om/statistik")

  const works = page.locator(".content.stats > ul").nth(1).locator("li")
  await expect(works).toHaveCount(3)
  await expect(works.nth(0)).toContainText("Valid percent work title identity")
  await expect(works.nth(1)).toContainText("Valid nullable work fields")
  await expect(works.nth(1)).toContainText("Valid Nullable Work Author")
  await expect(works.nth(2)).toContainText("Valid populated work fields")
  await expect(works.nth(2)).toContainText("Populated")
  await expect(works.nth(0).getByRole("link", { name: "Valid percent work title identity" }))
    .toHaveAttribute(
      "href",
      "/f%C3%B6rfattare/ValidPercentWorkAuthor/titlar/ValidPercentWorkTitleIdentity/sida/1/etext"
    )
  await expect(page.locator(".content.stats")).not.toContainText("undefined")

  const linkLabels = await works.locator("a").allTextContents()
  expect(linkLabels).toHaveLength(6)
  expect(linkLabels.every(label => label.trim().length > 0)).toBe(true)
})

test("client navigation omits unsafe download identities", async ({ page, request }) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await failResource(request, "malformed-stat-download-identities")
  await beginRouterPush(page, "/om/statistik")

  const lists = page.locator(".content.stats > ul")
  const works = lists.nth(1).locator("li")
  const epubs = lists.nth(2).locator("li")
  await expect(works).toHaveCount(2)
  await expect(epubs).toHaveCount(2)
  await expect(works.nth(0).getByRole("link", { name: "Valid percent PDF filename" }))
    .toHaveAttribute("href", "/txt/valid%25statistics-pdf/valid%25statistics-pdf.pdf")
  await expect(works.nth(1).getByRole("link", { name: "Valid encoded PDF filename" }))
    .toHaveAttribute(
      "href",
      "/txt/valid%252Estatistics%25252Epdf/valid%252Estatistics%25252Epdf.pdf"
    )
  await expect(epubs.nth(0).getByRole("link", { name: "Valid percent EPUB filename" }))
    .toHaveAttribute("href", "/txt/epub/ValidEpubAuthor_Valid%25StatisticsEpub.epub")
  await expect(epubs.nth(1).getByRole("link", { name: "Valid encoded EPUB filename" }))
    .toHaveAttribute(
      "href",
      "/txt/epub/ValidEncodedEpubAuthor_Valid%252EStatistics%25252EEpub.epub"
    )
  await expect(page.getByText(/Unsafe download identity/u)).toHaveCount(0)
})
