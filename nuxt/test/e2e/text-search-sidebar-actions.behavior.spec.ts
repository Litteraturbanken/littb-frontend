import { expect, test } from "@playwright/test"

for (const width of [390, 1230, 1440]) {
  test(`production search navigation actions coexist with pagination at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1230 ? 1439 : 900 })
    await page.goto("/s%C3%B6k?fras=overflow&keep=first&keep=second", { waitUntil: "networkidle" })
    const actions = page.locator("[data-text-search-page-actions]")
    await expect(actions).toBeVisible()
    await expect(page.locator(".text-search-pagination").first()).toBeVisible()
    if (width > 767) {
      expect(await page.locator(".littb_pager").evaluate(element => element.compareDocumentPosition(document.querySelector(".navigator")!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy()
      await expect(actions.locator("xpath=ancestor::*[@id='search-pager-toolkit']")).toHaveCount(1)
      const card = await page.locator(".littb_pager").boundingBox()
      for (const button of await actions.locator("li:not(.arrows) > button").all()) {
        const box = await button.boundingBox()
        expect(box!.width).toBeGreaterThan(25)
        expect(box!.x).toBeGreaterThanOrEqual(card!.x)
        expect(box!.x + box!.width).toBeLessThanOrEqual(card!.x + card!.width)
      }
      for (const button of await actions.locator(".arrows button").all()) {
        expect((await button.boundingBox())!.width).toBe(25)
        expect((await button.boundingBox())!.height).toBe(25)
      }
    } else await expect(actions.locator("xpath=ancestor::*[@id='results']")).toHaveCount(1)
    await expect(actions.getByRole("button", { name: "Föregående träffsida" })).toBeDisabled()
    await actions.getByRole("button", { name: "Nästa träffsida", exact: true }).click()
    await expect(page).toHaveURL(/traffsida=2/)
    await expect(actions).not.toHaveAttribute("inert")
    await actions.getByRole("button", { name: "Gå till sista träffen" }).press("Enter")
    await expect(page).toHaveURL(/traffsida=3/)
    await expect(actions.getByRole("button", { name: "Nästa träffsida", exact: true })).toBeDisabled()
    await expect.poll(() => new URL(page.url()).searchParams.getAll("keep")).toEqual(["first", "second"])
    await page.reload({ waitUntil: "networkidle" })
    await actions.getByRole("button", { name: "Gå till träffsida . . .", exact: true }).click()
    const input = actions.getByRole("spinbutton", { name: "Träffsida" })
    await expect(input).toBeFocused()
    const inputBox = (await input.boundingBox())!
    const submitBox = (await actions.getByRole("button", { name: "Gå till angiven träffsida" }).boundingBox())!
    const labelBox = (await actions.getByRole("button", { name: "Gå till träffsida . . .", exact: true }).boundingBox())!
    const actionBox = (await actions.boundingBox())!
    expect(submitBox.x).toBeGreaterThanOrEqual(inputBox.x + inputBox.width)
    expect(Math.abs(submitBox.y + submitBox.height / 2 - inputBox.y - inputBox.height / 2)).toBeLessThan(1)
    expect(inputBox.x).toBeGreaterThanOrEqual(labelBox.x + labelBox.width)
    expect(Math.abs(labelBox.y + labelBox.height / 2 - inputBox.y - inputBox.height / 2)).toBeLessThan(3)
    expect(submitBox.x + submitBox.width).toBeLessThanOrEqual(actionBox.x + actionBox.width)
    await input.fill("2")
    await input.press("Enter")
    await expect(page).toHaveURL(/traffsida=2/)
    await expect(input).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(/traffsida=3/)
    await actions.getByRole("button", { name: "Gå till första träffen" }).click()
    await expect.poll(() => new URL(page.url()).searchParams.has("traffsida")).toBe(false)
    await actions.getByRole("button", { name: "Gå till träffsida . . .", exact: true }).click()
    await input.press("Escape")
    await expect(actions.getByRole("button", { name: "Gå till träffsida . . .", exact: true })).toBeFocused()
    expect(new URL(page.url()).searchParams.get("fras")).toBe("overflow")
  })
}
