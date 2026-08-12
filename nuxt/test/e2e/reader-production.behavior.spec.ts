import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const readerManifest = "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_editor_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`)
  ])
}

async function fixtureRequests(request: APIRequestContext, ledger: string): Promise<string[]> {
  return (await (await request.get(`${fixture}/${ledger}`)).json()).requests
}

function dictionaryArticle(word: string, definition = `Artikel för ${word}`) {
  return {
    word,
    base_form: word,
    article_html: `<lemma><grundform>${word}</grundform><lexem><def>${definition}</def></lexem></lemma>`
  }
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
  })
})
test.afterEach(async ({ request }) => {
  expect(await fixtureRequests(request, "_reader_metadata_requests")).toEqual([])
  expect(await fixtureRequests(request, "_editor_manifest_requests")).toEqual([])
})

test("one selected Reader word opens the sanitized legacy dictionary dialog", async ({
  page,
  request
}) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first().dblclick()

  const indicator = page.getByRole("button", { name: "Slå upp DOKTOR i Svensk ordbok" })
  await expect(indicator).toBeVisible()
  const responsePromise = page.waitForResponse(response => (
    response.url().includes("/api/v2/dictionary/articles")
  ))
  await indicator.click()
  expect((await responsePromise).status()).toBe(200)

  const dialog = page.locator(".so_modal")
  await expect(dialog).toContainText("Svensk ordbok utgiven av")
  await expect(dialog.locator("xpath=ancestor::*[@role='dialog']")).toHaveCount(1)
  const article = dialog.locator("._so_article")
  await expect(article).toContainText("En deterministisk ordboksartikel.")
  expect(await article.evaluate(element => ({
    html: element.innerHTML,
    tag: element.tagName
  }))).toEqual({
    html: "<lemma>DOKTOR<grundform>DOKTOR</grundform>"
      + "<lexem><def>En deterministisk ordboksartikel.</def></lexem></lemma>",
    tag: "DIV"
  })
  await expect(dialog.locator("._so_article script, ._so_article [onclick], ._so_article [href]"))
    .toHaveCount(0)
  await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
  const close = dialog.locator(".modal-header button")
  await expect(close).toBeVisible()
  await expect(close).toBeFocused()
  await close.click()
  await expect(dialog).toHaveCount(0)
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
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

  await page.locator(".reader_main #reported-nested-ocr-word").dblclick()

  const indicator = page.getByRole("button", { name: "Slå upp verkligt i Svensk ordbok" })
  await expect(indicator).toBeVisible()
  await page.waitForTimeout(650)
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

  await expect(page.getByRole("button", { name: "Slå upp DOKTOR i Svensk ordbok" }))
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

  const indicator = page.getByRole("button", { name: "Slå upp DOKTOR i Svensk ordbok" })
  await expect(indicator).toBeVisible()
  await indicator.focus()
  await expect(indicator).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.locator("._so_article")).toContainText("En deterministisk ordboksartikel.")
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})

test("dictionary responses may add fields without hiding a valid article", async ({
  page,
  request
}) => {
  await page.route("**/api/v2/dictionary/articles?word=DOKTOR", async route => {
    await route.fulfill({
      body: JSON.stringify({ ...dictionaryArticle("DOKTOR"), future_field: "compatible" }),
      contentType: "application/json",
      status: 200
    })
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first().dblclick()
  await page.getByRole("button", { name: "Slå upp DOKTOR i Svensk ordbok" }).click()

  await expect(page.locator("._so_article")).toContainText("Artikel för DOKTOR")
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})

test("a newer dictionary lookup cannot be overwritten by an older response", async ({
  page,
  request
}) => {
  let markFirstStarted!: () => void
  let markFirstSettled!: () => void
  let releaseFirst!: () => void
  const firstStarted = new Promise<void>(resolve => { markFirstStarted = resolve })
  const firstSettled = new Promise<void>(resolve => { markFirstSettled = resolve })
  const firstRelease = new Promise<void>(resolve => { releaseFirst = resolve })
  await page.route("**/api/v2/dictionary/articles?word=*", async route => {
    const word = new URL(route.request().url()).searchParams.get("word")!
    if (word === "DOKTOR") {
      markFirstStarted()
      await firstRelease
    }
    try {
      await route.fulfill({
        body: JSON.stringify(dictionaryArticle(word)),
        contentType: "application/json",
        status: 200
      }).catch(() => undefined)
    } finally {
      if (word === "DOKTOR") markFirstSettled()
    }
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })

  await page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first().dblclick()
  await page.getByRole("button", { name: "Slå upp DOKTOR i Svensk ordbok" }).click()
  await firstStarted
  await page.locator(".reader_main .w").filter({ hasText: "GLAS" }).first().dblclick()
  await page.getByRole("button", { name: "Slå upp GLAS i Svensk ordbok" }).click()
  await expect(page.locator("._so_article")).toContainText("Artikel för GLAS")

  releaseFirst()
  await firstSettled
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  await expect(page.locator("._so_article")).toContainText("Artikel för GLAS")
  await expect(page.locator("._so_article")).not.toContainText("Artikel för DOKTOR")
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
})

test("route changes invalidate a pending dictionary lookup", async ({ page, request }) => {
  let markLookupStarted!: () => void
  let markLookupSettled!: () => void
  let releaseLookup!: () => void
  const lookupStarted = new Promise<void>(resolve => { markLookupStarted = resolve })
  const lookupSettled = new Promise<void>(resolve => { markLookupSettled = resolve })
  const lookupRelease = new Promise<void>(resolve => { releaseLookup = resolve })
  await page.route("**/api/v2/dictionary/articles?word=DOKTOR", async route => {
    markLookupStarted()
    await lookupRelease
    try {
      await route.fulfill({
        body: JSON.stringify(dictionaryArticle("DOKTOR")),
        contentType: "application/json",
        status: 200
      }).catch(() => undefined)
    } finally {
      markLookupSettled()
    }
  })
  await page.goto(readerPath, { waitUntil: "networkidle" })

  await page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first().dblclick()
  await page.getByRole("button", { name: "Slå upp DOKTOR i Svensk ordbok" }).click()
  await lookupStarted
  await page.keyboard.press("o")
  await expect(page).toHaveURL(`${readerPath}?om-boken`)
  releaseLookup()
  await lookupSettled
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))

  await expect(page.locator("._so_article")).toHaveCount(0)
  await expect(page.locator(".alert_popup")).toHaveCount(0)
  expect(await fixtureRequests(request, "_reader_manifest_requests")).toEqual([
    readerManifest
  ])
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
  await page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first().dblclick()
  const indicator = page.getByRole("button", { name: "Slå upp DOKTOR i Svensk ordbok" })
  await expect(indicator).toBeVisible()

  await page.locator(".reader_main").dblclick({ position: { x: 5, y: 5 } })
  await expect(indicator).toBeHidden()
  await page.waitForTimeout(650)
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
