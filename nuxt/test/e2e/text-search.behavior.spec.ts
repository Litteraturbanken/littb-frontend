import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const removedCountRequests = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
  const observed: string[] = []
  removedCountRequests.set(page, observed)
  page.on("request", request => {
    if (new URL(request.url()).pathname.endsWith("/text-search/count")) {
      observed.push(request.url())
    }
  })
})

type Operation = "results" | "options" | "chronology"
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

type MoreResponseGate = {
  requests: number
  settled: number
  aborted: boolean[]
  workIds: string[]
  release: (index: number) => void
  releaseWork: (workId: string) => void
  releaseAll: () => void
  restore: () => void
}

async function installMoreResponseGate(page: Page) {
  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window)
    const releases: Array<() => void> = []
    const aborted: boolean[] = []
    const workIds: string[] = []
    let requests = 0
    let settled = 0
    let releaseEverything = false
    Object.assign(window, {
      __searchMoreGate: {
        get requests() { return requests },
        get settled() { return settled },
        aborted,
        workIds,
        release: (index: number) => releases[index]?.(),
        releaseWork: (workId: string) => releases[workIds.indexOf(workId)]?.(),
        releaseAll: () => {
          releaseEverything = true
          releases.forEach(release => release())
        },
        restore: () => { window.fetch = nativeFetch }
      }
    })
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const body = request.method === "POST"
        && new URL(request.url).pathname.endsWith("/text-search/results")
        ? await request.clone().json()
        : null
      if (body?.highlight_limit !== 100
        || !Array.isArray(body.work_ids)
        || body.work_ids.length !== 1
        || typeof body.work_ids[0] !== "string") {
        return nativeFetch(input, init)
      }
      const response = await nativeFetch(input, init)
      const responseBody = await response.arrayBuffer()
      const responseInit = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }
      const index = requests
      requests += 1
      workIds[index] = body.work_ids[0]
      await new Promise<void>(resolve => {
        releases[index] = resolve
        if (releaseEverything) resolve()
      })
      aborted[index] = request.signal.aborted
      settled += 1
      return new Response(responseBody, responseInit)
    }
  })
}

function moreResponseGate(page: Page) {
  return page.evaluate(() => (
    window as typeof window & { __searchMoreGate: MoreResponseGate }
  ).__searchMoreGate)
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

test("a selected title does not prevent searching for and selecting another title", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?avancerad=1")
  const title = page.locator(".title_select")
  await title.getByRole("button", { name: "Visa alternativ för Titlar" }).click()
  const input = title.locator("input.select2-search__field")

  await input.fill("röda")
  await title.getByRole("option", { name: "Röda rummet", exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("titlar")).toBe("lb238704")

  await input.fill("lager")
  await expect.poll(async () => (await requests(request, "options")).at(-1)?.body)
    .toMatchObject({
      title_filter: "lager",
      selected_work_ids: ["lb238704"]
    })
  expect((await requests(request, "options")).at(-1)?.body).not.toHaveProperty("work_ids")
  await title.getByRole("option", { name: "Gösta Berlings saga", exact: true }).click()

  await expect.poll(() => new URL(page.url()).searchParams.get("titlar"))
    .toBe("lb238704,lb278171")
})

test("selected dropdown rows use the neutral site hover color", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?avancerad=1&titlar=lb238704")
  const title = page.locator(".title_select")
  await title.getByRole("button", { name: "Visa alternativ för Titlar" }).click()
  const selected = title.getByRole("option", { name: "Röda rummet", exact: true })

  await selected.hover()

  expect(await selected.locator(".multiselect__option").evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, color: style.color }
  })).toEqual({ background: "rgb(233, 233, 233)", color: "rgb(0, 0, 0)" })
})

test("keeps accepted results visible while a dropdown filter refreshes", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1")
  const firstResult = page.getByRole("link", { name: "Röda rummet", exact: true }).first()
  await expect(firstResult).toBeVisible()
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "", delay: 1200 }
  })
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 3000 }
  })
  await page.locator("#results").evaluate(element => {
    Object.assign(window, { __searchResultChildren: [] as string[] })
    new MutationObserver(() => {
      const firstClass = element.firstElementChild?.className
      if (typeof firstClass === "string") {
        (window as typeof window & { __searchResultChildren: string[] })
          .__searchResultChildren.push(firstClass)
      }
    }).observe(element, { childList: true })
  })

  const languages = page.locator(".lang_select")
  await languages.getByRole("button", { name: "Visa alternativ för Språk …" }).click()
  const refreshStarted = page.waitForRequest(request => (
    request.method() === "POST"
    && new URL(request.url()).pathname.endsWith("/text-search/options")
    && request.postDataJSON().languages?.includes("language:swe")
  ))
  await languages.getByRole("option", { name: "Svenska", exact: true }).click()
  await refreshStarted

  await expect(page.getByRole("status", { name: "Laddar sökdata" })).toHaveCount(0)
  await expect(firstResult).toBeVisible()
  await expect(page.locator("#results")).toHaveClass(/searching/)
  await page.waitForTimeout(500)
  expect(await firstResult.locator("xpath=ancestor::td[1]").evaluate(element => (
    getComputedStyle(element).opacity
  ))).toBe("1")
  await expect(firstResult).toBeVisible()
  await expect.poll(async () => (await requests(request, "options")).length).toBe(2)
  await expect.poll(() => new URL(page.url()).searchParams.get("languages"))
    .toBe("language:swe")
  expect(await page.evaluate(() => (
    window as typeof window & { __searchResultChildren: string[] }
  ).__searchResultChildren)).not.toContain("searching")
})

