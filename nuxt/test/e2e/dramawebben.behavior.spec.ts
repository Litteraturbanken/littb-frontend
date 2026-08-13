import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { dramawebbenCatalogExpected } from "../fixtures/dramawebben-catalog-data.mjs"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const legacyDescription = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_dramawebben_document_requests`),
    request.delete(`${fixture}/_dramawebben_document_failure`),
    request.delete(`${fixture}/_dramawebben_document_redirect_target_requests`),
    request.delete(`${fixture}/_dramawebben_excluded_data_requests`),
    request.delete(`${fixture}/_dramawebben_catalog_requests`),
    request.delete(`${fixture}/_dramawebben_catalog_failure`),
    request.delete(`${fixture}/_source_info_requests`),
    request.delete(`${fixture}/_source_info_static_requests`),
    request.delete(`${fixture}/_source_info_failure`),
    request.delete(`${fixture}/_source_info_delays`),
    request.delete(`${fixture}/_source_info_static_failure`)
  ])
}

async function documentRequests(request: APIRequestContext) {
  return (await (await request.get(
    `${fixture}/_dramawebben_document_requests`
  )).json()).requests
}

async function expectNoExcludedDataRequests(request: APIRequestContext) {
  expect((await (await request.get(
    `${fixture}/_dramawebben_excluded_data_requests`
  )).json()).requests).toEqual([])
}

async function catalogRequests(request: APIRequestContext) {
  return (await (await request.get(
    `${fixture}/_dramawebben_catalog_requests`
  )).json()).requests
}

async function sourceInfoRequests(request: APIRequestContext) {
  return (await (await request.get(
    `${fixture}/_source_info_requests`
  )).json()).requests
}

async function expectOneCatalogRequest(request: APIRequestContext) {
  expect(await catalogRequests(request)).toEqual([{
    method: "GET",
    path: "/private-v2/dramawebben/catalog",
    authorization: null,
    cookie: null
  }])
  await expectNoExcludedDataRequests(request)
}

async function expectPlayRows(page: Page, rows: readonly string[]) {
  await expect(page.locator("table.contenttable:not(.authors) tbody tr")).toHaveText([...rows])
}

async function expectAuthorRows(page: Page, rows: readonly string[]) {
  await expect(page.locator("table.contenttable.authors tbody tr")).toHaveText([...rows])
}

async function expectQuery(page: Page, key: string, value: string | null) {
  await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe(value)
}

async function expectClosedCatalogRootSiblings(page: Page) {
  expect(await page.locator("#dw").evaluate(hashTarget => {
    const shellCover = hashTarget.nextElementSibling
    const shell = shellCover?.nextElementSibling
    return {
      cover: shellCover?.classList.contains("cover"),
      coverShow: shellCover?.classList.contains("show"),
      sameParent: hashTarget.parentNode === shell?.parentNode,
      shell: shell?.classList.contains("subpage"),
      fallbackNodeType: shell?.nextSibling?.nodeType,
      followingElement: shell?.nextElementSibling?.tagName ?? null
    }
  })).toEqual({
    cover: true,
    coverShow: true,
    sameParent: true,
    shell: true,
    fallbackNodeType: 8,
    followingElement: null
  })
}

async function setCatalogFailure(request: APIRequestContext, failure: string) {
  const response = await request.put(`${fixture}/_dramawebben_catalog_failure`, {
    data: { failure }
  })
  expect(response.status()).toBe(200)
}

async function setDocumentFailure(request: APIRequestContext, failure: string) {
  const response = await request.put(`${fixture}/_dramawebben_document_failure`, {
    data: { failure }
  })
  expect(response.status()).toBe(200)
}

async function routerPush(page: Page, path: string) {
  await page.evaluate(async target => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: { $router: { push: (path: string) => Promise<void> } }
        }
      }
    }
    await root.__vue_app__?.config.globalProperties.$router.push(target)
  }, path)
}

function collectProblems(page: Page) {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration|unhandled/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  return problems
}

async function expectExactLinks(page: Page, kind: "pjäser" | "om" | "kringtexter") {
  await expect(page.locator(".subpage ul.links a")).toHaveText([
    "Pjäser", "Mer läsning", "Sök", "Om", "Till Litteraturbanken"
  ])
  expect(await page.locator(".subpage ul.links a").evaluateAll(links => links.map(link => ({
    href: link.getAttribute("href"),
    text: link.textContent?.replace(/\s+/gu, " ").trim()
  })))).toEqual([
    { href: "/dramawebben/pjäser", text: "Pjäser" },
    { href: "/dramawebben/kringtexter", text: "Mer läsning" },
    { href: "/s%C3%B6k?avancerad&keywords=keyword:Dramawebben", text: "Sök" },
    { href: "/dramawebben/om", text: "Om" },
    { href: "/", text: "Till Litteraturbanken" }
  ])
  await expect(page.locator(".subpage ul.links li.active a")).toHaveCount(
    kind === "om" ? 0 : 1
  )
  if (kind !== "om") {
    await expect(page.locator(".subpage ul.links li.active a"))
      .toHaveAttribute("href", `/dramawebben/${kind}`)
  }
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

for (const documentCase of [
  {
    kind: "om",
    route: "/dramawebben/om",
    heading: "Om Dramawebben",
    source: "/red/dramawebben/om.html"
  },
  {
    kind: "kringtexter",
    route: "/dramawebben/kringtexter",
    heading: "Mer läsning om svensk dramatik",
    source: "/red/dramawebben/kringtexter/kringtexter.html"
  }
] as const) {
  test(`hydrates ${documentCase.kind} once with the exact shell and links`, async ({
    page,
    request
  }) => {
    const problems = collectProblems(page)
    await page.goto(documentCase.route, { waitUntil: "networkidle" })

    await expect(page).toHaveTitle("Litteraturbanken")
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      legacyDescription
    )
    await expect(page.locator("body")).toHaveClass(
      "focus page-dramaweb drama-dramasubpage ready"
    )
    await expect(page.locator("#mainview > .cover.show")).toHaveCount(1)
    await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
    await expect(page.locator(".subpage .logo h2")).toBeHidden()
    await expect(page.getByRole("heading", { name: documentCase.heading, exact: true }))
      .toBeVisible()
    await expectExactLinks(page, documentCase.kind)
    expect(await documentRequests(request)).toEqual([{
      method: "GET",
      path: documentCase.source,
      authorization: null,
      cookie: null
    }])
    await expectNoExcludedDataRequests(request)
    expect(problems).toEqual([])
  })
}

test("hydrates sanitized managed attribute values without weakening blank-link hardening", async ({
  page,
  request
}) => {
  await setDocumentFailure(request, "malicious")
  await page.goto("/dramawebben/om", { waitUntil: "networkidle" })

  const visibleProbe = page.getByText("safe-visible-probe", { exact: true })
  const blankProbe = page.getByRole("link", { name: "blank-probe", exact: true })
  await expect(visibleProbe).not.toHaveAttribute("class")
  await expect(blankProbe).toHaveAttribute("href", "https://example.test/safe")
  await expect(blankProbe).toHaveAttribute("target", "_blank")
  await expect(blankProbe).toHaveAttribute("rel", "noopener noreferrer")
})

test("query-only history preserves the managed identity without refetching", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/om", { waitUntil: "networkidle" })
  const initialRequests = await documentRequests(request)

  const queryPath = "/dramawebben/om?repeat=one&repeat=two&unknown=%2F"
  await routerPush(page, queryPath)
  await expect(page).toHaveURL(new RegExp(`${queryPath.replace(/[?]/gu, "\\?")}$`, "u"))
  await expect(page.getByRole("heading", { name: "Om Dramawebben", exact: true })).toBeVisible()
  expect(await documentRequests(request)).toEqual(initialRequests)

  await page.goBack()
  await expect(page).toHaveURL(/\/dramawebben\/om$/u)
  expect(await documentRequests(request)).toEqual(initialRequests)

  await page.goForward()
  await expect(page).toHaveURL(/repeat=one&repeat=two&unknown=%2F$/u)
  expect(await documentRequests(request)).toEqual(initialRequests)
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("om and kringtexter navigation accepts only the current document identity", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/om", { waitUntil: "networkidle" })
  await routerPush(page, "/dramawebben/kringtexter")

  await expect(page).toHaveURL(/\/dramawebben\/kringtexter$/u)
  await expect(page.getByRole("heading", {
    name: "Mer läsning om svensk dramatik",
    exact: true
  })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Om Dramawebben", exact: true }))
    .toHaveCount(0)
  expect(await documentRequests(request)).toEqual([
    {
      method: "GET",
      path: "/red/dramawebben/om.html",
      authorization: null,
      cookie: null
    },
    {
      method: "GET",
      path: "/red/dramawebben/kringtexter/kringtexter.html",
      authorization: null,
      cookie: null
    }
  ])
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("a delayed om response cannot replace the latest kringtexter identity", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben", { waitUntil: "networkidle" })

  let releaseOm!: () => void
  const omGate = new Promise<void>(resolve => { releaseOm = resolve })
  let omRequested!: () => void
  const omStarted = new Promise<void>(resolve => { omRequested = resolve })
  await page.route("**/nuxt-api/dramawebben/documents/om", async route => {
    omRequested()
    await omGate
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        documentKind: "om",
        bodyHtml: "<h2>Om Dramawebben</h2><p>late-om-probe</p>"
      })
    })
  })

  const slowOm = routerPush(page, "/dramawebben/om")
  await omStarted
  await expect(page.locator(".page_content")).not.toContainText("late-om-probe")

  await routerPush(page, "/dramawebben/kringtexter")
  await expect(page.getByRole("heading", {
    name: "Mer läsning om svensk dramatik",
    exact: true
  })).toBeVisible()
  releaseOm()
  await slowOm
  await page.waitForTimeout(100)

  await expect(page).toHaveURL(/\/dramawebben\/kringtexter$/u)
  await expect(page.locator(".page_content")).not.toContainText("late-om-probe")
  await expect(page.locator(".error")).toHaveCount(0)
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("a malformed successful document is redacted inside the stable latest shell", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/om", { waitUntil: "networkidle" })
  await page.route("**/nuxt-api/dramawebben/documents/kringtexter", route => route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ documentKind: "kringtexter", bodyHtml: 42 })
  }))

  await routerPush(page, "/dramawebben/kringtexter")
  await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
  await expect(page.locator(".error")).toHaveText("Innehållet kan inte visas just nu.")
  await expect(page.locator(".page_content")).not.toContainText("Om Dramawebben")
  await expectExactLinks(page, "kringtexter")
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("the catalog hydrates once from SSR without a browser or legacy data request", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const browserCatalogRequests: string[] = []
  page.on("request", outgoing => {
    if (new URL(outgoing.url()).pathname === "/api/v2/dramawebben/catalog") {
      browserCatalogRequests.push(outgoing.url())
    }
  })
  const response = await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  expect(response?.status()).toBe(200)
  await expect(page.locator("body")).toHaveClass(
    "focus page-dramaweb drama-dramasubpage ready"
  )
  await expect(page.locator("#mainview > .cover.show")).toHaveCount(1)
  await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
  await expectClosedCatalogRootSiblings(page)
  await expectExactLinks(page, "pjäser")
  await expect(page.locator("table.contenttable:not(.authors) tbody tr")).toHaveText(
    dramawebbenCatalogExpected.plays
  )
  expect(browserCatalogRequests).toEqual([])
  expect(await catalogRequests(request)).toEqual([{
    method: "GET",
    path: "/private-v2/dramawebben/catalog",
    authorization: null,
    cookie: null
  }])
  expect(await documentRequests(request)).toEqual([])
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("mounts the catalog shell before the catalog request settles", async ({ page }) => {
  let releaseCatalog = () => {}
  const catalogGate = new Promise<void>(resolve => { releaseCatalog = resolve })
  let catalogStarted = () => {}
  const catalogRequestStarted = new Promise<void>(resolve => { catalogStarted = resolve })
  let gateCatalog = false
  const catalogRoute = async (route: import("@playwright/test").Route) => {
    if (!gateCatalog) {
      await route.abort()
      return
    }
    const response = await route.fetch()
    catalogStarted()
    await catalogGate
    await route.fulfill({ response })
  }

  await page.route("**/api/v2/dramawebben/catalog", catalogRoute)
  let navigation: Promise<void> | null = null
  try {
    await page.goto("/om/ide", { waitUntil: "networkidle" })
    await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()

    gateCatalog = true
    navigation = routerPush(page, "/dramawebben/pj%C3%A4ser")
    await catalogRequestStarted

    await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
    const catalogStatus = page.locator(".page_content > [role='status']")
    await expect(catalogStatus).toHaveCount(1)
    await expect(catalogStatus).toHaveText("Laddar Dramawebbens katalog")
    await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toHaveCount(0)
    await expect(page.locator("table.contenttable")).toHaveCount(0)

    releaseCatalog()
    await expectPlayRows(page, dramawebbenCatalogExpected.plays)
  } finally {
    releaseCatalog()
    await navigation?.catch(() => undefined)
    await page.unroute("**/api/v2/dramawebben/catalog", catalogRoute)
  }
})

test("leaving a pending catalog request keeps its later settlement inert", async ({ page }) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()

  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window)
    let releaseFirstCatalog = () => {}
    const firstCatalogGate = new Promise<void>(resolve => { releaseFirstCatalog = resolve })
    let releaseSecondCatalog = () => {}
    const secondCatalogGate = new Promise<void>(resolve => { releaseSecondCatalog = resolve })
    const gate = {
      requests: 0,
      firstStarted: false,
      firstReleased: false,
      firstAbortedWhenReleased: false,
      releaseFirst: releaseFirstCatalog,
      releaseSecond: releaseSecondCatalog,
      restore: () => { window.fetch = nativeFetch }
    }
    ;(window as typeof window & { __dramawebbenCatalogGate?: typeof gate })
      .__dramawebbenCatalogGate = gate
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      if (new URL(request.url).pathname !== "/api/v2/dramawebben/catalog") {
        return nativeFetch(input, init)
      }
      gate.requests += 1
      const response = await nativeFetch(input, init)
      if (gate.requests === 1) {
        gate.firstStarted = true
        await firstCatalogGate
        gate.firstReleased = true
        gate.firstAbortedWhenReleased = request.signal.aborted
      } else {
        await secondCatalogGate
      }
      return response
    }
  })
  try {
    void routerPush(page, "/dramawebben/pj%C3%A4ser")
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & {
        __dramawebbenCatalogGate?: { firstStarted: boolean }
      }).__dramawebbenCatalogGate?.firstStarted ?? false
    ))).toBe(true)
    await expect(page.locator(".page_content > [role='status']")).toHaveText(
      "Laddar Dramawebbens katalog"
    )

    await routerPush(page, "/om/ide")
    await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()
    await page.evaluate(() => (
      (window as typeof window & {
        __dramawebbenCatalogGate?: { releaseFirst: () => void }
      }).__dramawebbenCatalogGate?.releaseFirst()
    ))
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & {
        __dramawebbenCatalogGate?: {
          firstReleased: boolean
          firstAbortedWhenReleased: boolean
        }
      }).__dramawebbenCatalogGate
    ))).toMatchObject({ firstReleased: true, firstAbortedWhenReleased: true })

    void routerPush(page, "/dramawebben/pj%C3%A4ser")
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & {
        __dramawebbenCatalogGate?: { requests: number }
      }).__dramawebbenCatalogGate?.requests ?? 0
    )), { timeout: 2_000 }).toBe(2)
    await expect(page.locator("table.contenttable")).toHaveCount(0)
    await expect(page.locator(".page_content > [role='status']")).toHaveText(
      "Laddar Dramawebbens katalog"
    )

    await page.evaluate(() => (
      (window as typeof window & {
        __dramawebbenCatalogGate?: { releaseSecond: () => void }
      }).__dramawebbenCatalogGate?.releaseSecond()
    ))
    await expectPlayRows(page, dramawebbenCatalogExpected.plays)
  } finally {
    await page.evaluate(() => {
      const gate = (window as typeof window & {
        __dramawebbenCatalogGate?: {
          releaseFirst: () => void
          releaseSecond: () => void
          restore: () => void
        }
      }).__dramawebbenCatalogGate
      gate?.releaseFirst()
      gate?.releaseSecond()
      gate?.restore()
    })
  }
})

test("source information does not suspend the catalog after it settles", async ({ page }) => {
  let releaseCatalog = () => {}
  const catalogGate = new Promise<void>(resolve => { releaseCatalog = resolve })
  let releaseSourceInfo = () => {}
  const sourceInfoGate = new Promise<void>(resolve => { releaseSourceInfo = resolve })
  const startedResources = new Set<string>()
  let gateCatalog = false
  const markStarted = (resource: string) => {
    startedResources.add(resource)
  }
  const catalogRoute = async (route: import("@playwright/test").Route) => {
    if (!gateCatalog) {
      await route.abort()
      return
    }
    const response = await route.fetch()
    markStarted("catalog")
    await catalogGate
    await route.fulfill({ response })
  }
  const sourceInfoRoute = async (route: import("@playwright/test").Route) => {
    const response = await route.fetch()
    markStarted("source-info")
    await sourceInfoGate
    await route.fulfill({ response })
  }

  await page.route("**/api/v2/dramawebben/catalog", catalogRoute)
  await page.route(
    "**/nuxt-api/reader/source-info/Alml%C3%B6fN/Affarer",
    sourceInfoRoute
  )
  let navigation: Promise<void> | null = null
  try {
    await page.goto("/om/ide", { waitUntil: "networkidle" })
    await expect(page.getByRole("heading", { name: "Om Litteraturbanken" })).toBeVisible()

    gateCatalog = true
    navigation = routerPush(
      page,
      "/dramawebben/pj%C3%A4ser?om-boken&authorid=Alml%C3%B6fN&titlepath=Affarer"
    )
    await expect.poll(() => [...startedResources].sort(), { timeout: 2_000 })
      .toEqual(["catalog", "source-info"])

    await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
    const catalogStatus = page.locator(".page_content > [role='status']")
    await expect(catalogStatus).toHaveCount(1)
    await expect(catalogStatus).toHaveText("Laddar Dramawebbens katalog")
    expect(startedResources).toEqual(new Set(["catalog", "source-info"]))

    releaseCatalog()
    await expectPlayRows(page, dramawebbenCatalogExpected.plays)
    const dialog = page.getByRole("dialog", { name: "Om boken", exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator(".preloader")).toContainText("Hämtar")

    releaseSourceInfo()
    await expect(dialog).toContainText("Affärer")
  } finally {
    releaseCatalog()
    releaseSourceInfo()
    await navigation?.catch(() => undefined)
    await page.unroute(
      "**/nuxt-api/reader/source-info/Alml%C3%B6fN/Affarer",
      sourceInfoRoute
    )
    await page.unroute("**/api/v2/dramawebben/catalog", catalogRoute)
  }
})

test("a visible infopost link owns only its query keys and close restores catalog filters", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/pjäser?visa=pjäser&keep=one&keep=two", {
    waitUntil: "networkidle"
  })

  const trigger = page.getByRole("link", { name: "infopost", exact: true })
  await trigger.click()

  const dialog = page.getByRole("dialog", { name: "Om boken", exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText("Barnens teater")
  await expect(dialog).toBeFocused()
  const opened = new URL(page.url())
  expect(opened.hash).toBe("#dw")
  expect([...opened.searchParams.entries()]).toEqual([
    ["visa", "pjäser"],
    ["keep", "one"],
    ["keep", "two"],
    ["om-boken", ""],
    ["authorid", "Anonym"],
    ["titlepath", "BarnensTeater"]
  ])
  await expect.poll(() => new URL(page.url()).searchParams.has("om-boken")).toBe(true)

  await page.getByRole("button", { name: "Stäng", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  const closed = new URL(page.url())
  expect(closed.pathname).toBe("/dramawebben/pj%C3%A4ser")
  expect(closed.search).toBe("?visa=pj%C3%A4ser&keep=one&keep=two")
  expect(closed.hash).toBe("#dw")

  await page.goBack()
  await expect(dialog).toContainText("Barnens teater")
  await page.goBack()
  await expect(dialog).toHaveCount(0)
  expect(new URL(page.url()).searchParams.getAll("keep")).toEqual(["one", "two"])
  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(problems).toEqual([])
})

test("a long mixed-author catalog uses the clicked infopost identity without scrolling", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await setCatalogFailure(request, "long-mixed-media-author-200")
  await page.setViewportSize({ width: 1280, height: 420 })
  await page.goto("/dramawebben/pj%C3%A4ser?visa=pj%C3%A4ser&keep=scroll", {
    waitUntil: "networkidle"
  })

  const targetRow = page.locator("table.contenttable tbody tr").filter({
    hasText: "Barnens teater"
  })
  const authorLinks = targetRow.locator("td.author a")
  await expect(authorLinks).toHaveCount(2)
  await expect(authorLinks.nth(0)).toHaveText("Wahlenberg, Anna")
  await expect(authorLinks.nth(0)).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/WahlenbergA/dramawebben"
  )
  await expect(authorLinks.nth(1)).toHaveText("Anonym")
  await expect(authorLinks.nth(1)).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/Anonym/dramawebben"
  )

  const trigger = page.getByRole("link", { name: "infopost", exact: true })
  await trigger.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(500)

  await trigger.click()
  const dialog = page.getByRole("dialog", { name: "Om boken", exact: true })
  await expect(dialog).toContainText("Barnens teater")
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before)
  const hashTarget = page.locator("#dw")
  await expect(hashTarget).toHaveCount(1)
  expect(await hashTarget.evaluate(element => {
    const style = getComputedStyle(element)
    const bounds = element.getBoundingClientRect()
    return {
      position: style.position,
      pointerEvents: style.pointerEvents,
      width: bounds.width,
      height: bounds.height,
      ariaHidden: element.getAttribute("aria-hidden")
    }
  })).toEqual({
    position: "fixed",
    pointerEvents: "none",
    width: 0,
    height: 0,
    ariaHidden: "true"
  })
  const opened = new URL(page.url())
  expect(opened.hash).toBe("#dw")
  expect(opened.searchParams.get("visa")).toBe("pjäser")
  expect(opened.searchParams.get("keep")).toBe("scroll")
  expect(opened.searchParams.get("authorid")).toBe("Anonym")
  expect(opened.searchParams.get("titlepath")).toBe("BarnensTeater")

  await page.getByRole("button", { name: "Stäng", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before)
  const closed = new URL(page.url())
  expect(closed.hash).toBe("#dw")
  expect(closed.search).toBe("?visa=pj%C3%A4ser&keep=scroll")
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/Anonym/BarnensTeater/source-info",
    query: ""
  }])
  expect(problems).toEqual([])
})

test("direct source-information query survives hydration, Escape, Back, and Forward", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const openPath = "/dramawebben/pjäser?om-boken&authorid=Alml%C3%B6fN" +
    "&titlepath=Affarer&visa=f%C3%B6rfattare&repeat=one&repeat=two#dw"
  await page.goto(openPath, { waitUntil: "networkidle" })

  const dialog = page.getByRole("dialog", { name: "Om boken", exact: true })
  await expect(dialog).toContainText("Affärer")
  await expect(dialog).toBeFocused()
  expect(await dialog.evaluate(element => ({
    portalRoot: element.closest("[data-headlessui-portal]")?.parentElement?.id,
    portalBodyOwned:
      element.closest("[data-headlessui-portal]")?.parentElement?.parentElement === document.body,
    mainviewOwned: document.querySelector("#mainview")?.contains(element) ?? false
  }))).toEqual({
    portalRoot: "headlessui-portal-root",
    portalBodyOwned: true,
    mainviewOwned: false
  })

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  const closed = new URL(page.url())
  expect(closed.search).toBe("?visa=f%C3%B6rfattare&repeat=one&repeat=two")
  expect([...closed.searchParams.entries()]).toEqual([
    ["visa", "författare"],
    ["repeat", "one"],
    ["repeat", "two"]
  ])
  await expectClosedCatalogRootSiblings(page)

  await page.goBack()
  await expect(dialog).toContainText("Affärer")
  expect([...new URL(page.url()).searchParams.entries()]).toEqual([
    ["om-boken", ""],
    ["authorid", "AlmlöfN"],
    ["titlepath", "Affarer"],
    ["visa", "författare"],
    ["repeat", "one"],
    ["repeat", "two"]
  ])
  await page.goForward()
  await expect(dialog).toHaveCount(0)
  expect(new URL(page.url()).search).toBe("?visa=f%C3%B6rfattare&repeat=one&repeat=two")
  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(problems).toEqual([])
})

test("changing source-information identity aborts the obsolete request", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_source_info_delays`, {
    data: { "AlmlöfN|Affarer": 2_000 }
  })
  const aborted: string[] = []
  page.on("requestfailed", outgoing => {
    if (new URL(outgoing.url()).pathname.includes("/nuxt-api/reader/source-info/Alml%C3%B6fN/Affarer")) {
      aborted.push(outgoing.failure()?.errorText ?? "unknown")
    }
  })
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  void routerPush(
    page,
    "/dramawebben/pj%C3%A4ser?om-boken&authorid=Alml%C3%B6fN&titlepath=Affarer"
  )
  await expect.poll(async () => (await sourceInfoRequests(request)).length).toBe(1)
  await routerPush(
    page,
    "/dramawebben/pj%C3%A4ser?om-boken&authorid=WahlenbergA&titlepath=Cendrillon"
  )

  await expect(page.getByRole("dialog", { name: "Om boken", exact: true }))
    .toContainText("Cendrillon")
  await expect.poll(() => aborted).not.toEqual([])
  const requests = await sourceInfoRequests(request)
  expect(requests.filter(({ path }: { path: string }) => (
    path.endsWith("/WahlenbergA/Cendrillon/source-info")
  ))).toHaveLength(1)
})

