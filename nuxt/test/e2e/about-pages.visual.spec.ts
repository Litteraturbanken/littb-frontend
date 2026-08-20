import { expect, test } from "../fixtures/angular-visual-test"

import { waitForVisualAssets } from "../helpers/visual"

const pages = [
  ["ide", "Introduktion"],
  ["organisation", "Organisation"],
  ["rattigheter", "Rättigheter och material"],
  ["tack", "Litteraturbanken tackar"]
] as const

for (const [slug, heading] of pages) {
  test(`matches the approved Angular ${slug} page`, async ({ page }, testInfo) => {
    await page.goto(`/om/${slug}`, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible()
    await waitForVisualAssets(page)

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`about-${slug}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })
  })
}
