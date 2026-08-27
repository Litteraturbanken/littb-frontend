import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixturePort = Number(process.env.LBAPI_FIXTURE_PORT || 4100)
const fixture = `http://127.0.0.1:${fixturePort}`
const svenskaEmbedPort = Number(
  process.env.LITTB_SVENSKA_EMBED_PORT || fixturePort + 2
)
const svenskaEmbedOrigin = `http://127.0.0.1:${svenskaEmbedPort}`
const nuxtOrigin = `http://127.0.0.1:${process.env.LITTB_NUXT_TEST_PORT || 3000}`
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const readerManifest = "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_editor_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_dictionary_requests`),
    request.delete(`${fixture}/_svenska_embed_requests`),
    request.delete(`${fixture}/_svenska_embed_scenarios`),
    request.delete(`${fixture}/_observability_requests`)
  ])
}

async function fixtureRequests<T = string>(
  request: APIRequestContext,
  ledger: string
): Promise<T[]> {
  return (await (await request.get(`${fixture}/${ledger}`)).json()).requests
}

type EmbedScenario = {
  autoPost: boolean
  dictionaries?: Array<"so" | "saob">
  event: "result" | "empty" | "error" | "silent"
  longContent: boolean
  requestIdOverride?: string
  selectedDictionary?: "so" | "saob"
  word: string
}

type EmbedRequest = {
  path: string
  referrer: string | null
  requestId: string
  word: string
}

async function configureEmbed(request: APIRequestContext, scenario: EmbedScenario) {
  const response = await request.put(`${fixture}/_svenska_embed_scenarios`, {
    data: scenario
  })
  expect(response.status()).toBe(200)
}

async function embedRequests(request: APIRequestContext): Promise<EmbedRequest[]> {
  return fixtureRequests<EmbedRequest>(request, "_svenska_embed_requests")
}

async function selectReaderWord(page: Page, word: string) {
  await page.locator(".reader_main .w").filter({ hasText: word }).first().evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
  })
}

async function openEmbed(page: Page, word: string) {
  await selectReaderWord(page, word)
  const indicator = page.getByRole("button", { name: `Slå upp ${word} i SO och SAOB` })
  await expect(indicator).toBeVisible()
  await indicator.click({ force: true })
  const frame = page.locator(`iframe[title="Slå upp ${word} i SO och SAOB"]`)
  await expect(frame).toBeVisible()
  return frame
}

test.beforeEach(async ({ page, request }) => {
  await resetReader(request)
  await page.addInitScript(() => {
    const scope = window as typeof window & { __copiedValues?: string[] }
    scope.__copiedValues = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          scope.__copiedValues?.push(value)
        }
      }
    })
    window.addEventListener("beforeunload", () => {
      sessionStorage.setItem("reader-production-reloaded", "1")
    })
    const sourceProofs: Array<{
      event: string | null
      origin: string
      requestId: string | null
      sourceMatches: boolean
    }> = []
    Object.assign(window, { __readerDictionarySourceProofs: sourceProofs })
    window.addEventListener("message", (event) => {
      if (event.data?.type !== "svenska-reader-lookup") return
      const frame = document.querySelector<HTMLIFrameElement>(
        ".reader-dictionary-embed__frame"
      )
      sourceProofs.push({
        event: typeof event.data.event === "string" ? event.data.event : null,
        origin: event.origin,
        requestId: typeof event.data.requestId === "string" ? event.data.requestId : null,
        sourceMatches: event.source === frame?.contentWindow
      })
    }, true)
  })
})
test.afterEach(async ({ request }) => {
  expect(await fixtureRequests(request, "_reader_metadata_requests")).toEqual([])
  expect(await fixtureRequests(request, "_editor_manifest_requests")).toEqual([])
  expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
})

