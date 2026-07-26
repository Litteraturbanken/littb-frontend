import { expect, test, type Page } from "@playwright/test"

const readerPath = "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const dramaReaderPath = "/författare/Alml%C3%B6fN/titlar/Affarer/sida/-2/faksimil"

async function openQuickSearch(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Snabbsökning", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Snabbsökning" })).toBeVisible()
  await expect(page.locator("#autocomplete")).toBeFocused()
}

async function chooseDeveloperRow(page: Page, query: string, typeLabel: string): Promise<void> {
  await page.locator("#autocomplete").fill(query)
  const row = page.locator('.quick-search-options [role="option"]')
    .filter({ hasText: typeLabel })
  await expect(row).toHaveCount(1)
  await row.click()
}

test("Reader /id copies and displays the current work ID without closing", async ({
  context,
  page
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await openQuickSearch(page)

  await chooseDeveloperRow(page, "/id", "[Red.]")

  await expect(page.getByRole("dialog", { name: "Snabbsökning" })).toBeVisible()
  await expect(page.locator(".quick-search-developer-id")).toHaveText(
    "lb-reader-doktor-glas"
  )
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("lb-reader-doktor-glas")
})

test("Reader /editor pushes the contextual Editor destination", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const historyLength = await page.evaluate(() => window.history.length)
  await openQuickSearch(page)

  await chooseDeveloperRow(page, "/editor", "[Red.]")

  await expect(page).toHaveURL(
    "/editor/lb-editor-doktor-glas/ix/2/e"
  )
  expect(await page.evaluate(() => window.history.length)).toBeGreaterThan(historyLength)
})

test("/info renders stable Reader and author JSON and stale context is cleared", async ({
  page
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await openQuickSearch(page)
  await chooseDeveloperRow(page, "/info", "[Red.]")
  const readerInfo = page.locator(".quick-search-developer-info")
  await expect(readerInfo).toContainText('"workId": "lb-reader-doktor-glas"')
  await expect(readerInfo).not.toContainText('class="pname"')
  await page.keyboard.press("Escape")

  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })
  await openQuickSearch(page)
  await chooseDeveloperRow(page, "/info", "[Red.]")
  await expect(page.locator(".quick-search-developer-info"))
    .toContainText('"fullName": "August Strindberg"')
  await page.keyboard.press("Escape")

  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await openQuickSearch(page)
  await page.locator("#autocomplete").fill("/info")
  await expect(page.locator(".quick-search-options")).toHaveCount(0)
})

test("lb lookup offers Editor and bounded FTP actions with inline success and failure", async ({
  page
}) => {
  let fail = false
  await page.route("**/api/dev/red-ftp?**", async route => {
    if (fail) {
      await route.fulfill({ status: 502, body: "lookup unavailable" })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        entries: [{
          url: "//mnt/ftp/red/lb123/files/page.xml",
          breadcrumbs: [
            { label: "lb123", url: "//mnt/ftp/red/lb123" },
            { label: "files", url: "//mnt/ftp/red/lb123/files" }
          ]
        }]
      })
    })
  })
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await openQuickSearch(page)

  await page.locator("#autocomplete").fill("lb123")
  const options = page.locator('.quick-search-options [role="option"]')
  await expect(options.filter({ hasText: "Gå till faksimileditorn" })).toHaveCount(1)
  await options.filter({ hasText: "Sök i ftp" }).click()

  const output = page.locator(".quick-search-developer-ftp")
  await expect(output.getByRole("link", { name: "lb123", exact: true }))
    .toHaveAttribute("href", "//mnt/ftp/red/lb123")
  await expect(output.getByRole("link", { name: "/red/lb123/files/page.xml" }))
    .toHaveAttribute("href", "//mnt/ftp/red/lb123/files/page.xml")
  await expect(page.getByRole("dialog", { name: "Snabbsökning" })).toBeVisible()

  fail = true
  await page.locator("#autocomplete").fill("")
  await page.locator("#autocomplete").fill("lb123")
  await options.filter({ hasText: "Sök i ftp" }).click()
  await expect(page.locator(".quick-search-developer-status"))
    .toHaveText("Hittade inte red-tjänsten.")
  await expect(page.getByRole("dialog", { name: "Snabbsökning" })).toBeVisible()
})

test("hydrated Reader Dramawebben navigation stays inside the SPA", async ({ page }) => {
  await page.goto(dramaReaderPath, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    (window as Window & { __readerDramaSpaSentinel?: boolean })
      .__readerDramaSpaSentinel = true
  })

  await page.getByRole("link", { name: "Dramawebben logotyp" })
    .evaluate((link: HTMLAnchorElement) => link.click())

  await expect(page).toHaveURL("/dramawebben")
  await expect(page.getByRole("img", { name: "Dramawebben", exact: true })).toBeVisible()
  expect(await page.evaluate(() => (
    window as Window & { __readerDramaSpaSentinel?: boolean }
  ).__readerDramaSpaSentinel)).toBe(true)
})
