import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

type Operation = "results" | "count" | "options" | "chronology"
type RecordedRequest = {
  method: string
  path: string
  body: Record<string, unknown>
  started_at?: number
  completed_at?: number | null
  results_started_before_completion?: number | null
}

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_text_search/requests`),
    request.delete(`${fixture}/_text_search/failures`),
    request.delete(`${fixture}/_text_search/delays`)
  ])
}

async function requests(request: APIRequestContext, operation: Operation) {
  const response = await request.get(`${fixture}/_text_search/requests/${operation}`)
  return (await response.json() as { requests: RecordedRequest[] }).requests
}

function browserProblems(page: Page) {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())
      || /hydration|duplicate keys|unhandledrejection/i.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  return problems
}

function observeUnfilteredResults(page: Page) {
  const failed: string[] = []
  const completed: number[] = []
  page.on("requestfailed", request => {
    if (
      request.method() === "POST"
      && new URL(request.url()).pathname === "/api/v2/text-search/results"
      && !Object.hasOwn(request.postDataJSON(), "facet_author_id")
    ) failed.push(request.failure()?.errorText ?? "")
  })
  page.on("response", response => {
    const request = response.request()
    if (
      request.method() === "POST"
      && new URL(request.url()).pathname === "/api/v2/text-search/results"
      && !Object.hasOwn(request.postDataJSON(), "facet_author_id")
    ) completed.push(response.status())
  })
  return { failed, completed }
}

async function openSearch(page: Page, route = "/s%C3%B6k") {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  await page.locator('[data-search-root][data-search-mounted="true"]').waitFor()
}

async function submitPhrase(page: Page, phrase: string) {
  await page.getByLabel("Sökfras").fill(phrase)
  await page.locator(".submit_form").evaluate(form => (form as HTMLFormElement).requestSubmit())
}

async function selectMulti(page: Page, placeholder: string, option: string | RegExp) {
  const before = page.url()
  const selection = page.getByRole("button", { name: `Visa alternativ för ${placeholder}` })
    .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' select2-selection--multiple ')]")
  await selection.click()
  await page.getByRole("option", { name: option }).click()
  await expect.poll(() => page.url()).not.toBe(before)
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  await page.keyboard.press("Escape")
}

test("vue-multiselect title search selects and removes a route-owned title", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?avancerad=1")
  await request.delete(`${fixture}/_text_search/requests/options`)

  const title = page.locator(".title_select")
  await title.getByRole("button", { name: "Visa alternativ för Titlar" }).click()
  await expect(title.locator(".multiselect")).toBeVisible()
  await title.locator("input.select2-search__field").pressSequentially("röda")
  await expect.poll(async () => (
    (await requests(request, "options")).at(-1)?.body.title_filter
  )).toBe("röda")

  await title.getByRole("option", { name: "Röda rummet", exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("titlar")).toBe("lb238704")
  await title.getByRole("button", { name: "Ta bort Röda rummet" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.has("titlar")).toBe(false)
})

test("an overlong title filter clears loading and reports a recoverable error", async ({ page }) => {
  const problems = browserProblems(page)
  await openSearch(page, "/s%C3%B6k?avancerad=1")

  const title = page.locator(".title_select")
  await title.getByRole("button", { name: "Visa alternativ för Titlar" }).click()
  await title.locator("input.select2-search__field").fill("x".repeat(201))

  await expect(page.locator(".title_options_error")).toBeVisible()
  await expect(title.getByLabel("Laddar alternativ")).toHaveCount(0)
  expect(problems).toEqual([])
})

test("vue-multiselect names each real keyboard control without a searchbox suffix", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?avancerad=1")

  for (const control of [
    page.getByRole("combobox", { name: "Författarskap", exact: true }),
    page.getByRole("textbox", { name: "Titlar", exact: true }),
    page.getByRole("combobox", { name: "Språk …", exact: true }),
    page.getByRole("combobox", { name: "Om ett författarskap", exact: true }),
    page.getByRole("combobox", {
      name: "Filtrera: Kategorier / Utgivare", exact: true
    })
  ]) {
    await expect(control).toHaveCount(1)
    await control.focus()
    await expect(control).toBeFocused()
  }
  await expect(page.getByLabel(/-searchbox$/)).toHaveCount(0)
})

test("vue-multiselect preserves declared option order, unknown selections, labels, and disabled rows", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1&forfattare=missing,StrindbergA")
  const authors = page.locator(".author_select")
  await expect(authors.getByRole("button", { name: "Ta bort Strindberg" })).toBeVisible()
  await expect(authors.getByRole("button", { name: "Ta bort missing" })).toBeVisible()
  await authors.getByRole("button", { name: "Visa alternativ för Författarskap" }).click()
  await expect(authors.getByRole("option", { name: "Lagerlöf, Selma (1858-1940)" })).toBeVisible()
  await authors.getByRole("option", { name: "Lagerlöf, Selma (1858-1940)" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("forfattare"))
    .toBe("LagerlöfS,StrindbergA,missing")

  const categories = page.locator(".keyword_select")
  await categories.getByRole("button", {
    name: "Visa alternativ för Filtrera: Kategorier / Utgivare"
  }).click()
  await expect(categories.getByText("Dramatik", { exact: true })).toBeVisible()
  await expect(categories.getByRole("option", { name: "Dramatik" })).toHaveCount(0)

  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(authors.getByRole("button", { name: "Ta bort Lagerlöf" })).toBeVisible()
  await expect(authors.getByRole("button", { name: "Ta bort Strindberg" })).toBeVisible()
  await expect(authors.getByRole("button", { name: "Ta bort missing" })).toBeVisible()
})

test("vue-multiselect accepts Enter selection and keeps legacy dropdown geometry", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?avancerad=1")
  const authors = page.locator(".author_select")
  const control = authors.getByRole("combobox")
  await control.focus()
  await control.press("Enter")
  await expect.poll(() => new URL(page.url()).searchParams.get("forfattare")).toBe("LagerlöfS")

  await authors.getByRole("button", { name: "Visa alternativ för Författarskap" }).click()
  const option = authors.getByRole("option", { name: "Lagerlöf, Selma (1858-1940)" })
    .locator(".multiselect__option")
  await expect(option).toHaveCSS("padding-top", "6px")
  await expect(option).toHaveCSS("min-height", "0px")
  await expect(option).toHaveCSS("line-height", "normal")
})

test("advanced vue-multiselect SSR hydration renders without browser warnings", async ({ page }) => {
  const problems = browserProblems(page)
  await openSearch(page, "/s%C3%B6k?avancerad=1&forfattare=StrindbergA")
  await expect(page.locator(".author_select .multiselect")).toBeVisible()
  await expect(page.getByRole("button", { name: "Ta bort Strindberg" })).toBeVisible()
  await page.waitForTimeout(200)
  expect(problems).toEqual([])
})

test("selected advanced multiselects keep chips beside a distinct labeled row", async ({ page }) => {
  await openSearch(
    page,
    "/s%C3%B6k?avancerad=1&forfattare=StrindbergA&titlar=lb238704" +
      "&languages=language:swe&keywords=texttype:roman&authorkeyword=Lagerl%C3%B6fS"
  )

  for (const control of ["author", "title", "lang", "about", "keyword"]) {
    const root = page.locator(`.${control}_select`)
    const chip = root.locator(".select2-selection__choice").first()
    const row = root.locator(".search-multiselect__input-row, input.multiselect__input").first()
    await expect(chip).toBeVisible()
    await expect(row).toBeVisible()
    const [rootBox, chipBox, rowBox] = await Promise.all([
      root.boundingBox(),
      chip.boundingBox(),
      row.boundingBox()
    ])
    expect(rootBox?.height).toBeLessThan(45)
    expect(chipBox!.x + chipBox!.width).toBeLessThanOrEqual(rowBox!.x)
    expect(Math.abs(chipBox!.y - rowBox!.y)).toBeLessThan(8)
  }
})

async function pushRoute(page: Page, route: string) {
  await page.evaluate(async target => {
    type VueRoot = HTMLElement & {
      __vue_app__: { config: { globalProperties: {
        $router: { push: (value: string) => Promise<void> }
      } } }
    }
    const root = document.querySelector("#__nuxt") as VueRoot
    await root.__vue_app__.config.globalProperties.$router.push(target)
  }, route)
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

test("reset is absent when pristine, clears every query key, and restores search focus", async ({
  page
}) => {
  await openSearch(page)
  await expect(page.getByRole("button", { name: "Rensa sökningen" })).toHaveCount(0)

  await openSearch(page, "/s%C3%B6k?avancerad=1&avancerad=0")
  await expect(page.getByRole("button", { name: "Rensa sökningen" })).toHaveCount(0)

  await openSearch(page, "/s%C3%B6k?fras=frihet&utm=one&utm=two")
  const resetButton = page.getByRole("button", { name: "Rensa sökningen" })
  await expect(resetButton).toBeVisible()
  const historyLength = await page.evaluate(() => history.length)

  await resetButton.click()

  await expect.poll(() => new URL(page.url()).search).toBe("")
  await expect(page).toHaveURL(/\/s(?:%C3%B6|ö)k$/)
  await expect(page.getByRole("button", { name: "Rensa sökningen" })).toHaveCount(0)
  await expect(page.getByLabel("Sökfras")).toBeFocused()
  await expect.poll(() => page.evaluate(() => history.length)).toBe(historyLength + 1)
})

test("an unrecognized query key makes reset available and reset removes it", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?okand=ett&okand=tv%C3%A5")
  const resetButton = page.getByRole("button", { name: "Rensa sökningen" })
  await expect(resetButton).toBeVisible()

  await resetButton.press("Enter")

  await expect.poll(() => new URL(page.url()).search).toBe("")
  await expect(page.getByLabel("Sökfras")).toBeFocused()
})

test("category multiselect exposes legacy groups and canonicalizes selections from each", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?avancerad=1&utm=keep&utm=twice")
  const categories = page.locator(".keyword_select")
  await categories.getByRole("button", {
    name: "Visa alternativ för Filtrera: Kategorier / Utgivare"
  }).click()

  const headings = categories.locator(".select2-results__group")
  await expect(headings).toHaveText(["Kategorier", "Projekt", "Avdelningar", "Utgivare"])

  for (const option of [
    "Svenska Akademien",
    "Dramawebben",
    "Gunnar Ekelöf. Sent på jorden",
    "Romaner"
  ]) {
    await categories.getByRole("option", { name: option, exact: true }).click()
  }

  await expect.poll(() => new URL(page.url()).searchParams.get("keywords")).toBe(
    "texttype:roman,keyword:sentpajorden,keyword:Dramawebben,provenance.library:SA"
  )
  const query = new URL(page.url()).searchParams
  expect(query.getAll("utm")).toEqual(["keep", "twice"])
  await expect(categories.getByRole("button", { name: "Ta bort Romaner" })).toBeVisible()
  await expect(categories.getByRole("button", {
    name: "Ta bort Gunnar Ekelöf. Sent på jorden"
  })).toBeVisible()
  await expect(categories.getByRole("button", { name: "Ta bort Dramawebben" })).toBeVisible()
  await expect(categories.getByRole("button", { name: "Ta bort Svenska Akademien" })).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(categories.locator(".multiselect__content-wrapper")).toBeHidden()
})

test("submit and advanced toggle preserve unrelated query while reset clears everything", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?utm=keep&fras=old&traffsida=3&sok_filter=StrindbergA")
  await submitPhrase(page, "  frihet  ")
  await expect.poll(() => new URL(page.url()).searchParams.toString()).toBe("utm=keep&fras=frihet")

  await page.locator("[data-search-advanced]").click()
  await expect.poll(() => new URL(page.url()).searchParams.get("avancerad")).toBe("1")
  expect(new URL(page.url()).searchParams.get("utm")).toBe("keep")
  await expect(page.locator("[data-search-advanced]")).toHaveAttribute("type", "button")

  await page.getByRole("button", { name: "Rensa sökningen" }).click()
  await expect.poll(() => new URL(page.url()).search).toBe("")
  await expect(page.getByLabel("Sökfras")).toHaveValue("")
  await expect(page.locator("#results table.results")).toHaveCount(0)
})

test("advanced mode does not refetch an unchanged primary search", async ({ page, request }) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  await expect.poll(async () => (await requests(request, "count")).length).toBeGreaterThan(0)
  await page.waitForTimeout(100)
  const initialCountRequests = (await requests(request, "count")).length

  const disclosure = page.locator("[data-search-advanced]")
  await expect(disclosure).toHaveAttribute("aria-expanded", "false")
  await expect(disclosure).toHaveAttribute("aria-controls", "text-search-advanced-panel")
  await disclosure.click()
  await expect(disclosure).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator("#text-search-advanced-panel.bottom_row")).toBeVisible()
  await disclosure.click()
  await expect(disclosure).toHaveAttribute("aria-expanded", "false")
  await expect(page.locator(".bottom_row")).toHaveCount(0)
  await page.waitForTimeout(100)

  expect(await requests(request, "results")).toHaveLength(1)
  expect(await requests(request, "count")).toHaveLength(initialCountRequests)
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
})

test("simple search loads chronology bounds without loading full options", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet")

  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1248")
  await expect(page.getByLabel("Till år", { exact: true })).toHaveValue("2026")
  expect(await requests(request, "chronology")).toHaveLength(1)
  expect(await requests(request, "options")).toEqual([])
})

for (const { description, yearFrom, yearTo, minimum, maximum } of [
  {
    description: "lower-only inverted",
    yearFrom: 2000,
    yearTo: null,
    minimum: "1950",
    maximum: "2000"
  },
  {
    description: "upper-only inverted",
    yearFrom: null,
    yearTo: 1700,
    minimum: "1700",
    maximum: "1800"
  },
  {
    description: "upper-only global edge",
    yearFrom: null,
    yearTo: 2200,
    minimum: "1800",
    maximum: "2200"
  }
]) {
  test(`partial simple chronology endpoints produce ordered bounds: ${description}`, async ({
    page
  }) => {
    await page.route("**/api/v2/text-search/chronology", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      json: { year_from: yearFrom, year_to: yearTo }
    }))
    await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1")
    await page.locator("[data-search-advanced]").click()
    await expect.poll(() => new URL(page.url()).searchParams.has("avancerad")).toBe(false)

    const ranges = page.locator(".chronology_ranges input[type='range']")
    await expect(ranges.nth(0)).toHaveAttribute("min", minimum)
    await expect(ranges.nth(0)).toHaveAttribute("max", maximum)
    await expect(page.getByLabel("Från år", { exact: true })).toHaveValue(minimum)
    await expect(page.getByLabel("Till år", { exact: true })).toHaveValue(maximum)
  })
}

test("direct search hydrates its loading shell before rendering one client result", async ({
  page,
  request
}) => {
  const problems = browserProblems(page)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 5000 }
  })
  const started = Date.now()

  const response = await page.goto("/s%C3%B6k?fras=frihet", { waitUntil: "domcontentloaded" })
  const elapsed = Date.now() - started

  expect(response?.status()).toBe(200)
  expect(elapsed).toBeLessThan(3500)
  await page.locator('[data-search-root][data-search-mounted="true"]').waitFor()
  await expect(page.locator(".submit_form .top_row .spinner")).toBeVisible()
  await expect(page.locator("#results table.results")).toHaveCount(0)
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  expect(await requests(request, "count")).toEqual([])
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true }))
    .toBeVisible({ timeout: 9000 })
  await expect(page.locator(".submit_form .top_row .spinner")).toBeHidden()
  expect(await requests(request, "results")).toHaveLength(1)
  expect(await requests(request, "count")).toHaveLength(1)
  expect(problems).toEqual([])
})

test("a failed deferred count retries when its accepted primary identity is revisited", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_text_search/failures`, { data: { operation: "count" } })
  const failedCountResponse = page.waitForResponse(response =>
    response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/v2/text-search/count"
  )
  await openSearch(page, "/s%C3%B6k?fras=frihet")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await expect.poll(async () => (await requests(request, "count")).length).toBe(1)
  expect((await failedCountResponse).status()).toBe(503)
  await expect(page.locator(".hits_info .hits")).toBeHidden()

  await request.delete(`${fixture}/_text_search/failures/count`)
  await pushRoute(page, "/s%C3%B6k?fras=inga")
  await expect(page.getByText("Din sökning gav inga träffar", { exact: true })).toBeVisible()
  await expect.poll(async () => (await requests(request, "count")).length).toBe(2)
  await request.delete(`${fixture}/_text_search/requests/count`)

  await page.goBack()
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await expect.poll(async () => (await requests(request, "count")).length).toBe(1)
  expect((await requests(request, "count"))[0]?.body.query).toBe("frihet")
  await expect(page.locator(".hits_info .hits")).toHaveText("3")
})

