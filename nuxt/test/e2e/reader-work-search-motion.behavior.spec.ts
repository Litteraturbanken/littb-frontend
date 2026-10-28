import { expect, test } from "@playwright/test"

const readers = [
  ["public", "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"],
  ["editor", "/editor/lb8345227/ix/4/f"]
] as const

for (const [kind, path] of readers) {
  test(`${kind} work-search disclosure wipes, reverses, and preserves its state`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.goto(`${path}?keep=%2f&keep=%2F`, { waitUntil: "networkidle" })
    const trigger = page.locator(".reader-context .subnav").getByRole("button", { name: "Sök i verket", exact: true })
    const panel = page.locator(".reader-context .searchbox")
    const input = panel.getByRole("searchbox", { name: "Sök i verket" })
    const insertion = panel.evaluate(element => new Promise<{ animations: number, opacity: number, targetHeight: string }>(resolve => {
      const observer = new MutationObserver(() => {
        const animation = element.getAnimations()[0]
        if (!animation) return
        observer.disconnect()
        requestAnimationFrame(() => resolve({
          animations: element.getAnimations().length,
          opacity: Number(getComputedStyle(element).opacity),
          targetHeight: String((animation.effect as KeyframeEffect).getKeyframes().at(-1)?.height)
        }))
      })
      observer.observe(element, { attributes: true })
    }))
    await trigger.click()
    const opening = await insertion
    expect(opening.animations).toBeGreaterThan(0)
    expect(opening.opacity).toBeLessThan(1)
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(input).toBeFocused()
    await expect.poll(() => panel.evaluate(element => element.getAnimations().length)).toBe(0)
    await expect(panel).toHaveCSS("overflow", "visible")
    await expect(panel).toHaveCSS("border", "1px solid rgb(169, 169, 169)")
    await expect(panel).toHaveCSS("margin", "9px 0px")
    const restingHeight = await panel.evaluate(element => getComputedStyle(element).height)
    expect(opening.targetHeight).toBe(restingHeight)
    await input.fill("brev")
    const closingAnimations = await trigger.evaluate(element => new Promise<number>(resolve => {
      const panel = element.parentElement!.querySelector(".searchbox")!
      const button = element as HTMLElement
      const observer = new MutationObserver(() => {
        const animations = panel.getAnimations().length
        if (!animations || !panel.hasAttribute("inert")) return
        observer.disconnect()
        button.click()
        resolve(animations)
      })
      observer.observe(panel, { attributes: true })
      button.click()
    }))
    expect(closingAnimations).toBeGreaterThan(0)
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(input).toBeFocused()
    await expect(input).toHaveValue(kind === "public" ? "" : "brev")
    await expect.poll(() => panel.evaluate(element => element.getAnimations().length)).toBe(0)
    await expect(panel).not.toHaveAttribute("inert")
    await expect(panel).toHaveCSS("height", restingHeight)
    await expect(panel).toHaveCSS("overflow", "visible")
    expect(new URL(page.url()).searchParams.getAll("keep")).toEqual(["/", "/"])
    await panel.screenshot({ path: testInfo.outputPath(`${kind}-work-search-open.png`) })
    await trigger.click()
    await expect(panel).toBeHidden()
    await expect(panel).toHaveAttribute("inert", "")
    await trigger.press("Enter")
    await expect(input).toBeFocused()
    await expect(input).toHaveValue(kind === "public" ? "" : "brev")
    await expect(panel).toBeVisible()
  })

  test(`${kind} work-search disclosure respects reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto(path, { waitUntil: "networkidle" })
    const trigger = page.locator(".reader-context .subnav").getByRole("button", { name: "Sök i verket", exact: true })
    const panel = page.locator(".reader-context .searchbox")
    await trigger.click()
    await expect(panel).toBeVisible()
    expect(await panel.evaluate(element => element.getAnimations().length)).toBe(0)
    await expect(panel).toHaveCSS("overflow", "visible")
    await trigger.click()
    await expect(panel).toBeHidden()
  })
}