test.describe("desktop Reader production", () => {
test.skip(({ isMobile }) => Boolean(isMobile))

test("dot-page manifests fail as controlled Reader errors before page asset work", async ({
  page,
  request
}) => {
  const manifestPath = "/v2/works/S%C3%B6derbergH/DotPageReader/manifest?media_type=etext"
  const apiPath = "/nuxt-api/reader/S%C3%B6derbergH/DotPageReader/1/etext"
  await Promise.all([
    "_reader_requests",
    "_reader_html_requests",
    "_reader_ocr_requests",
    "_reader_jpeg_requests"
  ].map(ledger => request.delete(`${fixture}/${ledger}`)))

  expect((await request.get(apiPath)).status()).toBe(502)
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([manifestPath])
  const pageAssetLedgers = [
    "_reader_requests",
    "_reader_html_requests",
    "_reader_ocr_requests",
    "_reader_jpeg_requests"
  ]
  for (const ledger of pageAssetLedgers) {
    expect(await fixtureRequests(request, ledger)).toEqual([])
  }

  await resetReader(request)
  expect((await page.goto(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DotPageReader/sida/1/etext"
  ))?.status()).toBe(502)
  await expect(page.locator(".reader-page")).toHaveCount(0)
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([manifestPath])
  for (const ledger of pageAssetLedgers) {
    expect(await fixtureRequests(request, ledger)).toEqual([])
  }
})

test("one selected Reader word accepts the result from the current cross-origin frame", async ({
  page,
  request
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const word = page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first()
  await word.dblclick()

  const indicator = page.getByRole("button", { name: "Slå upp DOKTOR i SO och SAOB" })
  await expect(indicator).toBeVisible()
  await indicator.click()

  const dialog = page.getByRole("dialog")
  const frame = dialog.locator('iframe[title="Slå upp DOKTOR i SO och SAOB"]')
  await expect(frame).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get("so"))
    .toBe("DOKTOR")
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin")
  await expect(frame).toHaveAttribute("referrerpolicy", "origin")
  const close = dialog.getByRole("button", { name: "Stäng" })
  await expect(close).toBeVisible()
  await expect(close).toBeFocused()
  await expect(frame.contentFrame().getByRole("tab", { name: "SO" })).toBeVisible()
  await expect(frame.contentFrame().getByRole("tab", { name: "SAOB" })).toBeVisible()
  await expect(frame.contentFrame().getByRole("tabpanel")).toContainText(
    "SO-artikel för DOKTOR"
  )
  await expect(dialog.getByRole("status")).toHaveCount(0)
  await frame.contentFrame().getByRole("tab", { name: "SAOB" }).click()
  await expect(frame.contentFrame().getByRole("tabpanel")).toContainText(
    "SAOB-artikel för DOKTOR"
  )
  const sourceProofs = await page.evaluate(() => (
    window as typeof window & {
      __readerDictionarySourceProofs?: Array<{ origin: string, sourceMatches: boolean }>
    }
  ).__readerDictionarySourceProofs)
  expect(sourceProofs).toHaveLength(2)
  expect(sourceProofs?.every(proof => (
    proof.origin === svenskaEmbedOrigin && proof.sourceMatches
  ))).toBe(true)
  await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
  await close.focus()
  const scrollBeforeClose = await page.evaluate(() => window.scrollY)
  await close.click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).searchParams.has("so"))
    .toBe(false)
  await expect(word).toBeFocused()
  await expect(word).toHaveAttribute("tabindex", "-1")
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeClose)
  await page.locator(".reader-work-search-trigger").focus()
  await expect(page.locator(".reader-work-search-trigger")).toBeFocused()
  await expect.poll(() => word.getAttribute("tabindex")).toBeNull()
  expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
  expect(await embedRequests(request)).toEqual([{
    path: "/embed/reader",
    referrer: `${nuxtOrigin}/`,
    requestId: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
    ),
    word: "DOKTOR"
  }])
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})

test("an authenticated Escape request from the active dictionary frame closes the modal", async ({
  page
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const word = page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first()
  const frame = await openEmbed(page, "DOKTOR")
  const src = await frame.getAttribute("src")
  expect(src).not.toBeNull()
  const requestId = new URL(src!).searchParams.get("requestId")
  expect(requestId).not.toBeNull()
  await expect(frame.contentFrame().getByRole("tabpanel")).toContainText(
    "SO-artikel för DOKTOR"
  )

  await frame.contentFrame().locator("body").evaluate((_, payload) => {
    window.parent.postMessage({
      type: "svenska-reader-lookup",
      version: 1,
      requestId: payload.requestId,
      event: "close"
    }, payload.parentOrigin)
  }, { parentOrigin: nuxtOrigin, requestId })

  await expect(page.locator(".reader-dictionary-modal")).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).searchParams.has("so"))
    .toBe(false)
  await expect(word).toBeFocused()
})

