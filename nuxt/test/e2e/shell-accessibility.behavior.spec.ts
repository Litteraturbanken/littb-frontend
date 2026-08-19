import { expect, test, type Locator } from "@playwright/test"

const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

async function resetLibraryControls(request: import("@playwright/test").APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_library_v2/failures`),
    request.delete(`${fixture}/_library_v2/delays`),
    request.delete(`${fixture}/_library_relevance_failure`),
    request.delete(`${fixture}/_library_relevance_delays`),
    request.delete(`${fixture}/_library_query_failure`),
    request.delete(`${fixture}/_library_query_delays`),
    request.delete(`${fixture}/_library_imprint_failure`)
  ])
}

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

async function expectKeyboardFocusWithoutSharedRing(
  page: import("@playwright/test").Page,
  target: Locator
) {
  await expect(target).toHaveCount(1)

  for (let tab = 0; tab < 80; tab += 1) {
    await page.keyboard.press("Tab")
    if (await target.evaluate(element => element === document.activeElement)) {
      await expect(target).toBeFocused()
      expect(await target.evaluate(element => {
        const style = getComputedStyle(element)
        return {
          focusVisible: element.matches(":focus-visible"),
          sharedOutline: style.outlineStyle === "solid"
            && style.outlineWidth === "2px"
            && style.outlineOffset === "2px",
          sharedShadow: style.boxShadow.includes("0px 0px 0px 4px")
        }
      })).toEqual({
        focusVisible: true,
        sharedOutline: false,
        sharedShadow: false
      })
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

test("keyboard focus matches production outside the Library", async ({ page }) => {
  await page.goto("/om/ide", { waitUntil: "networkidle" })

  await page.keyboard.press("Tab")
  const focused = page.locator(":focus")
  await expect(focused).toHaveCount(1)
  await expect(focused).toBeVisible()

  const style = await focused.evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      focusVisible: element.matches(":focus-visible"),
      sharedOutline: computed.outlineStyle === "solid"
        && computed.outlineWidth === "2px"
        && computed.outlineOffset === "2px",
      sharedShadow: computed.boxShadow.includes("0px 0px 0px 4px")
    }
  })

  expect(style).toEqual({ focusVisible: true, sharedOutline: false, sharedShadow: false })
})

test("keyboard focus matches production in the Reader layout", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })

  await expectKeyboardFocusWithoutSharedRing(
    page,
    page.locator('nav[aria-label="Huvudnavigation"] a').first()
  )
})

test("keyboard focus matches production on default-layout inputs", async ({ page }) => {
  await page.goto("/om/kontakt", { waitUntil: "networkidle" })

  await expectKeyboardFocusWithoutSharedRing(page, page.locator('input[type="email"]').first())
})

test("keyboard focus matches production on Dramawebben filter controls", async ({ page }) => {
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  await expectKeyboardFocusWithoutSharedRing(page, page.locator(".controls .filter_btn"))
})

test("keyboard focus matches production on the active Library tab", async ({ page, request }) => {
  await resetLibraryControls(request)
  await page.goto("/bibliotek?visa=works", { waitUntil: "networkidle" })

  await expectKeyboardFocusWithoutSharedRing(page, page.locator('[data-library-tab="works"]'))
})

test("keyboard focus matches production on both Dramawebben text inputs", async ({
  page
}) => {
  await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  await expectKeyboardFocusWithoutSharedRing(
    page,
    page.getByRole("combobox", { name: "Författare" })
  )
  await expectKeyboardFocusWithoutSharedRing(
    page,
    page.getByRole("textbox", { name: "Sök", exact: true })
  )
})
