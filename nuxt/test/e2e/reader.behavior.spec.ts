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
const hugeErrataReaderPath = "/författare/HugeErrataA/titlar/HugeErrata/sida/-2/etext"
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
const sparseFacsimilePath = "/författare/LagerlöfS/titlar/" +
  "SparseFacsimileSizes/sida/3/faksimil"
const storedSparseFacsimilePath = "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/" +
  "SparseFacsimileSizes/sida/3/faksimil"

function sparseFacsimileSource(size: 2 | 4, imageNumber: 7 | 9 | 12): string {
  const work = "lb-reader-sparse-facsimile-sizes"
  return `/txt/${work}/${work}_${size}/${work}_${size}_${String(imageNumber).padStart(4, "0")}.jpeg`
}

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
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_editor_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`),
    request.delete(`${fixture}/_reader_ocr_requests`),
    request.delete(`${fixture}/_reader_jpeg_requests`),
    request.delete(`${fixture}/_reader_manifest_delays`),
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

async function readerManifestRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_manifest_requests`)).json()).requests
}

async function editorManifestRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_editor_manifest_requests`)).json()).requests
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
test.afterEach(async ({ request }) => {
  expect(await readerMetadataRequests(request)).toEqual([])
  expect(await editorManifestRequests(request)).toEqual([])
})

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
  await page.goto(boyeEtextPath, { waitUntil: "load" })
  await expect(page.locator(".reader-context")).toBeVisible({ timeout: 30_000 })
  await expectBoyeContributors(page.locator(".reader-context > div").first().locator(".author"))

  await page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Innehållsförteckning" })
    .evaluate(link => (link as HTMLAnchorElement).click())
  const contents = page.getByRole("dialog", { name: "Innehållsförteckning" })
  await expectBoyeContributors(contents.locator(".header .author"))
  await contents.getByRole("button", { name: "Stäng" }).click()

  await page.goto(boyeEtextPath, { waitUntil: "networkidle" })
  await page.locator(".reader-context")
    .getByRole("button", { name: "Sök i verket" }).click()
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
  })).toHaveAttribute("href", "/f%C3%B6rfattare/S%C3%B6derbergH")
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

test("source information author and read actions use client history without document loads", async ({
  page,
  request
}, testInfo) => {
  const problems = captureBrowserProblems(page)
  const documentRequests: string[] = []
  page.on("request", browserRequest => {
    if (browserRequest.resourceType() === "document") documentRequests.push(browserRequest.url())
  })
  await page.goto(`${readerPath}?om-boken`, { waitUntil: "networkidle" })
  documentRequests.length = 0
  await resetReader(request)

  const dialog = page.getByRole("dialog", { name: "Om boken" })
  if (testInfo.project.name !== "mobile-chromium") {
    const authorLink = dialog.getByRole("link", { name: "Hjalmar Söderberg", exact: true })
    await expect(authorLink).toHaveAttribute("href", "/f%C3%B6rfattare/S%C3%B6derbergH")
    await authorLink.dispatchEvent("click")
    await expect(page).toHaveURL("/författare/S%C3%B6derbergH")
    await page.goBack()
    await expect(page).toHaveURL(`${readerPath}?om-boken`)
    await expect(dialog).toHaveCount(1)
    await page.goForward()
    await expect(page).toHaveURL("/författare/S%C3%B6derbergH")
    await page.goBack()
    await expect(dialog).toHaveCount(1)
  }

  const facsimileLink = dialog.locator(
    '.mediatypes a[href$="/DoktorGlas/sida/-2/faksimil"]'
  )
  await expect(facsimileLink).toBeAttached()
  await facsimileLink.dispatchEvent("click")
  await expect(page).toHaveURL(
    "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/faksimil"
  )
  await page.goBack()
  await expect(page).toHaveURL(`${readerPath}?om-boken`)
  await expect(dialog).toHaveCount(1)

  expect(documentRequests).toEqual([])
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

test("source-information shortcuts yield to guarded keyboard events", async ({ page, request }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await resetReader(request)
  await page.evaluate(() => {
    const variants: Array<KeyboardEventInit & { prevent?: boolean }> = [
      { altKey: true },
      { shiftKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { isComposing: true },
      { prevent: true }
    ]
    for (const { prevent, ...init } of variants) {
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "o",
        ...init
      })
      if (prevent) event.preventDefault()
      document.dispatchEvent(event)
    }
  })

  await expect(page).toHaveURL(readerPath)
  await expect(page.getByRole("dialog", { name: "Om boken" })).toHaveCount(0)
  expect(await sourceInfoRequests(request)).toEqual([])
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

test("closing source information aborts its obsolete client request", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  await request.put(`${fixture}/_source_info_delays`, {
    data: { "SöderbergH|DoktorGlas": 2_000 }
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const sourceInfoPath = "/api/reader/source-info/S%C3%B6derbergH/DoktorGlas"
  const sourceInfoStarted = page.waitForRequest(browserRequest =>
    new URL(browserRequest.url()).pathname === sourceInfoPath
  )
  const sourceInfoAborted = page.waitForEvent("requestfailed", browserRequest =>
    new URL(browserRequest.url()).pathname === sourceInfoPath
  )
  await page.locator(".reader-context .subnav")
    .getByRole("link", { name: "Mer om boken" }).click()
  await sourceInfoStarted

  await navigateClient(page, readerEncodedPath)

  await expect(page.getByRole("dialog", { name: "Om boken" })).toHaveCount(0)
  expect((await sourceInfoAborted).failure()?.errorText).toMatch(/abort/iu)
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

  expect(await readerManifestRequests(request)).toEqual([])
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
  expect(await readerManifestRequests(request)).toEqual([])
  expect(await readerHitRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("normal source information renders exact actions and source metadata", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPath}?om-boken`, { waitUntil: "networkidle" })
  const dialog = page.getByRole("dialog", { name: "Om boken" })

  await expect(dialog.locator(".header .author a")).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH"
  )
  await expect(dialog.locator(".header .title")).toHaveText("Doktor Glas. Roman")
  await expect(dialog.locator(".sourcedesc")).toHaveText(
    "Albert Bonniers förlag, Stockholm 1905."
  )
  await expect(dialog.locator(".mediatypes").getByRole("link", { name: "etext" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext")
  await expect(dialog.locator(".mediatypes").getByRole("link", { name: "faksimil" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/faksimil")
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
    .toHaveAttribute("href", "/f%C3%B6rfattare/Alml%C3%B6fN")
  await expect(dialog.locator(".sourcedesc")).toHaveText("Stockholm, 1871.")
  await expect(dialog).toContainText("Dramawebbens redaktion")
  await expect(dialog.locator(".workintro")).toContainText("En komedi i fem akter.")
  await expect(dialog).toContainText("Ulrika Lindgren")
  await expect(dialog.locator(".mediatypes").getByRole("link", { name: "etext" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/Alml%C3%B6fN/titlar/Affarer/sida/-2/etext")
  await expect(dialog.locator(".mediatypes").getByRole("link", { name: "faksimil" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/Alml%C3%B6fN/titlar/Affarer/sida/-2/faksimil")
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

test("long errata preserves the ten-row visual fixture and exact role copy", async ({
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

test("huge errata expands every validated row and retains rendered cell markup", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${hugeErrataReaderPath}?om-boken`, { waitUntil: "networkidle" })
  const dialog = page.getByRole("dialog", { name: "Om boken" })
  const rows = dialog.locator(".errata_table tbody tr")
  await expect(rows).toHaveCount(8)
  await expect(rows.first().locator("td")).toHaveText([
    "sid. 1", "rättning 1", "notering 1"
  ])
  expect(await rows.first().locator("td").first().innerHTML()).toBe("sid. <em>1</em>")
  await dialog.getByRole("button", { name: "Visa fler" }).click()
  await expect(rows).toHaveCount(1_001)
  await expect(rows.nth(999).locator("td")).toHaveText(["sid. 1000", "rättning 1000"])
  await expect(rows.last().locator("td")).toHaveCount(2)
  await expect(rows.last().locator("td")).toHaveText(["", ""])
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

test("contents part links preserve native modified clicks before a normal selection", async ({
  page
}) => {
  const rawQuery = "?bare&repeat=%2f&repeat=%2F&innehall#contents-fragment"
  await page.goto(`${readerPartsPath}${rawQuery}`, { waitUntil: "networkidle" })
  const initialUrl = page.url()
  const dialog = page.getByRole("dialog", { name: "Innehållsförteckning" })
  const link = dialog.getByRole("link", { name: "Mellandelen" })
  await expect(link).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-3/etext" +
    "?bare&repeat=%2f&repeat=%2F#contents-fragment"
  )
  await startHistoryMutationCounter(page)
  const historyLength = await page.evaluate(() => window.history.length)

  for (const init of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { button: 1 }
  ]) {
    const nativeAllowed = await link.evaluate((anchor, eventInit) => {
      let defaultPreventedByComponent: boolean | null = null
      const blockNativeNavigation = (event: MouseEvent) => {
        defaultPreventedByComponent = event.defaultPrevented
        event.preventDefault()
      }
      anchor.addEventListener("click", blockNativeNavigation, { once: true })
      anchor.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...eventInit
      }))
      return defaultPreventedByComponent === false
    }, init)
    expect(nativeAllowed).toBe(true)
    await expect(dialog).toBeVisible()
    expect(page.url()).toBe(initialUrl)
  }

  expect(await historyMutationCounts(page)).toEqual({ pushState: 0, replaceState: 0 })
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength)
  await link.click()
  await expect(page).toHaveURL(
    `${readerPartsPath.replace("/-1/", "/-3/")}` +
    "?bare&repeat=%2f&repeat=%2F#contents-fragment"
  )
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength + 1)
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
  await goto.getByRole("button", { name: /Gå till sida/ }).click()
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
  await goto.getByRole("button", { name: /Gå till sida/ }).click()
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
  expect(await readerManifestRequests(request)).toEqual([])
  expect(await rawStoredPageViews(page)).toBe(historyBefore)

  await navigateClient(page, `${readerEncodedPath}${rawQuery}&innehall`)
  await expect(page).toHaveURL(`${readerPath}${rawQuery}&innehall`)
  expect(await readerHitRequests(request)).toEqual([])
  expect(await readerManifestRequests(request)).toEqual([])
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
  await request.put(`${fixture}/_reader_manifest_delays`, {
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
  await request.put(`${fixture}/_reader_manifest_delays`, {
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

test("client shorthand navigation keeps question marks inside fragments", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  const fragment = "#note?om-boken"
  await page.goto("/bibliotek", { waitUntil: "networkidle" })

  await navigateClient(page, `${readerShorthandRouterPath}${fragment}`)
  await expect(page).toHaveURL(`${readerShorthandPath}${fragment}`)
  await expect(page.locator(".searching > .preloader")).toBeVisible()
  await expect(page).toHaveURL(`${readerPath}${fragment}`)
  await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
  await expect(page.locator("[role='dialog']")).toHaveCount(0)
  expect(await page.evaluate(() => ({
    hash: window.location.hash,
    search: window.location.search
  }))).toEqual({ hash: "#note?om-boken", search: "" })
  expect(problems).toEqual([])
})

test("a late shorthand resolver cannot leave the route that replaced it", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await request.put(`${fixture}/_reader_manifest_delays`, {
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
  await expect.poll(async () => readerManifestRequests(request)).toEqual([
    "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"
  ])
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
  expect(await page.locator("style[data-reader-shared-styles]").textContent())
    .toContain(".txt .center")
  expect(await page.locator("style[data-reader-work-styles]").textContent())
    .toContain(".txt .titelsida")

  const recorded = await readerRequests(request)
  const pages = recorded.filter(path => path.startsWith(
    "/txt/lb-reader-doktor-glas/res_00002.html?"
  ))
  expect(await readerManifestRequests(request)).toEqual([
    "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"
  ])
  expect(pages).toEqual([
    "/txt/lb-reader-doktor-glas/res_00002.html?username=app"
  ])
  expect(new URL(pages[0]!, fixture).searchParams.get("username")).toBe("app")
  expect(clientReaderRequests).toEqual([])
  expect(problems).toEqual([])
})

test("preserves the production desktop e-text reader layout", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop production geometry")
  const problems = captureBrowserProblems(page)
  await page.goto(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-3/etext",
    { waitUntil: "networkidle" }
  )

  const layout = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".reader_main")
    const pageName = document.querySelector<HTMLElement>(".reader_main .pname")
    const right = document.querySelector<HTMLElement>("#rightCorridor")
    const pagerLink = document.querySelector<HTMLElement>(".pager_ctrls > .prev_part")
    const subnavLink = document.querySelector<HTMLElement>(".subnav li a")
    const disabledPreviousIcon = document.querySelector<HTMLElement>(
      'a[aria-label="Föregående sida"][aria-disabled="true"] .navicon.left i'
    )
    if (!main || !pageName || !right || !pagerLink || !subnavLink || !disabledPreviousIcon) {
      throw new Error("Reader layout elements are missing")
    }
    return {
      disabledPreviousIconColor: getComputedStyle(disabledPreviousIcon, "::before").color,
      disabledPreviousIconOpacity: getComputedStyle(disabledPreviousIcon).opacity,
      mainFlex: getComputedStyle(main).flex,
      mainLeft: main.getBoundingClientRect().left,
      mainWidth: main.getBoundingClientRect().width,
      pageNameClientWidth: pageName.clientWidth,
      pageNameScrollWidth: pageName.scrollWidth,
      rightMarginLeft: getComputedStyle(right).marginLeft,
      rightLeft: right.getBoundingClientRect().left,
      pagerDisplay: getComputedStyle(pagerLink).display,
      pagerMinHeight: getComputedStyle(pagerLink).minHeight,
      pagerPaddingBottom: getComputedStyle(pagerLink).paddingBottom,
      subnavDisplay: getComputedStyle(subnavLink).display,
      subnavMinHeight: getComputedStyle(subnavLink).minHeight,
      subnavPaddingBottom: getComputedStyle(subnavLink).paddingBottom
    }
  })

  expect(layout).toMatchObject({
    disabledPreviousIconColor: "rgb(128, 128, 128)",
    disabledPreviousIconOpacity: "0.7",
    mainFlex: "0 1 auto",
    rightMarginLeft: "64px",
    pagerDisplay: "inline",
    pagerMinHeight: "0px",
    pagerPaddingBottom: "0px",
    subnavDisplay: "inline",
    subnavMinHeight: "0px",
    subnavPaddingBottom: "0px"
  })
  expect(layout.mainWidth).toBe(layout.pageNameClientWidth + 40)
  expect(layout.rightLeft - layout.mainLeft - layout.mainWidth).toBe(68.53125)
  expect(layout.pageNameScrollWidth).toBe(layout.pageNameClientWidth)
  await expect(page.locator(
    'a[aria-label="Föregående sida"][aria-disabled="true"] .navicon.left'
  )).toBeVisible()
  expect(problems).toEqual([])
})

test("preserves a work's fixed e-text width below the desktop breakpoint", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.setViewportSize({ width: 577, height: 747 })
  await page.goto(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-3/etext",
    { waitUntil: "networkidle" }
  )

  const layout = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".reader_main")
    const text = document.querySelector<HTMLElement>(".reader_main .etext")
    const right = document.querySelector<HTMLElement>("#rightCorridor")
    if (!main || !text || !right) throw new Error("Reader layout elements are missing")
    return {
      mainWidth: main.getBoundingClientRect().width,
      textWidth: text.getBoundingClientRect().width,
      rightGap: right.getBoundingClientRect().left - main.getBoundingClientRect().right
    }
  })

  expect(layout).toEqual({
    mainWidth: 540,
    textWidth: 540,
    rightGap: 20.53125
  })
  expect(problems).toEqual([])
})

test("uses the legacy fluid e-text width at the 560px mobile breakpoint", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-3/etext",
    { waitUntil: "networkidle" }
  )

  const layout = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".reader_main")
    const text = document.querySelector<HTMLElement>(".reader_main .etext")
    if (!main || !text) throw new Error("Reader layout elements are missing")
    return {
      mainWidth: main.getBoundingClientRect().width,
      textWidth: text.getBoundingClientRect().width
    }
  })

  expect(layout).toEqual({ mainWidth: 370, textWidth: 370 })
  expect(problems).toEqual([])
})

for (const focusPath of [readerPath, facsimilePath] as const) {
  test(`Escape exits Läsfokus through its raw-preserving replacement on ${focusPath}`, async ({
    page,
    request
  }) => {
    const problems = captureBrowserProblems(page)
    const rawQuery = "?bare&repeat=%2f&repeat=%2F&fokus&empty=#focus"
    await page.goto(`${focusPath}${rawQuery}`, { waitUntil: "networkidle" })
    await resetReader(request)
    await startHistoryMutationCounter(page)
    const historyLength = await page.evaluate(() => window.history.length)

    await page.keyboard.press("Escape")

    await expect(page).toHaveURL(`${focusPath}?bare&repeat=%2f&repeat=%2F&empty=#focus`)
    await expect(page.locator(".reader_main")).not.toHaveClass(/\bfocus\b/u)
    expect(await historyMutationCounts(page)).toEqual({ pushState: 0, replaceState: 1 })
    expect(await page.evaluate(() => window.history.length)).toBe(historyLength)
    expect(await readerManifestRequests(request)).toEqual([])
    expect(await readerHitRequests(request)).toEqual([])
    expect(problems).toEqual([])
  })
}

test("Läsfokus Escape yields to editable fields and Reader dialogs", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPath}?fokus`, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    const input = document.createElement("input")
    input.setAttribute("aria-label", "Tillfälligt redigerbart fält")
    document.body.append(input)
    input.focus()
  })
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(`${readerPath}?fokus`)

  await navigateClient(page, `${readerEncodedPath}?fokus&om-boken`)
  const dialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(dialog).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(`${readerPath}?fokus`)

  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(readerPath)
  expect(problems).toEqual([])
})

test("Läsfokus exposes a keyboard-operable toolbar visibility control", async ({ page }) => {
  await page.goto(`${readerPath}?fokus`, { waitUntil: "networkidle" })
  const toolbar = page.getByRole("toolbar", { name: "Läsfokus" })
  const hide = page.getByRole("button", { name: "Dölj verktygsfält" })
  await expect(toolbar).toBeVisible()
  await hide.focus()
  await hide.press("Enter")
  await expect(toolbar).toBeHidden()

  const show = page.getByRole("button", { name: "Visa verktygsfält" })
  await expect(show).toBeVisible()
  await show.focus()
  await show.press(" ")
  await expect(toolbar).toBeVisible()
  await expect(page).toHaveURL(`${readerPath}?fokus`)
})

test("Läsfokus page anchors preserve native modified clicks and normal history", async ({
  page
}) => {
  const rawQuery = "?bare&repeat=%2f&repeat=%2F&fokus#focus"
  await page.goto(`${readerPath}${rawQuery}`, { waitUntil: "networkidle" })
  const previousHref = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/" +
    `sida/-3/etext${rawQuery}`
  const nextHref = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/" +
    `sida/-1/etext${rawQuery}`
  const anchors = [
    page.locator(".reader-focus-layer > .leftCover"),
    page.locator(".reader-focus-layer > .rightCover"),
    page.locator(".reader-focus-layer .bottomBar > .nav.left"),
    page.locator(".reader-focus-layer .bottomBar > .nav.right")
  ]
  for (const [index, anchor] of anchors.entries()) {
    await expect(anchor).toHaveAttribute("href", index % 2 === 0 ? previousHref : nextHref)
  }
  const initialUrl = page.url()
  const historyLength = await page.evaluate(() => history.length)

  for (const anchor of anchors) {
    for (const init of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { button: 1 }
    ]) {
      const nativeAllowed = await anchor.evaluate((link, eventInit) => {
        let preventedByComponent: boolean | null = null
        link.addEventListener("click", event => {
          preventedByComponent = event.defaultPrevented
          event.preventDefault()
        }, { once: true })
        link.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          button: 0,
          ...eventInit
        }))
        return preventedByComponent === false
      }, init)
      expect(nativeAllowed).toBe(true)
      expect(page.url()).toBe(initialUrl)
    }
  }
  expect(await page.evaluate(() => history.length)).toBe(historyLength)

  await page.getByRole("button", { name: "Textinställningar" }).click()
  const night = page.getByRole("button", { name: "Nattläge" })
  await expect(night).toHaveAttribute("aria-pressed", "false")
  await night.click()
  await expect(night).toHaveAttribute("aria-pressed", "true")
  await expect(night).toContainText("Ljust läge")

  await anchors[3]!.click()
  await expect(page).toHaveURL(nextHref)
  expect(await page.evaluate(() => history.length)).toBe(historyLength + 1)
  await page.locator(".reader-focus-layer > .leftCover").click()
  await expect(page).toHaveURL(`${readerPath}${rawQuery}`)
  expect(await page.evaluate(() => history.length)).toBe(historyLength + 2)
})

test("adjacent Reader links preserve modified and non-primary browser clicks", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const initialUrl = page.url()
  const next = page.locator(".reader-navigation").getByRole("link", { name: "Nästa sida" })
  const intercepted = await next.evaluate(element => [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 }
  ].map(init => {
    let defaultPrevented = false
    element.addEventListener("click", event => {
      defaultPrevented = event.defaultPrevented
      event.preventDefault()
    }, { once: true })
    element.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ...init
    }))
    return defaultPrevented
  }))

  expect(intercepted).toEqual([false, false, false, false, false])
  await expect(page).toHaveURL(initialUrl)
})

test("Reader sidebar reveals one delayed text-only tooltip only for a distinct full title", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(facsimilePath, { waitUntil: "networkidle" })
  const title = page.locator(".reader-context").getByRole("link", {
    name: "Gösta Berlings saga"
  })
  await expect(title).toHaveAttribute(
    "data-reader-title-tooltip-content",
    "Gösta Berlings saga. Roman"
  )

  await title.dispatchEvent("mouseenter")
  await expect(page.getByRole("tooltip")).toHaveCount(0)
  await page.waitForTimeout(550)
  await expect(page.getByRole("tooltip")).toHaveText("Gösta Berlings saga. Roman")
  await expect(page.getByRole("tooltip")).toHaveCount(1)
  await expect(page.getByRole("tooltip").locator("a, button, input")).toHaveCount(0)
  await title.focus()
  await title.dispatchEvent("mouseleave")
  await expect(page.getByRole("tooltip")).toHaveCount(1)
  await title.blur()
  await expect(page.getByRole("tooltip")).toHaveCount(0)

  await title.focus()
  await page.waitForTimeout(550)
  await expect(page.getByRole("tooltip")).toHaveCount(1)
  await title.dispatchEvent("mouseenter")
  await title.blur()
  await expect(page.getByRole("tooltip")).toHaveCount(1)
  await title.dispatchEvent("mouseleave")
  await expect(page.getByRole("tooltip")).toHaveCount(0)

  await page.goto(boyeFacsimilePath, { waitUntil: "networkidle" })
  await expect(page.locator(".reader-context .title"))
    .not.toHaveAttribute("data-reader-title-tooltip-content")
  await page.locator(".reader-context .title").dispatchEvent("mouseenter")
  await page.waitForTimeout(550)
  await expect(page.getByRole("tooltip")).toHaveCount(0)
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
  await request.delete(`${fixture}/_reader_manifest_requests`)

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
  expect(await readerManifestRequests(request)).toEqual(Array(5).fill(
    "/v2/works/Lagerl%C3%B6fS/GostaBerlingsSaga/manifest?media_type=faksimil"
  ))
  expect(problems).toEqual([])
})

test("faksimil size replacement changes exact sources and stops at both edges", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(facsimilePath, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_manifest_requests`)

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
  expect(await readerManifestRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("sparse faksimil controls select nearest sizes and preserve replacement history", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  const historyBeforeReader = await page.evaluate(() => window.history.length)
  await navigateClient(
    page,
    `${storedSparseFacsimilePath}?bare&space=a%20b&storlek=2&repeat=%2f&repeat=%2F#scan`
  )
  const readerHistoryLength = await page.evaluate(() => window.history.length)
  expect(readerHistoryLength).toBe(historyBeforeReader + 1)

  const image = page.locator("img.faksimil")
  const controls = page.locator("#toolkit .reader-facsimile-size-controls")
  const smaller = controls.getByRole("button", { name: "Mindre" })
  const larger = controls.getByRole("button", { name: "Större" })
  await expect(image).toHaveAttribute("src", sparseFacsimileSource(2, 9))
  await expect(smaller).toBeDisabled()
  await expect(larger).toBeEnabled()

  await larger.click()
  await expect.poll(() => page.evaluate(() => location.pathname + location.search + location.hash))
    .toBe(`${storedSparseFacsimilePath}?bare&space=a%20b&storlek=4` +
      "&repeat=%2f&repeat=%2F#scan")
  await expect(image).toHaveAttribute("src", sparseFacsimileSource(4, 9))
  await expect(smaller).toBeEnabled()
  await expect(larger).toBeDisabled()
  expect(await page.evaluate(() => window.history.length)).toBe(readerHistoryLength)

  await smaller.click()
  await expect(page).toHaveURL(`${sparseFacsimilePath}?bare&space=a%20b&storlek=2` +
    "&repeat=%2f&repeat=%2F#scan")
  await expect(image).toHaveAttribute("src", sparseFacsimileSource(2, 9))
  expect(await page.evaluate(() => window.history.length)).toBe(readerHistoryLength)

  await page.goBack()
  await expect(page).toHaveURL("/bibliotek")
  await page.goForward()
  await expect(page).toHaveURL(`${sparseFacsimilePath}?bare&space=a%20b&storlek=2` +
    "&repeat=%2f&repeat=%2F#scan")
  expect(problems).toEqual([])
})

test("sparse faksimil Läsfokus controls select nearest sizes", async ({ page }) => {
  await page.goto(`${sparseFacsimilePath}?bare&storlek=2&fokus#scan`, {
    waitUntil: "networkidle"
  })
  await page.getByRole("button", { name: "Textinställningar" }).click()
  const smaller = page.getByRole("button", { name: "Mindre bild" })
  const larger = page.getByRole("button", { name: "Större bild" })
  await expect(smaller).toBeDisabled()
  await expect(larger).toBeEnabled()

  await larger.click()
  await expect(page).toHaveURL(`${sparseFacsimilePath}?bare&storlek=4&fokus#scan`)
  await expect(page.locator("img.faksimil")).toHaveAttribute(
    "src",
    sparseFacsimileSource(4, 9)
  )
  await expect(smaller).toBeEnabled()
  await expect(larger).toBeDisabled()
  await smaller.click()
  await expect(page).toHaveURL(`${sparseFacsimilePath}?bare&storlek=2&fokus#scan`)
})

test("retained sparse faksimil controls cannot rewrite a pending page identity", async ({
  page
}) => {
  await page.goto(`${sparseFacsimilePath}?storlek=2`, { waitUntil: "networkidle" })
  let releaseRequest!: () => void
  const release = new Promise<void>(resolve => { releaseRequest = resolve })
  let markRequestStarted!: () => void
  const requestStarted = new Promise<void>(resolve => { markRequestStarted = resolve })
  await page.route("**/api/reader/**/5/faksimil", async route => {
    markRequestStarted()
    await release
    await route.continue()
  })

  await activateReaderLink(
    page,
    "Nästa sida",
    "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/SparseFacsimileSizes/sida/5/faksimil" +
    "?storlek=2"
  )
  await requestStarted
  await expect(page).toHaveURL(
    "/författare/LagerlöfS/titlar/SparseFacsimileSizes/sida/5/faksimil?storlek=2"
  )
  await expect(page.locator("img.faksimil")).toHaveAttribute(
    "src",
    sparseFacsimileSource(2, 9)
  )
  await page.locator("#toolkit .reader-facsimile-size-controls")
    .getByRole("button", { name: "Större" }).click()
  await expect(page).toHaveURL(
    "/författare/LagerlöfS/titlar/SparseFacsimileSizes/sida/5/faksimil?storlek=2"
  )

  releaseRequest()
  await expect(page.locator("img.faksimil")).toHaveAttribute(
    "src",
    sparseFacsimileSource(2, 12)
  )
})

test("faksimil size replacement preserves raw query owners and its fragment", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  const rawQuery = "?bare&plus=a+b&space=a%20b&storlek=3" +
    "&repeat=%2f&repeat=%2F#scan%20nine"
  await page.goto(`${facsimilePath}${rawQuery}`, { waitUntil: "networkidle" })

  await page.locator("#toolkit .reader-facsimile-size-controls")
    .getByRole("button", { name: "Större" }).click()

  await expect.poll(() => page.evaluate(() => location.pathname + location.search + location.hash))
    .toBe(`${storedFacsimilePath}?bare&plus=a+b&space=a%20b&storlek=4` +
      "&repeat=%2f&repeat=%2F#scan%20nine")
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

test("faksimil page identity preserves work rotation but clears image error state", async ({
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
  if (testInfo.project.name !== "mobile-chromium") {
    await expect(image).toHaveCSS("transform", "matrix(0, 1, -1, 0, 0, 0)")
    await page.goBack()
    await expect(page).toHaveURL(facsimilePath)
    await expect(image).toHaveAttribute("src", facsimileSource(3, 9))
    await expect(image).toHaveCSS("transform", "matrix(0, 1, -1, 0, 0, 0)")
  }
  await expect(page.locator(".reader-facsimile-error[role=alert]")).toHaveCount(0)
  expect(problems).toEqual([])
})

test("faksimil rotation resets after a different media session", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Rotation controls are desktop-only")
  const problems = captureBrowserProblems(page)
  await page.goto(facsimilePath, { waitUntil: "networkidle" })
  await page.locator("#toolkit .reader-facsimile-rotation-controls")
    .getByRole("button", { name: "Höger" }).click()
  await expect(page.locator("img.faksimil"))
    .toHaveCSS("transform", "matrix(0, 1, -1, 0, 0, 0)")

  await navigateClient(page, readerEncodedPath)
  await expect(page).toHaveURL(readerPath)
  await expect(page.locator("img.faksimil")).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL(facsimilePath)
  await expect(page.locator("img.faksimil"))
    .toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)")
  expect(problems).toEqual([])
})

test("faksimil search state requests its own hits and exposes live navigation", async ({
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
  const query = "?q=kyrka&hit=0&traff=w58_123&traffslut=w58_123" +
    "&s_query=kyrka&s_lbworkid=lb3203777&s_mediatype=faksimil" +
    "&s_word_form_only=true&s_include_modernized=true&hit_index=0" +
    "&s_from=0&s_to=29&bare&repeat=%2f&repeat=%2F"
  const rallarliv = "/författare/AarnsethF/titlar/Rallarliv/sida/58/faksimil"
  await page.goto(`${rallarliv}${query}`, { waitUntil: "networkidle" })

  const toolkit = page.locator("#search_nav")
  await expect(toolkit).toContainText("Träff 1, sida 58")
  await expect(toolkit.getByRole("link", { name: "Nästa sökträff" })).toBeVisible()
  await expect(toolkit.getByRole("button", { name: "Gå till första träffen" })).toBeVisible()
  await expect(toolkit.getByRole("button", { name: "Gå till sista träffen" })).toBeVisible()
  await expect(toolkit.getByRole("button", { name: "Gå direkt till träff . . ." })).toBeVisible()

  await toolkit.getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page).toHaveURL(/\/sida\/99\/faksimil\?q=kyrka&hit=1/)
  await expect.poll(() => page.evaluate(() => location.search)).toContain("&bare&")
  await expect.poll(() => page.evaluate(() => location.search)).toContain(
    "&repeat=%2f&repeat=%2F"
  )
  await expect.poll(() => page.evaluate(() => location.search)).toContain(
    "&traff=w99_20&traffslut=w99_21"
  )
  await expect.poll(() => page.evaluate(() => location.search)).toContain("&hit_index=1")
  await expect(toolkit).toContainText("Träff 2, sida 99")
  await expect(page.locator(".reader_main .overlay #w99_20.markee")).toHaveCount(1)
  await expect(page.locator(".reader_main .overlay #w99_21.markee.flip")).toHaveCount(1)

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(/\/sida\/58\/faksimil\?q=kyrka&hit=0/)
  await expect(toolkit).toContainText("Träff 1, sida 58")
  await page.goForward({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(/\/sida\/99\/faksimil\?q=kyrka&hit=1/)
  await expect(toolkit).toContainText("Träff 2, sida 99")

  await toolkit.getByRole("button", { name: "Gå till första träffen" }).click()
  await expect(page).toHaveURL(/\/sida\/58\/faksimil\?q=kyrka&hit=0/)
  await expect(toolkit).toContainText("Träff 1, sida 58")
  await toolkit.getByRole("button", { name: "Gå till sista träffen" }).click()
  await expect(page).toHaveURL(/\/sida\/3\/faksimil\?q=kyrka&hit=2/)
  await expect(toolkit).toContainText("Träff 3, sida 3")

  await toolkit.getByRole("button", { name: "Gå direkt till träff . . ." }).click()
  const direct = toolkit.getByRole("textbox", { name: "Träffnummer" })
  await direct.fill("2")
  await direct.press("Enter")
  await expect(page).toHaveURL(/\/sida\/99\/faksimil\?q=kyrka&hit=1/)
  await expect(toolkit).toContainText("Träff 2, sida 99")
  const window0 = "media_type=faksimil&query=kyrka&offset=0&limit=3" +
    "&word_forms=false&include_older_spellings=true&prefix=false&suffix=false"
  const window1 = window0.replace("offset=0", "offset=1")
  expect(await readerHitRequests(request)).toEqual([
    { path: "/private-v2/works/lb3203777/search-hits", query: window0 },
    { path: "/v2/works/lb3203777/search-hits", query: window0 },
    { path: "/v2/works/lb3203777/search-hits", query: window0 },
    { path: "/v2/works/lb3203777/search-hits", query: window0 },
    { path: "/v2/works/lb3203777/search-hits", query: window0 },
    { path: "/v2/works/lb3203777/search-hits", query: window1 },
    { path: "/v2/works/lb3203777/search-hits", query: window0 }
  ])
  expect(publicHitRequests).toHaveLength(6)
  expect(publicHitRequests.every(url => new URL(url).searchParams.get("media_type") === "faksimil"))
    .toBe(true)
  expect(problems).toEqual([])
})

test("a selected faksimil search row marks its word in the OCR overlay", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  const query = "?traff=w3_147&traffslut=w3_147" +
    "&s_query=g%C3%B6sta&s_lbworkid=lb-reader-gosta-berlings-saga" +
    "&s_word_form_only=true&s_include_modernized=true&hit_index=0&s_from=0&s_to=29"

  const response = await page.goto(`${facsimilePath}${query}`, { waitUntil: "networkidle" })

  expect(response?.status()).toBe(200)
  await expect(page.locator(".reader_main .overlay #w3_147")).toHaveCount(1)
  await expect(page.locator(".reader_main .overlay #w3_147.markee")).toHaveCount(1)
  await expect(page.locator(".reader_main img.faksimil")).toBeVisible()
  await expect(page.locator(".reader_main")).not.toHaveClass(/\bocr\b/u)
  expect(await readerHitRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("leaving delayed faksimil hit mode aborts the obsolete request", async ({
  page,
  request
}) => {
  const rallarliv = "/författare/AarnsethF/titlar/Rallarliv/sida/58/faksimil"
  await page.goto(`${rallarliv}?q=kyrka&hit=0`, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)
  await request.put(`${fixture}/_reader_hit_delays`, {
    data: {
      ["lb3203777|kyrka|0|3|false|true|false|false"]: 600
    }
  })
  const failedRequests: string[] = []
  page.on("requestfailed", browserRequest => {
    if (new URL(browserRequest.url()).pathname.includes("/search-hits")) {
      failedRequests.push(browserRequest.url())
    }
  })

  await page.locator("#search_nav").getByRole("link", { name: "Nästa sökträff" }).click()
  await expect.poll(async () => (await readerHitRequests(request)).length).toBe(1)
  await navigateClient(page, rallarliv)

  await page.waitForTimeout(750)
  await expect(page).toHaveURL(rallarliv)
  await expect(page.locator("#search_nav, .reader-search-state")).toHaveCount(0)
  expect(failedRequests).toHaveLength(1)
})

test("malformed faksimil canonical search state fails closed without hit IO", async ({
  page,
  request
}) => {
  const rallarliv = "/författare/AarnsethF/titlar/Rallarliv/sida/58/faksimil"
  await page.goto(`${rallarliv}?q=kyrka&hit=01`, { waitUntil: "networkidle" })

  await expect(page.locator(".reader_main img.faksimil")).toBeVisible()
  await expect(page.locator("#search_nav, .reader-search-state")).toHaveCount(0)
  await expect(page.locator(".reader_main .markee")).toHaveCount(0)
  expect(await readerHitRequests(request)).toEqual([])
})

for (const mismatch of [
  {
    label: "faksimil word id bound to page index",
    path: "/författare/AarnsethF/titlar/Rallarliv/sida/58/faksimil",
    query: "faksimil-index-word",
    mediaType: "faksimil"
  },
  {
    label: "etext word id bound to numeric page name",
    path: readerPath,
    query: "etext-name-word",
    mediaType: "etext"
  }
]) {
  test(`${mismatch.label} fails closed without controls or marquee`, async ({
    page,
    request
  }) => {
    await page.goto(`${mismatch.path}?q=${mismatch.query}&hit=0`, {
      waitUntil: "networkidle"
    })

    await expect(page.locator(".reader-search-message")).toHaveText(
      "Sökträffen kunde inte hämtas."
    )
    await expect(page.locator(".reader-search-position, .reader-hit-navigation")).toHaveCount(0)
    await expect(page.locator("#search_nav").getByRole("link", {
      name: /^(?:Föregående|Nästa) sökträff$/
    })).toHaveCount(0)
    await expect(page.locator("#search_nav").getByRole("button", {
      name: /^(?:Gå till första träffen|Gå till sista träffen|Gå direkt till träff)/u
    })).toHaveCount(0)
    await expect(page.locator("#search_nav").getByRole("button", {
      name: "Stäng träffvisningen"
    })).toHaveCount(1)
    await expect(page.locator(".reader_main .markee")).toHaveCount(0)
    expect(await readerHitRequests(request)).toEqual([expect.objectContaining({
      path: expect.stringContaining("/works/"),
      query: expect.stringContaining(
        `media_type=${mismatch.mediaType}&query=${mismatch.query}`
      )
    })])
  })
}

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
    .getByRole("button", { name: "Sök i verket", exact: true })
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
  const firstHitPath = readerPath.replace("sida/-2", "sida/-3")
  await page.goto(`${readerPath}${rawQuery}`, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)

  const trigger = page.locator(".reader-context .subnav")
    .getByRole("button", { name: "Sök i verket", exact: true })
  await trigger.click()
  const searchbox = page.locator(".reader-context .searchbox")
  const input = searchbox.getByRole("searchbox")
  await expect(input).toHaveValue("old")
  await input.fill("  doktor glas  ")
  await searchbox.getByRole("button", { name: "Sök", exact: true }).click()

  const canonicalQuery = `${retained}&q=doktor+glas&hit=0`
  await expect(page).toHaveURL(`${firstHitPath}${canonicalQuery}`)
  await expect(page.locator("#search_nav")).toContainText("5 sökträffar")
  await expect(page.locator("#search_nav")).toContainText("Träff 1, sida -3")
  await expect(page.locator("#w1_1.markee")).toHaveCount(1)
  expect(await readerHitRequests(request)).toEqual(expect.arrayContaining([
    expect.objectContaining({
      path: "/v2/works/lb-reader-doktor-glas/search-hits",
      query: expect.stringContaining("query=doktor%20glas&offset=0&limit=3")
    })
  ]))

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(`${readerPath}${rawQuery}`)
  await expect(input).toHaveValue("old")
  await page.goForward({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(`${firstHitPath}${canonicalQuery}`)
  await expect(input).toHaveValue("doktor glas")
  await expect(page.locator("#search_nav")).toContainText("Träff 1, sida -3")
  await expect(page.locator("#w1_1.markee")).toHaveCount(1)
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
    .getByRole("button", { name: "Sök i verket", exact: true }).click()
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
  await page.locator("#search_nav").getByRole("button", {
    name: "Stäng träffvisningen"
  }).click()
  await expect(page).toHaveURL(`${readerPath}${retained}`)
  await expect(page.locator("#search_nav")).toHaveCount(0)
  await expect(searchbox).toBeHidden()
  await expect(searchbox.locator('input[type="search"]')).toHaveValue("")
  expect(problems).toEqual([])
})

test("keeps work-search submission on the current page for empty or invalid hit data", async ({
  page
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader-context .subnav")
    .getByRole("button", { name: "Sök i verket", exact: true }).click()
  const searchbox = page.locator(".reader-context .searchbox")
  const input = searchbox.getByRole("searchbox")

  await input.fill("inga")
  await searchbox.getByRole("button", { name: "Sök", exact: true }).click()
  await expect(searchbox.getByRole("status")).toHaveText("Inga träffar.")
  await expect(page).toHaveURL(readerPath)

  await input.fill("malformed-response")
  await searchbox.getByRole("button", { name: "Sök", exact: true }).click()
  await expect(searchbox.getByRole("status")).toHaveText("Sökningen kunde inte genomföras.")
  await expect(page).toHaveURL(readerPath)
})

test("a newer work-search submission cancels a delayed first-hit lookup", async ({
  page,
  request
}) => {
  const delayedKey = "lb-reader-doktor-glas|doktor glas|0|1|false|true|false|false"
  await request.put(`${fixture}/_reader_hit_delays`, { data: { [delayedKey]: 600 } })
  try {
    await page.goto(readerPath, { waitUntil: "networkidle" })
    await page.locator(".reader-context .subnav")
      .getByRole("button", { name: "Sök i verket", exact: true }).click()
    const searchbox = page.locator(".reader-context .searchbox")
    const input = searchbox.getByRole("searchbox")
    await input.fill("doktor glas")
    await searchbox.getByRole("button", { name: "Sök", exact: true }).click()
    await expect.poll(async () => (await readerHitRequests(request)).some(hit =>
      hit.query.includes("query=doktor%20glas&offset=0&limit=1")
    )).toBe(true)

    await input.fill("glas")
    await searchbox.getByRole("button", { name: "Sök", exact: true }).click()
    await expect(page).toHaveURL(`${readerPath}?q=glas&hit=0`)
    await expect(page.locator("#w2_2.markee")).toHaveCount(1)
    await page.waitForTimeout(700)
    await expect(page).toHaveURL(`${readerPath}?q=glas&hit=0`)
  } finally {
    await request.delete(`${fixture}/_reader_hit_delays`)
  }
})

test("a stale non-abort work-search failure cannot overwrite a newer result", async ({
  page
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    const scope = window as typeof window & { __staleWorkSearchStarted?: boolean }
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const request = input instanceof Request ? input : null
      const url = request?.url ?? String(input)
      if (url.includes("query=stale-error") && url.includes("limit=1")) {
        scope.__staleWorkSearchStarted = true
        return new Promise<Response>((_resolve, reject) => {
          setTimeout(() => reject(new Error("late fixture failure")), 600)
        })
      }
      return originalFetch(input, init)
    }
  })
  await page.locator(".reader-context .subnav")
    .getByRole("button", { name: "Sök i verket", exact: true }).click()
  const searchbox = page.locator(".reader-context .searchbox")
  const input = searchbox.getByRole("searchbox")
  await input.fill("stale-error")
  await searchbox.getByRole("button", { name: "Sök", exact: true }).click()
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __staleWorkSearchStarted?: boolean }
  ).__staleWorkSearchStarted)).toBe(true)

  await input.fill("glas")
  await searchbox.getByRole("button", { name: "Sök", exact: true }).click()
  await expect(page).toHaveURL(`${readerPath}?q=glas&hit=0`)
  await expect(page.locator("#w2_2.markee")).toHaveCount(1)
  await page.waitForTimeout(700)
  await expect(searchbox.getByRole("status")).toHaveCount(0)
})

test("canonical search options reject a mismatched legacy marker", async ({ page }) => {
  const legacyMarker = [
    "traff=w2_1",
    "traffslut=w2_1",
    "s_query=doktor%20glas",
    "s_lbworkid=lb-reader-doktor-glas",
    "s_mediatype=etext",
    "s_word_form_only=true",
    "s_include_modernized=true",
    "hit_index=1"
  ].join("&")
  await page.goto(
    `${readerPath}?q=doktor%20glas&hit=1&lemma=1&${legacyMarker}`,
    { waitUntil: "networkidle" }
  )

  await expect(page.locator("#w2_1.markee")).toHaveCount(1)
  await expect(page.locator("#w2_2.markee.flip")).toHaveCount(1)
  await expect(page.locator(".reader_main .markee")).toHaveCount(2)
})

test("canonical hit data overrides matching legacy state with forged word ids", async ({ page }) => {
  const legacyMarker = [
    "traff=w2_2",
    "traffslut=w2_2",
    "s_query=doktor%20glas",
    "s_lbworkid=lb-reader-doktor-glas",
    "s_mediatype=etext",
    "s_word_form_only=true",
    "s_include_modernized=true",
    "hit_index=1"
  ].join("&")
  await page.goto(
    `${readerPath}?q=doktor%20glas&hit=1&${legacyMarker}`,
    { waitUntil: "networkidle" }
  )

  await expect(page.locator("#w2_1.markee")).toHaveCount(1)
  await expect(page.locator("#w2_2.markee.flip")).toHaveCount(1)
  await expect(page.locator(".reader_main .markee")).toHaveCount(2)
})

test("closing mixed search state removes legacy markers but preserves its return owner", async ({
  page
}) => {
  const origin = "/s%C3%B6k?fras=doktor"
  const legacyMarker = [
    "traff=w2_1",
    "traffslut=w2_1",
    "s_query=doktor%20glas",
    "s_lbworkid=lb-reader-doktor-glas",
    "s_mediatype=etext",
    "s_word_form_only=true",
    "s_include_modernized=true",
    "s_prefix=true",
    "s_suffix=true",
    "hit_index=1"
  ].join("&")
  await page.goto(
    `${readerPath}?bare&q=doktor%20glas&hit=1&${legacyMarker}`
    + `&s_return=${encodeURIComponent(origin)}`,
    { waitUntil: "networkidle" }
  )

  await page.locator("#search_nav").getByRole("button", {
    name: "Stäng träffvisningen"
  }).click()

  await expect(page.locator("#search_nav")).toHaveCount(0)
  await expect(page.locator(".reader_main .markee")).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => ({
    bare: location.search.includes("?bare&") || location.search.endsWith("?bare"),
    keys: [...new URLSearchParams(location.search).keys()],
    searchReturn: new URLSearchParams(location.search).get("s_return")
  }))).toEqual({ bare: true, keys: ["bare", "s_return"], searchReturn: origin })
})

test("projects Angular work-search options onto canonical generated hit flags", async ({
  page,
  request
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader-context .subnav")
    .getByRole("button", { name: "Sök i verket", exact: true }).click()
  const searchbox = page.locator(".reader-context .searchbox")
  await searchbox.getByRole("button", { name: "INKLUDERA BÖJNINGSFORMER" }).click()
  await expect(searchbox.getByRole("button", {
    name: "Valt: INKLUDERA BÖJNINGSFORMER"
  })).toBeVisible()
  await searchbox.getByRole("searchbox").fill("glas")
  await request.delete(`${fixture}/_reader_hit_requests`)
  await searchbox.getByRole("button", { name: "Sök", exact: true }).click()

  await expect(page).toHaveURL(`${readerPath}?q=glas&hit=0&lemma=1&ej_modern=1`)
  await expect.poll(async () => (await readerHitRequests(request)).length).toBe(2)
  expect(await readerHitRequests(request)).toEqual([
    expect.objectContaining({
      query: "media_type=etext&query=glas&offset=0&limit=1" +
        "&word_forms=true&include_older_spellings=false&prefix=false&suffix=false"
    }),
    expect.objectContaining({
      query: "media_type=etext&query=glas&offset=0&limit=3" +
        "&word_forms=true&include_older_spellings=false&prefix=false&suffix=false"
    })
  ])
})

test("work-search actions expose native keyboard-operable buttons", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader-context .subnav")
    .getByRole("button", { name: "Sök i verket", exact: true }).click()
  const searchbox = page.locator(".reader-context .searchbox")
  const prefix = searchbox.getByRole("button", { name: "SÖK EFTER ORDBÖRJAN" })

  await prefix.focus()
  await expect(prefix).toBeFocused()
  await prefix.press(" ")
  const selectedPrefix = searchbox.getByRole("button", {
    name: "Valt: SÖK EFTER ORDBÖRJAN"
  })
  await expect(selectedPrefix).toBeVisible()
  await selectedPrefix.press("Enter")
  await expect(searchbox.getByRole("button", { name: "SÖK EFTER ORDBÖRJAN" })).toBeVisible()
  await expect(searchbox.getByRole("checkbox")).toHaveCount(0)
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
  await toolkit.getByRole("button", { name: "Gå till sista träffen" }).click()
  const lastQuery = `?${rawOwners}&q=doktor%20glas&hit=4`
  await expect.poll(() => page.evaluate(() => location.pathname + location.search))
    .toBe(`${storedNextReaderPath}${lastQuery}`)
  await expect(toolkit).toContainText("Träff 5, sida -1")
  await expect(page.locator("#w3_2.markee")).toHaveCount(1)
  expect(await readerHitRequests(request)).toContainEqual(expect.objectContaining({
    path: "/v2/works/lb-reader-doktor-glas/search-hits",
    query: expect.stringContaining("query=doktor%20glas&offset=3&limit=3")
  }))

  await page.goBack({ waitUntil: "networkidle" })
  await expect.poll(() => page.evaluate(() => location.pathname + location.search))
    .toBe(initialEncodedPath)
  await expect(toolkit).toContainText("Träff 2, sida -2")

  await toolkit.getByRole("button", { name: "Gå till första träffen" }).click()
  const firstQuery = `?${rawOwners}&q=doktor%20glas&hit=0`
  await expect.poll(() => page.evaluate(() => location.pathname + location.search))
    .toBe(`${storedReaderPath.replace("/sida/-2/", "/sida/-3/")}${firstQuery}`)
  await expect(toolkit).toContainText("Träff 1, sida -3")
  await expect(page.locator("#w1_1.markee")).toHaveCount(1)
  const historyLength = await page.evaluate(() => window.history.length)
  await toolkit.getByRole("button", { name: "Gå till första träffen" }).click()
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
  const trigger = toolkit.getByRole("button", { name: "Gå direkt till träff . . ." })
  await trigger.click()
  const input = toolkit.getByRole("textbox", { name: "Träffnummer" })
  const submit = toolkit.getByRole("button", { name: "Gå till träff" })
  await expect(input).toBeVisible()
  await expect(submit).toBeVisible()
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
  await submit.click()
  const targetQuery = `?${rawOwners}&q=doktor%20glas&hit=3`
  await expect.poll(() => page.evaluate(() => location.pathname + location.search))
    .toBe(`${storedNextReaderPath}${targetQuery}`)
  await expect(page).toHaveURL(`${storedNextReaderPath}${targetQuery}#direct-hit`)
  await expect(toolkit).toContainText("Träff 4, sida -1")
  await expect(page.locator("#w3_1.markee")).toHaveCount(1)
  await expect(toolkit.getByRole("textbox", { name: "Träffnummer" })).toHaveCount(0)
  expect(await readerHitRequests(request)).toContainEqual(expect.objectContaining({
    path: "/v2/works/lb-reader-doktor-glas/search-hits",
    query: expect.stringContaining("query=doktor%20glas&offset=2&limit=3")
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
  await toolkit.getByRole("button", { name: "Gå till första träffen" }).click()
  await toolkit.getByRole("button", { name: "Gå till sista träffen" }).click()
  const direct = toolkit.getByRole("button", { name: "Gå direkt till träff . . ." })
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

test("direct hit lookup keeps its API window inside the maximum offset", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPath}?q=max-direct&hit=999999`, { waitUntil: "networkidle" })
  await expect(page.locator("#search_nav")).toContainText("Träff 1000000, sida -2")
  await request.delete(`${fixture}/_reader_hit_requests`)

  const toolkit = page.locator("#search_nav")
  await toolkit.getByRole("button", { name: "Gå direkt till träff . . ." }).click()
  const input = toolkit.getByRole("textbox", { name: "Träffnummer" })
  await input.fill("1000002")
  await input.press("Enter")

  await expect(page).toHaveURL(/\?q=max-direct&hit=1000001$/u)
  await expect(toolkit).toContainText("Träff 1000002, sida -2")
  expect(await readerHitRequests(request)).toEqual([
    expect.objectContaining({
      query: expect.stringContaining("query=max-direct&offset=1000000&limit=3")
    }),
    expect.objectContaining({
      query: expect.stringContaining("query=max-direct&offset=1000000&limit=3")
    })
  ])
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
    "3",
    "3",
    "false",
    "true",
    "false",
    "false"
  ].join("|")
  await request.put(`${fixture}/_reader_hit_delays`, {
    data: { [slowTargetKey]: 350 }
  })
  await page.evaluate(() => {
    const scope = window as typeof window & {
      __readerDirectHitAbortSeen?: boolean
    }
    scope.__readerDirectHitAbortSeen = false
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const request = input instanceof Request ? input : null
      const url = request?.url ?? String(input)
      const signal = request?.signal ?? init?.signal
      if (url.includes("/search-hits") && url.includes("offset=3")) {
        signal?.addEventListener("abort", () => {
          scope.__readerDirectHitAbortSeen = true
        }, { once: true })
      }
      return originalFetch(input, init)
    }
  })

  await page.locator("#search_nav")
    .getByRole("button", { name: "Gå till sista träffen" }).click()
  await expect.poll(async () => (await readerHitRequests(request)).some(
    hit => hit.query.includes("offset=3&limit=3")
  )).toBe(true)

  await navigateClient(page, `${storedReaderPath}?q=glas&hit=0`)
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __readerDirectHitAbortSeen?: boolean }
  ).__readerDirectHitAbortSeen)).toBe(true)
  await expect(page.locator("#search_nav")).toContainText("Träff 1, sida -2")
  await navigateClient(page, sourcePath)
  await expect(page.locator("#search_nav")).toContainText("Träff 2, sida -2")

  await page.waitForTimeout(450)
  await expect(page).toHaveURL(/\/sida\/-2\/etext\?q=doktor(?:%20|\+)glas&hit=1$/)
  await expect(page.locator("#search_nav")).toContainText("Träff 2, sida -2")
  await expect(page.locator("#w2_1.markee")).toHaveCount(1)
  expect(problems).toEqual([])
})

test("closing hit view synchronously aborts a pending direct target lookup", async ({
  page,
  request
}) => {
  const sourcePath = `${storedReaderPath}?q=doktor%20glas&hit=1`
  const slowTargetKey = "lb-reader-doktor-glas|doktor glas|3|3|false|true|false|false"
  await request.put(`${fixture}/_reader_hit_delays`, {
    data: { [slowTargetKey]: 600 }
  })
  try {
    await page.goto(sourcePath, { waitUntil: "networkidle" })
    await request.delete(`${fixture}/_reader_hit_requests`)
    await page.evaluate(() => {
      const scope = window as typeof window & { __readerDirectHitAbortSeen?: boolean }
      scope.__readerDirectHitAbortSeen = false
      const originalFetch = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const request = input instanceof Request ? input : null
        const url = request?.url ?? String(input)
        const signal = request?.signal ?? init?.signal
        if (url.includes("/search-hits") && url.includes("offset=3")) {
          signal?.addEventListener("abort", () => {
            scope.__readerDirectHitAbortSeen = true
          }, { once: true })
        }
        return originalFetch(input, init)
      }
    })
    const navigation = page.locator("#search_nav")
    await navigation.getByRole("button", { name: "Gå till sista träffen" }).click()
    await expect.poll(async () => (await readerHitRequests(request)).some(
      hit => hit.query.includes("offset=3&limit=3")
    )).toBe(true)

    const abortedSynchronously = await navigation.evaluate(element => {
      const close = [...element.querySelectorAll<HTMLButtonElement>("button")]
        .find(button => button.textContent?.trim() === "Stäng träffvisningen")!
      close.click()
      return (window as typeof window & { __readerDirectHitAbortSeen?: boolean })
        .__readerDirectHitAbortSeen
    })
    expect(abortedSynchronously).toBe(true)
    await expect(page).toHaveURL(storedReaderPath)
    await page.waitForTimeout(700)
    await expect(page).toHaveURL(storedReaderPath)
  } finally {
    await request.delete(`${fixture}/_reader_hit_delays`)
  }
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
    "3",
    "3",
    "false",
    "true",
    "false",
    "false"
  ].join("|")
  await request.put(`${fixture}/_reader_hit_delays`, {
    data: { [slowTargetKey]: 700 }
  })

  await page.locator("#search_nav")
    .getByRole("button", { name: "Gå till sista träffen" }).click()
  await expect.poll(async () => (await readerHitRequests(request)).some(
    hit => hit.query.includes("offset=3&limit=3")
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
  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(0)
  await expect(page.locator('link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'))
    .toHaveCount(0)
  await expect(page.locator("style[data-reader-shared-styles]"))
    .toHaveCount(1)
  await expect(page.locator("style[data-reader-shared-styles]"))
    .toHaveAttribute("data-hid", "reader-shared-styles")
  await expect(page.locator("style[data-reader-work-styles]")).toHaveCount(1)
  await expect(page.locator("style[data-reader-work-styles]"))
    .toHaveAttribute("data-hid", "reader-work-styles")
  expect(await rawStoredPageViews(page)).toBe(historyBefore)

  releaseRequest()
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("NÄSTA SIDA")
  await expect(page.locator(".reader-context .current_part .navtitle")).toHaveText("Doktor Glas")
  await expect(page.locator('meta[name="part"]')).toHaveAttribute("content", "DoktorGlas")
  await expect(page).toHaveTitle("Doktor Glas sida -1 etext | Litteraturbanken")
  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(0)
  await expect(page.locator('link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'))
    .toHaveCount(0)
  await expect(page.locator("style[data-reader-shared-styles]")).toHaveCount(1)
  await expect(page.locator("style[data-reader-shared-styles]"))
    .toHaveAttribute("data-hid", "reader-shared-styles")
  await expect(page.locator("style[data-reader-work-styles]")).toHaveCount(1)
  await expect(page.locator("style[data-reader-work-styles]"))
    .toHaveAttribute("data-hid", "reader-work-styles")
  await expect.poll(async () => (await storedPageViews(page))[0]?.pagename).toBe("-1")
  expect(problems).toEqual([])
})

test("an obsolete successful Reader request cannot replace the newest page", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  const start = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext"
  const delayed = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
  const newest = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"
  await page.goto(start, { waitUntil: "networkidle" })

  let releaseDelayedRequest!: () => void
  const release = new Promise<void>(resolve => { releaseDelayedRequest = resolve })
  let markDelayedRequestStarted!: () => void
  const delayedRequestStarted = new Promise<void>(resolve => {
    markDelayedRequestStarted = resolve
  })
  await page.route("**/api/reader/**/-2/etext", async route => {
    markDelayedRequestStarted()
    await release
    await route.continue()
  })

  await navigateClient(page, delayed)
  await delayedRequestStarted
  await navigateClient(page, newest)
  await expect(page).toHaveURL(newest)
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("NÄSTA SIDA")

  const delayedResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname.endsWith("/api/reader/S%C3%B6derbergH/DoktorGlas/-2/etext")
  )
  releaseDelayedRequest()
  await delayedResponse
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("NÄSTA SIDA")
  expect(problems).toEqual([])
})

test("a remounted Reader never exposes a retained page under a different page URL", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 3")
  await navigateClient(page, "/bibliotek")
  await expect(page).toHaveURL(/\/bibliotek$/u)
  await expect(page.locator('[data-library-mounted="true"]')).toBeAttached()
  await expect(page.locator(".reader_main")).toHaveCount(0)

  let releaseRequest!: () => void
  const release = new Promise<void>(resolve => { releaseRequest = resolve })
  let markRequestStarted!: () => void
  const requestStarted = new Promise<void>(resolve => { markRequestStarted = resolve })
  await page.route("**/api/reader/**/-1/etext", async route => {
    markRequestStarted()
    await release
    await route.continue()
  })

  await page.evaluate(nextPath => {
    const nuxt = (window as typeof window & { useNuxtApp?: () => {
      $router: { push: (target: string) => Promise<unknown> }
    } }).useNuxtApp?.()
    void nuxt?.$router.push(nextPath)
  }, storedNextReaderPath)
  await requestStarted

  await expect(page).toHaveURL(storedNextReaderPath)
  await expect(page.locator(".reader_main")).toHaveCount(0)
  await expect(page.locator(".reader-page-position")).toHaveCount(0)
  await expect(page).not.toHaveTitle("Doktor Glas sida -2 etext | Litteraturbanken")

  releaseRequest()
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("NÄSTA SIDA")
  await expect(page).toHaveTitle("Doktor Glas sida -1 etext | Litteraturbanken")
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
  await expect(page.locator("#search_nav").getByRole("button", {
    name: /^(?:Gå till första träffen|Gå till sista träffen|Gå direkt till träff)/u
  })).toHaveCount(0)
  await expect(page.locator("#search_nav").getByRole("button", {
    name: "Stäng träffvisningen"
  })).toHaveCount(1)
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
    const scope = window as typeof window & { __readerHitFailureSeen?: boolean }
    scope.__readerHitFailureSeen = false
    const recordFailure = () => {
      if (document.body.textContent?.includes("Sökträffen kunde inte hämtas.")) {
        scope.__readerHitFailureSeen = true
      }
    }
    new MutationObserver(recordFailure).observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    })
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
  expect(await page.evaluate(() => (
    window as typeof window & { __readerHitFailureSeen?: boolean }
  ).__readerHitFailureSeen)).toBe(false)
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

test("a direct unknown Reader page renders the work-specific 404 without HTML injection", async ({
  page
}) => {
  const pageName = "A&B'<img src=x onerror=alert(1)>"
  const response = await page.goto(
    `/författare/SöderbergH/titlar/DoktorGlas/sida/${encodeURIComponent(pageName)}/etext`,
    { waitUntil: "networkidle" }
  )

  expect(response?.status()).toBe(404)
  await expect(page).toHaveTitle("Sidan kan inte hittas | Litteraturbanken")
  await expect(page.locator("#mainview")).toHaveText(
    `Hittar ingen sida '${pageName}' i verket.`
  )
  await expect(page.locator("#mainview img, #mainview script")).toHaveCount(0)
  await expect(page.locator("#mainview")).not.toContainText(
    "Du har angett en adress som inte finns"
  )
})

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

test("return link on faksimil preserves its origin while loading faksimil hits", async ({
  page,
  request
}) => {
  const origin = "/s%C3%B6k?fras=frihet&traffsida=2"
  await request.delete(`${fixture}/_reader_hit_requests`)
  await page.goto(`${facsimilePath}?q=frihet&hit=0&s_return=${encodeURIComponent(origin)}`, {
    waitUntil: "networkidle"
  })

  await expect(page.locator("#search_nav").getByRole("link", {
    name: "Tillbaka till sökningen"
  })).toHaveAttribute("href", origin)
  await page.locator("#search_nav").getByRole("button", {
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
  const hitRequests = await readerHitRequests(request)
  expect(hitRequests).toEqual([{
    path: "/private-v2/works/lb-reader-gosta-berlings-saga/search-hits",
    query: "media_type=faksimil&query=frihet&offset=0&limit=3" +
      "&word_forms=false&include_older_spellings=true&prefix=false&suffix=false"
  }])
  expect(hitRequests.some(hitRequest => (
    new URLSearchParams(hitRequest.query).get("media_type") === "etext"
  ))).toBe(false)
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

test("a sparse page map with a declared count does not advertise a slider", async ({ page }) => {
  await page.goto(sparseSliderReaderPath, { waitUntil: "networkidle" })

  await expect(page.getByRole("slider", { name: "Gå till sida" })).toHaveCount(0)
})

test("page-position slider previews pointer input and commits exactly once on release", async ({
  page,
  request
}) => {
  const rawQuery = "?bare&empty=&repeat=%2f&repeat=%2F&Mixed=%2a#slider"
  await page.goto(`${countedSliderReaderPath}${rawQuery}`, { waitUntil: "networkidle" })
  const slider = page.getByRole("slider", { name: "Gå till sida" })
  const initialBrowserPath = await page.evaluate(
    () => location.pathname + location.search + location.hash
  )
  await request.delete(`${fixture}/_reader_requests`)
  await startHistoryMutationCounter(page)

  await slider.evaluate(input => {
    const range = input as HTMLInputElement
    range.value = "3"
    range.dispatchEvent(new Event("input", { bubbles: true }))
    range.value = "0"
    range.dispatchEvent(new Event("input", { bubbles: true }))
    range.value = "3"
    range.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await expect(slider).toHaveValue("3")
  const bubble = page.locator(".reader-context .rz-bubble.rz-model-value")
  await expect(bubble).toHaveText("-1")
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
  const rawTarget = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/CountedSliderReader/sida/-1/etext" + rawQuery
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
    request.delete(`${fixture}/_reader_manifest_requests`),
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

  await expect.poll(async () => readerManifestRequests(request), { timeout: 2_000 })
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

test("a successful leave disposes queued Reader page navigations", async ({ page }) => {
  const start = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-4/etext"
  await page.goto(start, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        beforeEach: (guard: (to: { fullPath: string }) => unknown) => void
      } } } }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    const state = window as typeof window & {
      __readerLeaveQueue?: { started: boolean, release?: () => void }
    }
    state.__readerLeaveQueue = { started: false }
    router.beforeEach(to => {
      if (
        state.__readerLeaveQueue!.started
        || !to.fullPath.endsWith("/sida/-3/etext")
      ) return
      state.__readerLeaveQueue!.started = true
      return new Promise<void>(resolve => {
        state.__readerLeaveQueue!.release = resolve
      })
    })
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "n" }))
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "n" }))
  })
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & {
    __readerLeaveQueue?: { started: boolean }
  }).__readerLeaveQueue?.started))).toBe(true)

  await page.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        push: (path: string) => Promise<unknown>
      } } } }
    }
    await root.__vue_app__?.config.globalProperties.$router.push("/bibliotek")
  })
  await expect(page).toHaveURL(/\/bibliotek$/u)

  await page.evaluate(() => {
    const queue = (window as typeof window & {
      __readerLeaveQueue?: { release?: () => void }
    }).__readerLeaveQueue
    if (!queue?.release) throw new Error("queued Reader navigation was not delayed")
    queue.release()
  })
  await page.waitForTimeout(100)
  await expect(page).toHaveURL(/\/bibliotek$/u)
})

test("a bare page-position track click previews its integer and commits once", async ({
  page,
  request
}) => {
  await page.goto(countedSliderReaderPath, { waitUntil: "networkidle" })
  const slider = page.getByRole("slider", { name: "Gå till sida" })
  await slider.scrollIntoViewIfNeeded()
  const box = await slider.boundingBox()
  expect(box).not.toBeNull()
  await request.delete(`${fixture}/_reader_requests`)
  await startHistoryMutationCounter(page)

  const targetIndex = 3
  const targetX = box!.x + 10 + (box!.width - 20) * targetIndex / 3
  await page.mouse.click(targetX, box!.y + box!.height / 2)

  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/CountedSliderReader/sida/-1/etext"
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
  await page.goto(countedSliderReaderPath, { waitUntil: "networkidle" })
  const slider = page.getByRole("slider", { name: "Gå till sida" })
  await slider.focus()
  await page.keyboard.down("End")
  await expect(slider).toHaveValue("3")
  await slider.blur()
  await page.keyboard.up("End")
  await expect(page).toHaveURL(countedSliderReaderPath)
  await expect(slider).toHaveValue("2")

  await request.delete(`${fixture}/_reader_requests`)
  await startHistoryMutationCounter(page)
  const box = await slider.boundingBox()
  expect(box).not.toBeNull()
  const startX = box!.x + 10 + (box!.width - 20) * 2 / 3
  const maximumX = box!.x + box!.width - 10
  const y = box!.y + box!.height / 2

  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(maximumX, y, { steps: 2 })
  await page.mouse.up()
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/CountedSliderReader/sida/-1/etext"
  )
  expect(await historyMutationCounts(page)).toEqual({ pushState: 1, replaceState: 1 })
})

test("page-position slider clears committed drafts across A-B-A and aligns the hit bubble", async ({
  page,
  request
}) => {
  await page.goto(countedSliderReaderPath, { waitUntil: "networkidle" })
  await request.put(`${fixture}/_reader_manifest_delays`, {
    data: { CountedSliderReader: 350 }
  })
  const slider = page.getByRole("slider", { name: "Gå till sida" })
  await slider.focus()
  await page.keyboard.down("End")
  await page.keyboard.up("End")
  await expect(page).toHaveURL(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/CountedSliderReader/sida/-1/etext"
  )
  await page.goBack()
  await expect(page).toHaveURL(countedSliderReaderPath)
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
