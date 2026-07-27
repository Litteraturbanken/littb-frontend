import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const fixture = "http://127.0.0.1:4100"
const backgroundsPath = "/red/bilder/bakgrundsbilder/backgrounds.xml"
const appStyles = ["/app/style/litteraturbanken.css", "/app/style/date.css"] as const
const burmanImages = Array.from(
  { length: 10 },
  (_, index) => `/red/presentationer/specialomraden/Burmanbilder/${index + 1}.jpg`
)

type VisualCase = {
  name: string
  route: string
  contentPath: string
  heading: string
  stylesheets: readonly string[]
  images: readonly string[]
  backgroundPath: string | null
  bodyClasses: readonly string[]
  inlineStyle: string | null
}

const cases: VisualCase[] = [
  {
    name: "index",
    route: "/presentationer",
    contentPath: "/red/presentationer/presentationerForfattare.html",
    heading: "Presentationer och introduktioner",
    stylesheets: [],
    images: [],
    backgroundPath: null,
    bodyClasses: [],
    inlineStyle: null
  },
  {
    name: "censur",
    route: "/presentationer/specialomraden/Censur.html",
    contentPath: "/red/presentationer/specialomraden/Censur.html",
    heading: "Censur och liknande ingrepp mot tryckta skrifter",
    stylesheets: [],
    images: [],
    backgroundPath: "/red/bilder/bakgrundsbilder/rostratt_b.jpg",
    bodyClasses: ["subpage", "bkg-folder-fallback"],
    inlineStyle: null
  },
  {
    name: "rostratt",
    route: "/presentationer/specialomraden/Rostratt.html",
    contentPath: "/red/presentationer/specialomraden/Rostratt.html",
    heading: "Rösträtt 1919",
    stylesheets: ["/red/presentationer/specialomraden/Rostratt.css"],
    images: [],
    backgroundPath: "/red/bilder/bakgrundsbilder/rostratt_a.jpg",
    bodyClasses: ["subpage", "bkg-add-border", "bkg-paper"],
    inlineStyle: "html { background-color: #382a32; }"
  },
  {
    name: "figurdikten",
    route: "/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html",
    contentPath: "/red/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html",
    heading: "Figurdikten som barock blandkonst",
    stylesheets: appStyles,
    images: burmanImages,
    backgroundPath: "/red/bilder/bakgrundsbilder/rostratt_b.jpg",
    bodyClasses: ["subpage", "bkg-folder-fallback"],
    inlineStyle: "p.image {text-align:center}"
  },
  {
    name: "vandring",
    route: "/presentationer/vandringar/VandringElam.html",
    contentPath: "/red/presentationer/vandringar/VandringElam.html",
    heading: "Såsom i en spegel",
    stylesheets: appStyles,
    images: [],
    backgroundPath: null,
    bodyClasses: ["subpage", "bkg-vandring", "bkg-plain"],
    inlineStyle: null
  }
]

