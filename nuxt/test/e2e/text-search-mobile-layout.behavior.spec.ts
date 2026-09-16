import { expect, test, type Page } from "@playwright/test"

async function expectKeywordCentered(page: Page) {
  await expect.poll(() => page.locator(".search-sentences-viewport").evaluate(viewport => {
    const match = viewport.querySelector(".match a")!
    const keyword = match.getBoundingClientRect()
    const frame = viewport.getBoundingClientRect()
    return Math.abs(keyword.left + keyword.width / 2 - frame.left - viewport.clientWidth / 2)
  })).toBeLessThan(2)
}

for (const width of [320, 390, 768]) {
  test(`search keyword is centered and context scrolls independently at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto("/s%C3%B6k?fras=overflow")
    await page.locator('[data-search-mounted="true"]').waitFor()
    await page.evaluate(() => document.fonts.ready)
    await expectKeywordCentered(page)

    const viewport = page.getByRole("region", { name: "Sökresultat med textkontext" })
    const initial = await viewport.evaluate(node => ({
      left: node.scrollLeft, maximum: node.scrollWidth - node.clientWidth
    }))
    expect(initial.left).toBeGreaterThan(0)
    expect(initial.left).toBeLessThan(initial.maximum)
    await expect(viewport).toHaveCSS("overflow-x", "auto")
    await expect(page.locator("#toolkit .littb_pager")).toHaveCount(0)
    await expect(page.locator("#results .littb_pager")).toContainText("sida 1 av 3")
    const pager = page.locator(".text-search-pagination").first()
    const pagerLeft = await pager.evaluate(node => node.getBoundingClientRect().left)

    // Real keyboard scrolling must not trigger the document's page shortcuts.
    await viewport.focus()
    await page.keyboard.press("ArrowRight")
    await expect.poll(() => viewport.evaluate(node => node.scrollLeft)).toBeGreaterThan(initial.left)
    await viewport.evaluate(node => new Promise<void>(resolve => {
      let previous = node.scrollLeft
      let stableFrames = 0
      const settle = () => {
        stableFrames = node.scrollLeft === previous ? stableFrames + 1 : 0
        previous = node.scrollLeft
        if (stableFrames >= 5) resolve()
        else requestAnimationFrame(settle)
      }
      requestAnimationFrame(settle)
    }))
    await viewport.evaluate(node => { node.scrollLeft = 0 })
    await expect.poll(() => viewport.evaluate(node => node.scrollLeft)).toBe(0)
    await viewport.evaluate(node => { node.scrollLeft = node.scrollWidth })
    await expect.poll(() => viewport.evaluate(node => node.scrollLeft)).toBe(initial.maximum)
    expect(new URL(page.url()).searchParams.has("traffsida")).toBe(false)
    expect(await pager.evaluate(node => node.getBoundingClientRect().left)).toBe(pagerLeft)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)

    await pager.getByRole("link", { name: "2", exact: true }).click()
    await expect(page).toHaveURL(/traffsida=2/)
    await expect(page.locator("#results .littb_pager")).toContainText("sida 2 av 3")
    await expectKeywordCentered(page)
    await expect(page.locator('.text-search-pagination [aria-current="page"]')).toHaveText(["2", "2"])

    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(page.locator("#toolkit .littb_pager")).toHaveCount(1)
    await expect(page.locator("#toolkit .navigator")).toHaveCount(1)
    await page.setViewportSize({ width, height: 844 })
    await expectKeywordCentered(page)
  })
}
