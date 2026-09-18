import { expect, test, type Page } from "@playwright/test"

async function expectKeywordCentered(page: Page) {
  await expect.poll(() => page.locator(".search-sentences-viewport").evaluate(viewport => {
    const match = viewport.querySelector(".match a")!
    const keyword = match.getBoundingClientRect()
    const frame = viewport.getBoundingClientRect()
    return Math.abs(keyword.left + keyword.width / 2 - frame.left - viewport.clientWidth / 2)
  })).toBeLessThan(2)
}

async function expectHeadingsPinned(page: Page) {
  const viewport = page.locator(".search-sentences-viewport")
  await expect.poll(() => viewport.evaluate(node => {
    const frame = node.getBoundingClientRect()
    return [...node.querySelectorAll(".header_content")].every(header => {
      const box = header.getBoundingClientRect()
      return Math.abs(box.left - frame.left) < 2 && box.right <= frame.right + 1
    })
  })).toBe(true)
}

for (const width of [375, 390, 768]) {
  test(`search keyword is centered and context scrolls independently at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 667 : 844 })
    await page.goto("/s%C3%B6k?fras=overflow")
    await page.locator('[data-search-mounted="true"]').waitFor()
    await page.evaluate(() => document.fonts.ready)
    await expectKeywordCentered(page)
    await expectHeadingsPinned(page)

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
    await expectHeadingsPinned(page)
    await viewport.evaluate(node => { node.scrollLeft = node.scrollWidth })
    await expect.poll(() => viewport.evaluate(node => node.scrollLeft)).toBe(initial.maximum)
    await expectHeadingsPinned(page)
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
    await page.setViewportSize({ width, height: width === 375 ? 667 : 844 })
    await expectKeywordCentered(page)
  })
}

for (const width of [375, 390]) {
  test(`mobile pagination stays on one row across 273 pages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 667 : 844 })
    await page.route("**/api/v2/text-search/results", async route => {
      const body = route.request().postDataJSON()
      const response = await route.fetch({ postData: { ...body, page: 2 } })
      const data = await response.json()
      data.page = body.page
      data.totals = { works: 8190, documents: 8190, occurrences: 65520 }
      await route.fulfill({ response, json: data })
    })
    for (const currentPage of [1, 137, 273]) {
      await page.goto(`/s%C3%B6k?fras=overflow&traffsida=${currentPage}`)
      await page.locator('[data-search-mounted="true"]').waitFor()
      await expect(page.locator('.text-search-pagination [aria-current="page"]'))
        .toHaveText([String(currentPage), String(currentPage)])
      for (const pager of await page.locator(".text-search-pagination").all()) {
        await expect(pager.locator('[data-library-page="1"]')).toBeVisible()
        await expect(pager.locator('[data-library-page="273"]')).toBeVisible()
        const extraPage = currentPage === 1 ? 3 : currentPage === 273 ? 271 : 138
        await expect(pager.locator(`[data-library-page="${extraPage}"]`)).toBeVisible()
        await expect(pager.locator('[data-library-pagination-previous]')).toHaveText("←")
        await expect(pager.locator('[data-library-pagination-next]')).toHaveText("→")
        await expect(pager.locator('[data-library-pagination-ellipsis]')).toHaveCount(currentPage === 137 ? 2 : 1)
        const layout = await pager.evaluate(node => {
          const frame = node.getBoundingClientRect()
          const buttons = [...node.querySelectorAll("li > a, li > span")]
            .map(button => button.getBoundingClientRect())
          return {
            frame: { left: frame.left, right: frame.right },
            buttons: buttons.map(box => ({ left: box.left, right: box.right })),
            rows: new Set(buttons.map(box => Math.round(box.top))).size,
            fits: buttons.every(box => box.left >= frame.left && box.right <= frame.right + 1),
            heights: buttons.map(box => box.height)
          }
        })
        expect(layout.rows).toBe(1)
        expect(layout.fits, JSON.stringify(layout)).toBe(true)
        expect(Math.min(...layout.heights)).toBeGreaterThanOrEqual(40)
      }
    }
  })
}

test("mobile search tools align with the results viewport at tablet widths", async ({ page }) => {
  await page.setViewportSize({ width: 846, height: 1000 })
  await page.goto("/s%C3%B6k?fras=overflow")
  await page.locator('[data-search-mounted="true"]').waitFor()
  const edges = await page.evaluate(() => {
    const form = document.querySelector(".submit_form")!.getBoundingClientRect()
    const results = document.querySelector(".table_viewport")!.getBoundingClientRect()
    return { left: Math.abs(form.left - results.left), right: Math.abs(form.right - results.right) }
  })
  expect(edges.left).toBeLessThan(1)
  expect(edges.right).toBeLessThan(1)
})


test("search panels use the full iPhone SE width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/s%C3%B6k?fras=overflow")
  await page.locator('[data-search-mounted="true"]').waitFor()
  for (const selector of [".submit_form", ".table_viewport"]) {
    const bounds = await page.locator(selector).boundingBox()
    expect(bounds!.x).toBeCloseTo(0, 0)
    expect(bounds!.width).toBeCloseTo(375, 0)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
})
