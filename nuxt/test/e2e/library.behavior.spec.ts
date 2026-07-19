import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const epubPath = "/api/query_string/etext,faksimil,pdf"
const epubQueryPrefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
const pdfPredicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"
const libraryDownloadExclude = "text,parts,sourcedesc,pages,errata"
const libraryDownloadInclude = "lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain,main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type,work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword"
const libraryPdfInclude = `${libraryDownloadInclude},license,authors.authorid,authors.surname`

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

function pdfQuery(filter = "") {
  const predicate = filter ? `${pdfPredicate} AND (${filter})` : pdfPredicate
  return `${epubQueryPrefix} (${predicate})`
}

function publicPdfRequests(entries: Awaited<ReturnType<typeof epubRequests>>) {
  return publicEpubRequests(entries).filter(entry => entry.query.q?.includes(pdfPredicate))
}

function publicOnlyEpubRequests(entries: Awaited<ReturnType<typeof epubRequests>>) {
  return publicEpubRequests(entries).filter(entry => !entry.query.q?.includes(pdfPredicate))
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

test("Library switches EPUB to PDF and back without a document reload", async ({ page, request }) => {
  await page.goto("/bibliotek?keep=ja&visa=epub&sort=popularitet", { waitUntil: "networkidle" })
  await reset(request)
  await page.evaluate(() => { (window as typeof window & { __librarySpa?: string }).__librarySpa = "alive" })

  await page.locator('[data-library-tab="pdf"]').click()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveAttribute("aria-current", "page")
  expect(new URL(page.url()).searchParams.get("visa")).toBe("pdf")
  expect(new URL(page.url()).searchParams.get("keep")).toBe("ja")
  expect(await page.evaluate(() => (window as typeof window & { __librarySpa?: string }).__librarySpa))
    .toBe("alive")

  await page.locator('[data-library-tab="epub"]').click()
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  await expect(page.locator('[data-library-tab="epub"]')).toHaveAttribute("aria-current", "page")
  await expect.poll(() => new URL(page.url()).searchParams.get("visa")).toBe("epub")
  expect(await page.evaluate(() => (window as typeof window & { __librarySpa?: string }).__librarySpa))
    .toBe("alive")

  const ledger = await epubRequests(request)
  expect(publicPdfRequests(ledger)).toHaveLength(1)
  expect(publicOnlyEpubRequests(ledger)).toHaveLength(1)
})

test("standalone EPUB and PDF tabs retain their shell during SPA switching", async ({
  page,
  request
}) => {
  await page.goto("/epub", { waitUntil: "networkidle" })
  await reset(request)
  await page.evaluate(() => { (window as typeof window & { __librarySpa?: string }).__librarySpa = "alive" })

  await page.locator('[data-library-tab="pdf"]').click()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  expect(new URL(page.url()).pathname).toBe("/epub")
  expect(new URL(page.url()).searchParams.get("visa")).toBe("pdf")
  await expect(page.locator("body")).toHaveClass(/page-epub/)

  await page.locator('[data-library-tab="epub"]').click()
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  expect(new URL(page.url()).pathname).toBe("/epub")
  await expect.poll(() => new URL(page.url()).searchParams.has("visa")).toBe(false)
  expect(await page.evaluate(() => (window as typeof window & { __librarySpa?: string }).__librarySpa))
    .toBe("alive")

  const ledger = await epubRequests(request)
  expect(publicPdfRequests(ledger)).toHaveLength(1)
  expect(publicOnlyEpubRequests(ledger)).toHaveLength(1)
})

test("PDF debounce, immediate submit, and reset own one request per committed state", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?keep&visa=pdf&sort=kronologi&sida=2", {
    waitUntil: "networkidle"
  })
  await reset(request)

  const input = page.locator("[data-library-filter]")
  await input.fill('Selma–Lagerlöf, "roman"')
  await page.waitForTimeout(200)
  expect(publicPdfRequests(await epubRequests(request))).toHaveLength(0)
  await expect.poll(async () => publicPdfRequests(await epubRequests(request)).length).toBe(1)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()

  let url = new URL(page.url())
  expect(url.searchParams.get("visa")).toBe("pdf")
  expect(url.searchParams.get("sort")).toBe("kronologi")
  expect(url.searchParams.has("sida")).toBe(false)
  expect(url.searchParams.getAll("keep")).toEqual([""])
  expect(publicPdfRequests(await epubRequests(request))[0]?.query).toMatchObject({
    q: pdfQuery("Selma Lagerlöf roman"),
    sort_field: "sort_date_imprint.date|desc",
    from: "0",
    to: "100"
  })

  await input.fill("inga")
  await input.press("Enter")
  await expect(page.locator("[data-library-empty]")).toBeVisible()
  await page.waitForTimeout(400)
  expect(publicPdfRequests(await epubRequests(request))).toHaveLength(2)

  await page.locator("[data-library-reset]").click()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  url = new URL(page.url())
  expect(url.searchParams.has("filter")).toBe(false)
  const ledger = publicPdfRequests(await epubRequests(request))
  expect(ledger).toHaveLength(3)
  expect(ledger.at(-1)?.query.q).toBe(pdfQuery())
})

