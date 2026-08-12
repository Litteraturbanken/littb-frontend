import { expect, test, type APIRequestContext, type Locator } from "@playwright/test"

import type { operations } from "../../app/lib/api/generated/lbapi"
import { libraryImprintYearCases } from "../helpers/library-imprint-year-cases"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
type LibrarySearchRequest = operations["v2_post_library_search"]["requestBody"]["content"]["application/json"]
type LibraryCountRequest = operations["v2_post_library_counts"]["requestBody"]["content"]["application/json"]
type LibraryFilters = LibraryCountRequest["filters"]

async function expectFocusRingNotClipped(locator: Locator) {
  expect(await locator.evaluate((element) => {
    const ringOutset = 4
    const ring = element.getBoundingClientRect()
    const clippedBy: string[] = []

    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor)
      if (!/(hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) continue

      const boundary = ancestor.getBoundingClientRect()
      if (
        ring.left - ringOutset < boundary.left ||
        ring.top - ringOutset < boundary.top ||
        ring.right + ringOutset > boundary.right ||
        ring.bottom + ringOutset > boundary.bottom
      ) {
        clippedBy.push(ancestor.className)
      }
    }

    return clippedBy
  })).toEqual([])
}

async function expectKeyboardFocusRing(locator: Locator) {
  expect(await locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      boxShadow: style.boxShadow,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth
    }
  })).toEqual({
    boxShadow: "rgb(51, 51, 51) 0px 0px 0px 4px",
    outlineColor: "rgb(255, 255, 255)",
    outlineOffset: "2px",
    outlineStyle: "solid",
    outlineWidth: "2px"
  })
}

function libraryFilters(overrides: Partial<LibraryFilters> = {}): LibraryFilters {
  return {
    query: "",
    gender: null,
    categories: [],
    narrowing_categories: [],
    about_author_ids: [],
    media: [],
    languages: [],
    year_from: null,
    year_to: null,
    ...overrides
  }
}