test("Cendrillon infopost renders its linked provenance, attribution, and live fact order", async ({
  page
}) => {
  await page.goto(
    "/dramawebben/pjäser?om-boken&authorid=WahlenbergA&titlepath=Cendrillon#dw",
    { waitUntil: "networkidle" }
  )

  const dialog = page.getByRole("dialog", { name: "Om boken", exact: true })
  const provenance = dialog.locator(".provenance")
  await expect(provenance.getByRole("link")).toHaveAttribute(
    "href",
    "http://www.dramawebben.se/"
  )
  await expect(provenance.locator("img")).toHaveAttribute(
    "src",
    "/red/bilder/gemensamt/dramawebben_svart.svg"
  )
  await expect(provenance.locator("p")).toHaveCount(0)
  await expect(dialog.locator(".license")).toContainText(
    "Vid användning ber vi att du hänvisar till Dramawebben och Litteraturbanken.se."
  )
  await expect(dialog.locator(".dramaweb tbody tr")).toHaveText([
    "Svensk premiär1893",
    "Urpremiär1892",
    "Antal sidor96",
    "Antal akter3",
    "Antal roller8",
    "Antal män3",
    "Antal kvinnor4",
    "Antal övriga1"
  ])
})

test("invalid or missing source-information identifiers stay closed without a request", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  for (const path of [
    "/dramawebben/pj%C3%A4ser?om-boken&authorid=Alml%C3%B6fN",
    "/dramawebben/pj%C3%A4ser?om-boken&authorid=..%2Fbad&titlepath=Affarer",
    "/dramawebben/pj%C3%A4ser?om-boken=&authorid=Alml%C3%B6fN&titlepath=Affarer"
  ]) {
    await routerPush(page, path)
    await expect(page.getByRole("dialog", { name: "Om boken", exact: true })).toHaveCount(0)
  }
  expect(await sourceInfoRequests(request)).toEqual([])

  await routerPush(
    page,
    "/dramawebben/pj%C3%A4ser?om-boken=yes&authorid=Alml%C3%B6fN&titlepath=Affarer"
  )
  await expect(page.getByRole("dialog", { name: "Om boken", exact: true }))
    .toContainText("Affärer")
  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(problems).toEqual([])
})

