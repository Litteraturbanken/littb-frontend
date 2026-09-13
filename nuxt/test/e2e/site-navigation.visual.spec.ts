import { expect, test } from "../fixtures/angular-visual-test"
import { waitForVisualAssets } from "../helpers/visual"

for (const [name, route] of [["home", "/"], ["about", "/om/ide"]] as const) {
  test(`shared navigation on ${name} keeps its compact mobile appearance`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "mobile navigation appearance")
    await page.goto(route)
    await page.locator("[data-site-navigation-ready=true]").waitFor()
    await waitForVisualAssets(page)
    const header = page.locator("#leftCorridor")
    await expect(header).toHaveScreenshot(`site-navigation-${name}-closed.png`, {
      animations: "disabled", scale: "css"
    })
    await page.locator(".site-menu-toggle").click()
    await expect(page.getByRole("navigation", { name: "Huvudnavigation" })).toBeVisible()
    await expect(header).toHaveScreenshot(`site-navigation-${name}-open.png`, {
      animations: "disabled", scale: "css"
    })
  })
}
