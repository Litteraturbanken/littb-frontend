import { expect, test } from "@playwright/test"

const readerUrl = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"

test("WebKit keeps Requiem kerning within one regular font face", async ({
  browserName,
  page
}) => {
  expect(browserName).toBe("webkit")

  await page.goto(readerUrl, { waitUntil: "networkidle" })
  const stylesheet = page.locator('link[data-authority-fonts]')
  await expect(stylesheet).toHaveCount(1)

  const typography = await page.evaluate(async () => {
    const family = '"Requiem Text A", "Requiem Text B", serif'
    await document.fonts.load(`64px ${family}`, "Tu")
    await document.fonts.ready

    const probe = document.createElement("span")
    probe.textContent = "Tu"
    Object.assign(probe.style, {
      fontFamily: family,
      fontSize: "64px",
      fontStyle: "normal",
      fontVariantLigatures: "none",
      fontWeight: "400",
      position: "absolute",
      visibility: "hidden",
      whiteSpace: "nowrap"
    })
    document.body.append(probe)

    probe.style.fontKerning = "none"
    const unkernedWidth = probe.getBoundingClientRect().width
    probe.style.fontKerning = "normal"
    const kernedWidth = probe.getBoundingClientRect().width
    probe.remove()

    return {
      href: document.querySelector<HTMLLinkElement>(
        'link[data-authority-fonts]'
      )?.href,
      kernedWidth,
      regularFaces: [...document.fonts]
        .filter(face => (
          face.status === "loaded"
          && face.style === "normal"
          && face.weight === "400"
          && /^Requiem Text [AB]$/u.test(face.family)
        ))
        .map(face => face.family)
        .sort(),
      unkernedWidth
    }
  })

  expect(typography.kernedWidth).toBeLessThan(typography.unkernedWidth - 1)
  expect(typography.regularFaces).toEqual(["Requiem Text A"])
  expect(new URL(typography.href ?? "").pathname).toBe(
    "/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css"
  )
})
