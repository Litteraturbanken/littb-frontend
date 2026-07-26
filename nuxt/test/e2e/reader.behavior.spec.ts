import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page
} from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const readerPartsPath = "/författare/SöderbergH/titlar/DoktorGlasParts/sida/-1/etext"
const workScopedReaderPath = "/författare/SöderbergH/titlar/WorkScopedIdsReader/sida/-2/etext"
const readerEncodedPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const readerPublicCanonicalPath = "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const readerShorthandPath = "/författare/SöderbergH/titlar/DoktorGlas/etext"
const readerShorthandRouterPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/etext"
const dramaReaderPath = "/författare/AlmlöfN/titlar/Affarer/sida/-2/faksimil"
const sparseReaderPath = "/författare/SparseA/titlar/SparseTitle/sida/-2/etext"
const sparseSliderReaderPath = "/författare/SöderbergH/titlar/SparseKeyboardReader/sida/2/etext"
const countedSliderReaderPath = "/författare/SöderbergH/titlar/CountedSliderReader/sida/-2/etext"
const onePageSliderReaderPath = "/författare/SöderbergH/titlar/OnePageSliderReader/sida/0/etext"
const invalidCountSliderReaderPath = "/författare/SöderbergH/titlar/InvalidCountSliderReader/sida/57/etext"
const longErrataReaderPath = "/författare/LongErrataA/titlar/LongErrata/sida/-2/etext"
const emptyErrataReaderPath = "/författare/EmptyErrataA/titlar/EmptyErrata/sida/-2/etext"
const storedReaderPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const storedNextReaderPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"
const facsimilePath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"
const boyeFacsimilePath = "/författare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil"
const boyeEtextPath = "/författare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/etext"
const facsimileImagePath = "/txt/lb-reader-gosta-berlings-saga/" +
  "lb-reader-gosta-berlings-saga_3/" +
  "lb-reader-gosta-berlings-saga_3_0009.jpeg"
const facsimileRetinaPath = "/txt/lb-reader-gosta-berlings-saga/" +
  "lb-reader-gosta-berlings-saga_5/" +
  "lb-reader-gosta-berlings-saga_5_0009.jpeg"
const storedFacsimilePath = "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/" +
  "GostaBerlingsSaga/sida/3/faksimil"
const storedNextFacsimilePath = "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/" +
  "GostaBerlingsSaga/sida/5/faksimil"

function facsimileSource(size: 2 | 3 | 4 | 5, imageNumber: 7 | 9 | 12): string {
  const work = "lb-reader-gosta-berlings-saga"
  return `/txt/${work}/${work}_${size}/${work}_${size}_${String(imageNumber).padStart(4, "0")}.jpeg`
}

function facsimilePageHref(pageName: "1" | "3" | "5", query = ""): string {
  return "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/" +
    `sida/${pageName}/faksimil${query}`
}

type StoredPageView = {
  pageix: number
  pagename?: string
  timestamp: string
  mediatype: string
  lbworkid: string
  author: string
  label: string
  url: string
}

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`),
    request.delete(`${fixture}/_reader_ocr_requests`),
    request.delete(`${fixture}/_reader_jpeg_requests`),
    request.delete(`${fixture}/_reader_metadata_delays`),
    request.delete(`${fixture}/_reader_hit_requests`),
    request.delete(`${fixture}/_reader_hit_failure`),
    request.delete(`${fixture}/_reader_hit_delays`),
    request.delete(`${fixture}/_source_info_requests`),
    request.delete(`${fixture}/_similar_work_requests`),
    request.delete(`${fixture}/_similar_work_failure`),
    request.delete(`${fixture}/_similar_work_malformed`),
    request.delete(`${fixture}/_source_info_static_requests`),
    request.delete(`${fixture}/_source_info_failure`),
    request.delete(`${fixture}/_source_info_delays`),
    request.delete(`${fixture}/_source_info_static_failure`)
  ])
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

async function readerMetadataRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_metadata_requests`)).json()).requests
}

async function readerHtmlRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_html_requests`)).json()).requests
}

type ReaderHitRequest = { path: string, query: string }

async function readerHitRequests(request: APIRequestContext): Promise<ReaderHitRequest[]> {
  return (await (await request.get(`${fixture}/_reader_hit_requests`)).json()).requests
}

type SourceInfoRequest = { scope: "private" | "public", path: string, query: string }

async function sourceInfoRequests(request: APIRequestContext): Promise<SourceInfoRequest[]> {
  return (await (await request.get(`${fixture}/_source_info_requests`)).json()).requests
}

async function similarWorkRequests(request: APIRequestContext): Promise<SourceInfoRequest[]> {
  return (await (await request.get(`${fixture}/_similar_work_requests`)).json()).requests
}

type AllowedHttpError = {
  method: "GET"
  status: number
  url: string
}

type AllowedRequestFailure = {
  errorText: string
  method: "GET"
  urlSuffix: string
}

function captureBrowserProblems(
  page: Page,
  allowances: {
    httpErrors?: readonly AllowedHttpError[]
    requestFailures?: readonly AllowedRequestFailure[]
  } = {}
) {
  const problems: string[] = []
  const remainingAllowedHttpErrors = [...(allowances.httpErrors ?? [])]
  const remainingAllowedRequestFailures = [...(allowances.requestFailures ?? [])]
  page.on("console", message => {
    if (
      /hydration/i.test(message.text()) ||
      // Chromium reports HTTP failures generically here; the response listener below
      // retains the status, method, and exact URL needed for a useful assertion.
      (message.type() === "error" && !message.text().startsWith("Failed to load resource:"))
    ) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("response", response => {
    if (response.status() < 400) return
    const responseUrl = new URL(response.url())
    const relativeUrl = `${responseUrl.pathname}${responseUrl.search}`
    const allowedIndex = remainingAllowedHttpErrors.findIndex(allowed =>
      allowed.status === response.status()
      && allowed.method === response.request().method()
      && allowed.url === relativeUrl
    )
    if (allowedIndex !== -1) {
      remainingAllowedHttpErrors.splice(allowedIndex, 1)
      return
    }
    problems.push(
      `response: ${response.status()} ${response.request().method()} ${response.url()}`
    )
  })
  page.on("requestfailed", request => {
    const failure = request.failure()?.errorText ?? "unknown failure"
    if (failure.includes("ERR_ABORTED")) return
    const allowedIndex = remainingAllowedRequestFailures.findIndex(allowed =>
      allowed.errorText === failure
      && allowed.method === request.method()
      && request.url().endsWith(allowed.urlSuffix)
    )
    if (allowedIndex !== -1) {
      remainingAllowedRequestFailures.splice(allowedIndex, 1)
      return
    }
    problems.push(`requestfailed: ${request.method()} ${request.url()} (${failure})`)
  })
  return problems
}

async function seedStoredPageViews(page: Page, value: unknown) {
  await page.addInitScript(stored => {
    const marker = "reader-history-seeded"
    if (sessionStorage.getItem(marker) !== null) return
    localStorage.setItem("lastPageViews", typeof stored === "string"
      ? stored
      : JSON.stringify(stored))
    sessionStorage.setItem(marker, "true")
  }, value)
}

async function storedPageViews(page: Page): Promise<StoredPageView[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("lastPageViews") ?? "[]"))
}

async function rawStoredPageViews(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("lastPageViews"))
}

async function navigateClient(page: Page, rawPath: string) {
  await page.evaluate(async nextPath => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: {
            $router: { push: (path: string) => Promise<void> }
          }
        }
      }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    await router.push(nextPath)
  }, rawPath)
}

type HistoryMutationCounts = { pushState: number, replaceState: number }

async function startHistoryMutationCounter(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scope = window as typeof window & {
      __readerHistoryMutationCounts?: HistoryMutationCounts
      __readerHistoryMutationCounterStarted?: boolean
    }
    scope.__readerHistoryMutationCounts = { pushState: 0, replaceState: 0 }
    if (scope.__readerHistoryMutationCounterStarted) return
    scope.__readerHistoryMutationCounterStarted = true
    const originalPush = window.history.pushState.bind(window.history)
    const originalReplace = window.history.replaceState.bind(window.history)
    window.history.pushState = (...args) => {
      const counts = scope.__readerHistoryMutationCounts
      if (counts) counts.pushState += 1
      return originalPush(...args)
    }
    window.history.replaceState = (...args) => {
      const counts = scope.__readerHistoryMutationCounts
      if (counts) counts.replaceState += 1
      return originalReplace(...args)
    }
  })
}

async function historyMutationCounts(page: Page): Promise<HistoryMutationCounts> {
  return page.evaluate(() => (
    window as typeof window & { __readerHistoryMutationCounts?: HistoryMutationCounts }
  ).__readerHistoryMutationCounts ?? { pushState: 0, replaceState: 0 })
}

async function activateReaderLink(
  page: Page,
  name: "Föregående sida" | "Nästa sida",
  expectedHref: string,
  scope: Page | Locator = page
) {
  const link = scope.getByRole("link", { name })
  await expect(link).toHaveAttribute("href", expectedHref)
  await expect(link).toBeVisible()
  const visualButton = link.locator(".navicon-visual")
  await expect(visualButton).toBeVisible()
  if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) < 768) {
    await link.dispatchEvent("click")
  } else {
    await visualButton.click()
  }
}

async function expectBoyeContributors(container: Locator) {
  const links = container.locator("a")
  await expect(links).toHaveCount(2)
  await expect(links.nth(0)).toHaveText("Karin Boye")
  await expect(links.nth(0)).toHaveAttribute("href", "/f%C3%B6rfattare/BoyeK")
  await expect(links.nth(1)).toContainText("Paulina Helgeson")
  await expect(links.nth(1)).toHaveAttribute("href", "/f%C3%B6rfattare/HelgesonP")
  await expect(container.locator("em")).toHaveText("&")
  const suffix = container.locator(".authortype")
  await expect(suffix).toHaveText("red.")
  expect(await suffix.evaluate(element => [
    getComputedStyle(element, "::before").content,
    getComputedStyle(element, "::after").content
  ])).toEqual(['"("', '")"'])
}

test.beforeEach(async ({ request }) => resetReader(request))

test("part-rich sidebar exposes truthful authors, metadata, and raw-preserving targets", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  const rawQuery =
    "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F" +
    "&q=inga&hit=0&storlek=3&innehall=1"
  await page.goto(`${readerPartsPath}${rawQuery}`, { waitUntil: "networkidle" })

  const context = page.locator(".reader-context")
  const currentPart = context.locator(".current_part")
  await expect(currentPart.locator(".navtitle")).toHaveText("Överlappningen")
  await expect(currentPart.locator(".navtitle").locator(".."))
    .toHaveAttribute("title", "Den överlappande delen")
  await expect(currentPart.locator(".header").getByRole("link", { name: "Rilke" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/RilkeRM")
  await expect(currentPart.locator(".header").getByRole("link", { name: "Shelley" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/ShelleyPB")
  await expect(page.locator('meta[name="part"]')).toHaveAttribute("content", "overlap")

  const retained =
    "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F" +
    "&q=inga&hit=0&storlek=3"
  const navigation = context.locator(".reader-navigation")
  await expect(navigation.getByRole("link", { name: "Gå bakåt en del" }))
    .toHaveAttribute(
      "href",
      `/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-2/etext${retained}`
    )
  await expect(navigation.getByRole("link", { name: "Gå till nästa del" }))
    .toHaveAttribute(
      "href",
      `/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/3/etext${retained}`
    )
  await expect(navigation.getByRole("link", { name: "Gå till första sidan" }))
    .toHaveAttribute(
      "href",
      `/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-3/etext${retained}`
    )
  await expect(navigation.getByRole("link", { name: "Gå till sista sidan" }))
    .toHaveAttribute(
      "href",
      `/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/5/etext${retained}`
    )
  await expect(context.locator(".rzslider > .rz-base[aria-hidden=\"true\"]")).toHaveCount(1)
  await expect(context.locator(".expl.small")).toHaveAttribute("aria-hidden", "true")
  expect(problems).toEqual([])
})

test("Boye work contributors persist in sidebar, contents, and work search", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(boyeFacsimilePath, { waitUntil: "networkidle" })
  await expectBoyeContributors(page.locator(".reader-context > div").first().locator(".author"))

  await page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Innehållsförteckning" })
    .evaluate(link => (link as HTMLAnchorElement).click())
  const contents = page.getByRole("dialog", { name: "Innehållsförteckning" })
  await expectBoyeContributors(contents.locator(".header .author"))
  await contents.getByRole("button", { name: "Stäng" }).click()

  await page.goto(boyeEtextPath, { waitUntil: "networkidle" })
  await page.locator(".reader-context")
    .getByRole("link", { name: "Sök i verket" })
    .evaluate(link => (link as HTMLAnchorElement).click())
  await expectBoyeContributors(page.locator(".searchbox .header .author"))
  expect(problems).toEqual([])
})

test("contents trigger replaces one focus-trapped dialog without Reader requests", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const rawQuery = "?bare&repeat=one&repeat=two"
  await page.goto(`${readerPartsPath}${rawQuery}`, { waitUntil: "networkidle" })
  await resetReader(request)

  const trigger = page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Innehållsförteckning" })
  await expect(trigger).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-1/etext" +
    `${rawQuery}&innehall`
  )
  const historyLength = await page.evaluate(() => window.history.length)
  await trigger.click()

  await expect(page).toHaveURL(`${readerPartsPath}${rawQuery}&innehall`)
  const dialog = page.getByRole("dialog", { name: "Innehållsförteckning" })
  await expect(dialog).toHaveCount(1)
  await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
  await expect.poll(() => page.evaluate(() => [
    getComputedStyle(document.documentElement).overflow,
    getComputedStyle(document.body).overflow
  ])).toContain("hidden")
  await expect.poll(() => page.evaluate(() => Boolean(
    document.activeElement?.closest('[role="dialog"]')
  ))).toBe(true)
  await page.keyboard.press("Shift+Tab")
  expect(await page.evaluate(() => Boolean(
    document.activeElement?.closest('[role="dialog"]')
  ))).toBe(true)
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength)
  expect(await readerRequests(request)).toEqual([])
  expect(await readerHitRequests(request)).toEqual([])

  await dialog.getByRole("button", { name: "Stäng" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(`${readerPartsPath}${rawQuery}`)
  expect(await readerRequests(request)).toEqual([])
  expect(await readerHitRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("contents parser opens only bare or empty singleton values", async ({ page }) => {
  for (const suffix of ["?innehall", "?innehall="]) {
    await page.goto(`${readerPartsPath}${suffix}`, { waitUntil: "networkidle" })
    await expect(page.getByRole("dialog", { name: "Innehållsförteckning" })).toHaveCount(1)
  }
  for (const suffix of ["?innehall=1", "?innehall&innehall"]) {
    await page.goto(`${readerPartsPath}${suffix}`, { waitUntil: "networkidle" })
    await expect(page.getByRole("dialog", { name: "Innehållsförteckning" })).toHaveCount(0)
    expect(new URL(page.url()).search).toBe(suffix)
  }
  await page.goto(
    "/författare/SöderbergH/titlar/PartlessReader/sida/-2/etext?innehall",
    { waitUntil: "networkidle" }
  )
  await expect(page.getByRole("dialog", { name: "Innehållsförteckning" })).toHaveCount(0)
})

for (const closeMethod of ["Escape", "backdrop", "Stäng"] as const) {
  test(`contents ${closeMethod} closes once, preserves raw state, and restores focus`, async ({
    page,
    request
  }) => {
    const retainedQuery =
      "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F&q=inga&hit=0"
    const rawQuery = `${retainedQuery}&innehall`
    const retainedPath = `${readerPartsPath}${retainedQuery}`
    const retainedEncodedPath =
      "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-1/etext" +
      retainedQuery
    const contentsPath = `${readerPartsPath}${rawQuery}`
    const contentsEncodedPath = `${retainedEncodedPath}&innehall`
    const nextHref =
      "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/1/etext" +
      retainedQuery
    await page.goto(retainedPath, { waitUntil: "networkidle" })
    const trigger = page.locator(".reader-context .subnav")
      .getByRole("link", { name: "Innehållsförteckning" })
    const dialog = page.getByRole("dialog", { name: "Innehållsförteckning" })
    await expect(trigger).toHaveAttribute("href", contentsEncodedPath)
    await resetReader(request)
    await startHistoryMutationCounter(page)
    const historyLengthBeforeOpen = await page.evaluate(() => window.history.length)
    await trigger.click()
    await expect(page).toHaveURL(contentsPath)
    await expect(dialog).toHaveCount(1)
    expect(await historyMutationCounts(page)).toEqual({ pushState: 0, replaceState: 1 })
    expect(await page.evaluate(() => window.history.length)).toBe(historyLengthBeforeOpen)
    expect(await readerRequests(request)).toEqual([])
    expect(await readerHitRequests(request)).toEqual([])

    expect(await page.evaluate(() => window.history.state.current)).toBe(contentsEncodedPath)
    await startHistoryMutationCounter(page)
    const historyLengthBeforeClose = await page.evaluate(() => window.history.length)

    if (closeMethod === "Escape") {
      await page.keyboard.press("Escape")
    } else if (closeMethod === "backdrop") {
      const backdrop = page.locator(".modal.chapters .modal-backdrop")
      if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) < 768) {
        await backdrop.dispatchEvent("touchend")
      } else {
        await backdrop.click({ position: { x: 5, y: 5 } })
      }
    } else {
      await dialog.getByRole("button", { name: "Stäng" }).click()
    }

    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(retainedPath)
    expect(await page.evaluate(() => ({
      current: window.history.state.current,
      search: window.location.search
    }))).toEqual({
      current: retainedEncodedPath,
      search: retainedQuery
    })
    await expect(
      page.locator(".reader-navigation").getByRole("link", { name: "Nästa sida" })
    ).toHaveAttribute(
      "href",
      nextHref
    )
    await expect.poll(async () => (await storedPageViews(page))[0]?.url)
      .toBe(retainedEncodedPath)
    await expect(trigger).toBeFocused()
    expect(await historyMutationCounts(page)).toEqual({ pushState: 0, replaceState: 1 })
    expect(await page.evaluate(() => window.history.length)).toBe(historyLengthBeforeClose)
    expect(await readerRequests(request)).toEqual([])
    expect(await readerHitRequests(request)).toEqual([])

    await expect(
      page.locator(".reader-navigation").getByRole("link", { name: "Nästa sida" })
    ).toHaveAttribute("href", nextHref)
  })
}

test("direct source information hydrates once without a client refetch", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const clientSourceInfoRequests: string[] = []
  const clientSimilarWorkRequests: string[] = []
  page.on("request", browserRequest => {
    if (new URL(browserRequest.url()).pathname.includes("/api/reader/source-info/")) {
      clientSourceInfoRequests.push(browserRequest.url())
    }
    if (/\/works\/[^/]+\/similar$/u.test(new URL(browserRequest.url()).pathname)) {
      clientSimilarWorkRequests.push(browserRequest.url())
    }
  })

  const response = await page.goto(`${readerPath}?bare&om-boken`, {
    waitUntil: "networkidle"
  })

  expect(response?.status()).toBe(200)
  const dialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(dialog).toHaveCount(1)
  await expect(dialog).toContainText("Doktor Glas. Roman")
  await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
  expect(clientSourceInfoRequests).toEqual([])
  expect(clientSimilarWorkRequests).toEqual([])
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/S%C3%B6derbergH/DoktorGlas/source-info",
    query: "?media_type=etext"
  }])
  expect(await similarWorkRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/lb1728740/similar",
    query: "?media_type=etext"
  }])
  expect(problems).toEqual([])
})

test("direct source information remains visible and linked without JavaScript", async ({
  browser
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "One no-JavaScript browser pass is sufficient")
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const blockedNuxtEntry = {
    errorText: "csp",
    method: "GET" as const,
    urlSuffix: "/node_modules/nuxt/dist/app/entry.async.js"
  }
  const problems = captureBrowserProblems(page, {
    requestFailures: [blockedNuxtEntry, blockedNuxtEntry]
  })
  const origin = `http://127.0.0.1:${process.env.LITTB_NUXT_TEST_PORT || 3000}`
  const response = await page.goto(`${origin}${readerPath}`, {
    waitUntil: "networkidle"
  })

  expect(response?.status()).toBe(200)
  const fallback = page.locator(".reader-context-ssr")
  await expect(fallback).toBeAttached()
  const expectedHref = `${readerEncodedPath}?om-boken`
  const title = fallback.locator("a").filter({ hasText: "Doktor Glas" })
  const sidebar = fallback.locator("a").filter({ hasText: "Mer om boken" })
  await expect(title).toHaveAttribute("href", expectedHref)
  await expect(sidebar).toHaveAttribute("href", expectedHref)

  const titleHref = await title.getAttribute("href")
  const directResponse = await page.goto(`${origin}${titleHref}`, { waitUntil: "networkidle" })
  expect(directResponse?.status()).toBe(200)
  await expect(page).toHaveURL(`${readerPath}?om-boken`)
  const dialog = page.locator('.modal.about[role="dialog"]')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator(".header .title")).toHaveText("Doktor Glas. Roman")
  await expect(dialog.locator(".header .author").getByRole("link", {
    name: "Hjalmar Söderberg"
  })).toHaveAttribute("href", "/författare/S%C3%B6derbergH")
  await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
  await expect.poll(() => page.evaluate(() => [
    getComputedStyle(document.documentElement).overflow,
    getComputedStyle(document.body).overflow
  ])).toContain("hidden")
  for (const corridor of ["#leftCorridor", "#mainview", "#rightCorridor"]) {
    await expect(page.locator(corridor)).toHaveCSS("filter", "blur(4px)")
  }
  expect(problems).toEqual([])
  await context.close()
})

