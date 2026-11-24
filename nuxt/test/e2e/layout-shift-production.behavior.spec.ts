import { expect, test, type Page } from "@playwright/test"

declare global {
  interface Window {
    __productionLayoutShift: number
    __productionLayoutShiftSources: string[]
    __productionLayoutShiftObserver: PerformanceObserver
    __productionLayoutShiftGeneration: number
    __restartProductionLayoutShiftObserver: () => void
  }
}

type RouteCase = {
  name: string
  path: string
  fromPath?: string
  viewport: { width: number, height: number }
}

const affectedRoutes: RouteCase[] = [
  {
    name: "Home desktop",
    path: "/",
    fromPath: "/bibliotek?visa=epub&sort=popularitet",
    viewport: { width: 1440, height: 1000 }
  },
  {
    name: "Home mobile",
    path: "/",
    fromPath: "/bibliotek?visa=epub&sort=popularitet",
    viewport: { width: 390, height: 844 }
  },
  {
    name: "Library desktop",
    path: "/bibliotek?visa=epub&sort=popularitet",
    viewport: { width: 1440, height: 1000 }
  },
  {
    name: "EPUB mobile",
    path: "/epub?visa=epub&sort=popularitet",
    viewport: { width: 390, height: 844 }
  },
  {
    name: "Presentations desktop",
    path: "/presentationer",
    viewport: { width: 1440, height: 1000 }
  },
  {
    name: "About mobile",
    path: "/om/ide",
    viewport: { width: 390, height: 844 }
  },
  {
    name: "author desktop",
    path: "/f%C3%B6rfattare/StrindbergA",
    viewport: { width: 1440, height: 1000 }
  }
]

async function observeProductionLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__restartProductionLayoutShiftObserver = () => {
      window.__productionLayoutShiftObserver?.disconnect()
      window.__productionLayoutShiftGeneration = (window.__productionLayoutShiftGeneration ?? 0) + 1
      const generation = window.__productionLayoutShiftGeneration
      window.__productionLayoutShift = 0
      window.__productionLayoutShiftSources = []
      window.__productionLayoutShiftObserver = new PerformanceObserver((list) => {
        if (generation !== window.__productionLayoutShiftGeneration) return
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput?: boolean
            value?: number
          }
          const sources = (shift as typeof shift & {
            sources?: Array<{ node?: Node | null }>
          }).sources ?? []
          const sourceLabels = sources.map(source => {
            const node = source.node
            if (!(node instanceof Element)) return "unknown"
            const identity = node.id ? `#${node.id}` : node.className
              ? `.${String(node.className).trim().replace(/\s+/g, ".")}`
              : node.tagName.toLowerCase()
            return `${identity}: ${node.textContent?.trim().slice(0, 80) ?? ""}`
          })
          if (!shift.hadRecentInput) {
            window.__productionLayoutShift += shift.value ?? 0
            window.__productionLayoutShiftSources.push(...sourceLabels)
          }
        }
      })
      window.__productionLayoutShiftObserver.observe({ type: "layout-shift" })
    }
    window.__restartProductionLayoutShiftObserver()
  })
}

for (const routeCase of affectedRoutes) {
  test(`${routeCase.name} keeps production layout shift below one percent`, async ({ page }) => {
    await page.setViewportSize(routeCase.viewport)
    await observeProductionLayoutShift(page)
    if (routeCase.fromPath) {
      await page.route("**/red/om/start/startsida-ny.html?*", async (route) => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await route.continue()
      })
    }

    const response = await page.goto(routeCase.fromPath ?? routeCase.path, { waitUntil: "networkidle" })
    expect(response?.ok()).toBe(true)
    await page.evaluate(() => document.fonts.ready)
    if (routeCase.fromPath) {
      const navigation = page.getByRole("link", { name: "Litteraturbanken", exact: true }).click()
      await page.waitForTimeout(100)
      await expect(page.locator("body")).toHaveClass(/\bpage-start\b/)
      await expect(page.getByRole("heading", { name: "Litteraturbanken", exact: true }))
        .toBeVisible()
      await expect(page.locator('.searching[role="status"]')).toHaveText("Laddar startsidan")
      await expect(page.locator('head link[rel="stylesheet"][href*="startsida.css"]'))
        .toHaveCount(1)
      await navigation
      await page.waitForURL(routeCase.path)
      await expect(page.locator("body")).toHaveClass(/\bpage-start\b/)
      await expect(page.locator(".home-editorial")).toBeVisible()
      await expect(page.locator('head link[rel="stylesheet"][href*="startsida.css"]'))
        .toHaveCount(1)
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.__restartProductionLayoutShiftObserver()
          resolve()
        })
      })))
      await page.waitForLoadState("networkidle")
    }
    await page.waitForTimeout(200)
    await expect(page.locator("html")).not.toHaveClass(/\blayout-fonts-loading\b/)

    if (routeCase.fromPath) {
      await expect(page.locator("body")).toHaveClass(/\bpage-start\b/)
    }

    const diagnostics = await page.evaluate(() => ({
      shift: window.__productionLayoutShift,
      sources: window.__productionLayoutShiftSources
    }))
    expect(diagnostics.shift, diagnostics.sources.join("\n"))
      .toBeLessThan(0.01)
  })
}

