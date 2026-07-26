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

test("selected advanced multiselects keep chips above a distinct labeled row", async ({ page }) => {
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
    expect(rootBox?.height).toBeGreaterThan(45)
    expect(rowBox!.y).toBeGreaterThanOrEqual(chipBox!.y + chipBox!.height)
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

test("submit, reset, and advanced toggle own search keys while preserving unrelated query", async ({
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
  await expect.poll(() => new URL(page.url()).search).toBe("?utm=keep")
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
  await page.waitForTimeout(50)
  expect(new URL(page.url()).searchParams.get("traffsida")).toBe("2")
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
  await page.locator(".navigator").getByRole("button", { name: "Strindberg, August" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("sok_filter")).toBe("StrindbergA")
  expect(new URL(page.url()).searchParams.get("utm")).toBe("keep")
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toHaveCount(0)
  expect((await requests(request, "results")).at(-1)?.body.facet_author_id).toBe("StrindbergA")

  await page.locator(".navigator").getByRole("button", { name: "Visa alla" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.has("sok_filter")).toBe(false)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toBeVisible()
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
  await page.locator(".littb_pager button[rel='prev']").click()
  await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("2")
  await page.waitForTimeout(1300)
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(1)
  await expect(page.locator("#results .overflow .more").last()).toBeEnabled()
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
  const origin = "/s%C3%B6k?fras=frihet&traffsida=2&avancerad=1&forfattare=StrindbergA&utm=a+b&repeat=%2f&repeat=%2F"
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
  await expect(page).toHaveURL(/q=frihet&hit=0&traff=w1_11/)
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.locator("#search_nav").getByRole("link", {
    name: "Tillbaka till sökningen"
  })).toHaveAttribute("href", origin)
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
