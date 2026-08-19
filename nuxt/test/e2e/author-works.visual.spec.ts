import { readFileSync } from "node:fs"
import { expect, test, type APIRequestContext } from "@playwright/test"

import { waitForVisualAssets } from "../helpers/visual"
import { fixtureOrigin } from "../helpers/test-origins"

const nuxtPort = Number(process.env.LITTB_NUXT_TEST_PORT || 3000)
const nuxtOrigin = `http://127.0.0.1:${nuxtPort}`
const portraitBytes = readFileSync(
  new URL("../../app/assets/img/lagerlof_portrait.jpg", import.meta.url)
)

type VisualCase = {
  name: "rich-titlar" | "rich-mer" | "sparse-titlar"
  route: string
  authorId: string
  heading: string
  sectionHeadings: string[]
  firstTitle: string
  activeLink: string | null
  portraitPath: string | null
  externalLinkBlocks: number
}

const visualCases: VisualCase[] = [
  {
    name: "rich-titlar",
    route: "/f%C3%B6rfattare/StrindbergA/titlar",
    authorId: "StrindbergA",
    heading: "August Strindberg (1849-1912)",
    sectionHeadings: [
      "Tillgängliga verk",
      "Dikter, noveller, essäer, etc. som ingår i andra verk",
      "Som fotograf",
      "Som illustratör",
      "Som utgivare",
      "Som översättare"
    ],
    firstTitle: "Röda rummet",
    activeLink: "Verk",
    portraitPath: "/red/forfattare/StrindbergA/StrindbergA_large.jpeg",
    externalLinkBlocks: 2
  },
  {
    name: "rich-mer",
    route: "/f%C3%B6rfattare/StrindbergA/mer",
    authorId: "StrindbergA",
    heading: "August Strindberg (1849-1912)",
    sectionHeadings: [
      "Verk om August Strindberg",
      "Kortare texter om August Strindberg",
      "Som utgivare",
      "Som översättare"
    ],
    firstTitle: "August Strindberg (1940)",
    activeLink: null,
    portraitPath: null,
    externalLinkBlocks: 0
  },
  {
    name: "sparse-titlar",
    route: "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar",
    authorId: "LagerlöfS",
    heading: "Selma Lagerlöf (1858-1940)",
    sectionHeadings: ["Tillgängliga verk"],
    firstTitle: "Gösta Berlings saga (1891)",
    activeLink: "Verk",
    portraitPath: null,
    externalLinkBlocks: 1
  }
]

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixtureOrigin}/_author_works_requests`),
    request.delete(`${fixtureOrigin}/_author_works_failures`),
    request.delete(`${fixtureOrigin}/_author_works_delays`)
  ])
}

async function worksRequests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixtureOrigin}/_author_works_requests`)
  return (await response.json() as { requests: string[] }).requests
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

