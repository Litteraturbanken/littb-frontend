import {
  expect,
  test,
  type APIRequestContext,
  type Page
} from "@playwright/test"
import { readFileSync } from "node:fs"

const fixture = "http://127.0.0.1:4100"
const richTitlesPath = "/f%C3%B6rfattare/StrindbergA/titlar"
const richMorePath = "/f%C3%B6rfattare/StrindbergA/mer"
const sparseTitlesPath = "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar"
const emptyTitlesPath = "/f%C3%B6rfattare/NoWorks/titlar"
const portraitBytes = readFileSync(
  new URL("../../app/assets/img/lagerlof_portrait.jpg", import.meta.url)
)

type LinkContract = {
  text: string
  href: string | null
  target: string | null
  rel: string | null
  download: string | null
}

async function resetAuthorWorks(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_works_requests`),
    request.delete(`${fixture}/_author_works_failures`),
    request.delete(`${fixture}/_author_works_delays`)
  ])
}

async function authorWorksRequests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixture}/_author_works_requests`)
  return (await response.json() as { requests: string[] }).requests
}

async function routerPush(page: Page, path: string) {
  await page.evaluate(async target => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: {
            $router: { push: (path: string) => Promise<void> }
          }
        }
      }
    }
    await root.__vue_app__?.config.globalProperties.$router?.push(target)
  }, path)
}

async function startRouterPush(page: Page, path: string) {
  await page.evaluate(target => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: {
            $router: { push: (path: string) => Promise<void> }
          }
        }
      }
    }
    const pendingWindow = window as typeof window & {
      __authorWorksPendingPushes?: Promise<unknown>[]
    }
    const pending = pendingWindow.__authorWorksPendingPushes ??= []
    const navigation = root.__vue_app__?.config.globalProperties.$router?.push(target)
    if (navigation) pending.push(navigation.catch(() => undefined))
  }, path)
}

async function awaitPendingRouterPushes(page: Page) {
  await page.evaluate(async () => {
    const pendingWindow = window as typeof window & {
      __authorWorksPendingPushes?: Promise<unknown>[]
    }
    const pending = pendingWindow.__authorWorksPendingPushes ?? []
    pendingWindow.__authorWorksPendingPushes = []
    await Promise.allSettled(pending)
  })
}

function collectProblems(page: Page): string[] {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) problems.push(message.text())
  })
  return problems
}

async function linkContracts(page: Page, selector: string): Promise<LinkContract[]> {
  return await page.locator(selector).evaluateAll(links => links.map(link => ({
    text: link.textContent?.trim() ?? "",
    href: link.getAttribute("href"),
    target: link.getAttribute("target"),
    rel: link.getAttribute("rel"),
    download: link.getAttribute("download")
  })))
}

async function expectRichTitles(page: Page) {
  await expect(page.locator("h1.text-balance.max-w-5xl"))
    .toContainText("August Strindberg (1849-1912)")
  await expect(page.locator(".unbox h2").first()).toHaveText("Tillgängliga verk")
  await expect(page.locator(".unbox")).toContainText("Röda rummet")
  await expect(page.getByRole("img", { name: "Porträtt av August Strindberg" }))
    .toBeVisible()
  await expect(page).toHaveTitle(
    "August Strindberg, Tillgängliga verk | Litteraturbanken"
  )
  await expect(page.locator('meta[name="description"]'))
    .toHaveAttribute("content", "August Strindberg, Tillgängliga verk")
}

async function expectRichMore(page: Page) {
  await expect(page.locator("h1.text-balance.max-w-5xl"))
    .toContainText("August Strindberg (1849-1912)")
  await expect(page.locator(".unbox h2").first()).toHaveText("Verk om August Strindberg")
  await expect(page.locator(".unbox")).toContainText("August Strindberg (1940)")
  await expect(page.locator(".portrait_container, .ext_links")).toHaveCount(0)
  await expect(page).toHaveTitle("August Strindberg, Mer | Litteraturbanken")
  await expect(page.locator('meta[name="description"]'))
    .toHaveAttribute("content", "August Strindberg, Mer")
}

async function expectNoRichResidue(page: Page) {
  await expect(page.locator(
    ".contenttable, .portrait_container img, .portrait_container figcaption, .ext_links"
  ))
    .toHaveCount(0)
  await expect(page.locator("body")).not.toContainText("Röda rummet")
  await expect(page.locator("body")).not.toContainText("Strindbergsmuseet")
}

