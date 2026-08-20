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

async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((document.querySelector("#__nuxt") as (
    HTMLElement & { __vue_app__?: unknown }
  ) | null)?.__vue_app__))
}

test.beforeAll(async ({ baseURL, browser }) => {
  const warmupPage = await browser.newPage({ baseURL })
  const response = await warmupPage.goto("/sök", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await warmupPage.close()
})

test("authored document search navigation is canonical and stays inside the SPA", async ({
  page
}) => {
  await page.goto("/författare/S%C3%B6derbergH/presentation", { waitUntil: "networkidle" })
  await waitForHydration(page)
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

test("canonical links inside managed author documents navigate in the SPA and preserve Back", async ({
  page
}) => {
  const documentUrl = /\/f%C3%B6rfattare\/SparseDocument\/presentation$/u
  const readerUrl = /\/f%C3%B6rfattare\/S%C3%B6derbergH\/titlar\/F%C3%B6rvillelser\/sida\/3\/etext$/u

  await page.goto("/författare/SparseDocument/presentation", { waitUntil: "networkidle" })
  const managedLink = page.locator("#canonical-reader-link")
  await expect(managedLink).toHaveText("Läs Förvillelser")
  await expect(managedLink).toHaveAttribute(
    "href",
    "/författare/SöderbergH/titlar/Förvillelser/sida/3/etext"
  )
  await installSpaSentinel(page)

  await managedLink.click()

  await expect(page).toHaveURL(readerUrl)
  await expect(page.locator(".txt")).toContainText("KANONISK SIDA TRE")
  await expectSpaSentinel(page)

  await page.goBack()
  await expect(page).toHaveURL(documentUrl)
  await expect(page.locator("h1").first()).toContainText("Författare utan tilläggsnavigering")
  await expectSpaSentinel(page)
})

test("visible supplemental-document author navigation reaches profile content without reload", async ({
  page
}) => {
  await page.goto(
    "/författare/Lagerl%C3%B6fS/bibliografi",
    { waitUntil: "networkidle" }
  )
  await installSpaSentinel(page)

  const introduction = page.locator('nav[aria-label="Författarsidor"] a')
    .filter({ hasText: "Introduktion" })
  await expect(introduction).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/Lagerl%C3%B6fS"
  )
  await introduction.click()

  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS$/u)
  await expect(page.locator("h1").first()).toContainText("Selma Lagerlöf")
  await expectSpaSentinel(page)
})

test("hidden SLA article navigation retains canonical author links", async ({ page }) => {
  await page.goto(
    "/författare/Lagerl%C3%B6fS/omtexterna/PublishedWorks.html",
    { waitUntil: "networkidle" }
  )

  const introduction = page.getByLabel("Författarsidor")
    .getByRole("link", { name: "Introduktion", exact: true, includeHidden: true })
  await expect(introduction).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/Lagerl%C3%B6fS"
  )
  await expect(introduction).toBeHidden()
})
