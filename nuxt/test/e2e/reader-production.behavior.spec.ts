import { expect, test } from "@playwright/test"

const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"

test.beforeEach(async ({ page }) => {
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

test("one selected Reader word opens the sanitized legacy dictionary dialog", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first().evaluate(word => {
    const range = document.createRange()
    range.selectNodeContents(word)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    word.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
  })

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
  await expect(dialog.locator("._so_article")).toContainText("En deterministisk ordboksartikel.")
  await expect(dialog.locator("._so_article script, ._so_article [onclick], ._so_article [href]"))
    .toHaveCount(0)
  await expect(page.locator("body")).toHaveClass(/\bmodal-open\b/u)
  const close = dialog.locator(".modal-header button")
  await expect(close).toBeVisible()
  await expect(close).toBeFocused()
  await close.click()
  await expect(dialog).toHaveCount(0)
})

test("Reader production keys copy typed values and push alternate media history", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })

  await page.keyboard.press("i")
  await expect(page.locator(".alert_popup")).toHaveText("Kopierade lbworkid")
  await page.keyboard.press("u")
  await expect(page.locator(".alert_popup")).toHaveText("Kopierade urn")
  expect(await page.evaluate(() => (
    window as typeof window & { __copiedValues?: string[] }
  ).__copiedValues)).toEqual([
    "lb-editor-doktor-glas",
    "https://urn.kb.se/resolve?urn=urn:nbn:se:lb-lb-reader-doktor-glas"
  ])

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
})

test("editable fields guard Reader keys and author i copies the normalized id", async ({ page }) => {
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
})
