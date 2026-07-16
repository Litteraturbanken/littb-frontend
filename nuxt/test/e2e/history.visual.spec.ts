import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import {
  historyAuthorSummaries,
  historyVisualRecords,
  historyVisualStorage
} from "../fixtures/history-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

const fixture = "http://127.0.0.1:4100"

type AuthorRequest = {
  path: string
  body: { author_ids: string[] }
}

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_resolve_requests`),
    request.delete(`${fixture}/_author_resolve_failure`),
    request.delete(`${fixture}/_author_resolve_delays`)
  ])
}

async function authorRequests(request: APIRequestContext): Promise<AuthorRequest[]> {
  const response = await request.get(`${fixture}/_author_resolve_requests`)
  return (await response.json()).requests
}

async function seedHistory(page: Page) {
  await page.addInitScript(value => {
    localStorage.setItem("lastPageViews", value)
  }, historyVisualStorage)
}

async function expectHistoryReady(page: Page) {
  await expect(page.locator("body.focus.page-history.ready")).toHaveCount(1)
  await expect(page.getByRole("heading", { name: "Senast lästa verk", exact: true }))
    .toBeVisible()

  const rows = page.locator("#mainview ul > li")
  await expect(rows).toHaveCount(historyVisualRecords.length)
  for (const [index, record] of historyVisualRecords.entries()) {
    const author = historyAuthorSummaries.find(item => item.author_id === record.author)
    const anchor = rows.nth(index).locator("a")
    await expect(anchor).toHaveText(`${author?.full_name ?? ""} – ${record.label}`)
    await expect(anchor).toHaveAttribute("href", record.url)
  }
}

test.beforeEach(async ({ request }) => reset(request))

test("matches the populated Angular History authority", async ({ page, request }, testInfo) => {
  const browserResolverRequests: Array<{
    method: string
    path: string
    body: { author_ids: string[] }
  }> = []
  const unexpectedApiRequests: string[] = []
  const productionEscapes: string[] = []

  await seedHistory(page)
  await page.route("**/*", route => {
    const browserRequest = route.request()
    const url = new URL(browserRequest.url())
    const expectedResolver = url.pathname === "/api/v2/authors/resolve"
      && browserRequest.method() === "POST"
    if (expectedResolver) {
      browserResolverRequests.push({
        method: browserRequest.method(),
        path: url.pathname,
        body: browserRequest.postDataJSON() as { author_ids: string[] }
      })
      return route.continue()
    }
    if (url.pathname.startsWith("/api/")) {
      unexpectedApiRequests.push(`${browserRequest.method()} ${browserRequest.url()}`)
      return route.abort("blockedbyclient")
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      productionEscapes.push(`${browserRequest.method()} ${browserRequest.url()}`)
      return route.abort("blockedbyclient")
    }
    return route.continue()
  })

  const response = await page.goto("/historik", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expectHistoryReady(page)
  await waitForVisualAssets(page)
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")

  const expectedRequest = {
    path: "/v2/authors/resolve",
    body: { author_ids: ["StrindbergA", "LongNameAuthor"] }
  }
  expect(await authorRequests(request)).toEqual([expectedRequest])
  expect(browserResolverRequests).toEqual([{
    method: "POST",
    path: "/api/v2/authors/resolve",
    body: expectedRequest.body
  }])
  expect(unexpectedApiRequests).toEqual([])
  expect(productionEscapes).toEqual([])

  const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
  await expect(page).toHaveScreenshot(`history-populated-${device}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    threshold: 0.1,
    maxDiffPixels: 100
  })

  expect(await authorRequests(request)).toEqual([expectedRequest])
  expect(browserResolverRequests).toHaveLength(1)
  expect(unexpectedApiRequests).toEqual([])
  expect(productionEscapes).toEqual([])
})
