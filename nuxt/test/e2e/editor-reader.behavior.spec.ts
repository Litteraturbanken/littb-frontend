import { expect, test } from "@playwright/test"

const editorFaksimil = "/editor/lb-editor-doktor/ix/1/f"
const editorEtext = "/editor/lb-editor-doktor/ix/1/e"
const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

test("editor Reader resolves compact media aliases with legacy asset URLs and raw-index navigation", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await expect(page.locator(".editor-reader")).toBeVisible()
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src",
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )
  await expect(page.getByRole("link", { name: "Nästa sida" })).toHaveAttribute(
    "href",
    "/editor/lb-editor-doktor/ix/2/f"
  )
  await expect(page.getByRole("link", { name: "Stäng editor" })).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
  )
  await expect(page.getByRole("link", { name: "Hjalmar Söderberg" })).toHaveAttribute(
    "href", "/f%C3%B6rfattare/S%C3%B6derbergH"
  )
  await expect(page.getByRole("link", { name: "Sök i författarens texter" }))
    .toHaveAttribute("href", "/s%C3%B6k?avancerad&forfattare=S%C3%B6derbergH")

  await page.getByRole("link", { name: "Nästa sida" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src",
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0003.jpeg"
  )
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/1\/f$/u)
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src",
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )

  await page.goto(editorEtext, { waitUntil: "networkidle" })
  await expect(page.locator(".editor-reader .etext")).toContainText("EDITORSSIDA 1")
  await expect(page.locator(".editor-reader .etext em.emphasis")).toHaveText("bevarad")
  expect(await page.evaluate(() => "editorInjected" in globalThis)).toBe(false)
  await expect(page.locator(".editor-reader .etext script, .editor-reader .etext [onclick]")).toHaveCount(0)

  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await page.getByRole("link", { name: "Stäng editor" }).click()
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/S%C3%B6derbergH\/titlar\/DoktorGlas\/sida\/-2\/etext$/u)
  await expect(page.locator(".reader_main .etext")).toContainText("DOKTOR GLAS")
  await expect(page.locator(".reader-primary-error")).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/1\/f$/u)
})