test("source information entrances replace history and preserve raw query bytes", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const rawQuery = "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  const openPath = `${readerPath}${rawQuery}&om-boken`
  const openEncodedPath = `${readerEncodedPath}${rawQuery}&om-boken`
  await page.goto(`${readerPath}${rawQuery}`, { waitUntil: "networkidle" })
  await resetReader(request)

  const title = page.locator(".reader-context").getByRole("link", {
    name: "Doktor Glas"
  })
  const sidebar = page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Mer om boken" })
  const dialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(title).toHaveAttribute("href", openEncodedPath)
  await expect(sidebar).toHaveAttribute("href", openEncodedPath)
  const historyLength = await page.evaluate(() => window.history.length)

  await startHistoryMutationCounter(page)
  await title.click()
  await expect(page).toHaveURL(openPath)
  await expect(dialog).toHaveCount(1)
  expect(await historyMutationCounts(page)).toEqual({ pushState: 0, replaceState: 1 })
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength)
  await dialog.getByRole("button", { name: "Stäng" }).click()
  await expect(page).toHaveURL(`${readerPath}${rawQuery}`)
  await expect(title).toBeFocused()

  await sidebar.click()
  await expect(page).toHaveURL(openPath)
  await expect(dialog).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(`${readerPath}${rawQuery}`)
  await expect(sidebar).toBeFocused()

  await page.keyboard.press("o")
  await expect(page).toHaveURL(openPath)
  await expect(dialog).toHaveCount(1)
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", {
    bubbles: true,
    key: "F18"
  })))
  await expect(page).toHaveURL(`${readerPath}${rawQuery}`)
  await expect(dialog).toHaveCount(0)

  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(problems).toEqual([])
})

test("source information is focus-trapped and backdrop-close restores its trigger", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const trigger = page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Mer om boken" })
  await trigger.click()

  const dialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(dialog).toHaveCount(1)
  await expect(dialog).toBeFocused()
  await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
  await expect.poll(() => page.evaluate(() => [
    getComputedStyle(document.documentElement).overflow,
    getComputedStyle(document.body).overflow
  ])).toContain("hidden")
  for (const corridor of ["#leftCorridor", "#mainview", "#rightCorridor"]) {
    await expect(page.locator(corridor)).toHaveCSS("filter", "blur(4px)")
  }
  await expect.poll(() => page.evaluate(() => Boolean(
    document.activeElement?.closest('[role="dialog"]')
  ))).toBe(true)
  await page.keyboard.press("Shift+Tab")
  expect(await page.evaluate(() => Boolean(
    document.activeElement?.closest('[role="dialog"]')
  ))).toBe(true)

  const backdrop = page.locator(".modal.about .modal-backdrop")
  if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) < 768) {
    await backdrop.dispatchEvent("touchend")
  } else {
    await backdrop.click({ position: { x: 5, y: 5 } })
  }
  await expect(dialog).toHaveCount(0)
  await expect(page.locator("body")).not.toHaveClass(/\bmodal-open\b/u)
  await expect.poll(() => page.evaluate(() => [
    getComputedStyle(document.documentElement).overflow,
    getComputedStyle(document.body).overflow
  ])).not.toContain("hidden")
  for (const corridor of ["#leftCorridor", "#mainview", "#rightCorridor"]) {
    await expect(page.locator(corridor)).toHaveCSS("filter", "none")
  }
  await expect(trigger).toBeFocused()
  expect(problems).toEqual([])
})

test("source information wins over contents and closing it reveals contents", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPartsPath}?bare&innehall&om-boken`, {
    waitUntil: "networkidle"
  })

  const sourceDialog = page.getByRole("dialog", { name: "Om boken" })
  const contentsDialog = page.getByRole("dialog", { name: "Innehållsförteckning" })
  await expect(sourceDialog).toHaveCount(1)
  await expect(contentsDialog).toHaveCount(0)
  await sourceDialog.getByRole("button", { name: "Stäng" }).click()

  await expect(page).toHaveURL(`${readerPartsPath}?bare&innehall`)
  await expect(sourceDialog).toHaveCount(0)
  await expect(contentsDialog).toHaveCount(1)
  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(problems).toEqual([])
})

test("a failed source-information request is modal-local and retries on reopen", async ({
  page,
  request
}) => {
  const failedSourceInfoUrl =
    "/api/reader/source-info/S%C3%B6derbergH/DoktorGlas?media_type=etext"
  const problems = captureBrowserProblems(page, {
    httpErrors: [{
      method: "GET",
      status: 502,
      url: failedSourceInfoUrl
    }]
  })
  await request.put(`${fixture}/_source_info_failure`)
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const trigger = page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Mer om boken" })
  const dialog = page.getByRole("dialog", { name: "Om boken" })

  const failedResponse = page.waitForResponse(response => {
    const url = new URL(response.url())
    return `${url.pathname}${url.search}` === failedSourceInfoUrl
  })
  await trigger.click()
  expect((await failedResponse).status()).toBe(502)
  await expect(dialog.getByRole("alert")).toHaveText("Ett fel har uppstått.")
  await dialog.getByRole("button", { name: "Stäng" }).click()
  await request.delete(`${fixture}/_source_info_failure`)
  await trigger.click()

  await expect(dialog).toContainText("Doktor Glas. Roman")
  await expect(dialog.getByRole("alert")).toHaveCount(0)
  expect(await sourceInfoRequests(request)).toHaveLength(2)
  expect(problems).toEqual([])
})

test("source-information shortcuts yield while the contents dialog owns focus", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPartsPath}?innehall`, { waitUntil: "networkidle" })
  await resetReader(request)
  const contentsDialog = page.getByRole("dialog", { name: "Innehållsförteckning" })
  const contentsClose = contentsDialog.getByRole("button", { name: "Stäng" })
  await contentsClose.focus()
  await expect(contentsClose).toBeFocused()

  await page.keyboard.press("o")
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", {
    bubbles: true,
    key: "F18"
  })))

  await expect(page).toHaveURL(`${readerPartsPath}?innehall`)
  await expect(contentsDialog).toHaveCount(1)
  await expect(page.getByRole("dialog", { name: "Om boken" })).toHaveCount(0)
  expect(await sourceInfoRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("source information shows only its own loading state", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  await request.put(`${fixture}/_source_info_delays`, {
    data: { "SöderbergH|DoktorGlas": 400 }
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Mer om boken" }).click()

  const dialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(dialog.locator(".preloader")).toContainText("Hämtar")
  await expect(page.locator(".reader-primary-loading")).toHaveCount(0)
  await expect(dialog).toContainText("Doktor Glas. Roman")
  expect(problems).toEqual([])
})

test("external query removal closes source information without refetching Reader state", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const rawQuery = "?q=doktor%20glas&hit=1&owner=one&owner=two"
  await page.goto(`${readerPath}${rawQuery}`, { waitUntil: "networkidle" })
  await expect(page.locator("#w2_1.markee")).toHaveCount(1)
  const historyBefore = await rawStoredPageViews(page)
  await resetReader(request)

  const trigger = page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Mer om boken" })
  await trigger.click()
  await expect(page.getByRole("dialog", { name: "Om boken" })).toHaveCount(1)
  await navigateClient(page, `${readerEncodedPath}${rawQuery}`)
  await expect(page.getByRole("dialog", { name: "Om boken" })).toHaveCount(0)

  expect(await readerMetadataRequests(request)).toEqual([])
  expect(await readerHitRequests(request)).toEqual([])
  expect(await rawStoredPageViews(page)).toBe(historyBefore)
  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(problems).toEqual([])
})

test("Back and Forward restore cached source-information query state", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPath}?om-boken`, { waitUntil: "networkidle" })
  const dialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(dialog).toHaveCount(1)
  await resetReader(request)

  await navigateClient(page, `${readerEncodedPath}?owner=closed`)
  await expect(page).toHaveURL(`${readerPath}?owner=closed`)
  await expect(dialog).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL(`${readerPath}?om-boken`)
  await expect(dialog).toHaveCount(1)
  await page.goForward()
  await expect(page).toHaveURL(`${readerPath}?owner=closed`)
  await expect(dialog).toHaveCount(0)

  expect(await sourceInfoRequests(request)).toEqual([])
  expect(await readerMetadataRequests(request)).toEqual([])
  expect(await readerHitRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("normal source information renders exact actions and source metadata", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPath}?om-boken`, { waitUntil: "networkidle" })
  const dialog = page.getByRole("dialog", { name: "Om boken" })

  await expect(dialog.locator(".header .author a")).toHaveAttribute(
    "href",
    "/författare/S%C3%B6derbergH"
  )
  await expect(dialog.locator(".header .title")).toHaveText("Doktor Glas. Roman")
  await expect(dialog.locator(".sourcedesc")).toHaveText(
    "Albert Bonniers förlag, Stockholm 1905."
  )
  await expect(dialog.locator(".mediatypes").getByRole("link", { name: "etext" }))
    .toHaveAttribute("href", "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext")
  await expect(dialog.locator(".mediatypes").getByRole("link", { name: "faksimil" }))
    .toHaveAttribute("href", "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/faksimil")
  const epub = dialog.locator(".mediatypes_also").getByRole("link", { name: /epub/ })
  await expect(epub).toHaveAttribute("href", "/txt/epub/S%C3%B6derbergH_DoktorGlas.epub")
  await expect(epub).toHaveAttribute("download", "SöderbergH_DoktorGlas.epub")
  await expect(epub).toContainText("518 KB")
  await expect(dialog.getByRole("link", { name: "Libris" })).toHaveAttribute(
    "href",
    "https://libris.kb.se/bib/1728740"
  )
  await dialog.getByText("Hänvisa till detta verk", { exact: true }).click()
  await expect(dialog.locator("code")).toHaveText(
    "https://urn.kb.se/resolve?urn=urn:nbn:se:lb-lb1728740-etext"
  )
  await expect(dialog.locator(".col_right img")).toHaveAttribute(
    "srcset",
    "/txt/lb1728740/lb1728740_small.jpeg 1x, /txt/lb1728740/lb1728740_large.jpeg 2x"
  )
  const provenance = dialog.locator(".provenance")
  await expect(provenance.getByRole("link")).toHaveAttribute("href", "http://www.ub.gu.se/")
  await expect(provenance.locator("img")).toHaveAttribute(
    "src",
    "/red/bilder/gemensamt/gublogga.png"
  )
  await expect(provenance).toContainText(
    "Det exemplar som ligger till grund för Litteraturbankens utgåva tillhör " +
    "Göteborgs universitetsbibliotek (Litt. Sv.)."
  )
  await expect(dialog.locator(".license").getByRole("link")).toHaveAttribute(
    "href",
    "https://creativecommons.org/publicdomain/zero/1.0/deed.sv"
  )
  await expect(dialog.locator(".license")).toContainText("För e-boken gäller licensen CC0.")
  const similar = dialog.locator(".reader-similar-works")
  await expect(similar.getByRole("heading", { name: "Läs gärna också" })).toBeVisible()
  const rows = similar.locator("tbody tr")
  await expect(rows).toHaveCount(5)
  await expect(rows.locator("td:first-child")).toHaveText([
    "Boye", "Boye", "Boye", "Benedictsson", "Boye"
  ])
  await expect(rows.getByRole("link")).toHaveText([
    "Bebådelse [1941]",
    "Bebådelse [Samlade skrifter 8, 1948]",
    "Uppgörelser",
    "Modern [1888]",
    "Ur funktion"
  ])
  expect(await rows.getByRole("link").evaluateAll(links => (
    links.map(link => link.getAttribute("href"))
  ))).toEqual([
    "/f%C3%B6rfattare/BoyeK/titlar/Beb%C3%A5delse/sida/3/etext",
    "/f%C3%B6rfattare/BoyeK/titlar/Beb%C3%A5delse1948/sida/3/etext",
    "/f%C3%B6rfattare/BoyeK/titlar/Uppg%C3%B6relser/sida/3/etext",
    "/f%C3%B6rfattare/BenedictssonV/titlar/Modern/sida/1/etext",
    "/f%C3%B6rfattare/BoyeK/titlar/UrFunktion/sida/3/etext"
  ])
  await expect(similar).toHaveCSS("font-size", "14px")
  await expect(similar.locator("hr")).toHaveCSS("margin-top", "32px")
  await expect(similar.locator("hr")).toHaveCSS("margin-bottom", "16px")
  await expect(similar.getByRole("heading")).toHaveCSS("font-size", "18px")
  await expect(rows.locator("td:first-child").first()).toHaveCSS("text-align", "right")
  await expect(rows.locator("td:first-child").first()).toHaveCSS("padding-right", "16px")
  expect(problems).toEqual([])
})

