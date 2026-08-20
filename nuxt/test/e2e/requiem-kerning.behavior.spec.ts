import { expect, test } from "@playwright/test"

const readerUrl = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"

test("each browser keeps Requiem kerning within one regular font face", async ({
  browserName,
  page
}) => {
  expect(["chromium", "firefox", "webkit"]).toContain(browserName)

  await page.goto(readerUrl, { waitUntil: "networkidle" })
  const stylesheet = page.locator('link[data-authority-fonts]')
  await expect(stylesheet).toHaveCount(1)

  const typography = await page.evaluate(async () => {
    const family = '"Requiem Text A", "Requiem Text B", serif'
    const pairs = ["Tu", "Äl"]
    await Promise.all(pairs.map(pair => document.fonts.load(`256px ${family}`, pair)))
    await document.fonts.ready

    const probe = document.createElement("span")
    Object.assign(probe.style, {
      fontFamily: family,
      fontSize: "256px",
      fontStyle: "normal",
      fontVariantLigatures: "none",
      fontWeight: "400",
      position: "absolute",
      visibility: "hidden",
      whiteSpace: "nowrap"
    })
    document.body.append(probe)

    const widths = pairs.map(pair => {
      probe.textContent = pair
      probe.style.fontKerning = "none"
      const unkerned = probe.getBoundingClientRect().width
      probe.style.fontKerning = "normal"
      return {
        kerned: probe.getBoundingClientRect().width,
        pair,
        unkerned
      }
    })
    probe.remove()

    return {
      href: document.querySelector<HTMLLinkElement>(
        'link[data-authority-fonts]'
      )?.href,
      regularFaces: [...document.fonts]
        .filter(face => (
          face.status === "loaded"
          && face.style === "normal"
          && face.weight === "400"
        ))
        .map(face => face.family.replace(/^"|"$/gu, ""))
        .filter(familyName => /^Requiem Text [AB]$/u.test(familyName))
        .sort(),
      widths
    }
  })

  for (const { kerned, unkerned } of typography.widths) {
    expect(kerned).toBeLessThan(unkerned - 1)
  }
  expect(typography.regularFaces).toEqual(["Requiem Text A"])
  expect(new URL(typography.href ?? "").pathname).toBe(
    "/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css"
  )
})
