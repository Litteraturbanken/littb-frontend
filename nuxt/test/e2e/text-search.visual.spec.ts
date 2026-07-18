import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const fixture = "http://127.0.0.1:4100"

const visualCases = [
  { name: "pristine", route: "/s%C3%B6k", populated: false, advanced: false, noHit: false },
  { name: "results", route: "/s%C3%B6k?fras=frihet", populated: true, advanced: false, noHit: false },
  {
    name: "advanced",
    route: "/s%C3%B6k?fras=frihet&avancerad&forfattare=StrindbergA&titlar=lb238704" +
      "&k%C3%B6n=female&languages=language:swe&keywords=texttype:roman" +
      "&authorkeyword=Lagerl%C3%B6fS&intervall=1879,1912",
    populated: true,
    advanced: true,
    noHit: false
  },
  { name: "no-hit", route: "/s%C3%B6k?fras=inga", populated: true, advanced: false, noHit: true }
] as const

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_text_search/requests`),
    request.delete(`${fixture}/_text_search/failures`),
    request.delete(`${fixture}/_text_search/delays`),
    request.delete(`${fixture}/_text_search/authority`)
  ])
}

async function expectReady(page: Page, visualCase: typeof visualCases[number]) {
  await page.locator('[data-search-root][data-search-mounted="true"]').waitFor()
  await expect(page.locator("body.focus.page-search.ready")).toHaveCount(1)
  await expect(page.locator("[data-search-root]")).not.toHaveClass(/searching/)
  await expect(page.locator("#results")).not.toHaveClass(/searching/)
  await expect(page.locator("[data-search-advanced]")).toHaveAttribute("type", "button")
  if (visualCase.advanced) await expect(page.locator(".bottom_row")).toBeVisible()
  else await expect(page.locator(".bottom_row")).toHaveCount(0)

  if (!visualCase.populated) {
    await expect(page.locator("#results table.results")).toHaveCount(0)
  } else if (visualCase.noHit) {
    await expect(page.getByText("Din sökning gav inga träffar", { exact: true })).toBeVisible()
    await expect(page.locator("#results table.results tr")).toHaveCount(0)
    await expect(page.locator(".hits_info .hits")).toBeHidden()
  } else {
    await expect(page.locator("#results table.results tr")).toHaveCount(9)
    await expect(page.locator("#results tr.sentence .match")).toHaveCount(6)
    await expect(page.locator("#results .overflow .more")).toHaveCount(1)
    await expect(page.locator(".hits_info .hits")).toHaveText("8")
    await expect(page.locator(".navigator li")).toHaveCount(3)
  }

  if (visualCase.advanced) {
    // Intentional Nuxt correction: unlike Angular, the canonical gender route is visible.
    await expect(page.locator(".gender_select")).toHaveAttribute("data-gender-value", "female")
    // Normalize only that authority defect in the screenshot DOM; no change event is emitted.
    await page.locator(".gender_selection_label").evaluate(label => {
      label.textContent = "Filtrera: kvinnliga / manliga / alla"
      label.classList.add("select2-selection__placeholder")
    })
  }
  await waitForVisualAssets(page)
}

test.beforeEach(async ({ request }) => {
  await reset(request)
  await request.put(`${fixture}/_text_search/authority`)
})
test.afterEach(async ({ request }) => reset(request))

for (const visualCase of visualCases) {
  test(`matches the Angular Text Search ${visualCase.name} authority`, async ({
    page
  }, testInfo) => {
    const problems: string[] = []
    const productionEscapes: string[] = []
    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type()) || /hydration/i.test(message.text())) {
        problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })
    await page.route("**/*", route => {
      const request = route.request()
      const url = new URL(request.url())
      if (["fetch", "xhr"].includes(request.resourceType())
        && !["127.0.0.1", "localhost"].includes(url.hostname)) {
        productionEscapes.push(`${request.method()} ${request.url()}`)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(visualCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expectReady(page, visualCase)
    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`text-search-${visualCase.name}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })
    expect(productionEscapes).toEqual([])
    expect(problems).toEqual([])
  })
}