test("a source-information failure remains modal-local and retries from history", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await request.put(`${fixture}/_source_info_failure`)
  const openPath = "/dramawebben/pj%C3%A4ser?om-boken&authorid=Alml%C3%B6fN&titlepath=Affarer"
  const response = await page.goto(openPath, { waitUntil: "networkidle" })

  expect(response?.status()).toBe(200)
  const dialog = page.getByRole("dialog", { name: "Om boken", exact: true })
  await expect(dialog.getByRole("alert")).toHaveText("Ett fel har uppstått.")
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await request.delete(`${fixture}/_source_info_failure`)
  await page.goBack()
  await expect(dialog).toContainText("Affärer")
  expect(await sourceInfoRequests(request)).toHaveLength(2)
  expect(problems).toEqual([])
})

test("a PDF-primary Drama title remains a native static handoff", async ({
  page,
  request
}) => {
  await setCatalogFailure(request, "pdf-primary-200")
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })
  const title = page.locator("table.contenttable:not(.authors) td.title a").first()
  await expect(title).toHaveAttribute(
    "href",
    "/txt/lb-dramat-001/lb-dramat-001.pdf#dw"
  )
  await page.evaluate(() => {
    ;(window as typeof window & { __spaSentinel?: string }).__spaSentinel = "drama-spa"
  })

  await title.click()
  await expect(page).toHaveURL(/\/txt\/lb-dramat-001\/lb-dramat-001\.pdf#dw$/u)
  expect(await page.evaluate(() =>
    (window as typeof window & { __spaSentinel?: string }).__spaSentinel
  )).toBeUndefined()
})

