import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || "4100"}`
const description = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."

type LookupBody = { work_id: string | null, titles: string[] }
type PendingLookup = { body: LookupBody, aborted: boolean }

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_work_lookup_requests`),
    request.delete(`${fixture}/_work_lookup_failure`),
    request.delete(`${fixture}/_work_lookup_delays`)
  ])
}

async function lookupBodies(request: APIRequestContext): Promise<LookupBody[]> {
  const response = await request.get(`${fixture}/_work_lookup_requests`)
  return (await response.json()).requests.map(
    (entry: { body: LookupBody }) => entry.body
  )
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (/hydration|duplicate keys|unhandledrejection/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function expectBodyClasses(page: Page, expected: string[]) {
  const classes = (await page.locator("body").getAttribute("class"))
    ?.split(/\s+/)
    .filter(Boolean)
    .sort()
  expect(classes).toEqual([...expected].sort())
}

async function openIdPage(page: Page, path = "/id") {
  const problems = captureBrowserProblems(page)
  const response = await page.goto(path, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  return problems
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
    type PendingTransportLookup = {
      body: { work_id: string | null, titles: string[] }
      signal: AbortSignal
      resolve: (response: Response) => void
      reject: (error: Error) => void
    }
    type LookupTransport = {
      pending: PendingTransportLookup[]
      resolve: (index: number, workId: string) => void
      reject: (index: number) => void
    }
    const nativeFetch = window.fetch.bind(window)
    const pending: PendingTransportLookup[] = []
    const transport: LookupTransport = {
      pending,
      resolve(index, workId) {
        pending[index]?.resolve(new Response(JSON.stringify({
          items: [{
            work_id: workId,
            author: { label: "Testförfattare", url: "/författare/Test" },
            title: { label: workId, url: `/verk/${workId}` },
            media: []
          }]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        }))
      },
      reject(index) {
        pending[index]?.reject(new TypeError("deliberate transport failure"))
      }
    }

    Object.defineProperty(window, "__idLookupTransport", { value: transport })
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      if (new URL(request.url).pathname !== "/api/v2/works/lookup") {
        return nativeFetch(input, init)
      }
      const body = await request.clone().json()
      return new Promise<Response>((resolve, reject) => {
        // Deliberately do not subscribe to request.signal: this transport settles
        // even after the page aborts it, exercising request-version protection.
        pending.push({ body, signal: request.signal, resolve, reject })
      })
    }

  })
}

async function pendingTransportLookups(page: Page): Promise<PendingLookup[]> {
  return page.evaluate(() => {
    type LookupWindow = Window & {
      __idLookupTransport: {
        pending: Array<{ body: LookupBody, signal: AbortSignal }>
      }
    }
    return (window as unknown as LookupWindow).__idLookupTransport.pending.map(
      lookup => ({ body: lookup.body, aborted: lookup.signal.aborted })
    )
  })
}

async function settleTransportLookup(
  page: Page,
  action: "resolve" | "reject",
  index: number,
  workId = ""
) {
  await page.evaluate(({ action, index, workId }) => {
    type LookupWindow = Window & {
      __idLookupTransport: {
        resolve: (index: number, workId: string) => void
        reject: (index: number) => void
      }
    }
    const transport = (window as unknown as LookupWindow).__idLookupTransport
    if (action === "resolve") transport.resolve(index, workId)
    else transport.reject(index)
  }, { action, index, workId })
}

test.beforeEach(async ({ request }) => reset(request))

test("mounts ID lookup before the route lookup settles", async ({ page, request }) => {
  const body = { work_id: "lb123", titles: [] }
  await request.put(`${fixture}/_work_lookup_delays`, {
    data: { [JSON.stringify(body)]: 5_000 }
  })
  let releaseLookup = () => {}
  const lookupGate = new Promise<void>(resolve => { releaseLookup = resolve })
  const lookupRoute = async (route: import("@playwright/test").Route) => {
    const response = await route.fetch()
    await lookupGate
    await route.fulfill({
      response,
      json: {
        items: [{
          work_id: "lb123",
          author: { label: "Testförfattare", url: "/författare/Test" },
          title: { label: "Testtitel", url: "/verk/lb123" },
          media: []
        }]
      }
    })
  }
  await page.route("**/api/v2/works/lookup", lookupRoute)
  try {
    await page.goto("/om/ide", { waitUntil: "networkidle" })
    await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()

    void pushRoute(page, "/id/lb123")
    await expect.poll(() => lookupBodies(request)).toEqual([body])

    await expect(page.getByPlaceholder("lbid")).toHaveValue("lb123")
    await expect(page.getByPlaceholder("titel")).toHaveValue("")
    await expect(page.getByPlaceholder("flera titlar separarade med nyrad")).toHaveValue("")
    await expect.poll(() => page.locator("#mainview > div").getAttribute("class"))
      .toContain("searching")
    const status = page.locator('.preloader[role="status"]')
    await expect(status).toHaveCount(1)
    await expect(status).toBeVisible()
    await expect(status.locator(".sr-only")).toHaveText("Hämtar resultat")
    await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toHaveCount(0)
    await expect(page.locator(".table-striped tbody tr")).toHaveCount(0)

    releaseLookup()
    await expect(page.locator(".table-striped tbody tr td").first()).toHaveText("lb123")
  } finally {
    releaseLookup()
    await page.unroute("**/api/v2/works/lookup", lookupRoute)
  }
})

test("leaving a pending initial ID lookup keeps its later settlement inert", async ({ page }) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()

  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window)
    let releaseFirstLookup = () => {}
    const firstLookupGate = new Promise<void>(resolve => { releaseFirstLookup = resolve })
    let releaseSecondLookup = () => {}
    const secondLookupGate = new Promise<void>(resolve => { releaseSecondLookup = resolve })
    const gate = {
      requests: 0,
      firstStarted: false,
      firstReleased: false,
      firstAbortedWhenReleased: false,
      releaseFirst: releaseFirstLookup,
      releaseSecond: releaseSecondLookup,
      restore: () => { window.fetch = nativeFetch }
    }
    ;(window as typeof window & { __initialIdLookupGate?: typeof gate })
      .__initialIdLookupGate = gate
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      if (new URL(request.url).pathname !== "/api/v2/works/lookup") {
        return nativeFetch(input, init)
      }
      gate.requests += 1
      const response = await nativeFetch(input, init)
      if (gate.requests === 1) {
        gate.firstStarted = true
        await firstLookupGate
        gate.firstReleased = true
        gate.firstAbortedWhenReleased = request.signal.aborted
      } else {
        await secondLookupGate
      }
      return response
    }
  })
  try {
    void pushRoute(page, "/id/lb238704")
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & {
        __initialIdLookupGate?: { firstStarted: boolean }
      }).__initialIdLookupGate?.firstStarted ?? false
    ))).toBe(true)
    await expect(page.locator('.preloader[role="status"]')).toHaveCount(1)

    await pushRoute(page, "/om/ide")
    await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()
    await page.evaluate(() => (
      (window as typeof window & {
        __initialIdLookupGate?: { releaseFirst: () => void }
      }).__initialIdLookupGate?.releaseFirst()
    ))
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & {
        __initialIdLookupGate?: {
          firstReleased: boolean
          firstAbortedWhenReleased: boolean
        }
      }).__initialIdLookupGate
    ))).toMatchObject({ firstReleased: true, firstAbortedWhenReleased: true })

    void pushRoute(page, "/id/lb238704")
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & {
        __initialIdLookupGate?: { requests: number }
      }).__initialIdLookupGate?.requests ?? 0
    )), { timeout: 2_000 }).toBe(2)
    await expect(page.locator(".table-striped tbody tr")).toHaveCount(0)
    await expect(page.locator('.preloader[role="status"]')).toHaveCount(1)

    await page.evaluate(() => (
      (window as typeof window & {
        __initialIdLookupGate?: { releaseSecond: () => void }
      }).__initialIdLookupGate?.releaseSecond()
    ))
    await expect(page.locator(".table-striped tbody tr td").first()).toHaveText("lb238704")
  } finally {
    await page.evaluate(() => {
      const gate = (window as typeof window & {
        __initialIdLookupGate?: {
          releaseFirst: () => void
          releaseSecond: () => void
          restore: () => void
        }
      }).__initialIdLookupGate
      gate?.releaseFirst()
      gate?.releaseSecond()
      gate?.restore()
    })
  }
})