test("empty and failed recommendations stay absent without failing source information", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${sparseReaderPath}?om-boken`, { waitUntil: "networkidle" })
  const sparseDialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(sparseDialog).toContainText("Glest verk")
  await expect(sparseDialog.locator(".reader-similar-works")).toHaveCount(0)
  expect(await similarWorkRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/lbSparse1/similar",
    query: "?media_type=etext"
  }])

  await request.delete(`${fixture}/_similar_work_requests`)
  await request.put(`${fixture}/_similar_work_failure`)
  await page.goto(`${readerPath}?om-boken`, { waitUntil: "networkidle" })
  const normalDialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(normalDialog).toContainText("Doktor Glas. Roman")
  await expect(normalDialog.getByRole("alert")).toHaveCount(0)
  await expect(normalDialog.locator(".reader-similar-works")).toHaveCount(0)
  expect(await similarWorkRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/lb1728740/similar",
    query: "?media_type=etext"
  }])
  await request.delete(`${fixture}/_similar_work_failure`)

  await request.delete(`${fixture}/_similar_work_requests`)
  await request.put(`${fixture}/_similar_work_malformed`)
  await page.goto(`${readerPath}?om-boken`, { waitUntil: "networkidle" })
  const malformedDialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(malformedDialog).toContainText("Doktor Glas. Roman")
  await expect(malformedDialog.getByRole("alert")).toHaveCount(0)
  await expect(malformedDialog.locator(".reader-similar-works")).toHaveCount(0)
  expect(await similarWorkRequests(request)).toHaveLength(1)
  await request.delete(`${fixture}/_similar_work_malformed`)
  expect(problems).toEqual([])
})

test("drama source information renders drama facts, attributions, and exact targets", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${dramaReaderPath}?om-boken`, { waitUntil: "networkidle" })
  const dialog = page.getByRole("dialog", { name: "Om boken" })

  await expect(page.locator(".reader-context .subnav a").filter({
    hasText: "Mer om pjäsen"
  })).toBeVisible()
  const dramawebbenLogo = page.locator(".reader-context .subnav .dw_logo")
  await expect(dramawebbenLogo).toHaveAttribute("alt", "Dramawebben logotyp")
  await expect(dramawebbenLogo.locator("..")).toHaveAttribute("href", "/dramawebben")
  await expect(dramawebbenLogo).toHaveCSS("margin-left", "-23px")
  await expect(dramawebbenLogo).toHaveCSS("opacity", "0.8")
  await expect(dramawebbenLogo).toHaveCSS("height", "70px")
  await expect(dialog.locator(".dw_logo")).toHaveCount(0)

  const slider = page.locator(".reader-context .rzslider")
  const sliderGeometry = await slider.evaluate(element => {
    const track = element.querySelector<HTMLElement>(".rz-bar:not(.rz-selection)")!
    const selection = element.querySelector<HTMLElement>(".rz-selection")!
    const pointer = element.querySelector<HTMLElement>(".rz-pointer-min")!
    return {
      selectionRight: selection.getBoundingClientRect().right,
      pointerCenter: pointer.getBoundingClientRect().left +
        pointer.getBoundingClientRect().width / 2,
      pointerRight: pointer.getBoundingClientRect().right,
      trackRight: track.getBoundingClientRect().right
    }
  })
  expect(Math.abs(sliderGeometry.selectionRight - sliderGeometry.pointerCenter)).toBeLessThanOrEqual(1)
  expect(Math.abs(sliderGeometry.pointerRight - sliderGeometry.trackRight)).toBeLessThanOrEqual(1)
  await expect(dialog.locator(".header .author a"))
    .toHaveAttribute("href", "/författare/Alml%C3%B6fN")
  await expect(dialog.locator(".sourcedesc")).toHaveText("Stockholm, 1871.")
  await expect(dialog).toContainText("Dramawebbens redaktion")
  await expect(dialog.locator(".workintro")).toContainText("En komedi i fem akter.")
  await expect(dialog).toContainText("Ulrika Lindgren")
  await expect(dialog.locator(".mediatypes").getByRole("link", { name: "etext" }))
    .toHaveAttribute("href", "/författare/Alml%C3%B6fN/titlar/Affarer/sida/-2/etext")
  await expect(dialog.locator(".mediatypes").getByRole("link", { name: "faksimil" }))
    .toHaveAttribute("href", "/författare/Alml%C3%B6fN/titlar/Affarer/sida/-2/faksimil")
  await expect(dialog.locator(".dramaweb table")).toContainText("Antal akter")
  await expect(dialog.locator(".dramaweb table")).toContainText("5")
  const roles = dialog.locator(".dramaweb > div").filter({ hasText: "Rollista" }).locator("> div")
  await expect(roles).toHaveCount(1)
  await expect(roles.locator(":scope > i")).toHaveText("Direktören")
  await expect(roles.locator(":scope > br")).toHaveCount(1)
  await expect(roles.locator(":scope > span.role")).toHaveText("Anna")
  await expect(roles.locator(":scope > span:not(.role)")).toHaveCount(0)
  await expect(roles).toContainText("Direktören, grosshandlare")
  await expect(dialog.locator(".dramaweb").getByRole("link", { name: "Kungliga teatern" }))
    .toHaveAttribute("href", "https://example.test/teater")
  const epub = dialog.locator(".mediatypes_also").getByRole("link", { name: /epub/ })
  const pdf = dialog.locator(".mediatypes_also").getByRole("link", { name: /pdf/ })
  await expect(dialog.locator(".mediatypes_also")).toHaveText(
    "Ladda ner epub (65536 MB) eller pdf (4096 MB)"
  )
  await expect(epub).toHaveAttribute("href", "/txt/epub/Alml%C3%B6fN_Affarer.epub")
  await expect(epub).toHaveAttribute("download", "AlmlöfN_Affarer.epub")
  await expect(epub).toContainText("65536 MB")
  await expect(pdf).toHaveAttribute("href", "/export/faksimil/lb31230.pdf")
  await expect(pdf).toHaveAttribute("download", "AlmlöfN_Affarer.pdf")
  await expect(pdf).toContainText("4096 MB")
  await dialog.getByText("Hänvisa till detta verk", { exact: true }).click()
  await expect(dialog.locator("code")).toHaveText(
    "https://urn.kb.se/resolve?urn=urn:nbn:se:lb-lb31230-faksimil"
  )
  await expect(dialog.locator(".provenance")).toHaveCount(2)
  await expect(dialog.locator(".license").getByRole("link", { name: "Kungl. biblioteket" }))
    .toHaveAttribute("href", "http://www.kb.se/")
  await expect(dialog.locator(".license")).toContainText(
    "Vid användning ber vi att du hänvisar till Kungl. biblioteket – Dramawebben och Litteraturbanken.se."
  )
  expect(problems).toEqual([])
})

test("sparse source information omits unavailable optional sections", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${sparseReaderPath}?om-boken`, { waitUntil: "networkidle" })
  const dialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(dialog.locator(".header .title")).toHaveText("Glest verk")
  await expect(dialog.locator(".header .author")).toBeEmpty()
  await expect(dialog.locator(".sourcedesc, .workintro, .provenance, .license"))
    .toHaveCount(0)
  await expect(dialog.locator(".mediatypes, .mediatypes_also, .urn"))
    .toHaveCount(0)
  await expect(dialog.locator(".errata")).toHaveCount(1)
  await expect(dialog.locator(".errata_table tbody tr")).toHaveCount(0)
  await expect(dialog.getByText(
    "Inga ändringar har gjorts mot orginalet.",
    { exact: true }
  )).toHaveCount(0)
  await expect(dialog.getByText("undefined")).toHaveCount(0)
  expect(problems).toEqual([])
})

test("long errata toggles between the first eight and all rows with exact role copy", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${longErrataReaderPath}?om-boken`, { waitUntil: "networkidle" })
  const dialog = page.getByRole("dialog", { name: "Om boken" })
  const sidebarAuthorLink = page.locator(".reader-context > div").first()
    .locator(".author > a")
  expect(await sidebarAuthorLink.evaluate(element => element.innerHTML)).toBe(
    'Rita Redaktör <span class="authortype">red.</span>'
  )
  const authorLink = dialog.locator(".header .author > a")
  const role = authorLink.locator(":scope > .authortype")
  await expect(authorLink).toContainText("Rita Redaktör")
  expect(await authorLink.evaluate(element => element.innerHTML)).toBe(
    'Rita Redaktör <span class="authortype">red.</span>'
  )
  await expect(role).toHaveText("red.")
  await expect(role).not.toContainText(",")
  await expect(dialog.locator(".header .author > .authortype")).toHaveCount(0)
  const rows = dialog.locator(".errata_table tbody tr")
  await expect(rows).toHaveCount(8)
  await expect(rows.first().locator("td")).toHaveText(["sid. 1", "rättning 1"])
  await expect(rows.last().locator("td")).toHaveText(["sid. 8", "rättning 8"])
  await dialog.getByRole("button", { name: "Visa fler" }).click()
  await expect(rows).toHaveCount(10)
  await expect(rows.last().locator("td")).toHaveText(["sid. 10", "rättning 10"])
  await dialog.getByRole("button", { name: "Visa färre" }).click()
  await expect(rows).toHaveCount(8)
  expect(problems).toEqual([])
})

test("empty errata hides the legacy correction copy and controls", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${emptyErrataReaderPath}?om-boken`, { waitUntil: "networkidle" })
  const dialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(dialog.locator(".header .title")).toHaveText("Tom errata")
  await expect(dialog.getByText(
    "I etexten har följande ändringar gjorts mot originalet:",
    { exact: true }
  )).toHaveCount(0)
  await expect(dialog.locator(".errata_table tbody tr")).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: /Visa (fler|färre)/ })).toHaveCount(0)
  expect(problems).toEqual([])
})

test("contents rows use surnames and selecting a nested part pushes its raw target", async ({
  page,
  request
}) => {
  const selectedReaderRequests: string[] = []
  const selectedHitRequests: string[] = []
  page.on("request", browserRequest => {
    const pathname = new URL(browserRequest.url()).pathname
    if (pathname.startsWith("/api/reader/")) {
      selectedReaderRequests.push(browserRequest.url())
    }
    if (pathname.includes("/works/lb-reader-doktor-glas-parts/search-hits")) {
      selectedHitRequests.push(browserRequest.url())
    }
  })
  const retainedQuery =
    "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F" +
    "&q=inga&hit=0&storlek=3"
  const rawQuery = `${retainedQuery}&innehall`
  await page.goto(`${readerPartsPath}${rawQuery}`, { waitUntil: "networkidle" })
  const dialog = page.getByRole("dialog", { name: "Innehållsförteckning" })
  await expect(dialog.locator(".header .author")).toHaveText("Hjalmar Söderberg")
  await expect(dialog.locator(".header .title")).toContainText(
    "Doktor Glas delar. Roman (1905)"
  )
  const rows = dialog.locator(".part_menu > li")
  await expect(rows).toHaveCount(5)
  await expect(rows.nth(0)).toHaveAttribute("title", "Den yttre delen")
  await expect(rows.nth(0).locator(".author")).toHaveText("Söderberg")
  await expect(rows.nth(1).locator(".author")).toHaveText("Mörike")
  await expect(rows.nth(2).locator(".author")).toHaveText(["Rilke, ", "Shelley"])
  await expect(rows.nth(2).getByRole("link", { name: "Rilke" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/RilkeRM")
  await expect(rows.nth(2).getByRole("link", { name: "Shelley" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/ShelleyPB")
  await resetReader(request)
  selectedReaderRequests.length = 0
  selectedHitRequests.length = 0
  await startHistoryMutationCounter(page)
  const historyLength = await page.evaluate(() => window.history.length)

  await rows.nth(1).getByRole("link", { name: "Mellandelen" }).click()
  const selectedPath =
    `/författare/SöderbergH/titlar/DoktorGlasParts/sida/-3/etext${retainedQuery}`
  const selectedEncodedPath =
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-3/etext" +
    retainedQuery
  await expect(page).toHaveURL(selectedPath)
  expect(await page.evaluate(() => window.history.state.current))
    .toBe(selectedEncodedPath)
  await expect(
    page.locator(".reader-navigation").getByRole("link", { name: "Nästa sida" })
  ).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-2/etext" +
    retainedQuery
  )
  await expect.poll(async () => (await storedPageViews(page))[0]?.url).toBe(
    selectedEncodedPath
  )
  expect(await historyMutationCounts(page)).toEqual({ pushState: 1, replaceState: 1 })
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength + 1)
  expect(selectedReaderRequests).toHaveLength(1)
  expect(selectedHitRequests).toHaveLength(1)
  expect(await readerHitRequests(request)).toHaveLength(1)

  const contentsEncodedPath =
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-1/etext" +
    rawQuery
  await page.goBack()
  await expect(page).toHaveURL(`${readerPartsPath}${rawQuery}`)
  await expect(dialog).toHaveCount(1)
  expect(await page.evaluate(() => window.history.state.current))
    .toBe(contentsEncodedPath)
  await page.goForward()
  await expect(page).toHaveURL(selectedPath)
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => window.history.state.current))
    .toBe(selectedEncodedPath)
})

test("part gaps and page boundaries remove metadata and disabled focus targets", async ({
  page
}) => {
  await page.goto(
    "/författare/SöderbergH/titlar/DoktorGlasParts/sida/2/etext",
    { waitUntil: "networkidle" }
  )
  await expect(page.locator(".reader-context .current_part .header")).toHaveCount(0)
  await expect(page.locator(".reader-context .current_part .navtitle")).toHaveCount(0)
  await expect(page.locator('meta[name="part"]')).toHaveCount(0)

  await navigateClient(
    page,
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-3/etext"
  )
  const first = page.locator(".reader-navigation").getByText("Gå till första sidan", {
    exact: true
  })
  await expect(first).not.toHaveAttribute("href", /.+/)
  await expect(first).toHaveAttribute("tabindex", "-1")
  await expect(page.locator(".reader-context .current_part .header")).toHaveText(
    "Eduard Mörike"
  )

  await navigateClient(
    page,
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/5/etext"
  )
  const last = page.locator(".reader-navigation").getByText("Gå till sista sidan", {
    exact: true
  })
  await expect(last).not.toHaveAttribute("href", /.+/)
  await expect(last).toHaveAttribute("tabindex", "-1")
})

test("keyboard paging follows page and part targets without stealing other shortcuts", async ({
  page
}) => {
  const rawQuery = "?bare&empty=&repeat=%2f&repeat=%2F"
  await page.goto(`${readerPath}${rawQuery}`, { waitUntil: "networkidle" })

  await page.keyboard.press("ArrowRight")
  await expect(page).toHaveURL(
    `/författare/SöderbergH/titlar/DoktorGlas/sida/-1/etext${rawQuery}`
  )
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")

  await page.keyboard.press("ArrowRight")
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await page.keyboard.press("ArrowLeft")
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 3")

  await page.evaluate(() => {
    const spacer = document.createElement("div")
    spacer.id = "keyboard-horizontal-spacer"
    spacer.style.cssText = "position:absolute;left:0;top:0;width:3000px;height:1px"
    document.body.append(spacer)
    window.scrollTo(500, 0)
  })
  await expect.poll(() => page.evaluate(() => window.scrollX)).toBeGreaterThan(10)

  await page.keyboard.press("ArrowRight")
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 3")
  await page.keyboard.press("Shift+ArrowRight")
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")

  await navigateClient(
    page,
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-1/etext"
  )
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 9")
  await page.keyboard.press("Alt+ArrowLeft")
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 9")

  await navigateClient(
    page,
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-1/etext"
  )
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 9")
  await page.keyboard.press("Alt+ArrowRight")
  await expect(page.locator(".reader-page-position")).toHaveText("3 av 9")

  await navigateClient(
    page,
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-1/etext"
  )
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 9")
  await page.keyboard.press("Alt+Shift+ArrowRight")
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 9")
  await page.keyboard.press("Control+ArrowRight")
  await page.keyboard.press("Meta+ArrowLeft")
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 9")
})

test("legacy n/f and d/m keyboard shortcuts push page and part history", async ({ page }) => {
  const rawQuery = "?bare&repeat=%2f&repeat=%2F"
  await page.goto(`${readerPath}${rawQuery}`, { waitUntil: "networkidle" })

  await page.keyboard.press("n")
  await expect(page).toHaveURL(
    `/författare/SöderbergH/titlar/DoktorGlas/sida/-1/etext${rawQuery}`
  )
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await page.keyboard.press("f")
  await expect(page).toHaveURL(
    `/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext${rawQuery}`
  )

  await navigateClient(
    page,
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-1/etext"
  )
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 9")
  await page.keyboard.press("d")
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 9")
  await page.goBack()
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 9")
  await page.keyboard.press("m")
  await expect(page.locator(".reader-page-position")).toHaveText("3 av 9")
  await page.goBack()
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 9")
})

test("Alt+Shift paging uses exact numeric indexes across a sparse page map", async ({
  page
}) => {
  await page.goto(
    "/författare/SöderbergH/titlar/SparseKeyboardReader/sida/2/etext",
    { waitUntil: "networkidle" }
  )
  await expect(page.locator(".reader-page-position")).toHaveText("2 av 3")

  await page.keyboard.press("Alt+Shift+ArrowRight")
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/SparseKeyboardReader/sida/12/etext"
  )
  await expect(page.locator(".reader-page-position")).toHaveText("12 av 3")

  await page.keyboard.press("Alt+Shift+ArrowRight")
  await expect(page.locator(".reader-page-position")).toHaveText("12 av 3")

  await page.keyboard.press("Alt+Shift+ArrowLeft")
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/SparseKeyboardReader/sida/2/etext"
  )
})

test("keyboard paging is guarded by editors and dialogs and is removed on unmount", async ({
  page
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const initialUrl = page.url()
  const goto = page.locator(".reader-navigation form.goto")
  await goto.getByRole("link", { name: /Gå till sida/ }).click()
  await goto.getByRole("textbox").focus()
  await page.keyboard.press("ArrowRight")
  await expect(page).toHaveURL(initialUrl)

  for (const kind of ["textarea", "select", "contenteditable"] as const) {
    await page.evaluate(activeKind => {
      document.querySelector("#keyboard-editable-probe")?.remove()
      const element = activeKind === "contenteditable"
        ? document.createElement("div")
        : document.createElement(activeKind)
      element.id = "keyboard-editable-probe"
      if (activeKind === "contenteditable") element.contentEditable = "true"
      document.body.append(element)
      element.focus()
    }, kind)
    await page.keyboard.press("ArrowRight")
    await expect(page).toHaveURL(initialUrl)
  }

  await page.evaluate(() => document.querySelector("#keyboard-editable-probe")?.remove())
  await page.keyboard.press("o")
  await expect(page.getByRole("dialog", { name: "Om boken", exact: true })).toBeVisible()
  await page.keyboard.press("ArrowRight")
  await expect(page).toHaveURL(/\/sida\/-2\/etext\?om-boken$/u)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Om boken", exact: true })).toHaveCount(0)

  await navigateClient(page, "/bibliotek")
  await expect(page).toHaveURL("/bibliotek")
  await expect(page.locator('[data-library-mounted="true"]')).toBeAttached()
  await expect(page.locator(".reader_main")).toHaveCount(0)
  await page.keyboard.press("Shift+ArrowRight")
  await page.waitForTimeout(100)
  await expect(page).toHaveURL("/bibliotek")
})

test("goto accepts only exact page names and preserves the raw destination query", async ({
  page
}) => {
  const rawQuery = "?bare&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  await page.goto(`${readerPath}${rawQuery}`, { waitUntil: "networkidle" })
  const goto = page.locator(".reader-navigation form.goto")
  await goto.getByRole("link", { name: /Gå till sida/ }).click()
  const input = goto.getByRole("textbox")
  await expect(input).toHaveAttribute("aria-label", "Gå till sida")
  await input.fill(" -1")
  await input.press("Enter")
  await expect(page).toHaveURL(
    `${readerPath}?bare&plus=a+b&percent=a+b&repeat=/&repeat=/`
  )
  await expect(goto.getByRole("status")).toHaveText("Sidan finns inte i verket.")

  await input.fill("-1")
  await input.press("Enter")
  await expect(page).toHaveURL(
    `/författare/SöderbergH/titlar/DoktorGlas/sida/-1/etext${rawQuery}`
  )
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await expect.poll(async () => (await storedPageViews(page))[0]?.url).toBe(
    `${storedNextReaderPath}${rawQuery}`
  )
})

test("direct and hash-only fragments preserve the server-captured raw Reader identity", async ({
  page
}) => {
  const rawQuery = "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  await page.goto(`${readerPath}${rawQuery}#direct-fragment`, {
    waitUntil: "networkidle"
  })

  const next = page.getByRole("link", { name: "Nästa sida" })
  const nextPath =
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"
  await expect(next).toHaveAttribute("href", `${nextPath}${rawQuery}#direct-fragment`)
  await expect.poll(async () => (await storedPageViews(page))[0]?.url).toBe(
    `${storedReaderPath}${rawQuery}#direct-fragment`
  )

  await navigateClient(page, `${readerEncodedPath}${rawQuery}#changed-fragment`)
  await expect(next).toHaveAttribute("href", `${nextPath}${rawQuery}#changed-fragment`)
  await expect.poll(async () => (await storedPageViews(page))[0]?.url).toBe(
    `${storedReaderPath}${rawQuery}#changed-fragment`
  )
})

