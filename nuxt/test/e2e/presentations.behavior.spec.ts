import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const indexContentPath = "/red/presentationer/presentationerForfattare.html"
const backgroundsPath = "/red/bilder/bakgrundsbilder/backgrounds.xml"

async function resetPresentation(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_presentation_requests`),
    request.delete(`${fixture}/_presentation_failures`),
    request.delete(`${fixture}/_presentation_production_shape`),
    request.delete(`${fixture}/_presentation_hostile_subresources`)
  ])
}

async function presentationRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_presentation_requests`)).json()).requests
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

async function routeFixtureAssetsAndBlockProduction(page: Page) {
  const requests: string[] = []
  await page.route("**/*", async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      requests.push(`${request.method()} ${request.url()}`)
      return route.abort("blockedbyclient")
    }
    if (["/app/style/litteraturbanken.css", "/app/style/date.css"].includes(url.pathname)) {
      const response = await route.fetch({ url: `${fixture}${url.pathname}${url.search}` })
      return route.fulfill({ response })
    }
    return route.continue()
  })
  return requests
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

async function expectAnchorAtViewportTop(page: Page, id: string) {
  await expect.poll(async () => page.locator(`#${id}`).evaluate(element =>
    Math.abs(element.getBoundingClientRect().top)
  )).toBeLessThanOrEqual(2)
}

async function expectScrollTop(page: Page) {
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
}

async function documentStyleText(page: Page) {
  return page.locator("style").allTextContents()
}

function descriptionMeta(page: Page) {
  return page.locator('head meta[name="description"]')
}

function contentRequests(requests: string[]) {
  return requests.filter(path =>
    path === indexContentPath ||
    (/^\/red\/presentationer\/(?:specialomraden|vandringar)\/.+\.html$/.test(path))
  )
}

test.beforeEach(async ({ request }) => resetPresentation(request))
test.afterEach(async ({ request }) => resetPresentation(request))

test("mounts Presentation before document and background settle", async ({ page }) => {
  const documentPath = "/red/presentationer/specialomraden/Censur.html"
  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { name: "Botanisera i biblioteket", exact: true }))
    .toBeVisible()

  let releaseDocument!: () => void
  const documentReleased = new Promise<void>(resolve => { releaseDocument = resolve })
  let markDocumentStarted!: () => void
  const documentStarted = new Promise<void>(resolve => { markDocumentStarted = resolve })
  let releaseBackground!: () => void
  const backgroundReleased = new Promise<void>(resolve => { releaseBackground = resolve })
  let markBackgroundStarted!: () => void
  const backgroundStarted = new Promise<void>(resolve => { markBackgroundStarted = resolve })
  await page.route(`**${documentPath}`, async route => {
    markDocumentStarted()
    await documentReleased
    await route.fulfill({ response: await route.fetch() })
  })
  await page.route(`**${backgroundsPath}`, async route => {
    markBackgroundStarted()
    await backgroundReleased
    await route.fulfill({ response: await route.fetch() })
  })

  try {
    await startClientNavigation(page, "/presentationer/specialomraden/Censur.html")
    await Promise.all([documentStarted, backgroundStarted])

    await expect(page).toHaveURL("/presentationer/specialomraden/Censur.html")
    await expect(page.locator("body")).toHaveClass(/\bpage-presentation\b/u)
    const loadingStatus = page.locator('.searching[role="status"]')
    await expect(loadingStatus).toHaveCount(1)
    await expect(loadingStatus).toHaveText("Laddar presentationen")
    await expect(page.getByRole("heading", {
      name: "Botanisera i biblioteket",
      exact: true
    })).toHaveCount(0)
    await expect(page.getByRole("heading", {
      name: "Censur och liknande ingrepp mot tryckta skrifter",
      exact: true
    })).toHaveCount(0)
    await expect(page.locator("html")).not.toHaveAttribute("style", /rostratt_b\.jpg/u)
    await expect(page.locator("body")).not.toHaveClass(/\bbkg-folder-fallback\b/u)

    releaseDocument()
    await expect(page.locator('.searching[role="status"]')).toHaveCount(1)
    await expect(page.getByRole("heading", {
      name: "Censur och liknande ingrepp mot tryckta skrifter",
      exact: true
    })).toHaveCount(0)
    await expect(page.locator("html")).not.toHaveAttribute("style", /rostratt_b\.jpg/u)

    releaseBackground()
    await expect(page.getByRole("heading", {
      name: "Censur och liknande ingrepp mot tryckta skrifter",
      exact: true
    })).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("style", /rostratt_b\.jpg/u)
    await expect(page.locator("body")).toHaveClass(/\bbkg-folder-fallback\b/u)
  } finally {
    releaseDocument()
    releaseBackground()
  }
})