async function setLibraryDelay(
  request: APIRequestContext,
  operation: "search" | "counts",
  body: LibrarySearchRequest | LibraryCountRequest,
  delay = 900
) {
  await request.put(`${fixture}/_library_v2/delays`, { data: { operation, body, delay } })
}

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_library_relevance_requests`),
    request.delete(`${fixture}/_library_relevance_failure`),
    request.delete(`${fixture}/_library_relevance_delays`),
    request.delete(`${fixture}/_library_query_requests`),
    request.delete(`${fixture}/_library_query_failure`),
    request.delete(`${fixture}/_library_query_delays`),
    request.delete(`${fixture}/_library_imprint_requests`),
    request.delete(`${fixture}/_library_metadata_requests`),
    request.delete(`${fixture}/_library_v2/requests`),
    request.delete(`${fixture}/_library_v2/failures`),
    request.delete(`${fixture}/_library_v2/delays`)
  ])
}

async function libraryV2Requests(request: APIRequestContext) {
  return await (await request.get(`${fixture}/_library_v2/requests`)).json() as {
    options: Array<{ method: string, path: string, scope: string }>
    search: Array<{ method: string, path: string, scope: string, body: LibrarySearchRequest }>
    counts: Array<{
      method: string
      path: string
      scope: string
      body: LibraryCountRequest
    }>
  }
}

async function allRelevanceRequests(request: APIRequestContext) {
  return (await libraryV2Requests(request)).search.filter(entry => (
    entry.body.mode === "all" || entry.body.mode === "authors"
  ))
}

async function requests(request: APIRequestContext) {
  return (await allRelevanceRequests(request)).filter(entry => entry.body.mode === "all")
}

async function epubRequests(request: APIRequestContext) {
  return (await libraryV2Requests(request)).search.filter(entry => (
    entry.body.mode !== "all" && entry.body.mode !== "authors"
  ))
}

function publicEpubRequests(entries: Awaited<ReturnType<typeof epubRequests>>) {
  return entries.filter(entry => entry.scope === "public")
}

function publicPdfRequests(entries: Awaited<ReturnType<typeof epubRequests>>) {
  return publicEpubRequests(entries).filter(entry => entry.body.mode === "pdf")
}

function publicOnlyEpubRequests(entries: Awaited<ReturnType<typeof epubRequests>>) {
  return publicEpubRequests(entries).filter(entry => entry.body.mode === "epub")
}

async function countOnlyEpubRequests(request: APIRequestContext) {
  return (await libraryV2Requests(request)).counts.filter(entry => entry.body.mode === "epub")
}

async function countOnlyPdfRequests(request: APIRequestContext) {
  return (await libraryV2Requests(request)).counts.filter(entry => entry.body.mode === "pdf")
}

async function legacyLibraryRequests(request: APIRequestContext) {
  const [relevance, query, imprint, metadata] = await Promise.all([
    request.get(`${fixture}/_library_relevance_requests`),
    request.get(`${fixture}/_library_query_requests`),
    request.get(`${fixture}/_library_imprint_requests`),
    request.get(`${fixture}/_library_metadata_requests`)
  ])
  return {
    relevance: (await relevance.json()).requests,
    query: (await query.json()).requests,
    options: (await imprint.json()).requests,
    metadata: (await metadata.json()).requests
  }
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
test.afterEach(async ({ request }) => reset(request))

test("ordinary Strindberg tabs retain counts and expose authors EPUB and PDF", async ({
  page
}) => {
  await page.goto("/bibliotek?filter=strindberg", { waitUntil: "networkidle" })

  await expect(page.locator('[data-library-tab="authors"]')).toHaveText("Författare: 7")
  await expect(page.locator('[data-library-tab="works"]')).toHaveText("Verk: 465")
  await expect(page.locator('[data-library-tab="parts"]')).toHaveText("Dikt, novell, etc.: 1039")
  await expect(page.locator('[data-library-tab="epub"]')).toHaveText("Epub: 136")
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveText("PDF: 265")

  await page.locator('[data-library-tab="authors"]').click()
  await expect(page.locator("[data-library-author-row]")).toHaveCount(7)
  const authorRows = (await page.locator("[data-library-author-row]").allTextContents()).join(" ")
  expect(authorRows).not.toContain("0–0")
  expect(authorRows).not.toContain("0–")

  await page.locator('[data-library-tab="epub"]').click()
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(1)
  await expect(page).not.toHaveURL(/nedladdning/u)

  await page.locator('[data-library-tab="pdf"]').click()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(1)
  await expect(page).not.toHaveURL(/nedladdning/u)
})

test("SSR starts global Library navigation from the clean default", async ({ request }) => {
  const response = await request.get(
    "/bibliotek?avancerat=1&mediatypes=mediatype%3Aetext&future=one&future=two"
  )

  expect(response.ok()).toBeTruthy()
  expect(await response.text()).toMatch(
    /<li[^>]*><a[^>]+href="\/bibliotek"[^>]*>Biblioteket<\/a><\/li>/u
  )
})

test("a hydrated client without Library memory starts from the default", async ({ page }) => {
  await page.goto("/presentationer", { waitUntil: "networkidle" })

  const libraryLink = page.locator(".mainnav").getByRole("link", {
    name: "Biblioteket",
    exact: true
  })
  await expect(libraryLink).toHaveAttribute("href", "/bibliotek")
  await libraryLink.click()
  await expect(page).toHaveURL("/bibliotek")
})

test("global Library navigation remembers route-owned query state across pages", async ({ page }) => {
  const origin = "/bibliotek?avancerat=1&mediatypes=mediatype%3Aetext&languages=language%3Aswe&future=one&future=two"
  const canonicalOrigin = "/bibliotek?avancerat=1&mediatypes=mediatype:etext&languages=language:swe&future=one&future=two"
  const browserErrors: string[] = []
  page.on("pageerror", error => browserErrors.push(error.message))
  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  await page.goto(origin, { waitUntil: "networkidle" })
  await expect(page.getByRole("button", { name: "Ta bort Etext" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Ta bort Svenska" })).toBeVisible()
  await page.evaluate(() => {
    ;(window as typeof window & { __spaSentinel?: string }).__spaSentinel = "library-spa"
  })

  await page.locator(".mainnav").getByRole("link", { name: "Presentationer", exact: true }).click()
  await expect(page).toHaveURL("/presentationer")
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("library-spa")

  const libraryLink = page.locator(".mainnav").getByRole("link", {
    name: "Biblioteket",
    exact: true
  })
  await expect(libraryLink).toHaveAttribute("href", canonicalOrigin)
  await libraryLink.click()
  await expect(page).toHaveURL(canonicalOrigin)
  await expect(page.getByRole("button", { name: "Ta bort Etext" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Ta bort Svenska" })).toBeVisible()
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("library-spa")

  await page.reload({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(canonicalOrigin)
  await expect(page.getByRole("button", { name: "Ta bort Etext" })).toBeVisible()

  await page.locator(".mainnav").getByRole("link", { name: "Presentationer", exact: true }).click()
  await expect(page).toHaveURL("/presentationer")
  await page.goBack()
  await expect(page).toHaveURL(canonicalOrigin)
  await page.goForward()
  await expect(page).toHaveURL("/presentationer")
  await expect(libraryLink).toHaveAttribute("href", canonicalOrigin)
  expect(browserErrors).toEqual([])
})

test("keeps all production-shaped rows when a presentation has no article author", async ({
  page
}) => {
  await page.goto("/bibliotek?filter=produktionsform", { waitUntil: "networkidle" })

  await expect(page.locator("[data-library-result]")).toHaveCount(100)
  const title = page.getByRole("link", {
    name: "sent på jorden (1932–1962): en samling",
    exact: true
  })
  await expect(title).toHaveAttribute(
    "href",
    "https://litteraturbanken.se/presentationer/specialomraden/Spj_utg.html"
  )
  const row = page.locator("[data-library-result]").filter({ has: title })
  await expect(row).toHaveCount(1)
  await expect(row.locator("td").nth(3)).toHaveText("")
})

test("hydrates unsafe external results as visible inert text while preserving safe links", async ({
  page
}) => {
  await page.goto("/bibliotek?filter=external-href-boundary", { waitUntil: "networkidle" })

  await expect(page.locator("[data-library-result]")).toHaveCount(3)
  await expect(page.getByRole("link", { name: "Säker intern kringtext", exact: true }))
    .toHaveAttribute("href", "/presentationer/forfattare/StrindbergA.html")
  await expect(page.getByRole("link", { name: "Säker extern kringtext", exact: true }))
    .toHaveAttribute("href", "https://litteraturbanken.se/oversattarlexikon/artiklar/Saker")
  const unsafeRow = page.locator("[data-library-result]").filter({
    hasText: "Osäker extern kringtext"
  })
  await expect(unsafeRow).toHaveCount(1)
  await expect(unsafeRow).toContainText("Osäker extern kringtext")
  await expect(unsafeRow.getByRole("link", { name: "Osäker extern kringtext", exact: true }))
    .toHaveCount(0)
  await expect(unsafeRow.locator('a[href^="javascript:"]')).toHaveCount(0)
})

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
  expect(ledger[0]).toMatchObject({ path: "/v2/library/search", scope: "public" })
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
  expect(initialLedger[0]).toMatchObject({ path: "/private-v2/library/search", scope: "private" })

  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await page.waitForTimeout(200)
  expect(await requests(request)).toHaveLength(initialLedger.length)
  await expect(page).toHaveURL(/filter=Selma/)
  await expect(page.locator("[data-library-result]")).toHaveCount(1)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()

  const ledger = await requests(request)
  const publicRequests = ledger.filter(entry => entry.scope === "public")
  expect(publicRequests).toHaveLength(1)
  expect(publicRequests[0]?.body).toMatchObject({ mode: "all", filters: libraryFilters({ query: "Selma" }) })
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
  expect(ledger.filter(entry => entry.scope === "public")).toHaveLength(1)
})

test("a delayed stale Library request cannot replace the latest results", async ({
  page,
  request
}) => {
  await setLibraryDelay(request, "search", {
    mode: "all", filters: libraryFilters({ query: "Selma" }), sort: "relevance", reverse: false, page: 1
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

for (const rawFlag of [
  { label: "bare", query: "hide1800", value: "" },
  { label: "empty", query: "hide1800=", value: "" },
  { label: "true", query: "hide1800=true", value: "true" },
  { label: "false", query: "hide1800=false", value: "false" }
] as const) {
  test(`Library reset clears the latest ${rawFlag.label} hide-1800 flag and restores history`, async ({
    page,
    request
  }) => {
    await page.goto(
      `/bibliotek?visa=latest&sort=nytillkommet&${rawFlag.query}&keep&keep=ja`,
      { waitUntil: "networkidle" }
    )
    await expect(page.locator("[data-library-reset]")).toBeVisible()

    await reset(request)
    await page.locator("[data-library-reset]").click()
    await expect(page).not.toHaveURL(/(?:\?|&)hide1800(?:=|&|$)/)

    let url = new URL(page.url())
    expect(url.searchParams.get("visa")).toBe("latest")
    expect(url.searchParams.get("sort")).toBe("nytillkommet")
    expect(url.searchParams.getAll("keep")).toEqual(["", "ja"])
    await expect.poll(async () => (
      publicEpubRequests(await epubRequests(request)).map(entry => entry.body.hide_1800)
    )).toEqual([false])

    await page.goBack()
    await expect(page).toHaveURL(/(?:\?|&)hide1800(?:=|&|$)/)
    url = new URL(page.url())
    expect(url.searchParams.get("hide1800")).toBe(rawFlag.value)
    expect(url.searchParams.getAll("keep")).toEqual(["", "ja"])
    await expect(page.locator("[data-library-reset]")).toBeVisible()
    await expect.poll(async () => (
      publicEpubRequests(await epubRequests(request)).map(entry => entry.body.hide_1800)
    )).toEqual([false, true])

    await page.goForward()
    await expect(page).not.toHaveURL(/(?:\?|&)hide1800(?:=|&|$)/)
    url = new URL(page.url())
    expect(url.searchParams.get("visa")).toBe("latest")
    expect(url.searchParams.get("sort")).toBe("nytillkommet")
    expect(url.searchParams.getAll("keep")).toEqual(["", "ja"])
    await expect(page.locator("[data-library-reset]")).toBeHidden()
    await expect.poll(async () => (
      publicEpubRequests(await epubRequests(request)).map(entry => entry.body.hide_1800)
    )).toEqual([false, true, false])
  })
}

test("Library reset preserves a raw hide-1800 flag outside latest mode", async ({ page }) => {
  await page.goto(
    "/bibliotek?visa=works&sort=popularitet&filter=Selma&hide1800=false&keep=ett&keep=två",
    { waitUntil: "networkidle" }
  )
  await expect(page.locator("[data-library-reset]")).toBeVisible()

  await page.locator("[data-library-reset]").click()
  await expect(page).not.toHaveURL(/(?:\?|&)filter(?:=|&|$)/)

  const url = new URL(page.url())
  expect(url.searchParams.get("visa")).toBe("works")
  expect(url.searchParams.get("sort")).toBe("popularitet")
  expect(url.searchParams.get("hide1800")).toBe("false")
  expect(url.searchParams.getAll("keep")).toEqual(["ett", "två"])
})

test("Nytt owns its canonical query state and restores through browser history", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?filter=Selma", { waitUntil: "networkidle" })
  await reset(request)

  await page.locator('[data-library-tab="latest"]').click()
  await expect(page).toHaveURL(/visa=latest/)
  const selectedUrl = new URL(page.url())
  expect(selectedUrl.searchParams.get("filter")).toBe("Selma")
  expect(selectedUrl.searchParams.get("sort")).toBe("nytillkommet")
  await expect(page.locator('[data-library-tab="latest"]')).toHaveAttribute("aria-current", "page")
  await expect(page.locator("[data-library-latest-row]")).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toBeVisible()

  let ledger = publicEpubRequests(await epubRequests(request))
  expect(ledger).toHaveLength(1)
  expect(ledger[0]).toMatchObject({
    path: "/v2/library/search", scope: "public",
    body: { mode: "latest", filters: libraryFilters({ query: "Selma" }), reverse: false, page: 1, hide_1800: false }
  })

  await pushRoute(page, "/bibliotek?filter=Senaste")
  await expect(page.getByRole("link", { name: "Senaste träffen", exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.locator('[data-library-tab="latest"]')).toHaveAttribute("aria-current", "page")
  await expect(page.locator("[data-library-filter]")).toHaveValue("Selma")
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toBeVisible()

  await page.locator("[data-library-hide-1800]").click()
  await expect(page).toHaveURL(/(?:\?|&)hide1800(?:=|&|$)/)
  await expect(page.locator("[data-library-hide-1800]")).toBeVisible()

  ledger = publicEpubRequests(await epubRequests(request))
  expect(ledger).toHaveLength(3)
  expect(ledger[2]?.body).toMatchObject({ mode: "latest", filters: libraryFilters({ query: "Selma" }), hide_1800: true })
})

test("Författare, Verk, and Dikt tabs navigate, render, and restore through history", async ({
  page
}) => {
  await page.goto("/bibliotek", { waitUntil: "networkidle" })

  for (const item of [
    { mode: "authors", row: "[data-library-author-row]", text: "Bauer, John" },
    { mode: "works", row: "[data-library-work-row]", text: "Doktor Glas" },
    { mode: "parts", row: "[data-library-part-row]", text: "En novell" }
  ] as const) {
    const tab = page.locator(`[data-library-tab="${item.mode}"]`)
    await expect(tab).toBeEnabled()
    await tab.click()
    await expect(page).toHaveURL(new RegExp(`visa=${item.mode}`))
    await expect(tab).toHaveAttribute("aria-current", "page")
    await expect(page.locator(item.row).filter({ hasText: item.text }).first()).toBeVisible()
  }

  await pushRoute(page, "/bibliotek?visa=works&sort=popularitet")
  await expect(page.locator("[data-library-work-row]").filter({ hasText: "Doktor Glas" }).first())
    .toBeVisible()
  await pushRoute(page, "/bibliotek?visa=parts&sort=titlar")
  await expect(page.locator("[data-library-part-row]").filter({ hasText: "En novell" }).first())
    .toBeVisible()
  await page.goBack()
  await expect(page.locator('[data-library-tab="works"]')).toHaveAttribute("aria-current", "page")
  await expect(page.locator("[data-library-work-row]").filter({ hasText: "Doktor Glas" }).first())
    .toBeVisible()
})

for (const item of libraryImprintYearCases) {
  test(`${item.mode} imprint year uses keyboard SPA navigation and restores through Back`, async ({
    page,
    request
  }) => {
    await page.goto(item.path, { waitUntil: "networkidle" })
    await reset(request)

    const link = page.locator("[data-library-imprint-year]").first()
    await expect(link).toHaveText(item.year)
    await link.focus()
    await expect(link).toBeFocused()
    await page.keyboard.press("Enter")

    await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
      .toBe(`${item.year},${item.year}`)
    let url = new URL(page.url())
    expect(url.searchParams.has("sida")).toBe(false)
    expect(url.searchParams.get("avancerat")).toBe("1")
    expect(url.searchParams.get("kön")).toBe("female")
    expect(url.searchParams.getAll("keep")).toEqual(["one", "two"])

    const modeRequests = (await libraryV2Requests(request)).search.filter(entry => (
      entry.body.mode === item.mode
    ))
    expect(modeRequests.at(-1)?.body.filters).toMatchObject({
      year_from: Number(item.year),
      year_to: Number(item.year)
    })

    await page.goBack()
    await expect.poll(() => new URL(page.url()).searchParams.get("intervall"))
      .toBe("1800,2000")
    url = new URL(page.url())
    expect(url.searchParams.get("sida")).toBe("2")
    expect(url.searchParams.getAll("keep")).toEqual(["one", "two"])
  })
}

for (const mode of ["works", "latest", "epub", "pdf"] as const) {
  test(`${mode} restores delayed full title and author hover details`, async ({ page, request }) => {
    const problems: string[] = []
    page.on("pageerror", error => problems.push(error.message))
    page.on("console", message => {
      if (message.type() === "error" || message.text().toLowerCase().includes("hydration")) {
        problems.push(message.text())
      }
    })
    await page.goto(`/bibliotek?visa=${mode}`, { waitUntil: "networkidle" })
    const row = page.locator(`[data-library-${mode === "works" ? "work" : mode}-row]`).first()
    const title = row.locator("[data-library-tooltip-kind=title]")
    const author = row.locator("[data-library-tooltip-kind=author]")

    await expect(title).toContainText(mode === "pdf" ? "Gösta Berlings saga" : "Doktor Glas")
    const truncationTarget = mode === "works"
      ? title
      : title.locator("xpath=ancestor::*[contains(@class, 'header')][1]")
    await expect(truncationTarget).toHaveCSS("text-overflow", "ellipsis")
    await expect(page.getByRole("tooltip")).toHaveCount(0)
    await title.hover()
    await page.waitForTimeout(300)
    await expect(page.getByRole("tooltip")).toHaveCount(0)
    await expect(page.getByRole("tooltip")).toHaveText(
      mode === "pdf" ? "Gösta Berlings saga. Roman" : "Doktor Glas. Roman",
      { timeout: 400 }
    )
    await page.mouse.move(0, 0)
    await expect(page.getByRole("tooltip")).toHaveCount(0)

    await author.focus()
    await expect(page.getByRole("tooltip")).toHaveText(
      mode === "pdf" ? "Selma Lagerlöf (1858-1940)" : "Hjalmar Söderberg (1869-1941)",
      { timeout: 700 }
    )
    await author.blur()
    await expect(page.getByRole("tooltip")).toHaveCount(0)

    if (mode === "epub") {
      await expect(page.locator("[data-library-epub-row]").nth(1).locator(".author"))
        .toHaveText("Geijer (red.)")
    }
    if (mode === "works") {
      await title.hover()
      await expect(page.getByRole("tooltip")).toBeVisible()
      await pushRoute(page, "/presentationer")
      await expect(page.getByRole("tooltip")).toHaveCount(0)
    }

    expect(await epubRequests(request)).toHaveLength(1)
    expect(problems).toEqual([])
  })
}

test("Library tooltip keeps independent hover and keyboard focus state", async ({ page }) => {
  await page.goto("/bibliotek?visa=works", { waitUntil: "networkidle" })
  const title = page.locator("[data-library-work-row]").first()
    .locator("[data-library-tooltip-kind=title]")
  const tooltip = page.getByRole("tooltip")

  await title.focus()
  await page.waitForTimeout(300)
  await expect(tooltip).toHaveCount(0)
  await title.hover()
  await page.mouse.move(0, 0)
  await expect(title).toBeFocused()
  await expect(tooltip).toHaveCount(1, { timeout: 350 })
  await expect(tooltip).toHaveText("Doktor Glas. Roman")
  await title.blur()
  await expect(tooltip).toHaveCount(0)

  await title.hover()
  await page.waitForTimeout(300)
  await expect(tooltip).toHaveCount(0)
  await title.focus()
  await title.blur()
  await expect(tooltip).toHaveCount(1, { timeout: 350 })
  await expect(tooltip).toHaveText("Doktor Glas. Roman")
  await page.mouse.move(0, 0)
  await expect(tooltip).toHaveCount(0)
})

test("Works and Dikt title and author tooltips render into the document body", async ({ page }) => {
  for (const mode of ["works", "parts"] as const) {
    await page.goto(`/bibliotek?visa=${mode}`, { waitUntil: "networkidle" })
    const row = page.locator(`[data-library-${mode === "works" ? "work" : "part"}-row]`).first()
    const title = row.locator("[data-library-tooltip-kind=title]")
    const author = row.locator("[data-library-tooltip-kind=author]")
    const tooltip = page.getByRole("tooltip")
    const titleTooltip = await title.getAttribute("data-library-tooltip-content")
    const authorTooltip = await author.getAttribute("data-library-tooltip-content")

    expect(titleTooltip).toBeTruthy()
    expect(authorTooltip).toBeTruthy()
    await title.hover()
    await expect(tooltip).toHaveText(titleTooltip!)
    await page.mouse.move(0, 0)
    await expect(tooltip).toHaveCount(0)

    await author.focus()
    await expect(tooltip).toHaveText(authorTooltip!)
    await author.blur()
    await expect(tooltip).toHaveCount(0)
  }
})

test("delayed Works and Dikt transitions never relabel rows owned by the other mode", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?visa=works&sort=popularitet", { waitUntil: "networkidle" })
  await expect(page.locator("[data-library-work-row]").filter({ hasText: "Doktor Glas" }).first())
    .toBeVisible()

  await setLibraryDelay(request, "search", {
    mode: "parts", filters: libraryFilters(), sort: "title", reverse: false, page: 1
  })
  await page.locator('[data-library-tab="parts"]').click()
  await expect(page.locator("[data-library-loading] .spinner")).toBeVisible()
  await expect(page.locator("[data-library-part-row]")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Doktor Glas", exact: true })).toHaveCount(0)

  await expect(page.locator("[data-library-part-row]").filter({ hasText: "En novell" }).first())
    .toBeVisible()
  await expect(page.locator("[data-library-work-row]")).toHaveCount(0)
})

test("a Selma filter invalidates a delayed Strindberg summary", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  await reset(request)
  const delayed = libraryFilters({ query: "strindberg" })
  await setLibraryDelay(request, "search", {
    mode: "authors", filters: delayed, sort: "popularity", reverse: false, limit: 150
  })
  for (const mode of ["works", "parts", "epub", "pdf"] as const) {
    await setLibraryDelay(request, "counts", { mode, filters: delayed })
  }
  const input = page.locator("[data-library-filter]")
  await input.fill("strindberg")
  await expect.poll(async () => (await libraryV2Requests(request)).counts.length).toBe(4)

  await input.fill("Selma")
  await expect(page).toHaveURL(/filter=Selma/)
  await expect(page.locator('[data-library-tab="works"]')).toContainText(": 1")
  await expect(page.locator('[data-library-tab="authors"]')).toContainText(": 1")
  await expect(page.locator('[data-library-tab="epub"]')).toContainText(": 1")
  await expect(page.locator('[data-library-tab="pdf"]')).toContainText(": 1")
  await page.waitForTimeout(900)
  await expect(page.locator('[data-library-tab="works"]')).toContainText(": 1")
  await expect(page.locator('[data-library-tab="authors"]')).toContainText(": 1")
})

test("ordinary tab totals use one author search and four counts without replacing active rows", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?visa=works&sort=popularitet", { waitUntil: "networkidle" })

  await expect(page.locator("[data-library-work-row]")).toHaveCount(3)
  await expect(page.locator('[data-library-tab="authors"]')).toContainText(": 156")
  await expect(page.locator('[data-library-tab="works"]')).toContainText(": 3")
  await expect(page.locator('[data-library-tab="parts"]')).toContainText(": 201")

  expect((await libraryV2Requests(request)).counts).toEqual([
    {
      method: "POST",
      path: "/private-v2/library/counts",
      scope: "private",
      body: { mode: "works", filters: libraryFilters() }
    },
    {
      method: "POST",
      path: "/private-v2/library/counts",
      scope: "private",
      body: { mode: "parts", filters: libraryFilters() }
    },
    {
      method: "POST",
      path: "/private-v2/library/counts",
      scope: "private",
      body: { mode: "epub", filters: libraryFilters() }
    },
    {
      method: "POST",
      path: "/private-v2/library/counts",
      scope: "private",
      body: { mode: "pdf", filters: libraryFilters() }
    }
  ])
})

test("delayed ordinary summaries never gate active rows", async ({
  page,
  request
}) => {
  const filtered = libraryFilters({ query: "Selma" })
  await setLibraryDelay(request, "counts", { mode: "works", filters: filtered })
  await setLibraryDelay(request, "counts", { mode: "parts", filters: filtered })
  await setLibraryDelay(request, "counts", { mode: "epub", filters: filtered })
  await setLibraryDelay(request, "counts", { mode: "pdf", filters: filtered })

  await page.goto("/bibliotek?filter=Selma", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()
  await expect(page.locator('[data-library-tab="authors"]')).toContainText(": 1")
  await expect(page.locator('[data-library-tab="works"]')).toContainText(": 1")
  await expect(page.locator('[data-library-tab="parts"]')).toContainText(": 0")
  await expect(page.locator('[data-library-tab="epub"]')).toContainText(": 1")
  await expect(page.locator('[data-library-tab="pdf"]')).toContainText(": 1")
})

test("hydrated Authors rows publish the authoritative author response count", async ({
  page,
  request
}) => {
  await setLibraryDelay(request, "counts", { mode: "works", filters: libraryFilters() })
  await setLibraryDelay(request, "counts", { mode: "parts", filters: libraryFilters() })

  await page.goto("/bibliotek?visa=authors&sort=namn", { waitUntil: "domcontentloaded" })
  await expect(page.locator("[data-library-author-row]")).toHaveCount(150)
  await expect(page.locator('[data-library-tab="authors"]')).toContainText(": 156")
  await expect(page.locator('[data-library-tab="works"]')).toContainText(": 3")
  await expect(page.locator('[data-library-tab="parts"]')).toContainText(": 201")

  await expect(page.locator('[data-library-tab="authors"]')).toContainText(": 156")
})

test("a nullable summary count retains the active row total", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_library_v2/failures`, {
    data: { operation: "counts", mode: "works" }
  })
  await page.goto("/bibliotek?visa=works&filter=Selma&sort=popularitet", {
    waitUntil: "networkidle"
  })

  await expect(page.locator("[data-library-work-row]")).toHaveCount(1)
  await expect(page.locator('[data-library-tab="works"]')).toContainText(": 1")
  await expect(page.locator('[data-library-tab="parts"]')).toContainText(": 0")
  await expect(page.locator('[data-library-tab="authors"]')).toContainText(": 1")

  await request.delete(`${fixture}/_library_v2/failures`)
  await reset(request)
  await page.locator('[data-library-sort="popularitet"]').click()
  await expect(page.locator('[data-library-tab="authors"]')).toContainText(": 1")
  expect((await libraryV2Requests(request)).counts.map(entry => entry.body.mode))
    .toEqual([])
})

