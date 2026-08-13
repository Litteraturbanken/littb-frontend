import { expect, test, type Page } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const editorPath = "/editor/lb-editor-doktor/ix/1/f"

function browserProblems(page: Page) {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  return problems
}

test("matches deterministic Angular editor authority", async ({ page }, testInfo) => {
  const problems = browserProblems(page)
  const productionEscapes: string[] = []
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      productionEscapes.push(`${route.request().method()} ${route.request().url()}`)
      return route.abort("blockedbyclient")
    }
    return route.continue()
  })

  const response = await page.goto(editorPath, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expect(page.locator("body.focus.page-reading.ready")).toHaveCount(1)
  await expect(page.locator(".editor-reader .reader_main.type-faksimil")).toBeVisible()
  await expect(page.locator("#toolkit-right > .reader-context")).toBeVisible()
  await expect(page.locator("#toolkit .reader-facsimile-size-controls")).toBeVisible()
  const rotationControls = page.locator("#toolkit .reader-facsimile-rotation-controls")
  if (testInfo.project.name === "mobile-chromium") {
    await expect(rotationControls).toBeHidden()
  } else {
    await expect(rotationControls).toBeVisible()
  }
  await expect(page.locator("#toolkit-right .editor-imprint-year")).toHaveText("(1905)")
  await expect(page.locator("#toolkit-right .prev_part")).toHaveClass(/\bdisabled\b/u)
  await expect(page.locator("#toolkit-right .next_part")).toHaveClass(/\bdisabled\b/u)
  await expect(page.locator("#toolkit-right .pages")).toHaveText("-2 av -1")
  await expect(page.locator("#toolkit-right .subnav")).toContainText(
    "Sök i författarens texter"
  )
  const image = page.locator(".editor-reader img.faksimil")
  await expect(image).toHaveCSS("width", "625px")
  await waitForVisualAssets(page)
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0)
  expect(await page.getByRole("slider").evaluate(element => {
    const root = element.closest(".rzslider")
    if (!(root instanceof HTMLElement)) return false
    root.style.setProperty("opacity", "0", "important")
    return true
  })).toBe(true)

  const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
  await expect(page).toHaveScreenshot(`editor-reader-${device}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    threshold: 0.1,
    // The corrected manifest page identity and 24px navigation targets are
    // intentional, tightly localized differences from the Angular capture.
    maxDiffPixels: 500
  })

  expect(productionEscapes).toEqual([])
  expect(problems).toEqual([])
})
