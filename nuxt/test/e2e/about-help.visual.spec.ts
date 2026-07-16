import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const pages = [
  ["mal", "/om/mål", "Mål"],
  ["english", "/om/english.html", "The Swedish Literature Bank"],
  ["deutsch", "/om/deutsch.html", "Die Schwedische Literaturbank"],
  ["francais", "/om/francais.html", "La Banque de littérature suédoise"],
  ["hjalp", "/om/hjalp", "Hjälp"]
] as const

for (const [baseline, route, marker] of pages) {
  test(`matches the approved Angular ${baseline} page`, async ({ page }, testInfo) => {
    await page.goto(route, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: marker, exact: false }).first()).toBeVisible()
    if (baseline === "hjalp") {
      await expect(page.locator("#toolkit > [toolkit] > ul.help_submenu.sticky")).toHaveCount(1)
    }
    await waitForVisualAssets(page)

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`about-${baseline}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })
  })
}