test("editor Reader restores multipart contributor context and mapped navigation history", async ({
  page
}) => {
  await page.goto("/editor/lb-editor-boye/ix/0/f", { waitUntil: "networkidle" })

  const context = page.locator("#toolkit-right .editor-reader-context")
  await expect(context.getByRole("link", { name: "Karin Boye" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/BoyeK")
  await expect(context.getByRole("link", { name: "Paulina Helgeson (red.)" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/HelgesonP")
  await expect(context.locator(".current_part .navtitle")).toHaveCount(0)
  await expect(context.getByRole("link", { name: "Gå till första sidan" }))
    .toHaveAttribute("href", "/editor/lb-editor-boye/ix/2/f")
  await expect(context.getByRole("link", { name: "Gå till nästa del" }))
    .toHaveAttribute("href", "/editor/lb-editor-boye/ix/4/f")
  await expect(context.getByText("Gå bakåt en del", { exact: true }))
    .toHaveAttribute("aria-disabled", "true")

  await context.getByRole("link", { name: "Gå till nästa del" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-boye\/ix\/4\/f$/u)
  await expect(context.locator(".current_part .header").getByRole("link", {
    name: "Paulina Helgeson"
  })).toHaveAttribute("href", "/f%C3%B6rfattare/HelgesonP")
  await expect(context.locator(".current_part .navtitle")).toHaveText("Förord")
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-boye\/ix\/0\/f$/u)
  await expect(context.locator(".current_part .navtitle")).toHaveCount(0)
})

test("editor Reader restores contents and source dialogs with focus return", async ({ page }) => {
  await page.goto("/editor/lb-editor-boye/ix/4/f?keep=%2f&keep=%2F", {
    waitUntil: "networkidle"
  })

  const contentsTrigger = page.getByRole("link", { name: "Innehållsförteckning" })
  await contentsTrigger.click()
  await expect(page).toHaveURL(/\?keep=%2f&keep=%2F&innehall$/u)
  const contents = page.getByRole("dialog", { name: "Innehållsförteckning" })
  await expect(contents).toBeVisible()
  await expect(contents.getByRole("link", { name: "Förord" }))
    .toHaveAttribute("href", "/editor/lb-editor-boye/ix/4/f?keep=%2f&keep=%2F")
  await contents.getByRole("button", { name: "Stäng" }).click()
  await expect(contents).toHaveCount(0)
  await expect(contentsTrigger).toBeFocused()

  await page.goto(`${editorFaksimil}?keep=%2f&keep=%2F`, { waitUntil: "networkidle" })
  const sourceTrigger = page.getByRole("link", { name: "Mer om boken" })
  await sourceTrigger.click()
  await expect(page).toHaveURL(/\?keep=%2f&keep=%2F&om-boken$/u)
  const source = page.getByRole("dialog", { name: "Om boken" })
  await expect(source).toContainText("Doktor Glas. Roman")
  await expect(source.getByRole("link", { name: "Hjalmar Söderberg" }))
    .toHaveAttribute("href", "/författare/S%C3%B6derbergH")
  await page.keyboard.press("Escape")
  await expect(source).toHaveCount(0)
  await expect(sourceTrigger).toBeFocused()

  await sourceTrigger.click()
  await expect(source).toBeVisible()
  await source.locator(".modal-backdrop").click({ position: { x: 5, y: 5 } })
  await expect(source).toHaveCount(0)
  await expect(sourceTrigger).toBeFocused()
})

test("editor Reader restores focus mode through raw-preserving router history", async ({ page }) => {
  const initial = `${editorFaksimil}?bare&repeat=%2f&repeat=%2F#focus-marker`
  await page.goto(initial, { waitUntil: "networkidle" })

  await page.getByRole("link", { name: "Läsfokus" }).click()
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
    .toBe(`${editorFaksimil}?bare&repeat=%2f&repeat=%2F&fokus#focus-marker`)
  await expect(page.getByRole("toolbar", { name: "Läsfokus" })).toBeVisible()
  await expect(page.locator(".editor-reader .reader_main")).toHaveClass(/\bfocus\b/u)
  await page.getByRole("button", { name: "Stäng Läsfokus" }).click()
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
    .toBe(initial)
})

test("editor Reader work search opens, focuses, and navigates to the first raw hit", async ({
  page
}) => {
  await page.goto(`${editorEtext}?keep=%2f&keep=%2F`, { waitUntil: "networkidle" })

  const trigger = page.getByRole("link", { name: "Sök i verket", exact: true })
  await trigger.click()
  const input = page.getByRole("searchbox", { name: "Sök i verket" })
  await expect(input).toBeFocused()
  await input.fill("kyrka")
  await page.getByRole("button", { name: "Sök", exact: true }).click()

  await expect(page).toHaveURL(
    /\/editor\/lb-editor-doktor\/ix\/1\/e\?keep=%2f&keep=%2F&q=kyrka&hit=0$/u
  )
  await expect(page.locator(".editor-reader .etext")).toContainText("EDITORSSIDA 1")
})

test("editor Reader suppresses non-atomic contributor and part metadata", async ({ page }) => {
  for (const workId of [
    "lb-editor-malformed-contributor",
    "lb-editor-malformed-part"
  ]) {
    await page.goto(`/editor/${workId}/ix/0/f`, { waitUntil: "networkidle" })
    const context = page.locator("#toolkit-right .editor-reader-context")
    await expect(context.locator(".editor-metadata-controls")).toHaveCount(0)
    await expect(context.getByRole("link", { name: "Karin Boye" })).toHaveCount(0)
    await expect(context.getByRole("link", { name: "Paulina Helgeson" })).toHaveCount(0)
    await expect(context.getByRole("link", { name: "Gå till nästa del" })).toHaveCount(0)
    await expect(context.getByText("Gå till nästa del", { exact: true }))
      .toHaveAttribute("aria-disabled", "true")
    await expect(context.getByRole("link", { name: "Nästa sida" }))
      .toHaveAttribute("href", `/editor/${workId}/ix/1/f`)
    await expect(page).toHaveTitle(`${workId} sida 0 | Litteraturbanken`)
    await expect(page.getByRole("link", { name: "Stäng editor" })).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText("Ett verkligt jordiskt liv. Brev")
    await expect(page.locator("body")).not.toContainText("2022")
  }
})

test("contextual editor e-text route renders the current ordinary Reader page", async ({
  page
}) => {
  await page.goto("/editor/lb-reader-doktor-glas/ix/2/e", { waitUntil: "networkidle" })

  await expect(page.locator(".editor-reader .etext")).toContainText("DOKTOR GLAS")
  await expect(page.locator(".editor-reader .reader-error")).toHaveCount(0)
})

test("editor Reader rejects unknown aliases and negative raw indexes", async ({ page }) => {
  expect((await page.goto("/editor/lb-editor-doktor/ix/1/etext"))?.status()).toBe(404)
  expect((await page.goto("/editor/lb-editor-doktor/ix/-1/f"))?.status()).toBe(404)
})

test("editor Reader navigates only actual indices from sparse metadata", async ({ page }) => {
  await page.goto("/editor/lb-editor-sparse/ix/12/f", { waitUntil: "networkidle" })

  await expect(page.getByRole("link", { name: "Föregående sida" }))
    .toHaveAttribute("href", "/editor/lb-editor-sparse/ix/2/f")
  await expect(page.getByRole("link", { name: "Nästa sida" }))
    .toHaveAttribute("href", "/editor/lb-editor-sparse/ix/57/f")
  await expect(page.getByRole("link", { name: "Gå till första sidan" }))
    .toHaveAttribute("href", "/editor/lb-editor-sparse/ix/2/f")
  await expect(page.getByRole("link", { name: "Gå till sista sidan" }))
    .toHaveAttribute("href", "/editor/lb-editor-sparse/ix/57/f")
  await expect(page.getByRole("slider", { name: "Gå till sida" })).toHaveCount(0)
  expect((await page.goto("/editor/lb-editor-sparse/ix/13/f"))?.status()).toBe(404)
})

test("editor Reader first/last controls and raw slider push history", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await page.getByRole("link", { name: "Gå till första sidan" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)
  await page.getByRole("link", { name: "Gå till sista sidan" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)

  const slider = page.getByRole("slider", { name: "Gå till sida" })
  await expect(slider).toHaveAttribute("min", "0")
  await expect(slider).toHaveAttribute("max", "2")
  await slider.evaluate(input => {
    const range = input as HTMLInputElement
    range.value = "1"
    range.dispatchEvent(new Event("input", { bubbles: true }))
    range.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/1\/f$/u)
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src", "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)
})

test("editor facsimile size and rotation controls are real accessible controls", async ({
  page
}, testInfo) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  const image = page.locator(".editor-reader .faksimil")
  const smaller = page.getByRole("button", { name: "Mindre" })
  const larger = page.getByRole("button", { name: "Större" })
  const rotateLeft = page.getByRole("button", { name: "Vänster" })

  await expect(smaller).toBeEnabled()
  await expect(larger).toBeEnabled()
  await larger.click()
  await expect(image).toHaveAttribute(
    "src", "/txt/lb-editor-doktor/lb-editor-doktor_4/lb-editor-doktor_4_0002.jpeg"
  )
  await expect(image).toHaveCSS("width", "900px")
  if (testInfo.project.name === "mobile-chromium") {
    await expect(rotateLeft).toBeHidden()
  } else {
    await rotateLeft.click()
    await expect(image).toHaveCSS("transform", /matrix\(0, -1, 1, 0, 0, 0\)/u)
  }
})

test("editor metadata fallback exposes only honest raw paging controls", async ({ page }) => {
  await page.goto("/editor/lb-editor-fallback/ix/1/f", { waitUntil: "networkidle" })

  await expect(page.locator("#toolkit-right .editor-metadata-controls")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Nästa sida" })).toBeVisible()
  await expect(page.getByRole("slider", { name: "Gå till sida" })).toBeVisible()
  await expect(page.locator("#toolkit-right a:not([href])")).toHaveCount(0)
})

test("editor OCR overlay remains aligned without blocking navigation", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })

  const image = page.locator(".editor-reader .faksimil")
  const overlay = page.locator(".editor-reader .overlay")
  await expect(overlay).toContainText("OCR")
  await expect.poll(async () => {
    const [imageBox, overlayBox] = await Promise.all([
      image.boundingBox(),
      overlay.boundingBox()
    ])
    if (!imageBox || !overlayBox) return null
    return {
      left: Math.round(overlayBox.x - imageBox.x),
      top: Math.round(overlayBox.y - imageBox.y),
      width: Math.round(overlayBox.width - imageBox.width)
    }
  }).toEqual({ left: 0, top: 0, width: 0 })

  await page.getByRole("link", { name: "Nästa sida" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
})

test("editor OCR query keeps the legacy text-only inspection mode", async ({ page }) => {
  await page.goto(`${editorFaksimil}?ocr`, { waitUntil: "networkidle" })

  await expect(page.locator(".editor-reader .reader_main")).toHaveClass(/\bocr\b/u)
  await expect(page.locator(".editor-reader .overlay")).toHaveCSS("color", "rgb(0, 0, 0)")
  await expect(page.locator(".editor-reader .faksimil")).toHaveCSS("visibility", "hidden")

  await page.getByRole("link", { name: "Nästa sida" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f\?ocr$/u)
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/1\/f\?ocr$/u)
})

test("editor OCR query keeps the facsimile visible when no overlay exists", async ({ page }) => {
  await page.goto("/editor/lb-editor-no-ocr/ix/1/f?ocr", { waitUntil: "networkidle" })

  await expect(page.locator(".editor-reader .overlay")).toHaveCount(0)
  await expect(page.locator(".editor-reader .reader_main")).not.toHaveClass(/\bocr\b/u)
  await expect(page.locator(".editor-reader .faksimil")).toHaveCSS("visibility", "visible")
})

test("editor route errors never leave the preceding page under the new identity", async ({
  page,
  request
}) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await request.put(`${fixture}/_editor_metadata_failure`)
  try {
    await page.getByRole("link", { name: "Nästa sida" }).click()
    await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
    await expect(page.getByRole("alert")).toContainText("Ett fel inträffade")
    await expect(page.locator(".editor-reader .faksimil")).toHaveCount(0)
  } finally {
    await request.delete(`${fixture}/_editor_metadata_failure`)
  }
})

test("editor links preserve raw queries and fragments while Back restores history", async ({
  page
}) => {
  const initial = `${editorFaksimil}?bare&repeat=%2f&repeat=%2F#ocr-marker`
  await page.goto(initial, { waitUntil: "networkidle" })

  await expect(page.getByRole("link", { name: "Nästa sida" })).toHaveAttribute(
    "href",
    "/editor/lb-editor-doktor/ix/2/f?bare&repeat=%2f&repeat=%2F#ocr-marker"
  )
  await page.getByRole("link", { name: "Nästa sida" }).click()
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
    .toBe("/editor/lb-editor-doktor/ix/2/f?bare&repeat=%2f&repeat=%2F#ocr-marker")
  await page.goBack()
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
    .toBe(initial)
})

test("editor n/f and d/m shortcuts push bounded raw-page history", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await page.locator("body").press("n")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await page.goBack()
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src", "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )
  await page.locator("body").press("f")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)

  await page.goto("/editor/lb-editor-long/ix/12/f", { waitUntil: "networkidle" })
  await page.locator("body").press("d")
  await expect(page).toHaveURL(/\/editor\/lb-editor-long\/ix\/2\/f$/u)
  await page.goBack()
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src", "/txt/lb-editor-long/lb-editor-long_3/lb-editor-long_3_0013.jpeg"
  )
  await page.locator("body").press("m")
  await expect(page).toHaveURL(/\/editor\/lb-editor-long\/ix\/22\/f$/u)
})

test("editor Left and Right arrows retain Angular boundary and Shift paging", async ({
  page
}) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await page.locator("body").press("Shift+ArrowRight")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await page.goBack()
  await expect(page).toHaveURL(editorFaksimil)
  await expect(page.locator(".editor-reader .faksimil")).toBeVisible()
  await page.locator("body").press("Shift+ArrowLeft")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)

  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await page.evaluate(() => window.scrollTo({ left: document.documentElement.scrollWidth }))
  await page.locator("body").press("ArrowRight")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await page.goBack()
  await expect(page).toHaveURL(editorFaksimil)
  await expect(page.locator(".editor-reader .faksimil")).toBeVisible()
  await page.evaluate(() => window.scrollTo({ left: 0 }))
  await page.locator("body").press("ArrowLeft")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)
})

