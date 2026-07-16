import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

test("matches the populated Angular Library shell at desktop and mobile", async ({
  page
}, testInfo) => {
  const problems: string[] = []
  const forbidden: string[] = []
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      problems.push(`console: ${message.text()}`)
    }
  })
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      forbidden.push(`${route.request().method()} ${route.request().url()}`)
      return route.abort("blockedbyclient")
    }
    return route.continue()
  })

  const response = await page.goto("/bibliotek", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
  await expect(page.locator("[data-library-result]")).toHaveCount(3)
  await expect(page.locator("[data-library-advanced]")).toBeDisabled()
  await expect(page.locator("[data-library-filter-icon]")).toBeVisible()
  await expect(page.locator("[data-library-author-name] .surname")).toHaveText("Strindberg")

  const mobile = testInfo.project.name === "mobile-chromium"
  if (mobile) {
    await expect(page.locator("[data-library-author-mobile-years]"))
      .toHaveText("(1849–1912)")
    await expect(page.locator("[data-library-author-mobile-years]")).toBeVisible()
  } else {
    await expect(page.locator("[data-library-author-mobile-years]")).toBeHidden()
    await expect(page.locator("[data-library-result]").nth(1).locator("td").nth(2))
      .toHaveText("1849–1912")
  }

  await waitForVisualAssets(page)
  await expect(page.locator("html")).toHaveCSS(
    "background-image",
    /biblioteket_bakgrund\.jpg/
  )
  await expect(page).toHaveScreenshot(`library-${mobile ? "mobile" : "desktop"}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    threshold: 0.1,
    maxDiffPixels: 100
  })
  expect(forbidden).toEqual([])
  expect(problems).toEqual([])
})
