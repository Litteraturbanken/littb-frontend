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
  const response = await request.get("/nuxt-api/dev/red-ftp?q=bad%2Fid")

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
  await page.route("**/nuxt-api/dev/red-ftp?**", async route => {
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

test("a dotted typed FTP identity never exposes or navigates to an invalid Editor route", async ({
  page
}) => {
  await page.route("**/nuxt-api/dev/red-ftp?**", route => route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ entries: [] })
  }))
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  const initialUrl = page.url()
  await openQuickSearch(page)
  await page.locator("#autocomplete").fill("lb123.foo")

  const options = page.locator('.quick-search-options [role="option"]')
  await expect(options.filter({ hasText: "Gå till faksimileditorn" })).toHaveCount(0)
  await expect(options.filter({ hasText: "Sök i ftp" })).toHaveCount(1)
  await page.keyboard.press("Enter")

  await expect(page).toHaveURL(initialUrl)
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

async function pasteText(page: Page, value: string, selector = "body") {
  await page.locator(selector).evaluate((element, text) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData("text", text)
    element.dispatchEvent(new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData
    }))
  }, value)
}

test("public shell shortcuts preserve guards, remembered Library queries, and history", async ({
  page
}) => {
  const browserProblems: string[] = []
  page.on("console", message => {
    if (/hydration/iu.test(message.text())) {
      browserProblems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => browserProblems.push(`pageerror: ${error.message}`))
  const library = "/bibliotek?unknown=first&unknown=second&encoded=%2F&empty="
  const expectRememberedLibrary = () => expect(page).toHaveURL(url => (
    url.pathname === "/bibliotek"
    && url.searchParams.getAll("unknown").join(",") === "first,second"
    && url.searchParams.get("encoded") === "/"
    && url.searchParams.get("empty") === ""
    && url.searchParams.get("filter") === null
  ))
  const focusShell = () => page.getByRole("link", { name: "Litteraturbanken" }).focus()
  const clearFocus = async () => {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await expect.poll(() => page.evaluate(() => (
      document.activeElement === document.body
      || document.activeElement === document.documentElement
    ))).toBe(true)
  }
  await page.goto(library, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    (window as Window & { __shellShortcutHydrated?: boolean })
      .__shellShortcutHydrated = true
  })

  await focusShell()
  await page.keyboard.press("h")
  await expect(page).toHaveURL("/historik")
  expect(await page.evaluate(() => (
    window as Window & { __shellShortcutHydrated?: boolean }
  ).__shellShortcutHydrated)).toBe(true)

  await page.keyboard.press("b")
  await expectRememberedLibrary()
  await page.goBack()
  await expect(page).toHaveURL("/historik")
  await page.goBack()
  await expectRememberedLibrary()
  await page.goForward()
  await expect(page).toHaveURL("/historik")
  await page.goForward()
  await expectRememberedLibrary()

  const search = page.getByRole("textbox", { name: "Sök i biblioteket" })
  await search.focus()
  await page.keyboard.press("h")
  await expect(search).toHaveValue("h")
  await expect.poll(() => new URL(page.url()).searchParams.get("filter")).toBe("h")
  await pasteText(page, "lb8345227", "[data-library-filter]")
  await expect(search).toHaveValue("h")
  await search.fill("")
  await expectRememberedLibrary()

  await search.blur()
  await page.locator("#mainview").evaluate(element => {
    element.setAttribute("contenteditable", "true")
    ;(element as HTMLElement).focus()
  })
  await page.keyboard.press("h")
  await expectRememberedLibrary()
  await pasteText(page, "lb8345227", "#mainview")
  await expectRememberedLibrary()
  await page.locator("#mainview").evaluate(element => element.removeAttribute("contenteditable"))

  await focusShell()
  await page.keyboard.press("Control+h")
  await page.keyboard.press("Alt+h")
  await page.keyboard.press("Meta+h")
  await page.keyboard.press("Shift+h")
  await expectRememberedLibrary()

  await openQuickSearch(page)
  await page.keyboard.press("h")
  await pasteText(page, "lb8345227", '[role="dialog"]')
  await expectRememberedLibrary()
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Snabbsökning" })).toHaveCount(0)

  await focusShell()
  await pasteText(page, "LB8345227")
  await page.waitForTimeout(50)
  await expectRememberedLibrary()

  await clearFocus()
  await pasteText(page, "LB8345227")
  await expect(page).toHaveURL("/editor/lb8345227/ix/0/f")
  await page.goBack()
  await expectRememberedLibrary()

  await clearFocus()
  await pasteText(page, "LB12 och lbAbC_34")
  await expect.poll(() => {
    const url = new URL(page.url())
    return [
      url.pathname,
      url.searchParams.get("filter"),
      url.searchParams.get("visa"),
      url.searchParams.get("sort")
    ]
  }).toEqual([
    "/bibliotek",
    "lbworkid:lb12 OR lbworkid:lbAbC_34",
    "works",
    "popularitet"
  ])
  await page.goBack()
  await expectRememberedLibrary()

  await clearFocus()
  await pasteText(page, "blb123 lb-456")
  await page.waitForTimeout(50)
  await expectRememberedLibrary()
  expect(browserProblems).toEqual([])
})