test("empty advanced filters match production geometry without an empty results window", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?avancerad=1")

  await expect(page.locator("#results")).toHaveCount(0)
  await expect(page.locator(".title_limit_notice")).toHaveCount(0)
  await expect(page.locator(".gender_select").getByRole("button"))
    .toHaveText("Filtrera: kvinnliga / manliga / alla")

  for (const control of ["author", "title", "lang", "about", "keyword"]) {
    const filter = page.locator(`.${control}_select`)
    const box = await filter.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(27)
    expect(box!.height).toBeLessThanOrEqual(29)
    const placeholder = filter.locator("input[placeholder]")
    await expect(placeholder).toHaveCount(1)
    await expect(placeholder).toHaveCSS("font-weight", "400")
    expect(await placeholder.evaluate(element => (
      getComputedStyle(element, "::placeholder").color
    ))).toBe("rgb(158, 158, 158)")
  }
})

test("initial search paint keeps the hydrated heading position", async ({ page }) => {
  await page.addInitScript(() => {
    const shifts: number[] = []
    Object.assign(window, { __searchLayoutShifts: shifts })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & {
        hadRecentInput: boolean
        value: number
      }>) {
        if (!entry.hadRecentInput) shifts.push(entry.value)
      }
    }).observe({ type: "layout-shift", buffered: true })
  })

  await page.goto("/s%C3%B6k?avancerad=1", { waitUntil: "domcontentloaded" })
  await page.locator('[data-search-root][data-search-mounted="true"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(100)

  await expect(page.getByRole("heading", { name: "Sök i texterna" }))
    .toHaveCSS("margin-top", "40.2px")
  const cumulativeLayoutShift = await page.evaluate(() => (
    (window as typeof window & { __searchLayoutShifts: number[] })
      .__searchLayoutShifts.reduce((total, value) => total + value, 0)
  ))
  expect(cumulativeLayoutShift).toBeLessThan(0.005)
})

test("search options keep their first-paint geometry while legacy layout CSS reattaches", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?avancerad=1")

  const options = page.locator(".search_opts_widget")
  const firstOption = options.locator("li").first()
  const settledBox = await options.boundingBox()
  expect(settledBox).not.toBeNull()

  await page.evaluate(() => {
    for (const style of document.querySelectorAll<HTMLStyleElement>(
      'style[data-vite-dev-id*="/assets/styles/styles.scss"]'
    )) {
      style.disabled = true
    }
  })

  await expect(options).toHaveCSS(
    "font-family",
    '"Requiem Text SC A", "Requiem Text SC B"'
  )
  await expect(options).toHaveCSS("text-transform", "lowercase")
  await expect(options).toHaveCSS("margin-top", "17px")
  await expect(options).toHaveCSS("margin-bottom", "17px")
  await expect(firstOption).toHaveCSS("cursor", "pointer")
  const detachedBox = await options.boundingBox()
  expect(detachedBox).not.toBeNull()
  expect(detachedBox!.width).toBe(settledBox!.width)
  expect(detachedBox!.height).toBe(settledBox!.height)
})

test("filter option loading neither opens the results window nor shows its spinner", async ({
  page,
  request
}) => {
  await page.goto("/om/ide", { waitUntil: "domcontentloaded" })
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "", delay: 5000 }
  })

  void pushRoute(page, "/s%C3%B6k?avancerad=1").catch(() => undefined)

  const search = page.locator("[data-search-root]")
  await expect(search).toBeVisible({ timeout: 1500 })
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await expect(search.locator("#results")).toHaveCount(0)
  await expect(search.getByRole("status", { name: "Laddar sökdata" })).toHaveCount(0)
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
    expect(rootBox!.height).toBeGreaterThan(45)
    expect(rootBox!.height).toBeLessThan(65)
    expect(Math.abs(chipBox!.x - rowBox!.x)).toBeLessThan(2)
    expect(chipBox!.y + chipBox!.height).toBeLessThanOrEqual(rowBox!.y)
    expect(rowBox!.y - (chipBox!.y + chipBox!.height)).toBeLessThan(8)
  }
})

