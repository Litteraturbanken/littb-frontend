import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_quick_search_requests`),
    request.delete(`${fixture}/_quick_search_failure`),
    request.delete(`${fixture}/_quick_search_delays`)
  ])
}

async function queries(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixture}/_quick_search_requests`)
  return (await response.json()).queries
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function openShell(page: Page, path = "/om/ide") {
  const problems = captureBrowserProblems(page)
  const response = await page.goto(path, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  return problems
}

async function openQuickSearch(page: Page) {
  await page.getByRole("button", { name: "Snabbsökning", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.locator("#autocomplete")).toBeFocused()
}

async function search(page: Page, query: string) {
  await page.locator("#autocomplete").fill(query)
  await expect.poll(async () => page.locator(".quick-search-options").count()).toBe(1)
}

function selectableRows(page: Page): Locator {
  return page.locator('.quick-search-options [role="option"]:not([aria-disabled="true"])')
}

test.beforeEach(async ({ request }) => reset(request))

test("opens from the trigger with exact empty chrome, closes by backdrop, restores focus, and clears on reopen", async ({ page, request }) => {
  const problems = await openShell(page)
  const trigger = page.getByRole("button", { name: "Snabbsökning", exact: true })
  await expect(trigger).toHaveAttribute("title", "Snabbkommando: 's'")

  await openQuickSearch(page)
  await expect(page.getByRole("dialog", { name: "Snabbsökning", exact: true })).toBeVisible()
  await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/)
  const input = page.locator("#autocomplete")
  await expect(input).toHaveAttribute(
    "placeholder",
    "Gå till ett verk, en dikt, en novell eller en författare"
  )
  await expect(input).toHaveAttribute("autocomplete", "off")
  await expect(input).toHaveAttribute("autocorrect", "off")
  await expect(input).toHaveAttribute("autocapitalize", "none")
  await expect(input).toHaveAttribute("spellcheck", "false")
  await expect(page.locator(".quick-search-options")).toHaveCount(0)
  expect(await queries(request)).toEqual([])

  await input.fill("strindberg")
  await expect(page.getByText("Strindberg, August (1849-1912)", { exact: true })).toBeVisible()
  await page.locator(".modal-backdrop").click({ position: { x: 2, y: 2 } })
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.locator("body")).not.toHaveClass(/\bmodal-open\b/)
  await expect(trigger).toBeFocused()

  await openQuickSearch(page)
  await expect(input).toHaveValue("")
  await expect(page.locator(".quick-search-options")).toHaveCount(0)
  expect(problems).toEqual([])
})

test("lowercase s opens globally while uppercase and focused controls are suppressed", async ({ page }) => {
  const problems = await openShell(page)
  await page.keyboard.press("S")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.keyboard.press("s")
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await page.goto("/om/kontakt", { waitUntil: "networkidle" })
  await page.locator("#emailInput").focus()
  await page.keyboard.press("s")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.locator(".contactform textarea").focus()
  await page.keyboard.press("s")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.locator("#newsletterEmail").selectText()
  await page.keyboard.press("s")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.evaluate(() => {
    const select = document.createElement("select")
    select.id = "quick-search-hotkey-select"
    select.append(new Option("Val", "value"))
    document.body.append(select)
    select.focus()
  })
  await page.keyboard.press("s")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(problems).toEqual([])
})

test("debounces for 200 ms, aborts prior work, and ignores a stale completion", async ({ page, request }) => {
  await request.put(`${fixture}/_quick_search_delays`, {
    data: { strindberg: 500, inga: 0 }
  })
  await openShell(page)
  await openQuickSearch(page)

  await page.locator("#autocomplete").fill("strindberg")
  await page.waitForTimeout(150)
  expect(await queries(request)).toEqual([])
  await expect.poll(async () => (await queries(request)).length).toBe(1)
  await page.locator("#autocomplete").fill("inga")
  await expect(page.getByText("Inga träffar.", { exact: true })).toBeVisible()
  expect(await queries(request)).toEqual(["strindberg", "inga"])

  await page.waitForTimeout(550)
  await expect(page.getByText("Inga träffar.", { exact: true })).toBeVisible()
  await expect(page.getByText("Strindberg, August (1849-1912)", { exact: true })).toHaveCount(0)
})

