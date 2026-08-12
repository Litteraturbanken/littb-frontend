import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"

import { managedHtmlRawProbes } from "../fixtures/author-profile-data.mjs"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || "4100"}`
const portraitBytes = readFileSync(new URL("../../app/assets/img/lagerlof_portrait.jpg", import.meta.url))

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_profile_requests`),
    request.delete(`${fixture}/_author_profile_failure`)
  ])
}

async function profileRequests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixture}/_author_profile_requests`)
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
    const router = root.__vue_app__?.config.globalProperties.$router
    await router?.push(target)
  }, path)
}

async function beginRouterPush(page: Page, path: string) {
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
    const router = root.__vue_app__?.config.globalProperties.$router
    void router?.push(target)
  }, path)
}

async function installTransitionLedger(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: {
            $router: {
              afterEach: (callback: (to: { fullPath: string }) => void) => void
            }
          }
        }
      }
    }
    const statefulWindow = window as typeof window & { __authorTransitions?: string[] }
    statefulWindow.__authorTransitions = []
    root.__vue_app__?.config.globalProperties.$router.afterEach(to => {
      statefulWindow.__authorTransitions?.push(to.fullPath)
    })
  })
}

async function transitionLedger(page: Page): Promise<string[]> {
  return await page.evaluate(() => (
    window as typeof window & { __authorTransitions?: string[] }
  ).__authorTransitions ?? [])
}

function collectProblems(page: Page): string[] {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) problems.push(message.text())
  })
  return problems
}

test.beforeEach(async ({ page, request }) => {
  await reset(request)
  await page.route("**/red/forfattare/**/*.jpeg", route => route.fulfill({
    status: 200,
    contentType: "image/jpeg",
    body: portraitBytes
  }))
})

test("hydrates the rich profile without warnings or duplicate browser requests", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })

  await expect(page.locator("h1")).toContainText("August Strindberg")
  await expect(page.locator(".introtext")).toContainText("Han debuterade med Fritänkaren.")
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/StrindbergA"])
  expect(problems).toEqual([])
})

test("does not render an unsafe backend author search URL", async ({ page, request }) => {
  const problems = collectProblems(page)
  await page.goto("/författare/UnsafeSearch", { waitUntil: "networkidle" })
  const navigation = page.getByRole("navigation", { name: "Författarsidor" })

  await expect(navigation.getByRole("link", { name: "Sök i texterna" })).toHaveCount(0)
  await expect(page.locator('a[href*="evil.invalid"]')).toHaveCount(0)
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/UnsafeSearch"])
  expect(problems).toEqual([])
})

test("does not render an unsafe backend portrait or leave its caption behind", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/UnsafePortrait", { waitUntil: "networkidle" })

  await expect(page.locator('img[src*="evil.invalid"]')).toHaveCount(0)
  await expect(page.locator("figcaption")).toHaveCount(0)
  expect(await page.content()).not.toContain("evil.invalid")
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/UnsafePortrait"])
  expect(problems).toEqual([])
})

test("hydrates credential-free author links with hardened named targets", async ({ page }) => {
  const problems = collectProblems(page)
  await page.goto("/författare/ManagedHtmlProbe", { waitUntil: "networkidle" })
  const intro = page.locator(".introtext")

  expect(await intro.getByText("Credential profile link").getAttribute("href")).toBeNull()
  await expect(intro.getByRole("link", { name: "Named profile link" }))
    .toHaveAttribute("rel", "editorial noopener noreferrer")
  await expect(intro.getByRole("link", { name: "Named profile link" }))
    .toHaveAttribute("target", "author_profile")
  await expect(intro.getByRole("link", { name: "Self profile link" }))
    .toHaveAttribute("rel", "author")
  expect(await page.content()).not.toContain("reader:secret@evil.invalid")
  expect(problems).toEqual([])
})

test("managed HTML hydrates without retaining raw provider markers", async ({ page }) => {
  const problems = collectProblems(page)
  for (const [path, intended] of [
    [
      "/författare/ManagedHtmlProbe",
      ["Ordinary intended intro", "Ordinary intended source", "Ordinary intended caption"]
    ],
    [
      "/författare/ManagedHtmlProbe/dramawebben",
      ["Drama intended intro", "Drama intended source", "Drama intended caption"]
    ]
  ] as const) {
    await page.goto(path, { waitUntil: "networkidle" })
    await expect(page.locator(".introtext")).toContainText(intended[0])
    await expect(page.locator(".source_content")).toContainText(intended[1])
    await expect(page.locator("figcaption")).toContainText(intended[2])
    const html = await page.content()
    for (const probe of managedHtmlRawProbes) expect(html, probe).not.toContain(probe)
  }
  expect(problems).toEqual([])
})

test("sanitized-empty Drama prose hydrates as one ordinary fallback bundle", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/SanitizedFallback/dramawebben", { waitUntil: "networkidle" })
  const intro = page.locator(".introtext")

  await expect(intro).toContainText("Ordinary fallback introduction.")
  await expect(intro.locator(".introauthor em")).toHaveText("Ordinary fallback editor")
  await expect(intro.locator(".source_content")).toHaveText("Ordinary fallback source")
  await expect(intro.getByRole("link", { name: "Dramawebben" })).toHaveAttribute(
    "href",
    "/dramawebben"
  )
  await expect(page.getByRole("img", { name: "Porträtt av Sanerad Reservprofil" }))
    .toHaveAttribute("src", "/red/forfattare/StrindbergA/StrindbergA_dw_large.jpeg")
  await expect(page.locator("figcaption")).toHaveText("Drama portrait remains variant-owned.")
  expect(await page.locator("body").innerText()).not.toMatch(/Drama removed (?:editor|source)/u)
  expect(await profileRequests(request)).toEqual(["/private-v2/authors/SanitizedFallback"])
  expect(problems).toEqual([])
})

test("ordinary and Dramawebben portraits expose stable Swedish accessible names", async ({
  page
}) => {
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })
  await expect(page.getByRole("img", { name: "Porträtt av August Strindberg" })).toBeVisible()

  await routerPush(page, "/f%C3%B6rfattare/StrindbergA/dramawebben")
  await expect(page.getByRole("img", { name: "Porträtt av August Strindberg" })).toBeVisible()

  await page.goto("/författare/DramaOnly/dramawebben", { waitUntil: "networkidle" })
  await expect(page.getByRole("img", { name: "Porträtt av Dramatikern" })).toBeVisible()
})

test("client author navigation uses one public request and replaces every profile field", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })
  await reset(request)

  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS")
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS$/)
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf")
  await expect(page).toHaveTitle("Selma Lagerlöf, Introduktion | Litteraturbanken")
  await expect(page.locator(".introtext")).toContainText("Nobelpristagare")
  await expect(page.locator("body")).not.toContainText("August Strindberg")
  await expect(page.locator(".pseudonym, .other_name, .portrait_container, .ext_links"))
    .toHaveCount(0)
  await expect(page.locator('ul.links a[href="/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar"]'))
    .toHaveCount(1)

  expect(await profileRequests(request)).toEqual(["/v2/authors/Lagerl%C3%B6fS"])
  expect(problems).toEqual([])
})

test("a delayed Strindberg-to-Lagerlöf navigation never renders August at the new URL", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })
  await reset(request)

  let releaseResponse = () => {}
  const responseGate = new Promise<void>(resolve => {
    releaseResponse = resolve
  })
  let markRequestStarted = () => {}
  const requestStarted = new Promise<void>(resolve => {
    markRequestStarted = resolve
  })
  let markResponseDelivered = () => {}
  const responseDelivered = new Promise<void>(resolve => {
    markResponseDelivered = resolve
  })
  await page.route("**/v2/authors/Lagerl%C3%B6fS", async route => {
    const response = await route.fetch()
    markRequestStarted()
    await responseGate
    await route.fulfill({ response })
    markResponseDelivered()
  })

  await beginRouterPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS")
  await requestStarted
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS$/u)
  await expect(page.locator("body")).not.toContainText("August Strindberg")

  releaseResponse()
  await responseDelivered
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf")
  await expect(page.locator("body")).not.toContainText("August Strindberg")
  expect(problems).toEqual([])
})

test("a late obsolete canonical response cannot redirect or hand off over the current author", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/Lagerl%C3%B6fS", { waitUntil: "networkidle" })
  await reset(request)

  let releaseResponse = () => {}
  const responseGate = new Promise<void>(resolve => {
    releaseResponse = resolve
  })
  let markRequestStarted = () => {}
  const requestStarted = new Promise<void>(resolve => {
    markRequestStarted = resolve
  })
  let markResponseDelivered = () => {}
  const responseDelivered = new Promise<void>(resolve => {
    markResponseDelivered = resolve
  })
  await page.route("**/v2/authors/DramaOnly", async route => {
    const response = await route.fetch()
    markRequestStarted()
    await responseGate
    await route.fulfill({ response })
    markResponseDelivered()
  })

  await beginRouterPush(page, "/f%C3%B6rfattare/DramaOnly")
  await requestStarted
  await beginRouterPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS")
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS$/u)

  releaseResponse()
  await responseDelivered
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS$/u)
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf")
  await expect(page.locator("body")).not.toContainText("Dramatikern")
  expect(problems).toEqual([])
})

test("ordinary and Dramawebben navigation cleans metadata, background, and active content", async ({
  page
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })

  await routerPush(page, "/f%C3%B6rfattare/StrindbergA/dramawebben")
  await expect(page).toHaveTitle(
    "August Strindberg, Introduktion av Dramawebben | Litteraturbanken"
  )
  await expect(page.locator("html")).toHaveAttribute("style", /dramawebben_fade_more\.jpg/)
  await expect(page.locator("ul.links li.active a")).toHaveText("Dramawebben")
  await expect(page.locator(".introtext")).toContainText("förnyade det svenska dramat")
  await expect(page.locator(".introtext")).not.toContainText("debuterade")
  await expect(page.locator(".drama_subtitle")).toBeVisible()
  await expect(page.locator(".page_content .ext_links")).toHaveCount(0)

  await routerPush(page, "/f%C3%B6rfattare/StrindbergA")
  await expect(page).toHaveTitle("August Strindberg, Introduktion | Litteraturbanken")
  await expect(page.locator("html")).toHaveAttribute("style", /forf2_bkg\.jpg/)
  await expect(page.locator("ul.links li.active a")).toHaveText("Introduktion")
  await expect(page.locator(".introtext")).toContainText("debuterade")
  await expect(page.locator(".introtext")).not.toContainText("förnyade det svenska dramat")
  await expect(page.locator(".drama_subtitle")).toHaveCount(0)
  await expect(page.locator(".page_content .ext_links")).toHaveCount(2)
  expect(problems).toEqual([])
})

test("Dramawebben source heading exposes only its singular semantic label", async ({ page }) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA/dramawebben", { waitUntil: "networkidle" })

  const sourceBlock = page.locator(".drama-source")
  await expect(sourceBlock).toMatchAriaSnapshot(`
    - text: Källa
    - list:
      - listitem: "* Dramawebben"
  `)
  expect(problems).toEqual([])
})

test("direct Dramawebben client navigation without a block replace-redirects to root", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/", { waitUntil: "networkidle" })
  await reset(request)

  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS/dramawebben?fran=test")
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS\?fran=test$/)
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf")
  expect(await profileRequests(request)).toEqual(["/v2/authors/Lagerl%C3%B6fS"])

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  expect(problems).toEqual([])
})

test("ordinary client navigation to a Dramawebben-only canonical profile uses one request", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/", { waitUntil: "networkidle" })
  await reset(request)

  await routerPush(page, "/f%C3%B6rfattare/DramaOnly?fran=test")
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/DramaOnly\/dramawebben\?fran=test$/)
  await expect(page.locator("h1")).toContainText("Dramatikern")
  await expect(page.locator(".introtext"))
    .toContainText("Den här introduktionen finns bara på Dramawebben.")
  await expect(page.getByRole("img", { name: "Porträtt av Dramatikern" })).toBeVisible()
  expect(await profileRequests(request)).toEqual(["/v2/authors/DramaOnly"])

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  expect(problems).toEqual([])
})

test("reused ordinary profile redirects to Dramawebben once with one request", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })
  await reset(request)
  await installTransitionLedger(page)

  await routerPush(page, "/f%C3%B6rfattare/DramaOnly?fran=reused")
  await expect(page).toHaveURL(
    /\/f%C3%B6rfattare\/DramaOnly\/dramawebben\?fran=reused$/u
  )
  await expect(page.locator("h1")).toContainText("Dramatikern")
  expect((await transitionLedger(page)).filter(path => (
    path === "/f%C3%B6rfattare/DramaOnly/dramawebben?fran=reused"
  ))).toHaveLength(1)
  expect(await profileRequests(request)).toEqual(["/v2/authors/DramaOnly"])
  expect(problems).toEqual([])
})

test("reused Dramawebben profile redirects to ordinary once with one request", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA/dramawebben", { waitUntil: "networkidle" })
  await reset(request)
  await installTransitionLedger(page)

  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS/dramawebben?fran=reused")
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS\?fran=reused$/u)
  await expect(page.locator("h1")).toContainText("Selma Lagerlöf")
  expect((await transitionLedger(page)).filter(path => (
    path === "/f%C3%B6rfattare/Lagerl%C3%B6fS?fran=reused"
  ))).toHaveLength(1)
  expect(await profileRequests(request)).toEqual(["/v2/authors/Lagerl%C3%B6fS"])
  expect(problems).toEqual([])
})

test("profile links use canonical internal paths and blank targets are hardened", async ({
  page
}) => {
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })

  const internalHrefs = await page.locator(".page_content a").evaluateAll(links => links
    .map(link => link.getAttribute("href"))
    .filter((href): href is string => Boolean(href?.startsWith("/"))))
  expect(internalHrefs).toEqual([
    "/författare/StrindbergA/titlar/Fritankaren/etext",
    "/f%C3%B6rfattare/StrindbergA/mer",
    "/f%C3%B6rfattare/StrindbergA/presentation",
    "/f%C3%B6rfattare/StrindbergA/bibliografi",
    "/presentationer/specialomraden/Strindberg.html"
  ])
  expect(await page.locator("ul.links a").evaluateAll(links => links.every(link => link.tagName === "A")))
    .toBe(true)
  expect(await page.locator(".page_content a").evaluateAll(links => links.every(link => link.tagName === "A")))
    .toBe(true)

  const encyclopedia = page.locator(".ext_links").nth(1).locator("a")
  await expect(encyclopedia).toHaveCount(2)
  for (const link of await encyclopedia.all()) {
    await expect(link).toHaveAttribute("target", "_blank")
    const rel = (await link.getAttribute("rel"))?.split(/\s+/) ?? []
    expect(rel).toEqual(expect.arrayContaining(["noopener", "noreferrer"]))
  }

  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS")
  await expect(page.locator('ul.links a[href="/f%C3%B6rfattare/Lagerl%C3%B6fS"]')).toHaveCount(1)
  await expect(page.locator('ul.links a[href="/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar"]'))
    .toHaveCount(1)
})

test("more-content link uses Nuxt history and Back restores the hydrated profile", async ({
  page
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })
  await page.evaluate(() => {
    (window as typeof window & { __authorMoreSentinel?: string }).__authorMoreSentinel
      = "spa-history"
  })

  await page.getByRole("link", { name: "Texter om August Strindberg" }).click()
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/StrindbergA\/mer$/)
  await expect(page.locator("h1")).toContainText("August Strindberg")
  expect(await page.evaluate(() => (
    window as typeof window & { __authorMoreSentinel?: string }
  ).__authorMoreSentinel)).toBe("spa-history")

  await page.goBack()
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/StrindbergA$/)
  await expect(page.getByRole("link", { name: "Texter om August Strindberg" })).toBeVisible()
  expect(problems).toEqual([])
})

test("converted profile navigation keeps SPA state and Back restores the profile", async ({
  page
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA", { waitUntil: "networkidle" })
  await page.evaluate(() => {
    const statefulWindow = window as typeof window & { __authorProfileSentinel?: string }
    statefulWindow.__authorProfileSentinel = "profile-stayed-mounted"
  })

  await page
    .getByRole("navigation", { name: "Författarsidor" })
    .getByRole("link", { name: "Verk", exact: true })
    .click()

  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/StrindbergA\/titlar$/)
  await expect(page.locator("h1")).toContainText("August Strindberg (1849-1912)")
  expect(await page.evaluate(() => (
    window as typeof window & { __authorProfileSentinel?: string }
  ).__authorProfileSentinel)).toBe("profile-stayed-mounted")

  await page.goBack()
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/StrindbergA$/)
  await expect(page.locator(".introtext")).toContainText("Han debuterade med Fritänkaren.")
  expect(await page.evaluate(() => (
    window as typeof window & { __authorProfileSentinel?: string }
  ).__authorProfileSentinel)).toBe("profile-stayed-mounted")
  expect(problems).toEqual([])
})