async function resetPresentation(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_presentation_requests`),
    request.delete(`${fixture}/_presentation_failures`)
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

async function blockProductionAndRouteAppStyles(page: Page) {
  const forbidden: string[] = []
  await page.route("**/*", async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      forbidden.push(`${request.method()} ${request.url()}`)
      return route.abort("blockedbyclient")
    }
    if (appStyles.includes(url.pathname as (typeof appStyles)[number])) {
      const response = await route.fetch({ url: `${fixture}${url.pathname}${url.search}` })
      return route.fulfill({ response })
    }
    return route.continue()
  })
  return forbidden
}

async function expectStylesheetLoaded(page: Page, pathname: string) {
  await expect.poll(async () => page.locator('link[rel~="stylesheet"]').evaluateAll(
    (links, expectedPathname) => links.filter(link =>
      new URL((link as HTMLLinkElement).href).pathname === expectedPathname
    ).length,
    pathname
  )).toBe(1)
  await expect.poll(async () => page.evaluate(path =>
    [...document.styleSheets].some(sheet => new URL(sheet.href ?? location.href).pathname === path),
  pathname)).toBe(true)
}

async function expectPresentationReady(page: Page, visualCase: VisualCase) {
  await expect(page.locator("body")).toHaveClass(/\bfocus\b.*\bpage-presentation\b.*\bready\b/)
  for (const className of visualCase.bodyClasses) {
    await expect(page.locator("body")).toHaveClass(new RegExp(`\\b${className}\\b`))
  }
  await expect(page.getByRole("heading", { name: visualCase.heading, exact: true })).toBeVisible()
  await expect(page.locator(visualCase.name === "index" ? ".doc.main" : ".content"))
    .toBeVisible()

  for (const stylesheet of visualCase.stylesheets) {
    await expectStylesheetLoaded(page, stylesheet)
  }
  for (const imagePath of visualCase.images) {
    const image = page.locator(`img[src="${imagePath}"]`)
    await expect(image).toHaveCount(1)
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)
  }
  if (visualCase.inlineStyle) {
    await expect.poll(async () => (await page.locator("style").allTextContents()).join("\n"))
      .toContain(visualCase.inlineStyle)
  }
  if (visualCase.name === "rostratt") {
    const stylesheetOrder = await page.evaluate(() => [...document.styleSheets].map((sheet, index) => ({
      href: sheet.href ? new URL(sheet.href).pathname : null,
      index,
      selectors: (() => {
        try {
          return [...sheet.cssRules]
            .map(rule => "selectorText" in rule ? String(rule.selectorText) : "")
            .filter(Boolean)
        } catch {
          return []
        }
      })()
    })))
    const runtimeIndex = stylesheetOrder.find(entry =>
      entry.href === "/red/presentationer/specialomraden/Rostratt.css"
    )?.index ?? -1
    const nuxtOverrideIndex = stylesheetOrder.findLast(entry =>
      entry.href !== "/red/presentationer/specialomraden/Rostratt.css" &&
      entry.selectors.some(selector => selector.includes(".page-presentation.subpage .lb-logo"))
    )?.index ?? -1
    expect(runtimeIndex).toBeGreaterThan(nuxtOverrideIndex)
    await expect(page.locator(".lb-logo")).toHaveCSS("--logo-l-color", "white")
    await expect(page.locator(".lb-logo")).toHaveCSS("--logo-b-color", "white")
    await expect(page.locator(".mainnav a").first()).toHaveCSS("color", "rgb(255, 255, 255)")
    await expect(page.locator(".quick-search-trigger")).toHaveCSS("color", "rgb(255, 255, 255)")
    await expect(page.locator("#mainview p").first()).toHaveCSS("max-width", "570px")
  }
  if (visualCase.backgroundPath) {
    await expect(page.locator("html")).toHaveCSS(
      "background-image",
      new RegExp(visualCase.backgroundPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    )
  } else if (visualCase.name === "index") {
    await expect(page.locator("html")).toHaveCSS("background-image", /presentations.*\.jpg/)
  } else {
    await expect(page.locator("html")).toHaveCSS("background-image", "none")
  }

  await waitForVisualAssets(page)
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe("loaded")
}

function expectedLedger(visualCase: VisualCase) {
  const paths = [visualCase.contentPath]
  if (visualCase.name !== "index") paths.push(backgroundsPath)
  paths.push(...visualCase.stylesheets, ...visualCase.images)
  if (visualCase.backgroundPath) paths.push(visualCase.backgroundPath, visualCase.backgroundPath)
  return paths.sort()
}

test.beforeEach(async ({ request }) => resetPresentation(request))
test.afterEach(async ({ request }) => resetPresentation(request))

test("preserves a source-later inline override after an equal-specificity linked rule", async ({
  page
}) => {
  const problems = captureBrowserProblems(page)
  const forbidden = await blockProductionAndRouteAppStyles(page)
  await page.route("**/app/style/date.css", route => route.fulfill({
    status: 200,
    contentType: "text/css; charset=utf-8",
    body: "p.image { text-align: left; }"
  }))

  const response = await page.goto(
    "/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html",
    { waitUntil: "domcontentloaded" }
  )
  expect(response?.status()).toBe(200)
  await expectStylesheetLoaded(page, "/app/style/date.css")
  await expect.poll(async () => (await page.locator("style").allTextContents()).join("\n"))
    .toContain("p.image {text-align:center}")

  expect(await page.locator(".content").evaluate(content => {
    const probe = document.createElement("p")
    probe.className = "image"
    content.append(probe)
    const textAlign = getComputedStyle(probe).textAlign
    probe.remove()
    return textAlign
  })).toBe("center")
  expect(forbidden).toEqual([])
  expect(problems).toEqual([])
})

for (const visualCase of cases) {
  test(`matches the approved Angular Presentation ${visualCase.name} page`, async ({
    page,
    request
  }, testInfo) => {
    const problems = captureBrowserProblems(page)
    const forbidden = await blockProductionAndRouteAppStyles(page)
    const response = await page.goto(visualCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)

    await expectPresentationReady(page, visualCase)
    const requests = await presentationRequests(request)
    expect(requests.sort()).toEqual(expectedLedger(visualCase))
    for (const image of visualCase.images) {
      expect(requests.filter(path => path === image)).toHaveLength(1)
    }
    expect(forbidden).toEqual([])
    expect(problems).toEqual([])

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`presentation-${visualCase.name}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })

    expect(forbidden).toEqual([])
    expect(problems).toEqual([])
  })
}
