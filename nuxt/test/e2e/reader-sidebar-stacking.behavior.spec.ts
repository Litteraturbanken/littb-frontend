import { expect, test } from "@playwright/test"

for (const reader of [
  { name: "public", path: "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil" },
  { name: "editor", path: "/editor/lb-editor-doktor/ix/1/f" }
]) {
  test(`${reader.name} sidebar controls stay above enlarged and rotated facsimiles`, async ({ page }, testInfo) => {
    // The generic API fixture serves square placeholder images. Use a portrait
    // scan here so a real rotation crosses the neighboring sidebar.
    await page.route("**/txt/**/*.jpeg", route => route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="625" height="900"><rect width="625" height="900" fill="#eee"/><path d="M40 40H585V860H40Z" fill="white" stroke="#777"/></svg>'
    }))
    await page.goto(reader.path, { waitUntil: "networkidle" })
    const image = page.locator("img.faksimil")
    const controls = page.locator("#toolkit .reader-facsimile-controls")
    const larger = controls.getByRole("button", { name: "Större", exact: true })
    await larger.click()
    await expect(image).toHaveCSS("width", "900px")
    await larger.click()
    await expect(image).toHaveCSS("width", "1250px")
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete)).toBe(true)
    const rotateRight = controls.getByRole("button", { name: "Höger", exact: true })
    let coveredButtons = 0
    for (const matrix of [
      "matrix(0, 1, -1, 0, 0, 0)",
      "matrix(-1, 0, 0, -1, 0, 0)",
      "matrix(0, -1, 1, 0, 0, 0)"
    ]) {
      await rotateRight.click()
      await expect(image).toHaveCSS("transform", matrix)
      for (const name of ["Mindre", "Större", "Vänster", "Höger"]) {
        const button = controls.getByRole("button", { name, exact: true })
        await button.scrollIntoViewIfNeeded()
        const hit = await button.evaluate(element => {
          const box = element.getBoundingClientRect()
          const point = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
          const top = document.elementFromPoint(point.x, point.y)
          const image = document.querySelector("img.faksimil")!.getBoundingClientRect()
          return {
            buttonOnTop: element === top || element.contains(top),
            overlapsImage: point.x >= image.left && point.x <= image.right
              && point.y >= image.top && point.y <= image.bottom,
            topElement: top?.tagName
          }
        })
        if (hit.overlapsImage) coveredButtons++
        expect(hit.buttonOnTop, `Control was covered by ${hit.topElement} at ${matrix}`).toBe(true)
      }
    }
    expect(coveredButtons, "The enlarged rotated image must actually cross the controls").toBeGreaterThan(0)
    await page.screenshot({ path: testInfo.outputPath(`${reader.name}-rotated-sidebar.png`) })
    await controls.getByRole("button", { name: "Mindre", exact: true }).click()
    await expect(image).toHaveCSS("width", "900px")
    await expect(image).toHaveCSS("transform", "matrix(0, -1, 1, 0, 0, 0)")
  })
}
