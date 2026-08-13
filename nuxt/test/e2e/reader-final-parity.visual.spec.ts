import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const etextPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const facsimilePath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"
const nyaVagarPath = "/författare/SöderbergH/titlar/NyaVagarReader/sida/-2/etext"

function screenshotOptions() {
  return {
    animations: "disabled" as const,
    caret: "hide" as const,
    fullPage: true,
    // Reader navigation keeps the Angular glyph layout while meeting the 24px
    // touch floor; OCR additionally retains its known subpixel font variance.
    maxDiffPixels: 1_500,
    scale: "css" as const,
    threshold: 0.1
  }
}

test("matches Angular Läsfokus day and night authority", async ({ page }, testInfo) => {
  await page.goto(etextPath, { waitUntil: "networkidle" })
  const trigger = page.getByRole("link", { name: "Läsfokus", exact: true })
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.locator(".reader_main.focus")).toBeVisible()
  await expect(page.locator(".bottomBar")).toBeVisible()
  await waitForVisualAssets(page)

  const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
  await expect(page).toHaveScreenshot(`reader-focus-day-${device}.png`, screenshotOptions())

  await page.getByRole("button", { name: "Textinställningar" }).click()
  await page.getByRole("button", { name: "Nattläge" }).click()
  await expect(page.locator("body")).toHaveClass(/\bnight\b/u)
  await expect(page.locator(".text_menu.text")).toBeVisible()
  await expect(page).toHaveScreenshot(`reader-focus-night-${device}.png`, screenshotOptions())
})

test("matches Angular normal Reader OCR authority", async ({ page }, testInfo) => {
  await page.goto(`${facsimilePath}?ocr`, { waitUntil: "networkidle" })
  await expect(page.locator(".reader_main.ocr .overlay")).toContainText("OCR fixture")
  await waitForVisualAssets(page)

  const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
  await expect(page).toHaveScreenshot(`reader-ocr-${device}.png`, screenshotOptions())
})

test("matches Angular eligible Nya vägar sidebar authority", async ({ page }, testInfo) => {
  const response = await page.goto(nyaVagarPath, { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expect(page.getByRole("link", { name: "Logotyp för Nya vägar" })).toBeVisible()
  await waitForVisualAssets(page)

  const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
  await expect(page).toHaveScreenshot(`reader-nya-vagar-${device}.png`, screenshotOptions())
})
