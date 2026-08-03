import { expect, test, type Locator } from "@playwright/test"

const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"

async function expectMinimumTargetHeight(locator: Locator, minimum = 24) {
  const count = await locator.count()
  expect(count).toBeGreaterThan(0)

  for (let index = 0; index < count; index += 1) {
    const target = locator.nth(index)
    if (!await target.isVisible()) continue
    const box = await target.boundingBox()
    expect(box, `target ${index} should have layout geometry`).not.toBeNull()
    expect(box!.height, `target ${index} should be at least ${minimum}px high`)
      .toBeGreaterThanOrEqual(minimum)
  }
}

test("the shared main navigation retains native list semantics", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })

  const navigation = page.locator('nav[aria-label="Huvudnavigation"]')
  await expect(navigation).toHaveCount(1)
  await expect(navigation.locator(":scope > ul.mainnav")).toHaveCount(1)
  await expect(page.locator("ul.mainnav[role]")).toHaveCount(0)
  await expect(navigation.locator(":scope > ul.mainnav > li")).toHaveCount(13)
})

test("audited shell and reader links meet the 24px touch-target floor", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })

  await expectMinimumTargetHeight(page.locator(".mainnav > li > a"))
  await expectMinimumTargetHeight(page.locator(".pager_ctrls > a, .pager_ctrls > form > a"))
  await expectMinimumTargetHeight(page.locator(".subnav > ul > li > a"))
})

test("keyboard focus remains visibly identifiable outside the Library", async ({ page }) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })

  await page.keyboard.press("Tab")
  const focused = page.locator(":focus")
  await expect(focused).toHaveCount(1)
  await expect(focused).toBeVisible()

  const style = await focused.evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      outlineOffset: computed.outlineOffset
    }
  })

  expect(style.outlineStyle).toBe("solid")
  expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThan(0)
  expect(Number.parseFloat(style.outlineOffset)).toBeGreaterThanOrEqual(2)
})
