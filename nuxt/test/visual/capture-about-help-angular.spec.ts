import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const fixtures = [
  ["/red/om/visioner/visioner.html", "mal.html"],
  ["/red/om/ide/english.html", "english.html"],
  ["/red/om/ide/deutsch.html", "deutsch.html"],
  ["/red/om/ide/francais.html", "francais.html"],
  ["/red/om/hjalp/hjalp.html", "hjalp.html"]
] as const

const pages = [
  ["mal", "/om/mål", "Mål", false],
  ["english", "/om/english.html", "The Swedish Literature Bank", false],
  ["deutsch", "/om/deutsch.html", "Die Schwedische Literaturbank", false],
  ["francais", "/om/francais.html", "La Banque de littérature suédoise", false],
  ["hjalp", "/om/hjalp", "Hjälp", true]
] as const

test.beforeEach(async ({ page }) => {
  const responses = new Map(
    await Promise.all(fixtures.map(async ([pathname, filename]) => [
      pathname,
      await readFile(resolve(import.meta.dirname, "../fixtures/about-content", filename))
    ] as const))
  )

  await page.route("**/*", route => {
    const body = responses.get(new URL(route.request().url()).pathname)
    return body
      ? route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body })
      : route.continue()
  })
})

for (const [baseline, route, marker, isHelp] of pages) {
  test(`captures the current Angular ${baseline} authority`, async ({ page }, testInfo) => {
    await page.goto(route, { waitUntil: "domcontentloaded" })
    await expect(page.locator("body")).toHaveClass(/\bready\b/)
    await expect(page.getByRole("heading", { name: marker, exact: false }).first()).toBeVisible()

    const activeLinks = page.locator("ul.links a.active")
    if (isHelp) {
      await expect(activeLinks).toHaveCount(1)
      await expect(page.getByRole("link", { name: "Hjälp", exact: true })).toHaveClass(/\bactive\b/)
      await expect(page.locator("#toolkit ul.help_submenu.sticky")).toHaveCount(1)
      await expect(page.locator(".help_content .help_submenu")).toHaveCount(0)
    } else {
      await expect(activeLinks).toHaveCount(0)
    }

    await waitForVisualAssets(page)

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `about-${baseline}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })
  })
}
