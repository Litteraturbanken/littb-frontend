import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  expect,
  test,
  type APIRequestContext,
  type Page
} from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const fixture = "http://127.0.0.1:4100"
const readerPath = "/författare/SöderbergH/titlar/DoktorGlasParts/sida/-2/etext"
const basePageHref = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida"

const existingReaderBaselineManifest = {
  "reader-hit-ordinary-desktop.png": "cd159a40e3240784a49e26c66a84e7596c160fe8c0a2049fa7d99482d7dacae2",
  "reader-hit-ordinary-mobile.png": "6704cc0c2c0f45fe911f6fa2423613205571af744fdbf0cea79884cef5e2527c",
  "reader-hit-phrase-middle-desktop.png": "76036ed9a8b90c08f33d958c7e72ca42ef87ae880c7adfa87f8dd8864f63a3bc",
  "reader-hit-phrase-middle-mobile.png": "768d1511029e338e2639056ffd6fb9b51225f3d14e52b6954409ca2961f72a7d",
  "reader-hit-single-first-desktop.png": "bed4ccdd519256e789ea08b3e9b43f58e94bdefee4863e918a323888f5a1bf58",
  "reader-hit-single-first-mobile.png": "ee5319adad7855afddb16df53ed0f242c22194bdc520136f0c97df3a3d55572d",
  "reader-faksimil-default-desktop.png": "19991017ec6c326207faadeb205a08272f2b4f254b99c5487765e79a09c799e5",
  "reader-faksimil-default-mobile.png": "088f887690d3fab179906ccbec53ef2cf1f766b13ee9be65efebe3fae1863a84",
  "reader-faksimil-large-desktop.png": "cb13435ba3c77c40d001d2f55b80a53932ab37b07d73f28b61e403ebf990a922",
  "reader-faksimil-large-mobile.png": "0470d4d1d97a5efe0e5410cc596cc5e30589ecf1f2bc70348cb940aebf9d1739"
} as const

const readerContentsBaselineManifest = {
  "reader-contents-closed-desktop.png": "d4a0b28793b5ceb151d7831ee3d69f13e311dae1e3d860914cd7a7fe739297e2",
  "reader-contents-closed-mobile.png": "f2eb46f2b574e0b6283aa53f8a6d70ce520f9c64a7ced6468ae7da83facaa632",
  "reader-contents-open-desktop.png": "76fc17211cc6e4f35393590e19e6673f83019dcea9517326f3c6904c83681793",
  "reader-contents-open-mobile.png": "3c0f9db2ef3dab36a89cc9f708311c2a01363bc9646eb5bbeef160776e5d2287"
} as const

type FixtureRequests = {
  html: string[]
  jpeg: string[]
  metadata: string[]
  ocr: string[]
}

