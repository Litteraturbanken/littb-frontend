import { expect, test } from "@playwright/test"

test.use({ browserName: "webkit" })
test("opening focuses the field, Enter navigates and Escape restores trigger focus", async ({ page }) => {
  await page.goto("/s%C3%B6k?fras=overflow", { waitUntil: "networkidle" })
  const actions = page.locator("[data-text-search-page-actions]")
  const trigger = actions.getByRole("button", { name: "Gå till träffsida . . .", exact: true })
  const input = actions.getByRole("spinbutton", { name: "Träffsida" })
  await trigger.press("Enter")
  await expect(input).toBeFocused()
  await page.keyboard.type("2")
  await input.press("Enter")
  await expect(page).toHaveURL(/traffsida=2/)
  await expect(trigger).toBeFocused()
  await expect(actions).not.toHaveAttribute("inert")
  await trigger.press("Enter")
  await expect(input).toBeFocused()
  await input.press("Escape")
  await expect(trigger).toBeFocused()
  await expect(input).toHaveCount(0)
})

test("a pending destination cannot steal focus from another search control", async ({ page }) => {
  let releaseResponse: () => void = () => {}
  const held = new Promise<void>(resolve => { releaseResponse = resolve })
  await page.route("**/api/v2/text-search/results", async route => {
    if (route.request().postDataJSON().page === 2) await held
    await route.continue()
  })
  await page.goto("/s%C3%B6k?fras=overflow", { waitUntil: "networkidle" })
  const actions = page.locator("[data-text-search-page-actions]")
  await actions.getByRole("button", { name: "Gå till träffsida . . .", exact: true }).click()
  const destination = actions.getByRole("spinbutton", { name: "Träffsida" })
  await destination.fill("2")
  await destination.press("Enter")
  await expect(actions).toHaveAttribute("inert", "")
  const query = page.getByRole("textbox", { name: "Sökfras", exact: true })
  await query.focus()
  releaseResponse()
  await expect(actions).not.toHaveAttribute("inert")
  await expect(query).toBeFocused()
})