test("contents-only query transitions reuse hit state and leave Reader history untouched", async ({
  page,
  request
}) => {
  const rawQuery = "?q=doktor%20glas&hit=1&x=one&x=two"
  await page.goto(`${readerPath}${rawQuery}&innehall`, { waitUntil: "networkidle" })
  await expect(page.locator("#w2_1.markee")).toHaveCount(1)
  await expect.poll(async () => (await storedPageViews(page))[0]?.url).toBe(
    `${storedReaderPath}${rawQuery}`
  )
  const historyBefore = await rawStoredPageViews(page)
  await resetReader(request)

  await navigateClient(page, `${readerEncodedPath}${rawQuery}`)
  await expect(page).toHaveURL(`${readerPath}${rawQuery}`)
  await expect(page.locator("#w2_1.markee")).toHaveCount(1)
  expect(await readerHitRequests(request)).toEqual([])
  expect(await readerMetadataRequests(request)).toEqual([])
  expect(await rawStoredPageViews(page)).toBe(historyBefore)

  await navigateClient(page, `${readerEncodedPath}${rawQuery}&innehall`)
  await expect(page).toHaveURL(`${readerPath}${rawQuery}&innehall`)
  expect(await readerHitRequests(request)).toEqual([])
  expect(await readerMetadataRequests(request)).toEqual([])
  expect(await rawStoredPageViews(page)).toBe(historyBefore)

  await navigateClient(page, `${readerEncodedPath}?q=doktor%20glas&hit=2&x=one&x=two`)
  await expect(page.locator("#search_nav")).toContainText("Träff 3, sida -2")
  await expect.poll(async () => (await readerHitRequests(request)).length).toBe(1)
  await expect.poll(async () => (await storedPageViews(page))[0]?.url).toBe(
    `${storedReaderPath}?q=doktor%20glas&hit=2&x=one&x=two`
  )
})

test("Library EPUB shorthand navigation shows only its preloader and replaces History", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const shorthandDocumentRequests: string[] = []
  await request.put(`${fixture}/_reader_metadata_delays`, {
    data: { DoktorGlas: 300 }
  })
  await page.goto("/bibliotek?visa=epub&sort=popularitet", { waitUntil: "networkidle" })
  page.on("request", browserRequest => {
    const url = new URL(browserRequest.url())
    if (
      browserRequest.resourceType() === "document" &&
      url.pathname === readerShorthandRouterPath
    ) {
      shorthandDocumentRequests.push(browserRequest.url())
    }
  })

  const title = page.locator("[data-library-epub-title]").filter({ hasText: "Doktor Glas" })
  await expect(title).toHaveCount(1)
  await expect(title).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/etext?om-boken"
  )
  await title.click()

  await expect(page).toHaveURL(`${readerShorthandPath}?om-boken`)
  await expect(page.locator(".searching > .preloader")).toBeVisible()
  await expect(page.locator(".searching > :not(.preloader)")).toHaveCount(0)
  await expect(page.locator("[data-library-epub-row], .reader_main")).toHaveCount(0)
  expect(shorthandDocumentRequests).toEqual([])

  await expect(page).toHaveURL(`${readerPath}?om-boken`)
  await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL("/bibliotek?visa=epub&sort=popularitet")
  await expect(page.locator('[data-library-sort="popularitet"]')).toHaveClass(/active/)
  await expect(page.getByRole("link", { name: "Doktor Glas" })).toBeVisible()
  expect(problems).toEqual([])
})

test("client shorthand navigation preserves the raw route fullPath query", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const rawQuery = "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  const normalizedQuery = "?bare&empty=&plus=a+b&percent=a+b&repeat=/&repeat=/"
  await request.put(`${fixture}/_reader_metadata_delays`, {
    data: { DoktorGlas: 200 }
  })
  await page.goto("/bibliotek", { waitUntil: "networkidle" })

  await navigateClient(page, `${readerShorthandRouterPath}${rawQuery}`)
  await expect(page).toHaveURL(`${readerShorthandPath}${rawQuery}`)
  await expect(page.locator(".searching > .preloader")).toBeVisible()
  await expect(page).toHaveURL(`${readerPath}${rawQuery}`)
  await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
  expect(await page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        currentRoute: { value: {
          fullPath: string
          name: unknown
          params: Record<string, unknown>
          path: string
          query: Record<string, unknown>
        } }
        options: { history: { location: string } }
      } } } }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    return router && {
      historyLocation: router.options.history.location,
      historyStateCurrent: window.history.state.current,
      fullPath: router.currentRoute.value.fullPath,
      name: router.currentRoute.value.name,
      params: router.currentRoute.value.params,
      path: router.currentRoute.value.path,
      query: router.currentRoute.value.query,
      search: window.location.search
    }
  })).toEqual({
    historyLocation: `${readerPublicCanonicalPath}${rawQuery}`,
    historyStateCurrent: `${readerPublicCanonicalPath}${rawQuery}`,
    fullPath: `${readerEncodedPath}${normalizedQuery}`,
    name: "författare-author-titlar-title-sida-page-mediatype",
    params: {
      author: "SöderbergH",
      title: "DoktorGlas",
      page: "-2",
      mediatype: "etext"
    },
    path: readerEncodedPath,
    query: {
      bare: null,
      empty: "",
      plus: "a b",
      percent: "a b",
      repeat: ["/", "/"]
    },
    search: rawQuery
  })

  await navigateClient(page, "/bibliotek")
  await expect(page).toHaveURL("/bibliotek")
  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(`${readerPath}${rawQuery}`)
  await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
  expect(problems).toEqual([])
})

test("a late shorthand resolver cannot leave the route that replaced it", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await request.put(`${fixture}/_reader_metadata_delays`, {
    data: { DoktorGlas: 350 }
  })
  await page.goto("/", { waitUntil: "networkidle" })
  const resolverResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname.endsWith(
      "/api/reader/resolve/S%C3%B6derbergH/DoktorGlas/etext"
    )
  )

  await navigateClient(page, readerShorthandRouterPath)
  await expect(page).toHaveURL(readerShorthandPath)
  await expect(page.locator(".searching > .preloader")).toBeVisible()
  await expect.poll(async () => (await readerRequests(request)).length).toBe(1)
  await navigateClient(page, "/bibliotek")

  await expect(page).toHaveURL("/bibliotek")
  await expect(page.locator("[data-library-result]")).toHaveCount(3)
  expect((await resolverResponse).status()).toBe(200)
  await expect(page).toHaveURL("/bibliotek")
  await expect(page.locator("[data-library-result]")).toHaveCount(3)
  expect(problems).toEqual([])
})

test("a superseded shorthand transition cannot rewrite a newer raw query", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  const oldQuery = "?owner=old&space=old%20value&slash=%2f"
  const winningQuery = "?owner=new&space=new%20value&slash=%2F"
  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  await page.evaluate(canonicalRouteName => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        beforeResolve: (guard: (to: { name: unknown }) => unknown) => void
        afterEach: (guard: (
          to: { fullPath: string },
          from: unknown,
          failure: unknown
        ) => void) => void
      } } } }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    const state = {
      completed: false,
      heldFullPath: "",
      started: false,
      release: undefined as undefined | (() => void)
    }
    Object.assign(window, { __readerShorthandGate: state })
    let held = false
    router.beforeResolve(to => {
      if (held || to.name !== canonicalRouteName) return
      held = true
      state.started = true
      state.heldFullPath = (to as { fullPath: string }).fullPath
      return new Promise<void>(resolve => {
        state.release = resolve
      })
    })
    router.afterEach((to, _from, failure) => {
      if (failure && to.fullPath === state.heldFullPath) state.completed = true
    })
  }, "författare-author-titlar-title-sida-page-mediatype")

  await navigateClient(page, `${readerShorthandRouterPath}${oldQuery}`)
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & {
    __readerShorthandGate?: { started: boolean }
  }).__readerShorthandGate?.started))).toBe(true)

  await navigateClient(page, `${readerShorthandRouterPath}${winningQuery}`)
  await expect(page).toHaveURL(`${readerPath}${winningQuery}`)
  await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
  await page.evaluate(() => {
    const gate = (window as typeof window & {
      __readerShorthandGate?: { release?: () => void }
    }).__readerShorthandGate
    if (!gate?.release) throw new Error("Reader navigation gate was not installed")
    gate.release()
  })

  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & {
    __readerShorthandGate?: { completed: boolean }
  }).__readerShorthandGate?.completed))).toBe(true)
  await expect(page).toHaveURL(`${readerPath}${winningQuery}`)
  expect(await page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        options: { history: { location: string } }
      } } } }
    }
    return root.__vue_app__?.config.globalProperties.$router.options.history.location
  })).toBe(`${readerPublicCanonicalPath}${winningQuery}`)
  expect(problems).toEqual([])
})

test("hydrates one runtime e-text page with ordinary reader navigation", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const clientReaderRequests: string[] = []
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/reader/")) {
      clientReaderRequests.push(request.url())
    }
  })
  expect(await readerRequests(request)).toEqual([])
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const warmupRequests = await readerRequests(request)
  for (const readerAsset of [
    "/red/css/etext.css",
    "/txt/css/lb-reader-doktor-glas-etext.css",
    "/bilder/ornament/reader-fixture.png"
  ]) {
    expect(warmupRequests.some(path => path.startsWith(readerAsset))).toBe(true)
  }

  await resetReader(request)
  clientReaderRequests.length = 0
  problems.length = 0
  expect(await readerRequests(request)).toEqual([])

  const response = await page.reload({ waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)

  await expect(page).toHaveTitle("Doktor Glas sida -2 etext | Litteraturbanken")
  await expect(page.locator("body")).toHaveClass("focus page-reading ready")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("HJALMAR SÖDERBERG")
  await expect(page.locator(".reader-context")).toContainText("Doktor Glas (1905)")
  await expect(page.locator(".reader-context .current_part .header a"))
    .not.toHaveAttribute("aria-label")
  await expect(page.getByRole("link", { name: "Hjalmar Söderberg" }).first()).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH"
  )
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 3")
  await expect(page.getByRole("link", { name: "Föregående sida" })).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext"
  )
  await expect(page.getByRole("link", { name: "Nästa sida" })).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"
  )
  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(1)
  await expect(page.locator('link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'))
    .toHaveCount(1)

  const recorded = await readerRequests(request)
  const metadata = recorded.filter(path => path.startsWith("/api/get_work_info?"))
  const pages = recorded.filter(path => path.startsWith(
    "/txt/lb-reader-doktor-glas/res_00002.html?"
  ))
  expect(metadata).toHaveLength(1)
  expect(new URL(metadata[0]!, fixture).searchParams.get("authorid")).toBe("SöderbergH")
  expect(new URL(metadata[0]!, fixture).searchParams.get("titlepath")).toBe("DoktorGlas")
  expect(pages).toHaveLength(1)
  expect(new URL(pages[0]!, fixture).searchParams.get("username")).toBe("app")
  expect(clientReaderRequests).toEqual([])
  expect(problems).toEqual([])
})

test("page navigation preserves each page's horizontal history position", async ({
  isMobile,
  page
}) => {
  test.skip(isMobile, "the responsive reader has no horizontal page overflow")
  await page.setViewportSize({ width: 800, height: 900 })
  await page.route("**/api/reader/**/-1/etext", async route => {
    await new Promise(resolve => setTimeout(resolve, 800))
    const response = await route.fetch()
    const reader = await response.json() as { html: string }
    reader.html += '<div data-history-overflow style="width:3000px;height:1200px"></div>'
    await route.fulfill({ response, json: reader })
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    const spacer = document.createElement("div")
    spacer.id = "history-vertical-spacer"
    spacer.style.cssText = "position:absolute;left:0;top:0;width:1px;height:1400px"
    document.body.append(spacer)
  })

  const maximumLeft = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(maximumLeft).toBeGreaterThanOrEqual(200)
  expect(await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  )).toBeGreaterThanOrEqual(150)

  await page.evaluate(() => window.scrollTo(100, 150))
  await expect.poll(() => page.evaluate(() => [window.scrollX, window.scrollY]))
    .toEqual([100, 150])

  await page.getByRole("link", { name: "Nästa sida" }).evaluate(link => {
    ;(link as HTMLAnchorElement).click()
  })
  await expect(page).toHaveURL(/\/sida\/-1\/etext$/)
  await page.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: {
            $router: {
              beforeEach: (guard: () => false) => () => void
              push: (path: string) => Promise<void>
            }
          }
        }
      }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    const removeGuard = router.beforeEach(() => {
      removeGuard()
      return false
    })
    await router.push("/bibliotek")
  })
  await expect(page).toHaveURL(/\/sida\/-1\/etext$/)
  await expect.poll(() => page.evaluate(() => [window.scrollX, window.scrollY]))
    .toEqual([100, 0])

  await page.evaluate(() => window.scrollTo(200, 200))
  await expect.poll(() => page.evaluate(() => [window.scrollX, window.scrollY]))
    .toEqual([200, 200])

  await page.goBack()
  await expect(page).toHaveURL(readerPath)
  await expect.poll(() => page.evaluate(() => [window.scrollX, window.scrollY]))
    .toEqual([100, 150])

  await page.goForward()
  await expect(page).toHaveURL(/\/sida\/-1\/etext$/)
  await expect.poll(() => page.evaluate(() => [window.scrollX, window.scrollY]))
    .toEqual([200, 200])
})