test("each PDF sort resets page and PDF pagination owns numeric, previous, and next state", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?keep=ja&visa=pdf&sort=popularitet&sida=2", {
    waitUntil: "networkidle"
  })
  await reset(request)

  for (const [index, [sort, expression]] of [
    ["forfattare", "main_author.name_for_index|asc,sortkey|asc"],
    ["titlar", "sortkey|asc"],
    ["popularitet", "popularity|desc"],
    ["kronologi", "sort_date_imprint.date|desc"]
  ].entries()) {
    await page.locator(`[data-library-sort="${sort}"]`).click()
    await expect.poll(async () => publicPdfRequests(await epubRequests(request)).length)
      .toBe(index + 1)
    await expect(page.locator(`[data-library-sort="${sort}"]`)).toHaveClass(/active/)
    expect(new URL(page.url()).searchParams.has("sida")).toBe(false)
    expect(publicPdfRequests(await epubRequests(request)).at(-1)?.query).toMatchObject({
      q: pdfQuery(),
      sort_field: expression,
      from: "0",
      to: "100"
    })
  }

  await page.locator('[data-library-page="2"]').click()
  await expect(page.locator('[data-library-page="2"]')).toHaveAttribute("aria-current", "page")
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(1)
  await page.locator("[data-library-pagination-previous]").click()
  await expect(page.locator('[data-library-page="1"]')).toHaveAttribute("aria-current", "page")
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  await page.locator("[data-library-pagination-next]").click()
  await expect(page.locator('[data-library-page="2"]')).toHaveAttribute("aria-current", "page")
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(1)
  await expect.poll(async () => publicPdfRequests(await epubRequests(request)).length).toBe(7)

  const pagination = publicPdfRequests(await epubRequests(request)).slice(-3)
  expect(pagination.map(entry => [entry.query.from, entry.query.to]))
    .toEqual([["100", "200"], ["0", "100"], ["100", "200"]])
  expect(new URL(page.url()).searchParams.get("keep")).toBe("ja")
})

test("PDF Back and Forward restore mode, filter, sort, page, and rows exactly once", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?visa=pdf&filter=Selma&sort=titlar", { waitUntil: "networkidle" })
  await reset(request)
  await pushRoute(page, "/bibliotek?visa=pdf&sort=popularitet&sida=2")
  await expect(page.locator('[data-library-page="2"]')).toHaveAttribute("aria-current", "page")
  await pushRoute(page, "/bibliotek?visa=epub&sort=kronologi")
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  await pushRoute(page, "/bibliotek?filter=Senaste&sort=forfattare")
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()
  await reset(request)

  await page.goBack()
  await expect(page.locator('[data-library-tab="epub"]')).toHaveAttribute("aria-current", "page")
  await expect(page.locator('[data-library-sort="kronologi"]')).toHaveClass(/active/)
  await page.goBack()
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveAttribute("aria-current", "page")
  await expect(page.locator('[data-library-page="2"]')).toHaveAttribute("aria-current", "page")
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(1)
  await page.goBack()
  await expect(page.locator("[data-library-filter]")).toHaveValue("Selma")
  await expect(page.locator('[data-library-sort="titlar"]')).toHaveClass(/active/)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()

  await page.goForward()
  await expect(page.locator('[data-library-page="2"]')).toHaveAttribute("aria-current", "page")
  await page.goForward()
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  await page.goForward()
  await expect(page.getByRole("link", { name: "Senaste träffen" })).toBeVisible()

  const queryLedger = await epubRequests(request)
  expect(publicPdfRequests(queryLedger)).toHaveLength(3)
  expect(publicOnlyEpubRequests(queryLedger)).toHaveLength(2)
  expect((await requests(request)).filter(entry => entry.path.startsWith("/api/relevance/")))
    .toHaveLength(1)
})