test("the list toggle pushes query-owned history and Back/Forward restores each table", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)
  await expect(page.getByRole("button", { name: "Pjäser", exact: true })).toHaveClass(/\bactive\b/u)
  await expect(page.getByRole("button", { name: "Författare", exact: true }))
    .not.toHaveClass(/\bactive\b/u)

  await page.getByRole("button", { name: "Författare", exact: true }).click()
  await expectQuery(page, "visa", "författare")
  await expectAuthorRows(page, dramawebbenCatalogExpected.authors)
  await expect(page.getByRole("button", { name: "Författare", exact: true }))
    .toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: "Pjäser", exact: true }))
    .not.toHaveClass(/\bactive\b/u)
  await expect(page.getByRole("button", { name: "Författare", exact: true }))
    .toHaveClass(/\bactive\b/u)

  await page.goBack()
  await expectQuery(page, "visa", null)
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)

  await page.goForward()
  await expectQuery(page, "visa", "författare")
  await expectAuthorRows(page, dramawebbenCatalogExpected.authors)

  await expectOneCatalogRequest(request)
  expect(problems).toEqual([])
})

test("every legacy catalog filter is query-owned, local, inclusive, and clearable", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })
  const clear = page.getByRole("button", { name: "Rensa filter", exact: true })

  await page.getByRole("button", { name: "Visa författare", exact: true }).click()
  await page.getByRole("option", { name: "Strindberg, August 1849-1912" }).click()
  await expectQuery(page, "author", "StrindbergA")
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])
  await clear.click()
  await expectQuery(page, "author", null)
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)

  await page.getByRole("button", { name: "Kön", exact: true }).click()
  await page.getByRole("option", { name: "Kvinnliga författare", exact: true }).click()
  await expectQuery(page, "gender", "female")
  await expect(page.getByRole("button", {
    name: "Kön: Kvinnliga författare",
    exact: true
  })).toBeVisible()
  await expectPlayRows(page, [
    dramawebbenCatalogExpected.plays[0]!,
    dramawebbenCatalogExpected.plays[3]!
  ])
  await clear.click()

  await page.getByRole("button", { name: "Utgivningsformat", exact: true }).click()
  await page.getByRole("option", { name: "PDF", exact: true }).click()
  await expectQuery(page, "mediatype", "pdf")
  await expect(page.getByRole("button", {
    name: "Utgivningsformat: PDF",
    exact: true
  })).toBeVisible()
  await expectPlayRows(page, [
    dramawebbenCatalogExpected.plays[0]!,
    dramawebbenCatalogExpected.plays[2]!
  ])
  await clear.click()

  await page.getByRole("textbox", { name: "Sök", exact: true }).fill("AUGUST 1888")
  await expectQuery(page, "filterTxt", "AUGUST 1888")
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])
  await clear.click()

  const rangeButton = page.getByRole("button", { name: "Akter och roller", exact: true })
  await rangeButton.click()
  await page.getByRole("button", { name: "Barnpjäs", exact: true }).click()
  await expectQuery(page, "barnlitteratur", "true")
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[1]!])
  await clear.click()

  await rangeButton.click()
  const pagesFrom = page.getByRole("slider", { name: "Antal sidor från", exact: true })
  await pagesFrom.evaluate((input: HTMLInputElement) => {
    input.value = "90"
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expectQuery(page, "number_of_pages", "90,120")
  await expectPlayRows(page, [
    dramawebbenCatalogExpected.plays[2]!,
    dramawebbenCatalogExpected.plays[3]!
  ])
  const pagesTo = page.getByRole("slider", { name: "Antal sidor till", exact: true })
  await pagesTo.evaluate((input: HTMLInputElement) => {
    input.value = "100"
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expectQuery(page, "number_of_pages", "90,100")
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])

  await clear.click()
  await expect(page).toHaveURL(/\/dramawebben\/pj%C3%A4ser$/u)
  await expect(clear).toHaveCount(0)
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)
  await expectOneCatalogRequest(request)
  expect(problems).toEqual([])
})

