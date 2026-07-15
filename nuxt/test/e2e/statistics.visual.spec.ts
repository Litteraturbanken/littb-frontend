import { expect, test } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"

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
