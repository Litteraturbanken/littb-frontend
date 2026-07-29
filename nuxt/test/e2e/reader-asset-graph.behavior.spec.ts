import { expect, test } from "@playwright/test"

const readerUrl = "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"

test("the production reader does not load assets owned by unrelated routes", async ({ page }) => {
  await page.goto(readerUrl, { waitUntil: "networkidle" })

  const resourceUrls = await page.evaluate(() => (
    performance.getEntriesByType("resource")
      .map(entry => entry.name)
  ))

  expect(resourceUrls.filter(url => /dramawebben/i.test(url))).toEqual([])
  expect(resourceUrls.filter(url => /SA_logo_type/i.test(url))).toEqual([])
  expect(resourceUrls.filter(url => /vue-multiselect/i.test(url))).toEqual([])
  expect(resourceUrls.filter(url => /\/(?:bibliotek|s%C3%B6k)\.[^/]+\.(?:css|js)$/i.test(url))).toEqual([])
  expect(resourceUrls.filter(url => (
    /fontawesome-webfont/i.test(url) && !/\.woff2(?:\?|$)/i.test(url)
  ))).toEqual([])
})

test("asset splitting preserves the reader's established typography and icons", async ({ page }) => {
  await page.goto(readerUrl, { waitUntil: "networkidle" })
  await expect(page.locator(".reader_main .etext")).toBeVisible()

  const typography = await page.locator(".reader_main .etext").evaluate(element => {
    const style = getComputedStyle(element)
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight
    }
  })
  const iconFont = await page.locator(".fa").first().evaluate(element => (
    getComputedStyle(element).fontFamily
  ))

  expect(typography.fontFamily).toMatch(/Requiem/i)
  expect(typography.fontSize).not.toBe("0px")
  expect(typography.lineHeight).not.toBe("normal")
  expect(iconFont).toMatch(/FontAwesome/i)
})

test("the licensed authority font sheet is fetched independently of route CSS", async ({ page }) => {
  await page.goto(readerUrl, { waitUntil: "networkidle" })

  const stylesheetUrls = await page.locator('link[rel="stylesheet"]').evaluateAll(links => (
    links.map(link => (link as HTMLLinkElement).href)
  ))

  expect(stylesheetUrls.some(url => /32FBEBA806C948833/i.test(url))).toBe(true)
  await expect(page.locator(
    'link[rel="stylesheet"][href*="32FBEBA806C948833"][data-authority-fonts]'
  )).toHaveCount(1)
})

test("the visible icon font is preloaded without a stylesheet discovery chain", async ({ page }) => {
  await page.goto(readerUrl, { waitUntil: "networkidle" })

  await expect(page.locator(
    'link[rel="preload"][as="font"][href="/assets/fonts/font-awesome/fontawesome-littb.woff2"]'
  )).toHaveCount(1)
})