test("the embed fixture renders hostile words as text without script or markup injection", async ({
  page,
  request
}) => {
  const word = '</section><img id="embed-injection" src=x onerror="window.injected=true">'
  const requestId = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e"
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.evaluate(({ requestId: id, sourceOrigin, value }) => {
    const url = new URL("/svenska-embed/reader", sourceOrigin)
    url.searchParams.set("word", value)
    url.searchParams.set("requestId", id)
    const frame = document.createElement("iframe")
    frame.id = "embed-escape-probe"
    frame.src = url.toString()
    document.body.append(frame)
  }, { requestId, sourceOrigin: fixture, value: word })

  const frame = page.locator("#embed-escape-probe")
  await expect(frame.contentFrame().getByRole("tabpanel"))
    .toContainText(`SO-artikel för ${word}`)
  await expect(frame.contentFrame().locator("#embed-injection, img")).toHaveCount(0)
  expect(await frame.contentFrame().locator("body").evaluate(() => (
    (window as typeof window & { injected?: boolean }).injected
  ))).toBeUndefined()
  expect(await embedRequests(request)).toEqual([{
    path: "/svenska-embed/reader",
    referrer: `${nuxtOrigin}/`,
    requestId,
    word
  }])
})

test("a collapsed OCR double-click recovers the nested Reader word without a stale timer", async ({
  page,
  request
}) => {
  await page.addInitScript(() => {
    document.addEventListener("dblclick", () => {
      window.getSelection()?.removeAllRanges()
    }, true)
  })
  await page.goto(
    "/författare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil",
    { waitUntil: "networkidle" }
  )
  const ocrWord = page.locator(".reader_main .w").filter({ hasText: "Boye OCR" })
  await ocrWord.evaluate(element => {
    element.innerHTML = '<span id="reported-nested-ocr-word"> verkligt </span>'
  })

  await page.clock.install()
  await page.locator(".reader_main #reported-nested-ocr-word").dblclick()

  const indicator = page.getByRole("button", { name: "Slå upp verkligt i SO och SAOB" })
  await expect(indicator).toBeVisible()
  await page.clock.fastForward(650)
  await expect(indicator).toBeVisible()
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    "/v2/works/BoyeK/EttVerkligtJordiskt/manifest?media_type=faksimil"
  ])
})

test("manual one-word selection retains delayed mouseup inspection", async ({
  page,
  request
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first().evaluate(word => {
    const range = document.createRange()
    range.selectNodeContents(word)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    word.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
  })

  await expect(page.getByRole("button", { name: "Slå upp DOKTOR i SO och SAOB" }))
    .toBeVisible()
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})

test("a keyboard-created Reader selection exposes the dictionary action", async ({
  page,
  request
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first().evaluate(word => {
    const range = document.createRange()
    range.selectNodeContents(word)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new KeyboardEvent("keyup", {
      bubbles: true,
      key: "ArrowRight",
      shiftKey: true
    }))
  })

  const indicator = page.getByRole("button", { name: "Slå upp DOKTOR i SO och SAOB" })
  await expect(indicator).toBeVisible()
  await indicator.focus()
  await expect(indicator).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.locator('iframe[title="Slå upp DOKTOR i SO och SAOB"]'))
    .toBeVisible()
  expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})