test("result titles use client routing and Back restores the ID lookup", async ({
  page
}) => {
  const problems = await openIdPage(page, "/id/LB238704")
  await page.evaluate(() => {
    Object.defineProperty(window, "__idLookupNavigationSentinel", { value: "alive" })
  })

  await page.getByRole("link", { name: "Röda rummet", exact: true }).click()
  await expect(page).toHaveURL(
    "/författare/StrindbergA/titlar/RodaRummet/sida/1/etext"
  )
  await expect(page.locator(".reader_main")).toHaveAttribute(
    "aria-label",
    "Röda rummet, sida 1"
  )
  expect(await page.evaluate(() => (
    window as Window & { __idLookupNavigationSentinel?: string }
  ).__idLookupNavigationSentinel ?? null)).toBe("alive")

  await page.goBack()
  await expect(page).toHaveURL("/id/LB238704")
  await expect(page.getByPlaceholder("lbid")).toHaveValue("lb238704")
  expect(await page.evaluate(() => (
    window as Window & { __idLookupNavigationSentinel?: string }
  ).__idLookupNavigationSentinel ?? null)).toBe("alive")
  expect(problems).toEqual([])
})

test("legacy work results use a native document handoff", async ({ page }) => {
  await installIgnoringAbortTransport(page)
  const problems = await openIdPage(page)
  await page.getByPlaceholder("lbid").fill("lb-legacy-only")
  await expect.poll(() => pendingTransportLookups(page)).toHaveLength(1)
  await settleTransportLookup(page, "resolve", 0, "lb-legacy-only")

  await page.evaluate(() => {
    Object.defineProperty(window, "__idLookupNavigationSentinel", { value: "alive" })
  })
  await page.getByRole("link", { name: "lb-legacy-only", exact: true }).click()

  await expect(page).toHaveURL("/verk/lb-legacy-only")
  expect(await page.evaluate(() => (
    window as Window & { __idLookupNavigationSentinel?: string }
  ).__idLookupNavigationSentinel ?? null)).toBeNull()
  expect(problems).toEqual([])
})

