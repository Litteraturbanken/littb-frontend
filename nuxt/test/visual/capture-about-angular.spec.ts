import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const fixtures = [
  ["/red/om/ide/omlitteraturbanken.html", "ide.html", "text/html; charset=utf-8"],
  ["/red/om/ide/organisation.html", "organisation.html", "text/html; charset=utf-8"],
  ["/red/om/rattigheter/rattigheter.html", "rattigheter.html", "text/html; charset=utf-8"],
  ["/red/om/tack.html", "tack.html", "text/html; charset=utf-8"],
  ["/red/om/rattigheter/cc_by.png", "cc_by.png", "image/png"],
  ["/red/om/rattigheter/cc_publicdomain.png", "cc_publicdomain.png", "image/png"]
] as const

const pages = [
  ["ide", "Introduktion"],
  ["organisation", "Organisation"],
  ["rattigheter", "Rättigheter och material"],
  ["tack", "Litteraturbanken tackar"]
] as const

test.beforeEach(async ({ page }) => {
  const responses = new Map(
    await Promise.all(fixtures.map(async ([pathname, filename, contentType]) => [
      pathname,
      {
        contentType,
        body: await readFile(resolve(import.meta.dirname, "../fixtures/about-content", filename))
      }
    ] as const))
  )

  await page.route("**/*", route => {
    const response = responses.get(new URL(route.request().url()).pathname)
    return response
      ? route.fulfill({ status: 200, contentType: response.contentType, body: response.body })
      : route.continue()
  })
})

for (const [slug, heading] of pages) {
  test(`captures the current Angular ${slug} authority`, async ({ page }, testInfo) => {
    await page.goto(`/om/${slug}`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("body")).toHaveClass(/\bready\b/)
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible()
    await waitForVisualAssets(page)

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `about-${slug}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })
  })
}
