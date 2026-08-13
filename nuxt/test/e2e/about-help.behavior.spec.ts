import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { runSequentialCleanup } from "../helpers/sequential-cleanup"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || "4100"}`
const contentPath = "/red/om/hjalp/hjalp.html"
const managedContentPath = "/api/about/hjalp"
const submenu = [
  ["SökaEfterVerk", "Söka efter verk"],
  ["SökaIVerk", "Söka i verk"],
  ["AvanceradSökning", "Avancerad sökning"],
  ["Träffvisningen", "Träffvisningen"],
  ["Etext", "Etext"],
  ["Faksimil", "Faksimil"],
  ["Pdf", "Pdf"],
  ["Epub", "Epub"],
  ["Ljudarkivet", "Ljud & bild"],
  ["Ordböcker", "Ordböcker"],
  ["Presentationer", "Presentationer"],
  ["KopieraText", "Kopiera text"],
  ["Länka", "Länka"],
  ["Uppdateringar", "Uppdateringar"],
  ["Webbläsare", "Webbläsare"],
  ["Textstorlek", "Textstorlek"],
  ["Kontakt", "Kontakt"]
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

async function loggedContentRequests(request: APIRequestContext) {
  const log = await (await request.get(`${fixture}/_requests`)).json()
  return (log.requests as string[]).filter(path => path === contentPath)
}

async function expectAnchorOffset(page: Page, id: string) {
  await expect.poll(async () => {
    return page.locator(`#${id}`).evaluate(element => Math.abs(element.getBoundingClientRect().top - 40))
  }).toBeLessThanOrEqual(1)
}

async function navigateClient(page: Page, path: string) {
  await page.evaluate(async target => {
    type Router = { push: (path: string) => Promise<unknown> }
    type VueRoot = HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router?: Router } } }
    }
    const router = (document.querySelector("#__nuxt") as VueRoot | null)
      ?.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt router is unavailable")
    await router.push(target)
  }, path)
}

test.beforeAll(async ({ baseURL, browser, request }) => {
  await reset(request)
  const context = await browser.newContext()
  const page = await context.newPage()
  const browserContentRequests: string[] = []
  page.on("request", browserRequest => {
    if (new URL(browserRequest.url()).pathname === contentPath) {
      browserContentRequests.push(browserRequest.url())
    }
  })
  try {
    const response = await page.goto(new URL("/om/hjalp", baseURL).href, {
      waitUntil: "networkidle"
    })
    expect(response?.status()).toBe(200)
    expect(browserContentRequests).toEqual([])
  } finally {
    await runSequentialCleanup(
      () => context.close(),
      () => reset(request),
      "Help cold-hydration cleanup failed"
    )
  }
})
test.beforeEach(async ({ request }) => reset(request))

test("Help renders the exact active state and authority submenu in the toolkit without browser errors", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  const browserContentRequests: string[] = []
  page.on("request", browserRequest => {
    if (new URL(browserRequest.url()).pathname === contentPath) {
      browserContentRequests.push(browserRequest.url())
    }
  })
  const response = await page.goto("/om/hjalp", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)

  await expect(page.locator(".help_content.content.unbox.page-help")).toBeVisible()
  const activeLinks = page.locator("ul.links a.active")
  await expect(activeLinks).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Hjälp", exact: true })).toHaveClass(/\bactive\b/)

  const toolkitMenu = page.locator("#toolkit > [toolkit] > ul.help_submenu.sticky")
  await expect(toolkitMenu).toHaveCount(1)
  await expect(page.locator(".help_content .help_submenu")).toHaveCount(0)
  await expect(toolkitMenu.locator("li > a")).toHaveText(submenu.map(([, label]) => label))
  for (const [id, label] of submenu) {
    await expect(toolkitMenu.getByRole("link", { name: label, exact: true })).toHaveAttribute(
      "href",
      `/om/hjalp?ankare=${encodeURIComponent(id)}`
    )
  }

  expect(browserContentRequests).toEqual([])
  expect(await loggedContentRequests(request)).toEqual([contentPath])
  expect(problems).toEqual([])
})