test("a failed ordinary PDF summary leaves active search rows and sibling counts intact", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  await reset(request)
  await request.put(`${fixture}/_library_v2/failures`, {
    data: { operation: "counts", mode: "pdf" }
  })

  await page.locator("[data-library-filter]").fill("Selma")
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()
  await expect(page.locator("[data-library-error]")).toHaveCount(0)
  await expect(page.locator('[data-library-tab="authors"]')).toHaveText("Författare: 1")
  await expect(page.locator('[data-library-tab="works"]')).toHaveText("Verk: 1")
  await expect(page.locator('[data-library-tab="parts"]')).toHaveText("Dikt, novell, etc.: 0")
  await expect(page.locator('[data-library-tab="epub"]')).toHaveText("Epub: 1")
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveText("PDF")
})

test("Författare hydrates 150 rows and expands the legacy Visa alla disclosure", async ({
  page,
  request
}) => {
  await page.goto(
    "/bibliotek?visa=authors&sort=namn&filter=många-författare&sida=2",
    { waitUntil: "networkidle" }
  )

  await expect(page.locator("[data-library-author-row]")).toHaveCount(150)
  await expect(page.locator("[data-library-pagination-next]")).toHaveCount(0)
  const showAll = page.locator("[data-library-authors-show-all]")
  await expect(showAll).toContainText("Visa alla")
  await expect(showAll).toContainText("151")
  expect(new URL(page.url()).searchParams.has("sida")).toBe(false)

  await reset(request)
  await showAll.click()
  await expect(page.locator("[data-library-author-row]")).toHaveCount(151)
  await expect(showAll).toHaveCount(0)

  const visibleRequests = (await allRelevanceRequests(request)).filter(
    entry => entry.body.mode === "authors"
  )
  expect(visibleRequests).toHaveLength(1)
  expect(visibleRequests[0]?.body).toMatchObject({ mode: "authors", limit: 151 })
})

