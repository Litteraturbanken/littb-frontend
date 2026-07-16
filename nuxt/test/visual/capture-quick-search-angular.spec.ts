import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Page } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

// This JavaScript fixture is deliberately shared with the Node HTTP fixture.
// @ts-ignore -- Playwright transpiles the adjacent ESM module directly.
import {
  angularQuickSearchResponse,
  quickSearchTypedResponse,
  quickSearchVisualQuery
} from "../fixtures/quick-search-visual-data.mjs"

test.use({ serviceWorkers: "block" })

const labels = quickSearchTypedResponse.items.map(item => item.label)
const typeLabels = quickSearchTypedResponse.items.map(item =>
  item.media_type_label ? `${item.type_label}, ${item.media_type_label}` : item.type_label
)

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

for (const state of ["empty", "populated"] as const) {
  test(`captures the current Angular Quick Search ${state} authority`, async ({ page }, testInfo) => {
    const autocompleteRequests: string[] = []
    const loggingRequests: string[] = []
    const unexpectedProductionRequests: string[] = []

    await page.route("**/*", route => {
      const request = route.request()
      const url = new URL(request.url())
      if (/\/autocomplete\//.test(url.pathname)) {
        autocompleteRequests.push(url.pathname)
        if (decodeURIComponent(url.pathname.split("/").at(-1) ?? "") !== quickSearchVisualQuery) {
          unexpectedProductionRequests.push(`${request.method()} ${request.url()}`)
          return route.abort("blockedbyclient")
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify(angularQuickSearchResponse)
        })
      }
      if (/\/log_quicksearch\//.test(url.pathname)) {
        loggingRequests.push(`${request.method()} ${request.url()}`)
        return route.fulfill({ status: 204, body: "" })
      }
      return route.continue()
    })

    await page.goto("/om/ide", { waitUntil: "domcontentloaded" })
    await expect(page.locator("body")).toHaveClass(/\bready\b/)
    await page.getByTitle("Snabbkommando: 's'").click()

    const modal = page.locator(".modal.autocomplete.in")
    const input = page.locator("#autocomplete")
    await expect(modal).toBeVisible()
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

    const rows = page.locator(".autocomplete .dropdown-menu > li")
    if (state === "populated") {
      await input.fill(quickSearchVisualQuery)
      await expect(rows).toHaveCount(labels.length)
      await expect(rows.locator(".type_label")).toHaveText(typeLabels)
      await expect(rows.locator("a > span:not(.type_label)")).toHaveText(labels)
      await expect(rows.first()).toHaveClass(/\bactive\b/)
      await expect(input).toBeFocused()
      expect(autocompleteRequests).toEqual([`/api/autocomplete/${quickSearchVisualQuery}`])
    } else {
      await expect(rows).toHaveCount(0)
      expect(autocompleteRequests).toEqual([])
    }

    await expect(page.locator(".autocomplete .footer")).toHaveText(
      "Gå till biblioteket om du vill utföra mer avancerade sökningar"
    )
    await assertResponsiveAuthority(page, testInfo.project.name === "angular-mobile")
    await waitForVisualAssets(page)
    expect(loggingRequests).toEqual([])
    expect(unexpectedProductionRequests).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `quick-search-${state}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })

    expect(loggingRequests).toEqual([])
    expect(unexpectedProductionRequests).toEqual([])
  })
}
