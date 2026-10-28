import { expect, test } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

for (const width of [390, 1440]) {
  test(`bordered presentation uses the main document scrollbar at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.route("**/app/style/*.css*", async route => {
      const url = new URL(route.request().url())
      const response = await route.fetch({ url: `${fixture}${url.pathname}${url.search}` })
      await route.fulfill({ response })
    })
    await page.goto("/presentationer/specialomraden/Rostratt.html", { waitUntil: "networkidle" })
    const content = page.locator("body.page-presentation.bkg-add-border #mainview > .content")
    await expect(content).toBeVisible()
    await expect(content.locator("h1")).toBeVisible()
    await expect(content).toHaveCSS("overflow-y", "visible")
    await expect(content).toHaveCSS("max-height", "none")
    const box = await content.boundingBox()
    expect(box!.height).toBeGreaterThan(1000)
    expect(await content.evaluate(element => Math.abs(element.scrollHeight - element.clientHeight))).toBeLessThanOrEqual(1)
    const point = await content.evaluate(element => {
      const box = element.getBoundingClientRect()
      return { x: box.left + box.width / 2, y: Math.max(0, box.top) + 100 }
    })
    await page.mouse.move(point.x, point.y)
    const before = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 500)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100)
    expect(await content.evaluate(element => element.scrollTop)).toBe(0)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(() => content.evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1001)
    await page.screenshot({ path: testInfo.outputPath(`presentation-window-scroll-${width}.png`) })
  })
}
