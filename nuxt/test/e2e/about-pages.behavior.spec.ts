import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const expectedLinks = [
  ["Intro", "/om/ide"],
  ["Organisation", "/om/organisation"],
  ["Hjälp", "/om/hjalp"],
  ["Rättigheter", "/om/rattigheter"],
  ["Tack", "/om/tack"],
  ["Statistik", "/om/statistik"],
  ["Kontakt", "/om/kontakt"]
] as const

const staticPages = [
  {
    slug: "ide",
    navName: "Intro",
    activeName: "Intro",
    heading: "Introduktion",
    contentPath: "/red/om/ide/omlitteraturbanken.html",
    redRequests: ["/red/om/ide/omlitteraturbanken.html"]
  },
  {
    slug: "organisation",
    navName: "Organisation",
    activeName: null,
    heading: "Organisation",
    contentPath: "/red/om/ide/organisation.html",
    redRequests: ["/red/om/ide/organisation.html"]
  },
  {
    slug: "rattigheter",
    navName: "Rättigheter",
    activeName: "Rättigheter",
    heading: "Rättigheter och material",
    contentPath: "/red/om/rattigheter/rattigheter.html",
    redRequests: [
      "/red/om/rattigheter/rattigheter.html",
      "/red/om/rattigheter/cc_by.png",
      "/red/om/rattigheter/cc_publicdomain.png"
    ]
  },
  {
    slug: "tack",
    navName: "Tack",
    activeName: "Tack",
    heading: "Litteraturbanken tackar",
    contentPath: "/red/om/tack.html",
    redRequests: ["/red/om/tack.html"]
  }
] as const

async function reset(request: APIRequestContext) {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function openSuccessfulPage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
}

async function openWithoutBrowserErrors(page: Page, path: string) {
  const problems = captureBrowserProblems(page)
  await openSuccessfulPage(page, path)
  return problems
}

async function loggedRedRequests(request: APIRequestContext) {
  const log = await (await request.get(`${fixture}/_requests`)).json()
  return (log.requests as string[]).filter(path => path.startsWith("/red/"))
}

async function startClientNavigation(page: Page, path: string) {
  await page.evaluate(target => {
    type Router = { push: (path: string) => Promise<unknown> }
    type VueRoot = HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router?: Router } } }
    }
    const router = (document.querySelector("#__nuxt") as VueRoot | null)
      ?.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt router is unavailable")
    void router.push(target)
  }, path)
}

test.beforeEach(async ({ request }) => reset(request))

for (const staticPage of staticPages) {
  test(`${staticPage.navName} renders managed content, exact active state, and no browser errors`, async ({ page }) => {
    const problems = await openWithoutBrowserErrors(page, `/om/${staticPage.slug}`)
    await expect(page).toHaveTitle("Om LB | Litteraturbanken")
    await expect(page.locator("body")).toHaveClass(/\bpage-about\b/)
    for (const [name, href] of expectedLinks) {
      await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", href)
    }

    const activeLinks = page.locator("ul.links a.active")
    if (staticPage.activeName === null) {
      await expect(activeLinks).toHaveCount(0)
      const organisation = page.getByRole("link", { name: "Organisation", exact: true })
      await expect(organisation).not.toHaveClass(
        /(?:^|\s)(?:active|router-link-active|router-link-exact-active)(?:\s|$)/
      )
      expect(await organisation.getAttribute("aria-current")).toBeNull()
    } else {
      await expect(activeLinks).toHaveCount(1)
      const activeLink = page.getByRole("link", { name: staticPage.activeName, exact: true })
      await expect(activeLink).toHaveClass(/\bactive\b/)
      await expect(activeLink).toHaveClass(/\brouter-link-active\b/)
      await expect(activeLink).toHaveClass(/\brouter-link-exact-active\b/)
      await expect(activeLink).toHaveAttribute("aria-current", "page")
    }
    await expect(page.getByRole("heading", { name: staticPage.heading, exact: true })).toBeVisible()

    if (staticPage.slug === "ide") {
      await expect(page.getByRole("link", { name: "webbplatsen", exact: true })).toHaveAttribute("href", "/epub")
    }
    if (staticPage.slug === "rattigheter") {
      await expect(page.locator('img[src="/red/om/rattigheter/cc_by.png"]').first()).toBeVisible()
      await expect(page.locator('img[src="/red/om/rattigheter/cc_publicdomain.png"]')).toBeVisible()
      await expect(page.getByRole("link", { name: "https://creativecommons.org/licenses/by/4.0/" })).toHaveAttribute(
        "href",
        "https://creativecommons.org/licenses/by/4.0/"
      )
    }
    if (staticPage.slug === "tack") {
      await expect(page.locator("#mainview")).toContainText("Uppsala universitetsbibliotek")
      await expect(page.getByRole("link", { name: "GÖTEBORGS UNIVERSITETSBIBLIOTEK", exact: true })).toHaveAttribute(
        "href",
        "http://www.ub.gu.se/"
      )
    }
    expect(problems).toEqual([])
  })
}

