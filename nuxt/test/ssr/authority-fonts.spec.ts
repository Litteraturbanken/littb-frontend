import { expect, test } from "@playwright/test"
import { parseHTML } from "linkedom"

for (const path of [
  "/", "/om/ide", "/bibliotek", "/sök", "/författare/SöderbergH",
  "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
]) {
  test(`${path} serves the shared Requiem stylesheet before hydration`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    expect(decodeURI(new URL(response.url()).pathname)).toBe(path)

    const { document } = parseHTML(await response.text())
    const fonts = document.querySelectorAll(
      'head > link[rel="stylesheet"]:is([data-authority-fonts], [href*="/601526/"])'
    )

    expect(fonts).toHaveLength(1)
    expect(fonts[0]?.hasAttribute("data-authority-fonts")).toBe(true)
    expect(fonts[0]?.getAttribute("href")).toBe("/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css")
    expect(document.querySelector("noscript link[data-authority-fonts]")).toBeNull()
    expect(document.body.classList.contains("layout-fonts-loading")).toBe(false)
    expect(document.documentElement.classList.contains("layout-fonts-loading")).toBe(true)
  })
}
