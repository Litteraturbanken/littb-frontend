import type { Page } from "@playwright/test"

export async function waitForVisualAssets(page: Page) {
  const hasSiteShell = Boolean(await page.locator(".site-shell").count())
  if (hasSiteShell) {
    await page.waitForFunction(() => {
      const stylesheet = document.querySelector<HTMLLinkElement>('link[data-authority-fonts]')
      if (!stylesheet?.sheet) return false
      try {
        return [...stylesheet.sheet.cssRules]
          .some(rule => rule.cssText.includes('font-family: "Requiem Text A"'))
      } catch {
        return false
      }
    })
  }
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images]
        .filter(image => !image.complete)
        .map(image => new Promise(resolve => {
          image.addEventListener("load", resolve, { once: true })
          image.addEventListener("error", resolve, { once: true })
        }))
    )
    const background = getComputedStyle(document.documentElement).backgroundImage
    const match = background.match(/url\(["']?(.+?)["']?\)/)
    if (match) {
      const image = new Image()
      image.src = match[1]
      await image.decode()
    }
  })
  await page.evaluate(async () => {
    const authorityFaces = [...document.fonts].filter(face => {
      const family = face.family.replace(/^['"]|['"]$/g, "")
      return family.startsWith("Requiem ") || family.startsWith("Verlag ")
    })
    await Promise.all(authorityFaces.map(face => face.load()))
    await document.fonts.ready
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}