test("author results compose gender and text filters and apply media filters", async ({
  page
}) => {
  await page.goto(
    "/dramawebben/pj%C3%A4ser?visa=f%C3%B6rfattare&gender=female&filterTxt=wahlenberg",
    { waitUntil: "networkidle" }
  )

  await expectAuthorRows(page, [dramawebbenCatalogExpected.authors[3]!])
  await page.goto(
    "/dramawebben/pj%C3%A4ser?visa=f%C3%B6rfattare&mediatype=pdf",
    { waitUntil: "networkidle" }
  )
  await expectAuthorRows(page, [
    dramawebbenCatalogExpected.authors[0]!,
    dramawebbenCatalogExpected.authors[2]!
  ])
})

test("play gender filtering includes matching secondary authors", async ({ page, request }) => {
  await setCatalogFailure(request, "secondary-female-author-200")
  await page.goto(
    "/dramawebben/pj%C3%A4ser?gender=female&filterTxt=Barnens",
    { waitUntil: "networkidle" }
  )

  await expectPlayRows(page, [
    "Strindberg, August & Wahlenberg, Anna Barnens teater infopost"
  ])
})

test("same-tick catalog filters merge into one intended route state", async ({ page }) => {
  await page.goto("/dramawebben/pj%C3%A4ser", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Akter och roller", exact: true }).click()

  await page.evaluate(() => {
    const range = document.querySelector<HTMLInputElement>(
      'input[aria-label="Antal sidor från"]'
    )!
    const filter = document.querySelector<HTMLInputElement>('input[aria-label="Sök"]')!
    range.value = "90"
    range.dispatchEvent(new Event("change", { bubbles: true }))
    filter.value = "Julie"
    filter.dispatchEvent(new Event("input", { bubbles: true }))
  })

  await expectQuery(page, "number_of_pages", "90,120")
  await expectQuery(page, "filterTxt", "Julie")
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])
})

