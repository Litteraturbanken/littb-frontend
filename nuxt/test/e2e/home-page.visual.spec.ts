import { expect, test, type APIRequestContext } from "../fixtures/angular-visual-test"

import { waitForVisualAssets } from "../helpers/visual"
import { fixtureOrigin } from "../helpers/test-origins"

const expectedContentPaths = [
  "/red/om/start/startsida-ny.html",
  "/red/css/startsida.css",
  "/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg"
] as const

async function resetHomeRequests(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixtureOrigin}/_home_requests`),
    request.delete(`${fixtureOrigin}/_home_failure`)
  ])
}

async function homeRequests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixtureOrigin}/_home_requests`)
  return (await response.json()).requests
}

function querySuffix(requestPath: string, pathname: string) {
  expect(requestPath.startsWith(pathname)).toBe(true)
  return requestPath.slice(pathname.length)
}

test.beforeEach(async ({ request }) => resetHomeRequests(request))
test.afterEach(async ({ request }) => resetHomeRequests(request))

test("matches the approved Angular Home page", async ({ page, request }, testInfo) => {
  const forbiddenProductionRequests: string[] = []
  const unexpectedContentRequests: string[] = []

  await page.route("**/*", route => {
    const browserRequest = route.request()
    const url = new URL(browserRequest.url())
    if (url.pathname.startsWith("/red/")) {
      if (!expectedContentPaths.some(path => url.pathname === path)) {
        unexpectedContentRequests.push(`${browserRequest.method()} ${browserRequest.url()}`)
        return route.abort("blockedbyclient")
      }
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      forbiddenProductionRequests.push(`${browserRequest.method()} ${browserRequest.url()}`)
      return route.abort("blockedbyclient")
    }
    return route.fallback()
  })

  const response = await page.goto("/", { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  await expect(page.locator("body")).toHaveClass(/\bfocus\b.*\bpage-start\b.*\bready\b/)
  await expect(page.getByRole("heading", { name: "Litteraturbanken", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Nytt & anmärkningsvärt", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Lärdomsstaden Uppsala", exact: true })).toBeVisible()
  await expect(page.locator(".home-editorial .start_footerinfo")).toContainText(
    "LITTERATURBANKENS BIBLIOTEK"
  )
  await expect(page.getByRole("link", { name: /Jan Gossaert/ })).toBeVisible()

  const runtimeStylesheet = page.locator(
    'link[rel="stylesheet"][href^="/red/css/startsida.css?"]'
  )
  await expect(runtimeStylesheet).toHaveCount(1)
  await expect.poll(async () => page.evaluate(() =>
    [...document.styleSheets].some(sheet => sheet.href?.includes("/red/css/startsida.css?"))
  )).toBe(true)
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(51, 51, 51)")
  await expect(page.locator("html")).toHaveCSS("background-repeat", "no-repeat")
  await expect(page.locator("html")).toHaveCSS(
    "background-image",
    /start_bkg_172_2026\.jpg/
  )
  await expect(page.getByRole("heading", { name: "Nytt & anmärkningsvärt", exact: true })).toHaveCSS(
    "margin-top",
    "0px"
  )
  await expect(page.locator("#leftCorridor")).toBeVisible()
  await expect(page.locator("#mainview")).toBeVisible()

  await waitForVisualAssets(page)
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")

  const requests = await homeRequests(request)
  const fragmentRequests = requests.filter(path => path.startsWith("/red/om/start/startsida-ny.html?"))
  const stylesheetRequests = requests.filter(path => path.startsWith("/red/css/startsida.css?"))
  expect(fragmentRequests).toHaveLength(1)
  expect(stylesheetRequests).toHaveLength(1)
  expect(querySuffix(fragmentRequests[0] ?? "", "/red/om/start/startsida-ny.html")).toBe(
    querySuffix(stylesheetRequests[0] ?? "", "/red/css/startsida.css")
  )
  // The decode probe may reuse the painted background from the memory cache or request it once.
  const backgroundRequests = requests.filter(
    path => path === "/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg"
  )
  expect(backgroundRequests.length).toBeGreaterThanOrEqual(1)
  expect(backgroundRequests.length).toBeLessThanOrEqual(2)
  expect(requests).toHaveLength(2 + backgroundRequests.length)
  expect(forbiddenProductionRequests).toEqual([])
  expect(unexpectedContentRequests).toEqual([])

  const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
  await expect(page).toHaveScreenshot(`home-${device}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    threshold: 0.1,
    maxDiffPixels: 100
  })

  expect(forbiddenProductionRequests).toEqual([])
  expect(unexpectedContentRequests).toEqual([])
})