test("rapid history changes launch a count only for the finally accepted primary", async ({
  page,
  request
}) => {
  await openSearch(page)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 1200 }
  })
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "overflow", delay: 1200 }
  })

  await pushRoute(page, "/s%C3%B6k?fras=frihet")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  await pushRoute(page, "/s%C3%B6k?fras=overflow")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  await page.goBack()

  await expect(page.getByRole("link", { name: "Röda rummet", exact: true }))
    .toBeVisible({ timeout: 5000 })
  await expect(page.locator(".hits_info .hits")).toHaveText("3")
  await expect.poll(async () => (await requests(request, "count")).length).toBe(1)
  await page.waitForTimeout(1300)
  expect((await requests(request, "count")).map(item => item.body.query)).toEqual(["frihet"])
})

test("failed chronology is serialized once and is not retried during hydration", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_text_search/failures`, {
    data: { operation: "chronology" }
  })

  await openSearch(page, "/s%C3%B6k?fras=frihet")
  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1800")
  await expect(page.getByLabel("Till år", { exact: true })).toHaveValue("1950")
  await page.waitForTimeout(500)

  expect(await requests(request, "chronology")).toHaveLength(1)
})

test("direct advanced routes use option bounds without requesting chronology", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1")

  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1849")
  await expect(page.getByLabel("Till år", { exact: true })).toHaveValue("1940")
  expect(await requests(request, "chronology")).toEqual([])
  expect(await requests(request, "options")).toHaveLength(1)
})

test("direct advanced chronology outside catalog bounds preserves its selected interval", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1&intervall=1800,1900")

  const ranges = page.locator(".chronology_ranges input[type='range']")
  await expect(ranges.nth(0)).toHaveAttribute("min", "1800")
  await expect(ranges.nth(0)).toHaveAttribute("max", "1940")
  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1800")
  await expect(page.getByLabel("Till år", { exact: true })).toHaveValue("1900")

  await expect.poll(async () => (await requests(request, "results")).at(-1)?.body)
    .toMatchObject({ year_from: 1800, year_to: 1900 })
  expect((await requests(request, "options")).at(-1)?.body).toMatchObject({
    year_from: 1800,
    year_to: 1900
  })

  await page.getByLabel("Från år", { exact: true }).fill("1850")
  await page.getByLabel("Från år", { exact: true }).blur()
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1850,1900")
  await expect(ranges.nth(0)).toHaveAttribute("min", "1849")
  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1850")
  await expect(page.getByLabel("Till år", { exact: true })).toHaveValue("1900")
})

test("direct advanced chronology wholly outside catalog bounds keeps both selected endpoints", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1&intervall=1800,2000")

  const ranges = page.locator(".chronology_ranges input[type='range']")
  await expect(ranges.nth(0)).toHaveAttribute("min", "1800")
  await expect(ranges.nth(0)).toHaveAttribute("max", "2000")
  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1800")
  await expect(page.getByLabel("Till år", { exact: true })).toHaveValue("2000")
})

for (const { description, query, yearFrom, yearTo, minimum, maximum } of [
  {
    description: "lower-only inverted",
    query: "lower-only",
    yearFrom: 2000,
    yearTo: null,
    minimum: "1950",
    maximum: "2000"
  },
  {
    description: "upper-only inverted",
    query: "upper-only",
    yearFrom: null,
    yearTo: 1700,
    minimum: "1700",
    maximum: "1800"
  },
  {
    description: "upper-only global edge",
    query: "upper-edge",
    yearFrom: null,
    yearTo: 2200,
    minimum: "1800",
    maximum: "2200"
  }
]) {
  test(`partial option chronology endpoints produce ordered bounds: ${description}`, async ({
    page
  }) => {
    await page.route("**/api/v2/text-search/options", async route => {
      const response = await route.fetch()
      const body = await response.json() as Record<string, unknown>
      await route.fulfill({ response, json: { ...body, year_from: yearFrom, year_to: yearTo } })
    })
    await openSearch(page, `/s%C3%B6k?fras=${query}`)
    const response = page.waitForResponse(candidate => (
      new URL(candidate.url()).pathname === "/api/v2/text-search/options"
      && candidate.request().postDataJSON().query === query
    ))
    await page.locator("[data-search-advanced]").click()
    await response

    const ranges = page.locator(".chronology_ranges input[type='range']")
    await expect(ranges.nth(0)).toHaveAttribute("min", minimum)
    await expect(ranges.nth(0)).toHaveAttribute("max", maximum)
    await expect(page.getByLabel("Från år", { exact: true })).toHaveValue(minimum)
    await expect(page.getByLabel("Till år", { exact: true })).toHaveValue(maximum)
  })
}

test("simple chronology bounds survive an advanced mode round trip", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet")
  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1248")
  await expect(page.getByLabel("Till år", { exact: true })).toHaveValue("2026")

  await page.locator("[data-search-advanced]").click()
  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1849")
  await expect(page.getByLabel("Till år", { exact: true })).toHaveValue("1940")
  await page.locator("[data-search-advanced]").click()

  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1248")
  await expect(page.getByLabel("Till år", { exact: true })).toHaveValue("2026")
  expect(await requests(request, "chronology")).toHaveLength(1)
})

test("leaving a direct advanced route loads simple chronology exactly once", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1")
  expect(await requests(request, "chronology")).toEqual([])

  await page.locator("[data-search-advanced]").click()

  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1248")
  await expect(page.getByLabel("Till år", { exact: true })).toHaveValue("2026")
  expect(await requests(request, "chronology")).toHaveLength(1)

  await page.locator("[data-search-advanced]").click()
  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1849")
  await page.locator("[data-search-advanced]").click()
  await expect(page.getByLabel("Från år", { exact: true })).toHaveValue("1248")
  expect(await requests(request, "chronology")).toHaveLength(1)
})

test("simple-route chronology finishes before the deferred client primary search starts", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "chronology", selector: "", delay: 800 }
  })

  await openSearch(page, "/s%C3%B6k?fras=frihet")

  const chronologyRequest = (await requests(request, "chronology"))[0]
  expect(chronologyRequest?.completed_at).not.toBeNull()
  expect(chronologyRequest?.completed_at).toBeGreaterThan(chronologyRequest?.started_at ?? 0)
  expect(chronologyRequest?.results_started_before_completion).toBe(0)
})

test("every advanced filter family serializes exactly and reaches the semantic request", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?avancerad&utm=keep")
  await selectMulti(page, "Författarskap", /Lagerlöf, Selma/)
  await selectMulti(page, "Titlar", "Röda rummet")
  await selectMulti(page, "Språk …", "Svenska")
  await selectMulti(page, "Om ett författarskap", /Strindberg, August/)
  await selectMulti(page, "Filtrera: Kategorier / Utgivare", "Romaner")
  const gender = page.locator(".gender_select")
  await gender.getByRole("button").click()
  await gender.getByRole("option", { name: "Kvinnliga författare" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("kön")).toBe("female")

  const years = page.locator(".chronology_inputs input")
  await years.nth(0).fill("1879")
  await years.nth(0).dispatchEvent("change")
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1879,1940")
  await years.nth(1).fill("1912")
  await years.nth(1).dispatchEvent("change")
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1879,1912")
  await submitPhrase(page, "frihet")
  await expect.poll(() => new URL(page.url()).searchParams.get("fras")).toBe("frihet")

  const query = new URL(page.url()).searchParams
  expect(Object.fromEntries(query)).toEqual({
    utm: "keep",
    fras: "frihet",
    avancerad: "1",
    forfattare: "LagerlöfS",
    titlar: "lb238704",
    "kön": "female",
    languages: "language:swe",
    keywords: "texttype:roman",
    authorkeyword: "StrindbergA",
    intervall: "1879,1912"
  })
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  expect((await requests(request, "results"))[0]?.body).toMatchObject({
    query: "frihet",
    author_ids: ["LagerlöfS"],
    work_ids: ["lb238704"],
    gender: "female",
    languages: ["language:swe"],
    categories: ["texttype:roman"],
    about_author_ids: ["StrindbergA"],
    year_from: 1879,
    year_to: 1912
  })
})

test("selecting all authors clears the gender filter while preserving the visible selection", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1&k%C3%B6n=male")
  const gender = page.locator(".gender_select")
  await gender.getByRole("button").click()
  await gender.getByRole("option", { name: "Kvinnliga författare" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("kön")).toBe("female")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)

  await gender.getByRole("button").click()
  await gender.getByRole("option", { name: "Alla författare" }).click()

  await expect.poll(() => new URL(page.url()).searchParams.has("kön")).toBe(false)
  await expect(gender).toHaveAttribute("data-gender-value", "all")
  await expect(gender.getByRole("button")).toHaveText("Alla författare")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(3)
  const recorded = await requests(request, "results")
  expect(recorded.at(-2)?.body).toMatchObject({ query: "frihet", gender: "female" })
  expect(recorded.at(-1)?.body).toMatchObject({ query: "frihet" })
  expect(recorded.at(-1)?.body).not.toHaveProperty("gender")
})

test("chronology bare-track pointers move the nearest handle once and preserve route state", async ({
  page
}) => {
  const openRange = async () => {
    await openSearch(
      page,
      "/s%C3%B6k?fras=frihet&intervall=1300,1900&traffsida=3&keep=one&keep=two"
    )
    await page.evaluate(() => {
      const state = window as typeof window & { __rangeMutations?: number }
      const push = history.pushState.bind(history)
      state.__rangeMutations = 0
      history.pushState = (...args) => {
        state.__rangeMutations! += 1
        return push(...args)
      }
    })
  }
  const clickYear = async (year: number) => {
    const track = page.locator("[data-search-chronology-range]")
    await track.scrollIntoViewIfNeeded()
    const box = await track.boundingBox()
    expect(box).not.toBeNull()
    const x = box!.x + 10 + (box!.width - 20) * (year - 1248) / (2026 - 1248)
    await page.mouse.click(x, box!.y + box!.height / 2)
  }
  const mutationCount = () => page.evaluate(
    () => (window as typeof window & { __rangeMutations?: number }).__rangeMutations
  )

  await openRange()
  await clickYear(1400)
  await expect(page.getByRole("slider", { name: "Från år reglage" })).toBeFocused()
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1400,1900")
  const lowerQuery = new URL(page.url()).searchParams
  expect(lowerQuery.getAll("keep")).toEqual(["one", "two"])
  expect(lowerQuery.has("traffsida")).toBe(false)
  expect(await mutationCount()).toBe(1)

  await openRange()
  await clickYear(2000)
  await expect(page.getByRole("slider", { name: "Till år reglage" })).toBeFocused()
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1300,2000")
  expect(await mutationCount()).toBe(1)

  await openRange()
  await clickYear(1600)
  await expect(page.getByRole("slider", { name: "Till år reglage" })).toBeFocused()
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1300,1600")
  expect(await mutationCount()).toBe(1)

  await openRange()
  await page.locator("[data-search-chronology-range]").dispatchEvent("pointerdown", {
    button: 2,
    clientX: 0,
    clientY: 0,
    pointerId: 71
  })
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1300,1900")
  expect(await mutationCount()).toBe(0)
})

test("chronology native slider keyboard input remains independent of the bare track", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&intervall=1300,1900&keep=keyboard")
  const upper = page.getByRole("slider", { name: "Till år reglage" })
  await upper.focus()
  await page.keyboard.press("ArrowLeft")
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1300,1899")
  expect(new URL(page.url()).searchParams.get("keep")).toBe("keyboard")
})

test("chronology capture loss resets its draft and prevents a stale pointer commit", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&intervall=1300,1900&keep=capture")
  const track = page.locator("[data-search-chronology-range]")
  const box = await track.boundingBox()
  expect(box).not.toBeNull()
  const yearX = (year: number) => (
    box!.x + 10 + (box!.width - 20) * (year - 1248) / (2026 - 1248)
  )
  const y = box!.y + box!.height / 2

  await track.evaluate(element => {
    element.setPointerCapture = () => undefined
  })
  await track.dispatchEvent("pointerdown", {
    button: 0,
    clientX: yearX(1400),
    clientY: y,
    pointerId: 81
  })
  await expect(page.getByRole("slider", { name: "Från år reglage" })).toHaveValue("1400")
  await track.dispatchEvent("lostpointercapture", { pointerId: 81 })
  await expect(page.getByRole("slider", { name: "Från år reglage" })).toHaveValue("1300")
  await track.dispatchEvent("pointermove", {
    button: 0,
    clientX: yearX(1500),
    clientY: y,
    pointerId: 81
  })
  await track.dispatchEvent("pointerup", {
    button: 0,
    clientX: yearX(1500),
    clientY: y,
    pointerId: 81
  })

  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1300,1900")
  expect(new URL(page.url()).searchParams.get("keep")).toBe("capture")
})

test("chronology history navigation discards a dirty draft and restores each route", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1&intervall=1800,1900")
  await pushRoute(page, "/s%C3%B6k?fras=frihet&avancerad=1&intervall=1850,1900")

  const from = page.getByLabel("Från år", { exact: true })
  const to = page.getByLabel("Till år", { exact: true })
  await expect(from).toHaveValue("1850")
  await from.fill("1860")
  await expect(from).toHaveValue("1860")

  await page.goBack()
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1800,1900")
  await expect(from).toHaveValue("1800")
  await expect(to).toHaveValue("1900")

  await page.goForward()
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1850,1900")
  await expect(from).toHaveValue("1850")
  await expect(to).toHaveValue("1900")
})

test("late option bounds do not overwrite a chronology edit in progress", async ({
  page,
  request
}) => {
  const problems = browserProblems(page)
  await openSearch(page, "/s%C3%B6k?avancerad")
  const years = page.locator(".chronology_inputs input")
  await expect(years.nth(0)).toHaveValue("1849")
  await request.delete(`${fixture}/_text_search/requests/options`)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "", delay: 600 }
  })

  const gender = page.locator(".gender_select")
  await gender.getByRole("button").click()
  await gender.getByRole("option", { name: "Kvinnliga författare" }).click()
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await years.nth(0).fill("1879")
  await page.waitForTimeout(700)

  await expect(years.nth(0)).toHaveValue("1879")
  await years.nth(0).dispatchEvent("change")
  await page.waitForTimeout(100)
  expect(problems).toEqual([])
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1879,1940")
})

test("a completed chronology navigation does not overwrite a newer draft", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1&intervall=1800,1900")
  await page.evaluate(() => {
    const scope = window as typeof window & {
      __chronologyPushPending?: boolean
      __releaseChronologyPush?: () => void
      useNuxtApp?: () => {
        $router: { push: (target: unknown) => Promise<unknown> }
      }
    }
    const router = scope.useNuxtApp?.().$router
    if (!router) throw new Error("Nuxt router is unavailable")
    const push = router.push.bind(router)
    router.push = async target => {
      scope.__chronologyPushPending = true
      await new Promise<void>(resolve => { scope.__releaseChronologyPush = resolve })
      return push(target)
    }
  })

  const from = page.getByLabel("Från år", { exact: true })
  await from.fill("1850")
  await from.dispatchEvent("change")
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __chronologyPushPending?: boolean }
  ).__chronologyPushPending)).toBe(true)

  await from.fill("1860")
  await page.evaluate(() => (
    window as typeof window & { __releaseChronologyPush?: () => void }
  ).__releaseChronologyPush?.())
  await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
    .toBe("1850,1900")
  await expect(from).toHaveValue("1860")
})

test("title-only recovery cannot suppress a later static-options retry", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_text_search/failures`, { data: { operation: "options" } })
  await openSearch(page, "/s%C3%B6k?avancerad")
  await expect.poll(async () => (await requests(request, "options")).length).toBeGreaterThan(0)
  await page.waitForTimeout(100)
  await request.delete(`${fixture}/_text_search/requests/options`)
  await request.delete(`${fixture}/_text_search/failures/options`)

  const title = page.locator(".title_select input.select2-search__field")
  await title.fill("lager")
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)

  await page.locator("[data-search-advanced]").click()
  await page.locator("[data-search-advanced]").click()
  await expect.poll(async () => (await requests(request, "options")).length).toBe(2)
  await page.locator(".author_select .select2-selection--multiple").click()
  await expect(page.getByRole("option", { name: /Lagerlöf, Selma/ })).toHaveCount(1)
})