test("composes remote rows, exact local command order, correction, no-hit, slash, and failure states", async ({ page, request }) => {
  await openShell(page)
  await openQuickSearch(page)

  await search(page, "strindberg")
  await expect(page.locator(".quick-search-options .quick-search-label")).toHaveText([
    "Strindberg, August (1849-1912)",
    "Strindberg – Röda rummet",
    "Lagerlöf – Landskapet"
  ])
  await expect(page.locator(".quick-search-options .type_label")).toHaveText([
    "Författare",
    "Verk, etext",
    "Del, faksimil"
  ])

  await search(page, "s")
  await expect(page.locator(".quick-search-options .quick-search-label")).toHaveText([
    "Inga träffar.",
    "Start",
    "Sök",
    "Skolan",
    "Skolan/lyrik",
    "Statistik"
  ])
  await expect(page.locator('.quick-search-options [role="option"]', { hasText: "Inga träffar." })).toHaveAttribute("aria-disabled", "true")

  const beforeSlash = await queries(request)
  await page.locator("#autocomplete").fill("/id")
  await page.waitForTimeout(300)
  await expect(page.locator(".quick-search-options")).toHaveCount(0)
  expect(await queries(request)).toEqual(beforeSlash)

  await search(page, "strindbrg")
  await expect(page.locator(".quick-search-correction .type_label")).toHaveText("Menade du")
  await page.getByText("strindberg", { exact: true }).click()
  await expect(page.locator("#autocomplete")).toHaveValue("strindberg")
  await expect(page.getByText("Strindberg, August (1849-1912)", { exact: true })).toBeVisible()
  await expect(page.getByRole("dialog")).toBeVisible()

  await request.put(`${fixture}/_quick_search_failure`)
  await search(page, "sta")
  await expect(page.locator(".quick-search-options .quick-search-label")).toHaveText([
    "Start",
    "Statistik"
  ])
  await expect(page.getByText("Inga träffar.", { exact: true })).toHaveCount(0)
})

test("keeps every ordinary static command and alias in Angular order", async ({ page }) => {
  await openShell(page)
  await openQuickSearch(page)

  const cases = [
    ["star", ["Start"]],
    ["b", ["Bibliotek"]],
    ["e", ["Epub"]],
    ["l", ["Ljud och bild", "Läshistorik"]],
    ["sok", ["Sök"]],
    ["p", ["Presentationer"]],
    ["d", ["Dramawebben"]],
    ["n", ["Nytillkommet"]],
    ["sk", ["Skolan", "Skolan/lyrik"]],
    ["o", ["Om"]],
    ["hjalp", ["Hjälp"]],
    ["k", ["Kontakt"]],
    ["sta", ["Start", "Statistik"]]
  ] as const

  for (const [prefix, labels] of cases) {
    await search(page, prefix)
    await expect(page.locator(".quick-search-options .quick-search-label")).toHaveText([
      "Inga träffar.",
      ...labels
    ])
  }
})

test("mouse and wrapped keyboard selection navigate exact URLs and skip the disabled no-hit row", async ({ page }) => {
  await openShell(page)
  await openQuickSearch(page)
  await search(page, "strindberg")

  const rows = selectableRows(page)
  const input = page.locator("#autocomplete")
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toHaveClass(/\bactive\b/)
  await expect(input).toHaveAttribute("aria-activedescendant", await rows.nth(0).getAttribute("id") ?? "")
  await page.keyboard.press("ArrowUp")
  await expect(rows.nth(2)).toHaveClass(/\bactive\b/)
  await expect(input).toHaveAttribute("aria-activedescendant", await rows.nth(2).getAttribute("id") ?? "")
  await page.keyboard.press("ArrowDown")
  await expect(rows.nth(0)).toHaveClass(/\bactive\b/)
  await expect(input).toHaveAttribute("aria-activedescendant", await rows.nth(0).getAttribute("id") ?? "")
  await rows.nth(1).hover()
  await expect(rows.nth(1)).toHaveClass(/\bactive\b/)
  await expect(input).toHaveAttribute("aria-activedescendant", await rows.nth(1).getAttribute("id") ?? "")
  await rows.nth(1).click()
  await expect(page).toHaveURL("/författare/StrindbergA/titlar/RodaRummet/sida/1/etext")

  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await openQuickSearch(page)
  await search(page, "kon")
  await expect(selectableRows(page)).toHaveCount(1)
  await expect(selectableRows(page)).toHaveText("Gå till sidanKontakt")
  await page.keyboard.press("Tab")
  await expect(page).toHaveURL("/om/kontakt")
})

test("Enter selects the active row and Escape first dismisses options then closes", async ({ page }) => {
  await openShell(page)
  await openQuickSearch(page)
  await search(page, "strindberg")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.locator(".quick-search-options")).toHaveCount(0)
  const url = page.url()
  await page.locator("#autocomplete").press("Enter")
  await expect(page).toHaveURL(url)
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.locator("#autocomplete").press("Tab")
  await expect(page).toHaveURL(url)
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await openQuickSearch(page)
  await search(page, "hjä")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL("/om/hjalp")
})

test("footer closes and navigates to the library", async ({ page }) => {
  await openShell(page)
  await openQuickSearch(page)
  const footer = page.locator(".autocomplete .footer")
  await expect(footer).toHaveText(
    "Gå till biblioteket om du vill utföra mer avancerade sökningar"
  )
  await footer.getByRole("link", { name: "biblioteket", exact: true }).click()
  await expect(page).toHaveURL("/bibliotek")
  await expect(page.getByRole("dialog")).toHaveCount(0)
})