test("untrusted lookup URLs never become executable links", async ({ page }) => {
  await page.route("**/api/v2/works/lookup", route => route.fulfill({
    json: {
      items: [{
        work_id: "lb-hostile",
        author: { label: "Farlig författarlänk", url: "javascript:alert(1)" },
        title: { label: "Farlig titellänk", url: "data:text/html,unsafe" },
        media: [{ label: "etext", url: "//evil.example/unsafe" }]
      }]
    }
  }))
  await openIdPage(page)
  await page.getByLabel("LB-ID", { exact: true }).fill("lb-hostile")

  const row = page.locator(".table-striped tbody tr")
  await expect(row).toContainText("Farlig författarlänk")
  await expect(row).toContainText("Farlig titellänk")
  await expect(row).toContainText("etext")
  await expect(row.locator("a")).toHaveCount(0)
})

test("manual ID is immediate and keeps raw display while clearing only title state", async ({
  page,
  request
}) => {
  const problems = await openIdPage(page)
  const idInput = page.getByPlaceholder("lbid")
  const titleInput = page.getByPlaceholder("titel")
  const textarea = page.getByPlaceholder("flera titlar separarade med nyrad")

  await idInput.fill("  LB238704  ")
  await expect(idInput).toHaveValue("  LB238704  ")
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: "lb238704", titles: [] }
  ])

  await textarea.fill("Författare – Titel\nTitel två")
  await expect(titleInput).toHaveValue("Titel")
  await idInput.fill("lb238704")
  await expect(titleInput).toHaveValue("")
  await expect(textarea).toHaveValue("Författare – Titel\nTitel två")
  expect(problems).toEqual([])
})

test("title and textarea use the exact 500 ms debounce and coupled replacement rules", async ({
  page,
  request
}) => {
  await openIdPage(page)
  await page.clock.install()
  const idInput = page.getByPlaceholder("lbid")
  const titleInput = page.getByPlaceholder("titel")
  const textarea = page.getByPlaceholder("flera titlar separarade med nyrad")

  await titleInput.fill("Röda")
  await page.clock.runFor(499)
  expect(await lookupBodies(request)).toEqual([])
  await page.clock.runFor(1)
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["Röda"] }
  ])

  await reset(request)
  await textarea.fill("A – First\nSecond\nThird")
  await expect(titleInput).toHaveValue("First")
  await titleInput.fill("Replacement")
  await expect(idInput).toHaveValue("")
  await page.clock.runFor(499)
  expect(await lookupBodies(request)).toEqual([])
  await page.clock.runFor(1)
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["Replacement", "Second", "Third"] }
  ])

  await reset(request)
  await textarea.fill("A – B – C")
  await page.clock.runFor(500)
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["B"] }
  ])

  await reset(request)
  await textarea.fill("A –")
  await page.clock.runFor(500)
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["A –"] }
  ])
})

