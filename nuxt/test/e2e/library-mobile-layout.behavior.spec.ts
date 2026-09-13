import { expect, test, type Page } from "@playwright/test"

async function expectContained(page: Page) {
  const overflow = await page.locator("#mainview").evaluate(main => {
    const viewport = document.documentElement.clientWidth
    return [...main.querySelectorAll("input, button, select, .multiselect, [data-library-tab], .result, .dl")]
      .filter(element => {
        const box = element.getBoundingClientRect()
        return box.width > 1 && box.height > 1 && getComputedStyle(element).position !== "absolute"
      })
      .filter(element => {
        const box = element.getBoundingClientRect()
        return box.left < -1 || box.right > viewport + 1
      })
      .map(element => element.outerHTML.slice(0, 180))
  })
  expect(overflow).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
}

for (const width of [320, 390, 768]) {
  test(`library controls and result modes fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto("/bibliotek")
    await page.locator('[data-library-mounted="true"]').waitFor({ state: "attached" })
    const menu = page.getByRole("button", { name: "Meny", exact: true })
    await expect(menu).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Huvudnavigation" })).toBeHidden()
    await menu.click()
    await expect(page.getByRole("navigation", { name: "Huvudnavigation" })).toBeVisible()
    await page.getByRole("button", { name: "Stäng meny" }).click()
    await expectContained(page)
    for (const mode of ["latest", "authors", "works", "parts", "epub", "pdf", "all"]) {
      await page.locator(`[data-library-tab="${mode}"]`).click()
      await expect(page.locator(`[data-library-tab="${mode}"]`)).toHaveAttribute("aria-current", "page")
      await expect(page.locator("[data-library-loading]")).toHaveCount(0)
      await expect(page.locator(".result table")).toBeVisible()
      await expectContained(page)
    }
    await page.locator("[data-library-advanced]").click()
    await expect(page.locator("[data-library-advanced-panel]")).toBeVisible()
    await expectContained(page)
    await page.getByRole("combobox", { name: "Filtrera: Kategorier / Utgivare", exact: true }).click()
    await expectContained(page)
    await page.keyboard.press("Escape")
    await page.locator("[data-library-download-mode]").click()
    await expect(page.locator("[data-library-format-button]")).toBeVisible()
    await expectContained(page)
  })
}

test("desktop keeps the full library navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/bibliotek")
  await expect(page.getByRole("navigation", { name: "Huvudnavigation" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Meny", exact: true })).toBeHidden()
})