test("late Presentation content cannot populate a fresh revisit", async ({ page }) => {
  const documentPath = "/red/presentationer/specialomraden/Censur.html"
  await page.goto("/bibliotek", { waitUntil: "networkidle" })

  let releaseFirstDocument!: () => void
  const firstDocumentReleased = new Promise<void>(resolve => { releaseFirstDocument = resolve })
  let releaseFirstBackground!: () => void
  const firstBackgroundReleased = new Promise<void>(resolve => { releaseFirstBackground = resolve })
  let releaseSecondDocument!: () => void
  const secondDocumentReleased = new Promise<void>(resolve => { releaseSecondDocument = resolve })
  let releaseSecondBackground!: () => void
  const secondBackgroundReleased = new Promise<void>(resolve => { releaseSecondBackground = resolve })
  let documentRequests = 0
  let backgroundRequests = 0
  await page.route(`**${documentPath}`, async route => {
    documentRequests += 1
    if (documentRequests === 1) {
      await firstDocumentReleased
      const response = await route.fetch()
      const body = await response.text()
      await route.fulfill({
        response,
        body: body.replaceAll(
          "Censur och liknande ingrepp mot tryckta skrifter",
          "Försenad gammal Presentation"
        )
      })
      return
    }
    await secondDocumentReleased
    await route.fulfill({ response: await route.fetch() })
  })
  await page.route(`**${backgroundsPath}`, async route => {
    backgroundRequests += 1
    if (backgroundRequests === 1) {
      await firstBackgroundReleased
      await route.fulfill({ response: await route.fetch() })
      return
    }
    await secondBackgroundReleased
    await route.fulfill({ response: await route.fetch() })
  })

  try {
    await startClientNavigation(page, "/presentationer/specialomraden/Censur.html")
    await expect.poll(() => ({ documentRequests, backgroundRequests }))
      .toEqual({ documentRequests: 1, backgroundRequests: 1 })
    await expect(page.locator('.searching[role="status"]')).toHaveText("Laddar presentationen")

    await startClientNavigation(page, "/bibliotek")
    await expect(page.getByRole("heading", { name: "Botanisera i biblioteket", exact: true }))
      .toBeVisible()

    await startClientNavigation(page, "/presentationer/specialomraden/Censur.html")
    await expect.poll(() => ({ documentRequests, backgroundRequests }))
      .toEqual({ documentRequests: 2, backgroundRequests: 2 })
    await expect(page.locator('.searching[role="status"]')).toHaveText("Laddar presentationen")
    await expect(page.getByText("Försenad gammal Presentation", { exact: true })).toHaveCount(0)

    releaseFirstDocument()
    releaseFirstBackground()
    await expect(page.locator('.searching[role="status"]')).toHaveText("Laddar presentationen")
    await expect(page.getByText("Försenad gammal Presentation", { exact: true })).toHaveCount(0)

    releaseSecondDocument()
    releaseSecondBackground()
    await expect(page.getByRole("heading", {
      name: "Censur och liknande ingrepp mot tryckta skrifter",
      exact: true
    })).toBeVisible()
    await expect(page.getByText("Försenad gammal Presentation", { exact: true })).toHaveCount(0)
  } finally {
    releaseFirstDocument()
    releaseFirstBackground()
    releaseSecondDocument()
    releaseSecondBackground()
  }
})