test("hydrates a fixed-width faksimil scan with legacy size and rotation controls", async ({
  page,
  request
}, testInfo) => {
  const problems = captureBrowserProblems(page)
  const response = await page.goto(facsimilePath, { waitUntil: "networkidle" })

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(
    "Gösta Berlings saga sida 3 faksimil | Litteraturbanken"
  )
  const image = page.locator("img.faksimil")
  await expect(image).toHaveAttribute("src", facsimileImagePath)
  await expect(image).toHaveAttribute(
    "srcset",
    `${facsimileImagePath} 1x, ${facsimileRetinaPath} 2x`
  )
  await expect.poll(() => image.evaluate(element => {
    const scan = element as HTMLImageElement
    return scan.complete && scan.naturalWidth > 0
  })).toBe(true)
  await expect(image).toHaveCSS("width", "625px")
  await expect(page.locator(".img_area")).toHaveCSS("width", "625px")
  await expect(page.locator(".reader_main")).toHaveClass(/type-faksimil/)

  const sizeControls = page.locator("#toolkit .reader-facsimile-size-controls")
  await expect(sizeControls).toContainText("Ändra storlek")
  await expect(sizeControls.getByRole("button", { name: "Mindre" })).toBeEnabled()
  await expect(sizeControls.getByRole("button", { name: "Större" })).toBeEnabled()

  const rotationControls = page.locator("#toolkit .reader-facsimile-rotation-controls")
  if (testInfo.project.name === "mobile-chromium") {
    await expect(rotationControls).toBeHidden()
  } else {
    await expect(rotationControls).toBeVisible()
    await rotationControls.getByRole("button", { name: "Höger" }).click()
    await expect(image).toHaveCSS("transform", "matrix(0, 1, -1, 0, 0, 0)")
    await rotationControls.getByRole("button", { name: "Vänster" }).click()
    await expect(image).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)")
  }
  await expect(image).toHaveCSS("width", "625px")
  await expect(page.locator(".img_area")).toHaveCSS("width", "625px")
  expect(await readerHitRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("faksimil page navigation preserves queries and restores scan identity", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const documentRequests: string[] = []
  page.on("request", browserRequest => {
    if (browserRequest.resourceType() === "document") {
      documentRequests.push(browserRequest.url())
    }
  })
  const query = "?q=scan&hit=2&s_mode=phrase&repeat=first&repeat=second&unknown=value"
  await page.goto(`${facsimilePath}${query}`, { waitUntil: "networkidle" })
  documentRequests.length = 0
  await request.delete(`${fixture}/_reader_metadata_requests`)

  const image = page.locator("img.faksimil")
  await activateReaderLink(page, "Föregående sida", facsimilePageHref("1", query))
  await expect(page).toHaveURL(`/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/1/faksimil${query}`)
  await expect(image).toHaveAttribute("src", facsimileSource(3, 7))
  await expect(image).toHaveAttribute(
    "srcset",
    `${facsimileSource(3, 7)} 1x, ${facsimileSource(5, 7)} 2x`
  )

  await page.goBack()
  await expect(page).toHaveURL(`${facsimilePath}${query}`)
  await expect(image).toHaveAttribute("src", facsimileSource(3, 9))
  await page.goForward()
  await expect(page).toHaveURL(`/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/1/faksimil${query}`)
  await expect(image).toHaveAttribute("src", facsimileSource(3, 7))

  await activateReaderLink(page, "Nästa sida", facsimilePageHref("3", query))
  await expect(page).toHaveURL(`${facsimilePath}${query}`)
  await expect(image).toHaveAttribute("src", facsimileSource(3, 9))
  await activateReaderLink(page, "Nästa sida", facsimilePageHref("5", query))
  await expect(page).toHaveURL(`/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/5/faksimil${query}`)
  await expect(image).toHaveAttribute("src", facsimileSource(3, 12))
  await expect(page.getByRole("link", { name: "Nästa sida" })).toHaveCount(0)

  expect(documentRequests).toEqual([])
  expect(await readerMetadataRequests(request)).toHaveLength(5)
  expect(problems).toEqual([])
})

test("faksimil size replacement changes exact sources and stops at both edges", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(facsimilePath, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_metadata_requests`)

  const image = page.locator("img.faksimil")
  const wrapper = page.locator(".img_area")
  const sizeControls = page.locator("#toolkit .reader-facsimile-size-controls")
  const smaller = sizeControls.getByRole("button", { name: "Mindre" })
  const larger = sizeControls.getByRole("button", { name: "Större" })
  const historyLength = await page.evaluate(() => window.history.length)

  await larger.click()
  await expect(page).toHaveURL(`${facsimilePath}?storlek=4`)
  await expect(image).toHaveAttribute("src", facsimileSource(4, 9))
  await expect(image).not.toHaveAttribute("srcset", /./)
  await expect(image).toHaveAttribute("width", "900")
  await expect(image).toHaveCSS("width", "900px")
  await expect(wrapper).toHaveCSS("width", "900px")

  await larger.click()
  await expect(page).toHaveURL(`${facsimilePath}?storlek=5`)
  await expect(image).toHaveAttribute("src", facsimileSource(5, 9))
  await expect(image).not.toHaveAttribute("srcset", /./)
  await expect(image).toHaveAttribute("width", "1250")
  await expect(wrapper).toHaveCSS("width", "1250px")
  await expect(larger).toBeDisabled()

  await smaller.click()
  await smaller.click()
  await smaller.click()
  await expect(page).toHaveURL(`${facsimilePath}?storlek=2`)
  await expect(image).toHaveAttribute("src", facsimileSource(2, 9))
  await expect(image).toHaveAttribute(
    "srcset",
    `${facsimileSource(2, 9)} 1x, ${facsimileSource(4, 9)} 2x`
  )
  await expect(image).toHaveAttribute("width", "450")
  await expect(image).toHaveCSS("width", "450px")
  await expect(wrapper).toHaveCSS("width", "450px")
  await expect(smaller).toBeDisabled()

  expect(await page.evaluate(() => window.history.length)).toBe(historyLength)
  expect(await readerMetadataRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("faksimil rotation persists while a size change clears only the image error", async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Rotation controls are desktop-only")
  const problems = captureBrowserProblems(page)
  await page.goto(facsimilePath, { waitUntil: "networkidle" })

  const image = page.locator("img.faksimil")
  await page.locator("#toolkit .reader-facsimile-rotation-controls")
    .getByRole("button", { name: "Höger" }).click()
  await expect(image).toHaveCSS("transform", "matrix(0, 1, -1, 0, 0, 0)")
  await image.evaluate(element => element.dispatchEvent(new Event("error")))
  await expect(page.locator(".reader-facsimile-error[role=alert]")).toHaveCount(1)

  await page.locator("#toolkit .reader-facsimile-size-controls")
    .getByRole("button", { name: "Större" }).click()
  await expect(page).toHaveURL(`${facsimilePath}?storlek=4`)
  await expect(image).toHaveAttribute("src", facsimileSource(4, 9))
  await expect(image).toBeVisible()
  await expect(page.locator(".reader-facsimile-error[role=alert]")).toHaveCount(0)
  await expect(image).toHaveCSS("transform", "matrix(0, 1, -1, 0, 0, 0)")
  expect(problems).toEqual([])
})

test("faksimil page identity resets local rotation and image error state", async ({
  page
}, testInfo) => {
  const problems = captureBrowserProblems(page)
  await page.goto(facsimilePath, { waitUntil: "networkidle" })
  const image = page.locator("img.faksimil")
  if (testInfo.project.name !== "mobile-chromium") {
    await page.locator("#toolkit .reader-facsimile-rotation-controls")
      .getByRole("button", { name: "Höger" }).click()
    await expect(image).toHaveCSS("transform", "matrix(0, 1, -1, 0, 0, 0)")
  }
  await image.evaluate(element => element.dispatchEvent(new Event("error")))
  await expect(page.locator(".reader-facsimile-error[role=alert]")).toHaveCount(1)

  await activateReaderLink(page, "Nästa sida", facsimilePageHref("5"))
  await expect(page).toHaveURL(/\/sida\/5\/faksimil$/)
  await expect(image).toHaveAttribute("src", facsimileSource(3, 12))
  await expect(image).toBeVisible()
  await expect(image).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)")
  await expect(page.locator(".reader-facsimile-error[role=alert]")).toHaveCount(0)
  expect(problems).toEqual([])
})

test("search-shaped faksimil navigation never requests e-text hits", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const publicHitRequests: string[] = []
  page.on("request", browserRequest => {
    if (new URL(browserRequest.url()).pathname.includes("/search-hits")) {
      publicHitRequests.push(browserRequest.url())
    }
  })
  const query = "?q=g%C3%B6sta&hit=1&lemma=1&ej_modern=1&prefix=1&suffix=1&s_mode=phrase&x=1&x=2"
  await page.goto(`${facsimilePath}${query}`, { waitUntil: "networkidle" })
  await activateReaderLink(page, "Nästa sida", facsimilePageHref("5", query))

  await expect(page).toHaveURL(
    `/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/5/faksimil${query}`
  )
  await expect(page.locator("#search_nav, .reader-search-state")).toHaveCount(0)
  expect(await readerHitRequests(request)).toEqual([])
  expect(publicHitRequests).toEqual([])
  expect(problems).toEqual([])
})

test("a selected faksimil search row marks its word in the OCR overlay", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const query = "?traff=w1_147&traffslut=w1_147" +
    "&s_query=g%C3%B6sta&s_lbworkid=lb-reader-gosta-berlings-saga" +
    "&s_word_form_only=true&s_include_modernized=true&hit_index=0&s_from=0&s_to=29"

  const response = await page.goto(`${facsimilePath}${query}`, { waitUntil: "networkidle" })

  expect(response?.status()).toBe(200)
  await expect(page.locator(".reader_main .overlay #w1_147")).toHaveCount(1)
  await expect(page.locator(".reader_main .overlay #w1_147.markee")).toHaveCount(1)
  await expect(page.locator(".reader_main img.faksimil")).toBeVisible()
  await expect(page.locator(".reader_main")).not.toHaveClass(/\bocr\b/u)
  expect(await readerHitRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("a failed faksimil scan stays bounded while context and navigation contract remain intact", async ({
  page
}) => {
  const failedImageUrl = (page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) < 768
    ? facsimileRetinaPath
    : facsimileImagePath
  const expectedImageFailure = {
    method: "GET" as const,
    status: 404,
    url: failedImageUrl
  }
  const problems = captureBrowserProblems(page, {
    httpErrors: [expectedImageFailure, expectedImageFailure]
  })
  const documentRequests: string[] = []
  page.on("request", browserRequest => {
    if (browserRequest.resourceType() === "document") {
      documentRequests.push(browserRequest.url())
    }
  })
  await page.route("**/*_0009.jpeg", async route => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "missing" })
  })

  const failedResponse = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === failedImageUrl
  })
  const response = await page.goto(facsimilePath, { waitUntil: "networkidle" })
  documentRequests.length = 0

  expect(response?.status()).toBe(200)
  expect((await failedResponse).status()).toBe(404)
  const alert = page.locator(".reader-facsimile-error[role=alert]")
  await expect(alert).toHaveCount(1)
  await expect(alert).toHaveText(
    "Faksimilbilden kunde inte hämtas."
  )
  await expect(page.locator(".reader-context")).toContainText("Selma Lagerlöf")
  await expect(page.locator(".reader-context")).toContainText("Gösta Berlings saga (1891)")
  const corridor = page.locator("#rightCorridor")
  const navigation = corridor.locator("#toolkit-right .reader-navigation")
  const previousLink = navigation.getByRole("link", { name: "Föregående sida" })
  const nextLink = navigation.getByRole("link", { name: "Nästa sida" })
  await expect(previousLink).toHaveAttribute("href", facsimilePageHref("1"))
  await expect(nextLink).toHaveAttribute("href", facsimilePageHref("5"))
  await expect(corridor).toBeVisible()
  await expect(navigation).toBeVisible()
  await expect(previousLink).toBeVisible()
  await expect(nextLink).toBeVisible()
  const [alertBox, wrapperBox] = await Promise.all([
    alert.boundingBox(),
    page.locator(".img_area").boundingBox()
  ])
  expect(alertBox).not.toBeNull()
  expect(wrapperBox).not.toBeNull()
  expect(alertBox!.x).toBeGreaterThanOrEqual(wrapperBox!.x)
  expect(alertBox!.x + alertBox!.width).toBeLessThanOrEqual(
    wrapperBox!.x + wrapperBox!.width
  )

  await activateReaderLink(page, "Nästa sida", facsimilePageHref("5"), navigation)
  await expect(page).toHaveURL(/\/sida\/5\/faksimil$/)
  await expect(page.locator("img.faksimil")).toHaveAttribute("src", facsimileSource(3, 12))
  await expect(page.locator(".reader-facsimile-error[role=alert]")).toHaveCount(0)
  await expect(page.locator(".reader-context")).toContainText("Gösta Berlings saga (1891)")
  expect(documentRequests).toEqual([])
  expect(problems).toEqual([])
})

test("hydrates the SSR phrase marker and active toolkit without a duplicate public hit request", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const publicHitRequests: string[] = []
  page.on("request", browserRequest => {
    if (new URL(browserRequest.url()).pathname.includes("/works/lb-reader-doktor-glas/search-hits")) {
      publicHitRequests.push(browserRequest.url())
    }
  })

  const response = await page.goto(`${readerPath}?q=doktor%20glas&hit=1`, {
    waitUntil: "networkidle"
  })

  expect(response?.status()).toBe(200)
  await expect(page.locator("#w2_1.markee")).toHaveCount(1)
  await expect(page.locator("#w2_2.markee.flip")).toHaveCount(1)
  await expect(page.locator(".reader_main .markee")).toHaveCount(2)
  const toolkit = page.locator("#toolkit > #search_nav")
  await expect(toolkit).toBeVisible()
  await expect(toolkit).toHaveCount(1)
  await expect(page.locator("#toolkit > .spinner_search")).toHaveCount(1)
  await expect(toolkit).toContainText("5 sökträffar")
  await expect(toolkit).toContainText("Träff 2, sida -2")
  await expect(toolkit.getByRole("link", { name: "Föregående sökträff" }))
    .toHaveAttribute("href", /\/sida\/-3\/etext\?q=doktor\+glas&hit=0$/)
  await expect(toolkit.getByRole("link", { name: "Nästa sökträff" }))
    .toHaveAttribute("href", /\/sida\/-2\/etext\?q=doktor\+glas&hit=2$/)
  expect(await readerHitRequests(request)).toHaveLength(1)
  expect((await readerHitRequests(request))[0]?.path).toContain("/private-v2/")
  expect(publicHitRequests).toEqual([])
  expect(problems).toEqual([])
})

test("opens the Angular Reader search panel, focuses it, and guards paging keys", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const trigger = page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Sök i verket", exact: true })
  const searchbox = page.locator(".reader-context .searchbox")
  await expect(searchbox).toBeHidden()
  await trigger.click()
  await expect(searchbox).toBeVisible()
  await expect(searchbox).toContainText("Sök i Hjalmar Söderberg")
  await expect(searchbox).toContainText("Doktor Glas")

  const input = searchbox.getByRole("searchbox")
  await expect(input).toBeFocused()
  await input.fill("glas")
  await input.press("ArrowRight")
  await expect(page).toHaveURL(readerPath)
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 3")

  await trigger.click()
  await expect(searchbox).toBeHidden()
  expect(problems).toEqual([])
})

test("submits a canonical work search, preserves raw owners, and follows History", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const rawQuery = "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F&q=old&hit=2"
  const retained = "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  await page.goto(`${readerPath}${rawQuery}`, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)

  const trigger = page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Sök i verket", exact: true })
  await trigger.click()
  const searchbox = page.locator(".reader-context .searchbox")
  const input = searchbox.getByRole("searchbox")
  await expect(input).toHaveValue("old")
  await input.fill("  glas  ")
  await searchbox.getByRole("button", { name: "Sök", exact: true }).click()

  const canonicalQuery = `${retained}&q=glas&hit=0`
  await expect(page).toHaveURL(`${readerPath}${canonicalQuery}`)
  await expect(page.locator("#search_nav")).toContainText("1 sökträff")
  await expect(page.locator("#search_nav")).toContainText("Träff 1, sida -2")
  await expect(page.locator("#w2_2.markee")).toHaveCount(1)
  expect(await readerHitRequests(request)).toEqual([
    expect.objectContaining({
      path: "/v2/works/lb-reader-doktor-glas/search-hits",
      query: expect.stringContaining("query=glas&offset=0&limit=3")
    })
  ])

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(`${readerPath}${rawQuery}`)
  await expect(input).toHaveValue("old")
  await page.goForward({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(`${readerPath}${canonicalQuery}`)
  await expect(input).toHaveValue("glas")
  await expect(page.locator("#w2_2.markee")).toHaveCount(1)
  expect(problems).toEqual([])
})

test("validates empty work searches and closes active hits without touching raw owners", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const retained = "?bare&repeat=first&repeat=second"
  await page.goto(`${readerPath}${retained}`, { waitUntil: "networkidle" })
  await page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Sök i verket", exact: true }).click()
  const searchbox = page.locator(".reader-context .searchbox")
  const input = searchbox.getByRole("searchbox")
  await input.fill("   ")
  await searchbox.getByRole("button", { name: "Sök", exact: true }).click()
  await expect(page).toHaveURL(`${readerPath}${retained}`)
  await expect(searchbox.getByRole("status")).toHaveText("Ange ett sökord eller en fras.")
  expect(await readerHitRequests(request)).toEqual([])

  await input.fill("x".repeat(201))
  await input.press("Enter")
  await expect(page).toHaveURL(`${readerPath}${retained}`)
  await expect(searchbox.getByRole("status"))
    .toHaveText("Sökningen får vara högst 200 tecken.")
  expect(await readerHitRequests(request)).toEqual([])

  await input.fill("glas")
  await input.press("Enter")
  await expect(page).toHaveURL(`${readerPath}${retained}&q=glas&hit=0`)
  await page.locator("#search_nav").getByRole("link", {
    name: "Stäng träffvisningen"
  }).click()
  await expect(page).toHaveURL(`${readerPath}${retained}`)
  await expect(page.locator("#search_nav")).toHaveCount(0)
  await expect(searchbox).toBeHidden()
  await expect(searchbox.locator('input[type="search"]')).toHaveValue("")
  expect(problems).toEqual([])
})

test("projects Angular work-search options onto canonical generated hit flags", async ({
  page,
  request
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Sök i verket", exact: true }).click()
  const searchbox = page.locator(".reader-context .searchbox")
  await searchbox.getByRole("checkbox", { name: "INKLUDERA BÖJNINGSFORMER" }).click()
  await expect(searchbox.getByRole("checkbox", {
    name: "INKLUDERA BÖJNINGSFORMER"
  })).toHaveAttribute("aria-checked", "true")
  await searchbox.getByRole("searchbox").fill("glas")
  await request.delete(`${fixture}/_reader_hit_requests`)
  await searchbox.getByRole("button", { name: "Sök", exact: true }).click()

  await expect(page).toHaveURL(`${readerPath}?q=glas&hit=0&lemma=1&ej_modern=1`)
  await expect.poll(async () => (await readerHitRequests(request)).length).toBe(1)
  expect(await readerHitRequests(request)).toEqual([
    expect.objectContaining({
      query: "media_type=etext&query=glas&offset=0&limit=3" +
        "&word_forms=true&include_older_spellings=false&prefix=false&suffix=false"
    })
  ])
})

test("work-search options expose one keyboard-operable checkbox each", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Sök i verket", exact: true }).click()
  const searchbox = page.locator(".reader-context .searchbox")
  const prefix = searchbox.getByRole("checkbox", { name: "SÖK EFTER ORDBÖRJAN" })

  await expect(prefix).toHaveAttribute("tabindex", "0")
  await prefix.focus()
  await expect(prefix).toBeFocused()
  await prefix.press(" ")
  await expect(prefix).toHaveAttribute("aria-checked", "true")
  await prefix.press("Enter")
  await expect(prefix).toHaveAttribute("aria-checked", "false")
  await expect(searchbox.getByRole("button", { name: "SÖK EFTER ORDBÖRJAN" })).toHaveCount(0)
})

test("keeps work search disabled for a Reader representation without typed hit support", async ({
  page
}) => {
  await page.goto(facsimilePath, { waitUntil: "networkidle" })
  const item = page.locator(".reader-context .subnav li").filter({ hasText: "Sök i verket" })
  await expect(item.locator("a.disabled")).toHaveText("Sök i verket")
  await expect(item).toHaveAttribute("aria-disabled", "true")
  await expect(page.locator(".reader-context .searchbox")).toHaveCount(0)
})

test("keeps work search inert when exact e-text metadata is not searchable", async ({
  page,
  request
}) => {
  await page.goto(
    "/författare/SöderbergH/titlar/UnsearchableEtextReader/sida/-2/etext" +
      "?q=glas&hit=0",
    { waitUntil: "networkidle" }
  )
  const item = page.locator(".reader-context .subnav li")
    .filter({ hasText: "Sök i verket" })
  await expect(item.getByRole("link", { name: "Sök i verket" })).toHaveCount(0)
  await expect(item).toHaveAttribute("aria-disabled", "true")
  await expect(page.locator(".reader-context .searchbox")).toHaveCount(0)
  await expect(page.locator("#search_nav")).toHaveCount(0)
  expect(await readerHitRequests(request)).toEqual([])
})

test("work-scoped live word ids hydrate, highlight, and navigate to the next hit", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${workScopedReaderPath}?q=kyrka&hit=0`, { waitUntil: "networkidle" })

  await expect(page.locator("#lb7604979_8654.markee")).toHaveCount(1)
  await expect(page.locator("#lb7604979_8658.markee")).toHaveCount(1)
  await page.locator("#search_nav").getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page).toHaveURL(/\/WorkScopedIdsReader\/sida\/-1\/etext\?q=kyrka&hit=1$/)
  await expect(page.locator("#lb7604979_8700.markee")).toHaveCount(1)
  await expect(page.locator("#search_nav")).toContainText("Träff 2, sida -1")
  expect(problems).toEqual([])
})