test("Works titles are black keyboard disclosures linked to their representation actions", async ({
  page
}) => {
  await page.goto("/bibliotek?visa=works&sort=popularitet", { waitUntil: "networkidle" })

  const work = page.locator("[data-library-work-row]").filter({ hasText: "Doktor Glas" })
  const toggle = work.locator("[data-library-work-toggle]")
  const actions = work.locator("[data-library-work-actions]")

  await expect(toggle).toHaveCSS("color", "rgb(51, 51, 51)")
  await expect(toggle).toHaveAttribute("aria-expanded", "false")

  await page.locator("[data-library-sort]").last().focus()
  await page.keyboard.press("Tab")
  await expect(toggle).toBeFocused()
  await expectKeyboardFocusRing(toggle)
  await expectFocusRingNotClipped(toggle)

  await page.keyboard.press("Tab")
  const year = work.getByRole("link", { name: "1905", exact: true })
  await expect(year).toBeFocused()
  await expectKeyboardFocusRing(year)
  await expectFocusRingNotClipped(year)

  await page.keyboard.press("Tab")
  const author = work.getByRole("link", { name: "Söderberg", exact: true })
  await expect(author).toBeFocused()
  await expectKeyboardFocusRing(author)
  await expectFocusRingNotClipped(author)
  await page.keyboard.press("Shift+Tab")
  await expect(year).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(toggle).toBeFocused()

  const controls = await toggle.getAttribute("aria-controls")
  expect(controls).toBeTruthy()
  if (!controls) throw new Error("work disclosure is missing aria-controls")
  await expect(actions).toHaveAttribute("id", controls)

  await page.keyboard.press("Enter")
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  await expect(actions).toBeVisible()

  await page.keyboard.press("Enter")
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await expect(actions).toBeHidden()

  await page.keyboard.press("Enter")
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  await expect(actions).toBeVisible()

  await page.keyboard.press("Tab")
  await expect(work.getByRole("link", { name: "Läs som etext", exact: true })).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(toggle).toBeFocused()
})

test("download-mode long titles shrink and ellipsize inside the work column", async ({
  page
}) => {
  await page.goto(
    "/bibliotek?avancerat=1&visa=works&nedladdning=1&filter=download-title-width",
    { waitUntil: "networkidle" }
  )

  const work = page.locator("[data-library-work-row]").filter({
    hasText: "En avsiktligt mycket lång nedladdningstitel"
  })
  const toggle = work.locator("[data-library-work-toggle]")
  const geometry = await toggle.evaluate((element) => {
    const title = element as HTMLElement
    const column = title.closest("td")
    if (!column) throw new Error("work title is missing its result column")
    const titleRect = title.getBoundingClientRect()
    const columnRect = column.getBoundingClientRect()
    return {
      columnRight: columnRect.right,
      titleClientWidth: title.clientWidth,
      titleRight: titleRect.right,
      titleScrollWidth: title.scrollWidth
    }
  })

  expect(geometry.titleRight).toBeLessThanOrEqual(geometry.columnRight + 1)
  expect(geometry.titleClientWidth).toBeLessThan(geometry.titleScrollWidth)
})

test("download-mode work titles use native Enter and Space selection semantics", async ({
  page
}) => {
  await page.goto(
    "/bibliotek?avancerat=1&visa=works&nedladdning=1&filter=unsafe-download-token",
    { waitUntil: "networkidle" }
  )

  const toggle = page.getByRole("button", { name: "Säkert källmaterial", exact: true })
  const work = toggle.locator("xpath=ancestor::*[@data-library-work-row]")

  await expect(toggle).not.toHaveAttribute("aria-controls")
  await expect(toggle).not.toHaveAttribute("aria-expanded")
  await expect(toggle).toHaveAttribute("aria-pressed", "false")

  await toggle.focus()
  await page.keyboard.press("Enter")
  await expect(toggle).toHaveAttribute("aria-pressed", "true")
  await expect(work.locator("[data-library-source-checkbox]")).toBeChecked()
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(1)

  await page.keyboard.press("Space")
  await expect(toggle).toHaveAttribute("aria-pressed", "false")
  await expect(work.locator("[data-library-source-checkbox]")).not.toBeChecked()
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(0)
})

test("download-mode work titles without exports are disabled no-ops", async ({ page }) => {
  await page.goto(
    "/bibliotek?avancerat=1&visa=works&nedladdning=1&filter=unsafe-download-token",
    { waitUntil: "networkidle" }
  )

  const work = page.locator("[data-library-work-row]").filter({
    hasText: "Osäkert källmaterial"
  })
  const toggle = work.locator("[data-library-work-toggle]")

  await expect(toggle).toBeDisabled()
  await expect(toggle).not.toHaveAttribute("aria-controls")
  await expect(toggle).not.toHaveAttribute("aria-expanded")
  await expect(toggle).toHaveAttribute("aria-pressed", "false")

  await toggle.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(0)
  await expect(work.locator("[data-library-source-checkbox]")).not.toBeChecked()
})

test("a long editor surname truncates while its role suffix stays inside the author column", async ({
  page
}) => {
  await page.goto(
    "/bibliotek?visa=works&filter=role-suffix-width",
    { waitUntil: "networkidle" }
  )

  const work = page.locator("[data-library-work-row]").filter({
    hasText: "Redaktörens långa efternamn"
  })
  const authorColumn = work.locator("td").last()
  const author = work.getByRole("link", {
    name: "Det mycket långa redaktörsefternamnet",
    exact: true
  })
  const suffix = work.getByText("(red.)", { exact: true })
  const geometry = await author.evaluate((element) => {
    const link = element as HTMLElement
    const column = link.closest("td")
    const suffixElement = link.nextElementSibling
    if (!column || !(suffixElement instanceof HTMLElement)) {
      throw new Error("author result is missing its column or role suffix")
    }
    return {
      authorClientWidth: link.clientWidth,
      authorScrollWidth: link.scrollWidth,
      columnRight: column.getBoundingClientRect().right,
      suffixRight: suffixElement.getBoundingClientRect().right
    }
  })

  await expect(authorColumn).toContainText("(red.)")
  expect(await suffix.evaluate(element => element.textContent)).toBe("\u00a0(red.)")
  expect(geometry.authorClientWidth).toBeLessThan(geometry.authorScrollWidth)
  expect(geometry.suffixRight).toBeLessThanOrEqual(geometry.columnRight + 1)
})