test("production-sized Presentation XHTML and text/xml background hydrate intact", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_presentation_production_shape`)

  await page.goto("/presentationer/specialomraden/ProductionSized.html", {
    waitUntil: "networkidle"
  })

  await expect(page.getByRole("heading", { name: "Production-sized Presentation" }))
    .toBeVisible()
  await expect(page.locator("#production-sized-document-marker"))
    .toHaveText("The complete article remains rendered.")
  await expect(page.locator("body")).toHaveClass(/\bbkg-production-sized\b/u)
  await expect(page.locator("body")).toHaveClass(/\bbkg-measured\b/u)
  expect(await documentStyleText(page)).toContain("html { background-color: #123456; }")
  await expect(page.locator("html")).toHaveAttribute("style", /rostratt_a\.jpg/u)
  expect(await presentationRequests(request)).toEqual([
    "/red/presentationer/specialomraden/ProductionSized.html",
    backgroundsPath,
    "/red/bilder/bakgrundsbilder/rostratt_a.jpg"
  ])
})

test("managed Presentation body and CSS emit no unowned browser subresource requests", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_presentation_hostile_subresources`)
  const externalRequests: string[] = []
  await page.route("**/*", async route => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.hostname === "evil.test") {
      externalRequests.push(requestUrl.href)
      return route.abort("blockedbyclient")
    }
    return route.continue()
  })

  await page.goto("/presentationer/specialomraden/ProductionSized.html", {
    waitUntil: "networkidle"
  })

  await expect(page.locator("#owned-subresource")).toHaveAttribute(
    "src",
    "/red/presentationer/specialomraden/Burmanbilder/1.jpg"
  )
  await expect(page.locator("#external-attribution")).toHaveAttribute(
    "src",
    "/red/presentationer/specialomraden/Burmanbilder/1.jpg"
  )
  await expect(page.locator("#external-attribution")).not.toHaveAttribute("attributionsrc")
  await expect(page.locator("#css-safe-marker")).toHaveCSS("text-align", "center")
  for (const locator of ["#external-src", "#external-srcset", "#legacy-background", "#inline-style"]) {
    await expect(page.locator(locator)).not.toHaveAttribute("src")
    await expect(page.locator(locator)).not.toHaveAttribute("srcset")
    await expect(page.locator(locator)).not.toHaveAttribute("background")
    await expect(page.locator(locator)).not.toHaveAttribute("style")
    await expect(page.locator(locator)).not.toHaveAttribute("attributionsrc")
  }
  expect(await documentStyleText(page)).toContain(
    "p.image { text-align: center; }"
  )
  expect((await documentStyleText(page)).join("\n")).not.toContain("evil.test")
  expect(externalRequests).toEqual([])
  expect(await presentationRequests(request)).toContain(
    "/red/presentationer/specialomraden/Burmanbilder/1.jpg"
  )
})

test("direct Presentation ankare scrolls after hydration with one index request and no XML", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  const productionRequests = await routeFixtureAssetsAndBlockProduction(page)
  const response = await page.goto("/presentationer?ankare=kulturarvet", {
    waitUntil: "networkidle"
  })
  expect(response?.status()).toBe(200)

  await expect(page.locator("body")).toHaveClass("focus page-presentation ready")
  await expect(page.getByRole("heading", { name: "Presentationer och introduktioner" })).toBeVisible()
  await expectAnchorAtViewportTop(page, "kulturarvet")

  const requests = await presentationRequests(request)
  expect(contentRequests(requests)).toEqual([indexContentPath])
  expect(requests.filter(path => path === backgroundsPath)).toEqual([])
  expect(productionRequests).toEqual([])
  expect(problems).toEqual([])
})

test("Presentation query changes and history synchronize valid, missing, and absent ankare without refetch", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  const productionRequests = await routeFixtureAssetsAndBlockProduction(page)
  await page.goto("/presentationer", { waitUntil: "networkidle" })
  const initialRequests = await presentationRequests(request)
  expect(initialRequests).toEqual([indexContentPath])

  await navigateClient(page, "/presentationer?ankare=kulturarvet")
  await expect(page).toHaveURL("/presentationer?ankare=kulturarvet")
  await expectAnchorAtViewportTop(page, "kulturarvet")

  const anchoredScroll = await page.evaluate(() => window.scrollY)
  await navigateClient(page, "/presentationer?ankare=missing-anchor")
  await expect(page).toHaveURL("/presentationer?ankare=missing-anchor")
  await expect(page.locator("#missing-anchor")).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(anchoredScroll)

  await navigateClient(page, "/presentationer")
  await expect(page).toHaveURL("/presentationer")
  await expectScrollTop(page)

  await page.goBack()
  await expect(page).toHaveURL("/presentationer?ankare=missing-anchor")
  await page.goBack()
  await expect(page).toHaveURL("/presentationer?ankare=kulturarvet")
  await expectAnchorAtViewportTop(page, "kulturarvet")
  await page.goForward()
  await expect(page).toHaveURL("/presentationer?ankare=missing-anchor")
  await page.goForward()
  await expect(page).toHaveURL("/presentationer")
  await expectScrollTop(page)

  expect(await presentationRequests(request)).toEqual(initialRequests)
  expect(productionRequests).toEqual([])
  expect(problems).toEqual([])
})

