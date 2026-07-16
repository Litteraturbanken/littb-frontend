import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type Page } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const fixtureRoot = resolve(import.meta.dirname, "../fixtures/presentation-content")
const backgroundsPath = "/red/bilder/bakgrundsbilder/backgrounds.xml"
const appStyles = ["/app/style/litteraturbanken.css", "/app/style/date.css"] as const
const burmanImages = Array.from(
  { length: 10 },
  (_, index) => `/red/presentationer/specialomraden/Burmanbilder/${index + 1}.jpg`
)

type FixtureResponse = { body: Buffer; contentType: string }
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

const fixtureDefinitions = [
  ["/red/presentationer/presentationerForfattare.html", "presentationerForfattare.html", "text/html; charset=utf-8"],
  ["/red/presentationer/specialomraden/Censur.html", "Censur.html", "text/html; charset=utf-8"],
  ["/red/presentationer/specialomraden/Rostratt.html", "Rostratt.html", "text/html; charset=utf-8"],
  ["/red/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html", "FigurdiktenSomBarockBlandkonst.html", "text/html; charset=utf-8"],
  ["/red/presentationer/vandringar/VandringElam.html", "VandringElam.html", "text/html; charset=utf-8"],
  [backgroundsPath, "backgrounds.xml", "application/xml; charset=utf-8"],
  ["/red/presentationer/specialomraden/Rostratt.css", "Rostratt.css", "text/css; charset=utf-8"],
  [appStyles[0], "app-style-litteraturbanken.css", "text/css; charset=utf-8"],
  [appStyles[1], "app-style-date.css", "text/css; charset=utf-8"],
  ...burmanImages.map((pathname, index) => [pathname, `burman-${index + 1}.jpg`, "image/jpeg"]),
  ["/red/presentationer/specialomraden/Figurdiktensombarockblandkonst.pdf", "Figurdiktensombarockblandkonst.pdf", "application/pdf"],
  ["/red/bilder/bakgrundsbilder/rostratt_a.jpg", "rostratt-a.jpg", "image/jpeg"],
  ["/red/bilder/bakgrundsbilder/rostratt_b.jpg", "rostratt-b.jpg", "image/jpeg"]
] as const

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

let responses: Map<string, FixtureResponse>
let authorityFonts: Buffer

test.beforeAll(async () => {
  responses = new Map(await Promise.all(fixtureDefinitions.map(async ([pathname, filename, contentType]) => [
    pathname,
    { body: await readFile(resolve(fixtureRoot, filename)), contentType }
  ] as const)))
  authorityFonts = await readFile(
    resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")
  )
})

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
    await expect(page.locator(".lb-logo")).toHaveCSS("--logo-l-color", "white")
    await expect(page.locator(".lb-logo")).toHaveCSS("--logo-b-color", "white")
    await expect(page.locator(".mainnav a").first()).toHaveCSS("color", "rgb(255, 255, 255)")
    await expect(page.locator("#mainview p").first()).toHaveCSS("max-width", "570px")
  }
  if (visualCase.backgroundPath) {
    await expect(page.locator("html")).toHaveCSS(
      "background-image",
      new RegExp(visualCase.backgroundPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    )
  } else if (visualCase.name === "index") {
    await expect(page.locator("html")).toHaveCSS("background-image", /presentations.*\.jpg/)
  } else if (visualCase.name === "vandring") {
    await expect(page.locator("html")).toHaveCSS("background-image", 'url("")')
  } else {
    await expect(page.locator("html")).toHaveCSS("background-image", "none")
  }

  if (visualCase.name === "vandring") {
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(
        [...document.images]
          .filter(image => !image.complete)
          .map(image => new Promise(resolve => {
            image.addEventListener("load", resolve, { once: true })
            image.addEventListener("error", resolve, { once: true })
          }))
      )
    })
  } else {
    await waitForVisualAssets(page)
  }
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
}

function expectedLedger(visualCase: VisualCase) {
  const paths = [backgroundsPath, visualCase.contentPath]
  paths.push(...visualCase.stylesheets, ...visualCase.images)
  if (visualCase.backgroundPath) paths.push(visualCase.backgroundPath, visualCase.backgroundPath)
  return paths.sort()
}

for (const visualCase of cases) {
  test(`captures the current Angular Presentation ${visualCase.name} authority`, async ({
    page
  }, testInfo) => {
    const servedPresentationRequests: string[] = []
    const forbiddenProductionRequests: string[] = []
    const unexpectedPresentationRequests: string[] = []

    await page.route("**/*", route => {
      const request = route.request()
      const url = new URL(request.url())
      const response = responses.get(url.pathname)
      if (response) {
        servedPresentationRequests.push(url.pathname)
        return route.fulfill({ status: 200, ...response })
      }
      if (url.pathname === "/red/css/etext.css") {
        return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" })
      }
      if (url.hostname === "cloud.typography.com") {
        return route.fulfill({
          status: 200,
          contentType: "text/css; charset=utf-8",
          body: authorityFonts
        })
      }
      if (url.hostname === "www.googletagmanager.com") {
        return route.fulfill({
          status: 200,
          contentType: "application/javascript; charset=utf-8",
          body: ""
        })
      }
      if (
        url.pathname.startsWith("/red/presentationer/") ||
        url.pathname.startsWith("/red/bilder/bakgrundsbilder/") ||
        url.pathname.startsWith("/app/style/")
      ) {
        unexpectedPresentationRequests.push(`${request.method()} ${request.url()}`)
        return route.abort("blockedbyclient")
      }
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
        forbiddenProductionRequests.push(`${request.method()} ${request.url()}`)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(visualCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expectPresentationReady(page, visualCase)
    expect(servedPresentationRequests.sort()).toEqual(expectedLedger(visualCase))
    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedPresentationRequests).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `presentation-${visualCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })

    expect(forbiddenProductionRequests).toEqual([])
    expect(unexpectedPresentationRequests).toEqual([])
  })
}
