import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { semerAuthorDocumentAssets } from "../fixtures/author-document-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

const fixture = "http://127.0.0.1:4100"

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_document_requests`),
    request.delete(`${fixture}/_author_document_asset_requests`),
    request.delete(`${fixture}/_author_document_failure`),
    request.delete(`${fixture}/_author_document_delay`)
  ])
}

async function fixtureRequests(request: APIRequestContext, ledger: string) {
  return (await (await request.get(`${fixture}/${ledger}`)).json()).requests
}

function captureProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

const visualCases = [
  {
    name: "presentation",
    route: "/författare/S%C3%B6derbergH/presentation",
    apiPath: "/api/author-documents/S%C3%B6derbergH/presentation",
    descriptorPath: "/private-v2/authors/S%C3%B6derbergH/documents/presentation",
    sourcePath: "/red/forfattare/SoderbergH/presentation/index.html",
    assets: []
  },
  {
    name: "bibliografi",
    route: "/författare/Lagerl%C3%B6fS/bibliografi",
    apiPath: "/api/author-documents/Lagerl%C3%B6fS/bibliografi",
    descriptorPath: "/private-v2/authors/Lagerl%C3%B6fS/documents/bibliografi",
    sourcePath: "/red/forfattare/LagerlofS/bibliografi/index.html",
    assets: []
  },
  {
    name: "semer",
    route: "/författare/AlmqvistCJL/semer",
    apiPath: "/api/author-documents/AlmqvistCJL/semer",
    descriptorPath: "/private-v2/authors/AlmqvistCJL/documents/semer",
    sourcePath: "/red/forfattare/AlmqvistCJL/semer/index.html",
    assets: semerAuthorDocumentAssets.map(asset => asset.path)
  }
] as const

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

for (const documentCase of visualCases) {
  test(`matches the Angular ${documentCase.name} authority`, async ({
    page,
    request
  }, testInfo) => {
    const problems = captureProblems(page)
    const productionEscapes: string[] = []
    const browserApiRequests: string[] = []
    const browserManagedAssets: string[] = []
    const unexpectedApplicationRequests: string[] = []
    const selectedAssets = new Set<string>(documentCase.assets)
    // The hydration-stable capability renderer preserves the SSR nodes, so every
    // selected managed image keeps its browser ownership without a duplicate load.
    const expectedAssetRequests = [...documentCase.assets].sort()

    await page.route("**/*", route => {
      const browserRequest = route.request()
      const url = new URL(browserRequest.url())
      const label = `${browserRequest.method()} ${browserRequest.url()}`
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
        productionEscapes.push(label)
        return route.abort("blockedbyclient")
      }
      if (url.pathname.startsWith("/api/")) {
        if (browserRequest.method() === "GET"
          && url.pathname === documentCase.apiPath && url.search === "") {
          browserApiRequests.push(label)
          return route.continue()
        }
        unexpectedApplicationRequests.push(label)
        return route.abort("blockedbyclient")
      }
      if (url.pathname.startsWith("/red/forfattare/")) {
        if (browserRequest.method() === "GET"
          && url.search === "" && selectedAssets.has(url.pathname)) {
          browserManagedAssets.push(url.pathname)
          return route.continue()
        }
        unexpectedApplicationRequests.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(documentCase.route, { waitUntil: "networkidle" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body.focus.page-authorInfo.ready")).toHaveCount(1)
    await expect(page.locator(".page_content > .content.unbox")).toHaveCount(1)
    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    await expect(page.locator(".page_content img")).toHaveCount(selectedAssets.size)
    if (selectedAssets.size) {
      expect(await page.locator(".page_content img").evaluateAll(images => images.every(image => {
        const selected = image as HTMLImageElement
        return selected.complete && selected.naturalWidth > 0 && selected.naturalHeight > 0
      }))).toBe(true)
    }

    expect(browserApiRequests).toEqual([])
    expect(browserManagedAssets.sort()).toEqual(expectedAssetRequests)
    for (const asset of selectedAssets) {
      expect(browserManagedAssets.filter(requested => requested === asset)).toHaveLength(1)
    }
    expect(await fixtureRequests(request, "_author_document_requests")).toEqual([
      { kind: "descriptor", path: documentCase.descriptorPath },
      { kind: "content", path: documentCase.sourcePath }
    ])
    expect((await fixtureRequests(request, "_author_document_asset_requests")).sort())
      .toEqual(expectedAssetRequests)
    expect(unexpectedApplicationRequests).toEqual([])
    expect(productionEscapes).toEqual([])
    expect(problems).toEqual([])

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`author-document-${documentCase.name}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })

    expect(browserApiRequests).toEqual([])
    expect(unexpectedApplicationRequests).toEqual([])
    expect(productionEscapes).toEqual([])
    expect(problems).toEqual([])
  })
}
