import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

import {
  quickSearchTypedResponse,
  quickSearchVisualQuery
} from "../fixtures/quick-search-visual-data.mjs"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin
const labels = quickSearchTypedResponse.items.map(item => item.label)
const typeLabels = quickSearchTypedResponse.items.map(item =>
  item.media_type_label ? `${item.type_label}, ${item.media_type_label}` : item.type_label
)

async function resetFixture(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_quick_search_requests`),
    request.delete(`${fixture}/_quick_search_failure`),
    request.delete(`${fixture}/_quick_search_delays`)
  ])
}

async function queries(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixture}/_quick_search_requests`)
  return (await response.json()).queries
}

async function assertResponsiveAuthority(page: Page, mobile: boolean) {
  const dialog = page.locator(".modal.autocomplete .modal-dialog")
  if (mobile) {
    const modalBox = await page.locator(".modal.autocomplete").boundingBox()
    expect(Math.round(modalBox?.x ?? -1)).toBe(12)
    expect(Math.round(modalBox?.y ?? -1)).toBe(20)
    expect(Math.round(modalBox?.width ?? -1)).toBe(367)
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(51, 51, 51)")
    await expect(page.locator("#mainview")).toBeHidden()
    await expect(page.locator("#leftCorridor")).toBeHidden()
    await expect(page.locator(".header")).toBeHidden()
    await expect(page.locator(".modal-backdrop")).toBeHidden()
  } else {
    expect(Math.round((await dialog.boundingBox())?.width ?? -1)).toBe(700)
    for (const selector of ["#leftCorridor", "#mainview", "#rightCorridor"]) {
      await expect(page.locator(selector)).toHaveCSS("filter", "blur(4px)")
    }
    await expect(page.locator(".modal-backdrop")).toBeVisible()
  }
}

test.beforeEach(async ({ request }) => resetFixture(request))
test.afterEach(async ({ request }) => resetFixture(request))

for (const state of ["empty", "populated"] as const) {
  test(`matches the approved Angular Quick Search ${state} dialog`, async ({ page, request }, testInfo) => {
    const forbiddenProductionRequests: string[] = []
    const typedRequests: string[] = []
    const unexpectedVisualRequests: string[] = []
    await page.route("**/*", route => {
      const url = new URL(route.request().url())
      if (url.pathname === "/api/v2/quick-search") {
        const query = url.searchParams.get("query") ?? ""
        typedRequests.push(query)
        if (query !== quickSearchVisualQuery) {
          unexpectedVisualRequests.push(`${route.request().method()} ${route.request().url()}`)
          return route.abort("blockedbyclient")
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify(quickSearchTypedResponse)
        })
      }
      if (/\/(?:autocomplete|log_quicksearch)\//.test(url.pathname)) {
        forbiddenProductionRequests.push(`${route.request().method()} ${route.request().url()}`)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto("/om/ide", { waitUntil: "networkidle" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body")).toHaveClass(/\bready\b/)
    await page.getByRole("button", { name: "Snabbsökning", exact: true }).click()

    const dialog = page.getByRole("dialog", { name: "Snabbsökning", exact: true })
    const input = page.locator("#autocomplete")
    await expect(dialog).toBeVisible()
    await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/)
    await expect(input).toBeFocused()
    await expect(input).toHaveValue("")
    await expect(input).toHaveAttribute(
      "placeholder",
      "Gå till ett verk, en dikt, en novell eller en författare"
    )
    await expect(input).toHaveAttribute("autocomplete", "off")
    await expect(input).toHaveAttribute("autocorrect", "off")
    await expect(input).toHaveAttribute("autocapitalize", "none")
    await expect(input).toHaveAttribute("spellcheck", "false")

    const rows = page.locator(".quick-search-options [role=option]")
    if (state === "populated") {
      await input.fill(quickSearchVisualQuery)
      await expect(rows).toHaveCount(labels.length)
      await expect(rows.locator(".type_label")).toHaveText(typeLabels)
      await expect(rows.locator(".quick-search-label")).toHaveText(labels)
      await expect(rows.first()).toHaveClass(/\bactive\b/)
      await expect(input).toHaveAttribute(
        "aria-activedescendant",
        await rows.first().getAttribute("id") ?? ""
      )
      await expect(input).toBeFocused()
      expect(typedRequests).toEqual([quickSearchVisualQuery])
    } else {
      await expect(rows).toHaveCount(0)
      expect(typedRequests).toEqual([])
    }

    await expect(page.locator(".autocomplete .footer")).toHaveText(
      "Gå till biblioteket om du vill utföra mer avancerade sökningar"
    )
    await assertResponsiveAuthority(page, testInfo.project.name === "mobile-chromium")
    await waitForVisualAssets(page)
    expect(await queries(request)).toEqual([])
    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedVisualRequests).toEqual([])

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`quick-search-${state}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })

    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedVisualRequests).toEqual([])
  })
}