for (const staticPage of staticPages) {
  test(`Statistics transitions to ${staticPage.navName} and back without duplicate content requests`, async ({ page, request }) => {
    const problems = captureBrowserProblems(page)
    await openSuccessfulPage(page, "/om/statistik")
    await expect(page.getByRole("heading", { name: "Litteraturbanken innehåller just nu" })).toBeVisible()
    expect(await loggedRedRequests(request)).toEqual([])

    await page.getByRole("link", { name: staticPage.navName, exact: true }).click()
    await expect(page).toHaveURL(`/om/${staticPage.slug}`)
    await expect(page.getByRole("heading", { name: staticPage.heading, exact: true })).toBeVisible()
    await expect.poll(() => loggedRedRequests(request)).toEqual(staticPage.redRequests)
    expect((await loggedRedRequests(request)).filter(path => path === staticPage.contentPath)).toHaveLength(1)

    await page.goBack({ waitUntil: "networkidle" })
    await expect(page).toHaveURL("/om/statistik")
    await expect(page.getByRole("heading", { name: "Litteraturbanken innehåller just nu" })).toBeVisible()
    expect(await loggedRedRequests(request)).toEqual(staticPage.redRequests)
    expect(problems).toEqual([])
  })
}

test("the browser /red proxy reaches the configured content origin", async ({ page, request }) => {
  await openWithoutBrowserErrors(page, "/om/ide")
  await request.delete(`${fixture}/_requests`)
  const body = await page.evaluate(async () => {
    const response = await fetch("/red/om/ide/organisation.html")
    return { status: response.status, text: await response.text() }
  })
  expect(body.status).toBe(200)
  expect(body.text).toContain("Organisation")
  const log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual(["/red/om/ide/organisation.html"])
})

test("mounts About shell before managed content", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  await openSuccessfulPage(page, "/bibliotek")
  await expect(page.getByRole("heading", { name: "Botanisera i biblioteket", exact: true })).toBeVisible()
  await request.delete(`${fixture}/_requests`)

  let releaseResponse!: () => void
  const responseReleased = new Promise<void>(resolve => { releaseResponse = resolve })
  let markRequestStarted!: () => void
  const requestStarted = new Promise<void>(resolve => { markRequestStarted = resolve })
  await page.route("**/nuxt-api/about/ide", async route => {
    markRequestStarted()
    await responseReleased
    const response = await route.fetch()
    await route.fulfill({ response })
  })

  await startClientNavigation(page, "/om/ide")
  await requestStarted
  try {
    await expect(page).toHaveURL("/om/ide")
    await expect(page.getByRole("heading", { name: "Om Litteraturbanken", exact: true })).toBeVisible()
    const loadingStatus = page.locator('.searching[role="status"]')
    await expect(loadingStatus).toHaveCount(1)
    await expect(loadingStatus).toHaveText("Laddar sidan")
    await expect(page.getByRole("heading", { name: "Botanisera i biblioteket", exact: true })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Introduktion", exact: true })).toHaveCount(0)
  } finally {
    releaseResponse()
  }

  await expect(page.getByRole("heading", { name: "Introduktion", exact: true })).toBeVisible()
  await expect(page.locator('.searching[role="status"]')).toHaveCount(0)
  await expect.poll(() => loggedRedRequests(request)).toEqual([
    "/red/om/ide/omlitteraturbanken.html"
  ])
  expect(problems).toEqual([])
})