test("a singleton hit marks one word and omits both toolkit links", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)

  await page.goto(`${readerPath}?q=glas&hit=0`, { waitUntil: "networkidle" })

  await expect(page.locator(".reader_main .markee")).toHaveCount(1)
  await expect(page.locator("#w2_2.markee")).toHaveCount(1)
  await expect(page.locator("#w2_2.flip")).toHaveCount(0)
  const toolkit = page.locator("#toolkit > #search_nav")
  await expect(toolkit).toContainText("1 sökträff")
  await expect(toolkit.getByRole("link", { name: "Föregående sökträff" })).toHaveCount(0)
  await expect(toolkit.getByRole("link", { name: "Nästa sökträff" })).toHaveCount(0)
  expect(problems).toEqual([])
})

test("the first of several hits omits previous and keeps the exact next target", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-3/etext?q=doktor%20glas&hit=0",
    { waitUntil: "networkidle" }
  )

  await expect(page.locator("#w1_1.markee")).toHaveCount(1)
  const toolkit = page.locator("#toolkit > #search_nav")
  await expect(toolkit).toContainText("Träff 1, sida -3")
  await expect(toolkit.getByRole("link", { name: "Föregående sökträff" })).toHaveCount(0)
  await expect(toolkit.getByRole("link", { name: "Nästa sökträff" })).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext?q=doktor+glas&hit=1"
  )
  expect(problems).toEqual([])
})

test("the last of several hits keeps the exact previous target and omits next", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-1/etext?q=doktor%20glas&hit=4",
    { waitUntil: "networkidle" }
  )

  await expect(page.locator("#w3_2.markee")).toHaveCount(1)
  const toolkit = page.locator("#toolkit > #search_nav")
  await expect(toolkit).toContainText("Träff 5, sida -1")
  await expect(toolkit.getByRole("link", { name: "Föregående sökträff" })).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext?q=doktor+glas&hit=3"
  )
  await expect(toolkit.getByRole("link", { name: "Nästa sökträff" })).toHaveCount(0)
  expect(problems).toEqual([])
})

test("first and last hit controls preserve raw state and push exact Reader history", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const rawOwners = "bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  const initialQuery = `?${rawOwners}&q=doktor%20glas&hit=1`
  const initialEncodedPath = `${storedReaderPath}${initialQuery}`
  await page.goto(`${readerPath}${initialQuery}`, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)

  const toolkit = page.locator("#search_nav")
  await toolkit.getByRole("link", { name: "Gå till sista träffen" }).click()
  const lastQuery = `?${rawOwners}&q=doktor%20glas&hit=4`
  await expect.poll(() => page.evaluate(() => location.pathname + location.search))
    .toBe(`${storedNextReaderPath}${lastQuery}`)
  await expect(toolkit).toContainText("Träff 5, sida -1")
  await expect(page.locator("#w3_2.markee")).toHaveCount(1)
  expect(await readerHitRequests(request)).toContainEqual(expect.objectContaining({
    path: "/v2/works/lb-reader-doktor-glas/search-hits",
    query: expect.stringContaining("query=doktor%20glas&offset=4&limit=1")
  }))

  await page.goBack({ waitUntil: "networkidle" })
  await expect.poll(() => page.evaluate(() => location.pathname + location.search))
    .toBe(initialEncodedPath)
  await expect(toolkit).toContainText("Träff 2, sida -2")

  await toolkit.getByRole("link", { name: "Gå till första träffen" }).click()
  const firstQuery = `?${rawOwners}&q=doktor%20glas&hit=0`
  await expect.poll(() => page.evaluate(() => location.pathname + location.search))
    .toBe(`${storedReaderPath.replace("/sida/-2/", "/sida/-3/")}${firstQuery}`)
  await expect(toolkit).toContainText("Träff 1, sida -3")
  await expect(page.locator("#w1_1.markee")).toHaveCount(1)
  const historyLength = await page.evaluate(() => window.history.length)
  await toolkit.getByRole("link", { name: "Gå till första träffen" }).click()
  await expect.poll(() => page.evaluate(() => window.history.length)).toBe(historyLength)
  expect(problems).toEqual([])
})

test("direct hit input toggles and focuses, rejects bad ordinals, and pushes a valid hit", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const rawOwners = "bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  const initialQuery = `?${rawOwners}&q=doktor%20glas&hit=1#direct-hit`
  const initialEncodedPath = `${storedReaderPath}${initialQuery}`
  await page.goto(`${readerPath}${initialQuery}`, { waitUntil: "networkidle" })
  const settledInitialPath = await page.evaluate(() => location.pathname + location.search)
  await request.delete(`${fixture}/_reader_hit_requests`)

  const toolkit = page.locator("#search_nav")
  const trigger = toolkit.getByRole("link", { name: "Gå direkt till träff . . ." })
  await trigger.click()
  const input = toolkit.getByRole("textbox", { name: "Träffnummer" })
  await expect(input).toBeVisible()
  await expect(input).toBeFocused()
  const directItem = trigger.locator("..")
  const directForm = directItem.locator("form")
  await expect(directItem).toHaveCSS("white-space", "nowrap")
  await expect(directForm).toHaveCSS("display", "inline")
  await expect(input).toHaveCSS("width", "40px")
  await expect(input).toHaveCSS("height", "16px")
  const [inputBox, triggerBox, fontRatio] = await Promise.all([
    input.boundingBox(),
    trigger.boundingBox(),
    input.evaluate(element => {
      const inputSize = Number.parseFloat(getComputedStyle(element).fontSize)
      const parentSize = Number.parseFloat(getComputedStyle(element.parentElement!).fontSize)
      return inputSize / parentSize
    })
  ])
  expect(inputBox).not.toBeNull()
  expect(triggerBox).not.toBeNull()
  expect(inputBox!.width).toBeCloseTo(40, 0)
  expect(inputBox!.height).toBeCloseTo(16, 0)
  expect(inputBox!.y).toBeLessThan(triggerBox!.y + triggerBox!.height)
  expect(fontRatio).toBeCloseTo(0.7, 2)
  await trigger.click()
  await expect(input).toBeHidden()
  await trigger.click()
  await expect(input).toBeFocused()

  for (const invalid of ["0", "6", "inte ett nummer"]) {
    await input.fill(invalid)
    await input.press("Enter")
    await expect.poll(() => page.evaluate(() => location.pathname + location.search))
      .toBe(settledInitialPath)
    await expect(input).toBeVisible()
  }
  expect(await readerHitRequests(request)).toEqual([])

  await input.fill("4")
  await input.press("Enter")
  const targetQuery = `?${rawOwners}&q=doktor%20glas&hit=3`
  await expect.poll(() => page.evaluate(() => location.pathname + location.search))
    .toBe(`${storedNextReaderPath}${targetQuery}`)
  await expect(page).toHaveURL(`${storedNextReaderPath}${targetQuery}#direct-hit`)
  await expect(toolkit).toContainText("Träff 4, sida -1")
  await expect(page.locator("#w3_1.markee")).toHaveCount(1)
  await expect(toolkit.getByRole("textbox", { name: "Träffnummer" })).toHaveCount(0)
  expect(await readerHitRequests(request)).toContainEqual(expect.objectContaining({
    path: "/v2/works/lb-reader-doktor-glas/search-hits",
    query: expect.stringContaining("query=doktor%20glas&offset=3&limit=1")
  }))

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(initialEncodedPath)
  await expect(toolkit).toContainText("Träff 2, sida -2")
  expect(problems).toEqual([])
})

test("no-hit first, last, and direct controls retain the exact Reader location", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const rawOwners = "bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  await page.goto(`${readerPath}?${rawOwners}&q=inga&hit=0#no-hit`, { waitUntil: "networkidle" })
  const settledPath = await page.evaluate(() => location.pathname + location.search + location.hash)
  await expect(page.locator("#search_nav")).toContainText("0 sökträffar")
  await request.delete(`${fixture}/_reader_hit_requests`)

  const toolkit = page.locator("#search_nav")
  await toolkit.getByRole("link", { name: "Gå till första träffen" }).click()
  await toolkit.getByRole("link", { name: "Gå till sista träffen" }).click()
  const direct = toolkit.getByRole("link", { name: "Gå direkt till träff . . ." })
  await direct.click()
  const input = toolkit.getByRole("textbox", { name: "Träffnummer" })
  await input.fill("1")
  await input.press("Enter")

  await expect.poll(() => page.evaluate(() => location.pathname + location.search + location.hash))
    .toBe(settledPath)
  await expect(input).toBeFocused()
  expect(await readerHitRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("an obsolete direct target lookup cannot navigate after an A-B-A route cycle", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const sourcePath = `${storedReaderPath}?q=doktor%20glas&hit=1`
  await page.goto(sourcePath, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)
  const slowTargetKey = [
    "lb-reader-doktor-glas",
    "doktor glas",
    "4",
    "1",
    "false",
    "true",
    "false",
    "false"
  ].join("|")
  await request.put(`${fixture}/_reader_hit_delays`, {
    data: { [slowTargetKey]: 350 }
  })

  await page.locator("#search_nav")
    .getByRole("link", { name: "Gå till sista träffen" }).click()
  await expect.poll(async () => (await readerHitRequests(request)).some(
    hit => hit.query.includes("offset=4&limit=1")
  )).toBe(true)

  await navigateClient(page, `${storedReaderPath}?q=glas&hit=0`)
  await expect(page.locator("#search_nav")).toContainText("Träff 1, sida -2")
  await navigateClient(page, sourcePath)
  await expect(page.locator("#search_nav")).toContainText("Träff 2, sida -2")

  await page.waitForTimeout(450)
  await expect(page).toHaveURL(/\/sida\/-2\/etext\?q=doktor(?:%20|\+)glas&hit=1$/)
  await expect(page.locator("#search_nav")).toContainText("Träff 2, sida -2")
  await expect(page.locator("#w2_1.markee")).toHaveCount(1)
  expect(problems).toEqual([])
})

test("opening Reader source information invalidates a delayed target lookup", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const sourcePath = `${storedReaderPath}?q=doktor%20glas&hit=1`
  await page.goto(sourcePath, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)
  const slowTargetKey = [
    "lb-reader-doktor-glas",
    "doktor glas",
    "4",
    "1",
    "false",
    "true",
    "false",
    "false"
  ].join("|")
  await request.put(`${fixture}/_reader_hit_delays`, {
    data: { [slowTargetKey]: 700 }
  })

  await page.locator("#search_nav")
    .getByRole("link", { name: "Gå till sista träffen" }).click()
  await expect.poll(async () => (await readerHitRequests(request)).some(
    hit => hit.query.includes("offset=4&limit=1")
  )).toBe(true)

  await page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Mer om boken" }).click()
  const dialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(dialog).toHaveCount(1)
  await expect(page).toHaveURL(/\/sida\/-2\/etext\?q=doktor(?:%20|\+)glas&hit=1&om-boken$/)

  await page.waitForTimeout(800)
  await expect(dialog).toHaveCount(1)
  await expect(page).toHaveURL(/\/sida\/-2\/etext\?q=doktor(?:%20|\+)glas&hit=1&om-boken$/)
  await expect(page.locator("#w2_1.markee")).toHaveCount(1)
  expect(problems).toEqual([])
})