async function pushRoute(page: Page, route: string) {
  await page.waitForFunction(() => Boolean((document.querySelector("#__nuxt") as (
    HTMLElement & { __vue_app__?: unknown }
  ) | null)?.__vue_app__))
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
test.afterEach(async ({ page, request }) => {
  expect(removedCountRequests.get(page)).toEqual([])
  await reset(request)
})

test("mounts Search before chronology settles", async ({ page, request }) => {
  await page.goto("/om/ide", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()
  await request.delete(`${fixture}/_text_search/delays/chronology`)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "chronology", selector: "", delay: 5000 }
  })

  void pushRoute(page, "/s%C3%B6k?q=glas").catch(() => undefined)

  const search = page.locator("[data-search-root]")
  await expect(search).toBeVisible({ timeout: 1500 })
  await expect(search.getByRole("heading", { name: "Sök i texterna" })).toBeVisible()
  await expect(search.locator(".submit_form")).toBeVisible()
  await expect.poll(async () => (await requests(request, "chronology")).length).toBe(1)
  await expect(search.getByRole("status", { name: "Laddar sökdata" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toHaveCount(0)
  await expect(search.locator("#results")).toHaveCount(0)
})

test("mounts Search before advanced options settle", async ({ page, request }) => {
  await page.goto("/om/ide", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()
  await request.delete(`${fixture}/_text_search/delays/options`)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "options", selector: "", delay: 5000 }
  })

  void pushRoute(page, "/s%C3%B6k?avancerad&fras=glas").catch(() => undefined)

  const search = page.locator("[data-search-root]")
  await expect(search).toBeVisible({ timeout: 1500 })
  await expect(search.getByRole("heading", { name: "Sök i texterna" })).toBeVisible()
  await expect(search.locator(".submit_form")).toBeVisible()
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  await expect(search.getByRole("status", { name: "Laddar sökdata" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toHaveCount(0)
  await expect(search.locator("#results")).toHaveCount(0)
})

test("waits for accepted advanced options before sending route-owned result filters", async ({
  page,
  request
}) => {
  await page.goto("/om/ide", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()

  let releaseOptions = () => {}
  const optionsGate = new Promise<void>(resolve => { releaseOptions = resolve })
  let optionsHandled = Promise.resolve()
  const holdOptions = async (route: Route) => {
    const response = await route.fetch()
    optionsHandled = optionsGate.then(() => route.fulfill({ response }))
    await optionsHandled
  }
  await page.route("**/api/v2/text-search/options", holdOptions)

  try {
    void pushRoute(
      page,
      "/s%C3%B6k?avancerad&fras=frihet&forfattare=Lagerl%C3%B6fS"
    ).catch(() => undefined)

    const search = page.locator("[data-search-root]")
    await expect(search).toBeVisible({ timeout: 1500 })
    await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
    await expect(search.getByRole("status", { name: "Laddar sökdata" })).toHaveCount(0)
    await expect(search.locator("#results")).toHaveCount(0)
    await page.waitForTimeout(200)
    expect(await requests(request, "results")).toEqual([])

    releaseOptions()
    await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
    expect((await requests(request, "results"))[0]?.body).toMatchObject({
      query: "frihet",
      author_ids: ["LagerlöfS"]
    })
  } finally {
    releaseOptions()
    await optionsHandled.catch(() => undefined)
    await page.unroute("**/api/v2/text-search/options", holdOptions)
  }
})

test("advanced route B settles while noncooperative route A options remain held", async ({
  page,
  request
}) => {
  await page.goto("/om/ide", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()
  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window)
    let releaseA = () => {}
    const aGate = new Promise<void>(resolve => { releaseA = resolve })
    Object.assign(window, {
      __searchOptionsGate: {
        aStarted: false,
        aReleased: false,
        aAbortedWhenReleased: false,
        releaseA,
        restore: () => { window.fetch = nativeFetch }
      }
    })
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      if (request.method !== "POST"
        || !new URL(request.url).pathname.endsWith("/text-search/options")) {
        return nativeFetch(input, init)
      }
      const body = await request.clone().json() as { query?: string }
      if (body.query !== "frihet") return nativeFetch(input, init)

      const response = await nativeFetch(input, init)
      const responseBody = await response.arrayBuffer()
      const responseInit = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }
      const gate = (window as typeof window & {
        __searchOptionsGate: {
          aStarted: boolean
          aReleased: boolean
          aAbortedWhenReleased: boolean
        }
      }).__searchOptionsGate
      gate.aStarted = true
      await aGate
      gate.aAbortedWhenReleased = request.signal.aborted
      gate.aReleased = true
      return new Response(responseBody, responseInit)
    }
  })

  type Gate = {
    aStarted: boolean
    aReleased: boolean
    aAbortedWhenReleased: boolean
    releaseA: () => void
    restore: () => void
  }
  const gate = () => page.evaluate(() => {
    const current = (window as typeof window & {
      __searchOptionsGate: Gate
    }).__searchOptionsGate
    return {
      aStarted: current.aStarted,
      aReleased: current.aReleased,
      aAbortedWhenReleased: current.aAbortedWhenReleased
    }
  })

  try {
    void pushRoute(
      page,
      "/s%C3%B6k?avancerad&fras=frihet&forfattare=StrindbergA"
    ).catch(() => undefined)
    await expect(page.locator("[data-search-root]")).toBeVisible({ timeout: 1500 })
    await expect.poll(async () => (await gate()).aStarted).toBe(true)
    await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
    expect(await requests(request, "results")).toEqual([])

    void pushRoute(
      page,
      "/s%C3%B6k?avancerad&fras=glas&forfattare=Lagerl%C3%B6fS"
    ).catch(() => undefined)
    await expect.poll(async () => (await requests(request, "options")).length).toBe(2)
    expect((await requests(request, "options"))[1]?.body).toMatchObject({
      query: "glas",
      author_ids: ["LagerlöfS"]
    })
    await expect.poll(async () => (await requests(request, "results")).length, {
      timeout: 1500
    }).toBe(1)
    expect((await requests(request, "results"))[0]?.body).toMatchObject({
      query: "glas",
      author_ids: ["LagerlöfS"]
    })
    await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toHaveCount(0)
    await expect(page.getByRole("status", { name: "Laddar sökdata" })).toHaveCount(0)
    await expect.poll(async () => (await gate()).aReleased).toBe(false)

    await page.evaluate(() => (
      window as typeof window & { __searchOptionsGate: Gate }
    ).__searchOptionsGate.releaseA())
    await expect.poll(async () => await gate()).toEqual({
      aStarted: true,
      aReleased: true,
      aAbortedWhenReleased: true
    })
    await page.waitForTimeout(200)
    await expect(page).toHaveURL(/fras=glas/)
    await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toHaveCount(0)
    await expect(page.getByRole("status", { name: "Laddar sökdata" })).toHaveCount(0)
    expect(await requests(request, "results")).toHaveLength(1)
  } finally {
    await page.evaluate(() => {
      type CleanupGate = { releaseA: () => void, restore: () => void }
      const current = (window as typeof window & {
        __searchOptionsGate?: CleanupGate
      }).__searchOptionsGate
      current?.releaseA()
      current?.restore()
    })
  }
})

