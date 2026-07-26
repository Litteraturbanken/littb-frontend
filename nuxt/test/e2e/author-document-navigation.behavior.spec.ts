import { expect, test, type Page } from "@playwright/test"

type SentinelWindow = Window & { __authorDocumentSpaSentinel?: string }

async function installSpaSentinel(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as SentinelWindow).__authorDocumentSpaSentinel = "preserved"
  })
}

async function expectSpaSentinel(page: Page): Promise<void> {
  expect(await page.evaluate(() => (
    window as SentinelWindow
  ).__authorDocumentSpaSentinel)).toBe("preserved")
}

test("authored document search navigation is canonical and stays inside the SPA", async ({
  page
}) => {
  await page.goto("/författare/S%C3%B6derbergH/presentation", { waitUntil: "networkidle" })
  await installSpaSentinel(page)

  const search = page.getByLabel("Författarsidor")
    .getByRole("link", { name: "Sök i texterna", exact: true })
  await expect(search).toHaveAttribute(
    "href",
    "/s%C3%B6k?forfattare=S%C3%B6derbergH&avancerad"
  )
  const searchUrl = /\/s%C3%B6k\?forfattare=S%C3%B6derbergH&avancerad$/u
  await Promise.all([
    page.waitForURL(searchUrl, { timeout: 30_000 }),
    search.click()
  ])

  await expect(page).toHaveURL(searchUrl)
  await expect(page.locator("h1").first()).toHaveText("Sök i texterna")
  await expectSpaSentinel(page)
})

test("authored article author navigation reaches profile content without reload", async ({
  page
}) => {
  await page.goto(
    "/författare/Lagerl%C3%B6fS/omtexterna/PublishedWorks.html",
    { waitUntil: "networkidle" }
  )
  await installSpaSentinel(page)

  const introduction = page.locator('nav[aria-label="Författarsidor"] a')
    .filter({ hasText: "Introduktion" })
  await expect(introduction).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/Lagerl%C3%B6fS"
  )
  await introduction.evaluate(link => link.click())

  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS$/u)
  await expect(page.locator("h1").first()).toContainText("Selma Lagerlöf")
  await expectSpaSentinel(page)
})
