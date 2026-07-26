import { expect, test, type Page } from "@playwright/test"

const readerPath = "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const dramaReaderPath = "/författare/Alml%C3%B6fN/titlar/Affarer/sida/-2/faksimil"

const authorInfoRoutes = [
  ["titles", "/författare/StrindbergA/titlar", "August Strindberg"],
  ["Dramawebben", "/författare/StrindbergA/dramawebben", "August Strindberg"],
  ["bibliography", "/författare/Lagerl%C3%B6fS/bibliografi", "Selma Lagerlöf"],
  ["presentation", "/författare/S%C3%B6derbergH/presentation", "Hjalmar Söderberg"],
  ["mer", "/författare/StrindbergA/mer", "August Strindberg"],
  ["semer", "/författare/AlmqvistCJL/semer", "Carl Jonas Love Almqvist"],
  ["biblinfo", "/författare/Lagerl%C3%B6fS/biblinfo", "Selma Lagerlöf"],
  ["omtexterna", "/författare/Lagerl%C3%B6fS/omtexterna", "Selma Lagerlöf"],
  [
    "supplemental article",
    "/författare/Lagerl%C3%B6fS/omtexterna/PublishedWorks.html",
    "Selma Lagerlöf"
  ]
] as const

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
  await expect(page.locator(".editor-reader .etext")).toContainText("EDITORSSIDA 2")
  await expect(page.locator(".editor-reader .reader-error")).toHaveCount(0)
  expect(await page.evaluate(() => window.history.length)).toBeGreaterThan(historyLength)
})

test("development FTP endpoint stays in Nuxt and rejects invalid queries", async ({
  request
}) => {
  const response = await request.get("/api/dev/red-ftp?q=bad%2Fid")

  expect(response.status()).toBe(400)
  expect(await response.json()).toMatchObject({
    statusCode: 400,
    statusMessage: "Invalid Red FTP query"
  })
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

for (const [owner, path, authorName] of authorInfoRoutes) {
  test(`publishes author /info context from the ${owner} route owner`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" })
    await openQuickSearch(page)
    await chooseDeveloperRow(page, "/info", "[Red.]")
    await expect(page.locator(".quick-search-developer-info")).toContainText(authorName)
  })
}

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

test("hydrated Reader Dramawebben navigation stays inside the SPA", async ({ page }, testInfo) => {
  await page.goto(dramaReaderPath, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    (window as Window & { __readerDramaSpaSentinel?: boolean })
      .__readerDramaSpaSentinel = true
  })

  const dramaLogo = page.locator(".reader-context .subnav")
    .getByRole("img", { name: "Dramawebben logotyp" })
  await dramaLogo.scrollIntoViewIfNeeded()
  const clickPoint = await dramaLogo.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const layoutPoint = {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2
    }
    if (document.elementFromPoint(layoutPoint.x, layoutPoint.y) !== element) return null
    const viewport = window.visualViewport
    return {
      x: (layoutPoint.x - (viewport?.offsetLeft ?? 0)) * (viewport?.scale ?? 1),
      y: (layoutPoint.y - (viewport?.offsetTop ?? 0)) * (viewport?.scale ?? 1)
    }
  })
  expect(clickPoint).not.toBeNull()
  if (testInfo.project.name === "mobile-chromium") {
    await page.touchscreen.tap(clickPoint!.x, clickPoint!.y)
  } else {
    await page.mouse.click(clickPoint!.x, clickPoint!.y)
  }

  await expect(page).toHaveURL("/dramawebben")
  await expect(page.getByRole("img", { name: "Dramawebben", exact: true })).toBeVisible()
  expect(await page.evaluate(() => (
    window as Window & { __readerDramaSpaSentinel?: boolean }
  ).__readerDramaSpaSentinel)).toBe(true)
})
