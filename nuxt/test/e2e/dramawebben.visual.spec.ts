import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { dramawebbenCases } from "../fixtures/dramawebben-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin

const emptyDataLedgers = [
  "/_requests",
  "/_author_document_requests",
  "/_author_profile_requests",
  "/_author_works_requests",
  "/_home_requests",
  "/_library_query_requests",
  "/_presentation_requests",
  "/_dramawebben_excluded_data_requests",
  "/_text_search/requests"
] as const

async function resetLedgers(request: APIRequestContext) {
  await Promise.all([
    ...emptyDataLedgers.map(path => request.delete(`${fixture}${path}`)),
    request.delete(`${fixture}/_dramawebben_document_requests`),
    request.delete(`${fixture}/_dramawebben_document_failure`),
    request.delete(`${fixture}/_dramawebben_document_redirect_target_requests`)
  ])
}

async function fixtureRequests(request: APIRequestContext, path: string) {
  return (await (await request.get(`${fixture}${path}`)).json()).requests
}

async function expectEmptyDataLedgers(request: APIRequestContext) {
  for (const path of emptyDataLedgers) {
    const payload = await (await request.get(`${fixture}${path}`)).json()
    const requests = path === "/_text_search/requests"
      ? [...payload.results, ...payload.count, ...payload.options]
      : payload.requests
    expect(requests, path).toEqual([])
  }
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

async function decodedBodyBackground(page: Page) {
  return await page.locator("body.page-dramaweb").evaluate(async body => {
    const backgroundImage = getComputedStyle(body).backgroundImage
    const match = backgroundImage.match(/^url\(["']?(.+?)["']?\)$/u)
    if (!match) {
      return { backgroundImage, url: null, naturalWidth: 0, naturalHeight: 0 }
    }

    const image = new Image()
    image.src = new URL(match[1]!, document.baseURI).href
    await image.decode()
    return {
      backgroundImage,
      url: image.src,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight
    }
  })
}

test.beforeEach(async ({ request }) => resetLedgers(request))
test.afterEach(async ({ request }) => resetLedgers(request))

for (const documentCase of dramawebbenCases) {
  test(`matches the Angular Dramawebben ${documentCase.kind} authority`, async ({
    page,
    request
  }, testInfo) => {
    const problems = collectProblems(page)
    const productionRequests: string[] = []
    const browserDataRequests: string[] = []

    await page.route("**/*", route => {
      const browserRequest = route.request()
      const url = new URL(browserRequest.url())
      const label = `${browserRequest.method()} ${browserRequest.url()}`
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
        productionRequests.push(label)
        return route.abort("blockedbyclient")
      }
      if (url.pathname.startsWith("/api/")
        || url.pathname.startsWith("/private-v2/")
        || url.pathname.startsWith("/red/dramawebben/")) {
        browserDataRequests.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(documentCase.route, { waitUntil: "networkidle" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body")).toHaveClass(documentCase.kind === "start"
      ? "focus page-dramaweb ready"
      : "focus page-dramaweb drama-dramasubpage ready")
    await expect(page.locator(documentCase.kind === "start"
      ? "#mainview > .cover:not(.show)"
      : "#mainview > .cover.show")).toHaveCount(1)
    await expect(page.locator(`#mainview > .${documentCase.kind === "start" ? "startpage" : "subpage"}`))
      .toHaveCount(1)

    const logo = page.locator(".logo img")
    await expect(logo).toBeVisible()
    await expect(logo).toHaveAttribute("alt", "Dramawebben")
    expect(await logo.evaluate(image => {
      const selected = image as HTMLImageElement
      return selected.complete && selected.naturalWidth > 0 && selected.naturalHeight > 0
    })).toBe(true)

    if (documentCase.heading) {
      await expect(page.getByRole("heading", { name: documentCase.heading, exact: true }))
        .toBeVisible()
    } else {
      await expect(page.locator(".page_content")).toBeEmpty()
    }

    await waitForVisualAssets(page)
    expect(await page.evaluate(async () => {
      await document.fonts.ready
      return document.fonts.status
    })).toBe("loaded")
    const expectedBackground = documentCase.kind === "start"
      ? "/img/dramawebben.jpg"
      : "/img/dramawebben_fade.jpg"
    const background = await decodedBodyBackground(page)
    const backgroundStem = expectedBackground.endsWith("_fade.jpg")
      ? "dramawebben_fade"
      : "dramawebben"
    expect(new URL(background.url!).pathname).toMatch(
      new RegExp(`/${backgroundStem}(?:\\.[A-Za-z0-9_-]+)?\\.jpg$`, "u")
    )
    expect({
      naturalWidth: background.naturalWidth,
      naturalHeight: background.naturalHeight
    }).toEqual({ naturalWidth: 2012, naturalHeight: 1308 })

    expect(await fixtureRequests(request, "/_dramawebben_document_requests"))
      .toEqual(documentCase.sourcePath ? [{
        method: "GET",
        path: documentCase.sourcePath,
        authorization: null,
        cookie: null
      }] : [])
    expect(await fixtureRequests(
      request,
      "/_dramawebben_document_redirect_target_requests"
    )).toEqual([])
    expect((await (await request.get(
      `${fixture}/_dramawebben_document_failure`
    )).json()).failure).toBeNull()
    await expectEmptyDataLedgers(request)
    expect(browserDataRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(problems).toEqual([])

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`dramawebben-${documentCase.kind}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0,
      maxDiffPixels: 0
    })

    expect(browserDataRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(problems).toEqual([])
  })
}
