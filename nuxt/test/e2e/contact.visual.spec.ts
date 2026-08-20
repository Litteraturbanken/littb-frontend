import { expect, test, type APIRequestContext } from "../fixtures/angular-visual-test"

import { waitForVisualAssets } from "../helpers/visual"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

async function resetFixture(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_requests`),
    request.delete(`${fixture}/_contact_submissions`),
    request.delete(`${fixture}/_contact_defer`),
    request.delete(`${fixture}/_failure`)
  ])
}

async function contactSubmissions(request: APIRequestContext) {
  const response = await request.get(`${fixture}/_contact_submissions`)
  return (await response.json()).contactSubmissions as Record<string, unknown>[]
}

test.beforeEach(async ({ request }) => resetFixture(request))
test.afterEach(async ({ request }) => resetFixture(request))

test("matches the approved Angular Contact page", async ({ page, request }, testInfo) => {
  await page.goto("/om/kontakt", { waitUntil: "domcontentloaded" })
  await expect(page.locator("body")).toHaveClass(/\bready\b/)
  await expect(page.locator("body")).toHaveClass(/\bpage-about\b/)
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")

  const activeLinks = page.locator("ul.links a.active")
  await expect(activeLinks).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Kontakt", exact: true })).toHaveClass(/\bactive\b/)

  const contactForm = page.locator("form.contactform")
  const newsletterForm = page.locator("form.subscribeform")
  await expect(contactForm).toBeVisible()
  await expect(newsletterForm).toBeVisible()
  await expect(contactForm.locator("button.submit")).toBeDisabled()
  await expect(newsletterForm.locator("button.submit")).toBeDisabled()
  await expect(page.locator("#nameInput")).toHaveValue("")
  await expect(page.locator("#emailInput")).toHaveValue("")
  await expect(contactForm.locator("textarea")).toHaveValue("")
  await expect(page.locator("#newsletterEmail")).toHaveValue("")
  await expect(page.locator(".page-contactForm > div").nth(1)).toBeHidden()
  await expect(page.locator(".page-contactForm > div").nth(2)).toBeHidden()
  await expect(page.locator(".page-contactForm > div").nth(3)).toBeHidden()
  await expect(page.locator(".contactform .spinner")).toBeHidden()

  await page.locator("#nameInput").focus({ force: true })
  await expect(page.locator("#nameInput")).toBeFocused()
  await waitForVisualAssets(page)
  expect(await contactSubmissions(request)).toEqual([])

  if (testInfo.project.name === "mobile-chromium") {
    const contactBox = await page.locator(".page-contactForm").boundingBox()
    expect(contactBox?.width).toBe(400)
  }

  const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
  await expect(page).toHaveScreenshot(`contact-${device}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    threshold: 0.1,
    // The shared keyboard-focus repair intentionally adds a narrow ring that
    // Angular did not paint; keep the rest of the full-page authority exact.
    maxDiffPixels: 1_500
  })
  expect(await contactSubmissions(request)).toEqual([])
})

test("shows the mobile Contact spinner and exact accepted status structurally", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile transient-state coverage")
  await request.put(`${fixture}/_contact_defer`)
  await page.goto("/om/kontakt", { waitUntil: "networkidle" })
  await page.locator("#emailInput").fill("test@example.com")
  await page.locator(".contactform textarea").fill("Hej!")
  const submit = page.locator("form.contactform button.submit")
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect.poll(async () => (await contactSubmissions(request)).length).toBe(1)
  const spinner = page.locator(".contactform .spinner.fa.fa-spinner.fa-pulse")
  await expect(spinner).toBeVisible()
  const spinnerBox = await spinner.boundingBox()
  expect(spinnerBox?.width).toBeGreaterThan(0)
  expect(spinnerBox?.height).toBeGreaterThan(0)

  await request.delete(`${fixture}/_contact_defer`)
  await expect(page.getByText(
    "Tack för ditt meddelande, vi svarar så fort vi kan.",
    { exact: true }
  )).toBeVisible()
})
