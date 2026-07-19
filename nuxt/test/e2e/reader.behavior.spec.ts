import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page
} from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const readerPartsPath = "/författare/SöderbergH/titlar/DoktorGlasParts/sida/-1/etext"
const workScopedReaderPath = "/författare/SöderbergH/titlar/WorkScopedIdsReader/sida/-2/etext"
const readerEncodedPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const readerPublicCanonicalPath = "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const readerShorthandPath = "/författare/SöderbergH/titlar/DoktorGlas/etext"
const readerShorthandRouterPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/etext"
const storedReaderPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const storedNextReaderPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"
const facsimilePath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"
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
    request.delete(`${fixture}/_reader_hit_delays`)
  ])
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

async function readerMetadataRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_metadata_requests`)).json()).requests
}

type ReaderHitRequest = { path: string, query: string }

async function readerHitRequests(request: APIRequestContext): Promise<ReaderHitRequest[]> {
  return (await (await request.get(`${fixture}/_reader_hit_requests`)).json()).requests
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (
      /hydration/i.test(message.text()) ||
      (message.type() === "error" && !message.text().startsWith("Failed to load resource:"))
    ) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
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

test.beforeEach(async ({ request }) => resetReader(request))

test("part-rich sidebar exposes truthful authors, metadata, and raw-preserving targets", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  const rawQuery =
    "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F" +
    "&q=inga&hit=0&storlek=3&innehall"
  await page.goto(`${readerPartsPath}${rawQuery}`, { waitUntil: "networkidle" })

  const context = page.locator(".reader-context")
  const currentPart = context.locator(".current_part")
  await expect(currentPart.locator(".navtitle")).toHaveText("Överlappningen")
  await expect(currentPart.locator(".navtitle").locator(".."))
    .toHaveAttribute("title", "Den överlappande delen")
  await expect(currentPart.locator(".header").getByRole("link", { name: "Rilke" }))
    .toHaveAttribute("href", "/författare/RilkeRM")
  await expect(currentPart.locator(".header").getByRole("link", { name: "Shelley" }))
    .toHaveAttribute("href", "/författare/ShelleyPB")
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
  await expect(context.locator('div[aria-hidden="true"] > .rzslider')).toHaveCount(1)
  await expect(context.locator(".expl.small")).toHaveAttribute("aria-hidden", "true")
  expect(problems).toEqual([])
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
    "/författare/S%C3%B6derbergH/titlar/DoktorGlas/etext?om-boken"
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
  await expect(page.getByRole("link", { name: "Hjalmar Söderberg" }).first()).toHaveAttribute(
    "href",
    "/författare/S%C3%B6derbergH"
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

test("a failed faksimil scan stays bounded while context and navigation contract remain intact", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  const documentRequests: string[] = []
  page.on("request", browserRequest => {
    if (browserRequest.resourceType() === "document") {
      documentRequests.push(browserRequest.url())
    }
  })
  await page.route("**/*_0009.jpeg", async route => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "missing" })
  })

  const response = await page.goto(facsimilePath, { waitUntil: "networkidle" })
  documentRequests.length = 0

  expect(response?.status()).toBe(200)
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
    "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext?q=doktor+glas&hit=1"
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
    "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext?q=doktor+glas&hit=3"
  )
  await expect(toolkit.getByRole("link", { name: "Nästa sökträff" })).toHaveCount(0)
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

test("a delayed primary Reader request never renders the prior page under the new URL", async ({
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
  await expect(page.locator(".reader-primary-loading")).toHaveText("Hämtar läsarsidan …")
  await expect(page.locator(".reader_main")).toHaveCount(0)
  await expect(page.locator(".reader-page-position")).toHaveCount(0)
  await expect(page.locator("#toolkit > #search_nav")).toHaveCount(0)
  await expect(page.locator(".reader-context .current_part")).toHaveCount(0)
  await expect(page.locator('meta[name="part"]')).toHaveCount(0)
  await expect(page).toHaveTitle("Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveCount(0)
  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(0)
  await expect(page.locator('link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'))
    .toHaveCount(0)
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
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPath}?q=doktor%20glas&hit=1`, { waitUntil: "networkidle" })
  const historyBefore = await rawStoredPageViews(page)
  await page.route("**/api/reader/**/-1/etext", async route => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Reader unavailable" })
    })
  })

  await activateReaderLink(
    page,
    "Nästa sida",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext?q=doktor%20glas&hit=1"
  )
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
  const problems = captureBrowserProblems(page)
  await page.goto(`${readerPath}?q=doktor%20glas&hit=1`, { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)
  await request.put(`${fixture}/_reader_hit_failure`)

  await page.locator("#search_nav").getByRole("link", { name: "Nästa sökträff" }).click()
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
