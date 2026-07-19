import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const nuxtPort = Number(process.env.LITTB_NUXT_TEST_PORT || 3000)
const nuxtOrigin = `http://127.0.0.1:${nuxtPort}`
const normalPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const dramaPath = "/författare/AlmlöfN/titlar/Affarer/sida/-2/faksimil"
const longPath = "/författare/LongErrataA/titlar/LongErrata/sida/-2/etext"

const existingClosedReaderBaselineManifest = {
  "reader-hit-ordinary-desktop.png":
    "cd159a40e3240784a49e26c66a84e7596c160fe8c0a2049fa7d99482d7dacae2",
  "reader-hit-ordinary-mobile.png":
    "6704cc0c2c0f45fe911f6fa2423613205571af744fdbf0cea79884cef5e2527c"
} as const

const sourceInfoAuthorityManifest = {
  "reader-source-info-closed-normal-desktop.png":
    "e5b3aed6ba6af962d2423fb051d0566d52267496440a323b530fcb4474b6f277",
  "reader-source-info-closed-normal-mobile.png":
    "aa018756f1acb71859c3136f0fdf976d3800a9cfbaa56970c0646b1c205c7da0",
  "reader-source-info-drama-desktop.png":
    "9ace3926c9db776928e780d6ac528c207607ddbc45052775567e192f60411240",
  "reader-source-info-drama-mobile.png":
    "f424aea770cac3e39ff29c1f6ebb49e7d78cd772696036ef8ee51565fbdd484e",
  "reader-source-info-long-scroll-desktop.png":
    "0bf9fe7d4169ec7e1c82a5a00a6cc1eed946f34fb6d699469f8043536e780c3d",
  "reader-source-info-long-scroll-mobile.png":
    "4e15c928787c04f94d76adad78c79e6864ea8735919dac51c542095d45ae02f4",
  "reader-source-info-normal-desktop.png":
    "b8dabc1a4e880f2380280d592a90c50516fe19dbb9d6587a28ebf14b9719a1dc",
  "reader-source-info-normal-mobile.png":
    "4d7759b0f7bc1edbc02d7a4654c489f48cc464b380a6d6063c26cd179c000a57"
} as const

type SourceInfoRequest = {
  scope: "private" | "public"
  path: string
  query: string
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex")
}