test("word modes and allowlisted legacy filters preserve exact URL and request ownership", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&utm=keep&keyword=source:sol&fuzzy=1")
  await page.getByRole("button", { name: "SÖK EFTER ORDBÖRJAN", exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("prefix")).toBe("1")
  await page.getByRole("button", { name: "SÖK EFTER ORDSLUT", exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("suffix")).toBe("1")
  const query = new URL(page.url()).searchParams
  expect(query.get("prefix")).toBe("1")
  expect(query.get("suffix")).toBe("1")
  expect(query.get("ej_modern")).toBe("1")
  expect(query.get("keyword")).toBe("source:sol")
  expect(query.get("fuzzy")).toBe("1")
  expect(query.get("utm")).toBe("keep")

  await expect.poll(async () => (await requests(request, "results")).length).toBe(3)
  expect((await requests(request, "results")).at(-1)?.body).toMatchObject({
    prefix: true,
    suffix: true,
    include_modernized: false,
    legacy_filters: [{ field: "source", value: "sol" }]
  })
})

test("Back and Forward atomically restore route-owned controls and results", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad")
  await selectMulti(page, "Författarskap", /Lagerlöf, Selma/)
  await selectMulti(page, "Språk …", "Svenska")
  await expect(page.locator(".lang_select .select2-selection__choice")).toContainText("Svenska")

  await page.goBack()
  await expect.poll(() => new URL(page.url()).searchParams.has("languages")).toBe(false)
  expect(new URL(page.url()).searchParams.get("forfattare")).toBe("LagerlöfS")
  await expect(page.locator(".author_select .select2-selection__choice")).toContainText("Lagerlöf")
  await expect(page.locator(".lang_select .select2-selection__choice")).toHaveCount(0)
  await page.goForward()
  await expect.poll(() => new URL(page.url()).searchParams.get("languages")).toBe("language:swe")
  await expect(page.locator(".lang_select .select2-selection__choice")).toContainText("Svenska")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
})