test("a SAOB-only result selects and renders the SAOB tab", async ({
  page,
  request
}) => {
  await configureEmbed(request, {
    autoPost: true,
    dictionaries: ["saob"],
    event: "result",
    longContent: false,
    selectedDictionary: "saob",
    word: "DOKTOR"
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const frame = await openEmbed(page, "DOKTOR")

  await expect(frame.contentFrame().getByRole("tab", { name: "SAOB" }))
    .toHaveAttribute("aria-selected", "true")
  await expect(frame.contentFrame().getByRole("tab", { name: "SO" })).toHaveCount(0)
  await expect(frame.contentFrame().getByRole("tabpanel"))
    .toContainText("SAOB-artikel för DOKTOR")
  expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})

test("an SO-only result renders no undeclared SAOB tab", async ({ page, request }) => {
  await configureEmbed(request, {
    autoPost: true,
    dictionaries: ["so"],
    event: "result",
    longContent: false,
    selectedDictionary: "so",
    word: "DOKTOR"
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const frame = await openEmbed(page, "DOKTOR")

  await expect(frame.contentFrame().getByRole("tab", { name: "SO" }))
    .toHaveAttribute("aria-selected", "true")
  await expect(frame.contentFrame().getByRole("tab", { name: "SAOB" })).toHaveCount(0)
  await expect(frame.contentFrame().getByRole("tabpanel"))
    .toContainText("SO-artikel för DOKTOR")
})

test("a newer dictionary lookup replaces the active session before its late result", async ({
  page,
  request
}) => {
  await configureEmbed(request, {
    autoPost: false,
    dictionaries: ["so", "saob"],
    event: "result",
    longContent: false,
    selectedDictionary: "so",
    word: "DOKTOR"
  })
  await configureEmbed(request, {
    autoPost: false,
    dictionaries: ["saob"],
    event: "result",
    longContent: false,
    selectedDictionary: "saob",
    word: "GLAS"
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const first = await openEmbed(page, "DOKTOR")
  await expect(page.getByRole("status")).toHaveText("Laddar ordboken…")
  const firstRequestId = new URL((await first.getAttribute("src"))!)
    .searchParams.get("requestId")!
  await first.contentFrame().locator("body").evaluate(() => {
    const requestId = new URL(window.location.href).searchParams.get("requestId")!
    const parentOrigin = new URL(document.referrer).origin
    window.addEventListener("beforeunload", () => {
      parent.postMessage({
        type: "svenska-reader-lookup",
        version: 1,
        requestId,
        event: "result",
        dictionaries: ["so", "saob"],
        selectedDictionary: "so"
      }, parentOrigin)
    }, { once: true })
  })

  await selectReaderWord(page, "GLAS")
  const nextIndicator = page.getByRole("button", { name: "Slå upp GLAS i SO och SAOB" })
  await expect(nextIndicator).toBeVisible()
  // Headless UI makes the Reader background inert while the modal is open. Invoke the
  // rendered indicator in-page to exercise the component's real replacement path.
  await nextIndicator.evaluate((button: HTMLButtonElement) => button.click())
  const second = page.locator('iframe[title="Slå upp GLAS i SO och SAOB"]')

  await expect.poll(() => page.evaluate((requestId) => (
    (window as typeof window & {
      __readerDictionarySourceProofs?: Array<{
        event: string | null
        requestId: string | null
        sourceMatches: boolean
      }>
    }).__readerDictionarySourceProofs?.some(proof => (
      proof.event === "result"
      && proof.requestId === requestId
      && proof.sourceMatches
    )) ?? false
  ), firstRequestId)).toBe(true)
  await expect(page.getByRole("status")).toHaveText("Laddar ordboken…")
  await second.contentFrame().getByRole("button", { name: "Skicka svar" }).click()

  await expect(second.contentFrame().getByRole("tabpanel"))
    .toContainText("SAOB-artikel för GLAS")
  await expect(page.getByRole("status")).toHaveCount(0)
  await expect(page.locator('iframe[title*="DOKTOR"]')).toHaveCount(0)
  expect((await embedRequests(request)).map(entry => entry.word)).toEqual(["DOKTOR", "GLAS"])
  expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})

test("a trusted sibling frame cannot answer for the current dictionary frame", async ({
  page,
  request
}) => {
  await configureEmbed(request, {
    autoPost: false,
    dictionaries: ["so", "saob"],
    event: "result",
    longContent: false,
    selectedDictionary: "so",
    word: "DOKTOR"
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const currentFrame = await openEmbed(page, "DOKTOR")
  const requestId = new URL((await currentFrame.getAttribute("src"))!)
    .searchParams.get("requestId")!

  await page.evaluate(({ activeRequestId, sourceOrigin }) => {
    const url = new URL("/embed/reader", sourceOrigin)
    url.searchParams.set("word", "SIBLING")
    url.searchParams.set("requestId", activeRequestId)
    const sibling = document.createElement("iframe")
    sibling.id = "trusted-sibling-frame"
    sibling.src = url.toString()
    document.body.append(sibling)
  }, { activeRequestId: requestId, sourceOrigin: fixture })
  await expect.poll(() => page.evaluate((activeRequestId) => (
    (window as typeof window & {
      __readerDictionarySourceProofs?: Array<{
        event: string | null
        requestId: string | null
        sourceMatches: boolean
      }>
    }).__readerDictionarySourceProofs?.some(proof => (
      proof.event === "result"
      && proof.requestId === activeRequestId
      && !proof.sourceMatches
    )) ?? false
  ), requestId)).toBe(true)

  await expect(page.getByRole("status")).toHaveText("Laddar ordboken…")
  await currentFrame.contentFrame().getByRole("button", { name: "Skicka svar" }).click()
  await expect(page.getByRole("status")).toHaveCount(0)
})

test("route changes invalidate a pending dictionary lookup", async ({ page, request }) => {
  await configureEmbed(request, {
    autoPost: false,
    event: "silent",
    longContent: false,
    word: "DOKTOR"
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.clock.install()

  await openEmbed(page, "DOKTOR")
  await expect(page.getByRole("status")).toHaveText("Laddar ordboken…")
  await page.locator('a[href*="om-boken"]').first().evaluate((link: HTMLAnchorElement) => {
    link.click()
  })
  await expect(page).toHaveURL(`${readerPath}?om-boken`)

  await expect(page.locator(".reader-dictionary-modal")).toHaveCount(0)
  await expect(page.locator('iframe[title="Slå upp DOKTOR i SO och SAOB"]')).toHaveCount(0)
  await expect(page.locator(".modal.about")).toBeVisible()
  await expect(page.getByRole("dialog")).toContainText("Om boken")
  await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
  await page.clock.fastForward(8_500)
  const observability = await (await request.get(
    `${fixture}/_observability_requests`
  )).json() as { requests: Array<{ events: Array<{ outcome?: string }> }> }
  expect(observability.requests.flatMap(entry => entry.events))
    .not.toContainEqual(expect.objectContaining({ outcome: "timeout" }))
  expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})

for (const [name, scenario, message] of [
  [
    "empty",
    { autoPost: true, event: "empty", longContent: false, word: "DOKTOR" },
    "Hittade inget uppslag"
  ],
  [
    "child error",
    { autoPost: true, event: "error", longContent: false, word: "DOKTOR" },
    "Ordboken kunde inte laddas"
  ]
] as const) {
  test(`${name} keeps the child state visible and offers the full dictionary`, async ({
    page,
    request
  }) => {
    await configureEmbed(request, scenario)
    await page.goto(readerPath, { waitUntil: "networkidle" })

    const frame = await openEmbed(page, "DOKTOR")

    await expect(page.getByRole("status")).toHaveText(message)
    await expect(frame).toBeVisible()
    await expect(frame.contentFrame().getByRole("tabpanel")).toHaveText(message)
    await expect(page.getByRole("link", {
      name: "Öppna uppslaget på Svenska Akademiens ordbokssida"
    })).toHaveAttribute(
      "href",
      `${svenskaEmbedOrigin}/?q=DOKTOR&activeTab=alla&exactMatch=true`
    )
    expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
  })
}

test("a silent child reaches timeout through the Reader clock", async ({ page, request }) => {
  await configureEmbed(request, {
    autoPost: false,
    event: "silent",
    longContent: false,
    word: "DOKTOR"
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.clock.install()

  const frame = await openEmbed(page, "DOKTOR")
  await expect(page.getByRole("status")).toHaveText("Laddar ordboken…")
  await page.clock.fastForward(8_001)

  await expect(page.getByRole("status")).toHaveText("Ordboken kunde inte laddas")
  await expect(frame).toBeVisible()
  expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
})

test("the current frame cannot finish an active lookup with a stale request id", async ({
  page,
  request
}) => {
  await configureEmbed(request, {
    autoPost: false,
    dictionaries: ["so", "saob"],
    event: "result",
    longContent: false,
    requestIdOverride: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e",
    selectedDictionary: "so",
    word: "DOKTOR"
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const frame = await openEmbed(page, "DOKTOR")

  await frame.contentFrame().getByRole("button", { name: "Skicka svar" }).click()
  await expect(page.getByRole("status")).toHaveText("Laddar ordboken…")
  await frame.contentFrame().locator("body").evaluate(() => {
    const requestId = new URL(window.location.href).searchParams.get("requestId")!
    parent.postMessage({
      type: "svenska-reader-lookup",
      version: 1,
      requestId,
      event: "result",
      dictionaries: ["so", "saob"],
      selectedDictionary: "so"
    }, new URL(document.referrer).origin)
  })

  await expect(page.getByRole("status")).toHaveCount(0)
  expect((await page.evaluate(() => (
    window as typeof window & {
      __readerDictionarySourceProofs?: Array<{ sourceMatches: boolean }>
    }
  ).__readerDictionarySourceProofs))?.every(proof => proof.sourceMatches)).toBe(true)
  expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
})

test("a forged message from the parent origin cannot finish the lookup", async ({
  page,
  request
}) => {
  await configureEmbed(request, {
    autoPost: false,
    dictionaries: ["so", "saob"],
    event: "result",
    longContent: false,
    selectedDictionary: "so",
    word: "DOKTOR"
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  const frame = await openEmbed(page, "DOKTOR")
  const requestId = new URL((await frame.getAttribute("src"))!).searchParams.get("requestId")!

  await page.evaluate((activeRequestId) => new Promise<void>(resolve => {
    window.postMessage({
      type: "svenska-reader-lookup",
      version: 1,
      requestId: activeRequestId,
      event: "result",
      dictionaries: ["so", "saob"],
      selectedDictionary: "so"
    }, window.location.origin)
    requestAnimationFrame(() => resolve())
  }), requestId)

  await expect(page.getByRole("status")).toHaveText("Laddar ordboken…")
  await frame.contentFrame().getByRole("button", { name: "Skicka svar" }).click()
  await expect(page.getByRole("status")).toHaveCount(0)
  expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
})

test("double-clicking Reader whitespace clears stale selection and its pending inspection", async ({
  page,
  request
}) => {
  await page.addInitScript(() => {
    document.addEventListener("dblclick", event => {
      const target = event.target
      if (!(target instanceof Element) || target.closest(".w") || !target.closest(".reader_main")) {
        return
      }
      const word = Array.from(document.querySelectorAll(".reader_main .w"))
        .find(element => element.textContent?.trim() === "DOKTOR")
      if (!word) return
      const range = document.createRange()
      range.selectNodeContents(word)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
    }, true)
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.clock.install()
  await page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first().dblclick()
  const indicator = page.getByRole("button", { name: "Slå upp DOKTOR i SO och SAOB" })
  await expect(indicator).toBeVisible()

  await page.locator(".reader_main").dblclick({ position: { x: 5, y: 5 } })
  await expect(indicator).toBeHidden()
  await page.clock.fastForward(650)
  await expect(indicator).toBeHidden()
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})

test("Reader production keys copy typed values and push alternate media history", async ({
  page,
  request
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const notices = page.locator(
    '.reader-page > div[role="status"][aria-live="polite"]:not(.reader-search-state)'
  )
  await expect(notices).toHaveCount(2)
  await expect(notices.filter({ hasText: /.+/u })).toHaveCount(0)
  await expect(page.locator(".alert_popup")).toHaveCount(0)
  expect(await notices.evaluateAll(elements => elements.map(element => (
    element.getBoundingClientRect().height
  )))).toEqual([0, 0])

  await page.keyboard.press("i")
  const productionNotice = notices.nth(1)
  await expect(productionNotice).toHaveText("Kopierade lbworkid")
  await expect(productionNotice).toHaveClass("alert_popup")
  await page.keyboard.press("u")
  await expect(productionNotice).toHaveText("Kopierade urn")
  await expect(productionNotice).toHaveClass("alert_popup")
  await expect(notices).toHaveCount(2)
  expect(await page.evaluate(() => (
    window as typeof window & { __copiedValues?: string[] }
  ).__copiedValues)).toEqual([
    "lb-editor-doktor-glas",
    "https://urn.kb.se/resolve?urn=urn:nbn:se:lb-lb-reader-doktor-glas"
  ])
  await expect(productionNotice).toHaveText("", { timeout: 4_000 })
  await expect(productionNotice).not.toHaveClass("alert_popup")
  expect(await productionNotice.evaluate(element => element.getBoundingClientRect().height))
    .toBe(0)

  const historyLength = await page.evaluate(() => window.history.length)
  await page.keyboard.press("[")
  await expect(page).toHaveURL(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/faksimil"
  )
  await expect(page.locator(".reader_main")).toHaveClass(/\btype-faksimil\b/u)
  expect(await page.evaluate(() => sessionStorage.getItem("reader-production-reloaded")))
    .toBeNull()
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength + 1)

  await page.goBack()
  await expect(page).toHaveURL(readerPath)
  await expect(page.locator(".reader_main .etext")).toBeVisible()
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest,
    "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=faksimil",
    readerManifest
  ])
})

test("editable fields guard Reader keys and author i copies the normalized id", async ({
  page,
  request
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader-work-search-trigger").click()
  const input = page.getByRole("searchbox", { name: "Sök i verket" })
  await input.focus()
  await page.keyboard.press("i")
  await expect(input).toHaveValue("i")
  expect(await page.evaluate(() => (
    window as typeof window & { __copiedValues?: string[] }
  ).__copiedValues)).toEqual([])

  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })
  await page.keyboard.press("i")
  await expect(page.locator(".alert_popup")).toHaveText("Kopierade authorid")
  expect(await page.evaluate(() => (
    window as typeof window & { __copiedValues?: string[] }
  ).__copiedValues)).toEqual(["StrindbergA"])
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})
})

test("the mobile dictionary fits, scrolls internally, and locks the Reader background", async ({
  page,
  request
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium")
  await configureEmbed(request, {
    autoPost: true,
    dictionaries: ["so", "saob"],
    event: "result",
    longContent: true,
    selectedDictionary: "so",
    word: "DOKTOR"
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const readerWord = page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first()
  await readerWord.evaluate((element) => {
    element.scrollIntoView({ block: "start" })
    window.scrollBy(0, 120)
  })
  const backgroundScroll = await page.evaluate(() => window.scrollY)
  expect(backgroundScroll).toBeGreaterThan(0)

  const frame = await openEmbed(page, "DOKTOR")
  const embedPanel = page.locator(".reader-dictionary-embed")
  const panelBox = await embedPanel.boundingBox()
  const viewport = page.viewportSize()
  expect(panelBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(panelBox!.y).toBeGreaterThanOrEqual(0)
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(viewport!.height)

  const frameBody = frame.contentFrame().locator("body")
  const initialFrameScroll = await frameBody.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
    y: window.scrollY
  }))
  expect(initialFrameScroll.height).toBeGreaterThan(initialFrameScroll.viewport)
  expect(initialFrameScroll.y).toBe(0)
  await frameBody.evaluate(() => window.scrollTo(0, 240))
  expect(await frameBody.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  const lockedScroll = await page.evaluate(() => window.scrollY)
  expect(lockedScroll).toBeGreaterThan(0)
  await page.mouse.move(2, viewport!.height - 2)
  await page.mouse.wheel(0, 400)
  expect(await page.evaluate(() => window.scrollY)).toBe(lockedScroll)
  await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
  expect(await fixtureRequests(request, "_dictionary_requests")).toEqual([])
})
