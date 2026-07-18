import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

for (const documentCase of [
  ["presentation", "/författare/S%C3%B6derbergH/presentation"],
  ["bibliografi", "/författare/Lagerl%C3%B6fS/bibliografi"]
] as const) {
  test(`matches the Angular ${documentCase[0]} authority`, async ({ page }, testInfo) => {
    await page.goto(documentCase[1], { waitUntil: "networkidle" })
    await expect(page.locator("body.focus.page-authorInfo.ready")).toHaveCount(1)
    await waitForVisualAssets(page)
    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(
      `author-document-${documentCase[0]}-${device}.png`,
      { fullPage: true, animations: "disabled", caret: "hide", scale: "css", threshold: 0.1, maxDiffPixels: 100 }
    )
  })
}
