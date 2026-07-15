import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

// This JavaScript fixture is deliberately shared with the Node HTTP fixture.
// @ts-ignore -- Playwright transpiles the adjacent ESM module directly.
import { legacyEpubs, legacyWorks, stats } from "../fixtures/statistics-data.mjs"

async function waitForVisualAssets(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images]
        .filter(image => !image.complete)
        .map(image => new Promise(resolve => {
          image.addEventListener("load", resolve, { once: true })
          image.addEventListener("error", resolve, { once: true })
        }))
    )

    const background = getComputedStyle(document.documentElement).backgroundImage
    const match = background.match(/url\(["']?(.+?)["']?\)/)
    if (match) {
      const image = new Image()
      image.src = match[1]
      await image.decode()
    }
  })
}

test.beforeEach(async ({ page }) => {
  await page.route(/\/get_stats(?:\?|$)/, route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stats) })
  )
  await page.route(/\/query_string\/etext,faksimil,pdf(?:\?|$)/, route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        hits: legacyWorks.length,
        distinct_hits: legacyWorks.length,
        data: legacyWorks
      })
    })
  )
  await page.route(/\/query\/etext(?:\?|$)/, route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: legacyEpubs, hits: legacyEpubs.length })
    })
  )
})

test("captures the current Angular visual authority", async ({ page }, testInfo) => {
  await page.goto("/om/statistik", { waitUntil: "domcontentloaded" })
  await expect(page.locator("body")).toHaveClass(/\bready\b/)

  const lists = page.locator(".content.stats > ul")
  await expect(lists.nth(1).locator("li")).toHaveCount(30)
  await expect(lists.nth(2).locator("li")).toHaveCount(30)
  await waitForVisualAssets(page)

  const directory = resolve(import.meta.dirname, "baselines")
  await mkdir(directory, { recursive: true })
  const filename = testInfo.project.name === "angular-mobile"
    ? "statistics-mobile.png"
    : "statistics-desktop.png"

  await page.screenshot({
    path: resolve(directory, filename),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css"
  })
})
