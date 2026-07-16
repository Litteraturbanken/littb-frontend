import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

test("captures the current Angular Contact authority without contacting mail delivery", async ({ page }, testInfo) => {
  const contactAttempts: string[] = []
  await page.route("**/*", route => {
    const request = route.request()
    if (new URL(request.url()).pathname.endsWith("/contact")) {
      contactAttempts.push(`${request.method()} ${request.url()}`)
      return route.abort("blockedbyclient")
    }
    return route.continue()
  })

  await page.goto("/om/kontakt", { waitUntil: "domcontentloaded" })
  await expect(page.locator("body")).toHaveClass(/\bready\b/)
  await expect(page.locator("body")).toHaveClass(/\bpage-about\b/)
  await expect(page).toHaveTitle("Om LB | Litteraturbanken")

  const activeLinks = page.locator("ul.links a.active")
  await expect(activeLinks).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Kontakt", exact: true })).toHaveClass(/\bactive\b/)

  const contactForm = page.locator("form.contactform")
  const newsletterForm = page.locator("form.subscribeform")
  await expect(contactForm).toBeVisible()
  await expect(newsletterForm).toBeVisible()
  await expect(contactForm.locator("button.submit")).toBeDisabled()
  await expect(newsletterForm.locator("button.submit")).toBeDisabled()
  await expect(page.locator("#nameInput")).toHaveValue("")
  await expect(page.locator("#emailInput")).toHaveValue("")
  await expect(contactForm.locator("textarea")).toHaveValue("")
  await expect(page.locator("#newsletterEmail")).toHaveValue("")
  await expect(page.locator(".page-contactForm > div").nth(1)).toBeHidden()
  await expect(page.locator(".page-contactForm > div").nth(2)).toBeHidden()
  await expect(page.locator(".page-contactForm > div").nth(3)).toBeHidden()
  await expect(page.locator(".contactform .spinner")).toBeHidden()

  await page.locator("#nameInput").focus({ force: true })
  await expect(page.locator("#nameInput")).toBeFocused()
  await waitForVisualAssets(page)
  expect(contactAttempts).toEqual([])

  if (testInfo.project.name === "angular-mobile") {
    const contactBox = await page.locator(".page-contactForm").boundingBox()
    expect(contactBox?.width).toBe(400)
  }

  const directory = resolve(import.meta.dirname, "baselines")
  await mkdir(directory, { recursive: true })
  const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
  await page.screenshot({
    path: resolve(directory, `contact-${device}.png`),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css"
  })

  expect(contactAttempts).toEqual([])
})
