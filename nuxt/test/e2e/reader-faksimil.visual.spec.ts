import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const fixture = "http://127.0.0.1:4100"
const readerPath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"

function scanPath(size: number, imageNumber = 9) {
  const padded = String(imageNumber).padStart(4, "0")
  return `/txt/lb-reader-gosta-berlings-saga/lb-reader-gosta-berlings-saga_${size}/` +
    `lb-reader-gosta-berlings-saga_${size}_${padded}.jpeg`
}

const ocrPath = "/txt/lb-reader-gosta-berlings-saga/ocr_00001.html"

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_editor_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`),
    request.delete(`${fixture}/_reader_ocr_requests`),
    request.delete(`${fixture}/_reader_jpeg_requests`),
    request.delete(`${fixture}/_reader_hit_requests`)
  ])
}

async function fixtureRequests(request: APIRequestContext, ledger: string): Promise<string[]> {
  const response = await request.get(`${fixture}/${ledger}`)
  return (await response.json() as { requests: string[] }).requests
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration/i.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

const visualCases = [
  {
    name: "default",
    route: readerPath,
    size: 3,
    width: 625,
    srcset: `${scanPath(3)} 1x, ${scanPath(5)} 2x`
  },
  {
    name: "large",
    route: `${readerPath}?storlek=4`,
    size: 4,
    width: 900,
    srcset: null
  }
] as const

test.beforeEach(async ({ request }) => resetReader(request))
test.afterEach(async ({ request }) => resetReader(request))

test("narrow reader keeps the live corridor gap between its logo and facsimile", async ({
  page
}) => {
  await page.setViewportSize({ width: 665, height: 1000 })
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const leftCorridor = page.locator("#leftCorridor")
  const logo = leftCorridor.locator(".logo_link_monogram")
  const facsimile = page.locator(".reader_main img.faksimil")
  await expect(facsimile).toBeVisible()
  await expect(leftCorridor).toHaveCSS("margin-right", "80px")

  const logoBox = await logo.boundingBox()
  const facsimileBox = await facsimile.boundingBox()
  expect(logoBox).not.toBeNull()
  expect(facsimileBox).not.toBeNull()
  expect(facsimileBox!.x - (logoBox!.x + logoBox!.width)).toBeGreaterThanOrEqual(40)
})

for (const visualCase of visualCases) {
  test(`matches the Angular faksimil Reader ${visualCase.name} authority`, async ({
    page,
    request
  }, testInfo) => {
    const problems = captureBrowserProblems(page)
    const productionEscapes: string[] = []
    const unexpectedApiRequests: string[] = []
    const unexpectedReaderAssets: string[] = []
    const scanRequests: string[] = []
    const selectedBrowserSize = visualCase.size === 3 && testInfo.project.name === "mobile-chromium"
      ? 5
      : visualCase.size
    const selectedBrowserScan = scanPath(selectedBrowserSize)

    await page.route("**/*", route => {
      const browserRequest = route.request()
      const url = new URL(browserRequest.url())
      const label = `${browserRequest.method()} ${browserRequest.url()}`
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
        productionEscapes.push(label)
        return route.abort("blockedbyclient")
      }
      if (url.pathname.startsWith("/api/")) {
        unexpectedApiRequests.push(label)
        return route.abort("blockedbyclient")
      }
      if (
        url.pathname.includes("/search_document/") ||
        url.pathname.includes("/search-hits") ||
        /\/txt\/[^/]+\/(?:res|ocr)_\d+\.html$/.test(url.pathname)
      ) {
        unexpectedReaderAssets.push(label)
        return route.abort("blockedbyclient")
      }
      if (/\/txt\/lb-reader-gosta-berlings-saga\/.*\.jpeg$/.test(url.pathname)) {
        if (browserRequest.method() !== "GET" || url.pathname !== selectedBrowserScan) {
          unexpectedReaderAssets.push(label)
          return route.abort("blockedbyclient")
        }
        scanRequests.push(url.pathname)
      }
      return route.continue()
    })

    const response = await page.goto(visualCase.route, { waitUntil: "networkidle" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body.focus.page-reading.ready")).toHaveCount(1)
    await expect(page.locator(".reader_main.type-faksimil")).toHaveCount(1)
    await expect(page.locator(".reader_main.type-faksimil")).not.toHaveClass(/\bocr\b/u)
    await expect(page.locator(".reader_main .reader-ocr-layer .overlay")).toHaveCount(1)
    await expect(page.locator(".reader_main .etext, #search_nav, .reader-search-state"))
      .toHaveCount(0)

    const image = page.locator(".reader_main .img_area img.faksimil")
    await expect(image).toHaveAttribute("src", scanPath(visualCase.size))
    if (visualCase.srcset) {
      await expect(image).toHaveAttribute("srcset", visualCase.srcset)
    } else {
      await expect(image).not.toHaveAttribute("srcset", /./)
    }
    await expect(image).toHaveAttribute("width", String(visualCase.width))
    await expect(image).not.toHaveAttribute("height", /./)
    await expect(image).toHaveCSS("width", `${visualCase.width}px`)
    await expect(page.locator(".reader_main .img_area")).toHaveCSS(
      "width",
      `${visualCase.width}px`
    )
    await expect(image).toHaveJSProperty(
      "currentSrc",
      `${new URL(visualCase.route, page.url()).origin}${selectedBrowserScan}`
    )

    const sizeControls = page.locator("#toolkit .reader-facsimile-size-controls")
    await expect(sizeControls.locator("h2")).toHaveText("Ändra storlek")
    await expect(sizeControls.getByRole("button", { name: "Mindre" })).toBeEnabled()
    await expect(sizeControls.getByRole("button", { name: "Större" })).toBeEnabled()
    const rotationControls = page.locator("#toolkit .reader-facsimile-rotation-controls")
    if (testInfo.project.name === "mobile-chromium") {
      await expect(rotationControls).toBeHidden()
    } else {
      await expect(rotationControls).toBeVisible()
      await expect(rotationControls.locator("h2")).toHaveText("Rotera")
      await expect(rotationControls.getByRole("button", { name: "Vänster" })).toBeVisible()
      await expect(rotationControls.getByRole("button", { name: "Höger" })).toBeVisible()
    }

    await waitForVisualAssets(page)
    await image.evaluate(async element => (element as HTMLImageElement).decode())
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    await expect(page.locator("html")).toHaveCSS("background-image", "none")
    const imageBox = await image.boundingBox()
    expect(imageBox?.width).toBe(visualCase.width)
    expect(imageBox?.height).toBeCloseTo(visualCase.width * 1308 / 1900, 1)
    if (testInfo.project.name === "mobile-chromium") {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeGreaterThan(390)
    }

    expect(scanRequests).toEqual([selectedBrowserScan, selectedBrowserScan])
    expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
      "/v2/works/Lagerl%C3%B6fS/GostaBerlingsSaga/manifest?media_type=faksimil"
    ])
    expect(await fixtureRequests(request, "_reader_metadata_requests")).toEqual([])
    expect(await fixtureRequests(request, "_editor_manifest_requests")).toEqual([])
    expect(await fixtureRequests(request, "_reader_html_requests")).toEqual([])
    expect(await fixtureRequests(request, "_reader_ocr_requests")).toEqual([ocrPath])
    expect(await fixtureRequests(request, "_reader_jpeg_requests")).toEqual([
      selectedBrowserScan,
      selectedBrowserScan
    ])
    expect(await fixtureRequests(request, "_reader_hit_requests")).toEqual([])
    expect(unexpectedApiRequests).toEqual([])
    expect(unexpectedReaderAssets).toEqual([])
    expect(productionEscapes).toEqual([])
    expect(problems).toEqual([])

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`reader-faksimil-${visualCase.name}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })

    expect(unexpectedApiRequests).toEqual([])
    expect(unexpectedReaderAssets).toEqual([])
    expect(productionEscapes).toEqual([])
    expect(problems).toEqual([])
  })
}
