import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const epubPath = "/api/query_string/etext,faksimil,pdf"
const epubQueryPrefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_library_relevance_requests`),
    request.delete(`${fixture}/_library_relevance_failure`),
    request.delete(`${fixture}/_library_relevance_delays`),
    request.delete(`${fixture}/_library_query_requests`),
    request.delete(`${fixture}/_library_query_failure`),
    request.delete(`${fixture}/_library_query_delays`)
  ])
}

async function requests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_library_relevance_requests`)).json()).requests as
    Array<{ path: string, query: Record<string, string> }>
}

async function epubRequests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_library_query_requests`)).json()).requests as
    Array<{ path: string, query: Record<string, string> }>
}

function publicEpubRequests(entries: Awaited<ReturnType<typeof epubRequests>>) {
  return entries.filter(entry => entry.path === epubPath)
}

function epubQuery(filter = "") {
  const predicate = filter ? `has_epub:true AND (${filter})` : "has_epub:true"
  return `${epubQueryPrefix} (${predicate})`
}

async function pushRoute(page: import("@playwright/test").Page, path: string) {
  await page.evaluate(async nextPath => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => Promise<void> } } } }
    }
    await root.__vue_app__?.config.globalProperties.$router.push(nextPath)
  }, path)
}

test.beforeEach(async ({ request }) => reset(request))

test("client-side Library entry uses public runtime config without private-key warnings", async ({
  page,
  request
}) => {
  const warnings: string[] = []
  page.on("console", message => {
    if (message.text().includes("Could not access `libraryApiBase`")) {
      warnings.push(message.text())
    }
  })

  await page.goto("/", { waitUntil: "networkidle" })
  await reset(request)
  await page.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => Promise<void> } } } }
    }
    await root.__vue_app__?.config.globalProperties.$router.push("/bibliotek")
  })
  await page.locator("[data-library-result], [data-library-error]").first().waitFor()

  expect(warnings).toEqual([])
  await expect(page.locator("[data-library-result]")).toHaveCount(3)
  const ledger = await requests(request)
  expect(ledger).toHaveLength(1)
  expect(ledger[0]?.path.startsWith("/api/relevance/")).toBe(true)
})

test("debounces Library input, preserves the URL, and uses the public proxy once", async ({
  page,
  request
}) => {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (message.type() === "error") problems.push(message.text())
  })

  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  await expect(page.locator("[data-library-result]")).toHaveCount(3)
  await reset(request)
  await page.reload({ waitUntil: "networkidle" })
  const initialLedger = await requests(request)
  expect(initialLedger).toHaveLength(1)
  expect(initialLedger[0]?.path.startsWith("/legacy-api/relevance/")).toBe(true)

  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await page.waitForTimeout(200)
  expect(await requests(request)).toHaveLength(initialLedger.length)
  await expect(page).toHaveURL(/filter=Selma/)
  await expect(page.locator("[data-library-result]")).toHaveCount(1)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()

  const ledger = await requests(request)
  const publicRequests = ledger.filter(entry => entry.path.startsWith("/api/relevance/"))
  expect(publicRequests).toHaveLength(1)
  expect(publicRequests[0]?.query.q).toBe("(Selma)")
  expect(problems).toEqual([])
})

test("submit before debounce persists one request and durable filter state", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  await reset(request)
  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await input.press("Enter")

  await expect(page).toHaveURL(/filter=Selma/)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()
  await page.waitForTimeout(400)
  const ledger = await requests(request)
  expect(ledger.filter(entry => entry.path.startsWith("/api/relevance/"))).toHaveLength(1)
})

test("a delayed stale Library request cannot replace the latest results", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_library_relevance_delays`, {
    data: { "(Selma)": 900 }
  })
  await page.goto("/bibliotek", { waitUntil: "networkidle" })

  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await page.waitForTimeout(350)
  await input.fill("Senaste")
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()
  await page.waitForTimeout(700)
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toHaveCount(0)
})

test("Library reset and sort links update supported query state", async ({ page }) => {
  await page.goto("/bibliotek?filter=Selma", { waitUntil: "networkidle" })
  await page.locator("[data-library-reset]").click()
  await expect(page).not.toHaveURL(/filter=/)
  await expect(page.locator("[data-library-result]")).toHaveCount(3)

  await page.getByRole("link", { name: "Titel", exact: true }).click()
  await expect(page).toHaveURL(/sort=titlar/)
  await expect(page.locator('[data-library-sort="titlar"]')).toHaveClass(/active/)
})

