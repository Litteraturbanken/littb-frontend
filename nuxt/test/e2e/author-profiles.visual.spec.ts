import { readFileSync } from "node:fs"
import { expect, test, type APIRequestContext } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"

const fixtureOrigin = "http://127.0.0.1:4100"
const portraitBytes = readFileSync(new URL("../../app/assets/img/lagerlof_portrait.jpg", import.meta.url))

type VisualCase = {
  name: "rich" | "sparse" | "dramawebben"
  route: string
  authorId: string
  heading: string
  intro: string
  portraitPath: string | null
}

const visualCases: VisualCase[] = [
  {
    name: "rich",
    route: "/författare/StrindbergA",
    authorId: "StrindbergA",
    heading: "August Strindberg",
    intro: "Han debuterade med Fritänkaren.",
    portraitPath: "/red/forfattare/StrindbergA/StrindbergA_large.jpeg"
  },
  {
    name: "sparse",
    route: "/författare/Lagerl%C3%B6fS",
    authorId: "LagerlöfS",
    heading: "Selma Lagerlöf",
    intro: "Selma Lagerlöf var författare och Nobelpristagare.",
    portraitPath: null
  },
  {
    name: "dramawebben",
    route: "/författare/StrindbergA/dramawebben",
    authorId: "StrindbergA",
    heading: "August Strindberg",
    intro: "Strindberg förnyade det svenska dramat.",
    portraitPath: "/red/forfattare/StrindbergA/StrindbergA_dw_large.jpeg"
  }
]

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixtureOrigin}/_author_profile_requests`),
    request.delete(`${fixtureOrigin}/_author_profile_failure`)
  ])
}

async function profileRequests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixtureOrigin}/_author_profile_requests`)
  return (await response.json() as { requests: string[] }).requests
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

for (const visualCase of visualCases) {
  test(`matches the Angular ${visualCase.name} Author authority`, async ({
    page,
    request
  }, testInfo) => {
    const problems: string[] = []
    const portraitRequests: string[] = []
    const unexpectedApiRequests: string[] = []
    const unexpectedPortraitRequests: string[] = []
    const productionEscapes: string[] = []

    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type()) || /hydration/i.test(message.text())) {
        problems.push(`console ${message.type()}: ${message.text()}`)
      }
    })
    await page.route("**/*", route => {
      const browserRequest = route.request()
      const url = new URL(browserRequest.url())
      const label = `${browserRequest.method()} ${browserRequest.url()}`

      if (url.pathname.startsWith("/red/forfattare/") && url.pathname.endsWith(".jpeg")) {
        if (browserRequest.method() !== "GET" || url.pathname !== visualCase.portraitPath) {
          unexpectedPortraitRequests.push(label)
          return route.abort("blockedbyclient")
        }
        portraitRequests.push(url.pathname)
        return route.fulfill({ status: 200, contentType: "image/jpeg", body: portraitBytes })
      }
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
        productionEscapes.push(label)
        return route.abort("blockedbyclient")
      }
      if (url.pathname.startsWith("/api/")) {
        unexpectedApiRequests.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(visualCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body.focus.page-authorInfo.ready")).toHaveCount(1)
    await expect(page.locator("#mainview h1")).toContainText(visualCase.heading)
    await expect(page.locator(".introtext")).toContainText(visualCase.intro)
    await expect(page.locator(".page_content")).toBeVisible()

    if (visualCase.name === "rich") {
      await expect(page.locator(".introauthor")).toContainText("Gösta M. Bergman")
      await expect(page.locator(".source li")).toHaveCount(2)
      await expect(page.locator(".ext_links")).toHaveCount(2)
      await expect(page.locator(".portrait_container .author_img")).toBeVisible()
    } else if (visualCase.name === "sparse") {
      await expect(page.locator(".source, .pseudonym, .other_name, .ext_links, .portrait_container"))
        .toHaveCount(0)
    } else {
      await expect(page.locator("ul.links li.active")).toHaveText("Dramawebben")
      await expect(page.locator(".introauthor")).toContainText("Dramawebbens redaktion")
      await expect(page.locator(".drama_subtitle")).toBeVisible()
      await expect(page.locator(".ext_links")).toHaveCount(0)
      await expect(page.locator(".portrait_container .author_img")).toBeVisible()
    }

    await waitForVisualAssets(page)
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe("loaded")
    await expect.poll(() => page.locator(".author_img").evaluateAll(images =>
      images.every(image => (image as HTMLImageElement).complete
        && (image as HTMLImageElement).naturalWidth > 0))).toBe(true)

    expect(await profileRequests(request)).toEqual([
      `/private-v2/authors/${encodeURIComponent(visualCase.authorId)}`
    ])
    if (visualCase.portraitPath) {
      expect(portraitRequests.length).toBeGreaterThan(0)
      expect([...new Set(portraitRequests)]).toEqual([visualCase.portraitPath])
    } else {
      expect(portraitRequests).toEqual([])
    }
    expect(unexpectedApiRequests).toEqual([])
    expect(unexpectedPortraitRequests).toEqual([])
    expect(productionEscapes).toEqual([])
    expect(problems).toEqual([])

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`author-${visualCase.name}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })

    expect(await profileRequests(request)).toHaveLength(1)
    expect(unexpectedApiRequests).toEqual([])
    expect(unexpectedPortraitRequests).toEqual([])
    expect(productionEscapes).toEqual([])
    expect(problems).toEqual([])
  })
}