for (const visualCase of visualCases) {
  test(`matches the Angular ${visualCase.name} Author Works authority`, async ({
    page,
    request
  }, testInfo) => {
    const problems: string[] = []
    const portraitRequests: string[] = []
    const unexpectedApiRequests: string[] = []
    const unexpectedPortraitRequests: string[] = []
    const semerRequests: string[] = []
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

      if (url.pathname.includes("/semer")) {
        semerRequests.push(label)
        return route.abort("blockedbyclient")
      }
      if (url.pathname.startsWith("/red/forfattare/")) {
        if (
          browserRequest.method() !== "GET"
          || url.origin !== nuxtOrigin
          || url.search !== ""
          || url.pathname !== visualCase.portraitPath
        ) {
          unexpectedPortraitRequests.push(label)
          return route.abort("blockedbyclient")
        }
        portraitRequests.push(url.pathname)
        return route.fulfill({
          status: 200,
          contentType: "image/jpeg",
          body: portraitBytes
        })
      }
      if (url.origin !== nuxtOrigin) {
        productionEscapes.push(label)
        return route.abort("blockedbyclient")
      }
      if (url.pathname.startsWith("/api/")) {
        unexpectedApiRequests.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    if (visualCase.name === "rich-titlar" && testInfo.project.name === "desktop-chromium") {
      const fixtureProbe = `${fixtureOrigin}/private-v2/authors/StrindbergA/works?probe=fixture`
      const localOriginProbe = "http://127.0.0.1:65534/probe-local-origin"
      const nonJpegPortraitProbe = `${nuxtOrigin}/red/forfattare/StrindbergA/probe.png`
      const queryPortraitProbe = `${nuxtOrigin}${visualCase.portraitPath}?probe=portrait`

      for (const url of [
        fixtureProbe,
        localOriginProbe,
        nonJpegPortraitProbe,
        queryPortraitProbe
      ]) {
        await page.evaluate(async target => {
          await fetch(target).catch(() => undefined)
        }, url)
      }

      expect({
        productionEscapes,
        unexpectedPortraitRequests,
        worksRequests: await worksRequests(request)
      }).toEqual({
        productionEscapes: [
          `GET ${fixtureProbe}`,
          `GET ${localOriginProbe}`
        ],
        unexpectedPortraitRequests: [
          `GET ${nonJpegPortraitProbe}`,
          `GET ${queryPortraitProbe}`
        ],
        worksRequests: []
      })
      productionEscapes.length = 0
      unexpectedPortraitRequests.length = 0
      problems.length = 0
    }

    const response = await page.goto(visualCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body.focus.page-authorInfo.ready")).toHaveCount(1)
    await expect(page.locator("#mainview h1")).toHaveText(visualCase.heading)
    await expect(page.locator(".preloader")).toBeHidden()
    await expect(page.locator("#mainview h1").locator(".."))
      .not.toHaveClass(/searching/)
    await expect(page.locator(".page_content")).toBeVisible()
    await expect(page.locator(".unbox h2")).toHaveText(visualCase.sectionHeadings)
    await expect(page.locator(".contenttable")).toHaveCount(visualCase.sectionHeadings.length)
    await expect(page.locator(".contenttable tbody tr")).toHaveCount(
      visualCase.sectionHeadings.length
    )
    await expect(page.locator(".contenttable").first()).toContainText(visualCase.firstTitle)
    await expect(page.locator(".ext_links")).toHaveCount(visualCase.externalLinkBlocks)

    if (visualCase.activeLink) {
      await expect(page.locator("ul.links li.active")).toHaveText(visualCase.activeLink)
    } else {
      await expect(page.locator("ul.links li.active")).toHaveCount(0)
    }
    if (visualCase.portraitPath) {
      await expect(page.locator(".portrait_container .author_img")).toBeVisible()
      await expect(page.locator(".contenttable").first().locator(".mediatypes a"))
        .toHaveText(["etext", "faksimil", "infopost", "epub", "pdf"])
    } else {
      await expect(page.locator(".portrait_container .author_img")).toHaveCount(0)
      if (visualCase.name === "sparse-titlar") {
        await expect(page.locator(".contenttable").first().locator(".mediatypes a"))
          .toHaveText(["faksimil"])
      }
    }

    await waitForVisualAssets(page)
    if (testInfo.project.name === "desktop-chromium") {
      await expect.poll(() => page.locator("#mainview h1").evaluate(element => (
        getComputedStyle(element).fontSize
      ))).toBe("40px")
    }
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe("loaded")
    await expect.poll(() => page.locator("img").evaluateAll(images => images.every(image => (
      (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0
    )))).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(() => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })))
      .toEqual({ x: 0, y: 0 })

    expect(await worksRequests(request)).toEqual([
      `/private-v2/authors/${encodeURIComponent(visualCase.authorId)}/works`
    ])
    if (visualCase.portraitPath) {
      expect(portraitRequests.length).toBeGreaterThan(0)
      expect([...new Set(portraitRequests)]).toEqual([visualCase.portraitPath])
    } else {
      expect(portraitRequests).toEqual([])
    }
    expect(unexpectedApiRequests).toEqual([])
    expect(unexpectedPortraitRequests).toEqual([])
    expect(semerRequests).toEqual([])
    expect(productionEscapes).toEqual([])
    expect(problems).toEqual([])

    const device = testInfo.project.name === "mobile-chromium" ? "mobile" : "desktop"
    await expect(page).toHaveScreenshot(`author-works-${visualCase.name}-${device}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 100
    })

    expect(await worksRequests(request)).toHaveLength(1)
    expect(unexpectedApiRequests).toEqual([])
    expect(unexpectedPortraitRequests).toEqual([])
    expect(semerRequests).toEqual([])
    expect(productionEscapes).toEqual([])
    expect(problems).toEqual([])
  })
}