type AuthorResolveRequest = {
  path: string
  body: unknown
}

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_editor_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`),
    request.delete(`${fixture}/_reader_ocr_requests`),
    request.delete(`${fixture}/_reader_jpeg_requests`),
    request.delete(`${fixture}/_reader_hit_requests`),
    request.delete(`${fixture}/_author_resolve_requests`),
    request.delete(`${fixture}/_author_resolve_failure`),
    request.delete(`${fixture}/_author_resolve_scenario`)
  ])
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

async function fixtureRequests(request: APIRequestContext): Promise<FixtureRequests> {
  const entries = await Promise.all(
    ["html", "jpeg", "metadata", "ocr"].map(async kind => [
      kind,
      (await (await request.get(`${fixture}/_reader_${kind}_requests`)).json()).requests
    ] as const)
  )
  return Object.fromEntries(entries) as FixtureRequests
}

async function requestLedger(request: APIRequestContext, ledger: string): Promise<string[]> {
  return (await (await request.get(`${fixture}/${ledger}`)).json()).requests
}

async function readerHitRequests(request: APIRequestContext): Promise<unknown[]> {
  return (await (await request.get(`${fixture}/_reader_hit_requests`)).json()).requests
}

async function authorResolveRequests(
  request: APIRequestContext
): Promise<AuthorResolveRequest[]> {
  return (await (await request.get(`${fixture}/_author_resolve_requests`)).json()).requests
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  return problems
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex")
}

async function assertBaselineManifest(manifest: Record<string, string>) {
  const directory = resolve(import.meta.dirname, "../visual/baselines")
  for (const [filename, expectedHash] of Object.entries(manifest)) {
    const bytes = await readFile(resolve(directory, filename))
    expect(sha256(bytes), filename).toBe(expectedHash)
  }
}

test.beforeAll(async () => {
  await assertBaselineManifest(existingReaderBaselineManifest)
  await assertBaselineManifest(readerContentsBaselineManifest)
})

test.afterAll(async () => {
  await assertBaselineManifest(existingReaderBaselineManifest)
  await assertBaselineManifest(readerContentsBaselineManifest)
})

test.beforeEach(async ({ request }) => resetReader(request))
test.afterEach(async ({ request }) => resetReader(request))

const visualCases = [
  { name: "closed", route: readerPath, open: false },
  { name: "open", route: `${readerPath}?innehall`, open: true }
] as const

for (const visualCase of visualCases) {
  test(`matches the Angular Reader contents ${visualCase.name} authority`, async ({
    page,
    request
  }, testInfo) => {
    const problems = captureBrowserProblems(page)
    const forbidden: string[] = []
    const unexpectedBrowserDataRequests: string[] = []
    await page.route("**/*", route => {
      const browserRequest = route.request()
      const url = new URL(browserRequest.url())
      const label = `${browserRequest.method()} ${browserRequest.url()}`
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
        forbidden.push(label)
        return route.abort("blockedbyclient")
      }
      if (
        url.pathname.includes("/api/get_work_info") ||
        url.pathname.includes("/private-v2/") ||
        url.pathname.includes("/authors/resolve") ||
        url.pathname.startsWith("/nuxt-api/reader/")
      ) {
        unexpectedBrowserDataRequests.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(visualCase.route, { waitUntil: "networkidle" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body.focus.page-reading.ready")).toHaveCount(1)
    await expect(page.locator(".reader-primary-loading, .reader-primary-error")).toHaveCount(0)
    await expect(page.locator(".reader_main .etext.txt")).toContainText("DOKTOR GLAS")
    await expect(page.locator(".reader_main .etext.txt")).toContainText("HJALMAR SÖDERBERG")

    const context = page.locator("#toolkit-right .reader-context")
    await expect(context).toHaveCount(1)
    await expect(context.locator(":scope > div:first-child > .author > a"))
      .toHaveAttribute("href", encodeURI("/författare/SöderbergH"))
    await expect(context.locator(":scope > div:first-child")).toContainText(
      "Doktor Glas delar (1905)"
    )
    const currentPart = context.locator(".current_part")
    await expect(currentPart.locator(".navtitle")).toHaveText("Överlappningen")
    await expect(currentPart.locator(".header")).toContainText("Rilke, Shelley")
    await expect(currentPart.locator(".header > a").filter({ hasText: "Rilke" }))
      .toHaveAttribute("href", encodeURI("/författare/RilkeRM"))
    await expect(currentPart.locator(".header > a").filter({ hasText: "Shelley" }))
      .toHaveAttribute("href", encodeURI("/författare/ShelleyPB"))
    await expect(page.locator('meta[name="part"]')).toHaveAttribute("content", "overlap")

    const navigation = context.locator(".reader-navigation")
    const expectedNavigation = [
      ["Gå bakåt en del", "-3"],
      ["Gå till nästa del", "3"],
      ["Gå till första sidan", "-3"],
      ["Gå till sista sidan", "5"]
    ] as const
    for (const [label, pageName] of expectedNavigation) {
      const link = navigation.locator("a").filter({ hasText: label })
      await expect(link).toHaveAttribute("href", `${basePageHref}/${pageName}/etext`)
      await expect(link).not.toHaveClass(/\bdisabled\b/u)
      await expect(link).not.toHaveAttribute("aria-disabled", "true")
    }
    await expect(context.locator(".reader-page-position")).toHaveText("-2 av 9")
    await expect(context.locator(".subnav a").filter({ hasText: "Innehållsförteckning" }))
      .toHaveAttribute(
        "href",
        `${basePageHref}/-2/etext?innehall`
      )

    const dialog = page.getByRole("dialog", { name: "Innehållsförteckning" })
    const chaptersWindow = page.locator(".modal.chapters")
    if (visualCase.open) {
      await expect(page).toHaveURL(`${readerPath}?innehall`)
      await expect(dialog).toHaveCount(1)
      await expect(chaptersWindow).toHaveCount(1)
      await expect(chaptersWindow).toBeVisible()
      await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
      await expect(page.locator(".modal-backdrop")).toHaveCount(1)
      await expect(page.locator(".modal-backdrop")).toHaveClass(/\bin\b/u)
      await expect(page.locator(".chapters-modal .header h2.author"))
        .toHaveText("Hjalmar Söderberg")
      await expect(page.locator(".chapters-modal .header h2.title"))
        .toHaveText("Doktor Glas delar. Roman (1905)")
      const closeButton = page.locator(".chapters-modal button.close_btn")
      const dialogPanel = page.locator(".modal.chapters .modal-content")
      await expect(closeButton).toHaveText("Stäng")
      await expect(dialogPanel).toBeFocused()
      await expect(closeButton).not.toBeFocused()

      const rows = page.locator(".chapters-modal .part_menu > li")
      await expect(rows).toHaveCount(5)
      await expect(rows.locator(":scope > span.title > a")).toHaveText([
        "Yttre delen",
        "Mellandelen",
        "Överlappningen",
        "Senare delen",
        "Samma start"
      ])
      const expectedAuthors = [
        ["Söderberg"],
        ["Mörike"],
        ["Rilke", "Shelley"],
        ["Söderberg"],
        ["Mörike"]
      ]
      expect(await rows.evaluateAll(elements => elements.map(element =>
        [...element.querySelectorAll("span.author > a")].map(author =>
          (author.textContent || "").trim()
        )
      ))).toEqual(expectedAuthors)
      const expectedPartStarts = ["-4", "-3", "-2", "3", "3"]
      for (const [index, pageName] of expectedPartStarts.entries()) {
        await expect(rows.nth(index).locator(":scope > span.title > a")).toHaveAttribute(
          "href",
          `${basePageHref}/${pageName}/etext`
        )
      }
      const expectedAuthorHrefs = [
        "/författare/SöderbergH",
        "/författare/MörikeE",
        "/författare/RilkeRM",
        "/författare/ShelleyPB",
        "/författare/SöderbergH",
        "/författare/MörikeE"
      ].map(href => encodeURI(href))
      const authorLinks = rows.locator("span.author > a")
      await expect(authorLinks).toHaveCount(expectedAuthorHrefs.length)
      for (const [index, href] of expectedAuthorHrefs.entries()) {
        await expect(authorLinks.nth(index)).toHaveAttribute("href", href)
      }
    } else {
      await expect(dialog).toHaveCount(0)
      await expect(chaptersWindow).toHaveCount(0)
      await expect(page.locator("body")).not.toHaveClass(/\bmodal-open\b/u)
      await expect(page.locator(".modal-backdrop")).toHaveCount(0)
    }

    const recorded = await readerRequests(request)
    const ornamentRequest = "/bilder/ornament/reader-fixture.png"
    // Hydration retains the server-rendered managed HTML, so the browser owns one image request.
    expect(recorded.filter(requestPath => requestPath === ornamentRequest)).toEqual([
      ornamentRequest
    ])
    expect(recorded).toEqual([
      "/txt/lb-reader-doktor-glas-parts/res_00003.html?username=app",
      "/red/css/etext.css",
      "/txt/css/lb-reader-doktor-glas-parts-etext.css",
      ornamentRequest
    ])
    expect(await fixtureRequests(request)).toEqual({
      html: ["/txt/lb-reader-doktor-glas-parts/res_00003.html?username=app"],
      jpeg: [],
      metadata: [],
      ocr: []
    })
    expect(await requestLedger(request, "_reader_manifest_requests")).toEqual([
      "/v2/works/S%C3%B6derbergH/DoktorGlasParts/manifest?media_type=etext"
    ])
    expect(await requestLedger(request, "_editor_manifest_requests")).toEqual([])
    expect(await readerHitRequests(request)).toEqual([])
    expect(await authorResolveRequests(request)).toEqual([])
    expect(unexpectedBrowserDataRequests).toEqual([])

    await waitForVisualAssets(page)
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
    expect(await page.locator("img").evaluateAll(images => images.every(image => image.complete)))
      .toBe(true)
    await expect(page.locator("html")).toHaveCSS("background-image", "none")
    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`reader-contents-${visualCase.name}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      // Navigation links preserve their glyph layout with a 24px touch floor.
      // The desktop dialog additionally keeps the shared visible focus shadow.
      maxDiffPixels: visualCase.open && device === "desktop" ? 11_000 : 1_500
    })
    if (visualCase.open) {
      const closeButton = page.locator(".chapters-modal button.close_btn")
      await page.keyboard.press("Tab")
      await expect(closeButton).toBeFocused()
      expect(await closeButton.evaluate(element => getComputedStyle(element).outlineStyle))
        .not.toBe("none")
    }
    expect(forbidden).toEqual([])
    expect(unexpectedBrowserDataRequests).toEqual([])
    expect(problems).toEqual([])
  })
}
