import { expect, test, type Locator } from "@playwright/test"

const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"

async function expectMinimumTargetHeight(locator: Locator, minimum = 24) {
  const count = await locator.count()
  expect(count).toBeGreaterThan(0)

  for (let index = 0; index < count; index += 1) {
    const target = locator.nth(index)
    if (!await target.isVisible()) continue
    const box = await target.boundingBox()
    const identity = await target.evaluate(element => ({
      className: element.className,
      tagName: element.tagName,
      text: element.textContent?.trim()
    }))
    expect(box, `target ${index} ${JSON.stringify(identity)} should have layout geometry`).not.toBeNull()
    expect(box!.height, `target ${index} ${JSON.stringify(identity)} should be at least ${minimum}px high`)
      .toBeGreaterThanOrEqual(minimum)
  }
}

async function expectKeyboardFocusRing(page: import("@playwright/test").Page, target: Locator) {
  await expect(target).toHaveCount(1)

  for (let tab = 0; tab < 80; tab += 1) {
    await page.keyboard.press("Tab")
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expect.poll(async () => target.evaluate((element) => (
        getComputedStyle(element).outlineOffset
      ))).toBe("2px")

      const style = await target.evaluate((element) => {
        const computed = getComputedStyle(element)
        return {
          outlineStyle: computed.outlineStyle,
          outlineWidth: computed.outlineWidth,
          outlineOffset: computed.outlineOffset,
          boxShadow: computed.boxShadow
        }
      })

      expect(style.outlineStyle).toBe("solid")
      expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2)
      expect(style.outlineOffset).toBe("2px")
      expect(style.boxShadow).toContain("4px")
      return
    }
  }

  throw new Error("keyboard navigation did not reach the expected control")
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

test("keyboard focus remains visibly identifiable in the Reader layout", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })

  await expectKeyboardFocusRing(page, page.locator('nav[aria-label="Huvudnavigation"] a').first())
})

test("keyboard focus preserves the shared ring on default-layout inputs", async ({ page }) => {
  await page.goto("/om/kontakt", { waitUntil: "networkidle" })

  await expectKeyboardFocusRing(page, page.locator('input[type="email"]').first())
})

test("keyboard focus preserves the shared ring on Dramawebben filter controls", async ({ page }) => {
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  await expectKeyboardFocusRing(page, page.locator(".controls .filter_btn"))
})

test("keyboard focus preserves the shared ring on the active Library tab", async ({ page }) => {
  await page.goto("/bibliotek?visa=works", { waitUntil: "networkidle" })

  await expectKeyboardFocusRing(page, page.locator('[data-library-tab="works"]'))
})

test("keyboard focus preserves the shared ring on both Dramawebben text inputs", async ({
  page
}) => {
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  await expectKeyboardFocusRing(page, page.getByRole("combobox", { name: "Författare" }))
  await expectKeyboardFocusRing(page, page.getByRole("textbox", { name: "Sök", exact: true }))
})
