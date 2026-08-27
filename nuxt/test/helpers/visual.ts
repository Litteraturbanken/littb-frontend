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
    await Promise.all(
      [...document.images]
        .filter(image => image.naturalWidth > 0)
        .map(image => image.decode())
    )
    const background = getComputedStyle(document.documentElement).backgroundImage
    const match = background.match(/url\(["']?(.+?)["']?\)/)
    if (match) {
      let decoded = false
      let lastError: unknown
      for (let attempt = 0; attempt < 3 && !decoded; attempt += 1) {
        const image = new Image()
        image.src = match[1]
        try {
          await image.decode()
          decoded = true
        } catch (error) {
          lastError = error
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
      if (!decoded) throw lastError
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
      const settle = () => document.documentElement.classList.contains("layout-fonts-loading")
        ? requestAnimationFrame(settle)
        : resolve()
      settle()
    })
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}
