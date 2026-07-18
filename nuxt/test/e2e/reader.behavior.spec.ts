import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const readerEncodedPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const readerPublicCanonicalPath = "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const readerShorthandPath = "/författare/SöderbergH/titlar/DoktorGlas/etext"
const readerShorthandRouterPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/etext"
const storedReaderPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
const storedNextReaderPath = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"

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
    request.delete(`${fixture}/_reader_metadata_delays`),
    request.delete(`${fixture}/_reader_hit_requests`),
    request.delete(`${fixture}/_reader_hit_failure`),
    request.delete(`${fixture}/_reader_hit_delays`)
  ])
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
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

test.beforeEach(async ({ request }) => resetReader(request))

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
  await expect(page.getByRole("link", { name: "Hjalmar Söderberg" })).toHaveAttribute(
    "href",
    "/författare/S%C3%B6derbergH"
  )
  await expect(page.locator(".reader-page-position")).toHaveText("-2 av 3")
  await expect(page.getByRole("link", { name: "Föregående sida" })).toHaveAttribute(
    "href",
    "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext"
  )
  await expect(page.getByRole("link", { name: "Nästa sida" })).toHaveAttribute(
    "href",
    "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"
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
  await page.locator(".reader-navigation").getByRole("link", { name: "Nästa sida" }).click()
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

  await page.locator(".reader-navigation").getByRole("link", { name: "Nästa sida" }).click()
  await requestStarted
  await expect(page).toHaveURL(/\/sida\/-1\/etext\?q=doktor\+glas&hit=1$/)
  await expect(page.locator(".reader-primary-loading")).toHaveText("Hämtar läsarsidan …")
  await expect(page.locator(".reader_main")).toHaveCount(0)
  await expect(page.locator(".reader-page-position")).toHaveCount(0)
  await expect(page.locator("#toolkit > #search_nav")).toHaveCount(0)
  await expect(page).toHaveTitle("Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveCount(0)
  await expect(page.locator('link[href="/red/css/etext.css"]')).toHaveCount(0)
  await expect(page.locator('link[href="/txt/css/lb-reader-doktor-glas-etext.css"]'))
    .toHaveCount(0)
  expect(await rawStoredPageViews(page)).toBe(historyBefore)

  releaseRequest()
  await expect(page.locator(".reader-page-position")).toHaveText("-1 av 3")
  await expect(page.locator(".reader_main .etext.txt")).toContainText("NÄSTA SIDA")
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

  await page.locator(".reader-navigation").getByRole("link", { name: "Nästa sida" }).click()
  await expect(page).toHaveURL(/\/sida\/-1\/etext\?q=doktor\+glas&hit=1$/)
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
    page.getByRole("link", { name: "Nästa sida" }).click()
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
  test(`${name} is replaced by a valid fresh Reader history`, async ({ page }) => {
    await seedStoredPageViews(page, raw)

    await page.goto(readerPath, { waitUntil: "networkidle" })

    const records = await storedPageViews(page)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      lbworkid: "lb-reader-doktor-glas",
      pagename: "-2",
      url: storedReaderPath
    })
  })
}

for (const method of ["getItem", "setItem"] as const) {
  test(`throwing Storage.${method} does not break the Reader`, async ({ page }) => {
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

    const response = await page.goto(readerPath, { waitUntil: "networkidle" })

    expect(response?.status()).toBe(200)
    await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
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
