import { expect, test } from "../fixtures/angular-visual-test"
import { waitForVisualAssets } from "../helpers/visual"

for (const [name, route] of [["home", "/"], ["about", "/om/ide"]] as const) {
  test(`shared navigation on ${name} shows the original mobile links`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "mobile navigation appearance")
    await page.goto(route)
    await page.locator("[data-site-navigation-ready=true]").waitFor()
    await waitForVisualAssets(page)
    const header = page.locator("#leftCorridor")
    await expect(header).toHaveScreenshot(`site-navigation-${name}-original.png`, {
      animations: "disabled", scale: "css"
    })
    await expect(page.getByRole("navigation", { name: "Huvudnavigation" })).toBeVisible()
  })
}
