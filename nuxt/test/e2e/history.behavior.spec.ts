import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const nuxtPort = Number(process.env.LITTB_NUXT_TEST_PORT || 3000)
const nuxtOrigin = `http://127.0.0.1:${nuxtPort}`

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || "4100"}`

type StoredHistory = { author: string, label: string, url: string }
type AuthorRequest = {
  path: string
  body: { author_ids: string[] }
}
type PendingAuthorRequest = { authorIds: string[], aborted: boolean }
type ResolverTransport = {
  responses: Array<{ url: string, status: number }>
  failures: Array<{ url: string, error: string | null }>
}

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_resolve_requests`),
    request.delete(`${fixture}/_author_resolve_failure`),
    request.delete(`${fixture}/_author_resolve_delays`)
  ])
}

async function authorRequests(request: APIRequestContext): Promise<AuthorRequest[]> {
  const response = await request.get(`${fixture}/_author_resolve_requests`)
  return (await response.json()).requests
}

function isResolverUrl(value: string) {
  try {
    return new URL(value).pathname === "/api/v2/authors/resolve"
  } catch {
    return false
  }
}

function captureBrowserProblems(page: Page, expectedResolverError?: RegExp) {
  const problems: string[] = []
  const expectedResolverErrors: Array<{ text: string, url: string }> = []
  page.on("console", message => {
    if (message.type() !== "error") return
    const text = message.text()
    const url = message.location().url
    if (expectedResolverError?.test(text) && isResolverUrl(url)) {
      expectedResolverErrors.push({ text, url })
      return
    }
    problems.push(`console: ${text}`)
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return { problems, expectedResolverErrors }
}

function captureResolverTransport(page: Page): ResolverTransport {
  const transport: ResolverTransport = { responses: [], failures: [] }
  page.on("response", response => {
    if (isResolverUrl(response.url())) {
      transport.responses.push({ url: response.url(), status: response.status() })
    }
  })
  page.on("requestfailed", request => {
    if (isResolverUrl(request.url())) {
      transport.failures.push({
        url: request.url(),
        error: request.failure()?.errorText ?? null
      })
    }
  })
  return transport
}

async function expectBodyClasses(page: Page, expected: string[]) {
  const classes = (await page.locator("body").getAttribute("class"))
    ?.split(/\s+/)
    .filter(Boolean)
    .sort()
  expect(classes).toEqual([...expected].sort())
}

async function seedRawHistory(page: Page, raw: string | null) {
  await page.addInitScript(value => {
    if (value === null) localStorage.removeItem("lastPageViews")
    else localStorage.setItem("lastPageViews", value)
  }, raw)
}

async function openHistory(page: Page) {
  const response = await page.goto("/historik", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
}

async function expectHeadingOnly(page: Page) {
  await expect(page.locator("#mainview > div > h1")).toHaveText("Senast lästa verk")
  await expect(page.locator("#mainview > div > ul")).toHaveCount(0)
}

async function pushRoute(page: Page, path: string) {
  await page.evaluate(async target => {
    type VueRoot = HTMLElement & {
      __vue_app__: {
        config: {
          globalProperties: {
            $router: { push: (value: string) => Promise<void> }
          }
        }
      }
    }
    const root = document.querySelector("#__nuxt") as VueRoot
    await root.__vue_app__.config.globalProperties.$router.push(target)
  }, path)
}

async function installIgnoringAbortTransport(page: Page) {
  await page.addInitScript(() => {
    type PendingTransportRequest = {
      authorIds: string[]
      signal: AbortSignal
      resolve: (response: Response) => void
    }
    type HistoryTransport = {
      pending: PendingTransportRequest[]
      resolve: (index: number) => void
    }
    const nativeFetch = window.fetch.bind(window)
    const pending: PendingTransportRequest[] = []
    const transport: HistoryTransport = {
      pending,
      resolve(index) {
        pending[index]?.resolve(new Response(JSON.stringify({
          items: [{
            author_id: "StrindbergA",
            full_name: "Late Author",
            surname: "Author"
          }]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        }))
      }
    }

    Object.defineProperty(window, "__historyTransport", { value: transport })
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      if (new URL(request.url).pathname !== "/api/v2/authors/resolve") {
        return nativeFetch(input, init)
      }
      const body = await request.clone().json() as { author_ids: string[] }
      return new Promise<Response>(resolve => {
        // Deliberately ignore abort so resolution after unmount exercises the
        // component's explicit late-commit guard.
        pending.push({
          authorIds: body.author_ids,
          signal: request.signal,
          resolve
        })
      })
    }
  })
}

async function pendingTransportRequests(page: Page): Promise<PendingAuthorRequest[]> {
  return page.evaluate(() => {
    type HistoryWindow = Window & {
      __historyTransport: {
        pending: Array<{ authorIds: string[], signal: AbortSignal }>
      }
    }
    return (window as unknown as HistoryWindow).__historyTransport.pending.map(
      entry => ({ authorIds: entry.authorIds, aborted: entry.signal.aborted })
    )
  })
}

async function settleTransportRequest(page: Page, index: number) {
  await page.evaluate(requestIndex => {
    type HistoryWindow = Window & {
      __historyTransport: { resolve: (index: number) => void }
    }
    ;(window as unknown as HistoryWindow).__historyTransport.resolve(requestIndex)
  }, index)
}

test.beforeEach(async ({ request }) => reset(request))

test("valid history is filtered before the 50-row limit and resolved once in stored order", async ({
  page,
  request
}) => {
  const { problems } = captureBrowserProblems(page)
  const special: StoredHistory[] = [
    {
      author: "  StrindbergA  ",
      label: "Röda rummet – original",
      url: "/författare/StrindbergA/titlar/Roda%20Rummet/etext?mode=orig%2Fscan#sida-1"
    },
    {
      author: "UnknownAuthor",
      label: "Okänd författare",
      url: "/verk/unknown?view=full#top"
    },
    {
      author: "LagerlofS",
      label: "  Bevarad etikett  ",
      url: "/författare/LagerlofS/titlar/Gosta/etext"
    },
    {
      author: "StrindbergA",
      label: "Dubblettförfattare",
      url: "/verk/duplicate-author"
    }
  ]
  const fillers: StoredHistory[] = Array.from({ length: 47 }, (_, index) => ({
    author: index % 2 === 0 ? "StrindbergA" : "LagerlofS",
    label: `Historikrad ${index + 1}`,
    url: `/verk/history-${index + 1}`
  }))
  const valid = [...special, ...fillers]
  const unsafe: unknown[] = [
    null,
    "not-an-object",
    { author: "StrindbergA", label: "", url: "/empty-label" },
    { author: " ", label: "Blank author", url: "/blank-author" },
    { author: "x".repeat(101), label: "Long author", url: "/long-author" },
    { author: "StrindbergA", label: "Absolute", url: "https://evil.invalid/work" },
    { author: "StrindbergA", label: "Protocol relative", url: "//evil.invalid/work" },
    { author: "StrindbergA", label: "Backslash", url: "/bad\\path" },
    { author: "StrindbergA", label: "Control", url: "/bad\u0001path" },
    { author: "StrindbergA", label: "Malformed percent", url: "/bad%ZZpath" }
  ]
  const stored = [unsafe[0], valid[0], ...unsafe.slice(1), ...valid.slice(1)]
  const raw = JSON.stringify(stored)
  await seedRawHistory(page, raw)

  await openHistory(page)

  const rows = page.locator("#mainview > div > ul > li")
  await expect(rows).toHaveCount(50)
  await expect(rows.locator("a > span:last-child")).toHaveText(
    valid.slice(0, 50).map(entry => entry.label.trim())
  )
  await expect(rows.nth(0).locator("a")).toHaveAttribute(
    "href",
    special[0].url.replace("/författare/", "/f%C3%B6rfattare/")
  )
  await expect(rows.nth(0).locator("span").first()).toHaveText("August Strindberg")
  await expect(rows.nth(1).locator("span").first()).toHaveText("")
  await expect(rows.nth(2).locator("a")).toHaveAttribute(
    "href",
    special[2].url.replace("/författare/", "/f%C3%B6rfattare/")
  )
  expect(await rows.nth(2).locator("span").last().textContent()).toBe(special[2].label)
  await expect(rows.nth(49).locator("a")).toHaveAttribute("href", valid[49].url)
  await expect(page.locator(`a[href="${valid[50].url}"]`)).toHaveCount(0)
  expect(await rows.locator("a").evaluateAll(anchors => anchors.every(
    anchor => anchor.tagName === "A"
  ))).toBe(true)

  expect(await authorRequests(request)).toEqual([{
    path: "/v2/authors/resolve",
    body: { author_ids: ["StrindbergA", "UnknownAuthor", "LagerlofS"] }
  }])
  expect(await page.evaluate(() => localStorage.getItem("lastPageViews"))).toBe(raw)
  expect(problems).toEqual([])
})

test("history uses SPA navigation only for Nuxt-owned destinations", async ({ page }) => {
  const records: StoredHistory[] = [
    {
      author: "StrindbergA",
      label: "Nuxt-författarsida",
      url: "/författare/StrindbergA/titlar"
    },
    {
      author: "StrindbergA",
      label: "Äldre verkadress",
      url: "/verk/legacy-only"
    }
  ]
  await seedRawHistory(page, JSON.stringify(records))
  await openHistory(page)
  await page.evaluate(() => {
    ;(window as typeof window & { __spaSentinel?: string }).__spaSentinel = "history-spa"
  })

  await page.getByRole("link", { name: /Äldre verkadress/u }).click()
  await expect(page).toHaveURL("/verk/legacy-only")
  expect(await page.evaluate(() =>
    (window as typeof window & { __spaSentinel?: string }).__spaSentinel
  )).toBeUndefined()

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { name: "Senast lästa verk" })).toBeVisible()
  await page.evaluate(() => {
    ;(window as typeof window & { __spaSentinel?: string }).__spaSentinel = "history-spa"
  })
  await page.getByRole("link", { name: /Nuxt-författarsida/u }).click()
  await expect(page).toHaveURL("/f%C3%B6rfattare/StrindbergA/titlar")
  expect(await page.evaluate(() =>
    (window as typeof window & { __spaSentinel?: string }).__spaSentinel
  )).toBe("history-spa")

  await page.goBack()
  await expect(page).toHaveURL("/historik")
  expect(await page.evaluate(() =>
    (window as typeof window & { __spaSentinel?: string }).__spaSentinel
  )).toBe("history-spa")
})

test("a successful empty resolver response renders an unchanged blank-author row", async ({
  page,
  request
}) => {
  const { problems } = captureBrowserProblems(page)
  const stored: StoredHistory = {
    author: "OnlyUnknownAuthor",
    label: "  Oförtecknad titel  ",
    url: "/verk/ofortecknad%20titel?mode=original#sida-2"
  }
  const raw = JSON.stringify([stored])
  await seedRawHistory(page, raw)

  await openHistory(page)

  const list = page.locator("#mainview > div > ul")
  const row = list.locator("li")
  await expect(list).toHaveCount(1)
  await expect(row).toHaveCount(1)
  await expect(row.locator("span").first()).toHaveText("")
  expect(await row.locator("span").last().textContent()).toBe(stored.label)
  await expect(row.locator("a")).toHaveAttribute("href", stored.url)
  expect(await authorRequests(request)).toEqual([{
    path: "/v2/authors/resolve",
    body: { author_ids: ["OnlyUnknownAuthor"] }
  }])
  expect(await page.evaluate(() => localStorage.getItem("lastPageViews"))).toBe(raw)
  expect(problems).toEqual([])
})

for (const [name, raw] of [
  ["missing storage", null],
  ["JSON null", "null"],
  ["empty array", "[]"],
  ["invalid JSON", "{not json"]
] as const) {
  test(`${name} keeps the heading-only page without requesting authors`, async ({
    page,
    request
  }) => {
    const { problems } = captureBrowserProblems(page)
    await seedRawHistory(page, raw)
    await openHistory(page)

    await expectHeadingOnly(page)
    expect(await authorRequests(request)).toEqual([])
    expect(await page.evaluate(() => localStorage.getItem("lastPageViews"))).toBe(raw)
    expect(problems).toEqual([])
  })
}

test("storage access failure keeps the heading-only page without requesting authors", async ({
  page,
  request
}) => {
  const { problems } = captureBrowserProblems(page)
  await page.addInitScript(() => {
    const nativeGetItem = Storage.prototype.getItem
    Object.defineProperty(Storage.prototype, "getItem", {
      configurable: true,
      value(key: string) {
        if (key === "lastPageViews") throw new DOMException("denied", "SecurityError")
        return nativeGetItem.call(this, key)
      }
    })
  })

  await openHistory(page)

  await expectHeadingOnly(page)
  expect(await authorRequests(request)).toEqual([])
  expect(problems).toEqual([])
})

test("typed API failure leaves valid stored history hidden and unchanged", async ({
  page,
  request
}) => {
  const browser = captureBrowserProblems(
    page,
    /^Failed to load resource: the server responded with a status of 503 \(Service Unavailable\)$/
  )
  const transport = captureResolverTransport(page)
  const raw = JSON.stringify([{
    author: "StrindbergA",
    label: "Röda rummet",
    url: "/verk/roda-rummet"
  }])
  await seedRawHistory(page, raw)
  await request.put(`${fixture}/_author_resolve_failure`)

  await openHistory(page)

  await expectHeadingOnly(page)
  expect(await authorRequests(request)).toEqual([{
    path: "/v2/authors/resolve",
    body: { author_ids: ["StrindbergA"] }
  }])
  expect(await page.evaluate(() => localStorage.getItem("lastPageViews"))).toBe(raw)
  expect(transport.responses).toEqual([{
    url: `${nuxtOrigin}/api/v2/authors/resolve`,
    status: 503
  }])
  expect(transport.failures).toEqual([])
  expect(browser.expectedResolverErrors).toEqual([{
    text: "Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
    url: `${nuxtOrigin}/api/v2/authors/resolve`
  }])
  expect(browser.problems).toEqual([])
})

test("thrown fetch failure leaves valid stored history hidden and unchanged", async ({
  page,
  request
}) => {
  const browser = captureBrowserProblems(
    page,
    /^Failed to load resource: net::ERR_FAILED$/
  )
  const transport = captureResolverTransport(page)
  const raw = JSON.stringify([{
    author: "StrindbergA",
    label: "Röda rummet",
    url: "/verk/roda-rummet"
  }])
  await seedRawHistory(page, raw)
  await page.route("**/api/v2/authors/resolve", route => route.abort("failed"))

  await openHistory(page)

  await expectHeadingOnly(page)
  expect(await authorRequests(request)).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem("lastPageViews"))).toBe(raw)
  expect(transport.responses).toEqual([])
  expect(transport.failures).toEqual([{
    url: `${nuxtOrigin}/api/v2/authors/resolve`,
    error: "net::ERR_FAILED"
  }])
  expect(browser.expectedResolverErrors).toEqual([{
    text: "Failed to load resource: net::ERR_FAILED",
    url: `${nuxtOrigin}/api/v2/authors/resolve`
  }])
  expect(browser.problems).toEqual([])
})

