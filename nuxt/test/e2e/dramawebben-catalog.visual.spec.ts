import { readFileSync } from "node:fs"
import { expect, test, type APIRequestContext } from "@playwright/test"

import { dramawebbenCatalogExpected } from "../fixtures/dramawebben-catalog-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const catalogPageSource = readFileSync(
  new URL("../../app/pages/dramawebben/pjäser.vue", import.meta.url),
  "utf8"
)

type CatalogCase = {
  kind: "plays" | "authors" | "ranges"
  route: string
  openRanges: boolean
}

const catalogCases: CatalogCase[] = [
  { kind: "plays", route: "/dramawebben/pjäser", openRanges: false },
  { kind: "authors", route: "/dramawebben/pjäser?visa=författare", openRanges: false },
  { kind: "ranges", route: "/dramawebben/pjäser", openRanges: true }
]

// The legacy Select2/rzSlider widgets and their accessible Headless UI/native replacements use
// different paint primitives. Their boxes and typography are exact; keep narrow raster budgets.
const visualDiffBudgets = {
  desktop: { plays: 3200, authors: 2500, ranges: 19000 },
  mobile: { plays: 3200, authors: 2500, ranges: 0 }
} as const


async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_dramawebben_catalog_requests`),
    request.delete(`${fixture}/_dramawebben_catalog_failure`),
    request.delete(`${fixture}/_dramawebben_excluded_data_requests`)
  ])
}

async function catalogRequests(request: APIRequestContext) {
  const response = await request.get(`${fixture}/_dramawebben_catalog_requests`)
  return (await response.json() as { requests: unknown[] }).requests
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

test("catalog page exposes its exact three siblings through Vue Fragment", () => {
  expect(catalogPageSource).toContain(
    'import { defineComponent, Fragment as VueFragment, h } from "vue"'
  )
  expect(catalogPageSource).toContain(
    "return () => h(VueFragment, null, slots.default?.())"
  )
  const pageTemplate = catalogPageSource.match(
    /<template>\s*([\s\S]*?)\s*<\/template>\s*<style scoped>/u
  )?.[1]
  expect(pageTemplate).toMatch(/^<component :is="Fragment">/u)
  expect(pageTemplate).toMatch(/<\/component>$/u)

  const hashTarget = pageTemplate?.indexOf('<span id="dw"') ?? -1
  const shell = pageTemplate?.indexOf('<DramawebbenShell page="pjäser">') ?? -1
  const dialog = pageTemplate?.indexOf("<ReaderSourceInfoDialog") ?? -1
  expect(hashTarget).toBeGreaterThan(-1)
  expect(shell).toBeGreaterThan(hashTarget)
  expect(dialog).toBeGreaterThan(shell)
})

for (const catalogCase of catalogCases) {
  test(`matches the populated Angular Dramawebben ${catalogCase.kind} authority`, async ({
    page,
    request
  }, testInfo) => {
    const mobile = testInfo.project.name === "mobile-chromium"
    test.skip(catalogCase.openRanges && mobile)

    const problems: string[] = []
    const productionRequests: string[] = []
    const browserDataRequests: string[] = []

    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type()) || /hydration|unhandled/iu.test(message.text())) {
        problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })
    await page.route("**/*", route => {
      const browserRequest = route.request()
      const url = new URL(browserRequest.url())
      const label = `${browserRequest.method()} ${browserRequest.url()}`
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
        productionRequests.push(label)
        return route.abort("blockedbyclient")
      }
      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/private-v2/")) {
        browserDataRequests.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(catalogCase.route, { waitUntil: "networkidle" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body")).toHaveClass(
      "focus page-dramaweb drama-dramasubpage ready"
    )
    await expect(page.locator("#mainview > .cover.show")).toHaveCount(1)
    await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
    expect(await page.locator("#dw").evaluate(hashTarget => ({
      cover: hashTarget.nextElementSibling?.classList.contains("cover"),
      coverShow: hashTarget.nextElementSibling?.classList.contains("show"),
      shell: hashTarget.nextElementSibling?.nextElementSibling?.classList.contains("subpage"),
      sameParent:
        hashTarget.parentNode === hashTarget.nextElementSibling?.nextElementSibling?.parentNode,
      fallbackNodeType:
        hashTarget.nextElementSibling?.nextElementSibling?.nextSibling?.nodeType
    }))).toEqual({
      cover: true,
      coverShow: true,
      shell: true,
      sameParent: true,
      fallbackNodeType: 8
    })
    await expect(page.locator(".subpage ul.links li.active a"))
      .toHaveAttribute("href", "/dramawebben/pjäser")
    await expect(page.locator(".page_content"))
      .toContainText("I Dramawebben hittar du pjäser som har mer metadata")

    const table = catalogCase.kind === "authors"
      ? page.locator("table.contenttable.authors")
      : page.locator("table.contenttable:not(.authors)")
    const expectedRows = catalogCase.kind === "authors"
      ? dramawebbenCatalogExpected.authors
      : dramawebbenCatalogExpected.plays
    await expect(table).toBeVisible()
    await expect(table.locator("tbody tr")).toHaveText(expectedRows)

    if (catalogCase.openRanges) {
      const rangeButton = page.getByRole("button", { name: "Akter och roller", exact: true })
      await rangeButton.click()
      await expect(page.locator(".controls .dropdown-menu")).toBeVisible()
      await expect(page.locator(".controls .dropdown-menu > li")).toHaveCount(7)
    } else {
      await expect(page.locator(".controls .btn-group.open")).toHaveCount(0)
    }

    await waitForVisualAssets(page)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    expect(await catalogRequests(request)).toEqual([{
      method: "GET",
      path: "/private-v2/dramawebben/catalog",
      authorization: null,
      cookie: null
    }])
    expect(browserDataRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(problems).toEqual([])

    await expect(page).toHaveScreenshot(
      `dramawebben-catalog-${catalogCase.kind}-${mobile ? "mobile" : "desktop"}.png`,
      {
        fullPage: true,
        animations: "disabled",
        caret: "hide",
        scale: "css",
        threshold: 0.1,
        maxDiffPixels: visualDiffBudgets[mobile ? "mobile" : "desktop"][catalogCase.kind]
      }
    )
  })
}