test("left and right keyboard pagination updates the canonical page and restores it", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow")
  await expect(page.locator("#results")).not.toHaveClass(/searching/)
  await page.locator("h1").click()
  await page.keyboard.press("ArrowRight")
  await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("2")
  await page.keyboard.press("ArrowLeft")
  await expect.poll(() => new URL(page.url()).searchParams.has("traffsida")).toBe(false)
})

test("zero-result pager uses guarded one-page bounds", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=inga")

  await expect(page.locator("#toolkit .littb_pager"))
    .toContainText("Visar verk 0-0 av 0, sida 1 av 1.")
})

test("an accepted out-of-range page replace-canonicalizes without a pager or history loop", async ({
  page,
  request
}) => {
  await openSearch(page)
  const historyLength = await page.evaluate(() => history.length)
  await page.evaluate(() => {
    const record = window as typeof window & { __pagerSamples?: string[] }
    record.__pagerSamples = []
    const toolkit = document.querySelector("#toolkit")
    if (!toolkit) throw new Error("Missing Search toolkit")
    const capture = () => {
      const text = toolkit.querySelector(".littb_pager")?.textContent?.replace(/\s+/gu, " ").trim()
      if (text) record.__pagerSamples!.push(text)
    }
    new MutationObserver(capture).observe(toolkit, {
      childList: true,
      characterData: true,
      subtree: true
    })
  })

  await pushRoute(page, "/s%C3%B6k?fras=frihet&traffsida=2")

  await expect.poll(() => new URL(page.url()).searchParams.has("traffsida")).toBe(false)
  const pager = page.locator("#toolkit .littb_pager")
  await expect(pager).toContainText("Visar verk 1-2 av 2, sida 1 av 1.")
  await expect(pager.getByRole("button", { name: "Nästa träffsida" })).toBeDisabled()
  await expect.poll(() => page.evaluate(() => history.length)).toBe(historyLength + 1)
  await expect.poll(async () => (await requests(request, "results")).map(entry => entry.body.page))
    .toEqual([2, 1])
  await page.waitForTimeout(200)
  expect((await requests(request, "results")).map(entry => entry.body.page)).toEqual([2, 1])
  const samples = await page.evaluate(() => (
    window as typeof window & { __pagerSamples?: string[] }
  ).__pagerSamples ?? [])
  expect(samples.some(text => /Visar verk \d+-\d+ av \d+, sida 2 av 1\./u.test(text)))
    .toBe(false)
  expect(samples.some(text => {
    const range = /Visar verk (\d+)-(\d+)/u.exec(text)
    return range !== null && Number(range[1]) > Number(range[2])
  })).toBe(false)
})

