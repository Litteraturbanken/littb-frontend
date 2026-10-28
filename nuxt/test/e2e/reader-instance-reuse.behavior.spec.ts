import { expect, test, type Page } from "@playwright/test"

type ReaderElement = HTMLElement & { __vueParentComponent?: { uid: number } }
declare global {
  interface Window {
    readerReuseProbe: {
      root: ReaderElement
      viewport: ReaderElement
      uid: number
      minimumTop: number
      removed: boolean
    }
  }
}

async function captureReader(page: Page, top: number) {
  await page.evaluate(top => {
    const root = document.querySelector<ReaderElement>(".reader-page")!
    const viewport = root.querySelector<ReaderElement>(".reader_main")!
    const uid = root.__vueParentComponent?.uid
    if (uid === undefined) throw new Error("The reader page Vue instance is unavailable")
    window.scrollTo(0, top)
    const probe = window.readerReuseProbe = {
      root, viewport, uid, minimumTop: window.scrollY, removed: false
    }
    new MutationObserver(records => {
      for (const record of records) {
        for (const removed of record.removedNodes) {
          if (removed === root || removed.contains(root)
            || removed === viewport || removed.contains(viewport)) probe.removed = true
        }
      }
    }).observe(document.querySelector("#__nuxt")!, { childList: true, subtree: true })
    window.addEventListener("scroll", () => {
      probe.minimumTop = Math.min(probe.minimumTop, window.scrollY)
    })
  }, top)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(top)
}

async function expectRetainedReader(page: Page, top: number) {
  expect(await page.evaluate(() => {
    const probe = window.readerReuseProbe
    return {
      sameRoot: document.querySelector(".reader-page") === probe.root,
      sameVueInstance: document.querySelector<ReaderElement>(".reader-page")?.__vueParentComponent?.uid === probe.uid,
      sameViewport: document.querySelector(".reader_main") === probe.viewport,
      connected: probe.root.isConnected && probe.viewport.isConnected,
      removed: probe.removed,
      minimumTop: probe.minimumTop,
      top: window.scrollY
    }
  })).toEqual({
    sameRoot: true, sameVueInstance: true, sameViewport: true,
    connected: true, removed: false, minimumTop: top, top
  })
}

const cases = [
  { name: "public facsimile", initial: "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil", target: "/sida/5/faksimil", next: "Nästa sida", editor: false },
  { name: "public etext", initial: "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext", target: "/sida/-1/etext", next: "Nästa sida", editor: false },
  { name: "editor facsimile", initial: "/editor/lb-editor-doktor/ix/1/f", target: "/ix/2/f", next: "Nästa sida", editor: true },
  { name: "editor etext", initial: "/editor/lb-editor-doktor-glas/ix/1/e", target: "/ix/2/e", next: "Nästa sida", editor: true }
]

for (const item of cases) {
  test(`${item.name} reuses its page and reader viewport without a top jump during delayed page navigation`, async ({ page }) => {
    // Keep the fixture's small text pages long enough to distinguish a preserved
    // viewport from the browser clamping an actually shorter document.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style")
        style.textContent = ".reader_main { min-height: 1800px !important }"
        document.head.append(style)
      })
    })
    await page.route(item.editor ? "**/nuxt-api/editor/**" : "**/nuxt-api/reader/**", async route => {
      await new Promise(resolve => setTimeout(resolve, 650))
      await route.continue()
    })
    await page.goto(item.initial, { waitUntil: "networkidle" })
    await expect(page.locator(".reader_main")).toBeVisible()
    await captureReader(page, 180)
    const next = page.getByRole("link", { name: item.next, exact: true }).first()
    // Invoke the same native click handler without Playwright first scrolling an
    // offscreen sidebar control into view, which would obscure router scrolling.
    await next.evaluate(link => (link as HTMLAnchorElement).click())
    await expect(page).toHaveURL(new RegExp(item.target + "(?:\\?|$)"))
    await page.waitForTimeout(100)
    await expectRetainedReader(page, 180)
    await page.waitForTimeout(850)
    await expectRetainedReader(page, 180)
    await page.goBack()
    await expect(page).toHaveURL(item.initial)
    await page.waitForTimeout(850)
    await expectRetainedReader(page, 180)
    await page.goForward()
    await expect(page).toHaveURL(new RegExp(item.target + "(?:\\?|$)"))
    await page.waitForTimeout(850)
    await expectRetainedReader(page, 180)
  })
}
