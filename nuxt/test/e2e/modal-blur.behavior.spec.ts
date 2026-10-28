import { expect, test, type Locator, type Page } from "@playwright/test"

const parts = "/författare/SöderbergH/titlar/DoktorGlasParts/sida/-1/etext"
const etext = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const editor = "/editor/lb-editor-boye/ix/4/f"

// Observe the actual modal mutation before sampling: route-owned reader
// dialogs can be inserted on a later frame than the trigger's click.
async function changeModal(trigger: Locator, opening: boolean) {
  return trigger.evaluate((element, opening) => new Promise<{
    filter: string, dialogFilter: string | null, portaled: boolean
  }>(resolve => {
    const main = document.querySelector("#mainview")!
    getComputedStyle(main).getPropertyValue("filter")
    const matches = () => Boolean(document.querySelector('.modal[role="dialog"][aria-modal="true"]')) === opening
      && (opening || !document.body.classList.contains("modal-open"))
    const sample = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      const dialog = document.querySelector('.modal[role="dialog"][aria-modal="true"]')
      resolve({
        filter: getComputedStyle(main).filter,
        dialogFilter: dialog ? getComputedStyle(dialog).filter : null,
        portaled: !dialog || !main.contains(dialog)
      })
    }))
    const observer = new MutationObserver(() => {
      if (!matches()) return
      observer.disconnect()
      sample()
    })
    observer.observe(document.body, { attributes: true, childList: true, subtree: true })
    ;(element as HTMLElement).click()
    if (matches()) {
      observer.disconnect()
      sample()
    }
  }), opening)
}

function partialBlur(filter: string) {
  const match = /^blur\(([\d.]+)px\)$/.exec(filter)
  expect(match, `Expected an intermediate blur, got ${filter}`).not.toBeNull()
  const amount = Number(match![1])
  expect(amount).toBeGreaterThan(0)
  expect(amount).toBeLessThan(4)
}

async function verifyModal(page: Page, trigger: Locator, name: string, reduced = false) {
  const main = page.locator("#mainview")
  await expect(main).toHaveCSS("filter", "none")
  const opened = await changeModal(trigger, true)
  if (reduced) expect(opened.filter).toBe("blur(4px)")
  else partialBlur(opened.filter)
  expect(opened.dialogFilter).toBe("none")
  expect(opened.portaled).toBe(true)
  const dialog = page.getByRole("dialog", { name, exact: true })
  await expect(dialog).toBeVisible()
  await expect(main).toHaveCSS("filter", "blur(4px)")
  const closed = await changeModal(dialog.getByRole("button", { name: "Stäng", exact: true }), false)
  if (reduced) expect(closed.filter).toBe("none")
  else partialBlur(closed.filter)
  await expect(dialog).toHaveCount(0)
  await expect(main).toHaveCSS("filter", "none")
  await expect(page.locator("body")).not.toHaveClass(/\bmodal-open\b/)
}

for (const [kind, route] of [["public", parts], ["editor", editor]] as const) {
  for (const [label, name] of [["Innehållsförteckning", "Innehållsförteckning"], ["Mer om boken", "Om boken"]] as const) {
    test(`${kind} ${name} animates background blur both ways`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" })
      await page.goto(route, { waitUntil: "networkidle" })
      const trigger = page.locator(".reader-context .subnav").getByRole("link", { name: label, exact: true })
      await verifyModal(page, trigger, name)
      await expect(trigger).toBeFocused()
    })
  }
}

test("enlarged etext images blur their background and clear it after Escape", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.route("**/bilder/ornament/reader-fixture.png", route => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#ddd"/></svg>'
  }))
  await page.goto(etext, { waitUntil: "networkidle" })
  await page.locator("img.graphicimg").evaluate(image => { (image as HTMLElement).style.width = "100px" })
  const opened = await changeModal(page.getByRole("button", { name: "Förstora", exact: true }), true)
  partialBlur(opened.filter)
  expect(opened.portaled).toBe(true)
  await expect(page.locator("#mainview")).toHaveCSS("filter", "blur(4px)")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Förstorad bild" })).toHaveCount(0)
  await expect(page.locator("#mainview")).toHaveCSS("filter", "none")
})