test("next-hit client navigation updates marker, exact history, and Back restores the phrase", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPath}?q=doktor%20glas&hit=1`, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)

  await page.locator("#search_nav").getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page).toHaveURL(/\/sida\/-2\/etext\?q=doktor\+glas&hit=2$/)
  await expect(page.locator(".reader_main .markee")).toHaveCount(1)
  await expect(page.locator("#w2_2.markee")).toHaveCount(1)
  await expect(page.locator("#search_nav")).toContainText("Träff 3, sida -2")
  await expect.poll(async () => (await storedPageViews(page))[0]?.url).toBe(
    `${storedReaderPath}?q=doktor+glas&hit=2`
  )
  expect(await readerHitRequests(request)).toEqual([
    expect.objectContaining({ path: "/v2/works/lb-reader-doktor-glas/search-hits" })
  ])

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(/\/sida\/-2\/etext\?q=doktor\+glas&hit=1$/)
  await expect(page.locator(".reader_main .markee")).toHaveCount(2)
  await expect(page.locator("#w2_2.markee.flip")).toHaveCount(1)
  await expect(page.locator("#search_nav")).toContainText("Träff 2, sida -2")
  await expect.poll(async () => (await storedPageViews(page))[0]?.url).toBe(
    `${storedReaderPath}?q=doktor+glas&hit=1`
  )
  expect(problems).toEqual([])
})

test("previous-hit and ordinary-page links use distinct target pages and preserve the cursor", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPath}?q=doktor%20glas&hit=1`, { waitUntil: "networkidle" })

  await page.locator("#search_nav").getByRole("link", { name: "Föregående sökträff" }).click()
  await expect(page).toHaveURL(/\/sida\/-3\/etext\?q=doktor\+glas&hit=0$/)
  await expect(page.locator(".reader-page-position")).toHaveText("-3 av 3")
  await expect(page.locator("#w1_1.markee")).toHaveCount(1)
  await expect(page.locator("#search_nav")).toContainText("Träff 1, sida -3")
  await expect(page.locator("#search_nav").getByRole("link", {
    name: "Föregående sökträff"
  })).toHaveCount(0)

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 3")
  await activateReaderLink(
    page,
    "Nästa sida",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext?q=doktor+glas&hit=1"
  )
  await expect(page).toHaveURL(/\/sida\/-1\/etext\?q=doktor\+glas&hit=1$/)
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await expect(page.locator(".reader_main .markee")).toHaveCount(0)
  await expect(page.locator("#search_nav")).toContainText("Träff 2, sida -1")

  await page.locator("#search_nav").getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page).toHaveURL(/\/sida\/-2\/etext\?q=doktor\+glas&hit=2$/)
  await expect(page.locator("#w2_2.markee")).toHaveCount(1)

  await page.locator("#search_nav").getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page).toHaveURL(/\/sida\/-1\/etext\?q=doktor\+glas&hit=3$/)
  await expect(page.locator("#w3_1.markee")).toHaveCount(1)
  expect(problems).toEqual([])
})

test("a delayed primary Reader request keeps the reader shell mounted until the new page arrives", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPath}?q=doktor%20glas&hit=1`, { waitUntil: "networkidle" })
  const historyBefore = await rawStoredPageViews(page)
  let releaseRequest!: () => void
  const release = new Promise<void>(resolve => { releaseRequest = resolve })
  let markRequestStarted!: () => void
  const requestStarted = new Promise<void>(resolve => { markRequestStarted = resolve })
  await page.route("**/api/reader/**/-1/etext", async route => {
    markRequestStarted()
    await release
    await route.continue()
  })

  await activateReaderLink(
    page,
    "Nästa sida",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext?q=doktor%20glas&hit=1"
  )
  await requestStarted
  await expect(page).toHaveURL(/\/sida\/-1\/etext\?q=doktor%20glas&hit=1$/)
  await expect(page.locator(".reader-primary-loading")).toHaveCount(0)
  await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 3")
  await expect(page.locator("#toolkit > #search_nav")).toHaveCount(1)
  await expect(page.locator(".reader-context .current_part .navtitle")).toHaveText("Doktor Glas")
  await expect(page.locator('meta[name="part"]')).toHaveAttribute("content", "DoktorGlas")
  await expect(page).toHaveTitle("Doktor Glas sida -2 etext | Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(1)
  await expect(page.locator('link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'))
    .toHaveCount(1)
  expect(await rawStoredPageViews(page)).toBe(historyBefore)

  releaseRequest()
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("NÄSTA SIDA")
  await expect(page.locator(".reader-context .current_part .navtitle")).toHaveText("Doktor Glas")
  await expect(page.locator('meta[name="part"]')).toHaveAttribute("content", "DoktorGlas")
  await expect(page).toHaveTitle("Doktor Glas sida -1 etext | Litteraturbanken")
  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(1)
  await expect(page.locator('link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'))
    .toHaveCount(1)
  await expect.poll(async () => (await storedPageViews(page))[0]?.pagename).toBe("-1")
  expect(problems).toEqual([])
})

test("a failed primary Reader client request shows a bounded state without stale content or History", async ({
  page
}) => {
  const failedReaderUrl = "/api/reader/S%C3%B6derbergH/DoktorGlas/-1/etext"
  const expectedReaderFailure = {
    method: "GET" as const,
    status: 503,
    url: failedReaderUrl
  }
  const problems = captureBrowserProblems(page, {
    httpErrors: [expectedReaderFailure, expectedReaderFailure]
  })
  await page.goto(`${readerPath}?q=doktor%20glas&hit=1`, { waitUntil: "networkidle" })
  const historyBefore = await rawStoredPageViews(page)
  await page.route("**/api/reader/**/-1/etext", async route => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Reader unavailable" })
    })
  })

  const failedResponse = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === failedReaderUrl
  })
  await activateReaderLink(
    page,
    "Nästa sida",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext?q=doktor%20glas&hit=1"
  )
  expect((await failedResponse).status()).toBe(503)
  await expect(page).toHaveURL(/\/sida\/-1\/etext\?q=doktor%20glas&hit=1$/)
  await expect(page.locator(".reader-primary-error")).toHaveText(
    "Läsarsidan kunde inte hämtas."
  )
  await expect(page.locator(".reader_main")).toHaveCount(0)
  await expect(page.locator(".reader-page-position")).toHaveCount(0)
  await expect(page.locator("#toolkit > #search_nav")).toHaveCount(0)
  await expect(page).toHaveTitle("Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveCount(0)
  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(0)
  await expect(page.locator('link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'))
    .toHaveCount(0)
  expect(await rawStoredPageViews(page)).toBe(historyBefore)
  expect(problems).toEqual([])
})

test("a public hit failure stays local to the hydrated Reader", async ({ page, request }) => {
  const failedHitUrl = "/api/v2/works/lb-reader-doktor-glas/search-hits" +
    "?media_type=etext&query=doktor%20glas&offset=1&limit=3" +
    "&word_forms=false&include_older_spellings=true&prefix=false&suffix=false"
  const problems = captureBrowserProblems(page, {
    httpErrors: [{ method: "GET", status: 503, url: failedHitUrl }]
  })
  await page.goto(`${readerPath}?q=doktor%20glas&hit=1`, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)
  await request.put(`${fixture}/_reader_hit_failure`)

  const failedResponse = page.waitForResponse(response => {
    const url = new URL(response.url())
    return `${url.pathname}${url.search}` === failedHitUrl
  })
  await page.locator("#search_nav").getByRole("link", { name: "Nästa sökträff" }).click()
  expect((await failedResponse).status()).toBe(503)
  await expect(page).toHaveURL(/\/sida\/-2\/etext\?q=doktor\+glas&hit=2$/)
  await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
  await expect(page.locator(".reader-search-message")).toHaveText(
    "Sökträffen kunde inte hämtas."
  )
  await expect(page.locator(".reader-search-state[aria-live], #search_nav [aria-live]"))
    .toHaveCount(1)
  await expect(page.locator(".reader_main .markee")).toHaveCount(0)
  await expect(page.locator(".reader-navigation").getByRole("link", { name: "Nästa sida" }))
    .toBeVisible()
  expect(await readerHitRequests(request)).toEqual([
    expect.objectContaining({ path: "/v2/works/lb-reader-doktor-glas/search-hits" })
  ])
  expect(problems).toEqual([])
})

test("a delayed obsolete public hit response cannot overwrite a later client route", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const slowKey = [
    "lb-reader-doktor-glas",
    "doktor glas",
    "1",
    "3",
    "false",
    "true",
    "false",
    "false"
  ].join("|")
  await request.put(`${fixture}/_reader_hit_delays`, {
    data: { [slowKey]: 350 }
  })

  await page.evaluate(() => {
    const nuxt = (window as typeof window & {
      useNuxtApp?: () => { $router: {
        currentRoute: { value: { name: unknown, params: Record<string, unknown> } }
        push: (target: unknown) => Promise<unknown>
      } }
    }).useNuxtApp?.()
    if (!nuxt) return
    void nuxt.$router.push({
      name: nuxt.$router.currentRoute.value.name,
      params: nuxt.$router.currentRoute.value.params,
      query: { q: "doktor glas", hit: "2" }
    })
  })
  await expect.poll(async () => (await readerHitRequests(request)).length).toBe(1)
  await page.evaluate(async () => {
    const nuxt = (window as typeof window & {
      useNuxtApp?: () => { $router: {
        currentRoute: { value: { name: unknown, params: Record<string, unknown> } }
        push: (target: unknown) => Promise<unknown>
      } }
    }).useNuxtApp?.()
    if (!nuxt) return
    await nuxt.$router.push({
      name: nuxt.$router.currentRoute.value.name,
      params: nuxt.$router.currentRoute.value.params,
      query: { q: "glas", hit: "0" }
    })
  })

  await expect(page).toHaveURL(/\/sida\/-2\/etext\?q=glas&hit=0$/)
  await expect(page.locator("#search_nav")).toContainText("Träff 1, sida -2")
  await expect(page.locator(".reader_main .markee")).toHaveCount(1)
  await page.waitForTimeout(450)
  await expect(page).toHaveURL(/\/sida\/-2\/etext\?q=glas&hit=0$/)
  await expect(page.locator("#search_nav")).toContainText("1 sökträff")
  await expect(page.locator(".reader_main .markee")).toHaveCount(1)
  expect(problems).toEqual([])
})

test("successful Reader hydration writes the complete legacy history record", async ({
  page
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const [record] = await storedPageViews(page)
  expect(record).toMatchObject({
    pageix: 2,
    pagename: "-2",
    mediatype: "etext",
    lbworkid: "lb-reader-doktor-glas",
    author: "SöderbergH",
    label: "Doktor Glas",
    url: storedReaderPath
  })
  expect(Object.keys(record!).sort()).toEqual([
    "author",
    "label",
    "lbworkid",
    "mediatype",
    "pageix",
    "pagename",
    "timestamp",
    "url"
  ])
  expect(new Date(record!.timestamp).toISOString()).toBe(record!.timestamp)
})

test("a Reader visit replaces only the matching work and media record", async ({ page }) => {
  const matching = {
    pageix: 1,
    pagename: "-3",
    timestamp: "2026-07-14T10:00:00.000Z",
    mediatype: "etext",
    lbworkid: "lb-reader-doktor-glas",
    author: "SöderbergH",
    label: "Old Doktor Glas",
    url: "/old-etext"
  }
  const facsimile = {
    ...matching,
    timestamp: "2026-07-13T10:00:00.000Z",
    mediatype: "faksimil",
    url: "/same-work-facsimile"
  }
  const otherWork = {
    ...matching,
    timestamp: "2026-07-12T10:00:00.000Z",
    lbworkid: "lb-other-work",
    url: "/other-work"
  }
  await seedStoredPageViews(page, [matching, facsimile, otherWork])

  await page.goto(readerPath, { waitUntil: "networkidle" })

  const records = await storedPageViews(page)
  expect(records).toHaveLength(3)
  expect(records[0]).toMatchObject({
    pageix: 2,
    pagename: "-2",
    mediatype: "etext",
    lbworkid: "lb-reader-doktor-glas",
    url: storedReaderPath
  })
  expect(records.slice(1)).toEqual([facsimile, otherWork])
})

test("a faksimil visit replaces its record without overwriting same-work e-text", async ({
  page
}) => {
  const sameWorkEtext = {
    pageix: 4,
    pagename: "etext-4",
    timestamp: "2026-07-14T10:00:00.000Z",
    mediatype: "etext",
    lbworkid: "lb-reader-gosta-berlings-saga",
    author: "LagerlöfS",
    label: "Gösta Berlings saga",
    url: "/same-work-etext"
  }
  const oldFacsimile = {
    ...sameWorkEtext,
    pageix: 0,
    pagename: "1",
    timestamp: "2026-07-13T10:00:00.000Z",
    mediatype: "faksimil",
    url: "/old-faksimil"
  }
  const otherWork = {
    ...sameWorkEtext,
    timestamp: "2026-07-12T10:00:00.000Z",
    lbworkid: "lb-other-work",
    url: "/other-work"
  }
  await seedStoredPageViews(page, [oldFacsimile, sameWorkEtext, otherWork])

  await page.goto(facsimilePath, { waitUntil: "networkidle" })

  const records = await storedPageViews(page)
  expect(records).toHaveLength(3)
  expect(records[0]).toMatchObject({
    pageix: 1,
    pagename: "3",
    mediatype: "faksimil",
    lbworkid: "lb-reader-gosta-berlings-saga",
    author: "LagerlöfS",
    label: "Gösta Berlings saga",
    url: storedFacsimilePath
  })
  expect(records.slice(1)).toEqual([sameWorkEtext, otherWork])

  await activateReaderLink(page, "Nästa sida", facsimilePageHref("5"))
  await expect.poll(async () => (await storedPageViews(page))[0]).toMatchObject({
    pageix: 2,
    pagename: "5",
    mediatype: "faksimil",
    lbworkid: "lb-reader-gosta-berlings-saga",
    url: storedNextFacsimilePath
  })
  const updatedRecords = await storedPageViews(page)
  expect(updatedRecords).toHaveLength(3)
  expect(updatedRecords.slice(1)).toEqual([sameWorkEtext, otherWork])
})

test("a Reader visit caps oversized history at 50 records", async ({ page }) => {
  const previous = Array.from({ length: 55 }, (_, index) => ({
    pageix: index,
    pagename: String(index),
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    mediatype: "etext",
    lbworkid: `lb-history-${index}`,
    author: "HistoryAuthor",
    label: `History ${index}`,
    url: `/history-${index}`
  }))
  await seedStoredPageViews(page, previous)

  await page.goto(readerPath, { waitUntil: "networkidle" })

  const records = await storedPageViews(page)
  expect(records).toHaveLength(50)
  expect(records[0]).toMatchObject({
    lbworkid: "lb-reader-doktor-glas",
    pagename: "-2",
    url: storedReaderPath
  })
  expect(records[49]).toEqual(previous[48])
})

test("next-page navigation updates the matching Reader history record", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })

  await Promise.all([
    page.waitForURL(/\/sida\/-1\/etext$/),
    activateReaderLink(
      page,
      "Nästa sida",
      "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"
    )
  ])
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await expect.poll(async () => (await storedPageViews(page))[0]?.pagename).toBe("-1")

  const records = await storedPageViews(page)
  expect(records).toHaveLength(1)
  expect(records[0]).toMatchObject({
    pageix: 3,
    pagename: "-1",
    mediatype: "etext",
    lbworkid: "lb-reader-doktor-glas",
    url: storedNextReaderPath
  })
})

for (const [name, raw] of [
  ["malformed JSON", "{not-json"],
  ["non-array JSON", JSON.stringify({ old: "history" })]
] as const) {
  test(`${name} is nonfatal for faksimil history`, async ({ page }) => {
    await seedStoredPageViews(page, raw)

    await page.goto(facsimilePath, { waitUntil: "networkidle" })

    const records = await storedPageViews(page)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      lbworkid: "lb-reader-gosta-berlings-saga",
      mediatype: "faksimil",
      pagename: "3",
      url: storedFacsimilePath
    })
  })
}

for (const method of ["getItem", "setItem"] as const) {
  test(`throwing Storage.${method} does not break the faksimil Reader`, async ({ page }) => {
    const problems = captureBrowserProblems(page)
    await page.addInitScript(storageMethod => {
      if (storageMethod === "getItem") {
        const nativeGetItem = Storage.prototype.getItem
        Object.defineProperty(Storage.prototype, "getItem", {
          configurable: true,
          value(key: string) {
            if (key === "lastPageViews") throw new Error("blocked Storage.getItem")
            return nativeGetItem.call(this, key)
          }
        })
      } else {
        const nativeSetItem = Storage.prototype.setItem
        Object.defineProperty(Storage.prototype, "setItem", {
          configurable: true,
          value(key: string, value: string) {
            if (key === "lastPageViews") throw new Error("blocked Storage.setItem")
            return nativeSetItem.call(this, key, value)
          }
        })
      }
    }, method)

    const response = await page.goto(facsimilePath, { waitUntil: "networkidle" })

    expect(response?.status()).toBe(200)
    await expect(page.locator("img.faksimil")).toHaveAttribute("src", facsimileImagePath)
    expect(problems).toEqual([])
  })
}

test("an unknown Reader page leaves stored history unchanged", async ({ page }) => {
  const raw = JSON.stringify([{
    pageix: 7,
    pagename: "7",
    timestamp: "2026-07-11T10:00:00.000Z",
    mediatype: "etext",
    lbworkid: "lb-existing",
    author: "ExistingAuthor",
    label: "Existing title",
    url: "/existing"
  }])
  await seedStoredPageViews(page, raw)

  const response = await page.goto(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/missing/etext",
    { waitUntil: "networkidle" }
  )

  expect(response?.status()).toBe(404)
  expect(await rawStoredPageViews(page)).toBe(raw)
})

test("Reader history is consumed by the existing history page", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await expect.poll(async () => (await storedPageViews(page))[0]?.lbworkid)
    .toBe("lb-reader-doktor-glas")
  await page.goto("/historik", { waitUntil: "networkidle" })

  await expect(page.getByRole("link", {
    name: "Hjalmar Söderberg – Doktor Glas"
  })).toHaveAttribute("href", storedReaderPath)
})

test("return link is absent without a validated Search origin", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await expect(page.locator("#search_nav").getByRole("link", {
    name: "Tillbaka till sökningen"
  })).toHaveCount(0)

  await page.goto(`${readerPath}?q=doktor%20glas&hit=1`, { waitUntil: "networkidle" })
  await expect(page.locator("#search_nav")).toBeVisible()
  await expect(page.locator("#search_nav").getByRole("link", {
    name: "Tillbaka till sökningen"
  })).toHaveCount(0)
})

test("return link on faksimil skips e-text hit loading", async ({ page, request }) => {
  const origin = "/s%C3%B6k?fras=frihet&traffsida=2"
  await request.delete(`${fixture}/_reader_hit_requests`)
  await page.goto(`${facsimilePath}?q=frihet&hit=0&s_return=${encodeURIComponent(origin)}`, {
    waitUntil: "networkidle"
  })

  await expect(page.locator("#search_nav").getByRole("link", {
    name: "Tillbaka till sökningen"
  })).toHaveAttribute("href", origin)
  await page.locator("#search_nav").getByRole("link", {
    name: "Stäng träffvisningen"
  }).click()
  await expect(page.locator("#search_nav")).toHaveCount(0)
  await expect.poll(() => {
    const url = new URL(page.url())
    return {
      q: url.searchParams.get("q"),
      hit: url.searchParams.get("hit"),
      searchReturn: url.searchParams.get("s_return")
    }
  }).toEqual({ q: null, hit: null, searchReturn: origin })
  expect(await readerHitRequests(request)).toEqual([])
})

test("return link rejects malformed UTF-8 in the raw outer parameter", async ({ page }) => {
  await page.goto(
    `${readerPath}?q=x&hit=0&s_return=/s%C3%B6k?fras=%FF`,
    { waitUntil: "networkidle" }
  )

  await expect(page.locator("#search_nav").getByRole("link", {
    name: "Tillbaka till sökningen"
  })).toHaveCount(0)
})

test("author-scoped search link selects the current Reader author", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const authorSearch = page.getByRole("link", { name: "Sök i författarens texter" })
  await expect(authorSearch).toHaveAttribute(
    "href",
    "/s%C3%B6k?avancerad&forfattare=S%C3%B6derbergH"
  )
  await authorSearch.click()
  await expect(page).toHaveURL("/s%C3%B6k?avancerad&forfattare=S%C3%B6derbergH")
  await expect(page.locator(".author_select")).toContainText("SöderbergH")
})

test("page-position slider preserves raw index holes and commits keyboard targets on key-up", async ({
  page,
  request
}) => {
  const rawQuery = "?bare&repeat=%2f&repeat=%2F&Mixed=%2a#slider"
  await page.goto(`${sparseSliderReaderPath}${rawQuery}`, { waitUntil: "networkidle" })
  const slider = page.getByRole("slider", { name: "Gå till sida" })
  await expect(slider).toHaveAttribute("min", "0")
  await expect(slider).toHaveAttribute("max", "57")
  await expect(slider).toHaveValue("2")
  const initialBrowserPath = await page.evaluate(
    () => location.pathname + location.search + location.hash
  )

  await request.delete(`${fixture}/_reader_requests`)
  await startHistoryMutationCounter(page)
  await slider.focus()
  await page.keyboard.down("ArrowRight")
  await expect(slider).toHaveValue("3")
  await expect(page).toHaveURL(initialBrowserPath)
  await page.keyboard.up("ArrowRight")
  await expect(slider).toHaveValue("2")
  await expect(page).toHaveURL(initialBrowserPath)
  expect(await historyMutationCounts(page)).toEqual({ pushState: 0, replaceState: 0 })
  expect(await readerRequests(request)).toEqual([])

  await page.keyboard.down("End")
  await expect(slider).toHaveValue("57")
  await expect(page).toHaveURL(initialBrowserPath)
  await page.keyboard.up("End")
  const rawTarget = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/SparseKeyboardReader/sida/57/etext" + rawQuery
  await expect(page).toHaveURL(rawTarget)
  expect(await page.evaluate(() => window.history.state.current)).toBe(rawTarget)
  expect(await historyMutationCounts(page)).toEqual({ pushState: 1, replaceState: 1 })

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(initialBrowserPath)
})

test("page-position slider previews pointer input and commits exactly once on release", async ({
  page,
  request
}) => {
  const rawQuery = "?bare&empty=&repeat=%2f&repeat=%2F&Mixed=%2a#slider"
  await page.goto(`${sparseSliderReaderPath}${rawQuery}`, { waitUntil: "networkidle" })
  const slider = page.getByRole("slider", { name: "Gå till sida" })
  const initialBrowserPath = await page.evaluate(
    () => location.pathname + location.search + location.hash
  )
  await request.delete(`${fixture}/_reader_requests`)
  await startHistoryMutationCounter(page)

  await slider.evaluate(input => {
    const range = input as HTMLInputElement
    range.value = "12"
    range.dispatchEvent(new Event("input", { bubbles: true }))
    range.value = "57"
    range.dispatchEvent(new Event("input", { bubbles: true }))
    range.value = "12"
    range.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await expect(slider).toHaveValue("12")
  const bubble = page.locator(".reader-context .rz-bubble.rz-model-value")
  await expect(bubble).toHaveText("12")
  await expect(bubble).toHaveCSS("opacity", "1")
  await expect(bubble).toHaveCSS("font-size", "12px")
  const [bubbleBox, sliderBox] = await Promise.all([bubble.boundingBox(), slider.boundingBox()])
  expect(bubbleBox).not.toBeNull()
  expect(sliderBox).not.toBeNull()
  expect(bubbleBox!.y + bubbleBox!.height).toBeLessThan(sliderBox!.y)
  const pointerCenter = await page.locator(".reader-context .rz-pointer").evaluate(pointer => {
    const box = pointer.getBoundingClientRect()
    return box.left + box.width / 2
  })
  expect(bubbleBox!.x + bubbleBox!.width / 2).toBeCloseTo(pointerCenter, 0)
  await expect(page).toHaveURL(initialBrowserPath)
  expect(await historyMutationCounts(page)).toEqual({ pushState: 0, replaceState: 0 })
  expect(await readerRequests(request)).toEqual([])

  await slider.evaluate(input => input.dispatchEvent(new Event("change", { bubbles: true })))
  const rawTarget = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/SparseKeyboardReader/sida/12/etext" + rawQuery
  await expect(page).toHaveURL(rawTarget)
  expect(await page.evaluate(() => window.history.state.current)).toBe(rawTarget)
  expect(await historyMutationCounts(page)).toEqual({ pushState: 1, replaceState: 1 })
})

test("rapid page intents push every draft route and debounce only the final content request", async ({
  page,
  request
}) => {
  const start = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-4/etext"
  const pages = ["-3", "-2", "-1"].map(pageName =>
    `/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/${pageName}/etext`
  )
  const problems = captureBrowserProblems(page)
  await page.goto(start, { waitUntil: "networkidle" })
  await page.locator(".reader-context").evaluate(element => {
    element.setAttribute("data-rapid-sidebar-sentinel", "stable")
  })
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`)
  ])
  await page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as (HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        afterEach: (callback: (to: { fullPath: string }) => void) => void
      } } } }
    }) | null
    const state = window as typeof window & {
      __rapidReaderRoutes?: Array<{ fullPath: string, at: number }>
    }
    state.__rapidReaderRoutes = []
    root?.__vue_app__?.config.globalProperties.$router.afterEach(to => {
      state.__rapidReaderRoutes!.push({ fullPath: to.fullPath, at: performance.now() })
    })
    performance.clearResourceTimings()
  })

  await page.keyboard.press("n")
  await page.keyboard.press("n")
  await page.keyboard.press("n")

  await expect(page).toHaveURL(pages[2]!)
  await expect(page.locator(".reader-context[data-rapid-sidebar-sentinel=stable]")).toHaveCount(1)
  await expect(page.locator(".reader-primary-loading, [data-reader-loading]")).toHaveCount(0)

  await expect.poll(async () => readerMetadataRequests(request), { timeout: 2_000 })
    .toHaveLength(1)
  await expect.poll(async () => readerHtmlRequests(request), { timeout: 2_000 })
    .toHaveLength(1)
  const debounceDelay = await page.evaluate(() => {
    const state = window as typeof window & {
      __rapidReaderRoutes?: Array<{ fullPath: string, at: number }>
    }
    const routeAt = state.__rapidReaderRoutes?.at(-1)?.at
    const requestAt = performance.getEntriesByType("resource")
      .filter(entry => entry.name.includes("/api/reader/"))
      .at(-1)?.startTime
    return routeAt === undefined || requestAt === undefined ? null : requestAt - routeAt
  })
  expect(debounceDelay).not.toBeNull()
  expect(debounceDelay!).toBeGreaterThanOrEqual(195)
  expect((await readerHtmlRequests(request))[0]).toContain("res_00004.html")
  await expect(page.locator(".reader_main")).toHaveAttribute(
    "aria-label",
    "Doktor Glas delar, sida -1"
  )

  for (const expected of [pages[1]!, pages[0]!, start]) {
    await page.goBack()
    await expect(page).toHaveURL(expected)
  }
  expect(problems).toEqual([])
})