test("hydrated Presentation document keeps root-normalized assets and ordinary deferred hrefs", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  const productionRequests = await routeFixtureAssetsAndBlockProduction(page)
  const documentPath =
    "/red/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html"
  const response = await page.goto(
    "/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html",
    { waitUntil: "networkidle" }
  )
  expect(response?.status()).toBe(200)

  await expect(page.getByRole("heading", {
    name: "Figurdikten som barock blandkonst",
    exact: true
  })).toBeVisible()
  for (const href of ["/app/style/litteraturbanken.css", "/app/style/date.css"]) {
    await expect(page.locator(`link[rel="stylesheet"][href="${href}"]`)).toHaveCount(1)
  }
  await expect(page.locator('img[src="/red/presentationer/specialomraden/Burmanbilder/1.jpg"]'))
    .toHaveCount(1)
  await expect(page.locator('img[src="/red/presentationer/specialomraden/Burmanbilder/10.jpg"]'))
    .toHaveCount(1)

  const download = page.locator("a[download]")
  await expect(download).toHaveAttribute(
    "href",
    "/red/presentationer/specialomraden/Figurdiktensombarockblandkonst.pdf"
  )
  await expect(download).toHaveAttribute("download", "")
  await expect(download).toHaveAttribute("target", "_self")
  await expect(page.getByRole("link", { name: "Stiernhielm", exact: true }).first())
    .toHaveAttribute("href", "/forfattare/StiernhielmG")

  const requests = await presentationRequests(request)
  expect(contentRequests(requests)).toEqual([documentPath])
  expect(requests.filter(path => path === backgroundsPath)).toEqual([backgroundsPath])
  expect(requests).not.toContain(
    "/red/presentationer/specialomraden/Figurdiktensombarockblandkonst.pdf"
  )
  expect(requests).not.toContain("/forfattare/StiernhielmG")
  expect(productionRequests).toEqual([])
  expect(problems).toEqual([])
})

