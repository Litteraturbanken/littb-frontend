import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin

async function resetHome(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_home_requests`),
    request.delete(`${fixture}/_home_failure`),
    request.delete(`${fixture}/_home_hostile_background`),
    request.delete(`${fixture}/_home_redirect`)
  ])
}

async function homeRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_home_requests`)).json()).requests
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

async function navigateClient(page: Page, path: string) {
  await page.evaluate(async value => {
    type Router = { push: (path: string) => Promise<unknown> }
    type VueRoot = HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router?: Router } } }
    }
    const router = (document.querySelector("#__nuxt") as VueRoot | null)
      ?.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt router is unavailable")
    await router.push(value)
  }, path)
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

const homeOnlyLinks = [
  ["Lärare", "/skolan/lararsida/"],
  ["Bibliotekarier", "/bibliotekariesidor/"],
  ["English", "/om/english.html"],
  ["Deutsch", "/om/deutsch.html"],
  ["Français", "/om/francais.html"],
  ["Logotyp för Svenska Akademien", "https://www.svenskaakademien.se"]
] as const

async function assertHomeOnlyLinks(page: Page, visible: boolean) {
  for (const [name, href] of homeOnlyLinks) {
    const link = page.getByRole("link", { name, exact: true, includeHidden: true })
    await expect(link).toHaveAttribute("href", href)
    if (visible) await expect(link).toBeVisible()
    else await expect(link).toBeHidden()
  }
}

test.beforeEach(async ({ request }) => resetHome(request))

test("mounts Home shell before managed content", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { name: "Introduktion", exact: true })).toBeVisible()

  let releaseResponse!: () => void
  const responseReleased = new Promise<void>(resolve => { releaseResponse = resolve })
  let markRequestStarted!: () => void
  const requestStarted = new Promise<void>(resolve => { markRequestStarted = resolve })
  await page.route("**/red/om/start/startsida-ny.html?*", async route => {
    markRequestStarted()
    await responseReleased
    await route.fulfill({ response: await route.fetch() })
  })

  const navigation = page.getByRole("link", { name: "Litteraturbanken", exact: true }).click()
  await requestStarted
  try {
    await expect(page).toHaveURL("/")
    await expect(page.getByRole("heading", { name: "Litteraturbanken", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Nytt & anmärkningsvärt", exact: true })).toBeVisible()
    const loadingStatus = page.locator('.searching[role="status"]')
    await expect(loadingStatus).toHaveCount(1)
    await expect(loadingStatus).toHaveText("Laddar startsidan")
    await expect(page.getByRole("heading", { name: "Om Litteraturbanken", exact: true })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Introduktion", exact: true })).toHaveCount(0)
    await expect(page.getByText("Månadens tema", { exact: true })).toHaveCount(0)
  } finally {
    releaseResponse()
    await navigation
  }

  await expect(page.getByText("Månadens tema", { exact: true })).toBeVisible()
  await expect(page.locator('.searching[role="status"]')).toHaveCount(0)
  expect(problems).toEqual([])
})

test("late Home content cannot populate a fresh revisit", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window)
    let matchingRequests = 0
    window.fetch = (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      if (new URL(request.url).pathname !== "/red/om/start/startsida-ny.html") {
        return nativeFetch(request)
      }
      matchingRequests += 1
      return nativeFetch(matchingRequests === 1
        ? new Request(request, { signal: new AbortController().signal })
        : request)
    }
  })
  await page.goto("/om/ide", { waitUntil: "networkidle" })

  let releaseFirstResponse!: () => void
  const firstResponseReleased = new Promise<void>(resolve => { releaseFirstResponse = resolve })
  let markFirstRequestStarted!: () => void
  const firstRequestStarted = new Promise<void>(resolve => { markFirstRequestStarted = resolve })
  let markSecondRequestStarted!: () => void
  const secondRequestStarted = new Promise<void>(resolve => { markSecondRequestStarted = resolve })
  let releaseSecondResponse!: () => void
  const secondResponseReleased = new Promise<void>(resolve => { releaseSecondResponse = resolve })
  let markFirstHandlerCompleted!: () => void
  const firstHandlerCompleted = new Promise<void>(resolve => { markFirstHandlerCompleted = resolve })
  let requests = 0
  await page.route("**/red/om/start/startsida-ny.html?*", async route => {
    requests += 1
    if (requests === 1) {
      markFirstRequestStarted()
      await firstResponseReleased
      const response = await route.fetch()
      const body = await response.text()
      await route.fulfill({
        response,
        body: body.replace("Månadens tema", "Försenat gammalt Home-innehåll")
      })
      markFirstHandlerCompleted()
      return
    }
    markSecondRequestStarted()
    await secondResponseReleased
    await route.fulfill({ response: await route.fetch() })
  })

  const firstNavigation = page.getByRole("link", { name: "Litteraturbanken", exact: true }).click()
  await firstRequestStarted
  await startClientNavigation(page, "/bibliotek")
  await expect(page.getByRole("heading", { name: "Botanisera i biblioteket", exact: true })).toBeVisible()

  await startClientNavigation(page, "/")
  await secondRequestStarted
  try {
    await expect(page.locator('.searching[role="status"]')).toHaveText("Laddar startsidan")
    await expect(page.getByText("Månadens tema", { exact: true })).toHaveCount(0)
    releaseFirstResponse()
    await firstHandlerCompleted
    await page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0)))

    await expect(page.getByText("Månadens tema", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Försenat gammalt Home-innehåll", { exact: true })).toHaveCount(0)
    releaseSecondResponse()
    await expect(page.getByText("Månadens tema", { exact: true })).toBeVisible()
  } finally {
    releaseFirstResponse()
    releaseSecondResponse()
    await firstNavigation.catch(() => undefined)
  }
  expect(requests).toBe(2)
  expect(problems).toEqual([])
})