test("leaving during an abort-ignoring request aborts it and blocks late page state", async ({
  page,
  request
}) => {
  const { problems } = captureBrowserProblems(page)
  const raw = JSON.stringify([{
    author: "StrindbergA",
    label: "Röda rummet",
    url: "/verk/roda-rummet"
  }])
  await seedRawHistory(page, raw)
  await installIgnoringAbortTransport(page)
  const response = await page.goto("/historik")
  expect(response?.status()).toBe(200)
  await expect.poll(() => pendingTransportRequests(page)).toEqual([{
    authorIds: ["StrindbergA"],
    aborted: false
  }])

  await pushRoute(page, "/id")
  await expect(page).toHaveURL(/\/id$/)
  await expect.poll(() => pendingTransportRequests(page)).toEqual([{
    authorIds: ["StrindbergA"],
    aborted: true
  }])
  await settleTransportRequest(page, 0)
  await page.waitForTimeout(50)

  await expect(page).toHaveTitle("Litteraturbanken")
  await expectBodyClasses(page, ["focus", "page-id", "ready"])
  await expect(page.getByText("Late Author", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Senast lästa verk", { exact: true })).toHaveCount(0)
  expect(await authorRequests(request)).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem("lastPageViews"))).toBe(raw)
  expect(problems).toEqual([])
})