test("same-tick children-filter activations toggle the intended route state", async ({ page }) => {
  await page.goto("/dramawebben/pj%C3%A4ser", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Akter och roller", exact: true }).click()

  await page.evaluate(() => {
    const children = document.querySelector<HTMLButtonElement>('button[aria-label="Barnpjäs"]')!
    const filter = document.querySelector<HTMLInputElement>('input[aria-label="Sök"]')!
    children.click()
    children.click()
    filter.value = "Julie"
    filter.dispatchEvent(new Event("input", { bubbles: true }))
  })

  await expectQuery(page, "filterTxt", "Julie")
  await expectQuery(page, "barnlitteratur", null)
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])
})

test("same-tick range endpoint changes merge through the intended query", async ({ page }) => {
  await page.goto("/dramawebben/pj%C3%A4ser", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Akter och roller", exact: true }).click()

  await page.evaluate(() => {
    const from = document.querySelector<HTMLInputElement>(
      'input[aria-label="Antal sidor från"]'
    )!
    const to = document.querySelector<HTMLInputElement>(
      'input[aria-label="Antal sidor till"]'
    )!
    from.value = "90"
    from.dispatchEvent(new Event("change", { bubbles: true }))
    to.value = "100"
    to.dispatchEvent(new Event("change", { bubbles: true }))
  })

  await expectQuery(page, "number_of_pages", "90,100")
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])
})

test("the literal free-text search value all is not treated as an enum sentinel", async ({
  page
}) => {
  await page.goto("/dramawebben/pj%C3%A4ser", { waitUntil: "networkidle" })

  await page.getByRole("textbox", { name: "Sök", exact: true }).fill("all")

  await expectQuery(page, "filterTxt", "all")
  await expectPlayRows(page, [])
})

test("a same-tick clear supersedes queued catalog filter writes", async ({ page }) => {
  await page.goto(
    "/dramawebben/pj%C3%A4ser?gender=female",
    { waitUntil: "networkidle" }
  )

  await page.evaluate(() => {
    const filter = document.querySelector<HTMLInputElement>('input[aria-label="Sök"]')!
    const clear = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find(button => button.textContent?.trim() === "Rensa filter")!
    filter.value = "Julie"
    filter.dispatchEvent(new Event("input", { bubbles: true }))
    clear.click()
  })

  await expect(page).toHaveURL(/\/dramawebben\/pj%C3%A4ser$/u)
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)
})

test("clear removes only catalog-owned filters and stays hidden for unrelated query state", async ({
  page
}) => {
  await page.goto(
    "/dramawebben/pj%C3%A4ser?keep=one&gender=female",
    { waitUntil: "networkidle" }
  )

  const clear = page.getByRole("button", { name: "Rensa filter", exact: true })
  await clear.click()

  await expectQuery(page, "gender", null)
  await expectQuery(page, "keep", "one")
  await expect(clear).toHaveCount(0)
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)
})