test("revisiting Search refetches after an abandoned noncooperative primary success", async ({
  page
}) => {
  await page.goto("/om/ide", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()
  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window)
    let requests = 0
    let releaseFirst: (() => void) | null = null
    let releaseSecond: (() => void) | null = null
    Object.assign(window, {
      __searchPrimaryGate: {
        requests: 0,
        firstStarted: false,
        firstReleased: false,
        firstAbortedWhenReleased: false,
        releaseFirst: () => releaseFirst?.(),
        releaseSecond: () => releaseSecond?.(),
        restore: () => { window.fetch = nativeFetch }
      }
    })
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      if (request.method !== "POST"
        || !new URL(request.url).pathname.endsWith("/text-search/results")) {
        return nativeFetch(input, init)
      }
      const response = await nativeFetch(input, init)
      const responseBody = await response.arrayBuffer()
      const responseInit = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }
      requests += 1
      const gate = (window as typeof window & {
        __searchPrimaryGate: {
          requests: number
          firstStarted: boolean
          firstReleased: boolean
          firstAbortedWhenReleased: boolean
        }
      }).__searchPrimaryGate
      gate.requests = requests
      if (requests === 1) {
        gate.firstStarted = true
        await new Promise<void>(resolve => { releaseFirst = resolve })
        gate.firstAbortedWhenReleased = request.signal.aborted
        gate.firstReleased = true
      } else if (requests === 2) {
        await new Promise<void>(resolve => { releaseSecond = resolve })
      }
      return new Response(responseBody, responseInit)
    }
  })

  type Gate = {
    requests: number
    firstStarted: boolean
    firstReleased: boolean
    firstAbortedWhenReleased: boolean
    releaseFirst: () => void
    releaseSecond: () => void
    restore: () => void
  }
  const gate = () => page.evaluate(() => (
    window as typeof window & { __searchPrimaryGate: Gate }
  ).__searchPrimaryGate)

  try {
    void pushRoute(page, "/s%C3%B6k?fras=frihet").catch(() => undefined)
    await expect.poll(async () => (await gate()).firstStarted).toBe(true)

    await pushRoute(page, "/om/ide")
    await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()
    await page.evaluate(() => (
      window as typeof window & { __searchPrimaryGate: Gate }
    ).__searchPrimaryGate.releaseFirst())
    await expect.poll(async () => {
      const current = await gate()
      return {
        firstReleased: current.firstReleased,
        firstAbortedWhenReleased: current.firstAbortedWhenReleased
      }
    }).toEqual({ firstReleased: true, firstAbortedWhenReleased: true })
    await page.waitForTimeout(200)

    void pushRoute(page, "/s%C3%B6k?fras=frihet").catch(() => undefined)
    await expect(page.locator("[data-search-root]")).toBeVisible({ timeout: 1500 })
    await expect(page.locator("#results .results tr")).toHaveCount(0)
    await expect.poll(async () => (await gate()).requests).toBe(2)

    await page.evaluate(() => (
      window as typeof window & { __searchPrimaryGate: Gate }
    ).__searchPrimaryGate.releaseSecond())
    await expect(page.getByRole("link", { name: "Röda rummet" }).first()).toBeVisible()
  } finally {
    await page.evaluate(() => {
      type CleanupGate = {
        releaseFirst: () => void
        releaseSecond: () => void
        restore: () => void
      }
      const current = (window as typeof window & {
        __searchPrimaryGate?: CleanupGate
      }).__searchPrimaryGate
      current?.releaseFirst()
      current?.releaseSecond()
      current?.restore()
    })
  }
})

test("failed advanced options settle to a retryable owner error without forwarding results", async ({
  page,
  request
}) => {
  await page.goto("/om/ide", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()
  await request.put(`${fixture}/_text_search/failures`, {
    data: { operation: "options" }
  })

  void pushRoute(
    page,
    "/s%C3%B6k?avancerad&fras=frihet&forfattare=Lagerl%C3%B6fS"
  ).catch(() => undefined)

  const search = page.locator("[data-search-root]")
  await expect(search).toBeVisible({ timeout: 1500 })
  await expect.poll(async () => (await requests(request, "options")).length).toBe(1)
  const error = search.locator('[data-search-options-error][role="alert"]')
  await expect(error).toContainText("Sökfiltren kan inte hämtas just nu.")
  await expect(search.getByRole("status", { name: "Laddar sökdata" })).toHaveCount(0)
  await expect(search).not.toHaveClass(/searching/)
  await expect(search.locator("#results")).toHaveCount(0)
  await expect(search.locator(".submit_form .top_row .spinner")).toBeHidden()
  expect(await requests(request, "results")).toEqual([])

  await request.delete(`${fixture}/_text_search/failures/options`)
  await error.getByRole("button", { name: "Försök igen" }).click()

  await expect.poll(async () => (await requests(request, "options")).length).toBe(2)
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  expect((await requests(request, "results"))[0]?.body).toMatchObject({
    query: "frihet",
    author_ids: ["LagerlöfS"]
  })
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toHaveCount(0)
  await expect(error).toHaveCount(0)
})

test("keeps the results window absent through the delayed initial primary result", async ({
  page,
  request
}) => {
  await page.goto("/om/ide", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()

  let releaseResult = () => {}
  const resultGate = new Promise<void>(resolve => { releaseResult = resolve })
  let resultHandled = Promise.resolve()
  const holdResult = async (route: Route) => {
    const response = await route.fetch()
    resultHandled = resultGate.then(() => route.fulfill({ response }))
    await resultHandled
  }
  await page.route("**/api/v2/text-search/results", holdResult)

  try {
    void pushRoute(page, "/s%C3%B6k?fras=frihet").catch(() => undefined)

    const search = page.locator("[data-search-root]")
    await expect(search).toBeVisible({ timeout: 1500 })
    await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
    const status = search.getByRole("status", { name: "Laddar sökdata" })
    await expect(status).toHaveCount(0)
    await expect(search.locator(".submit_form .top_row .spinner"))
      .toHaveAttribute("aria-hidden", "true")
    await expect(search.locator("#results")).toHaveCount(0)

    releaseResult()
    await expect(page.getByRole("link", { name: "Röda rummet" }).first()).toBeVisible()
  } finally {
    releaseResult()
    await resultHandled.catch(() => undefined)
    await page.unroute("**/api/v2/text-search/results", holdResult)
  }
})

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
  await page.waitForTimeout(100)

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
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true }))
    .toBeVisible({ timeout: 9000 })
  await expect(page.locator(".submit_form .top_row .spinner")).toBeHidden()
  expect(await requests(request, "results")).toHaveLength(1)
  expect(problems).toEqual([])
})