test.beforeEach(async ({ page, request }) => {
  await resetAuthorWorks(request)
  await page.route("**/red/forfattare/**/*.{jpeg,jpg}", route => route.fulfill({
    status: 200,
    contentType: "image/jpeg",
    body: portraitBytes
  }))
})

test("hydrates both Author Works variants once without warnings or legacy semer fetches", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const browserRequests: string[] = []
  page.on("request", browserRequest => browserRequests.push(browserRequest.url()))

  await page.goto(richTitlesPath, { waitUntil: "networkidle" })
  await expectRichTitles(page)
  expect(await authorWorksRequests(request)).toEqual([
    "/private-v2/authors/StrindbergA/works"
  ])

  await resetAuthorWorks(request)
  await page.goto(richMorePath, { waitUntil: "networkidle" })
  await expectRichMore(page)
  expect(await authorWorksRequests(request)).toEqual([
    "/private-v2/authors/StrindbergA/works"
  ])

  expect(browserRequests.filter(url => new URL(url).pathname.includes("/semer")))
    .toEqual([])
  expect(problems).toEqual([])
})

test("actions and sidebars remain exact native anchors with legacy download behavior", async ({
  context,
  page
}) => {
  await page.goto(richTitlesPath, { waitUntil: "networkidle" })

  expect(await linkContracts(page, ".contenttable td.mediatypes a")).toEqual([
    {
      text: "etext",
      href: "/författare/StrindbergA/titlar/RodaRummet/sida/-1/etext",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "faksimil",
      href: "/författare/StrindbergA/titlar/RodaRummet/sida/1/faksimil",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "infopost",
      href: "/dramawebben/pjäser?om-boken&authorid=StrindbergA&titlepath=RodaRummet",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "epub",
      href: "/txt/epub/StrindbergA_RodaRummet.epub",
      target: "_self",
      rel: null,
      download: "StrindbergA_RodaRummet.epub"
    },
    {
      text: "pdf",
      href: "/export/faksimil/lb238704.pdf",
      target: "_self",
      rel: null,
      download: "StrindbergA_RodaRummet.pdf"
    },
    {
      text: "etext",
      href: "/författare/StrindbergA/titlar/EttDromspelForord/sida/5/etext",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "faksimil",
      href: "/författare/LundinC/titlar/BlandFranskaBonder/sida/1/faksimil",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "etext",
      href: "/författare/LevertinO/titlar/SagorOchSkisser/sida/1/etext",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "faksimil",
      href: "/författare/Flera/titlar/SvenskaOden/sida/1/faksimil",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "epub",
      href: "/txt/epub/BoreliusJ_HemsobornaFranska.epub",
      target: "_self",
      rel: null,
      download: "BoreliusJ_HemsobornaFranska.epub"
    }
  ])

  expect(await linkContracts(page, ".portrait_container .ext_links a")).toEqual([
    {
      text: "Texter om August Strindberg",
      href: "/f%C3%B6rfattare/StrindbergA/mer",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "Presentation",
      href: "/författare/StrindbergA/presentation",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "Bibliografi",
      href: "/författare/StrindbergA/bibliografi",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "Strindbergsmuseet",
      href: "/presentationer/specialomraden/Strindberg.html",
      target: null,
      rel: null,
      download: null
    },
    {
      text: "Litteraturkartan",
      href: "https://litteraturbanken.se/litteraturkartan?s=lb_author.authorid:StrindbergA",
      target: "_blank",
      rel: "noopener noreferrer",
      download: null
    },
    {
      text: "Svenskt biografiskt lexikon",
      href: "https://sok.riksarkivet.se/sbl/Presentation.aspx?id=34558",
      target: "_blank",
      rel: "noopener noreferrer",
      download: null
    },
    {
      text: "Wikipedia",
      href: "https://sv.wikipedia.org/wiki/August_Strindberg",
      target: "_blank",
      rel: "noopener noreferrer",
      download: null
    }
  ])

  await expect(page.getByRole("link", { name: "Ljud", exact: true }))
    .toHaveAttribute("target", "_blank")
  await expect(page.getByRole("link", { name: "Ljud", exact: true }))
    .toHaveAttribute("rel", "noopener noreferrer")
  await expect(page.locator(".contenttable").first().locator(".title a"))
    .toHaveAttribute(
      "href",
      "/författare/StrindbergA/titlar/RodaRummet/sida/-1/etext?om-boken"
    )

  const moreLink = page.getByRole("link", { name: "Texter om August Strindberg" })
  await moreLink.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(new RegExp(`${richMorePath}$`))
  await expectRichMore(page)

  await page.goBack()
  await expectRichTitles(page)
  const titleLink = page.locator(".contenttable").first().locator(".title a")
  const popupPromise = context.waitForEvent("page")
  await titleLink.click({ modifiers: ["ControlOrMeta"] })
  const popup = await popupPromise
  await expect(popup).toHaveURL(
    /\/f%C3%B6rfattare\/StrindbergA\/titlar\/RodaRummet\/sida\/-1\/etext\?om-boken$/
  )
  await popup.close()
})