test("keyboard pagination does not intercept arrows inside form controls", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow&traffsida=2")
  await expect(page.locator("#results")).not.toHaveClass(/searching/)
  await page.evaluate(() => {
    const editor = document.createElement("div")
    editor.contentEditable = "true"
    editor.setAttribute("role", "textbox")
    editor.setAttribute("aria-label", "Testredigerare")
    editor.textContent = "Text"
    document.body.append(editor)
    editor.focus()
  })
  await page.evaluate(() => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", {
    key: "ArrowRight",
    bubbles: true,
    cancelable: true
  })))
  await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("2")
})

test("keyboard pagination yields to every focused interactive Search control", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow&traffsida=2&avancerad=1")
  await expect(page.locator("#results")).not.toHaveClass(/searching/)
  await page.evaluate(() => {
    const fixtures = document.createElement("div")
    fixtures.innerHTML = `
      <div role="listbox"><span data-shortcut-case="role-child">Alternativ</span></div>
      <div tabindex="-0" data-shortcut-case="parsed-zero">Fokuserbar</div>
      <audio controls data-shortcut-case="audio"></audio>
      <video controls data-shortcut-case="video"></video>
    `
    document.body.append(fixtures)
  })

  for (const [name, control, focus] of [
    ["reset button", page.getByRole("button", { name: "Rensa sökningen" }), true],
    ["result link", page.locator("#results .match a").first(), true],
    ["gender Listbox button", page.locator(".gender_select").getByRole("button"), true],
    ["interactive role ancestor", page.locator("[data-shortcut-case='role-child']"), false],
    ["parsed tabindex -0", page.locator("[data-shortcut-case='parsed-zero']"), true],
    ["audio controls", page.locator("[data-shortcut-case='audio']"), true],
    ["video controls", page.locator("[data-shortcut-case='video']"), true]
  ] as const) {
    await test.step(name, async () => {
      if (focus) {
        await control.focus()
        await expect(control).toBeFocused()
      }
      const notPrevented = await control.evaluate(element => element.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true
        })
      ))
      expect(notPrevented).toBe(true)
      await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("2")
    })
  }
})

test("keyboard pagination keeps noninteractive and negative-tabindex backgrounds active", async ({
  page
}) => {
  for (const [name, markup, selector, focus] of [
    [
      "parsed whitespace-prefixed negative tabindex",
      '<div tabindex=" -1" data-shortcut-case="negative-tabindex">Bakgrund</div>',
      "[data-shortcut-case='negative-tabindex']",
      true
    ],
    [
      "noninteractive role ancestor",
      '<main role="main"><span data-shortcut-case="role-main-child">Bakgrund</span></main>',
      "[data-shortcut-case='role-main-child']",
      false
    ],
    ["page background", "", "h1", false]
  ] as const) {
    await test.step(name, async () => {
      await openSearch(page, "/s%C3%B6k?fras=overflow&traffsida=2")
      if (markup) {
        await page.evaluate(value => document.body.insertAdjacentHTML("beforeend", value), markup)
      }
      const target = page.locator(selector)
      if (focus) {
        await target.focus()
        await expect(target).toBeFocused()
      }
      const notPrevented = await target.evaluate(element => element.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true
        })
      ))
      expect(notPrevented).toBe(false)
      await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("3")
    })
  }
})

test("vue-multiselect filters traverse by keyboard and remove accessibly", async ({ page, request }) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1")
  await request.delete(`${fixture}/_text_search/requests/results`)

  const authorControl = page.locator(".author_select").getByRole("combobox")
  await authorControl.focus()
  const strindberg = page.getByRole("option", { name: /Strindberg, August/ })
  await expect(strindberg).toBeVisible()
  await authorControl.press("ArrowDown")
  await expect(strindberg.locator(".multiselect__option"))
    .toHaveClass(/multiselect__option--highlight/)
  await strindberg.click()
  await expect.poll(() => new URL(page.url()).searchParams.get("forfattare"))
    .toBe("StrindbergA")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  expect((await requests(request, "results"))[0]?.body).toMatchObject({
    query: "frihet",
    author_ids: ["StrindbergA"]
  })

  await authorControl.press("Escape")
  const removeAuthor = page.getByRole("button", { name: "Ta bort Strindberg" })
  await removeAuthor.focus()
  await removeAuthor.press("Enter")
  await expect.poll(() => new URL(page.url()).searchParams.has("forfattare")).toBe(false)
  expect(await requests(request, "results")).toHaveLength(1)

  const gender = page.locator(".gender_select")
  await gender.getByRole("button").focus()
  await page.keyboard.press("Space")
  await page.keyboard.press("ArrowDown")
  const female = gender.getByRole("option", { name: "Kvinnliga författare" })
  await expect(female).toHaveClass(/select2-results__option--highlighted/)
  await page.keyboard.press("Enter")
  await expect.poll(() => new URL(page.url()).searchParams.get("kön")).toBe("female")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  expect((await requests(request, "results"))[1]?.body).toMatchObject({
    query: "frihet",
    gender: "female"
  })
  expect((await requests(request, "results"))[1]?.body).not.toHaveProperty("author_ids")
})