test("Works groups representations and expands the legacy read, download, search, and about actions", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?visa=works&sort=popularitet", { waitUntil: "networkidle" })
  const work = page.locator("[data-library-work-row]").filter({ hasText: "Doktor Glas" })
  await expect(work).toHaveCount(1)
  await work.locator("[data-library-work-toggle]").click()

  await expect(work.getByRole("link", { name: "Läs som etext", exact: true }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext")
  await expect(work.getByRole("link", { name: "Läs som faksimil", exact: true }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/faksimil")
  await expect(work.getByRole("link", { name: "Ladda ner epub", exact: true }))
    .toHaveAttribute("download", "SöderbergH_DoktorGlas.epub")
  await expect(work.getByRole("link", { name: "Ladda ner pdf", exact: true }))
    .toHaveAttribute("download", "SöderbergH_DoktorGlas.pdf")
  await expect(work.getByRole("link", { name: "Gör en sökning i verket", exact: true }))
    .toHaveAttribute("href", "/s%C3%B6k?forfattare=S%C3%B6derbergH&titlar=lb-DoktorGlas&avancerad")
  await expect(work.getByRole("link", { name: "Läs mer om verket", exact: true }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext?om-boken")

  const requestsBeforeDisclosure = (await epubRequests(request)).length
  await expect(page).toHaveURL(/(?:\?|&)title=DoktorGlas(?:&|$)/)
  await page.goBack()
  await expect(work.locator("[data-library-work-actions]")).toBeHidden()
  await page.goForward()
  await expect(work.locator("[data-library-work-actions]")).toBeVisible()
  expect(await epubRequests(request)).toHaveLength(requestsBeforeDisclosure)
})

test("unsafe Work actions and download results hydrate as inert visible text", async ({ page }) => {
  await page.goto("/bibliotek?visa=works&filter=unsafe-work-actions", {
    waitUntil: "networkidle"
  })
  const work = page.locator("[data-library-work-row]")
  await work.locator("[data-library-work-toggle]").click()
  for (const label of ["Osäker läsning", "Föråldrad externmarkör", "Osäker hämtning"]) {
    await expect(work.getByText(label, { exact: true })).toBeVisible()
    await expect(work.getByRole("link", { name: label, exact: true })).toHaveCount(0)
  }
  await expect(work.getByRole("link", { name: "Säker PDF", exact: true }))
    .toHaveAttribute("href", "/txt/lb-SafeActions/lb-SafeActions.pdf")

  await page.goto("/bibliotek?visa=epub&filter=unsafe-download-href", {
    waitUntil: "networkidle"
  })
  const row = page.locator("[data-library-epub-row]")
  await expect(row).toContainText("Osäker EPUB-hämtning")
  await expect(row.getByText("Hämta", { exact: true })).toBeVisible()
  await expect(row.getByRole("link", { name: "Hämta", exact: true })).toHaveCount(0)
})

test("an encoded Library Reader link navigates through Nuxt without reloading the document", async ({
  page
}) => {
  await page.goto("/bibliotek?visa=epub", { waitUntil: "networkidle" })
  await page.evaluate(() => {
    ;(window as Window & { librarySpaMarker?: string }).librarySpaMarker = "preserved"
  })

  const title = page.locator("[data-library-epub-title]").filter({ hasText: "Doktor Glas" })
  await expect(title).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/etext?om-boken"
  )
  await title.click()
  await expect(page).toHaveURL(
    /\/f%C3%B6rfattare\/S%C3%B6derbergH\/titlar\/DoktorGlas\/sida\/-2\/etext\?om-boken/
  )
  await expect(page).toHaveTitle("Doktor Glas sida -2 etext | Litteraturbanken")
  await expect(page.locator(".reader-context")).toContainText("Doktor Glas (1905)")
  expect(await page.evaluate(() => (
    window as Window & { librarySpaMarker?: string }
  ).librarySpaMarker)).toBe("preserved")
})

test("nedladdning selects visible source works and posts the exact chosen export set", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?avancerat=1", { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_library_download_requests`)
  await reset(request)

  const downloadMode = page.locator("[data-library-download-mode]")
  await downloadMode.focus()
  await page.keyboard.press("Space")
  await expect(page).toHaveURL(/(?:\?|&)nedladdning=1(?:&|$)/)
  await expect(page.locator('[data-library-tab="works"]')).toHaveAttribute("aria-current", "page")
  await expect(page.locator("[data-library-source-checkbox]")).toHaveCount(3)
  await expect(page.getByText("Valda verk", { exact: true })).toBeVisible()
  await expect(page.locator('[data-library-tab="authors"]')).toHaveClass(/library-tab-disabled-look/)
  await expect(page.locator('[data-library-tab="parts"]')).toHaveCount(0)
  await expect(page.locator('[data-library-tab="epub"]')).toHaveCount(0)
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveCount(0)

  const ledger = await epubRequests(request)
  expect(ledger.at(-1)?.body).toMatchObject({ mode: "works", source_only: true })

  await page.locator("[data-library-select-visible]").click()
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(3)
  await expect(page.locator("[data-library-deselect-visible]")).toBeVisible()

  await page.locator("[data-library-format-button]").click()
  await expect(page.locator("[data-library-format-popover]")).toBeVisible()
  await expect(page.locator('[data-library-source-format="etext:txt"]')).toBeEnabled()
  await expect(page.locator('[data-library-source-format="faksimil:pdf"]')).toBeEnabled()
  await page.locator('[data-library-source-format="etext:txt"]').check()
  await page.locator('[data-library-source-format="faksimil:pdf"]').check()
  await expect(page.locator("[data-library-download-size]")).toHaveText("714 KB")

  await Promise.all([
    page.waitForURL(/\/api\/download$/),
    page.locator("[data-library-download-submit]").click()
  ])
  expect(await (await request.get(`${fixture}/_library_download_requests`)).json()).toEqual({
    requests: [{
      path: "/api/download",
      files: [
        "lb-DoktorGlas-etext-txt",
        "lb-DoktorGlas-faksimil-pdf"
      ]
    }]
  })
})

test("source selections survive pagination and an empty refresh", async ({ page }) => {
  await page.goto(
    "/bibliotek?avancerat=1&visa=works&nedladdning=1&filter=source-pagination",
    { waitUntil: "networkidle" }
  )

  await page.getByRole("checkbox", { name: "Välj Doktor Glas", exact: true }).check()
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(1)

  await page.locator("[data-library-pagination-next]").click()
  await expect(page).toHaveURL(/(?:\?|&)sida=2(?:&|$)/)
  await expect(page.getByRole("checkbox", {
    name: "Välj Gösta Berlings saga",
    exact: true
  })).toBeVisible()
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(1)
  await expect(page.locator("[data-library-selected-work]")).toContainText("Doktor Glas")

  await page.getByRole("checkbox", {
    name: "Välj Gösta Berlings saga",
    exact: true
  }).check()
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(2)

  await page.locator("[data-library-filter]").fill("inga")
  await expect(page).toHaveURL(/(?:\?|&)filter=inga(?:&|$)/)
  await expect(page.locator("[data-library-empty]")).toHaveText("Inga träffar.")
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(2)
})

test("the active Works tab exits source mode with preserved state and replace history", async ({
  page
}) => {
  const sourcePath = "/bibliotek?avancerat=1&visa=works&sort=titlar&nedladdning=1&sida=2&hide1800&title=DoktorGlas&filter=source-pagination&k%C3%B6n=female&keep=first&keep=second"
  await page.goto("/presentationer", { waitUntil: "networkidle" })
  await pushRoute(page, sourcePath)
  await expect(page).toHaveURL(sourcePath)

  await page.locator("[data-library-source-checkbox]:not(:disabled)").first().check()
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(1)

  const worksTab = page.locator('[data-library-tab="works"]')
  await expect(worksTab).toHaveAttribute("aria-current", "page")
  const target = new URL(await worksTab.getAttribute("href") ?? "", "http://localhost")
  expect(target.pathname).toBe("/bibliotek")
  expect(target.searchParams.get("visa")).toBe("works")
  expect(target.searchParams.get("sort")).toBe("popularitet")
  expect(target.searchParams.get("nedladdning")).toBeNull()
  expect(target.searchParams.get("sida")).toBeNull()
  expect(target.searchParams.get("hide1800")).toBeNull()
  expect(target.searchParams.get("title")).toBeNull()
  expect(target.searchParams.get("avancerat")).toBe("1")
  expect(target.searchParams.get("filter")).toBe("source-pagination")
  expect(target.searchParams.get("kön")).toBe("female")
  expect(target.searchParams.getAll("keep")).toEqual(["first", "second"])

  const sourceHistoryLength = await page.evaluate(() => history.length)
  await worksTab.click()
  await expect(page).not.toHaveURL(/(?:\?|&)nedladdning=1(?:&|$)/)
  await expect(page.locator("[data-library-source-checkbox]")).toHaveCount(0)
  await expect(page.locator("[data-library-work-actions]").first()).toBeHidden()
  expect(await page.evaluate(() => history.length)).toBe(sourceHistoryLength)

  await page.goBack()
  await expect(page).toHaveURL(/\/presentationer\/?$/)
  await expect(page).not.toHaveURL(/(?:\?|&)nedladdning=1(?:&|$)/)
})

test("nedladdning rejects delimiter-bearing source tokens before native submission", async ({
  page,
  request
}) => {
  await page.goto(
    "/bibliotek?avancerat=1&visa=works&nedladdning=1&filter=unsafe-download-token",
    { waitUntil: "networkidle" }
  )
  await request.delete(`${fixture}/_library_download_requests`)

  await expect(page.getByRole("checkbox", {
    name: "Välj Säkert källmaterial", exact: true
  })).toBeEnabled()
  await expect(page.getByRole("checkbox", {
    name: "Välj Osäkert källmaterial", exact: true
  })).toBeDisabled()

  await page.locator("[data-library-select-visible]").click()
  await expect(page.locator("[data-library-selected-work]")).toHaveCount(1)
  await page.locator("[data-library-format-button]").click()
  await page.locator('[data-library-source-format="etext:txt"]').check()
  await expect(page.locator('input[name="files"]'))
    .toHaveValue("lb-SafeDownload-etext-txt")

  await Promise.all([
    page.waitForURL(/\/api\/download$/),
    page.locator("[data-library-download-submit]").click()
  ])
  expect(await (await request.get(`${fixture}/_library_download_requests`)).json()).toEqual({
    requests: [{ path: "/api/download", files: ["lb-SafeDownload-etext-txt"] }]
  })
})

test("delayed input cannot replace an immediate sort or reset intent", async ({
  page,
  request
}) => {
  await setLibraryDelay(request, "search", {
    mode: "all", filters: libraryFilters({ query: "Selma" }), sort: "relevance", reverse: false, page: 1
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

  await setLibraryDelay(request, "search", {
    mode: "all", filters: libraryFilters({ query: "Senaste" }), sort: "title", reverse: false, page: 1
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
  expect(ledger.filter(entry => entry.scope === "public")).toHaveLength(2)
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
    path: "/v2/library/search", scope: "public",
    body: { mode: "epub", filters: libraryFilters(), sort: "popularity", reverse: false, page: 1 }
  })
})

test("Library modes use only generated v2 operations", async ({ page, request }) => {
  const filters = libraryFilters()
  await page.goto("/", { waitUntil: "networkidle" })
  await reset(request)
  await pushRoute(page, "/bibliotek")
  await expect(page.locator("[data-library-result]")).toHaveCount(3)

  for (const [mode, row] of [
    ["latest", "[data-library-latest-row]"],
    ["authors", "[data-library-author-row]"],
    ["works", "[data-library-work-row]"],
    ["parts", "[data-library-part-row]"],
    ["epub", "[data-library-epub-row]"],
    ["pdf", "[data-library-pdf-row]"]
  ] as const) {
    await page.locator(`[data-library-tab="${mode}"]`).click()
    await expect(page.locator(row).first()).toBeVisible()
  }

  const ledger = await libraryV2Requests(request)
  expect(ledger.options).toEqual([{
    method: "GET", path: "/v2/library/options", scope: "public"
  }])
  expect(ledger.search).toEqual([
    { method: "POST", path: "/v2/library/search", scope: "public", body: { mode: "all", filters, sort: "relevance", reverse: false, page: 1 } },
    { method: "POST", path: "/v2/library/search", scope: "public", body: { mode: "authors", filters, sort: "popularity", reverse: false, limit: 150 } },
    { method: "POST", path: "/v2/library/search", scope: "public", body: { mode: "latest", filters, reverse: false, page: 1, hide_1800: false } },
    { method: "POST", path: "/v2/library/search", scope: "public", body: { mode: "authors", filters, sort: "popularity", reverse: false, limit: 150 } },
    { method: "POST", path: "/v2/library/search", scope: "public", body: { mode: "works", filters, sort: "popularity", reverse: false, page: 1, source_only: false } },
    { method: "POST", path: "/v2/library/search", scope: "public", body: { mode: "parts", filters, sort: "title", reverse: false, page: 1 } },
    { method: "POST", path: "/v2/library/search", scope: "public", body: { mode: "epub", filters, sort: "popularity", reverse: false, page: 1 } },
    { method: "POST", path: "/v2/library/search", scope: "public", body: { mode: "pdf", filters, sort: "popularity", reverse: false, page: 1 } }
  ])
  expect(ledger.counts).toEqual([
    { method: "POST", path: "/v2/library/counts", scope: "public", body: { mode: "works", filters } },
    { method: "POST", path: "/v2/library/counts", scope: "public", body: { mode: "parts", filters } },
    { method: "POST", path: "/v2/library/counts", scope: "public", body: { mode: "epub", filters } },
    { method: "POST", path: "/v2/library/counts", scope: "public", body: { mode: "pdf", filters } }
  ])
  expect(await legacyLibraryRequests(request)).toEqual({
    relevance: [], query: [], options: [], metadata: []
  })

  await reset(request)
  await page.goto("/epub", { waitUntil: "networkidle" })
  expect((await libraryV2Requests(request)).counts).toEqual([
    { method: "POST", path: "/v2/library/counts", scope: "public", body: { mode: "pdf", filters } }
  ])
  expect(await legacyLibraryRequests(request)).toEqual({
    relevance: [], query: [], options: [], metadata: []
  })

  await reset(request)
  await page.goto("/epub?visa=pdf&sort=popularitet", { waitUntil: "networkidle" })
  expect((await libraryV2Requests(request)).counts).toEqual([
    { method: "POST", path: "/v2/library/counts", scope: "public", body: { mode: "epub", filters } }
  ])
  expect(await legacyLibraryRequests(request)).toEqual({
    relevance: [], query: [], options: [], metadata: []
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
  await setLibraryDelay(request, "search", {
    mode: "epub", filters: libraryFilters({ query: "Selma" }), sort: "popularity", reverse: false, page: 1
  })
  await page.goto("/bibliotek?visa=epub&sort=popularitet", { waitUntil: "networkidle" })

  await page.locator("[data-library-filter]").fill("Selma")
  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(1)
  await expect(page.locator('[data-library-loading][role="status"] .sr-only'))
    .toHaveText("Laddar resultat")
  await expect(page.locator("[data-library-loading] .spinner")).toBeVisible()
  await expect(page.locator("[data-library-loading] .spinner")).toHaveAttribute("aria-hidden", "true")
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
  expect(ledger[0]?.body).toEqual({
    mode: "epub", filters: libraryFilters({ query: 'Selma–Lagerlöf, "saga"' }),
    sort: "chronology", reverse: false, page: 1
  })
})

test("each EPUB sort resets page and emits its exact expression", async ({ page, request }) => {
  await page.goto("/bibliotek?visa=epub&sort=popularitet&sida=2", { waitUntil: "networkidle" })
  await reset(request)

  for (const [index, [sort, wireSort]] of [
    ["forfattare", "author"],
    ["titlar", "title"],
    ["popularitet", "popularity"],
    ["kronologi", "chronology"]
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
    expect(ledger.at(-1)?.body).toEqual({
      mode: "epub", filters: libraryFilters(), sort: wireSort, reverse: false, page: 1
    })
  }

  expect(publicEpubRequests(await epubRequests(request))).toHaveLength(4)
})

test("clicking the active EPUB sort reverses its primary field without changing query state", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?keep=ja&visa=epub&sort=titlar", { waitUntil: "networkidle" })
  await reset(request)

  const sort = page.locator('[data-library-sort="titlar"]')
  const item = sort.locator("xpath=..")
  const initialHistoryLength = await page.evaluate(() => history.length)
  await expect(sort).toHaveAttribute("aria-current", "true")
  await expect(item.locator(".sr-only")).toHaveText("Aktiv sortering, stigande")
  await expect(item.locator(".fa-caret-down")).toBeVisible()
  await expect(item.locator(".fa-caret-down")).toHaveAttribute("aria-hidden", "true")

  await sort.click()
  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(1)
  expect(new URL(page.url()).searchParams.get("sort")).toBe("titlar")
  expect(new URL(page.url()).searchParams.get("keep")).toBe("ja")
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength)
  await expect(item.locator(".fa-caret-up")).toBeVisible()
  await expect(item.locator(".sr-only")).toHaveText("Aktiv sortering, fallande")
  await expect(item.locator(".fa-caret-down")).toHaveCount(0)
  expect((await publicEpubRequests(await epubRequests(request))).at(-1)?.body)
    .toMatchObject({ mode: "epub", sort: "title", reverse: true })

  await sort.click()
  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(2)
  expect(new URL(page.url()).searchParams.get("sort")).toBe("titlar")
  expect(new URL(page.url()).searchParams.get("keep")).toBe("ja")
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength)
  await expect(item.locator(".fa-caret-down")).toBeVisible()
  await expect(item.locator(".fa-caret-up")).toHaveCount(0)
  expect((await publicEpubRequests(await epubRequests(request))).at(-1)?.body)
    .toMatchObject({ mode: "epub", sort: "title", reverse: false })
})

test("the active All sort exposes its backend direction and updates after reversal", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?sort=relevans", { waitUntil: "networkidle" })
  await reset(request)

  const sort = page.locator('[data-library-sort="relevans"]')
  const item = sort.locator("xpath=..")
  await expect(sort).toHaveAttribute("aria-current", "true")
  await expect(item.locator(".sr-only")).toHaveText("Aktiv sortering, fallande")
  await expect(item.locator(".fa-caret-down")).toHaveAttribute("aria-hidden", "true")

  await sort.click()
  await expect.poll(async () => (await libraryV2Requests(request)).search.length).toBe(1)
  await expect(item.locator(".sr-only")).toHaveText("Aktiv sortering, stigande")
  await expect(item.locator(".fa-caret-up")).toHaveAttribute("aria-hidden", "true")
  expect((await libraryV2Requests(request)).search.at(-1)?.body)
    .toMatchObject({ mode: "all", sort: "relevance", reverse: true })
})

test("reversing a multi-field sort leaves its ascending tie-breaker intact", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?visa=epub&sort=forfattare", { waitUntil: "networkidle" })
  await reset(request)

  const sort = page.locator('[data-library-sort="forfattare"]')
  await sort.click()

  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(1)
  expect((await publicEpubRequests(await epubRequests(request))).at(-1)?.body)
    .toMatchObject({ mode: "epub", sort: "author", reverse: true })
  await expect(sort.locator("..").locator(".fa-caret-up")).toBeVisible()
})

test("sort direction is isolated by sort key and between EPUB and PDF modes", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?visa=epub&sort=titlar", { waitUntil: "networkidle" })
  await reset(request)

  const epubTitleSort = page.locator('[data-library-sort="titlar"]')
  await epubTitleSort.click()
  await expect.poll(async () => publicOnlyEpubRequests(await epubRequests(request)).length).toBe(1)
  expect((await publicOnlyEpubRequests(await epubRequests(request))).at(-1)?.body)
    .toMatchObject({ sort: "title", reverse: true })

  const epubAuthorSort = page.locator('[data-library-sort="forfattare"]')
  await epubAuthorSort.click()
  await expect.poll(async () => publicOnlyEpubRequests(await epubRequests(request)).length).toBe(2)
  expect((await publicOnlyEpubRequests(await epubRequests(request))).at(-1)?.body)
    .toMatchObject({ sort: "author", reverse: false })
  await expect(epubAuthorSort.locator("..").locator(".fa-caret-down")).toBeVisible()

  await epubTitleSort.click()
  await expect.poll(async () => publicOnlyEpubRequests(await epubRequests(request)).length).toBe(3)
  expect((await publicOnlyEpubRequests(await epubRequests(request))).at(-1)?.body)
    .toMatchObject({ sort: "title", reverse: true })
  await expect(epubTitleSort.locator("..").locator(".fa-caret-up")).toBeVisible()

  await page.locator('[data-library-tab="pdf"]').click()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  const pdfTitleSort = page.locator('[data-library-sort="titlar"]')
  await pdfTitleSort.click()

  await expect.poll(async () => publicPdfRequests(await epubRequests(request)).length).toBe(2)
  expect((await publicPdfRequests(await epubRequests(request))).at(-1)?.body)
    .toMatchObject({ sort: "title", reverse: false })
  await expect(pdfTitleSort.locator("..").locator(".fa-caret-down")).toBeVisible()
})

test("two rapid active sort clicks keep the newest direction and rows", async ({ page, request }) => {
  await page.goto("/bibliotek?visa=epub&filter=sort%20race&sort=titlar", {
    waitUntil: "networkidle"
  })
  await reset(request)
  await setLibraryDelay(request, "search", {
    mode: "epub", filters: libraryFilters({ query: "sort race" }), sort: "title", reverse: true, page: 1
  })

  const sort = page.locator('[data-library-sort="titlar"]')
  await sort.click()
  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(1)
  await sort.click()

  await expect.poll(async () => publicEpubRequests(await epubRequests(request)).length).toBe(2)
  await expect(page.getByRole("link", { name: "Doktor Glas", exact: true })).toBeVisible()
  await page.waitForTimeout(1000)
  await expect(page.getByRole("link", { name: "Doktor Glas", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Gösta Berlings saga", exact: true })).toHaveCount(0)
  await expect(sort.locator("..").locator(".fa-caret-down")).toBeVisible()
  expect((await publicEpubRequests(await epubRequests(request))).map(entry => entry.body.reverse))
    .toEqual([true, false])
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
      path: "/v2/library/search",
      body: expect.objectContaining({ mode: "epub", page: 2 })
    })
  ])

  await expect(page.locator("[data-library-epub-title]")).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/LagerlofS/titlar/GostaBerlingsSaga/etext?om-boken"
  )
  await expect(page.locator("[data-library-epub-author]")).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/LagerlofS"
  )
  await expect(page.locator("[data-library-epub-download]")).toHaveAttribute(
    "href",
    "/txt/epub/LagerlofS_GostaBerlingsSaga.epub"
  )
})

