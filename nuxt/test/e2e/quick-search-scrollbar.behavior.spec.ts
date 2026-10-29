import { expect, test } from "@playwright/test"

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } })

test("keeps its horizontal position while the scrollbar returns during close", async ({ page }) => {
  await page.setViewportSize({ width: 1230, height: 1439 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/s%C3%B6k?avancerad&fras=overflow", { waitUntil: "networkidle" })
  await page.addStyleTag({ content: "html::-webkit-scrollbar { width: 16px; } html::-webkit-scrollbar-thumb { background: #999; }" })
  expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBeGreaterThan(0)
  await page.getByRole("button", { name: "Snabbsökning", exact: true }).click()
  await expect(page.locator("#autocomplete")).toBeFocused()
  await expect(page.locator(".quick-search-presentation")).not.toHaveClass(/quick-search-enter-active/)
  const samples = await page.evaluate(async () => {
    const dialog = document.querySelector<HTMLElement>(".quick-search-modal .modal-dialog")!
    const sample = () => ({
      x: dialog.getBoundingClientRect().x,
      width: dialog.getBoundingClientRect().width,
      gutter: innerWidth - document.documentElement.clientWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    })
    const frames = [sample()]
    document.querySelector("#autocomplete")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    while (dialog.isConnected) {
      await new Promise(requestAnimationFrame)
      if (dialog.isConnected) frames.push(sample())
    }
    return frames
  })
  expect(samples[0]!.gutter).toBe(0)
  expect(samples.some(sample => sample.gutter > 0)).toBe(true)
  for (const sample of samples) {
    expect(sample.x).toBeCloseTo(samples[0]!.x, 1)
    expect(sample.width).toBeCloseTo(samples[0]!.width, 1)
    expect(sample.scrollWidth).toBeLessThanOrEqual(sample.clientWidth)
  }
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Snabbsökning", exact: true })).toBeFocused()
})

test("preserves the mobile modal insets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/s%C3%B6k?avancerad&fras=overflow", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Snabbsökning", exact: true }).click()
  await expect(page.locator("#autocomplete")).toBeFocused()
  const box = (await page.locator(".quick-search-modal").boundingBox())!
  expect(box.x).toBeCloseTo(390 * .03, 1)
  expect(box.width).toBeCloseTo(390 * .94, 1)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
})