test("author facets and Visa alla own only sok_filter", async ({ page, request }) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&utm=keep")
  const navigator = page.locator(".navigator")
  const navigatorButtons = navigator.getByRole("button")
  const expectedAuthors = ["Visa alla", "Strindberg, August", "Lagerlöf, Selma"]
  await expect(navigatorButtons).toHaveText(expectedAuthors)

  await navigator.getByRole("button", { name: "Strindberg, August" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("sok_filter")).toBe("StrindbergA")
  expect(new URL(page.url()).searchParams.get("utm")).toBe("keep")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toHaveCount(0)
  expect((await requests(request, "results")).at(-1)?.body.facet_author_id).toBe("StrindbergA")
  await expect(navigatorButtons).toHaveText(expectedAuthors)
  await expect(navigator.getByRole("button", { name: "Strindberg, August" })).toHaveClass(/selected/)

  await navigator.getByRole("button", { name: "Visa alla" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.has("sok_filter")).toBe(false)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toBeVisible()
})

test("a direct author-filtered load keeps the unfiltered navigator and pager basis", async ({
  page,
  request
}) => {
  await openSearch(
    page,
    "/s%C3%B6k?fras=frihet&sok_filter=StrindbergA"
  )

  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true }))
    .toHaveCount(0)

  const navigator = page.locator(".navigator")
  await expect(navigator.getByRole("button")).toHaveText([
    "Visa alla",
    "Strindberg, August",
    "Lagerlöf, Selma"
  ])
  await expect(navigator.getByRole("button", { name: "Strindberg, August" }))
    .toHaveClass(/selected/)

  const pager = page.locator("#toolkit .littb_pager")
  await expect(pager.locator(".hits")).toHaveText("3")
  await expect(pager).toContainText("Visar verk 1-2 av 2, sida 1 av 1.")

  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  const resultBodies = (await requests(request, "results")).map(entry => entry.body)
  expect(resultBodies).toContainEqual(expect.objectContaining({
    query: "frihet",
    page: 1,
    facet_author_id: "StrindbergA"
  }))
  expect(resultBodies).toContainEqual(expect.objectContaining({
    query: "frihet",
    page: 1
  }))
  expect(resultBodies.filter(body => !Object.hasOwn(body, "facet_author_id"))).toHaveLength(1)
})

test("author-filtered reconciliation waits for the unfiltered pager basis", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "overflow:unfiltered", delay: 1200 }
  })
  await openSearch(
    page,
    "/s%C3%B6k?fras=overflow&traffsida=2&sok_filter=StrindbergA"
  )

  await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("2")
  await expect(page.locator("#toolkit .littb_pager"))
    .toContainText("Visar verk 31-60 av 64, sida 2 av 3.")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  await page.waitForTimeout(200)
  expect(new URL(page.url()).searchParams.get("traffsida")).toBe("2")
  expect((await requests(request, "results")).map(entry => entry.body.page).sort()).toEqual([1, 2])
})

test("author-filtered out-of-range reconciliation reacts when its pager basis becomes ready", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet:unfiltered", delay: 1200 }
  })
  await openSearch(
    page,
    "/s%C3%B6k?fras=frihet&traffsida=2&sok_filter=StrindbergA"
  )

  await expect.poll(() => new URL(page.url()).searchParams.has("traffsida")).toBe(false)
  await expect(page.locator("#toolkit .littb_pager"))
    .toContainText("Visar verk 1-2 av 2, sida 1 av 1.")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(3)
  await page.waitForTimeout(200)
  expect((await requests(request, "results")).map(entry => entry.body.page).sort())
    .toEqual([1, 1, 2])
})

test("rapid faceted A to B to A navigation retries the current navigator snapshot", async ({
  page,
  request
}) => {
  await page.addInitScript(() => {
    const NativeAbortController = window.AbortController
    class DelayedAbortController extends NativeAbortController {
      override abort(reason?: unknown) {
        window.setTimeout(() => super.abort(reason), 500)
      }
    }
    Object.defineProperty(window, "AbortController", { value: DelayedAbortController })
  })
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 1200 }
  })
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "overflow", delay: 1200 }
  })
  await openSearch(page, "/s%C3%B6k?fras=frihet&sok_filter=StrindbergA")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  await request.delete(`${fixture}/_text_search/requests/results`)

  await page.evaluate(async () => {
    type VueRoot = HTMLElement & {
      __vue_app__: { config: { globalProperties: {
        $router: { push: (value: string) => Promise<void> }
      } } }
    }
    const router = (document.querySelector("#__nuxt") as VueRoot)
      .__vue_app__.config.globalProperties.$router
    await router.push("/s%C3%B6k?fras=overflow&sok_filter=StrindbergA")
    await router.push("/s%C3%B6k?fras=frihet&sok_filter=StrindbergA")
  })

  await expect.poll(async () => (await requests(request, "results")).filter(entry => (
    entry.body.query === "frihet" && !Object.hasOwn(entry.body, "facet_author_id")
  )).length).toBe(1)
  await expect(page.locator(".navigator").getByRole("button")).toHaveText([
    "Visa alla",
    "Strindberg, August",
    "Lagerlöf, Selma"
  ])
})

test("removing a pending direct facet cancels its auxiliary snapshot", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 1200 }
  })
  const observed = observeUnfilteredResults(page)

  await openSearch(page, "/s%C3%B6k?fras=frihet&sok_filter=StrindbergA")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  await pushRoute(page, "/s%C3%B6k?fras=frihet")

  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true }))
    .toBeVisible({ timeout: 5000 })
  await expect.poll(() => observed.failed.length).toBe(1)
  expect(observed.completed).toEqual([200])
  expect((await requests(request, "results")).filter(entry => (
    !Object.hasOwn(entry.body, "facet_author_id")
  ))).toHaveLength(2)
})

test("unmounting a pending direct facet releases auxiliary ownership before re-entry", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 1200 }
  })
  const observed = observeUnfilteredResults(page)

  await openSearch(page, "/s%C3%B6k?fras=frihet&sok_filter=StrindbergA")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  await pushRoute(page, "/om/ide")
  await expect(page).toHaveURL(/\/om\/ide$/)
  await request.delete(`${fixture}/_text_search/delays/results`)

  await pushRoute(page, "/s%C3%B6k?fras=frihet&sok_filter=StrindbergA")
  await expect(page.locator(".navigator").getByRole("button")).toHaveText([
    "Visa alla",
    "Strindberg, August",
    "Lagerlöf, Selma"
  ])
  await expect.poll(() => observed.failed.length).toBe(1)
  expect(observed.completed).toEqual([200])
  expect((await requests(request, "results")).filter(entry => (
    !Object.hasOwn(entry.body, "facet_author_id")
  ))).toHaveLength(2)
})

test("author filtering keeps the main search pager totals", async ({ page, request }) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet")
  const pager = page.locator("#toolkit .littb_pager")
  await expect(pager.locator(".hits")).toHaveText("3")
  await expect(pager).toContainText("Visar verk 1-2 av 2, sida 1 av 1.")
  await expect.poll(async () => (await requests(request, "count")).length).toBe(1)

  await page.locator(".navigator")
    .getByRole("button", { name: "Strindberg, August" })
    .click()
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toHaveCount(0)
  await page.waitForTimeout(100)

  await expect(pager.locator(".hits")).toHaveText("3")
  await expect(pager).toContainText("Visar verk 1-2 av 2, sida 1 av 1.")
  expect(await requests(request, "count")).toHaveLength(1)
  expect((await requests(request, "count"))[0]?.body).not.toHaveProperty("facet_author_id")
})

test("author navigator remains available in the narrow desktop search layout", async ({
  page
}) => {
  await page.setViewportSize({ width: 665, height: 1000 })
  await openSearch(page, "/s%C3%B6k?fras=frihet")

  const navigator = page.locator(".navigator")
  await expect(navigator).toBeVisible()
  await expect(navigator.getByRole("button", { name: "Visa alla" })).toBeVisible()
  await expect(navigator.getByRole("button", { name: "Strindberg, August" })).toBeVisible()
})

test("Visa fler is scoped to its work and keeps original Reader route ownership", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow&prefix=1&traffsida=2")
  const overflow = page.locator("#results .overflow .more").last()
  await overflow.click()
  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  const body = (await requests(request, "results"))[1]?.body
  expect(body).toMatchObject({
    query: "overflow",
    page: 1,
    highlight_limit: 100,
    prefix: true,
    work_ids: ["lb278171"]
  })
  const href = await page.locator("tr.is_faksimil.sentence .match a").last().getAttribute("href")
  const reader = new URL(href!, "http://litteraturbanken.test")
  expect(reader.searchParams.get("s_page")).toBe("2")
  expect(reader.searchParams.get("s_prefix")).toBe("true")
})

test("Visa fler ignores duplicate activation while the same work is loading", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow")
  await request.delete(`${fixture}/_text_search/requests/results`)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "overflow", delay: 600 }
  })

  const more = page.locator("#results .overflow .more").last()
  await more.dispatchEvent("click")
  await expect(more).toHaveAttribute("aria-disabled", "true")
  await more.dispatchEvent("click")

  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  await expect(more).not.toHaveAttribute("aria-disabled", "true")
})