test("Presentation route transitions replace all document head and body state before index and 404", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  const productionRequests = await routeFixtureAssetsAndBlockProduction(page)
  const rostrattPath = "/red/presentationer/specialomraden/Rostratt.html"
  const figurdiktPath =
    "/red/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html"
  await page.goto("/presentationer/specialomraden/Rostratt.html", {
    waitUntil: "networkidle"
  })

  const rostrattStylesheet = page.locator(
    'link[rel="stylesheet"][href="/red/presentationer/specialomraden/Rostratt.css"]'
  )
  await expect(rostrattStylesheet).toHaveCount(1)
  await expect(page).toHaveTitle("Rösträtt 1919 | Litteraturbanken")
  await expect(descriptionMeta(page)).toHaveAttribute("content", "Rösträtt 1919")
  expect(await documentStyleText(page)).toContain(
    "html { background-color: #382a32; }"
  )
  await expect(page.locator("html")).toHaveAttribute("style", /rostratt_a\.jpg/)
  await expect(page.locator("body")).toHaveClass(/\bbkg-add-border\b/)
  await expect(page.locator("body")).toHaveClass(/\bbkg-paper\b/)
  await expect(page.locator("body")).not.toHaveClass(/\bpresentation-style-rostratt\b/)

  await navigateClient(
    page,
    "/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html"
  )
  await expect(page.getByRole("heading", {
    name: "Figurdikten som barock blandkonst",
    exact: true
  })).toBeVisible()
  await expect(page).toHaveTitle("Figurdikten som barock blandkonst | Litteraturbanken")
  await expect(descriptionMeta(page)).toHaveAttribute(
    "content",
    "Figurdikten som barock blandkonst"
  )
  await expect(rostrattStylesheet).toHaveCount(0)
  expect(await documentStyleText(page)).not.toContain("html { background-color: #382a32; }")
  expect(await documentStyleText(page)).toContain(
    "\np.image {text-align:center}\n"
  )
  await expect(page.locator('link[href="/app/style/litteraturbanken.css"]')).toHaveCount(1)
  await expect(page.locator('link[href="/app/style/date.css"]')).toHaveCount(1)
  await expect(page.locator("html")).toHaveAttribute("style", /rostratt_b\.jpg/)
  await expect(page.locator("html")).not.toHaveAttribute("style", /rostratt_a\.jpg/)
  await expect(page.locator("body")).toHaveClass(/\bsubpage\b/)
  await expect(page.locator("body")).toHaveClass(/\bbkg-folder-fallback\b/)
  await expect(page.locator("body")).not.toHaveClass(/\bbkg-add-border\b/)
  await expect(page.locator("body")).not.toHaveClass(/\bbkg-paper\b/)
  await expect(page.locator("body")).not.toHaveClass(/\bpresentation-style-rostratt\b/)

  await navigateClient(page, "/presentationer")
  await expect(page.getByRole("heading", { name: "Presentationer och introduktioner" })).toBeVisible()
  await expect(page).toHaveTitle("Presentationer | Litteraturbanken")
  await expect(descriptionMeta(page)).toHaveAttribute(
    "content",
    "Litteraturbankens presentationer."
  )
  await expect(page.locator("#mainview > .doc.main")).toHaveCount(1)
  await expect(page.locator("#mainview > .content")).toHaveCount(0)
  await expect(page.locator('link[href="/app/style/litteraturbanken.css"]')).toHaveCount(0)
  await expect(page.locator('link[href="/app/style/date.css"]')).toHaveCount(0)
  expect(await documentStyleText(page)).not.toContain("\np.image {text-align:center}\n")
  expect(await documentStyleText(page)).not.toContain("html { background-color: #382a32; }")
  await expect(page.locator("html")).toHaveAttribute("style", /presentations[^"]*\.jpg/)
  await expect(page.locator("html")).not.toHaveAttribute("style", /rostratt_[ab]\.jpg/)
  await expect(page.locator("body")).toHaveClass("focus page-presentation ready")
  await expect(page.locator("body")).not.toHaveClass(/\bpresentation-style-rostratt\b/)

  await navigateClient(page, "/definitely-not-a-route")
  await expect(page).toHaveTitle("Sidan kan inte hittas | Litteraturbanken")
  await expect(descriptionMeta(page)).toHaveCount(0)
  await expect(page.locator("body")).toHaveClass("focus ready")
  await expect(page.locator("body")).not.toHaveClass(/\bpage-presentation\b/)
  await expect(page.locator("body")).not.toHaveClass(/\bsubpage\b/)
  await expect(page.locator("body")).not.toHaveClass(/\bbkg-/)
  await expect(page.locator("body")).not.toHaveClass(/\bpresentation-style-rostratt\b/)
  await expect(page.locator("html")).not.toHaveAttribute("style", /presentations|rostratt/)
  await expect(rostrattStylesheet).toHaveCount(0)
  expect(await documentStyleText(page)).not.toContain("\np.image {text-align:center}\n")
  expect(await documentStyleText(page)).not.toContain("html { background-color: #382a32; }")

  const requests = await presentationRequests(request)
  expect(contentRequests(requests)).toEqual([rostrattPath, figurdiktPath, indexContentPath])
  expect(requests.filter(path => path === backgroundsPath)).toEqual([
    backgroundsPath,
    backgroundsPath
  ])
  expect(productionRequests).toEqual([])
  expect(problems).toEqual([])
})

test("managed Presentation links use Nuxt navigation and preserve Back history", async ({ page }) => {
  await page.goto("/presentationer", { waitUntil: "networkidle" })
  await page.evaluate(() => { (window as typeof window & { __spaSentinel?: string }).__spaSentinel = "presentation-spa" })

  await page.locator(".doc.main").getByRole("link", {
    name: "Figurdikten som barock blandkonst",
    exact: true
  }).click()
  await expect(page).toHaveURL(
    "/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html"
  )
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("presentation-spa")

  await page.goBack()
  await expect(page).toHaveURL("/presentationer")
  await expect(page.getByRole("heading", { name: "Presentationer och introduktioner" })).toBeVisible()
  expect(await page.evaluate(() => (window as typeof window & { __spaSentinel?: string }).__spaSentinel))
    .toBe("presentation-spa")
})