test("a rejected queued page push is contained and the next paging intent recovers", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        beforeEach: (guard: (to: { fullPath: string }) => unknown) => () => void
      } } } }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    const state = window as typeof window & { __readerRejectedPushAttempted?: boolean }
    const removeGuard = router.beforeEach(to => {
      if (!to.fullPath.endsWith("/sida/-1/etext")) return
      removeGuard()
      state.__readerRejectedPushAttempted = true
      throw new Error("rejected Reader page push")
    })
  })

  await page.keyboard.press("n")
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & {
    __readerRejectedPushAttempted?: boolean
  }).__readerRejectedPushAttempted))).toBe(true)
  await page.waitForTimeout(50)
  await expect(page).toHaveURL(readerPath)

  await page.keyboard.press("n")
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"
  )
  expect(problems).toEqual([])
})

test("a failed older page intent cannot overwrite a newer queued draft", async ({ page }) => {
  const start = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-4/etext"
  const second = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-2/etext"
  const newest = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-1/etext"
  const problems = captureBrowserProblems(page)
  await page.goto(start, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        beforeEach: (guard: (to: { fullPath: string }) => unknown) => () => void
      } } } }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    const state = window as typeof window & {
      __readerQueuedGuard?: { secondStarted: boolean, releaseSecond?: () => void }
    }
    state.__readerQueuedGuard = { secondStarted: false }
    let rejectedFirst = false
    router.beforeEach(to => {
      if (!rejectedFirst && to.fullPath.endsWith("/sida/-3/etext")) {
        rejectedFirst = true
        throw new Error("rejected older Reader page push")
      }
      if (
        !state.__readerQueuedGuard!.secondStarted
        && to.fullPath.endsWith("/sida/-2/etext")
      ) {
        state.__readerQueuedGuard!.secondStarted = true
        return new Promise<void>(resolve => {
          state.__readerQueuedGuard!.releaseSecond = resolve
        })
      }
    })
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "n" }))
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "n" }))
  })
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & {
    __readerQueuedGuard?: { secondStarted: boolean }
  }).__readerQueuedGuard?.secondStarted))).toBe(true)

  await page.keyboard.press("n")
  await page.evaluate(() => {
    const guard = (window as typeof window & {
      __readerQueuedGuard?: { releaseSecond?: () => void }
    }).__readerQueuedGuard
    if (!guard?.releaseSecond) throw new Error("second Reader page push was not delayed")
    guard.releaseSecond()
  })

  await expect(page).toHaveURL(newest)
  await page.goBack()
  await expect(page).toHaveURL(second)
  await page.goBack()
  await expect(page).toHaveURL(start)
  expect(problems).toEqual([])
})

test("a canceled leave keeps Reader keyboard paging active", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        beforeEach: (guard: (to: { path: string }) => unknown) => () => void
        push: (path: string) => Promise<unknown>
      } } } }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    const removeGuard = router.beforeEach(to => {
      if (to.path !== "/bibliotek") return
      removeGuard()
      return false
    })
    await router.push("/bibliotek")
  })
  await expect(page).toHaveURL(readerPath)

  await page.keyboard.press("n")
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"
  )
  expect(problems).toEqual([])
})

test("a bare page-position track click previews its integer and commits once", async ({
  page,
  request
}) => {
  await page.goto(sparseSliderReaderPath, { waitUntil: "networkidle" })
  const slider = page.getByRole("slider", { name: "Gå till sida" })
  await slider.scrollIntoViewIfNeeded()
  const box = await slider.boundingBox()
  expect(box).not.toBeNull()
  await request.delete(`${fixture}/_reader_requests`)
  await startHistoryMutationCounter(page)

  const targetIndex = 12
  const targetX = box!.x + 10 + (box!.width - 20) * targetIndex / 57
  await page.mouse.click(targetX, box!.y + box!.height / 2)

  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/SparseKeyboardReader/sida/12/etext"
  )
  expect(await historyMutationCounts(page)).toEqual({ pushState: 1, replaceState: 1 })
})

test("page-position slider keeps search-hit state and has explicit-count edge behavior", async ({
  page
}) => {
  await page.goto(`${countedSliderReaderPath}?q=doktor%20glas&hit=1`, {
    waitUntil: "networkidle"
  })
  const hitSlider = page.getByRole("slider", { name: "Gå till sida" })
  await expect(hitSlider).toHaveValue("2")
  await hitSlider.focus()
  await page.keyboard.down("End")
  await page.keyboard.up("End")
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/CountedSliderReader/sida/-1/etext?q=doktor%20glas&hit=1"
  )

  await page.goto(readerPath, { waitUntil: "networkidle" })
  await expect(page.getByRole("slider", { name: "Gå till sida" })).toHaveCount(0)

  await page.goto(invalidCountSliderReaderPath, { waitUntil: "networkidle" })
  await expect(page.getByRole("slider", { name: "Gå till sida" })).toHaveCount(0)

  await page.goto(onePageSliderReaderPath, { waitUntil: "networkidle" })
  const onePageSlider = page.getByRole("slider", { name: "Gå till sida" })
  await expect(onePageSlider).toHaveValue("0")
  await expect(onePageSlider).toHaveAttribute("min", "0")
  await expect(onePageSlider).toHaveAttribute("max", "0")
  await onePageSlider.focus()
  await expect(onePageSlider).toBeFocused()
})

test("page-position slider clears a keyboard preview on blur and supports pointer-coordinate drag", async ({
  page,
  request
}) => {
  await page.goto(sparseSliderReaderPath, { waitUntil: "networkidle" })
  const slider = page.getByRole("slider", { name: "Gå till sida" })
  await slider.focus()
  await page.keyboard.down("End")
  await expect(slider).toHaveValue("57")
  await slider.blur()
  await page.keyboard.up("End")
  await expect(page).toHaveURL(sparseSliderReaderPath)
  await expect(slider).toHaveValue("2")

  await request.delete(`${fixture}/_reader_requests`)
  await startHistoryMutationCounter(page)
  const box = await slider.boundingBox()
  expect(box).not.toBeNull()
  const startX = box!.x + 10 + (box!.width - 20) * 2 / 57
  const minimumX = box!.x + 10
  const targetX = box!.x + 10 + (box!.width - 20) * 12 / 57
  const maximumX = box!.x + box!.width - 10
  const y = box!.y + box!.height / 2

  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(minimumX, y, { steps: 2 })
  await page.mouse.up()
  await expect(page).toHaveURL(sparseSliderReaderPath)
  await expect(slider).toHaveValue("2")

  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(maximumX, y, { steps: 2 })
  await page.mouse.up()
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/SparseKeyboardReader/sida/57/etext"
  )
  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(sparseSliderReaderPath)

  await startHistoryMutationCounter(page)
  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(targetX, y, { steps: 4 })
  await expect(slider).toHaveValue("12")
  await expect(page).toHaveURL(sparseSliderReaderPath)
  await page.mouse.up()
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/SparseKeyboardReader/sida/12/etext"
  )
  expect(await historyMutationCounts(page)).toEqual({ pushState: 1, replaceState: 1 })
})

test("page-position slider clears committed drafts across A-B-A and aligns the hit bubble", async ({
  page,
  request
}) => {
  await page.goto(sparseSliderReaderPath, { waitUntil: "networkidle" })
  await request.put(`${fixture}/_reader_metadata_delays`, {
    data: { SparseKeyboardReader: 350 }
  })
  const slider = page.getByRole("slider", { name: "Gå till sida" })
  await slider.focus()
  await page.keyboard.down("End")
  await page.keyboard.up("End")
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/SparseKeyboardReader/sida/57/etext"
  )
  await page.goBack()
  await expect(page).toHaveURL(sparseSliderReaderPath)
  await expect(slider).toHaveValue("2")
  await expect(page.locator(".reader-context .rz-bubble.rz-model-value")).toHaveCount(0)

  await page.goto(`${countedSliderReaderPath}?q=doktor%20glas&hit=1`, {
    waitUntil: "networkidle"
  })
  const hitSlider = page.getByRole("slider", { name: "Gå till sida" })
  await hitSlider.evaluate(input => {
    const range = input as HTMLInputElement
    range.value = "3"
    range.dispatchEvent(new Event("input", { bubbles: true }))
  })
  const hitBubble = page.locator(".reader-context .rz-bubble.rz-model-value")
  const [hitBubbleBox, hitPointerCenter] = await Promise.all([
    hitBubble.boundingBox(),
    page.locator(".reader-context .rz-pointer").evaluate(pointer => {
      const box = pointer.getBoundingClientRect()
      return box.left + box.width / 2
    })
  ])
  expect(hitBubbleBox).not.toBeNull()
  expect(hitBubbleBox!.x + hitBubbleBox!.width / 2).toBeCloseTo(hitPointerCenter, 0)
})
