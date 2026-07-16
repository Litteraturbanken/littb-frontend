import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const fixtureRoot = resolve(import.meta.dirname, "../fixtures/home-content")
const expectedContentPaths = new Set([
  "/red/om/start/startsida-ny.html",
  "/red/css/startsida.css",
  "/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg"
])

function querySuffix(requestPath: string, pathname: string) {
  expect(requestPath.startsWith(pathname)).toBe(true)
  return requestPath.slice(pathname.length)
}

test("captures the current Angular Home authority", async ({ page }, testInfo) => {
  const [editorialHtml, runtimeCss, backgroundImage, authorityFonts] = await Promise.all([
    readFile(resolve(fixtureRoot, "startsida-ny.html")),
    readFile(resolve(fixtureRoot, "startsida.css")),
    readFile(resolve(fixtureRoot, "start_bkg_172_2026.jpg")),
    readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css"))
  ])
  const seenContentRequests: string[] = []
  const forbiddenProductionRequests: string[] = []
  const unexpectedContentRequests: string[] = []

  await page.route("**/*", route => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname === "/red/om/start/startsida-ny.html") {
      seenContentRequests.push(`${url.pathname}${url.search}`)
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: editorialHtml })
    }
    if (url.pathname === "/red/css/startsida.css") {
      seenContentRequests.push(`${url.pathname}${url.search}`)
      return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: runtimeCss })
    }
    if (url.pathname === "/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg") {
      seenContentRequests.push(`${url.pathname}${url.search}`)
      return route.fulfill({ status: 200, contentType: "image/jpeg", body: backgroundImage })
    }
    if (url.pathname === "/red/css/etext.css") {
      return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" })
    }
    if (url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml") {
      return route.fulfill({
        status: 200,
        contentType: "application/xml; charset=utf-8",
        body: "<backgrounds />"
      })
    }
    if (url.hostname === "cloud.typography.com") {
      return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: authorityFonts })
    }
    if (url.hostname === "www.googletagmanager.com") {
      return route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: "" })
    }
    if (url.pathname.startsWith("/red/") && !expectedContentPaths.has(url.pathname)) {
      unexpectedContentRequests.push(`${request.method()} ${request.url()}`)
      return route.abort("blockedbyclient")
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      forbiddenProductionRequests.push(`${request.method()} ${request.url()}`)
      return route.abort("blockedbyclient")
    }
    return route.continue()
  })

  const response = await page.goto("/", { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  await expect(page.locator("body")).toHaveClass(/\bfocus\b.*\bpage-start\b.*\bready\b/)
  await expect(page.getByRole("heading", { name: "Litteraturbanken", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Nytt & anmärkningsvärt", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Lärdomsstaden Uppsala", exact: true })).toBeVisible()
  await expect(page.locator(".start_footerinfo")).toContainText("LITTERATURBANKENS BIBLIOTEK")
  await expect(page.getByRole("link", { name: /Jan Gossaert/ })).toBeVisible()

  const runtimeStylesheet = page.locator(
    'link[rel="stylesheet"][href^="/red/css/startsida.css?"]'
  )
  await expect(runtimeStylesheet).toHaveCount(1)
  await expect.poll(async () => page.evaluate(() =>
    [...document.styleSheets].some(sheet => sheet.href?.includes("/red/css/startsida.css?"))
  )).toBe(true)
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(51, 51, 51)")
  await expect(page.locator("html")).toHaveCSS("background-repeat", "no-repeat")
  await expect(page.locator("html")).toHaveCSS("background-image", /start_bkg_172_2026\.jpg/)
  await expect(page.getByRole("heading", { name: "Nytt & anmärkningsvärt", exact: true })).toHaveCSS(
    "margin-top",
    "0px"
  )
  await expect(page.locator("#leftCorridor")).toBeVisible()
  await expect(page.locator("#mainview")).toBeVisible()

  await waitForVisualAssets(page)
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")
  const fragmentRequests = seenContentRequests.filter(path => path.startsWith(
    "/red/om/start/startsida-ny.html"
  ))
  const stylesheetRequests = seenContentRequests.filter(path => path.startsWith(
    "/red/css/startsida.css"
  ))
  expect(fragmentRequests).toHaveLength(1)
  expect(stylesheetRequests).toHaveLength(1)
  expect(querySuffix(fragmentRequests[0] ?? "", "/red/om/start/startsida-ny.html")).toBe(
    querySuffix(stylesheetRequests[0] ?? "", "/red/css/startsida.css")
  )
  expect(seenContentRequests.filter(path => path === "/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg")).toHaveLength(2)
  expect(seenContentRequests).toHaveLength(4)
  expect(forbiddenProductionRequests).toEqual([])
  expect(unexpectedContentRequests).toEqual([])

  const directory = resolve(import.meta.dirname, "baselines")
  await mkdir(directory, { recursive: true })
  const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
  await page.screenshot({
    path: resolve(directory, `home-${device}.png`),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css"
  })

  expect(forbiddenProductionRequests).toEqual([])
  expect(unexpectedContentRequests).toEqual([])
})