test("delayed input cannot replace an immediate sort or reset intent", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_library_relevance_delays`, {
    data: { "(Selma)|_score|desc": 900 }
  })
  await page.goto("/bibliotek", { waitUntil: "networkidle" })

  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await page.waitForTimeout(350)
  await page.getByRole("link", { name: "Titel", exact: true }).click()
  await expect(page).toHaveURL(/filter=Selma.*sort=titlar|sort=titlar.*filter=Selma/)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()
  await page.waitForTimeout(700)
  await expect(page.locator('[data-library-sort="titlar"]')).toHaveClass(/active/)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()

  await request.put(`${fixture}/_library_relevance_delays`, {
    data: { "(Senaste)|sortkey|asc": 900 }
  })
  await input.fill("Senaste")
  await page.waitForTimeout(350)
  await page.locator("[data-library-reset]").click()
  await expect(page).not.toHaveURL(/filter=/)
  await expect(page.getByRole("link", { name: "Röda rummet" })).toBeVisible()
  await page.waitForTimeout(700)
  await expect(page.getByRole("link", { name: "Röda rummet" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toHaveCount(0)
})

test("Back and Forward restore filter, sort, and results without client duplicates", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?filter=Selma&sort=titlar", { waitUntil: "networkidle" })
  await page.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => Promise<void> } } } }
    }
    await root.__vue_app__?.config.globalProperties.$router.push(
      "/bibliotek?filter=Senaste&sort=forfattare"
    )
  })
  await expect(page.locator("[data-library-filter]")).toHaveValue("Senaste")
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()
  await reset(request)

  await page.goBack()
  await expect(page.locator("[data-library-filter]")).toHaveValue("Selma")
  await expect(page.locator('[data-library-sort="titlar"]')).toHaveClass(/active/)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()
  await page.goForward()
  await expect(page.locator("[data-library-filter]")).toHaveValue("Senaste")
  await expect(page.locator('[data-library-sort="forfattare"]')).toHaveClass(/active/)
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()

  const ledger = await requests(request)
  expect(ledger.filter(entry => entry.path.startsWith("/api/relevance/"))).toHaveLength(2)
})

test("Library EPUB tab owns route intent and makes one public request", async ({ page, request }) => {
  await page.goto("/bibliotek?keep&keep=ja&sida=2", { waitUntil: "networkidle" })
  await reset(request)

  await page.locator('[data-library-tab="epub"]').click()
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  await expect(page.getByRole("link", { name: "Doktor Glas" })).toBeVisible()
  await expect(page.locator('[data-library-tab="epub"]')).toHaveAttribute("aria-current", "page")

  const url = new URL(page.url())
  expect(url.pathname).toBe("/bibliotek")
  expect(url.searchParams.get("visa")).toBe("epub")
  expect(url.searchParams.get("sort")).toBe("popularitet")
  expect(url.searchParams.has("sida")).toBe(false)
  expect(url.searchParams.getAll("keep")).toEqual(["", "ja"])

  const ledger = publicEpubRequests(await epubRequests(request))
  expect(ledger).toHaveLength(1)
  expect(ledger[0]).toMatchObject({
    path: epubPath,
    query: {
      q: epubQuery(),
      sort_field: "popularity|desc",
      from: "0",
      to: "100"
    }
  })
})

test("bare EPUB hydrates in place and SPA entry uses one public request", async ({ page, request }) => {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (message.type() === "error" || message.text().includes("Could not access `libraryApiBase`")) {
      problems.push(message.text())
    }
  })

  await page.goto("/epub", { waitUntil: "networkidle" })
  expect(new URL(page.url()).pathname).toBe("/epub")
  expect(new URL(page.url()).search).toBe("")
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  expect(publicEpubRequests(await epubRequests(request))).toHaveLength(0)

  const download = page.locator("[data-library-epub-download]").first()
  await expect(download).toHaveAttribute(
    "href",
    "/txt/epub/S%C3%B6derbergH_DoktorGlas.epub"
  )
  await expect(download).toHaveAttribute("download", "")
  await expect(download).toHaveAttribute("target", "_self")

  await page.goto("/", { waitUntil: "networkidle" })
  await reset(request)
  await pushRoute(page, "/epub")
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  expect(new URL(page.url()).pathname).toBe("/epub")
  expect(new URL(page.url()).search).toBe("")
  expect(publicEpubRequests(await epubRequests(request))).toHaveLength(1)
  expect(problems).toEqual([])
})

test("standalone EPUB interactions retain the standalone path", async ({ page, request }) => {
  await page.goto("/epub", { waitUntil: "networkidle" })
  await reset(request)

  await page.locator("[data-library-filter]").fill("Selma")
  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(1)

  const url = new URL(page.url())
  expect(url.pathname).toBe("/epub")
  expect(url.searchParams.get("filter")).toBe("Selma")
  expect(url.searchParams.get("sort")).toBe("popularitet")
  expect(url.searchParams.has("visa")).toBe(false)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()
})

test("EPUB keeps committed rows visible under its loading indicator", async ({ page, request }) => {
  await request.put(`${fixture}/_library_query_delays`, {
    data: { [`${epubQuery("Selma")}|popularity|desc|0|100`]: 900 }
  })
  await page.goto("/bibliotek?visa=epub&sort=popularitet", { waitUntil: "networkidle" })

  await page.locator("[data-library-filter]").fill("Selma")
  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(1)
  await expect(page.locator("[data-library-loading] .spinner")).toBeVisible()
  await expect(page.getByRole("link", { name: "Doktor Glas" })).toBeVisible()

  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()
  await expect(page.locator("[data-library-loading]")).toHaveCount(0)
})

test("EPUB input debounces, resets page, and sends the sanitized query", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?keep&visa=epub&sort=kronologi&sida=2", {
    waitUntil: "networkidle"
  })
  await reset(request)

  const input = page.locator("[data-library-filter]")
  await input.fill('Selma–Lagerlöf, "saga"')
  await page.waitForTimeout(200)
  expect(publicEpubRequests(await epubRequests(request))).toHaveLength(0)

  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(1)
  const url = new URL(page.url())
  expect(url.searchParams.get("visa")).toBe("epub")
  expect(url.searchParams.get("sort")).toBe("kronologi")
  expect(url.searchParams.get("filter")).toBe('Selma–Lagerlöf, "saga"')
  expect(url.searchParams.has("sida")).toBe(false)
  expect(url.searchParams.getAll("keep")).toEqual([""])

  const ledger = publicEpubRequests(await epubRequests(request))
  expect(ledger).toHaveLength(1)
  expect(ledger[0]?.query).toMatchObject({
    q: epubQuery("Selma Lagerlöf saga"),
    sort_field: "sort_date_imprint.date|desc",
    from: "0",
    to: "100"
  })
})

test("each EPUB sort resets page and emits its exact expression", async ({ page, request }) => {
  await page.goto("/bibliotek?visa=epub&sort=popularitet&sida=2", { waitUntil: "networkidle" })
  await reset(request)

  for (const [index, [sort, expression]] of [
    ["forfattare", "main_author.name_for_index|asc,sortkey|asc"],
    ["titlar", "sortkey|asc"],
    ["popularitet", "popularity|desc"],
    ["kronologi", "sort_date_imprint.date|desc"]
  ].entries()) {
    await page.locator(`[data-library-sort="${sort}"]`).click()
    await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length)
      .toBe(index + 1)
    await expect(page.locator(`[data-library-sort="${sort}"]`)).toHaveClass(/active/)
    await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
    const url = new URL(page.url())
    expect(url.searchParams.get("sort")).toBe(sort)
    expect(url.searchParams.has("sida")).toBe(false)
    const ledger = publicEpubRequests(await epubRequests(request))
    expect(ledger.at(-1)?.query).toMatchObject({
      q: epubQuery(),
      sort_field: expression,
      from: "0",
      to: "100"
    })
  }

  expect(publicEpubRequests(await epubRequests(request))).toHaveLength(4)
})

test("EPUB pagination owns page state and keeps exact row anchors", async ({ page, request }) => {
  await page.goto("/bibliotek?keep=ja&visa=epub&sort=popularitet", { waitUntil: "networkidle" })
  await reset(request)

  await page.locator("[data-library-pagination-next]").click()
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(1)

  const url = new URL(page.url())
  expect(url.searchParams.get("sida")).toBe("2")
  expect(url.searchParams.get("visa")).toBe("epub")
  expect(url.searchParams.get("sort")).toBe("popularitet")
  expect(url.searchParams.get("keep")).toBe("ja")
  expect(publicEpubRequests(await epubRequests(request))).toEqual([
    expect.objectContaining({
      path: epubPath,
      query: expect.objectContaining({ from: "100", to: "200" })
    })
  ])

  await expect(page.locator("[data-library-epub-title]")).toHaveAttribute(
    "href",
    "/författare/LagerlofS/titlar/GostaBerlingsSaga/etext?om-boken"
  )
  await expect(page.locator("[data-library-epub-author]")).toHaveAttribute(
    "href",
    "/författare/LagerlofS"
  )
  await expect(page.locator("[data-library-epub-download]")).toHaveAttribute(
    "href",
    "/txt/epub/LagerlofS_GostaBerlingsSaga.epub"
  )
})

test("EPUB Back and Forward restore atomic route states once", async ({ page, request }) => {
  await page.goto("/bibliotek?visa=epub&filter=Selma&sort=titlar", { waitUntil: "networkidle" })
  await pushRoute(page, "/bibliotek?visa=epub&sort=popularitet&sida=2")
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()
  await pushRoute(page, "/bibliotek?visa=epub&sort=kronologi")
  await expect(page.getByRole("link", { name: "Doktor Glas" })).toBeVisible()
  await reset(request)

  await page.goBack()
  await expect(page.locator('[data-library-sort="popularitet"]')).toHaveClass(/active/)
  await expect(page.locator('[data-library-page="2"]')).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()

  await page.goBack()
  await expect(page.locator("[data-library-filter]")).toHaveValue("Selma")
  await expect(page.locator('[data-library-sort="titlar"]')).toHaveClass(/active/)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()

  await page.goForward()
  await expect(page.locator('[data-library-sort="popularitet"]')).toHaveClass(/active/)
  await expect(page.locator('[data-library-page="2"]')).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()

  await page.goForward()
  await expect(page.locator('[data-library-sort="kronologi"]')).toHaveClass(/active/)
  await expect(page.getByRole("link", { name: "Doktor Glas" })).toBeVisible()

  expect(publicEpubRequests(await epubRequests(request))).toHaveLength(4)
})

test("a delayed EPUB filter cannot replace the latest filter intent", async ({ page, request }) => {
  await request.put(`${fixture}/_library_query_delays`, {
    data: { [`${epubQuery("Selma")}|popularity|desc|0|100`]: 900 }
  })
  await page.goto("/bibliotek?visa=epub&sort=popularitet", { waitUntil: "networkidle" })

  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await page.waitForTimeout(350)
  await input.fill("inga")
  await expect(page.locator("[data-library-empty]")).toBeVisible()
  await page.waitForTimeout(700)
  await expect(page.locator("[data-library-empty]")).toBeVisible()
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(0)
})

test("a delayed EPUB sort cannot replace the latest page intent", async ({ page, request }) => {
  await request.put(`${fixture}/_library_query_delays`, {
    data: { [`${epubQuery()}|sort_date_imprint.date|desc|0|100`]: 900 }
  })
  await page.goto("/bibliotek?visa=epub&sort=popularitet&sida=2", { waitUntil: "networkidle" })

  await page.locator('[data-library-sort="kronologi"]').click()
  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(1)
  await page.locator("[data-library-pagination-next]").click()
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()
  await page.waitForTimeout(900)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(1)
})

test("a delayed EPUB page cannot replace the latest sort intent", async ({ page, request }) => {
  await request.put(`${fixture}/_library_query_delays`, {
    data: { [`${epubQuery()}|popularity|desc|100|200`]: 900 }
  })
  await page.goto("/bibliotek?visa=epub&sort=popularitet", { waitUntil: "networkidle" })

  await page.locator("[data-library-pagination-next]").click()
  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(1)
  await page.locator('[data-library-sort="titlar"]').click()
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  await expect(page.getByRole("link", { name: "Doktor Glas" })).toBeVisible()
  await page.waitForTimeout(900)
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  await expect(page.getByRole("link", { name: "Doktor Glas" })).toBeVisible()
})
