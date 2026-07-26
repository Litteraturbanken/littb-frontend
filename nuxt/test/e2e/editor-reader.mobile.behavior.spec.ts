import { expect, test } from "@playwright/test"

const editorFaksimil = "/editor/lb-editor-doktor/ix/1/f"

test("mobile Editor renders contextual content and honest fallback state", async ({ page }) => {
  await page.goto("/editor/lb-reader-doktor-glas/ix/2/e", { waitUntil: "networkidle" })
  await expect(page.locator(".editor-reader .etext")).toContainText("DOKTOR GLAS")

  await page.goto("/editor/lb-editor-fallback/ix/1/f", { waitUntil: "networkidle" })
  await expect(page.locator(".editor-reader .reader_main")).toBeVisible()
  await expect(page.locator("#toolkit-right .editor-metadata-controls")).toHaveCount(0)
  await expect(page.getByRole("slider", { name: "Gå till sida" })).toBeVisible()
})

test("mobile Editor size controls and keyboard paging remain functional", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  const image = page.locator(".editor-reader .faksimil")

  await page.getByRole("button", { name: "Större" }).click()
  await expect(image).toHaveAttribute(
    "src", "/txt/lb-editor-doktor/lb-editor-doktor_4/lb-editor-doktor_4_0002.jpeg"
  )
  await expect(page.getByRole("button", { name: "Vänster" })).toBeHidden()

  await page.keyboard.press("Shift+ArrowRight")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await expect(image).toHaveAttribute(
    "src", "/txt/lb-editor-doktor/lb-editor-doktor_4/lb-editor-doktor_4_0003.jpeg"
  )
})

test("mobile Editor slider thumb reflects the raw page index", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })

  await expect.poll(async () => {
    const [bar, pointer] = await Promise.all([
      page.locator("#toolkit-right .rz-bar").first().boundingBox(),
      page.locator("#toolkit-right .rz-pointer").boundingBox()
    ])
    if (!bar || !pointer) return null
    return Math.round((pointer.x + pointer.width / 2 - bar.x) / bar.width * 100)
  }).toBe(50)
})

test("mobile Editor exposes the restored Reader tools accessibly", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })

  const sourceTrigger = page.getByRole("link", { name: "Mer om boken" })
  await sourceTrigger.focus()
  await sourceTrigger.press("Enter")
  const dialog = page.getByRole("dialog", { name: "Om boken" })
  await expect(dialog).toContainText("Doktor Glas. Roman")
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)

  const focusTrigger = page.getByRole("link", { name: "Läsfokus" })
  await focusTrigger.focus()
  await focusTrigger.press("Enter")
  await expect(page.getByRole("toolbar", { name: "Läsfokus" })).toBeVisible()
  const closeFocus = page.getByRole("button", { name: "Stäng Läsfokus" })
  await closeFocus.focus()
  await closeFocus.press("Enter")
})