test("all-results pagination owns page state and resets it for new searches and sorts", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?keep&keep=ja&filter=all-pagination", {
    waitUntil: "networkidle"
  })
  await expect(page.locator("[data-library-result]")).toHaveCount(100)
  await reset(request)

  await page.locator("[data-library-pagination-next]").click()
  await expect(page.getByRole("link", { name: "Den unika träffen på sida två" })).toBeVisible()
  let url = new URL(page.url())
  expect(url.searchParams.get("sida")).toBe("2")
  expect(url.searchParams.getAll("keep")).toEqual(["", "ja"])
  expect((await requests(request)).at(-1)?.body).toMatchObject({
    mode: "all",
    page: 2,
    filters: libraryFilters({ query: "all-pagination" })
  })

  await pushRoute(page, "/bibliotek?keep&keep=ja&filter=all-pagination")
  await expect(page.locator("[data-library-result]")).toHaveCount(100)
  await page.goBack()
  await expect(page.getByRole("link", { name: "Den unika träffen på sida två" })).toBeVisible()
  await page.goForward()
  await expect(page.locator("[data-library-result]")).toHaveCount(100)

  await page.locator("[data-library-pagination-next]").click()
  await expect(page.getByRole("link", { name: "Den unika träffen på sida två" })).toBeVisible()

  await page.locator('[data-library-sort="titlar"]').click()
  await expect(page.locator("[data-library-result]")).toHaveCount(100)
  url = new URL(page.url())
  expect(url.searchParams.get("sort")).toBe("titlar")
  expect(url.searchParams.has("sida")).toBe(false)
  expect((await requests(request)).at(-1)?.body).toMatchObject({ mode: "all", page: 1 })

  await page.locator("[data-library-pagination-next]").click()
  await expect(page.getByRole("link", { name: "Den unika träffen på sida två" })).toBeVisible()
  await page.locator("[data-library-filter]").fill("Selma")
  await expect.poll(() => new URL(page.url()).searchParams.get("filter")).toBe("Selma")
  await expect.poll(() => new URL(page.url()).searchParams.has("sida")).toBe(false)
  await expect(page.locator("[data-library-result]")).toHaveCount(1)
  await expect(page.getByRole("link", { name: /Lagerlöf/ })).toBeVisible()
  expect((await requests(request)).at(-1)?.body).toMatchObject({
    mode: "all",
    page: 1,
    filters: libraryFilters({ query: "Selma" })
  })
})