test("delayed PDF intents cannot replace newer PDF, EPUB, or relevance states", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_library_query_delays`, {
    data: { [`${pdfQuery("Selma")}|popularity|desc|0|100`]: 900 }
  })
  await page.goto("/bibliotek?visa=pdf&sort=popularitet", { waitUntil: "networkidle" })

  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await page.waitForTimeout(350)
  await input.fill("inga")
  await expect(page.locator("[data-library-empty]")).toBeVisible()
  await page.waitForTimeout(700)
  await expect(page.locator("[data-library-empty]")).toBeVisible()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(0)

  await request.delete(`${fixture}/_library_query_delays`)
  await page.locator("[data-library-reset]").click()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  await request.put(`${fixture}/_library_query_delays`, {
    data: { [`${pdfQuery("Selma")}|popularity|desc|0|100`]: 900 }
  })
  await input.fill("Selma")
  await page.waitForTimeout(350)
  const delayedBeforeEpub = publicPdfRequests(await epubRequests(request)).length
  await page.locator('[data-library-tab="epub"]').click()
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(1)
  await page.waitForTimeout(1000)
  expect(publicPdfRequests(await epubRequests(request))).toHaveLength(delayedBeforeEpub)
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(1)
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(0)

  await page.locator('[data-library-tab="pdf"]').click()
  await expect(page.locator("[data-library-loading] .spinner")).toBeVisible()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  await expect(page.getByRole("link", { name: "Röda rummet" })).toBeVisible()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()

  await request.put(`${fixture}/_library_query_delays`, {
    data: { [`${pdfQuery("inga")}|popularity|desc|0|100`]: 900 }
  })
  await input.fill("inga")
  await page.waitForTimeout(350)
  const delayedBeforeRelevance = publicPdfRequests(await epubRequests(request)).length
  await page.locator('[data-library-tab="all"]').click()
  await expect(page.locator("[data-library-empty]")).toBeVisible()
  await page.waitForTimeout(1000)
  expect(publicPdfRequests(await epubRequests(request))).toHaveLength(delayedBeforeRelevance)
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(0)

  await page.locator('[data-library-tab="pdf"]').click()
  await expect(page.locator("[data-library-loading] .spinner")).toBeVisible()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga" })).toBeVisible()
  await expect(page.locator("[data-library-empty]")).toBeVisible()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(0)
})

test("PDF hydration reuses its private payload and SPA entry makes one public request", async ({
  page,
  request
}) => {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (message.type() === "error" || message.text().includes("Could not access `libraryApiBase`")) {
      problems.push(message.text())
    }
  })

  await page.goto("/bibliotek?visa=pdf&sort=popularitet", { waitUntil: "networkidle" })
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  const hydrated = await epubRequests(request)
  expect(hydrated.filter(entry => entry.path.startsWith("/legacy-api/"))).toHaveLength(1)
  expect(publicPdfRequests(hydrated)).toHaveLength(0)

  await page.goto("/", { waitUntil: "networkidle" })
  await reset(request)
  await pushRoute(page, "/bibliotek?visa=pdf&sort=popularitet")
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  expect(publicPdfRequests(await epubRequests(request))).toHaveLength(1)
  expect(await requests(request)).toHaveLength(0)
  expect(problems).toEqual([])
})

test("PDF rows preserve grouped display metadata while synthesizing exact download actions", async ({
  page
}) => {
  await page.goto("/bibliotek?visa=pdf&sort=popularitet", { waitUntil: "networkidle" })
  const direct = page.locator("[data-library-pdf-row]", {
    has: page.getByRole("link", { name: "Nils Holgerssons underbara resa" })
  })
  await expect(direct.locator("[data-library-pdf-title]")).toHaveAttribute(
    "href",
    "/författare/LagerlofS/titlar/NilsHolgersson/faksimil?om-boken"
  )
  await expect(direct.locator("[data-library-pdf-download]")).toHaveAttribute(
    "href",
    "/txt/lb-NilsHolgersson/lb-NilsHolgersson.pdf"
  )
  await expect(direct.locator("[data-library-pdf-download]")).toHaveAttribute(
    "download",
    "DirectPdfA_NilsHolgerssonPdf.pdf"
  )
  await expect(direct.locator("[data-library-pdf-download]")).toHaveAttribute("target", "_self")

  await pushRoute(page, "/bibliotek?visa=pdf&filter=tuple-collision")
  const laterExport = page.locator("[data-library-pdf-row]", {
    has: page.getByRole("link", { name: "Grupphuvud utan export" })
  })
  await expect(laterExport.locator("[data-library-pdf-title]")).toHaveAttribute(
    "href",
    "/författare/GroupMainA/titlar/LaterExportGroupMain/etext?om-boken"
  )
  await expect(laterExport.locator("[data-library-pdf-author]")).toHaveAttribute(
    "href",
    "/författare/GroupMainA"
  )
  await expect(laterExport.locator("[data-library-pdf-download]")).toHaveAttribute(
    "href",
    "/export/faksimil/lb-later-export-group.pdf"
  )
  await expect(laterExport.locator("[data-library-pdf-download]")).toHaveAttribute(
    "download",
    "GroupMainA_LaterExportGroupMain.pdf"
  )
})

test("PDF empty and failed states stay generic without hydration or console errors", async ({
  page,
  request
}) => {
  const pageErrors: string[] = []
  const consoleDiagnostics: Array<{ type: string, text: string, url: string }> = []
  const failedResponses: Array<{ status: number, url: string }> = []
  page.on("pageerror", error => pageErrors.push(error.message))
  page.on("console", message => {
    if (message.type() === "warning" || message.type() === "error") {
      consoleDiagnostics.push({
        type: message.type(),
        text: message.text(),
        url: message.location().url
      })
    }
  })
  page.on("response", response => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() })
    }
  })

  await page.goto("/bibliotek?visa=pdf&filter=inga", { waitUntil: "networkidle" })
  await expect(page.locator("[data-library-empty]")).toHaveText("Inga träffar.")
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(0)

  const input = page.locator("[data-library-filter]")
  await input.fill("malformed-top")
  await input.press("Enter")
  await expect(page.locator("[data-library-error]")).toHaveText("Ett fel uppstod.")
  await expect(page.locator("[data-library-empty]")).toHaveCount(0)

  await request.put(`${fixture}/_library_query_failure`)
  const expectedFailureUrl = new URL(epubPath, page.url())
  expectedFailureUrl.search = new URLSearchParams({
    exclude: libraryDownloadExclude,
    include: libraryPdfInclude,
    partial_string: "true",
    q: pdfQuery("failed"),
    sort_field: "popularity|desc",
    from: "0",
    to: "100",
    suggest: "true"
  }).toString()
  await input.fill("failed")
  await input.press("Enter")
  await expect(page.locator("[data-library-error]")).toHaveText("Ett fel uppstod.")
  await expect(page.locator("body")).not.toContainText("Unable to load Library PDFs")
  await page.waitForTimeout(400)
  expect(failedResponses).toEqual([{ status: 503, url: expectedFailureUrl.href }])
  expect(consoleDiagnostics).toEqual([{
    type: "error",
    text: "Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
    url: expectedFailureUrl.href
  }])
  expect(pageErrors).toEqual([])
})