async function assertBaselineManifest(manifest: Record<string, string>) {
  const directory = resolve(import.meta.dirname, "../visual/baselines")
  for (const [filename, expectedHash] of Object.entries(manifest)) {
    expect(sha256(await readFile(resolve(directory, filename))), filename).toBe(expectedHash)
  }
}

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`),
    request.delete(`${fixture}/_reader_ocr_requests`),
    request.delete(`${fixture}/_reader_jpeg_requests`),
    request.delete(`${fixture}/_reader_hit_requests`),
    request.delete(`${fixture}/_source_info_requests`),
    request.delete(`${fixture}/_source_info_static_requests`),
    request.delete(`${fixture}/_source_info_failure`),
    request.delete(`${fixture}/_source_info_delays`),
    request.delete(`${fixture}/_source_info_static_failure`)
  ])
}

async function sourceInfoRequests(request: APIRequestContext): Promise<SourceInfoRequest[]> {
  return (await (await request.get(`${fixture}/_source_info_requests`)).json()).requests
}

async function fixtureRequests(request: APIRequestContext, ledger: string): Promise<string[]> {
  return (await (await request.get(`${fixture}/${ledger}`)).json()).requests
}

function captureBrowserProblems(page: Page) {
  const problems: string[] = []
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("response", response => {
    if (response.status() >= 400) {
      problems.push(
        `response ${response.status()}: ${response.request().method()} ${response.url()}`
      )
    }
  })
  page.on("requestfailed", request => {
    const failure = request.failure()?.errorText ?? "unknown failure"
    if (!failure.includes("ERR_ABORTED")) {
      problems.push(`requestfailed: ${request.method()} ${request.url()} (${failure})`)
    }
  })
  return problems
}

function isRegisteredNuxtAsset(url: URL) {
  if (!url.pathname.startsWith("/_nuxt/")) return false
  if (url.search === "") return true
  if (url.searchParams.size === 1) {
    const version = url.searchParams.get("v") ?? ""
    if (/^[a-f0-9]{8}$/u.test(version) && /\.m?js$/u.test(url.pathname)) return true
    if (
      version === "4.4.0"
      && /\/font-awesome\/fonts\/fontawesome-webfont\.(?:ttf|woff2?)$/u.test(url.pathname)
    ) return true
  }
  if (
    url.searchParams.size === 1
    && url.searchParams.get("macro") === "true"
    && /\.(?:js|ts|vue)$/u.test(url.pathname)
  ) return true
  if (
    url.searchParams.size === 1
    && url.searchParams.has("import")
    && url.searchParams.get("import") === ""
    && /\.(?:gif|jpe?g|png|svg|webp)$/u.test(url.pathname)
  ) return true

  const componentName = /\/([A-Z][A-Za-z0-9]*)\.vue$/u.exec(url.pathname)?.[1]
  if (
    componentName
    && url.searchParams.size === 3
    && url.searchParams.get("nuxt_component") === "async"
    && url.searchParams.get("nuxt_component_name") === componentName
    && url.searchParams.get("nuxt_component_export") === "default"
  ) return true

  const styleQueryKeys = ["vue", "type", "index", "scoped", "lang.css"]
  return url.pathname.endsWith(".vue")
    && url.searchParams.size === styleQueryKeys.length
    && styleQueryKeys.every(key => url.searchParams.has(key))
    && url.searchParams.get("vue") === ""
    && url.searchParams.get("type") === "style"
    && /^\d+$/u.test(url.searchParams.get("index") ?? "")
    && /^[a-f0-9]{8}$/u.test(url.searchParams.get("scoped") ?? "")
    && url.searchParams.get("lang.css") === ""
}

function isRegisteredBrowserRequest(url: URL, route: string, method: string) {
  if (method !== "GET" || url.origin !== nuxtOrigin) return false
  const expectedDocument = new URL(route, nuxtOrigin)
  if (
    url.pathname === expectedDocument.pathname &&
    url.search === expectedDocument.search
  ) return true
  if (isRegisteredNuxtAsset(url)) return true
  return url.search === "" && [
    /^\/red\/css\/etext\.css$/u,
    /^\/txt\/css\/(?:lb-reader-doktor-glas|lb31230|lbLongErrata1)-etext\.css$/u,
    /^\/bilder\/ornament\/reader-fixture\.png$/u,
    /^\/txt\/(lb1728740|lb31230|lbLongErrata1)\/\1_(?:small|large)\.jpeg$/u,
    /^\/txt\/lb31230\/lb31230_([1-5])\/lb31230_\1_000[12]\.jpeg$/u,
    /^\/red\/bilder\/gemensamt\/(?:gublogga|kblogga|cc-128x128|cc0-128x128|cc-pd-128x128)\.png$/u,
    /^\/red\/bilder\/gemensamt\/dramawebben_svart\.svg$/u,
    /^\/favicon\.ico$/u
  ].some(pattern => pattern.test(url.pathname))
}

async function waitForVisualState(page: Page) {
  await waitForVisualAssets(page)
  await page.waitForTimeout(350)
  await page.waitForFunction(() => document.fonts.status === "loaded")
  expect(await page.locator("img").evaluateAll(images => images.every(image => image.complete)))
    .toBe(true)
}

test.beforeAll(async () => {
  await assertBaselineManifest(existingClosedReaderBaselineManifest)
  await assertBaselineManifest(sourceInfoAuthorityManifest)
  expect(isRegisteredBrowserRequest(
    new URL(normalPath, nuxtOrigin),
    normalPath,
    "GET"
  )).toBe(true)
  expect(isRegisteredBrowserRequest(
    new URL(normalPath, `http://127.0.0.1:${nuxtPort + 1}`),
    normalPath,
    "GET"
  )).toBe(false)
  expect(isRegisteredBrowserRequest(
    new URL("/red/css/etext.css?unexpected=1", nuxtOrigin),
    normalPath,
    "GET"
  )).toBe(false)
  expect(isRegisteredBrowserRequest(
    new URL("/favicon.ico?unexpected=1", nuxtOrigin),
    normalPath,
    "GET"
  )).toBe(false)
  expect(isRegisteredBrowserRequest(
    new URL("/_nuxt/app.js?unexpected=1", nuxtOrigin),
    normalPath,
    "GET"
  )).toBe(false)
  expect(isRegisteredBrowserRequest(
    new URL("/txt/lb1728740/unexpected.jpeg", nuxtOrigin),
    normalPath,
    "GET"
  )).toBe(false)
  expect(isRegisteredBrowserRequest(
    new URL("/red/bilder/gemensamt/unexpected.svg", nuxtOrigin),
    normalPath,
    "GET"
  )).toBe(false)
})

test.afterAll(async () => {
  await assertBaselineManifest(existingClosedReaderBaselineManifest)
  await assertBaselineManifest(sourceInfoAuthorityManifest)
})

test.beforeEach(async ({ request }) => resetReader(request))
test.afterEach(async ({ request }) => resetReader(request))