test("late About content cannot populate a fresh revisit", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window)
    let matchingRequests = 0
    window.fetch = (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      if (new URL(request.url).pathname !== "/nuxt-api/about/ide") {
        return nativeFetch(request)
      }
      matchingRequests += 1
      return nativeFetch(matchingRequests === 1
        ? new Request(request, { signal: new AbortController().signal })
        : request)
    }
  })
  await openSuccessfulPage(page, "/bibliotek")

  let releaseFirstResponse!: () => void
  const firstResponseReleased = new Promise<void>(resolve => { releaseFirstResponse = resolve })
  let markFirstRequestStarted!: () => void
  const firstRequestStarted = new Promise<void>(resolve => { markFirstRequestStarted = resolve })
  let markSecondRequestStarted!: () => void
  const secondRequestStarted = new Promise<void>(resolve => { markSecondRequestStarted = resolve })
  let markFirstHandlerCompleted!: () => void
  const firstHandlerCompleted = new Promise<void>(resolve => { markFirstHandlerCompleted = resolve })
  let requests = 0
  await page.route("**/nuxt-api/about/ide", async route => {
    requests += 1
    if (requests === 1) {
      markFirstRequestStarted()
      await firstResponseReleased
      const response = await route.fetch()
      const body = await response.text()
      await route.fulfill({
        response,
        body: body.replace("Introduktion", "Försenat gammalt About-innehåll")
      })
      markFirstHandlerCompleted()
      return
    }
    markSecondRequestStarted()
    const response = await route.fetch()
    await route.fulfill({ response })
  })

  await startClientNavigation(page, "/om/ide")
  await firstRequestStarted
  await startClientNavigation(page, "/bibliotek")
  await expect(page.getByRole("heading", { name: "Botanisera i biblioteket", exact: true })).toBeVisible()

  await startClientNavigation(page, "/om/ide")
  await secondRequestStarted
  const loadingStatus = page.locator('.searching[role="status"]')
  await expect(loadingStatus).toHaveCount(1)
  await expect(loadingStatus).toHaveText("Laddar sidan")
  await expect(page.getByRole("heading", { name: "Introduktion", exact: true })).toHaveCount(0)
  releaseFirstResponse()
  await firstHandlerCompleted
  await page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0)))

  await expect(page.getByRole("heading", { name: "Introduktion", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Försenat gammalt About-innehåll", exact: true })).toHaveCount(0)
  expect(requests).toBe(2)
  expect(problems).toEqual([])
})

test("client navigation clears the prior About body while the next body is pending", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await openSuccessfulPage(page, "/om/ide")
  await expect(page.getByRole("heading", { name: "Introduktion", exact: true })).toBeVisible()

  let markRequestStarted!: () => void
  const requestStarted = new Promise<void>(resolve => { markRequestStarted = resolve })
  let releaseResponse!: () => void
  const responseReleased = new Promise<void>(resolve => { releaseResponse = resolve })
  await page.route("**/nuxt-api/about/organisation", async route => {
    markRequestStarted()
    await responseReleased
    await route.fulfill({ response: await route.fetch() })
  })

  const navigation = page.getByRole("link", { name: "Organisation", exact: true }).click()
  await requestStarted
  try {
    await expect(page).toHaveURL("/om/organisation")
    await expect(page.getByRole("heading", { name: "Introduktion", exact: true })).toHaveCount(0)
    await expect(page.locator("#mainview section")).toHaveCount(0)
    await expect(page.locator('.searching[role="status"]')).toHaveText("Laddar sidan")
  } finally {
    releaseResponse()
    await navigation
  }

  await expect(page.getByRole("heading", { name: "Organisation", exact: true })).toBeVisible()
  expect(problems).toEqual([])
})

test("legacy statistics alias preserves browser query and fragment", async ({ page }) => {
  await page.goto("/statistik?source=legacy#ranking")
  await expect(page).toHaveURL("/om/statistik?source=legacy#ranking")
})

test("missing route clears a previously active About body and background state", async ({ page }) => {
  await openSuccessfulPage(page, "/om/ide")
  await expect(page.locator("body")).toHaveClass(/\bpage-about\b/)
  await expect(page.locator("html")).toHaveAttribute("style", /about_bkg\.jpg/)

  const response = await page.goto("/definitely-not-a-route")
  expect(response?.status()).toBe(404)
  await expect(page.locator("body")).toHaveClass(/\bfocus\b/)
  await expect(page.locator("body")).toHaveClass(/\bready\b/)
  await expect(page.locator("body")).not.toHaveClass(/\bpage-about\b/)
  expect(await page.locator("html").getAttribute("style")).not.toContain("about_bkg.jpg")
})

test("managed About links use Nuxt navigation and preserve Back history", async ({ page }) => {
  await openSuccessfulPage(page, "/om/ide")
  await page.evaluate(() => { (window as typeof window & { __spaSentinel?: string }).__spaSentinel = "about-spa" })

  await page.locator("#mainview section").getByRole("link", {
    name: "presentationer",
    exact: true
  }).click()
  await expect(page).toHaveURL("/presentationer")
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("about-spa")

  await page.goBack()
  await expect(page).toHaveURL("/om/ide")
  await expect(page.getByRole("heading", { name: "Introduktion", exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("about-spa")
})