test("same-page browser history supersedes a queued catalog filter write", async ({ page }) => {
  await page.goto("/dramawebben/pj%C3%A4ser", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Författare", exact: true }).click()
  await expectQuery(page, "visa", "författare")

  await page.evaluate(() => {
    const filter = document.querySelector<HTMLInputElement>('input[aria-label="Sök"]')!
    filter.value = "Julie"
    filter.dispatchEvent(new Event("input", { bubbles: true }))
    history.back()
  })

  await expectQuery(page, "visa", null)
  await expectQuery(page, "filterTxt", null)
  await expectPlayRows(page, dramawebbenCatalogExpected.plays)
})

test("restoring a catalog range to its full bounds removes the inactive filter", async ({
  page
}) => {
  await page.goto(
    "/dramawebben/pj%C3%A4ser?number_of_pages=24,120",
    { waitUntil: "networkidle" }
  )
  await page.getByRole("button", { name: "Akter och roller", exact: true }).click()

  await page.getByRole("slider", { name: "Antal sidor från", exact: true })
    .evaluate((input: HTMLInputElement) => {
      input.value = input.min
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })

  await expectQuery(page, "number_of_pages", null)
  await expect(page.getByRole("button", { name: "Rensa filter", exact: true })).toHaveCount(0)
})

test("range bare-track pointers choose the nearest handle and mutate the route once", async ({
  page
}) => {
  const openPagesRange = async () => {
    await page.goto(
      "/dramawebben/pj%C3%A4ser?number_of_pages=24,120&keep=one&keep=two",
      { waitUntil: "networkidle" }
    )
    await page.getByRole("button", { name: "Akter och roller", exact: true }).click()
    await page.evaluate(() => {
      const state = window as typeof window & { __rangeMutations?: number }
      const push = history.pushState.bind(history)
      const replace = history.replaceState.bind(history)
      state.__rangeMutations = 0
      history.pushState = (...args) => {
        state.__rangeMutations! += 1
        return push(...args)
      }
      history.replaceState = (...args) => {
        state.__rangeMutations! += 1
        return replace(...args)
      }
    })
  }
  const clickPages = async (value: number) => {
    const track = page.locator("[data-drama-range=number_of_pages]")
    const box = await track.boundingBox()
    const lineBox = await track.locator("input[type=range]").first().boundingBox()
    expect(box).not.toBeNull()
    expect(lineBox).not.toBeNull()
    const x = box!.x + 7.5 + (box!.width - 15) * (value - 18) / (120 - 18)
    await page.mouse.click(x, lineBox!.y + lineBox!.height / 2)
  }
  const mutationCount = () => page.evaluate(
    () => (window as typeof window & { __rangeMutations?: number }).__rangeMutations
  )

  await openPagesRange()
  await clickPages(30)
  await expect(page.getByRole("slider", { name: "Antal sidor från" })).toBeFocused()
  await expectQuery(page, "number_of_pages", "30,120")
  const lowerQuery = new URL(page.url()).searchParams
  expect(lowerQuery.getAll("keep")).toEqual(["one", "two"])
  expect(await mutationCount()).toBe(1)

  await openPagesRange()
  await clickPages(110)
  await expect(page.getByRole("slider", { name: "Antal sidor till" })).toBeFocused()
  await expectQuery(page, "number_of_pages", "24,110")
  expect(await mutationCount()).toBe(1)

  await openPagesRange()
  await clickPages(72)
  await expect(page.getByRole("slider", { name: "Antal sidor till" })).toBeFocused()
  await expectQuery(page, "number_of_pages", "24,72")
  expect(await mutationCount()).toBe(1)

  await openPagesRange()
  const pagesTrack = page.locator("[data-drama-range=number_of_pages]")
  const box = await pagesTrack.boundingBox()
  const lineBox = await pagesTrack.locator("input[type=range]").first().boundingBox()
  expect(box).not.toBeNull()
  expect(lineBox).not.toBeNull()
  await page.mouse.click(box!.x + 1, lineBox!.y + lineBox!.height / 2)
  await expectQuery(page, "number_of_pages", null)
  expect(new URL(page.url()).searchParams.getAll("keep")).toEqual(["one", "two"])
  expect(await mutationCount()).toBe(1)
})

test("all drama range tracks share pointer behavior while native keyboard input stays native", async ({
  page
}) => {
  await page.goto("/dramawebben/pj%C3%A4ser?keep=range", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Akter och roller", exact: true }).click()

  for (const key of [
    "number_of_acts",
    "number_of_roles",
    "number_of_pages",
    "female_roles",
    "male_roles",
    "other_roles"
  ]) {
    const track = page.locator(`[data-drama-range=${key}]`)
    const box = await track.boundingBox()
    const lineBox = await track.locator("input[type=range]").first().boundingBox()
    expect(box).not.toBeNull()
    expect(lineBox).not.toBeNull()
    await page.mouse.click(box!.x + box!.width * 0.4, lineBox!.y + lineBox!.height / 2)
    await expect.poll(() => new URL(page.url()).searchParams.has(key)).toBe(true)
  }

  const pagesFrom = page.getByRole("slider", { name: "Antal sidor från" })
  await pagesFrom.focus()
  const before = Number(await pagesFrom.inputValue())
  await page.keyboard.press("ArrowRight")
  await expectQuery(page, "number_of_pages", `${before + 1},120`)
  expect(new URL(page.url()).searchParams.get("keep")).toBe("range")

  const beforeRightClick = page.url()
  await page.locator("[data-drama-range=number_of_pages]").dispatchEvent("pointerdown", {
    button: 2,
    clientX: 0,
    clientY: 0,
    pointerId: 72
  })
  expect(page.url()).toBe(beforeRightClick)
})

test("native drama range endpoints constrain only the endpoint being edited", async ({ page }) => {
  await page.goto(
    "/dramawebben/pj%C3%A4ser?number_of_pages=24,60",
    { waitUntil: "networkidle" }
  )
  await page.getByRole("button", { name: "Akter och roller", exact: true }).click()

  const from = page.getByRole("slider", { name: "Antal sidor från" })
  await from.evaluate((element: HTMLInputElement) => {
    element.value = "90"
    element.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expectQuery(page, "number_of_pages", "60,60")

  const to = page.getByRole("slider", { name: "Antal sidor till" })
  await to.evaluate((element: HTMLInputElement) => {
    element.value = "40"
    element.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expectQuery(page, "number_of_pages", "60,60")
})

test("drama range pointers ignore completion and cancellation from other pointers", async ({
  page
}) => {
  await page.goto(
    "/dramawebben/pj%C3%A4ser?number_of_pages=24,120&keep=pointer",
    { waitUntil: "networkidle" }
  )
  await page.getByRole("button", { name: "Akter och roller", exact: true }).click()
  const track = page.locator("[data-drama-range=number_of_pages]")
  const box = await track.boundingBox()
  const lineBox = await track.locator("input[type=range]").first().boundingBox()
  expect(box).not.toBeNull()
  expect(lineBox).not.toBeNull()
  const valueX = (value: number) => (
    box!.x + 7.5 + (box!.width - 15) * (value - 18) / (120 - 18)
  )
  const y = lineBox!.y + lineBox!.height / 2

  await track.evaluate(element => {
    element.setPointerCapture = () => undefined
  })
  await track.dispatchEvent("pointerdown", {
    button: 0,
    clientX: valueX(30),
    clientY: y,
    pointerId: 91
  })
  await track.dispatchEvent("pointercancel", { pointerId: 92 })
  await track.dispatchEvent("pointerup", {
    button: 0,
    clientX: valueX(80),
    clientY: y,
    pointerId: 92
  })
  await page.waitForTimeout(50)
  await expectQuery(page, "number_of_pages", "24,120")

  await track.dispatchEvent("pointerup", {
    button: 0,
    clientX: valueX(40),
    clientY: y,
    pointerId: 91
  })
  await expectQuery(page, "number_of_pages", "40,120")
  expect(new URL(page.url()).searchParams.get("keep")).toBe("pointer")
})

test("drama range capture loss prevents a later stale pointer commit", async ({ page }) => {
  await page.goto(
    "/dramawebben/pj%C3%A4ser?number_of_pages=24,120&keep=capture",
    { waitUntil: "networkidle" }
  )
  await page.getByRole("button", { name: "Akter och roller", exact: true }).click()
  const track = page.locator("[data-drama-range=number_of_pages]")
  const box = await track.boundingBox()
  const lineBox = await track.locator("input[type=range]").first().boundingBox()
  expect(box).not.toBeNull()
  expect(lineBox).not.toBeNull()
  const valueX = (value: number) => (
    box!.x + 7.5 + (box!.width - 15) * (value - 18) / (120 - 18)
  )
  const y = lineBox!.y + lineBox!.height / 2

  await track.evaluate(element => {
    element.setPointerCapture = () => undefined
    element.addEventListener("pointercancel", event => event.stopImmediatePropagation(), {
      capture: true
    })
  })
  await track.dispatchEvent("pointerdown", {
    button: 0,
    clientX: valueX(30),
    clientY: y,
    pointerId: 82
  })
  await expect(page.getByRole("slider", { name: "Antal sidor från" })).toBeFocused()
  await track.dispatchEvent("lostpointercapture", { pointerId: 82 })
  await track.dispatchEvent("pointermove", {
    button: 0,
    clientX: valueX(40),
    clientY: y,
    pointerId: 82
  })
  await track.dispatchEvent("pointerup", {
    button: 0,
    clientX: valueX(40),
    clientY: y,
    pointerId: 82
  })

  await page.waitForTimeout(100)
  await expectQuery(page, "number_of_pages", "24,120")
  expect(new URL(page.url()).searchParams.get("keep")).toBe("capture")
})

test("Headless UI catalog controls support keyboard, Escape, outside close, and focus return", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  const genderButton = page.getByRole("button", { name: /^Kön(?:$|:)/u })
  await genderButton.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("option", { name: "Alla författare", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("option", { name: "Alla författare", exact: true })).toHaveCount(0)
  await expect(genderButton).toBeFocused()

  await page.keyboard.press("Enter")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expectQuery(page, "gender", "female")
  await expect(genderButton).toBeFocused()
  await routerPush(page, "/dramawebben/pj%C3%A4ser")
  await expectQuery(page, "gender", null)

  const mediaButton = page.getByRole("button", { name: /^Utgivningsformat(?:$|:)/u })
  await mediaButton.click()
  await expect(page.getByRole("option", { name: "PDF", exact: true })).toBeVisible()
  await page.locator(".page_content p").first().click()
  await expect(page.getByRole("option", { name: "PDF", exact: true })).toHaveCount(0)

  const rangeButton = page.getByRole("button", { name: "Akter och roller", exact: true })
  await rangeButton.click()
  const childrenButton = page.getByRole("button", { name: "Barnpjäs", exact: true })
  await childrenButton.focus()
  await page.keyboard.press("Escape")
  await expect(childrenButton).toHaveCount(0)
  await expect(rangeButton).toBeFocused()
  await rangeButton.click()
  await expect(page.getByRole("button", { name: "Barnpjäs", exact: true })).toBeVisible()
  await page.locator(".page_content p").first().click()
  await expect(page.getByRole("button", { name: "Barnpjäs", exact: true })).toHaveCount(0)
  await expect(rangeButton).toBeFocused()

  // Headless UI labels the input from its associated trigger button.
  const authorInput = page.getByRole("combobox", { name: "Visa författare", exact: true })
  await authorInput.focus()
  await expect(authorInput).toBeFocused()
  await authorInput.press("ArrowDown")
  await authorInput.fill("Strindberg")
  const strindbergOption = page.getByRole("option", { name: "Strindberg, August 1849-1912" })
  await expect(strindbergOption).toBeVisible()
  await authorInput.press("ArrowDown")
  await expect(strindbergOption).toHaveAttribute("data-headlessui-state", /\bactive\b/u)
  await authorInput.press("Enter")
  await expectQuery(page, "author", "StrindbergA")
  await expect(authorInput).toBeFocused()
  await expectPlayRows(page, [dramawebbenCatalogExpected.plays[2]!])

  await expectOneCatalogRequest(request)
  expect(problems).toEqual([])
})

test("a catalog 503 keeps the hydrated shell stable without leaking upstream text", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await setCatalogFailure(request, "status-503")
  const response = await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  expect(response?.status()).toBe(503)
  await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
  await expectExactLinks(page, "pjäser")
  await expect(page.locator(".error")).toHaveText("Innehållet kan inte visas just nu.")
  await expect(page.locator(".page_content")).not.toContainText(
    "Unable to load Dramawebben catalog"
  )
  expect(await catalogRequests(request)).toEqual([{
    method: "GET",
    path: "/private-v2/dramawebben/catalog",
    authorization: null,
    cookie: null
  }])
  expect(await documentRequests(request)).toEqual([])
  await expectNoExcludedDataRequests(request)
  expect(problems.filter(problem => !/status of 503 \(Service Unavailable\)/u.test(problem)))
    .toEqual([])
})
