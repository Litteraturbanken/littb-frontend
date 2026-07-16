import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const expectedLinks = [
  ["Intro", "/om/ide"],
  ["Organisation", "/om/organisation"],
  ["Hjälp", "/om/hjalp"],
  ["Rättigheter", "/om/rattigheter"],
  ["Tack", "/om/tack"],
  ["Statistik", "/om/statistik"],
  ["Kontakt", "/om/kontakt"]
] as const

async function reset(request: APIRequestContext) {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
}

async function openWithoutBrowserErrors(page: Page, path: string) {
  const problems: string[] = []
  page.on("console", message => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  const response = await page.goto(path, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  return problems
}

test.beforeEach(async ({ request }) => reset(request))

test("Intro renders live content, exact navigation, and no hydration errors", async ({ page }) => {
  const problems = await openWithoutBrowserErrors(page, "/om/ide")
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await expect(page.locator("body")).toHaveClass(/\bpage-about\b/)
  for (const [name, href] of expectedLinks) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", href)
  }
  await expect(page.getByRole("link", { name: "Intro", exact: true })).toHaveClass(/\bactive\b/)
  await expect(page.getByRole("heading", { name: "Introduktion" })).toBeVisible()
  expect(problems).toEqual([])
})

test("Organisation intentionally has no active About tab", async ({ page }) => {
  await openWithoutBrowserErrors(page, "/om/organisation")
  await expect(page.locator("ul.links a.active")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Organisation", exact: true })).toBeVisible()
})

test("Rights retains existing /red images and license links", async ({ page }) => {
  await openWithoutBrowserErrors(page, "/om/rattigheter")
  await expect(page.locator('img[src="/red/om/rattigheter/cc_by.png"]').first()).toBeVisible()
  await expect(page.locator('img[src="/red/om/rattigheter/cc_publicdomain.png"]')).toBeVisible()
  await expect(page.getByRole("link", { name: "https://creativecommons.org/licenses/by/4.0/" })).toHaveAttribute(
    "href",
    "https://creativecommons.org/licenses/by/4.0/"
  )
})

test("Thanks renders the beginning and end of the managed response", async ({ page }) => {
  await openWithoutBrowserErrors(page, "/om/tack")
  await expect(page.getByRole("heading", { name: "Litteraturbanken tackar" })).toBeVisible()
  await expect(page.locator("#mainview")).toContainText("Uppsala universitetsbibliotek")
})

test("navigation fetches each selected fragment once and never refetches during hydration", async ({ page, request }) => {
  await openWithoutBrowserErrors(page, "/om/ide")
  let log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual(["/red/om/ide/omlitteraturbanken.html"])

  await page.getByRole("link", { name: "Organisation", exact: true }).click()
  await expect(page).toHaveURL("/om/organisation")
  await expect(page.getByRole("heading", { name: "Organisation", exact: true })).toBeVisible()
  log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual([
    "/red/om/ide/omlitteraturbanken.html",
    "/red/om/ide/organisation.html"
  ])
})

test("the browser /red proxy reaches the configured content origin", async ({ page, request }) => {
  await openWithoutBrowserErrors(page, "/om/ide")
  await request.delete(`${fixture}/_requests`)
  const body = await page.evaluate(async () => {
    const response = await fetch("/red/om/ide/organisation.html")
    return { status: response.status, text: await response.text() }
  })
  expect(body.status).toBe(200)
  expect(body.text).toContain("Organisation")
  const log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual(["/red/om/ide/organisation.html"])
})

test("legacy statistics alias preserves browser query and fragment", async ({ page }) => {
  await page.goto("/statistik?source=legacy#ranking")
  await expect(page).toHaveURL("/om/statistik?source=legacy#ranking")
})

test("missing route uses generic body state without stale About background", async ({ page }) => {
  const response = await page.goto("/definitely-not-a-route")
  expect(response?.status()).toBe(404)
  await expect(page.locator("body")).toHaveClass(/\bfocus\b/)
  await expect(page.locator("body")).toHaveClass(/\bready\b/)
  await expect(page.locator("body")).not.toHaveClass(/\bpage-about\b/)
  expect(await page.locator("html").getAttribute("style")).not.toContain("about_bkg.jpg")
})