test("textarea preserves blank and duplicate control rows but normalizes only the request", async ({
  page,
  request
}) => {
  await openIdPage(page)
  await page.clock.install()
  const textarea = page.getByPlaceholder("flera titlar separarade med nyrad")
  const rows = ["", "Duplicate", "Duplicate", ...Array.from(
    { length: 100 },
    (_, index) => `Title ${index + 1}`
  )]
  const raw = rows.join("\n")

  await textarea.fill(raw)
  await expect(textarea).toHaveValue(raw)
  await expect(page.getByPlaceholder("titel")).toHaveValue("")
  await page.clock.runFor(500)
  await expect.poll(async () => (await lookupBodies(request)).length).toBe(1)
  const [body] = await lookupBodies(request)
  expect(body?.work_id).toBeNull()
  expect(body?.titles).toHaveLength(100)
  expect(body?.titles.slice(0, 3)).toEqual([
    "Duplicate",
    "Duplicate",
    "Title 1"
  ])
  expect(body?.titles.at(-1)).toBe("Title 98")
})

test("same-mode replacements clear old rows while loading and latest response wins", async ({
  page,
  request
}) => {
  const problems = await openIdPage(page)
  const titleInput = page.getByPlaceholder("titel")
  await titleInput.fill("Röda rummet")
  await expect(page.locator(".table-striped tbody tr")).toHaveCount(1)

  const slowBody = { work_id: null, titles: ["Gösta Berlings saga"] }
  await request.put(`${fixture}/_work_lookup_delays`, {
    data: { [JSON.stringify(slowBody)]: 500 }
  })
  await titleInput.fill("Gösta Berlings saga")
  await expect.poll(async () => (await lookupBodies(request)).length).toBe(2)
  await expect(page.locator(".table-striped tbody tr")).toHaveCount(0)
  await expect(page.locator('.preloader[role="status"]')).toContainText("Hämtar resultat")
  await expect(page.locator("#mainview > div")).toHaveClass(/\bsearching\b/)
  await expect(page.locator(".preloader")).toBeVisible()

  await titleInput.fill("Röda rummet")
  await expect.poll(async () => (await lookupBodies(request)).length).toBe(3)
  await expect(page.locator(".table-striped tbody tr td").nth(0)).toHaveText("lb238704")
  await page.waitForTimeout(550)
  await expect(page.locator(".table-striped tbody tr td").nth(0)).toHaveText("lb238704")
  await expect(page.locator(".preloader .sr-only")).toHaveText("")
  await expect(page.locator("#mainview > div")).not.toHaveClass(/\bsearching\b/)
  expect(problems).toEqual([])
})

test("request versions win when an aborted transport still resolves or rejects", async ({
  page
}) => {
  await installIgnoringAbortTransport(page)
  const problems = await openIdPage(page)
  const idInput = page.getByPlaceholder("lbid")
  const rows = page.locator(".table-striped tbody tr")
  const mainview = page.locator("#mainview > div")

  await idInput.fill("lb-older-data")
  await expect.poll(() => pendingTransportLookups(page)).toHaveLength(1)
  await idInput.fill("lb-newer-data")
  await expect.poll(() => pendingTransportLookups(page)).toHaveLength(2)
  expect((await pendingTransportLookups(page))[0]?.aborted).toBe(true)

  await settleTransportLookup(page, "resolve", 1, "lb-newer-data")
  await expect(rows.locator("td").first()).toHaveText("lb-newer-data")
  await settleTransportLookup(page, "resolve", 0, "lb-older-data")
  await expect(rows.locator("td").first()).toHaveText("lb-newer-data")

  await idInput.fill("lb-older-error")
  await expect.poll(() => pendingTransportLookups(page)).toHaveLength(3)
  await idInput.fill("lb-newest-data")
  await expect.poll(() => pendingTransportLookups(page)).toHaveLength(4)
  expect((await pendingTransportLookups(page))[2]?.aborted).toBe(true)

  await settleTransportLookup(page, "reject", 2)
  await expect(rows).toHaveCount(0)
  await expect(mainview).toHaveClass(/\bsearching\b/)
  await settleTransportLookup(page, "resolve", 3, "lb-newest-data")
  await expect(rows.locator("td").first()).toHaveText("lb-newest-data")
  await expect(mainview).not.toHaveClass(/\bsearching\b/)
  expect(problems).toEqual([])
})