test("all-results replaces response-invalid pages without history or request loops", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?keep&keep=ja&filter=all-pagination", {
    waitUntil: "networkidle"
  })
  await reset(request)

  await pushRoute(page, "/bibliotek?keep&keep=ja&filter=all-pagination&sida=100")
  await expect(page.getByRole("link", { name: "Den unika träffen på sida två" })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get("sida")).toBe("2")
  await page.waitForTimeout(250)
  expect((await requests(request)).map(entry => entry.body.page)).toEqual([100, 2])

  await page.goBack()
  await expect(page.locator("[data-library-result]")).toHaveCount(100)
  expect(new URL(page.url()).searchParams.has("sida")).toBe(false)
  await page.goForward()
  await expect(page.getByRole("link", { name: "Den unika träffen på sida två" })).toBeVisible()
  expect(new URL(page.url()).searchParams.get("sida")).toBe("2")

  await reset(request)
  await pushRoute(page, "/bibliotek?keep=ja&filter=inga&sida=2")
  await expect(page.locator("[data-library-empty]")).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.has("sida")).toBe(false)
  await page.waitForTimeout(250)
  expect((await requests(request)).map(entry => entry.body.page)).toEqual([2, 1])
})

test("all-results canonicalizes raw page-one aliases without requesting or retaining them", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?keep&keep=ja&filter=all-pagination", {
    waitUntil: "networkidle"
  })
  await expect(page.locator("[data-library-result]")).toHaveCount(100)
  await reset(request)

  for (const pageQuery of ["sida", "sida=1", "sida=0", "sida=101", "sida=malformed"]) {
    await pushRoute(
      page,
      `/bibliotek?keep&keep=ja&filter=all-pagination&${pageQuery}`
    )
    await expect.poll(() => new URL(page.url()).searchParams.has("sida")).toBe(false)
    expect(new URL(page.url()).searchParams.getAll("keep")).toEqual(["", "ja"])
    await expect(page.locator("[data-library-result]")).toHaveCount(100)

    await page.goBack()
    expect(new URL(page.url()).searchParams.has("sida")).toBe(false)
    await page.goForward()
    expect(new URL(page.url()).searchParams.has("sida")).toBe(false)
  }

  expect(await requests(request)).toEqual([])
})

