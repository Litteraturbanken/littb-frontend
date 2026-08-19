import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin

test.beforeEach(async ({ request }) => {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
})

test("matches the approved Angular statistics page", async ({ page }, testInfo) => {
  await page.goto("/om/statistik", { waitUntil: "domcontentloaded" })
  await expect(page.locator(".content.stats > ul").nth(1).locator("li")).toHaveCount(30)
  await expect(page.locator(".content.stats > ul").nth(2).locator("li")).toHaveCount(30)
  await waitForVisualAssets(page)

  const baseline = testInfo.project.name === "mobile-chromium"
    ? "statistics-mobile.png"
    : "statistics-desktop.png"

  await expect(page).toHaveScreenshot(baseline, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    threshold: 0.1,
    maxDiffPixels: 100
  })
})