test("same-variant author navigation makes one request and replaces all author state", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto(richTitlesPath, { waitUntil: "networkidle" })
  await resetAuthorWorks(request)

  await routerPush(page, sparseTitlesPath)
  await expect(page).toHaveURL(new RegExp(`${sparseTitlesPath}$`))
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf (1858-1940)")
  await expect(page.locator(".unbox h2")).toHaveText(["Tillgängliga verk"])
  await expect(page.locator(".unbox")).toContainText("Gösta Berlings saga")
  await expect(page.locator("body")).not.toContainText("August Strindberg")
  await expect(page.locator("body")).not.toContainText("Röda rummet")
  await expect(page.locator("body")).not.toContainText("Strindbergsmuseet")
  await expect(page.locator(".portrait_container img, .portrait_container figcaption"))
    .toHaveCount(0)
  await expect(page.locator(".portrait_container .ext_links")).toHaveCount(1)
  await expect(page).toHaveTitle("Selma Lagerlöf, Tillgängliga verk | Litteraturbanken")
  await expect(page.locator('meta[name="description"]'))
    .toHaveAttribute("content", "Selma Lagerlöf, Tillgängliga verk")
  expect(await authorWorksRequests(request)).toEqual([
    "/v2/authors/Lagerl%C3%B6fS/works"
  ])
  expect(problems).toEqual([])
})

test("titlar and mer transitions replace sections and chrome while preserving the author background", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto(richTitlesPath, { waitUntil: "networkidle" })
  await resetAuthorWorks(request)

  await routerPush(page, richMorePath)
  await expect(page.locator("html")).toHaveAttribute("style", /forf2_bkg\.jpg/)
  await expectRichMore(page)
  await expect(page.locator(".unbox")).not.toContainText("Röda rummet")

  await routerPush(page, richTitlesPath)
  await expect(page.locator("html")).toHaveAttribute("style", /forf2_bkg\.jpg/)
  await expectRichTitles(page)
  await expect(page.locator(".unbox")).not.toContainText(
    "August Strindberg: en levnadsteckning"
  )
  expect(await authorWorksRequests(request)).toEqual([
    "/v2/authors/StrindbergA/works"
  ])
  expect(problems).toEqual([])
})

test("a delayed obsolete author response cannot overwrite the latest author route", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto(richTitlesPath, { waitUntil: "networkidle" })
  await resetAuthorWorks(request)
  await request.put(`${fixture}/_author_works_delays`, {
    data: { "LagerlöfS": 450 }
  })

  await startRouterPush(page, sparseTitlesPath)
  await expect.poll(() => authorWorksRequests(request)).toEqual([
    "/v2/authors/Lagerl%C3%B6fS/works"
  ])
  await startRouterPush(page, emptyTitlesPath)
  await expect.poll(() => authorWorksRequests(request)).toEqual([
    "/v2/authors/Lagerl%C3%B6fS/works",
    "/v2/authors/NoWorks/works"
  ])

  await expect(page).toHaveURL(new RegExp(`${emptyTitlesPath}$`))
  await expect(page.locator("h1")).toContainText("Författare utan tillgängliga verk")
  await expectNoRichResidue(page)
  await expect(page).toHaveTitle(
    "Författare utan tillgängliga verk, Tillgängliga verk | Litteraturbanken"
  )
  await awaitPendingRouterPushes(page)
  await page.waitForTimeout(500)
  await expect(page).toHaveURL(new RegExp(`${emptyTitlesPath}$`))
  await expect(page.locator("h1")).toContainText("Författare utan tillgängliga verk")
  await expect(page.locator("body")).not.toContainText("Selma Lagerlöf")
  await expectNoRichResidue(page)
  expect(problems).toEqual([])
})