test("editor sidebar and slider reuse the established Reader geometry", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })

  await expect(page.locator("main#mainview main.editor-reader")).toHaveCount(0)
  await expect(page.locator("#toolkit-right > .reader-context")).toBeVisible()
  await expect(page.locator("#toolkit-right .rz-bar")).toHaveCount(2)
  await expect(page.locator("#toolkit-right .rz-pointer")).toHaveCount(1)
  await expect(page.getByRole("slider", { name: "Gå till sida" })).toHaveCSS("opacity", "0")
  await expect(page.locator('#toolkit-right a[rel="next"] .navicon')).toBeVisible()
  await expect.poll(async () => {
    const [bar, pointer] = await Promise.all([
      page.locator("#toolkit-right .rz-bar").first().boundingBox(),
      page.locator("#toolkit-right .rz-pointer").boundingBox()
    ])
    if (!bar || !pointer) return null
    return Math.round((pointer.x + pointer.width / 2 - bar.x) / bar.width * 100)
  }).toBe(50)
  await expect(page.locator("#toolkit-right a:not([href])")).toHaveCount(0)
})

test("editor mobile viewport keeps the page and authority sidebar available", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })

  await expect(page.locator(".editor-reader .reader_main")).toBeVisible()
  await expect(page.locator(".editor-reader .faksimil")).toBeVisible()
  await expect(page.locator("#rightCorridor")).toHaveCSS("display", "inline-block")
  await expect(page.locator("#toolkit-right > .reader-context")).toBeVisible()
})