const visualCases = [
  {
    name: "closed-normal",
    route: normalPath,
    mode: "closed",
    sourceRequest: null
  },
  {
    name: "normal",
    route: `${normalPath}?om-boken`,
    mode: "normal",
    sourceRequest: {
      scope: "private",
      path: "/private-v2/works/S%C3%B6derbergH/DoktorGlas/source-info",
      query: "?media_type=etext"
    }
  },
  {
    name: "drama",
    route: `${dramaPath}?om-boken`,
    mode: "drama",
    sourceRequest: {
      scope: "private",
      path: "/private-v2/works/Alml%C3%B6fN/Affarer/source-info",
      query: "?media_type=faksimil"
    }
  },
  {
    name: "long-scroll",
    route: `${longPath}?om-boken`,
    mode: "long-scroll",
    sourceRequest: {
      scope: "private",
      path: "/private-v2/works/LongErrataA/LongErrata/source-info",
      query: "?media_type=etext"
    }
  }
] as const

for (const visualCase of visualCases) {
  test(`matches the Angular Reader source-info ${visualCase.name} authority`, async ({
    page,
    request
  }, testInfo) => {
    const problems = captureBrowserProblems(page)
    const forbidden: string[] = []
    const unexpectedBrowserTraffic: string[] = []
    await page.route("**/*", route => {
      const browserRequest = route.request()
      const url = new URL(browserRequest.url())
      const label = `${browserRequest.method()} ${browserRequest.url()}`
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
        forbidden.push(label)
        return route.abort("blockedbyclient")
      }
      if (!isRegisteredBrowserRequest(url, visualCase.route, browserRequest.method())) {
        unexpectedBrowserTraffic.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(visualCase.route, { waitUntil: "networkidle" })
    expect(response?.status()).toBe(200)
    if (visualCase.mode === "long-scroll") {
      const serverHtml = await response!.text()
      expect(serverHtml).toContain(
        '<div class="sourcedesc"><p>En utförlig källbeskrivning för den långa granskningsbilden.</p>'
      )
      expect(serverHtml).toContain(
        '<p>Den tredje paragrafen gör scrolläget entydigt även på desktop.</p></div>'
      )
    }
    await expect(page.locator("body.focus.page-reading.ready")).toHaveCount(1)
    await expect(page.locator(".reader-primary-loading, .reader-primary-error")).toHaveCount(0)
    await waitForVisualState(page)
    await expect(page.locator("html")).toHaveCSS("background-image", "none")

    const modal = page.locator(".modal.about")
    const dialog = page.getByRole("dialog", { name: "Om boken" })
    const backdrop = page.locator(".modal.about .modal-backdrop")
    const isMobile = testInfo.project.name === "mobile-chromium"

    if (visualCase.mode === "closed") {
      await expect(modal).toHaveCount(0)
      await expect(dialog).toHaveCount(0)
      await expect(backdrop).toHaveCount(0)
      await expect(page.locator("body")).not.toHaveClass(/\bmodal-open\b/u)
      for (const corridor of ["#leftCorridor", "#mainview", "#rightCorridor"]) {
        await expect(page.locator(corridor)).toHaveCSS("filter", "none")
      }
      if (isMobile) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeGreaterThan(390)
      }
    } else {
      await expect(modal).toBeVisible()
      await expect(dialog).toHaveCount(1)
      await expect(backdrop).toHaveCount(1)
      await expect(backdrop).toHaveClass(/\bin\b/u)
      await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
      await expect(dialog.locator(".modal-content")).toHaveCSS("background-color", "rgb(255, 255, 255)")
      await expect(dialog.locator(".modal-content")).toHaveCSS("border-radius", "0px")
      expect(await dialog.locator(".modal-content").evaluate(element =>
        getComputedStyle(element).boxShadow
      )).not.toBe("none")
      await expect(dialog.locator("button.close_btn")).toHaveText("Stäng")
      const activeElement = await page.evaluate(() => {
        if (document.activeElement === document.querySelector(".modal.about")) {
          return ".modal.about"
        }
        if (document.activeElement?.matches("button.close_btn")) return "button.close_btn"
        return document.activeElement?.tagName.toLowerCase() ?? null
      })
      expect.soft(activeElement, "Angular focus authority").toBe(".modal.about")
      await expect.poll(() => page.evaluate(() => [
        getComputedStyle(document.documentElement).overflow,
        getComputedStyle(document.body).overflow
      ])).toContain("hidden")
      for (const corridor of ["#leftCorridor", "#mainview", "#rightCorridor"]) {
        await expect(page.locator(corridor)).toHaveCSS("filter", "blur(4px)")
      }

      const box = await dialog.locator(".modal-dialog").boundingBox()
      expect(box).not.toBeNull()
      if (isMobile) {
        expect(box!.width).toBeGreaterThan(300)
        expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
        await expect(backdrop).toBeHidden()
        await expect(page.locator("#mainview")).toBeHidden()
        await expect(page.locator("#leftCorridor")).toBeHidden()
        await expect(page.locator("body")).toHaveCSS("background-color", "rgb(51, 51, 51)")
        await expect(dialog.locator(".columns")).toHaveCSS("display", "flex")
      } else {
        expect(box!.width).toBeGreaterThanOrEqual(590)
        expect(box!.width).toBeLessThanOrEqual(610)
        expect(box!.y).toBeGreaterThanOrEqual(45)
        expect(box!.y).toBeLessThanOrEqual(55)
        await expect(backdrop).toBeVisible()
      }

      await expect(dialog.locator(".col_right img")).toHaveAttribute("width", "200")
      if (visualCase.mode === "normal") {
        await expect(dialog.locator("h2.author")).toContainText("Hjalmar Söderberg")
        await expect(dialog.locator("h2.title")).toHaveText("Doktor Glas. Roman")
        await expect(dialog.locator(".sourcedesc")).toHaveText(
          "Albert Bonniers förlag, Stockholm 1905."
        )
        await expect(dialog.locator(".provenance")).toHaveCount(1)
        await expect(dialog.locator(".errata_table tr")).toHaveCount(2)
      } else if (visualCase.mode === "drama") {
        await expect(dialog.locator("h2.author")).toContainText("Nils Almlöf")
        await expect(dialog.locator("h2.title")).toHaveText("Affärer")
        await expect(dialog.locator(".sourcedesc")).toHaveText("Stockholm, 1871.")
        await expect(dialog).toContainText("Ulrika Lindgren")
        await expect(dialog.locator(".dramaweb .heading")).toHaveText([
          "Rollista",
          "Teaterkritik"
        ])
        await expect(dialog.locator(".dw_logo, .introheader")).toHaveCount(0)
        await expect(dialog.locator(".provenance")).toHaveCount(2)
      } else {
        await expect(dialog.locator("h2.title")).toHaveText("Lång errata")
        await expect(dialog.locator(".sourcedesc")).toContainText(
          "En utförlig källbeskrivning för den långa granskningsbilden."
        )
        await expect(dialog.locator(".workintro")).toContainText(
          "Detta är en längre redaktionell inledning."
        )
        await expect(dialog).toContainText("Dramawebbens redaktion")
        await expect(dialog.locator(".provenance")).toHaveCount(3)
        await expect(dialog.locator(".errata_table tr")).toHaveCount(8)
        await dialog.getByRole("button", { name: "Visa fler" }).click()
        await expect(dialog.locator(".errata_table tr")).toHaveCount(10)
        await modal.evaluate(element => element.scrollTop = element.scrollHeight)
        const scroll = await modal.evaluate(element => ({
          scrollTop: element.scrollTop,
          maximum: element.scrollHeight - element.clientHeight
        }))
        expect(scroll.maximum).toBeGreaterThanOrEqual(0)
        expect(scroll.scrollTop).toBe(scroll.maximum)
      }
    }

    expect(await fixtureRequests(request, "_reader_metadata_requests")).toHaveLength(1)
    expect(await fixtureRequests(request, "_reader_html_requests")).toEqual(
      visualCase.mode === "drama"
        ? []
        : ["/txt/lb-reader-doktor-glas/res_00002.html?username=app"]
    )
    expect(await fixtureRequests(request, "_reader_ocr_requests")).toEqual([])
    const dramaScanSize = isMobile ? 5 : 3
    const dramaScan = `/txt/lb31230/lb31230_${dramaScanSize}`
      + `/lb31230_${dramaScanSize}_0001.jpeg`
    expect(await fixtureRequests(request, "_reader_jpeg_requests")).toEqual(
      visualCase.mode === "drama"
        ? [dramaScan, dramaScan]
        : []
    )
    expect(await fixtureRequests(request, "_reader_hit_requests")).toEqual([])
    expect(await sourceInfoRequests(request)).toEqual(
      visualCase.sourceRequest === null ? [] : [visualCase.sourceRequest]
    )
    const sourceStaticRequests = (
      await fixtureRequests(request, "_source_info_static_requests")
    ).sort()
    const sourceStaticPair = [
      "/red/etc/license/license.json",
      "/red/etc/provenance/provenance.json"
    ]
    if (visualCase.sourceRequest === null) {
      expect(sourceStaticRequests).toEqual([])
    } else {
      // Nuxt caches both static dictionaries across cases; a reset ledger therefore
      // records either the first exact pair or an exact cache hit with no requests.
      expect([[], sourceStaticPair]).toContainEqual(sourceStaticRequests)
    }
    expect(forbidden).toEqual([])
    expect(unexpectedBrowserTraffic).toEqual([])
    expect(problems).toEqual([])

    const device = isMobile ? "mobile" : "desktop"
    await expect.soft(page).toHaveScreenshot(
      `reader-source-info-${visualCase.name}-${device}.png`,
      {
        fullPage: true,
        animations: "disabled",
        caret: "hide",
        scale: "css",
        threshold: 0.1,
        maxDiffPixels: 100
      }
    )
  })
}
