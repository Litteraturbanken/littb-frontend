import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { workLookupResponse } from "../fixtures/work-lookup-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

const fixture = "http://127.0.0.1:4100"
const rawTextarea = "Författare – Titel\nTitel två"
const expectedBody = { work_id: null, titles: ["Titel", "Titel två"] }
const expectedResponse = workLookupResponse(expectedBody)
const description = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."

type LookupBody = { work_id: string | null, titles: string[] }
type BrowserLookup = { method: string, path: string, body: LookupBody }

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_work_lookup_requests`),
    request.delete(`${fixture}/_work_lookup_failure`),
    request.delete(`${fixture}/_work_lookup_delays`)
  ])
}

async function fixtureLookups(request: APIRequestContext) {
  const response = await request.get(`${fixture}/_work_lookup_requests`)
  return (await response.json()).requests as Array<{ path: string, body: LookupBody }>
}

async function expectReadyShell(page: Page, populated: boolean) {
  await expect.poll(async () => (await page.locator("body").getAttribute("class"))
    ?.split(/\s+/)
    .filter(Boolean)
    .sort()).toEqual(["focus", "page-id", "ready"])
  await expect(page).toHaveTitle("Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", description)

  await expect(page.getByPlaceholder("lbid")).toHaveValue("")
  await expect(page.getByPlaceholder("titel")).toHaveValue(populated ? "Titel" : "")
  await expect(page.getByPlaceholder("flera titlar separarade med nyrad"))
    .toHaveValue(populated ? rawTextarea : "")
  await expect(page.locator("#mainview > div")).not.toHaveClass(/\bsearching\b/)
  await expect(page.locator(".preloader")).toBeHidden()
}

async function expectRows(page: Page) {
  const rows = page.locator(".table-striped tbody tr")
  await expect(rows).toHaveCount(expectedResponse.items.length)

  for (const [rowIndex, item] of expectedResponse.items.entries()) {
    const cells = rows.nth(rowIndex).locator("td")
    await expect(cells).toHaveCount(4)
    await expect(cells.nth(0)).toHaveText(item.work_id)
    await expect(cells.nth(1).locator("a")).toHaveText(item.author.label)
    await expect(cells.nth(1).locator("a")).toHaveAttribute("href", encodeURI(item.author.url))
    await expect(cells.nth(2).locator("a")).toHaveText(item.title.label)
    await expect(cells.nth(2).locator("a")).toHaveAttribute("href", encodeURI(item.title.url))
    await expect(cells.nth(3).locator("a")).toHaveText(item.media.map(media => media.label))
    for (const [mediaIndex, media] of item.media.entries()) {
      await expect(cells.nth(3).locator("a").nth(mediaIndex))
        .toHaveAttribute("href", encodeURI(media.url))
    }
  }
}

test.beforeEach(async ({ request }) => reset(request))

for (const populated of [false, true]) {
  test(`matches the corrected Angular ID lookup ${populated ? "populated" : "empty"} authority`, async ({
    page,
    request
  }, testInfo) => {
    const browserLookups: BrowserLookup[] = []
    const unexpectedApiRequests: string[] = []
    const productionEscapes: string[] = []

    await page.route("**/*", async route => {
      const browserRequest = route.request()
      const url = new URL(browserRequest.url())
      const isExpectedLookup = url.pathname === "/api/v2/works/lookup"
        && browserRequest.method() === "POST"
      const isUnexpectedApi = url.pathname.startsWith("/api/") && !isExpectedLookup
      if (isUnexpectedApi) {
        unexpectedApiRequests.push(`${browserRequest.method()} ${browserRequest.url()}`)
        return route.abort("blockedbyclient")
      }
      if (isExpectedLookup) {
        browserLookups.push({
          method: browserRequest.method(),
          path: url.pathname,
          body: browserRequest.postDataJSON() as LookupBody
        })
      }
      if (["fetch", "xhr"].includes(browserRequest.resourceType())
        && !["127.0.0.1", "localhost"].includes(url.hostname)) {
        productionEscapes.push(`${browserRequest.method()} ${browserRequest.url()}`)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    await page.goto("/id", { waitUntil: "networkidle" })
    await expect(page.getByPlaceholder("lbid")).toBeFocused()
    expect(await fixtureLookups(request)).toEqual([])
    expect(browserLookups).toEqual([])

    if (populated) {
      await page.clock.install()
      const textarea = page.getByPlaceholder("flera titlar separarade med nyrad")
      await textarea.fill(rawTextarea)

      await expect(textarea).toHaveValue(rawTextarea)
      await expect(page.getByPlaceholder("titel")).toHaveValue("Titel")
      expect(await fixtureLookups(request)).toEqual([])
      expect(browserLookups).toEqual([])

      await page.clock.runFor(500)
      await expect.poll(() => fixtureLookups(request)).toEqual([
        { path: "/v2/works/lookup", body: expectedBody }
      ])
      await expectRows(page)
      expect(browserLookups).toEqual([
        { method: "POST", path: "/api/v2/works/lookup", body: expectedBody }
      ])
    } else {
      await expect(page.locator(".table-striped tbody tr")).toHaveCount(0)
    }

    await expectReadyShell(page, populated)
    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    expect(unexpectedApiRequests).toEqual([])
    expect(productionEscapes).toEqual([])

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    const baseline = `id-lookup-${populated ? "populated" : "empty"}-${device}.png`
    await expect(page).toHaveScreenshot(baseline, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })

    expect(unexpectedApiRequests).toEqual([])
    expect(productionEscapes).toEqual([])
    expect(browserLookups).toEqual(populated ? [
      { method: "POST", path: "/api/v2/works/lookup", body: expectedBody }
    ] : [])
    expect(await fixtureLookups(request)).toEqual(populated ? [
      { path: "/v2/works/lookup", body: expectedBody }
    ] : [])
  })
}