test("rapid history changes retain only the finally accepted primary", async ({
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
  await expect(gender.getByRole("button"))
    .toHaveText("Filtrera: kvinnliga / manliga / alla")
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
  const fromSlider = page.getByRole("slider", { name: "Från år reglage" })
  await expect.poll(async () => Number(await fromSlider.inputValue())).toBeGreaterThan(1300)
  const pointerDraft = Number(await fromSlider.inputValue())
  expect(pointerDraft).toBeGreaterThanOrEqual(1399)
  expect(pointerDraft).toBeLessThanOrEqual(1401)
  await track.dispatchEvent("lostpointercapture", { pointerId: 81 })
  await expect(fromSlider).toHaveValue("1300")
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
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toHaveCount(0)
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

test("a direct author-filtered load keeps the unfiltered navigator and filtered pager", async ({
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
  await expect(pager.locator(".hits")).toHaveText("1")
  await expect(pager).toContainText("Visar verk 1-1 av 1, sida 1 av 1.")

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
  expect(resultBodies.filter(body => !Object.hasOwn(body, "facet_author_id")))
    .toEqual([expect.objectContaining({ snapshot: "gen-fixture-0001" })])
})

test("a zero-work author facet keeps the unfiltered navigator and Visa alla escape", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&sok_filter=UnknownAuthor")

  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true }))
    .toHaveCount(0)
  const navigator = page.locator(".navigator")
  await expect(navigator.getByRole("button")).toHaveText([
    "Visa alla",
    "Strindberg, August",
    "Lagerlöf, Selma"
  ])

  await navigator.getByRole("button", { name: "Visa alla" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.has("sok_filter")).toBe(false)
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
})

test("author-filtered reconciliation uses the accepted filtered result total", async ({
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
    .toContainText("Visar verk 31-40 av 40, sida 2 av 2.")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  await page.waitForTimeout(200)
  expect(new URL(page.url()).searchParams.get("traffsida")).toBe("2")
  expect((await requests(request, "results")).map(entry => entry.body.page).sort()).toEqual([1, 2])
})

test("author-filtered out-of-range reconciliation uses the accepted primary total", async ({
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
    .toContainText("Visar verk 1-1 av 1, sida 1 av 1.")
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

test("author filtering renders its accepted primary pager totals", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet")
  const pager = page.locator("#toolkit .littb_pager")
  await expect(pager.locator(".hits")).toHaveText("3")
  await expect(pager).toContainText("Visar verk 1-2 av 2, sida 1 av 1.")

  await page.locator(".navigator")
    .getByRole("button", { name: "Strindberg, August" })
    .click()
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toHaveCount(0)
  await page.waitForTimeout(100)

  await expect(pager.locator(".hits")).toHaveText("1")
  await expect(pager).toContainText("Visar verk 1-1 av 1, sida 1 av 1.")
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

test("author navigator exposes selection and keyboard escape in the mobile layout", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSearch(page, "/s%C3%B6k?fras=frihet")
  const navigator = page.locator(".navigator")
  const showAll = navigator.getByRole("button", { name: "Visa alla" })
  const strindberg = navigator.getByRole("button", { name: "Strindberg, August" })

  await expect(navigator).toBeVisible()
  await expect(showAll).toHaveAttribute("aria-pressed", "true")
  await strindberg.focus()
  await page.keyboard.press("Enter")
  await expect.poll(() => new URL(page.url()).searchParams.get("sok_filter"))
    .toBe("StrindbergA")
  await expect(strindberg).toHaveAttribute("aria-pressed", "true")
  await expect(showAll).toHaveAttribute("aria-pressed", "false")

  await showAll.focus()
  await page.keyboard.press("Space")
  await expect.poll(() => new URL(page.url()).searchParams.has("sok_filter")).toBe(false)
  await expect(showAll).toHaveAttribute("aria-pressed", "true")
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
    snapshot: "gen-fixture-0001",
    work_ids: ["lb-overflow-60"]
  })
  await expect(page.locator("tr.is_faksimil.sentence .match a")).toHaveCount(78)
  const href = await page.locator("tr.is_faksimil.sentence .match a").last().getAttribute("href")
  const reader = new URL(href!, "http://litteraturbanken.test")
  expect(reader.searchParams.get("s_page")).toBe("2")
  expect(reader.searchParams.get("s_prefix")).toBe("true")
})

test("Visa fler pins an accepted generation and expands the requested same-ID media row", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=same-media")
  const more = page.locator("#results .overflow .more")
  await expect(more).toHaveCount(2)
  const activeGeneration = await request.post(`${fixture}/v2/text-search/results`, {
    data: {
      query: "same-media", page: 1, page_size: 30, highlight_limit: 5,
      prefix: false, suffix: false, word_form_only: true, include_modernized: true
    }
  })
  expect(activeGeneration.status()).toBe(200)
  const activeGenerationBody = await activeGeneration.json() as {
    snapshot: string, works: Array<{ title: string }>
  }
  expect(activeGenerationBody.snapshot).toBe("gen-fixture-0002")
  expect(activeGenerationBody.works.some(work => work.title === "Förändrad media etext"))
    .toBe(true)
  await more.nth(1).click()

  await expect.poll(async () => (await requests(request, "results")).length).toBe(3)
  expect((await requests(request, "results"))[2]?.body).toMatchObject({
    query: "same-media",
    page: 1,
    highlight_limit: 100,
    snapshot: "gen-fixture-0001",
    work_ids: ["lb-same-media"]
  })
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(7)
  await expect(page.locator("tr:not(.is_faksimil).sentence .match")).toHaveCount(5)
})

test("Visa fler retains 101-occurrence remaining state until the next explicit expansion completes", async ({ page, request }) => {
  await openSearch(page, "/s%C3%B6k?fras=many-hits-101&prefix=1&forfattare=StrindbergA&utm=keep")
  const more = page.locator("tr.is_faksimil .overflow .more")
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(5)
  await more.click()
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(100)
  await expect(more).toBeVisible()
  await expect(more).toBeEnabled()
  expect((await requests(request, "results")).map(entry => entry.body.highlight_limit)).toEqual([5, 100])
  await more.click()
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(101)
  await expect(more).toHaveCount(0)
  await expect(page.locator("tr:not(.is_faksimil).sentence .match")).toHaveCount(5)
  expect((await requests(request, "results")).slice(1).map(entry => entry.body)).toEqual([
    expect.objectContaining({ page: 1, highlight_limit: 100, snapshot: "gen-fixture-0001",
      work_ids: ["lb-same-media"], author_ids: ["StrindbergA"], prefix: true }),
    expect.objectContaining({ page: 1, highlight_limit: 200, snapshot: "gen-fixture-0001",
      work_ids: ["lb-same-media"], author_ids: ["StrindbergA"], prefix: true })
  ])
})

test("Visa fler discloses remaining occurrences at 500 and continues from the last accepted hit", async ({ page, request }) => {
  const origin = "/s%C3%B6k?fras=many-hits-501&prefix=1&forfattare=StrindbergA&utm=a+b&repeat=%2f&repeat=%2F"
  await openSearch(page, origin)
  const more = page.locator("tr.is_faksimil .overflow .more")
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(5)
  const staleFetchAction = await more.elementHandle()
  for (const limit of [100, 200, 300, 400, 500]) {
    await expect(more).toBeVisible()
    await more.click()
    await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(limit)
  }
  const disclosure = page.locator("tr.is_faksimil .overflow")
  await expect(disclosure).toContainText("Visar 500 av 501 träffar i verket.")
  await expect(more).toHaveCount(0)
  const continuation = disclosure.getByRole("link", { name: "Fortsätt i läsaren" })
  await expect(continuation).toHaveAttribute("href",
    (await page.locator("tr.is_faksimil.sentence .match a").last().getAttribute("href"))!)
  const href = new URL((await continuation.getAttribute("href"))!, "http://litteraturbanken.test")
  expect(href.pathname).toContain("/sida/50/faksimil")
  expect(href.searchParams.get("traff")).toBe("w21_4992")
  expect(href.searchParams.get("s_return")).toBe(origin)
  expect(href.searchParams.get("s_prefix")).toBe("true")
  await expect(page.locator("tr:not(.is_faksimil).sentence .match")).toHaveCount(5)
  const ledger = await requests(request, "results")
  expect(ledger.map(entry => entry.body.highlight_limit)).toEqual([5, 100, 200, 300, 400, 500])
  for (const entry of ledger.slice(1)) expect(entry.body).toMatchObject({
    page: 1, snapshot: "gen-fixture-0001", work_ids: ["lb-same-media"],
    author_ids: ["StrindbergA"], prefix: true
  })
  await staleFetchAction?.evaluate(button => (button as HTMLButtonElement).click())
  await page.waitForTimeout(200)
  expect(await requests(request, "results")).toHaveLength(6)
})

for (const conflictingCount of [100, 102]) {
  test(`Visa fler rejects a pinned per-work occurrence count changed to ${conflictingCount}`, async ({ page, request }) => {
    await openSearch(page, "/s%C3%B6k?fras=many-hits-101")
    await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(5)
    const contradictCount = async (route: Route) => {
      const response = await route.fetch()
      const body = await response.json()
      body.works[1].occurrence_count = conflictingCount
      body.works[1].has_more_highlights = conflictingCount > 100
      body.totals.occurrences = conflictingCount + 7
      await route.fulfill({ response, json: body })
    }
    await page.route("**/api/v2/text-search/results", contradictCount)
    const more = page.locator("tr.is_faksimil .overflow .more")
    await more.click()
    await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
    await expect(more).toBeEnabled()
    await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(5)
    await page.unroute("**/api/v2/text-search/results", contradictCount)
    await more.click()
    await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(100)
    await expect(more).toBeVisible()
    expect((await requests(request, "results")).map(entry => entry.body.highlight_limit)).toEqual([5, 100, 100])
  })
}

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
  await expect(more).toHaveJSProperty("tagName", "BUTTON")
  await more.dispatchEvent("click")
  await expect(more).toBeDisabled()
  await more.dispatchEvent("click")

  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  await expect(more).toBeEnabled()
})