test("Help browser alias preserves query and fragment through the permanent redirect", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  const response = await page.goto("/hjalp?ankare=Epub#legacy", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL("/om/hjalp?ankare=Epub#legacy")
  await expect(page.getByRole("heading", { name: "Hjälp", exact: true })).toBeVisible()
  await expectAnchorOffset(page, "Epub")
  expect(await loggedContentRequests(request)).toEqual([contentPath])
  expect(problems).toEqual([])
})

test("Help uses browser-decoded named entities and underscore.string _id stripping", async ({ page }) => {
  await page.addInitScript(() => {
    const BrowserDOMParser = window.DOMParser
    class FixtureDOMParser {
      parseFromString(markup: string, type: DOMParserSupportedType) {
        const document = new BrowserDOMParser().parseFromString(markup, type)
        if (markup.includes('id="SökaEfterVerk"')) {
          const fixture = new BrowserDOMParser().parseFromString(
            '<a id="EntityLabel" name="Cr&egrave;me&nbsp;Br&ucirc;l&eacute;e_id"></a>',
            "text/html"
          )
          document.body.append(fixture.body.firstElementChild!)
        }
        return document
      }
    }
    Object.defineProperty(window, "DOMParser", {
      configurable: true,
      value: FixtureDOMParser,
      writable: true
    })
  })

  await page.goto("/om/hjalp", { waitUntil: "networkidle" })
  const injected = page.locator("#toolkit").getByRole("link", { name: "Crème brûlée", exact: true })
  await expect(injected).toHaveAttribute("href", "/om/hjalp?ankare=EntityLabel")
})

test("Help submenu click updates ankare and scrolls to the legacy 40px offset without refetch", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  await page.goto("/om/hjalp", { waitUntil: "networkidle" })
  await page.locator("#toolkit").getByRole("link", { name: "Epub", exact: true }).click()
  await expect(page).toHaveURL("/om/hjalp?ankare=Epub")
  await expectAnchorOffset(page, "Epub")
  expect(await loggedContentRequests(request)).toEqual([contentPath])

  const retainedScroll = await page.evaluate(() => window.scrollY)
  expect(retainedScroll).toBeGreaterThan(0)
  await navigateClient(page, "/om/hjalp?ankare=missing")
  await expect(page).toHaveURL("/om/hjalp?ankare=missing")
  expect(await page.evaluate(() => window.scrollY)).toBe(retainedScroll)

  await page.unroute(`**${managedContentPath}`)
  let refreshRequests = 0
  await page.route(`**${managedContentPath}`, async route => {
    refreshRequests += 1
    const response = await route.fetch()
    const body = await response.text()
    await route.fulfill({
      response,
      body: `${body}<span id="refresh-marker"></span>`
    })
  })
  await page.evaluate(async key => {
    type AsyncDataEntry = { execute: (options: { cause: string }) => Promise<unknown> }
    type NuxtApp = { _asyncData: Record<string, AsyncDataEntry | undefined> }
    type VueRoot = HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $nuxt?: NuxtApp } } }
    }
    const nuxt = (document.querySelector("#__nuxt") as VueRoot | null)
      ?.__vue_app__?.config.globalProperties.$nuxt
    const entry = nuxt?._asyncData[key]
    if (!entry) throw new Error(`Nuxt async-data entry is unavailable: ${key}`)
    await entry.execute({ cause: "refresh:manual" })
  }, "about-content:hjalp")
  expect(refreshRequests).toBe(1)
  await expect(page.locator("#refresh-marker")).toHaveCount(1)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => {
    requestAnimationFrame(() => resolve())
  })))
  expect(await page.evaluate(() => window.scrollY)).toBe(retainedScroll)
  expect(problems).toEqual([])
})