test("duplicate representations render twice in order without duplicate-key warnings", async ({
  page
}) => {
  const problems = await openIdPage(page)
  await page.getByPlaceholder("lbid").fill("lb-duplicate")

  const links = page.locator(".table-striped tbody tr td").nth(3).locator("a")
  await expect(links).toHaveCount(2)
  await expect(links).toHaveText(["etext", "etext"])
  await expect(links.nth(0)).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/TestAuthor/titlar/Duplicate/etext"
  )
  await expect(links.nth(1)).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/TestAuthor/titlar/Duplicate/etext"
  )
  await expect(page.locator(".table-striped tbody tr td").nth(3)).toHaveText(
    "etext:::etext"
  )
  expect(problems).toEqual([])
})

test("typed and thrown network failures clear loading and rows without browser errors", async ({
  page,
  request
}) => {
  const problems = await openIdPage(page)
  await request.put(`${fixture}/_work_lookup_failure`)
  await page.getByPlaceholder("lbid").fill("lb238704")
  await expect.poll(async () => (await lookupBodies(request)).length).toBe(1)
  await expect(page.locator("#mainview > div")).not.toHaveClass(/\bsearching\b/)
  await expect(page.locator(".table-striped tbody tr")).toHaveCount(0)

  await request.delete(`${fixture}/_work_lookup_failure`)
  await page.route("**/api/v2/works/lookup", route => route.abort("failed"))
  await page.getByPlaceholder("lbid").fill("lb278171")
  await expect(page.locator("#mainview > div")).not.toHaveClass(/\bsearching\b/)
  await expect(page.locator(".table-striped tbody tr")).toHaveCount(0)
  expect(problems).toEqual([])
})

test("empty invalid and no-hit values do not leave stale requests or rows", async ({
  page,
  request
}) => {
  await openIdPage(page)
  const idInput = page.getByPlaceholder("lbid")
  const titleInput = page.getByPlaceholder("titel")

  await idInput.fill("lb238704")
  await expect(page.locator(".table-striped tbody tr")).toHaveCount(1)
  await reset(request)
  await idInput.fill("not-an-id")
  await page.waitForTimeout(550)
  expect(await lookupBodies(request)).toEqual([])
  await expect(page.locator(".table-striped tbody tr")).toHaveCount(0)

  await idInput.fill("")
  await titleInput.fill("no match")
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["no match"] }
  ])
  await expect(page.locator(".table-striped tbody tr")).toHaveCount(0)
  await reset(request)
  await titleInput.fill(" ")
  await page.waitForTimeout(550)
  expect(await lookupBodies(request)).toEqual([])
})

test("hydrated route values preserve an already-decoded literal percent sequence", async ({
  page,
  request
}) => {
  await openIdPage(page)
  await pushRoute(page, "/id/Title%2520Percent")

  await expect(page.getByPlaceholder("titel")).toHaveValue("title%20percent")
  await expect.poll(() => lookupBodies(request)).toEqual([
    { work_id: null, titles: ["title%20percent"] }
  ])
})

test("unmount during the final debounce millisecond prevents the lookup", async ({
  page,
  request
}) => {
  await openIdPage(page)
  await page.clock.install({ time: 0 })
  await page.getByPlaceholder("titel").fill("Röda rummet")
  await page.clock.pauseAt(499)
  expect(await lookupBodies(request)).toEqual([])

  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await page.clock.runFor(1)
  expect(await lookupBodies(request)).toEqual([])
})

test("route changes seed lower-case state, clean up pending work, and restore metadata", async ({
  page,
  request
}) => {
  const problems = await openIdPage(page, "/om/ide")
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await expectBodyClasses(page, ["focus", "page-about", "ready"])

  await pushRoute(page, "/id/LB238704")
  await expect(page).toHaveTitle("Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    description
  )
  await expectBodyClasses(page, ["focus", "page-id", "ready"])
  await expect(page.getByPlaceholder("lbid")).toHaveValue("lb238704")
  await expect(page.locator(".table-striped tbody tr")).toHaveCount(1)

  const slowBody = { work_id: null, titles: ["Gösta Berlings saga"] }
  await request.put(`${fixture}/_work_lookup_delays`, {
    data: { [JSON.stringify(slowBody)]: 500 }
  })
  await page.getByPlaceholder("titel").fill("Gösta Berlings saga")
  await expect.poll(async () => (await lookupBodies(request)).some(body => (
    body.titles[0] === "Gösta Berlings saga"
  ))).toBe(true)
  await pushRoute(page, "/om/ide")
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Om Litteraturbanken."
  )
  await expectBodyClasses(page, ["focus", "page-about", "ready"])
  await page.waitForTimeout(550)
  expect(problems).toEqual([])
})