test("static options are lazy and cached while title search is exact 250 ms latest-wins", async ({
  page,
  request
}) => {
  await openSearch(page)
  expect(await requests(request, "options")).toEqual([])
  await page.locator("[data-search-advanced]").click()
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  expect((await requests(request, "options"))[0]?.body).toMatchObject({
    title_filter: "",
    title_limit: 30,
    include_static_options: true
  })
  await page.locator("[data-search-advanced]").click()
  await page.locator("[data-search-advanced]").click()
  expect(await requests(request, "options")).toHaveLength(1)

  await request.delete(`${fixture}/_text_search/requests/options`)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "lag", delay: 600 }
  })
  const input = page.locator(".title_select input.select2-search__field")
  await input.fill("lag")
  await page.waitForTimeout(200)
  expect(await requests(request, "options")).toEqual([])
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)

  await input.fill("lager")
  await page.waitForTimeout(200)
  expect(await requests(request, "options")).toHaveLength(1)
  await expect.poll(async () => (await requests(request, "options")).length).toBe(2)
  await expect(page.locator(".title_select .spinner")).toBeHidden()
  await expect(page.getByRole("option", { name: "Gösta Berlings saga" })).toHaveCount(1)
  await expect(page.getByRole("option", { name: "Röda rummet" })).toHaveCount(0)
  await page.waitForTimeout(700)
  await expect(page.getByRole("option", { name: "Röda rummet" })).toHaveCount(0)
})

test("title disclosure loads the expanded set and retries a local failure", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow&avancerad=1")
  await request.delete(`${fixture}/_text_search/requests/options`)
  await request.put(`${fixture}/_text_search/failures`, {
    data: { operation: "options" }
  })

  await page.getByRole("button", {
    name: "Visa alla 731 titlar"
  }).click()
  await expect.poll(async () => (await requests(request, "options")).at(-1)?.body)
    .toMatchObject({
      title_filter: "",
      title_limit: 500,
      include_static_options: false
    })
  const failure = page.getByRole("alert")
  await expect(failure).toContainText("Fler titlar kunde inte hämtas")

  await request.delete(`${fixture}/_text_search/failures/options`)
  await failure.getByRole("button", { name: "Försök igen" }).click()
  await expect.poll(async () => (await requests(request, "options")).length).toBe(2)
  await page.getByRole("button", { name: "Visa alternativ för Titlar" }).click()
  await expect(page.getByRole("option", { name: "Överflödestitel 500" })).toBeVisible()
})

test("filtered title disclosure stops after every distinct option is loaded", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1")
  await page.locator(".title_select input.select2-search__field").fill("doktor")
  const showAll = page.getByRole("button", {
    name: "Visa alla 43 matchande titlar"
  })
  await expect(showAll).toBeVisible()
  await showAll.click()
  await expect(page.getByText("Visar de första 41 matchande titlarna", { exact: true }))
    .toBeVisible()
  await expect(showAll).toHaveCount(0)
  await page.getByRole("button", { name: "Visa alternativ för Titlar" }).click()
  await expect(page.getByRole("option", { name: "Doktortitel 41" })).toBeVisible()
})

test("special title catalogs still resolve the selected route-owned title", async ({
  page
}) => {
  await openSearch(
    page,
    "/s%C3%B6k?fras=overflow&avancerad=1&titlar=lb238704"
  )

  await expect(page.getByRole("button", { name: "Ta bort Röda rummet" })).toBeVisible()
})

test("changing the title filter immediately invalidates a delayed expansion", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1")
  const input = page.locator(".title_select input.select2-search__field")
  await input.fill("overflow")
  const showAll = page.getByRole("button", {
    name: "Visa alla 731 matchande titlar"
  })
  await expect(showAll).toBeVisible()
  await request.delete(`${fixture}/_text_search/requests/options`)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "overflow", delay: 1000 }
  })

  await showAll.click()
  await expect.poll(async () => (await requests(request, "options")).at(-1)?.body)
    .toMatchObject({ title_filter: "overflow", title_limit: 500 })
  await expect(page.locator(".title_select .spinner")).toBeVisible()

  await input.fill("doktor")
  await expect(page.locator(".title_select .spinner"))
    .toHaveClass(/multiselect__loading-leave-/, { timeout: 150 })
  await expect.poll(async () => (await requests(request, "options")).at(-1)?.body)
    .toMatchObject({ title_filter: "doktor", title_limit: 30 })
  await expect(page.getByRole("option", { name: "Doktortitel 1", exact: true })).toBeVisible()
  await page.waitForTimeout(1100)
  await expect(page.getByRole("option", { name: "Överflödestitel 1", exact: true }))
    .toHaveCount(0)
})

test("title option retry repeats the exact failed filter and limit", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1")
  await request.delete(`${fixture}/_text_search/requests/options`)
  await request.put(`${fixture}/_text_search/failures`, {
    data: { operation: "options" }
  })

  await page.locator(".title_select input.select2-search__field").fill("lager")
  const failure = page.getByRole("alert")
  await expect(failure).toContainText("Fler titlar kunde inte hämtas")
  await request.delete(`${fixture}/_text_search/failures/options`)
  await request.delete(`${fixture}/_text_search/requests/options`)
  await failure.getByRole("button", { name: "Försök igen" }).click()

  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await expect.poll(async () => (await requests(request, "options"))[0]?.body)
    .toMatchObject({ title_filter: "lager", title_limit: 30 })
  await expect(page.getByRole("option", { name: "Gösta Berlings saga" })).toBeVisible()
})

test("primary and count owners cancel stale work and recover independently", async ({
  page,
  request
}) => {
  await openSearch(page)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 1200 }
  })
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "count", selector: "frihet", delay: 1200 }
  })
  await submitPhrase(page, "frihet")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  await submitPhrase(page, "inga")
  await expect(page.getByText("Din sökning gav inga träffar", { exact: true })).toBeVisible()
  await page.waitForTimeout(1300)
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toHaveCount(0)
  await expect(page.locator(".hits_info .hits")).toBeHidden()

  await request.put(`${fixture}/_text_search/failures`, { data: { operation: "count" } })
  await submitPhrase(page, "count-failure")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await request.delete(`${fixture}/_text_search/failures/count`)
  await submitPhrase(page, "overflow")
  await expect(page.locator(".hits_info .hits")).toHaveText("512")
})

test("primary, options, and more errors remain local and recover on retry", async ({
  page,
  request
}) => {
  await openSearch(page)
  await request.put(`${fixture}/_text_search/failures`, { data: { operation: "results" } })
  await submitPhrase(page, "primary-failure")
  await expect(page.locator("[data-search-error]")).toHaveText(
    "Sökresultatet kan inte visas just nu."
  )
  await request.delete(`${fixture}/_text_search/failures/results`)
  await submitPhrase(page, "frihet")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()

  await request.put(`${fixture}/_text_search/failures`, { data: { operation: "options" } })
  await page.locator("[data-search-advanced]").click()
  await expect.poll(async () => (await requests(request, "options")).length).toBeGreaterThan(0)
  await page.getByRole("button", { name: "Visa alternativ för Författarskap" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator(".author_select").getByRole("option", { name: /Södergran, Edith/ }))
    .toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.locator("[data-search-advanced]").click()
  await request.delete(`${fixture}/_text_search/failures/options`)
  await page.locator("[data-search-advanced]").click()
  await page.getByRole("button", { name: "Visa alternativ för Författarskap" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.getByRole("option", { name: /Lagerlöf, Selma/ })).toHaveCount(1)
  await page.keyboard.press("Escape")

  const overflowPrimaryResponse = page.waitForResponse(response => {
    if (response.request().method() !== "POST"
      || new URL(response.url()).pathname !== "/api/v2/text-search/results") return false
    const body = response.request().postDataJSON()
    return body.query === "overflow" && body.highlight_limit === 5 && !body.work_ids
  })
  await submitPhrase(page, "overflow")
  expect((await overflowPrimaryResponse).status()).toBe(200)
  await request.put(`${fixture}/_text_search/failures`, { data: { operation: "results" } })
  const more = page.locator("#results .overflow .more").last()
  const failedMoreResponse = page.waitForResponse(response =>
    response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/v2/text-search/results"
    && response.request().postDataJSON().highlight_limit === 100
  )
  await more.evaluate((button: HTMLButtonElement) => button.click())
  expect((await failedMoreResponse).status()).toBe(503)
  await expect(more).not.toHaveAttribute("aria-disabled", "true")
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(1)
  await request.delete(`${fixture}/_text_search/failures/results`)
  const recoveredMoreResponse = page.waitForResponse(response =>
    response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/v2/text-search/results"
    && response.request().postDataJSON().highlight_limit === 100
  )
  await more.evaluate((button: HTMLButtonElement) => button.click())
  expect((await recoveredMoreResponse).status()).toBe(200)
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(2)
})

test("options and more cancellation clear loading and reject stale identity data", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow&avancerad")
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "lager", delay: 1200 }
  })
  const input = page.locator(".title_select input.select2-search__field")
  await input.fill("lager")
  await expect(page.locator(".title_select .spinner")).toBeVisible()
  await page.locator("[data-search-advanced]").click()
  await expect(page.locator(".title_select .spinner")).toBeHidden()

  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "overflow", delay: 1200 }
  })
  await page.locator("#results .overflow .more").last().click()
  await page.getByRole("button", { name: "Nästa träffsida" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("2")
  await page.waitForTimeout(1300)
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(1)
  await expect(page.locator("#results .overflow .more").last()).toBeEnabled()
})