test("Visa fler expands two different works concurrently and publishes both", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow")
  await installMoreResponseGate(page)

  try {
    const more = page.locator("#results .overflow .more")
    await expect(more).toHaveCount(30)
    await more.evaluateAll(
      buttons => buttons.slice(0, 2).forEach(button => (button as HTMLButtonElement).click())
    )

    await expect.poll(async () => (await moreResponseGate(page)).workIds.slice().sort())
      .toEqual(["lb238704", "lb278171"])
    await expect(more.nth(0)).toBeDisabled()
    await expect(more.nth(1)).toBeDisabled()

    await page.evaluate(() => (
      window as typeof window & { __searchMoreGate: MoreResponseGate }
    ).__searchMoreGate.releaseWork("lb238704"))
    await expect.poll(async () => (await moreResponseGate(page)).settled).toBe(1)
    await expect(page.locator("#results tr.sentence .match")).toHaveCount(153)
    await expect(more).toHaveCount(29)
    await expect(more.first()).toBeDisabled()

    await page.evaluate(() => (
      window as typeof window & { __searchMoreGate: MoreResponseGate }
    ).__searchMoreGate.releaseWork("lb278171"))
    await expect.poll(async () => (await moreResponseGate(page)).settled).toBe(2)
    await expect(page.locator("#results tr.sentence .match")).toHaveCount(156)
    await expect(more).toHaveCount(28)
    await expect(more.first()).toBeEnabled()
  } finally {
    await page.evaluate(() => {
      const current = (window as typeof window & { __searchMoreGate?: MoreResponseGate })
        .__searchMoreGate
      current?.releaseAll()
      current?.restore()
    })
  }
})