test("hydrates the SSR Home payload without refetching its editorial fragment", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  const response = await page.goto("/", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)

  await expect(page).toHaveTitle("Litteraturbanken | Svenska klassiker som e-bok och epub")
  await expect(page.locator("body")).toHaveClass("focus page-start ready")
  await expect(page.getByText("Lärdomsstaden Uppsala", { exact: true })).toBeVisible()
  const requests = await homeRequests(request)
  expect(requests.filter(path => path.startsWith("/red/om/start/startsida-ny.html?"))).toHaveLength(1)
  expect(requests.filter(path => path.startsWith("/red/css/startsida.css?"))).toHaveLength(1)
  expect(requests.filter(path => path.endsWith("/start_bkg_172_2026.jpg"))).toHaveLength(1)
  expect(problems).toEqual([])
})

test("a managed Home background cannot inject inline CSS or an external request", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_home_hostile_background`)
  const externalRequests: string[] = []
  await page.route("**/*", async route => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.hostname === "evil.test") {
      externalRequests.push(requestUrl.href)
      return route.abort("blockedbyclient")
    }
    return route.continue()
  })

  const response = await page.goto("/", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expect(page.locator("#hostile-home-marker")).toHaveText("Homeinnehållet är kvar")
  await expect(page.locator("html")).not.toHaveAttribute("style", /evil\.test|background:url/u)
  expect(externalRequests).toEqual([])
})

test("announces client route titles once without affecting page layout", async ({ page }) => {
  const problems = captureBrowserProblems(page)
  await page.goto("/", { waitUntil: "networkidle" })

  const announcer = page.locator(".nuxt-route-announcer")
  const liveRegion = announcer.locator('[role="status"][aria-live="polite"]')
  await expect(announcer).toHaveCount(1)
  await expect(liveRegion).toHaveCount(1)
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveCount(1)
  await expect(liveRegion).toHaveAttribute("aria-atomic", "false")
  await expect(liveRegion).toHaveText("Litteraturbanken | Svenska klassiker som e-bok och epub")
  expect(await announcer.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return {
      height: bounds.height,
      position: getComputedStyle(element).position,
      width: bounds.width
    }
  })).toEqual({ height: 0, position: "absolute", width: 0 })
  expect(await liveRegion.evaluate(element => {
    const style = getComputedStyle(element)
    return {
      clipPath: style.clipPath,
      height: style.height,
      overflow: style.overflow,
      position: style.position,
      width: style.width
    }
  })).toEqual({
    clipPath: "inset(50%)",
    height: "1px",
    overflow: "hidden",
    position: "absolute",
    width: "1px"
  })

  await page.locator('.home-editorial a[href="/om/ide"]').click()
  await expect(page).toHaveURL("/om/ide")
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")
  await expect(liveRegion).toHaveText("Om LB | Litteraturbanken")
  await expect(page.locator(".nuxt-route-announcer")).toHaveCount(1)
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveCount(1)

  await page.goBack({ waitUntil: "networkidle" })
  await expect(page).toHaveURL("/")
  await expect(page).toHaveTitle("Litteraturbanken | Svenska klassiker som e-bok och epub")
  await expect(liveRegion).toHaveText("Litteraturbanken | Svenska klassiker som e-bok och epub")
  await expect(page.locator(".nuxt-route-announcer")).toHaveCount(1)
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveCount(1)
  expect(problems).toEqual([])
})

test("a public /red failure during client navigation leaves the normal empty Home shell", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  const missing = await page.goto("/definitely-not-a-route", { waitUntil: "networkidle" })
  expect(missing?.status()).toBe(404)
  await request.put(`${fixture}/_home_failure`)

  await navigateClient(page, "/")
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { name: "Litteraturbanken", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Nytt & anmärkningsvärt", exact: true })).toBeVisible()
  await expect(page.getByText("Månadens tema", { exact: true })).toHaveCount(0)
  await expect(page.locator('link[rel="stylesheet"][href^="/red/css/startsida.css?"]')).toHaveCount(0)
  await expect(page.locator("html")).not.toHaveAttribute("style", /start_bkg_172_2026/)
  expect((await homeRequests(request)).filter(path => path.startsWith(
    "/red/om/start/startsida-ny.html?"
  ))).toHaveLength(1)
  expect(problems.filter(problem => /hydration|pageerror/.test(problem))).toEqual([])
})

test("client-managed Home content refuses a redirect instead of following it", async ({
  page,
  request
}) => {
  await page.goto("/definitely-not-a-route", { waitUntil: "networkidle" })
  await request.put(`${fixture}/_home_redirect`)

  await navigateClient(page, "/")
  await expect(page).toHaveURL("/")
  await expect(page.locator("#client-redirect-target")).toHaveCount(0)
  expect(await homeRequests(request)).toEqual([
    expect.stringMatching(/^\/red\/om\/start\/startsida-ny\.html\?/),
    expect.stringMatching(/^\/red\/css\/startsida\.css\?/)
  ])
})

test("Home to 404 to Home cleans and restores stylesheet, background, and body state", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  await page.goto("/", { waitUntil: "networkidle" })
  const stylesheet = page.locator('link[rel="stylesheet"][href^="/red/css/startsida.css?"]')
  await expect(stylesheet).toHaveCount(1)
  const stylesheetHref = await stylesheet.getAttribute("href")
  await expect(page.locator("body")).toHaveClass(/\bfocus\b/)
  await expect(page.locator("body")).toHaveClass(/\bpage-start\b/)
  await expect(page.locator("body")).toHaveClass(/\bready\b/)
  await assertHomeOnlyLinks(page, true)
  expect(await page.locator("html").evaluate(element => getComputedStyle(element).backgroundRepeat))
    .toBe("no-repeat")

  await navigateClient(page, "/definitely-not-a-route")
  await expect(page).toHaveTitle("Sidan kan inte hittas | Litteraturbanken")
  await expect(page.locator("body")).not.toHaveClass(/\bpage-start\b/)
  await expect(stylesheet).toHaveCount(0)
  await expect(page.locator("html")).not.toHaveAttribute("style", /start_bkg_172_2026/)
  await assertHomeOnlyLinks(page, false)

  await navigateClient(page, "/")
  await expect(page).toHaveTitle("Litteraturbanken | Svenska klassiker som e-bok och epub")
  await expect(page.locator("body")).toHaveClass(/\bfocus\b/)
  await expect(page.locator("body")).toHaveClass(/\bpage-start\b/)
  await expect(page.locator("body")).toHaveClass(/\bready\b/)
  await expect(stylesheet).toHaveCount(1)
  await expect(stylesheet).toHaveAttribute("href", stylesheetHref ?? "")
  await expect(page.locator("html")).toHaveAttribute("style", /start_bkg_172_2026\.jpg/)
  await assertHomeOnlyLinks(page, true)
  expect(await page.locator("html").evaluate(element => getComputedStyle(element).backgroundRepeat))
    .toBe("no-repeat")
  const fragmentRequests = (await homeRequests(request)).filter(path => path.startsWith(
    "/red/om/start/startsida-ny.html?"
  ))
  expect(fragmentRequests).toHaveLength(2)
  expect(new Set(fragmentRequests)).toEqual(new Set([fragmentRequests[0]]))
  expect(problems).toEqual([])
})

test("managed Home and language links use SPA history without reloading the document", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" })
  await page.evaluate(() => { (window as typeof window & { __spaSentinel?: string }).__spaSentinel = "home-spa" })

  await page.locator('.home-editorial a[href="/om/ide"]').click()
  await expect(page).toHaveURL("/om/ide")
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("home-spa")

  await page.goBack()
  await expect(page).toHaveURL("/")
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("home-spa")

  await page.getByRole("link", { name: "English", exact: true }).click()
  await expect(page).toHaveURL("/om/english.html")
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("home-spa")
  await page.goBack()
  await expect(page).toHaveURL("/")
})