test("Home reserves Requiem metrics while the authority font stylesheet is unavailable", async ({
  page
}) => {
  await page.route("**/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css", route => route.abort())

  const response = await page.goto("/", { waitUntil: "domcontentloaded" })
  expect(response?.ok()).toBe(true)
  await expect(page.locator("html")).toHaveClass(/\blayout-fonts-loading\b/)
  await expect(page.locator("body")).toHaveClass(/\bpage-start\b/)

  const fontFamilies = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    navigation: getComputedStyle(document.querySelector(".mainnav") as Element).fontFamily,
    heading: getComputedStyle(document.querySelector("#mainview h1") as Element).fontFamily
  }))
  expect(fontFamilies.body).toContain("Requiem Text Fallback")
  expect(fontFamilies.navigation).toContain("Requiem Display Fallback")
  expect(fontFamilies.heading).toContain("Requiem Display Fallback")
})

for (const routeCase of [
  { name: "Library", path: "/bibliotek?visa=epub&sort=popularitet" },
  { name: "EPUB", path: "/epub?visa=epub&sort=popularitet" },
  { name: "Presentations", path: "/presentationer" }
]) {
  test(`${routeCase.name} keeps the header line box stable when Requiem replaces its fallback`, async ({
    page
  }) => {
    const authorityStylesheet = "**/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css*"
    await page.route(authorityStylesheet, route => route.abort())

    const response = await page.goto(routeCase.path, { waitUntil: "domcontentloaded" })
    expect(response?.ok()).toBe(true)
    const heading = page.locator("#mainview h1").first()
    await expect(heading).toBeVisible()

    const fallbackBox = await heading.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const rect = range.getBoundingClientRect()
      return { top: rect.top, height: rect.height }
    })

    await page.unroute(authorityStylesheet)
    await page.evaluate(async () => {
      const stylesheet = document.createElement("link")
      stylesheet.rel = "stylesheet"
      stylesheet.href = "/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css?layout-metrics"
      document.head.append(stylesheet)
      await new Promise<void>((resolve, reject) => {
        stylesheet.addEventListener("load", () => resolve(), { once: true })
        stylesheet.addEventListener("error", () => reject(new Error("authority font CSS failed")), {
          once: true
        })
      })
      await document.fonts.load('60px "Requiem Display A"', "Botanisera Hämta Presentationer")
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })

    const authorityBox = await heading.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const rect = range.getBoundingClientRect()
      return { top: rect.top, height: rect.height }
    })
    const deltas = {
      top: Math.abs(authorityBox.top - fallbackBox.top),
      height: Math.abs(authorityBox.height - fallbackBox.height)
    }
    expect(deltas.top, JSON.stringify({ fallbackBox, authorityBox }, null, 2)).toBe(0)
    expect(deltas.height, JSON.stringify({ fallbackBox, authorityBox }, null, 2))
      .toBeLessThanOrEqual(1)
  })
}

test("About keeps submenu wrapping stable when Requiem replaces its fallback", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const authorityStylesheet = "**/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css*"
  await page.route(authorityStylesheet, route => route.abort())

  const response = await page.goto("/om/ide", { waitUntil: "domcontentloaded" })
  expect(response?.ok()).toBe(true)
  const links = page.locator(".links li")
  await expect(links.first()).toBeVisible()

  const textBoxes = () => links.evaluateAll(elements => elements.map((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const rect = range.getBoundingClientRect()
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width }
  }))
  const fallbackBoxes = await textBoxes()

  await page.unroute(authorityStylesheet)
  await page.evaluate(async () => {
    const stylesheet = document.createElement("link")
    stylesheet.rel = "stylesheet"
    stylesheet.href = "/assets/styles/fonts/601526/FD3D54C3A22C4D32B.css?about-layout-metrics"
    document.head.append(stylesheet)
    await new Promise<void>((resolve, reject) => {
      stylesheet.addEventListener("load", () => resolve(), { once: true })
      stylesheet.addEventListener("error", () => reject(new Error("authority font CSS failed")), {
        once: true
      })
    })
    await document.fonts.load('16px "Requiem Text SC A"', "Rättigheter Statistik Kontakt Organisation Tack")
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })

  const authorityBoxes = await textBoxes()
  const deltas = authorityBoxes.map((box, index) => ({
    height: Math.abs(box.height - fallbackBoxes[index].height),
    top: Math.abs(box.top - fallbackBoxes[index].top),
    width: Math.abs(box.width - fallbackBoxes[index].width)
  }))
  const rowPattern = (boxes: typeof fallbackBoxes) => {
    const rows: number[] = []
    return boxes.map(box => {
      let row = rows.findIndex(top => Math.abs(top - box.top) <= 1)
      if (row === -1) row = rows.push(box.top) - 1
      return row
    })
  }
  expect(rowPattern(fallbackBoxes)).toEqual([0, 0, 0, 1, 1, 1, 2])
  expect(rowPattern(authorityBoxes)).toEqual([0, 0, 0, 1, 1, 1, 2])
  expect(Math.max(...deltas.map(delta => delta.width))).toBeLessThanOrEqual(6)
  expect(Math.max(...deltas.map(delta => delta.top))).toBeLessThanOrEqual(2)
  expect(Math.max(...deltas.map(delta => delta.height))).toBeLessThanOrEqual(5)
})