test("route changes cancel every expansion without letting late owners erase a retry", async ({
  page
}) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow")
  await installMoreResponseGate(page)

  try {
    const firstRouteMore = page.locator("#results .overflow .more")
    await firstRouteMore.evaluateAll(
      buttons => buttons.slice(0, 2).forEach(button => (button as HTMLButtonElement).click())
    )
    await expect.poll(async () => (await moreResponseGate(page)).requests).toBe(2)

    await page.getByRole("button", { name: "Nästa träffsida" }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get("traffsida")).toBe("2")
    await expect(page.locator("#toolkit .littb_pager")).toContainText("Visar verk 31-60 av 64")
    await page.getByRole("button", { name: "Föregående träffsida" }).click()
    await expect(page.locator("#toolkit .littb_pager")).toContainText("Visar verk 1-30 av 64")
    await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
    const currentMore = page.locator("#results .overflow .more")
    await expect(currentMore).toHaveCount(30)
    await expect(page.locator("#results tr.sentence .match")).toHaveCount(150)

    await currentMore.first().click()
    await expect.poll(async () => (await moreResponseGate(page)).requests).toBe(3)
    await expect(currentMore.first()).toBeDisabled()

    await page.evaluate(() => {
      const current = (window as typeof window & { __searchMoreGate: MoreResponseGate })
        .__searchMoreGate
      current.release(0)
      current.release(1)
    })
    await expect.poll(async () => {
      const current = await moreResponseGate(page)
      return { settled: current.settled, aborted: current.aborted.slice(0, 2) }
    }).toEqual({ settled: 2, aborted: [true, true] })
    await expect(currentMore.first()).toBeDisabled()
    await expect(page.locator("#results tr.sentence .match")).toHaveCount(150)

    await page.evaluate(() => (
      window as typeof window & { __searchMoreGate: MoreResponseGate }
    ).__searchMoreGate.release(2))
    await expect.poll(async () => (await moreResponseGate(page)).settled).toBe(3)
    await expect(page.locator("#results tr.sentence .match")).toHaveCount(153)
    await expect(currentMore).toHaveCount(29)
    await expect(currentMore.first()).toBeEnabled()
  } finally {
    await page.evaluate(() => {
      const current = (window as typeof window & { __searchMoreGate?: MoreResponseGate })
        .__searchMoreGate
      current?.releaseAll()
      current?.restore()
    })
  }
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

test("filtered title disclosure loads the expanded set and retries a local failure", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=overflow&avancerad=1")
  await request.delete(`${fixture}/_text_search/requests/options`)
  await page.locator(".title_select input.select2-search__field").fill("doktor")
  await expect(page.getByRole("button", { name: "Visa alla 43 matchande titlar" }))
    .toBeVisible()
  await request.put(`${fixture}/_text_search/failures`, {
    data: { operation: "options" }
  })

  await page.getByRole("button", {
    name: "Visa alla 43 matchande titlar"
  }).click()
  await expect.poll(async () => (await requests(request, "options")).at(-1)?.body)
    .toMatchObject({
      title_filter: "doktor",
      title_limit: 500,
      include_static_options: false
    })
  const failure = page.getByRole("alert")
  await expect(failure).toContainText("Fler titlar kunde inte hämtas")

  await request.delete(`${fixture}/_text_search/failures/options`)
  await failure.getByRole("button", { name: "Försök igen" }).click()
  await expect.poll(async () => (await requests(request, "options")).length).toBe(3)
  await page.getByRole("button", { name: "Visa alternativ för Titlar" }).click()
  await expect(page.getByRole("option", { name: "Doktortitel 41" })).toBeVisible()
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

test("closing advanced search clears the transient title filter notice", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=frihet&avancerad=1")
  await page.locator(".title_select input.select2-search__field").fill("doktor")
  await expect(page.getByRole("button", { name: "Visa alla 43 matchande titlar" }))
    .toBeVisible()

  await page.locator("[data-search-advanced]").click()
  await expect(page).not.toHaveURL(/avancerad=1/u)
  await page.locator("[data-search-advanced]").click()
  await expect(page).toHaveURL(/avancerad=1/u)

  await expect(page.getByText(/matchande titlarna/u)).toHaveCount(0)
  await page.getByRole("button", { name: "Visa alternativ för Titlar" }).click()
  await expect(page.getByRole("option", { name: "Gösta Berlings saga" })).toBeVisible()
  await expect(page.getByRole("option", { name: "Doktortitel 1", exact: true })).toHaveCount(0)
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

test("primary ownership cancels stale work and recovers independently", async ({
  page,
  request
}) => {
  await openSearch(page)
  await request.put(`${fixture}/_text_search/delays`, {
    data: { operation: "results", selector: "frihet", delay: 1200 }
  })
  await submitPhrase(page, "frihet")
  await expect.poll(async () => (await requests(request, "results")).length).toBe(1)
  await submitPhrase(page, "inga")
  await expect(page.getByText("Din sökning gav inga träffar", { exact: true })).toBeVisible()
  await page.waitForTimeout(1300)
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toHaveCount(0)
  await expect(page.locator(".hits_info .hits")).toBeHidden()

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
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(75)
  await request.delete(`${fixture}/_text_search/failures/results`)
  const recoveredMoreResponse = page.waitForResponse(response =>
    response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/v2/text-search/results"
    && response.request().postDataJSON().highlight_limit === 100
  )
  await more.evaluate((button: HTMLButtonElement) => button.click())
  expect((await recoveredMoreResponse).status()).toBe(200)
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(78)
})

test("a failed primary search can be retried with the same phrase", async ({ page, request }) => {
  await openSearch(page)
  await request.put(`${fixture}/_text_search/failures`, { data: { operation: "results" } })
  await request.delete(`${fixture}/_text_search/requests/results`)

  await submitPhrase(page, "frihet")
  await expect(page.locator("[data-search-error]")).toHaveText(
    "Sökresultatet kan inte visas just nu."
  )
  await request.delete(`${fixture}/_text_search/failures/results`)
  await submitPhrase(page, "frihet")

  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  await expect(page.getByRole("link", { name: "Röda rummet", exact: true })).toBeVisible()
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
  await expect(page.locator("tr.is_faksimil.sentence .match")).toHaveCount(75)
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
  await expect(page.locator("#results .overflow")).toHaveCount(30)
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
  await expect(page.locator("#results .overflow")).toHaveCount(30)
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
  await expect(page.locator("#results .overflow")).toHaveCount(30)
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

test("empty-highlight work titles stay plain while normal titles keep their first hit", async ({
  page,
  request
}) => {
  await openSearch(page, "/s%C3%B6k?fras=empty-highlights")

  const emptyTitle = page.locator("#results td.header .title")
    .filter({ hasText: "Röda rummet" })
  await expect(emptyTitle).toHaveText("Röda rummet")
  await expect(emptyTitle.locator("a")).toHaveCount(0)

  const normalTitle = page.getByRole("link", { name: "Gösta Berlings saga", exact: true })
  await expect(normalTitle).toBeVisible()
  const reader = new URL(
    (await normalTitle.getAttribute("href"))!,
    "http://litteraturbanken.test"
  )
  expect(reader.pathname)
    .toBe("/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/sida/3/faksimil")
  expect(reader.searchParams.get("hit")).toBe("0")
  expect(reader.searchParams.get("s_return")).toBe("/s%C3%B6k?fras=empty-highlights")

  await page.locator("#results .overflow .more").last().click()
  await expect.poll(async () => (await requests(request, "results")).length).toBe(2)
  expect((await requests(request, "results"))[1]?.body).toMatchObject({
    query: "empty-highlights",
    page: 1,
    highlight_limit: 100,
    snapshot: "gen-fixture-0001",
    work_ids: ["lb238704"]
  })
  await expect(emptyTitle.locator("a")).toHaveCount(1)
  await expect(page.locator("tr.is_faksimil.sentence .match a")).toHaveCount(2)
  await expect(normalTitle).toHaveAttribute("href", reader.pathname + reader.search)
})

test("renders all five authoritative right-context tokens without truncation", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=five-context")

  const rightContext = page.locator("#results tr.sentence").first()
    .locator(".right_context .word")
  await expect(rightContext).toHaveCount(5)
  expect(await rightContext.allTextContents()).toEqual([
    `${"1".repeat(29)} `,
    `${"2".repeat(29)} `,
    `${"3".repeat(29)} `,
    `${"4".repeat(29)} `,
    `${"5".repeat(29)} `
  ])
})

test("renders a phrase hit as one accessible Reader link", async ({ page }) => {
  await openSearch(page, "/s%C3%B6k?fras=phrase-hit")

  const match = page.locator("#results tr.sentence .match").first()
  await expect(match.locator("a")).toHaveCount(1)
  await expect(match.locator("a")).toHaveText("frihetnu")
  await expect(match.locator("a .word")).toHaveCount(2)
})

test("Search result return restores the exact origin and Reader hit", async ({ page }) => {
  const origin = "/s%C3%B6k?fras=frihet&traffsida=1&avancerad=1&forfattare=StrindbergA&utm=a+b&repeat=%2f&repeat=%2F"
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
