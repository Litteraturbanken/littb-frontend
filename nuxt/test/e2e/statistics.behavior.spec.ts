import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

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
  await page.evaluate(() => document.fonts.ready)
  return problems
}

test.beforeEach(async ({ request }) => resetFixture(request))

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
    "/f%C3%B6rfattare/Author4/titlar/PopularWork4/faksimil"
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

  expect(await recordedRequests(request)).toEqual(allRequests)
  expect(problems).toEqual([])
})

test("a Nuxt-owned popular work pushes history and Back restores Statistics", async ({
  page
}) => {
  const problems = await openReadyPage(page)
  await page.evaluate(() => {
    Object.defineProperty(window, "__statisticsNavigationSentinel", { value: "alive" })
  })

  await page.locator(".content.stats > ul").nth(1).locator("li a").first().click()
  await expect(page).toHaveURL(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
  )
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