test("a delayed obsolete variant response cannot overwrite the latest variant route", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto(sparseTitlesPath, { waitUntil: "networkidle" })
  await resetAuthorWorks(request)
  await request.put(`${fixture}/_author_works_delays`, {
    data: { StrindbergA: 450 }
  })

  await startRouterPush(page, richTitlesPath)
  await expect.poll(() => authorWorksRequests(request)).toEqual([
    "/v2/authors/StrindbergA/works"
  ])
  await request.delete(`${fixture}/_author_works_delays`)
  await startRouterPush(page, richMorePath)
  await expect.poll(() => authorWorksRequests(request)).toEqual([
    "/v2/authors/StrindbergA/works",
    "/v2/authors/StrindbergA/works"
  ])

  await expect(page).toHaveURL(new RegExp(`${richMorePath}$`))
  await expectRichMore(page)
  await awaitPendingRouterPushes(page)
  await page.waitForTimeout(500)
  await expect(page).toHaveURL(new RegExp(`${richMorePath}$`))
  await expectRichMore(page)
  await expect(page.locator(".unbox")).not.toContainText("Röda rummet")
  expect(problems).toEqual([])
})

test("Back and Forward restore the correct cached author and variant identities", async ({
  page
}) => {
  const problems = collectProblems(page)
  await page.goto(richTitlesPath, { waitUntil: "networkidle" })
  await routerPush(page, sparseTitlesPath)
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf")
  await routerPush(page, richMorePath)
  await expectRichMore(page)

  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`${sparseTitlesPath}$`))
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf")
  await expect(page.locator(".unbox")).toContainText("Gösta Berlings saga")
  await expect(page.locator("body")).not.toContainText("August Strindberg")

  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`${richTitlesPath}$`))
  await expectRichTitles(page)

  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`${sparseTitlesPath}$`))
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf")
  await expect(page.locator(".unbox")).toContainText("Gösta Berlings saga")

  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`${richMorePath}$`))
  await expectRichMore(page)
  expect(problems).toEqual([])
})

test("empty, 404, 503, and malformed transitions clear rich content and metadata", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto(richTitlesPath, { waitUntil: "networkidle" })

  const scenarios = [
    {
      authorId: "NoWorks",
      path: emptyTitlesPath,
      finalTitle: "Författare utan tillgängliga verk, Tillgängliga verk | Litteraturbanken",
      finalHeading: "Författare utan tillgängliga verk",
      error: false,
      failure: false
    },
    {
      authorId: "MissingA",
      path: "/f%C3%B6rfattare/MissingA/titlar",
      finalTitle: "Författarverk | Litteraturbanken",
      finalHeading: "författarid MissingA kan inte hittas",
      error: true,
      failure: false
    },
    {
      authorId: "LagerlöfS",
      path: sparseTitlesPath,
      finalTitle: "Författarverk | Litteraturbanken",
      finalHeading: "Författarens verk kan inte visas just nu",
      error: true,
      failure: true
    },
    {
      authorId: "MalformedA",
      path: "/f%C3%B6rfattare/MalformedA/titlar",
      finalTitle: "Författarverk | Litteraturbanken",
      finalHeading: "Författarens verk kan inte visas just nu",
      error: true,
      failure: false
    }
  ] as const

  for (const scenario of scenarios) {
    await routerPush(page, richTitlesPath)
    await expectRichTitles(page)
    await resetAuthorWorks(request)
    await request.put(`${fixture}/_author_works_delays`, {
      data: { [scenario.authorId]: 600 }
    })
    if (scenario.failure) {
      await request.put(`${fixture}/_author_works_failures`, {
        data: { [scenario.authorId]: true }
      })
    }

    await startRouterPush(page, scenario.path)
    await expect.poll(() => authorWorksRequests(request)).toEqual([
      `/v2/authors/${encodeURIComponent(scenario.authorId)}/works`
    ])

    await expect(page.locator("body"), `${scenario.authorId} retained old content while pending`)
      .not.toContainText("Röda rummet", { timeout: 250 })
    await expect.poll(() => page.title(), {
      message: `${scenario.authorId} retained old metadata while pending`,
      timeout: 250
    }).toBe("Författarverk | Litteraturbanken")

    await awaitPendingRouterPushes(page)
    await expect(page).toHaveURL(new RegExp(`${scenario.path}$`))
    await expect(page).toHaveTitle(scenario.finalTitle)
    await expectNoRichResidue(page)
    if (scenario.error) {
      await expect(page.locator(".error")).toContainText(scenario.finalHeading)
      await expect(page.locator("body")).not.toContainText("42")
    } else {
      await expect(page.locator("h1")).toContainText(scenario.finalHeading)
      await expect(page.locator(".error")).toHaveCount(0)
    }
  }
  expect(problems.filter(problem => !/^Failed to load resource: the server responded with a status of (404|503)/.test(problem)))
    .toEqual([])
})
