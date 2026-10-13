import { expect, test } from "@playwright/test"

for (const width of [375, 640, 731, 768, 1023, 1024]) {
  test(`search chips and logo navigation remain aligned at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/s%C3%B6k?avancerad=1&keywords=texttype:brev;brevsamling")
    await page.locator('[data-search-mounted="true"]').waitFor()
    const measure = () => page.locator("#leftCorridor").evaluate(root => {
      const logo = root.querySelector(".lb-logo")!.getBoundingClientRect()
      const menu = root.querySelector(".mainnav")!.getBoundingClientRect()
      return { gap: menu.right - logo.right, width: menu.width }
    })
    const desktop = await measure()
    await page.setViewportSize({ width, height: 711 })
    const current = await measure()
    expect(current.gap).toBeCloseTo(desktop.gap, 0)
    expect(current.width).toBeCloseTo(desktop.width, 0)
    const chip = page.locator(".keyword_select .select2-selection__choice")
    await expect(chip).toContainText("Brev")
    const geometry = await chip.evaluate(node => {
      const remove = node.querySelector("button")!.getBoundingClientRect()
      const label = node.querySelector(".select2-selection__choice-label")!.getBoundingClientRect()
      const frame = node.getBoundingClientRect()
      return { removeTop: remove.top, labelTop: label.top, height: frame.height,
        labelRight: label.right, chipRight: frame.right }
    })
    expect(Math.abs(geometry.removeTop - geometry.labelTop)).toBeLessThan(4)
    expect(geometry.height).toBeLessThan(25)
    expect(geometry.labelRight).toBeLessThanOrEqual(geometry.chipRight + 1)
    if (width < 1024) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    }
    await chip.getByRole("button", { name: "Ta bort Brev" }).click()
    await expect(chip).toHaveCount(0)
  })
}

for (const width of [375, 731, 768, 1440]) {
  test(`Library filter placeholders share left padding at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 711 })
    await page.goto("/bibliotek?avancerat=1")
    await page.locator("[data-library-advanced-panel]").waitFor()
    for (const name of ["Filtrera: Kategorier / Utgivare", "Om ett författarskap",
      "Avgränsa sökningen", "Utgivningsformat", "Språk …"]) {
      const input = page.getByRole("textbox", { name, exact: true })
      await expect(input).toHaveCSS("padding-left", "10px")
      await input.fill("test")
      await expect(input).toHaveCSS("padding-left", "10px")
      await input.press("Escape")
      await expect(input).toHaveCSS("padding-left", "10px")
    }
  })
}

for (const width of [731, 1440]) {
  test(`empty title search toggles on repeated clicks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 711 })
    await page.goto("/s%C3%B6k?avancerad=1&keywords=texttype:brev;brevsamling&infix=1&ej_modern=1")
    await page.locator('[data-search-mounted="true"]').waitFor()
    const control = page.getByRole("combobox", { name: "Titlar", exact: true })
    const input = control.getByRole("textbox", { name: "Titlar", exact: true })
    await input.click()
    await expect(control).toHaveAttribute("aria-expanded", "true")
    await input.click()
    await expect(control).toHaveAttribute("aria-expanded", "false")
    await input.click()
    await expect(control).toHaveAttribute("aria-expanded", "true")
    await input.fill("brev")
    await input.click()
    await expect(control).toHaveAttribute("aria-expanded", "true")
    await expect(input).toHaveValue("brev")
    await input.press("Escape")
    await expect(control).toHaveAttribute("aria-expanded", "false")
  })
}

for (const width of [375, 731, 1440]) {
  test(`dropdown highlights fill their rows and keyboard navigation stays visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/s%C3%B6k?avancerad=1')
    await page.locator('[data-search-mounted="true"]').waitFor()
    for (const name of ['Filtrera: Kategorier / Utgivare', 'Titlar', 'Författarskap']) {
      const control = page.getByRole('combobox', { name, exact: true })
      const input = control.getByRole('textbox', { name, exact: true })
      await input.click()
      await page.mouse.move(0, 0)
      const measure = () => control.evaluate(root => {
        const list = root.querySelector<HTMLElement>('.multiselect__content-wrapper')!
        const active = root.querySelector<HTMLElement>('.multiselect__option--highlight')!
        const frame = list.getBoundingClientRect()
        const row = active.getBoundingClientRect()
        return { top: row.top - frame.top - list.clientTop,
          bottom: row.bottom - frame.top - list.clientTop,
          height: list.clientHeight, scroll: list.scrollTop,
          rightGap: frame.left + list.clientLeft + list.clientWidth - row.right }
      })
      for (const key of [...Array<string>(22).fill('ArrowDown'), ...Array<string>(22).fill('ArrowUp')]) {
        const before = await measure()
        await input.press(key)
        const after = await measure()
        expect(after.top).toBeGreaterThanOrEqual(-1)
        expect(after.bottom).toBeLessThanOrEqual(after.height + 1)
        expect(Math.abs(after.rightGap)).toBeLessThanOrEqual(1)
        if (Math.abs(after.scroll - before.scroll) > 1) {
          expect(Math.min(Math.abs(after.top), Math.abs(after.bottom - after.height))).toBeLessThanOrEqual(1)
        }
      }
      await input.press('Escape')
    }
  })
}
