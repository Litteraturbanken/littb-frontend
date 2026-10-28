import { expect, test } from "@playwright/test"

for (const width of [375, 1440]) {
  for (const kind of ["library", "search"]) {
    test(`${kind} pagination exposes useful boundaries, keyboard/history and fits at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      const total = kind === "library" ? 17 : 273
      if (kind === "search") await page.route("**/api/v2/text-search/results", async route => {
        const body = route.request().postDataJSON()
        const response = await route.fetch({ postData: { ...body, page: 1 } })
        const data = await response.json()
        data.page = body.page
        data.totals = { works: 8190, documents: 8190, occurrences: 65520 }
        await route.fulfill({ response, json: data })
      })
      const base = kind === "library"
        ? "/bibliotek?visa=epub&filter=pagination%20window&keep=first&keep=second"
        : "/s%C3%B6k?fras=overflow&lemma&prefix&suffix&forfattare=StrindbergA&languages=swe&keep=first&keep=second"
      const pageKey = kind === "library" ? "sida" : "traffsida"
      const pager = page.locator(kind === "library" ? ".library-pagination" : ".text-search-pagination .library-pagination").first()
      for (const current of [1, Math.ceil(total / 2), total]) {
        await page.goto(`${base}&${pageKey}=${current}`, { waitUntil: "networkidle" })
        await expect(pager.locator('[aria-current="page"]')).toHaveText(String(current))
        for (const endpoint of [1, 2, total - 1, total]) await expect(pager.locator(`[data-library-page="${endpoint}"]`)).toBeVisible()
        const ellipsis = pager.locator("[data-library-pagination-ellipsis]").first()
        await expect(ellipsis).toBeVisible()
        expect(await ellipsis.evaluate(element => element.localName)).toBe("span")
        expect(await ellipsis.evaluate(element => element.closest("a"))).toBe(null)
        const geometry = await pager.evaluate(element => {
          const frame = element.getBoundingClientRect()
          const items = Array.from(element.querySelectorAll("li > a, li > span"), item => item.getBoundingClientRect())
          return { left: frame.left, right: frame.right, overflow: element.scrollWidth - element.clientWidth, tops: items.map(item => item.top) }
        })
        expect(geometry.left).toBeGreaterThanOrEqual(0)
        expect(geometry.right).toBeLessThanOrEqual(width)
        expect(geometry.overflow).toBeLessThanOrEqual(1)
        expect(Math.max(...geometry.tops) - Math.min(...geometry.tops)).toBeLessThan(2)
      }
      await expect(pager.locator("[data-library-pagination-next]")).toHaveAttribute("aria-disabled", "true")
      await pager.locator('[data-library-page="1"]').press("Enter")
      await expect(pager.locator('[aria-current="page"]')).toHaveText("1")
      if (kind === "search") await expect(page.locator(".text-search-pagination").first()).not.toHaveAttribute("inert")
      else await expect(page.locator(".searching")).toHaveCount(0)
      await pager.locator("[data-library-pagination-next]").press("Enter")
      await expect(pager.locator('[aria-current="page"]')).toHaveText("2")
      expect(new URL(page.url()).searchParams.getAll("keep")).toEqual(["first", "second"])
      if (kind === "search") for (const filter of ["lemma", "prefix", "suffix", "forfattare", "languages"]) expect(new URL(page.url()).searchParams.has(filter)).toBe(true)
      await expect.poll(() => new URL(page.url()).searchParams.get(pageKey)).toBe("2")
      await page.reload({ waitUntil: "networkidle" })
      await expect(pager.locator('[aria-current="page"]')).toHaveText("2")
      await page.goBack()
      await expect(pager.locator('[aria-current="page"]')).toHaveText("1")
      await pager.locator(`[data-library-page="${total}"]`).click()
      await expect(pager.locator('[aria-current="page"]')).toHaveText(String(total))
      await expect(page.locator(".searching")).toHaveCount(0)
      await page.mouse.move(0, 0)
      expect(await pager.locator('[aria-current="page"]').evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(122, 20, 0)")
      expect(await pager.locator('[aria-current="page"]').evaluate(element => getComputedStyle(element).color)).toBe("rgb(255, 255, 255)")
      await pager.screenshot({ path: testInfo.outputPath(`${kind}-pagination-${width}.png`) })
    })
  }
}

test("pagination hides a one-page set and caps library tail links at API page100", async ({ page }) => {
  await page.goto("/bibliotek?visa=epub&filter=Selma", { waitUntil: "networkidle" })
  await expect(page.locator(".library-pagination")).toHaveCount(0)
  await page.goto("/bibliotek?visa=epub&filter=bounded&sida=100", { waitUntil: "networkidle" })
  const pager = page.locator(".library-pagination").first()
  await expect(pager.locator('[aria-current="page"]')).toHaveText("100")
  expect(await pager.locator("[data-library-page]").evaluateAll(elements => Math.max(...elements.map(element => Number(element.getAttribute("data-library-page")))))).toBe(100)
  await expect(pager.locator("[data-library-pagination-next]")).toHaveAttribute("aria-disabled", "true")
})

test("Search tail links respect the API page10000 limit with larger totals", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.route("**/api/v2/text-search/results", async route => {
    const body = route.request().postDataJSON()
    const response = await route.fetch({ postData: { ...body, page: 1 } })
    const data = await response.json()
    data.page = body.page
    data.totals = { works: 300030, documents: 300030, occurrences: 300030 }
    await route.fulfill({ response, json: data })
  })
  await page.goto("/s%C3%B6k?fras=overflow&traffsida=10000", { waitUntil: "networkidle" })
  const pager = page.locator(".library-pagination").first()
  await expect(pager.locator('[aria-current="page"]')).toHaveText("10000")
  await expect(pager.locator('[data-library-page="10001"]')).toHaveCount(0)
  await expect(pager.locator("[data-library-pagination-next]")).toHaveAttribute("aria-disabled", "true")
  expect(await pager.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
})
