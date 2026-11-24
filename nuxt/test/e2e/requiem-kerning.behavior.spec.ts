import { expect, test, type Page } from "@playwright/test"

const readerUrl = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"

async function expectRequiemKerning(page: Page, pairs: string[]) {
  const typography = await page.evaluate(async pairs => {
    const family = '"Requiem Text A", "Requiem Text B", serif'
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
  }, pairs)

  for (const { pair, kerned, unkerned } of typography.widths) {
    expect(kerned, `Requiem must kern ${pair}`).toBeLessThan(unkerned - 1)
  }
  expect(typography.regularFaces).toEqual(["Requiem Text A"])
  await expect(page.locator('link[data-authority-fonts]')).toHaveCount(1)
  expect(new URL(typography.href ?? "").pathname).toBe(
    "/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css"
  )
}

test("the reader keeps Requiem kerning within one regular font face", async ({ page }) => {
  await page.goto(readerUrl, { waitUntil: "networkidle" })
  await expectRequiemKerning(page, ["Tu", "Äl"])
})

test("the homepage kerns the Tr pair in Tre", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" })
  await expectRequiemKerning(page, ["Tr"])
})