test("page-only navigation reuses the request-equivalent advanced options", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow&avancerad=1")
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await request.delete(`${fixture}/_text_search/requests/options`)

  await pushRoute(page, "/s%C3%B6k?fras=overflow&avancerad=1&traffsida=2")
  await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("2")
  await expect(page.locator("#results .overflow")).toHaveCount(2)
  await page.getByRole("button", { name: "Visa alternativ för Författarskap" }).click()
  await expect(page.getByRole("option", { name: /Lagerlöf, Selma/ })).toHaveCount(1)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)

  expect(await requests(request, "options")).toEqual([])
})

test("page-only navigation retains an equivalent in-flight options request", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow")
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "", delay: 900 }
  })

  await page.locator("[data-search-advanced]").click()
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await pushRoute(page, "/s%C3%B6k?fras=overflow&avancerad=1&traffsida=2")
  await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("2")
  await expect(page.locator("#results .overflow")).toHaveCount(2)
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await page.getByRole("button", { name: "Visa alternativ för Författarskap" }).click()
  await expect(page.getByRole("option", { name: /Lagerlöf, Selma/ })).toHaveCount(1)
})

test("page-only navigation retains an equivalent in-flight title-options request", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow&avancerad=1")
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await request.delete(`${fixture}/_text_search/requests/options`)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "lag", delay: 900 }
  })

  await page.locator(".title_select input.select2-search__field").fill("lag")
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await pushRoute(page, "/s%C3%B6k?fras=overflow&avancerad=1&traffsida=2")
  await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("2")
  await expect(page.locator("#results .overflow")).toHaveCount(2)
  await expect(page.getByRole("option", { name: "Gösta Berlings saga" })).toHaveCount(1)
  expect(await requests(request, "options")).toHaveLength(1)
})

test("delayed route owners expose only current selected fallbacks", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=route-a-options&avancerad=1")
  const authorOptions = page.getByRole("button", {
    name: "Visa alternativ för Författarskap"
  })
  await authorOptions.click()
  await expect(page.getByRole("option", { name: /Lagerlöf, Selma/ })).toHaveCount(1)
  await page.keyboard.press("Escape")

  await Promise.all([
    request.delete(`${fixture}/_text_search/requests/results`),
    request.delete(`${fixture}/_text_search/requests/options`)
  ])
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "inga", delay: 5000 }
  })
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "", delay: 5000 }
  })
  await pushRoute(
    page,
    "/s%C3%B6k?fras=inga&avancerad=1&forfattare=StrindbergA"
  )
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  expect((await requests(request, "results"))[0]?.body).toMatchObject({
    query: "inga",
    author_ids: ["StrindbergA"]
  })
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  expect((await requests(request, "options"))[0]?.body).toMatchObject({
    query: "inga",
    author_ids: ["StrindbergA"],
    include_static_options: true
  })

  await authorOptions.click()
  await expect(page.getByRole("option", { name: /Lagerlöf, Selma/ })).toHaveCount(0, {
    timeout: 1000
  })
  await expect(page.getByRole("option", { name: "StrindbergA" })).toHaveCount(1, {
    timeout: 1000
  })
})

test("SSR hydration is single-fetch and Reader hit destination is navigable", async ({
  page,
  request
}) => {
  const problems = browserProblems(page)
  await openSearch(page, "/s%C3%B6k?fras=frihet")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await page.waitForTimeout(400)
  expect(await requests(request, "results")).toHaveLength(1)
  const hit = page.locator("#results .match a").first()
  const href = await hit.getAttribute("href")
  const reader = new URL(href!, "http://litteraturbanken.test")
  expect(reader.pathname).toBe("/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/sida/1/etext")
  expect(reader.searchParams.get("hit")).toBe("0")
  expect(reader.searchParams.get("hit_index")).toBe("0")
  expect(reader.searchParams.get("q")).toBe("frihet")
  const response = await page.goto(href!, { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  await expect(page.locator("body")).toHaveClass(/page-reading/)
  await expect(page.locator("#w1_11.markee")).toHaveCount(1)
  expect(problems).toEqual([])
})

test("Search result return restores the exact origin and Reader hit", async ({ page }) => {
  const origin = "/s%C3%B6k?fras=overflow&traffsida=2&avancerad=1&forfattare=StrindbergA&utm=a+b&repeat=%2f&repeat=%2F"
  await openSearch(page, origin)
  const readerHref = await page.locator("#results .match a").first().getAttribute("href")
  expect(readerHref).not.toBeNull()
  await page.goto(readerHref!, { waitUntil: "networkidle" })

  const back = page.locator("#search_nav").getByRole("link", {
    name: "Tillbaka till sökningen"
  })
  await expect(back).toHaveAttribute("href", origin)
  await back.click()
  await expect(page).toHaveURL(origin)
  await expect(page.locator("#results .match a").first()).toBeVisible()

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page.locator("#search_nav")).toContainText("Träff 1, sida 1")
  await expect(page).toHaveURL(/q=overflow&hit=0&traff=w1_11/)
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.locator("#search_nav").getByRole("link", {
    name: "Tillbaka till sökningen"
  })).toHaveAttribute("href", origin)
})

test("a remounted Search result links back to its new SPA query", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet")
  await pushRoute(page, "/om/ide")
  await pushRoute(page, "/s%C3%B6k?fras=overflow")

  const readerHref = await page.locator("#results .match a").first().getAttribute("href")
  expect(readerHref).not.toBeNull()
  expect(new URL(readerHref!, "http://litteraturbanken.test").searchParams.get("s_return"))
    .toBe("/s%C3%B6k?fras=overflow")
})

test("completed searches hide the top-row activity indicator", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet")
  await expect(page.locator(".submit_form .top_row .spinner")).toBeHidden()
})

test("search head, body, background, and toolkit state clean up after client navigation", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet")
  await expect(page).toHaveTitle('Sök: "frihet" | Litteraturbanken')
  await expect(page.locator("body")).toHaveClass(/page-search/)
  await expect(page.locator("html")).toHaveCSS("background-image", /sok_bkg\.jpg/)
  await expect(page.locator("#toolkit .littb_pager")).toHaveCount(1)

  await pushRoute(page, "/om/ide")
  await expect(page).toHaveURL(/\/om\/ide$/)
  await expect(page.locator("body")).toHaveClass(/page-about/)
  await expect(page.locator("body")).not.toHaveClass(/page-search/)
  await expect(page.locator("html")).toHaveCSS("background-image", /about_bkg\.jpg/)
  await expect(page.locator("html")).not.toHaveCSS("background-image", /sok_bkg\.jpg/)
  await expect(page.locator("#toolkit .littb_pager")).toHaveCount(0)
  await expect(page).not.toHaveTitle(/Sök:/)
})

test("global search navigation remembers the exact query across pages and Back", async ({ page }) => {
  const origin = "/s%C3%B6k?utm=keep&fras=frihet&avancerad=1"
  await openSearch(page, origin)
  await page.evaluate(() => { (window as typeof window & { __spaSentinel?: string }).__spaSentinel = "search-spa" })

  await page.locator(".mainnav").getByRole("link", { name: "Om LB", exact: true }).click()
  await expect(page).toHaveURL("/om/ide")
  const searchLink = page.locator(".mainnav").getByRole("link", {
    name: "Sök i texterna",
    exact: true
  })
  await expect(searchLink).toHaveAttribute("href", origin)

  await searchLink.click()
  await expect(page).toHaveURL(origin)
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("search-spa")

  await page.goBack()
  await expect(page).toHaveURL("/om/ide")
  await page.goBack()
  await expect(page).toHaveURL(origin)
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("search-spa")
})
