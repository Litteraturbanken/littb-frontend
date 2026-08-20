import type { Page } from "@playwright/test"

export async function waitForVisualAssets(page: Page) {
  if (await page.locator(".site-shell").count()) {
    await page.evaluate(async () => {
      let stylesheet = document.querySelector<HTMLLinkElement>('link[data-authority-fonts]')
      if (!stylesheet) {
        stylesheet = document.createElement("link")
        stylesheet.rel = "stylesheet"
        stylesheet.href = "/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css"
        stylesheet.dataset.authorityFonts = ""
        document.head.append(stylesheet)
      }
      if (stylesheet.sheet) return
      await new Promise<void>(resolve => {
        stylesheet.addEventListener("load", () => resolve(), { once: true })
        stylesheet.addEventListener("error", () => resolve(), { once: true })
      })
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
}