test("standalone EPUB keeps both format counts current without replacing active rows", async ({
  page,
  request
}) => {
  await page.goto("/epub?sort=popularitet", { waitUntil: "networkidle" })
  await expect(page.locator('[data-library-tab="epub"]')).toHaveText("Epub: 201")
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveText("PDF: 201")
  await reset(request)

  await page.locator("[data-library-filter]").fill("Selma")
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(1)
  await expect(page.locator('[data-library-tab="epub"]')).toHaveText("Epub: 1")
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveText("PDF: 1")

  const ledger = await epubRequests(request)
  expect(publicOnlyEpubRequests(ledger)).toHaveLength(1)
  expect(await countOnlyPdfRequests(request)).toHaveLength(1)
  expect(await countOnlyEpubRequests(request)).toHaveLength(0)
  expect(publicOnlyEpubRequests(ledger)[0]?.body).toMatchObject({ mode: "epub", page: 1 })
  expect((await countOnlyPdfRequests(request))[0]?.body).toEqual({
    mode: "pdf", filters: libraryFilters({ query: "Selma" })
  })
})

test("a delayed inactive standalone count never gates the active EPUB rows", async ({
  page,
  request
}) => {
  await setLibraryDelay(request, "counts", { mode: "pdf", filters: libraryFilters() })
  await page.goto("/epub?sort=popularitet", { waitUntil: "domcontentloaded" })

  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  await expect(page.locator('[data-library-tab="epub"]')).toHaveText("Epub: 201")
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveText("PDF")
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveText("PDF: 201")
})

test("a failed inactive standalone count leaves active rows and status intact", async ({ page }) => {
  await page.goto("/epub?filter=invalid-hits&sort=popularitet", { waitUntil: "networkidle" })

  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)
  await expect(page.locator("[data-library-error]")).toHaveCount(0)
  await expect(page.locator('[data-library-tab="epub"]')).toHaveText("Epub: 201")
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveText("PDF")
})

test("standalone format switches reuse counts but always fetch the selected rows", async ({
  page,
  request
}) => {
  await page.goto("/epub?sort=popularitet", { waitUntil: "networkidle" })
  await reset(request)

  await page.locator('[data-library-tab="pdf"]').click()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  await expect(page.locator('[data-library-tab="epub"]')).toHaveText("Epub: 201")
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveText("PDF: 201")

  const ledger = await epubRequests(request)
  expect(publicPdfRequests(ledger)).toHaveLength(1)
  expect(await countOnlyEpubRequests(request)).toHaveLength(0)
  expect(await countOnlyPdfRequests(request)).toHaveLength(0)
})

test("a stale standalone inactive count cannot overwrite a newer filter identity", async ({
  page,
  request
}) => {
  await page.goto("/epub?sort=popularitet", { waitUntil: "networkidle" })
  await reset(request)
  await setLibraryDelay(request, "counts", {
    mode: "pdf", filters: libraryFilters({ query: "Selma" })
  })

  const input = page.locator("[data-library-filter]")
  await input.fill("Selma")
  await expect.poll(async () => (await countOnlyPdfRequests(request)).length).toBe(1)
  await input.fill("inga")

  await expect(page.locator("[data-library-empty]")).toBeVisible()
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-library-tab="epub"]')).toHaveText("Epub")
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveText("PDF")
})

test("EPUB pagination matches the legacy ten-page rotating window", async ({ page }) => {
  await page.goto("/epub?filter=pagination%20window&sort=popularitet", {
    waitUntil: "networkidle"
  })

  const items = page.locator('nav[aria-label="Sidnavigation"] li:not(:first-child):not(:last-child)')
  await expect(items).toHaveText(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "..."])
  await expect(page.locator('[data-library-page="17"]')).toHaveCount(0)
})

test("standalone advanced chronology refreshes both counts and preserves repeated query keys", async ({
  page,
  request
}) => {
  await page.goto("/epub?sort=popularitet", { waitUntil: "networkidle" })
  await reset(request)

  await pushRoute(
    page,
    "/epub?keep&keep=ja&avancerat=1&intervall=1900%2C1910&sort=popularitet"
  )
  await expect(page.locator('[data-library-tab="epub"]')).toHaveText("Epub: 201")
  await expect(page.locator('[data-library-tab="pdf"]')).toHaveText("PDF: 201")
  const url = new URL(page.url())
  expect(url.searchParams.getAll("keep")).toEqual(["", "ja"])

  const ledger = await epubRequests(request)
  expect(publicOnlyEpubRequests(ledger)).toHaveLength(1)
  expect(await countOnlyPdfRequests(request)).toHaveLength(1)
  expect(publicOnlyEpubRequests(ledger)[0]?.body.filters).toMatchObject({ year_from: 1900, year_to: 1910 })
  expect((await countOnlyPdfRequests(request))[0]?.body.filters).toMatchObject({ year_from: 1900, year_to: 1910 })
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
  await setLibraryDelay(request, "search", {
    mode: "epub", filters: libraryFilters({ query: "Selma" }), sort: "popularity", reverse: false, page: 1
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
  await setLibraryDelay(request, "search", {
    mode: "epub", filters: libraryFilters(), sort: "chronology", reverse: false, page: 1
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
  await setLibraryDelay(request, "search", {
    mode: "epub", filters: libraryFilters(), sort: "popularity", reverse: false, page: 2
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

test("SPA navigation between Library and its EPUB alias updates the complete shell", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  await reset(request)
  await page.evaluate(() => {
    ;(window as typeof window & { __librarySpa?: string }).__librarySpa = "alive"
  })
  await page.locator("[data-library-mounted]").evaluate(element => {
    element.setAttribute("data-library-instance-probe", "library")
  })

  await page.locator(".mainnav").getByRole("link", { name: "Hämta e-böcker" }).click()
  await expect(page).toHaveURL("/epub?visa=epub&sort=popularitet")
  await expect(page.locator("[data-library-instance-probe]")).toHaveCount(0)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hämta e-böcker")
  await expect(page.locator("body")).toHaveClass(/page-epub/u)
  await expect(page.locator("[data-library-epub-row]")).toHaveCount(3)

  await page.locator(".mainnav").getByRole("link", { name: "Biblioteket", exact: true }).click()
  await expect(page).toHaveURL("/bibliotek")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Botanisera i biblioteket")
  await expect(page.locator("body")).toHaveClass(/page-library/u)
  expect(await page.evaluate(() =>
    (window as typeof window & { __librarySpa?: string }).__librarySpa
  )).toBe("alive")

  expect(publicOnlyEpubRequests(await epubRequests(request))).toHaveLength(1)
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
  expect(publicPdfRequests(await epubRequests(request))[0]?.body).toEqual({
    mode: "pdf", filters: libraryFilters({ query: 'Selma–Lagerlöf, "roman"' }),
    sort: "chronology", reverse: false, page: 1
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
  expect(ledger.at(-1)?.body.filters).toEqual(libraryFilters())
})

test("each PDF sort resets page and PDF pagination owns numeric, previous, and next state", async ({
  page,
  request
}) => {
  await page.goto("/bibliotek?keep=ja&visa=pdf&sort=popularitet&sida=2", {
    waitUntil: "networkidle"
  })
  await reset(request)

  for (const [index, [sort, wireSort]] of [
    ["forfattare", "author"],
    ["titlar", "title"],
    ["popularitet", "popularity"],
    ["kronologi", "chronology"]
  ].entries()) {
    await page.locator(`[data-library-sort="${sort}"]`).click()
    await expect.poll(async () => publicPdfRequests(await epubRequests(request)).length)
      .toBe(index + 1)
    await expect(page.locator(`[data-library-sort="${sort}"]`)).toHaveClass(/active/)
    expect(new URL(page.url()).searchParams.has("sida")).toBe(false)
    expect(publicPdfRequests(await epubRequests(request)).at(-1)?.body).toEqual({
      mode: "pdf", filters: libraryFilters(), sort: wireSort, reverse: false, page: 1
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
  expect(pagination.map(entry => entry.body.page)).toEqual([2, 1, 2])
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
  expect((await requests(request)).filter(entry => entry.scope === "public"))
    .toHaveLength(1)
})

test("delayed PDF intents cannot replace newer PDF, EPUB, or relevance states", async ({
  page,
  request
}) => {
  await setLibraryDelay(request, "search", {
    mode: "pdf", filters: libraryFilters({ query: "Selma" }), sort: "popularity", reverse: false, page: 1
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

  await request.delete(`${fixture}/_library_v2/delays`)
  await page.locator("[data-library-reset]").click()
  await expect(page.locator("[data-library-pdf-row]")).toHaveCount(5)
  await setLibraryDelay(request, "search", {
    mode: "pdf", filters: libraryFilters({ query: "Selma" }), sort: "popularity", reverse: false, page: 1
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

  await setLibraryDelay(request, "search", {
    mode: "pdf", filters: libraryFilters({ query: "inga" }), sort: "popularity", reverse: false, page: 1
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
  expect(hydrated.filter(entry => entry.scope === "private")).toHaveLength(1)
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
    "/f%C3%B6rfattare/LagerlofS/titlar/NilsHolgersson/faksimil?om-boken"
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
    "/f%C3%B6rfattare/GroupMainA/titlar/LaterExportGroupMain/etext?om-boken"
  )
  await expect(laterExport.locator("[data-library-pdf-author]")).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/GroupMainA"
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
  await request.put(`${fixture}/_library_v2/failures`, {
    data: { operation: "search", mode: "pdf" }
  })
  const expectedFailureUrl = new URL("/api/v2/library/search", page.url())
  await input.fill("failed")
  await input.press("Enter")
  await expect(page.locator("[data-library-error]")).toHaveText("Ett fel uppstod.")
  await expect(page.getByRole("alert")).toHaveCount(1)
  await expect(page.getByRole("alert")).toHaveText("Ett fel uppstod.")
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