test("overlapping dictionary and source modals retain blur until the last closes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto(etext, { waitUntil: "networkidle" })
  const word = page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first()
  await word.evaluate(element => {
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(element)
    selection.removeAllRanges()
    selection.addRange(range)
    element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
  })
  const opened = await changeModal(page.getByRole("button", { name: "Slå upp DOKTOR i Svensk ordbok", exact: true }), true)
  partialBlur(opened.filter)
  await expect(page.locator(".reader-dictionary-modal")).toBeVisible()
  await expect(page.locator("#mainview")).toHaveCSS("filter", "blur(4px)")
  // Routed dialogs may overlap. Closing the top dialog must retain the blur
  // while the underlying dictionary is still open, with no duplicated state.
  await page.locator('.reader-context .subnav a[href*="om-boken"]')
    .evaluate(link => (link as HTMLAnchorElement).click())
  const source = page.getByRole("dialog", { name: "Om boken" })
  const dictionary = page.locator(".reader-dictionary-modal")
  await expect(source).toBeVisible()
  await expect(dictionary).toHaveCount(1)
  await expect(page.locator("#mainview")).toHaveCSS("filter", "blur(4px)")
  // The dictionary still owns pointer focus. Dispatch the routed source close
  // handler (the same state change as Back) without clicking through it.
  await source.locator("button.close_btn").evaluate(button => (button as HTMLButtonElement).click())
  await expect(source).toHaveCount(0)
  await expect(dictionary).toBeVisible()
  await expect(page.locator("#mainview")).toHaveCSS("filter", "blur(4px)")
  const closed = await changeModal(dictionary.getByRole("button", { name: "Stäng", exact: true }), false)
  partialBlur(closed.filter)
  await expect(dictionary).toHaveCount(0)
  await expect(page.locator("#mainview")).toHaveCSS("filter", "none")
})

for (const width of [1440, 390]) {
  test(`editor modal blur respects reduced motion at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto(editor, { waitUntil: "networkidle" })
    const trigger = page.getByRole("link", { name: "Mer om boken", exact: true }).first()
    await verifyModal(page, trigger, "Om boken", true)
    expect(await page.locator("#mainview").evaluate(element => element.getAnimations().length)).toBe(0)
  })
}


test("nonmodal download format popovers keep their background sharp", async ({ page }) => {
  await page.goto("/bibliotek?avancerat=1&nedladdning=1", { waitUntil: "networkidle" })
  await page.locator('[data-library-mounted="true"]').waitFor()
  await page.locator("[data-library-source-checkbox]").first().check({ force: true })
  await page.locator("[data-library-format-button]").click()
  const popover = page.getByRole("dialog", { name: "Välj format" })
  await expect(popover).toBeVisible()
  await expect(popover).not.toHaveAttribute("aria-modal", "true")
  await expect(page.locator("#mainview")).toHaveCSS("filter", "none")
  await page.keyboard.press("Escape")
  await expect(popover).toHaveCount(0)
})


test("outside clicks dismiss contents and finish background unblurring", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto(parts, { waitUntil: "networkidle" })
  const trigger = page.locator(".reader-context .subnav").getByRole("link", { name: "Innehållsförteckning", exact: true })
  await trigger.click()
  await expect(page.getByRole("dialog", { name: "Innehållsförteckning" })).toBeVisible()
  await expect(page.locator("#mainview")).toHaveCSS("filter", "blur(4px)")
  await page.mouse.click(2, 2)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.locator("#mainview")).toHaveCSS("filter", "none")
  await expect(trigger).toBeFocused()
})