test("client navigation retries help anchor scrolling after delayed content renders", async ({
  page,
  request
}) => {
  const problems = captureBrowserProblems(page)
  await page.goto("/om/ide", { waitUntil: "networkidle" })

  let releaseContent!: () => void
  const contentReleased = new Promise<void>(resolve => { releaseContent = resolve })
  let markContentStarted!: () => void
  const contentStarted = new Promise<void>(resolve => { markContentStarted = resolve })
  let markHandlerSettled!: () => void
  const handlerSettled = new Promise<void>(resolve => { markHandlerSettled = resolve })
  await page.route(`**${managedContentPath}`, async route => {
    markContentStarted()
    try {
      await contentReleased
      const response = await route.fetch()
      await route.fulfill({ response })
    } finally {
      markHandlerSettled()
    }
  })

  const navigation = navigateClient(page, "/om/hjalp?ankare=Epub")
  await contentStarted
  releaseContent()
  await navigation
  await handlerSettled

  await expect(page).toHaveURL("/om/hjalp?ankare=Epub")
  await expectAnchorOffset(page, "Epub")
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => {
    requestAnimationFrame(() => resolve())
  })))
  await page.locator(".help_content").evaluate(element => {
    const lateLayout = document.createElement("div")
    lateLayout.dataset.testLateHelpLayout = ""
    lateLayout.style.height = "200px"
    element.prepend(lateLayout)
  })
  await expectAnchorOffset(page, "Epub")

  await navigateClient(page, "/om/ide")
  await expect(page).toHaveURL("/om/ide")
  await navigateClient(page, "/om/hjalp?ankare=Etext")
  await expect(page).toHaveURL("/om/hjalp?ankare=Etext")
  await expectAnchorOffset(page, "Etext")
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => {
    requestAnimationFrame(() => resolve())
  })))
  await page.locator(".help_content").evaluate(element => {
    const laterLayout = document.createElement("div")
    laterLayout.dataset.testLaterHelpLayout = ""
    laterLayout.style.height = "100px"
    element.prepend(laterLayout)
  })
  await expectAnchorOffset(page, "Etext")
  expect(await loggedContentRequests(request)).toEqual(Array(2).fill(contentPath))
  expect(problems).toEqual([])
})

test("client Help navigation corrects one late content resize and rearms after returning", async ({
  page
}) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })

  for (let visit = 0; visit < 2; visit += 1) {
    await navigateClient(page, "/om/hjalp?ankare=Epub")
    await expect(page).toHaveURL("/om/hjalp?ankare=Epub")
    await expectAnchorOffset(page, "Epub")

    await page.locator(".help_content").evaluate((element, marker) => {
      document.documentElement.style.overflowAnchor = "none"
      document.body.style.overflowAnchor = "none"
      ;(element as HTMLElement).style.overflowAnchor = "none"
      const spacer = document.createElement("div")
      spacer.dataset.helpResize = marker
      spacer.style.height = "200px"
      element.prepend(spacer)
    }, `visit-${visit}`)
    await expectAnchorOffset(page, "Epub")

    const retainedScroll = await page.evaluate(() => window.scrollY)
    await page.locator(".help_content").evaluate(element => {
      const spacer = document.createElement("div")
      spacer.style.height = "100px"
      element.prepend(spacer)
    })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(retainedScroll)

    await navigateClient(page, "/om/ide")
    await expect(page).toHaveURL("/om/ide")
  }
})

test("client navigation to a missing help anchor keeps the cross-page top reset", async ({
  page
}) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })
  await page.evaluate(() => window.scrollTo({ top: 400 }))
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  await navigateClient(page, "/om/hjalp?ankare=missing")
  await expect(page).toHaveURL("/om/hjalp?ankare=missing")
  await expect(page.locator(".help_content.content.unbox.page-help")).toBeVisible()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => {
    requestAnimationFrame(() => resolve())
  })))
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test("Help direct query and browser history resynchronize scrolling without refetch", async ({ page, request }) => {
  const problems = captureBrowserProblems(page)
  await page.goto("/om/hjalp?ankare=Epub", { waitUntil: "networkidle" })
  await expectAnchorOffset(page, "Epub")

  await page.locator("#toolkit").getByRole("link", { name: "Etext", exact: true }).click()
  await expect(page).toHaveURL("/om/hjalp?ankare=Etext")
  await expectAnchorOffset(page, "Etext")

  await page.goBack()
  await expect(page).toHaveURL("/om/hjalp?ankare=Epub")
  await expectAnchorOffset(page, "Epub")

  await page.goForward()
  await expect(page).toHaveURL("/om/hjalp?ankare=Etext")
  await expectAnchorOffset(page, "Etext")

  expect(await loggedContentRequests(request)).toEqual([contentPath])
  expect(problems).toEqual([])
})
