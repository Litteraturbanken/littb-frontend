import { expect, test } from "@playwright/test"

const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const routes = ["/", "/bibliotek", "/sök", "/epub", "/presentationer", "/om/ide", "/författare/StrindbergA", readerPath]

for (const width of [375, 390, 768]) {
  test(`original mobile navigation stays visible across page types at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    for (const route of routes) {
      await page.goto(route)
      await page.locator("[data-site-navigation-ready=true]").waitFor()
      const navigation = page.getByRole("navigation", { name: "Huvudnavigation" })
      await expect(navigation, route).toBeVisible()
      await expect(navigation.getByRole("link", { name: "Biblioteket", exact: true })).toBeVisible()
      await expect(page.locator(".site-menu-toggle, .mobile-navigation-menu")).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), route)
        .toBeLessThanOrEqual(1)
      if (["/bibliotek", "/sök", "/epub", "/presentationer", "/om/ide"].includes(route)) {
        await expect(page.locator("html"), route).not.toHaveCSS("background-image", "none")
        await expect(page.locator("body"), route).not.toHaveCSS("background-image", "none")
      }
      if (route === "/bibliotek") {
        for (const link of await navigation.locator(".mainnav a").all()) {
          await expect(link).toHaveCSS("color", "rgb(255, 255, 255)")
        }
      }
    }
  })
}

test("original navigation links work and quick search returns focus to its trigger", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/bibliotek")
  await page.locator("[data-site-navigation-ready=true]").waitFor()
  const navigation = page.getByRole("navigation", { name: "Huvudnavigation" })
  await navigation.getByRole("link", { name: "Presentationer", exact: true }).click()
  await expect(page).toHaveURL(/\/presentationer$/)
  await expect(navigation).toBeVisible()
  await navigation.getByRole("link", { name: "Biblioteket", exact: true }).click()
  await expect(page).toHaveURL(/\/bibliotek$/)
  await page.locator("[data-site-navigation-ready=true]").waitFor()
  const trigger = navigation.getByRole("button", { name: "Snabbsökning" })
  await trigger.press("Enter")
  const dialog = page.getByRole("dialog", { name: "Snabbsökning", exact: true })
  await expect(dialog).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test("navigation remains visible after resizing and reader focus hides it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/bibliotek")
  await page.locator("[data-site-navigation-ready=true]").waitFor()
  const navigation = page.getByRole("navigation", { name: "Huvudnavigation" })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(navigation).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(navigation).toBeVisible()
  await page.goto(`${readerPath}?fokus`)
  await expect(page.locator("body")).toHaveClass(/reader-focus-mode/)
  await expect(page.locator("#leftCorridor")).toBeHidden()
  await page.keyboard.press("Escape")
  await expect(navigation).toBeVisible()
})
