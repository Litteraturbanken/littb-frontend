import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_profile_requests`),
    request.delete(`${fixture}/_author_profile_failure`),
    request.delete(`${fixture}/_bibliography_requests`),
    request.delete(`${fixture}/_bibliography_failure`),
    request.delete(`${fixture}/_bibliography_disconnect`),
    request.delete(`${fixture}/_bibliography_delays`)
  ])
}

async function bibliographyRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_bibliography_requests`)).json()).requests
}

function collectProblems(page: Page): string[] {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(error.message))
  page.on("console", message => {
    if (
      !message.text().startsWith("Failed to load resource:")
      && (["error", "warning"].includes(message.type()) || /hydration/iu.test(message.text()))
    ) {
      problems.push(message.text())
    }
  })
  return problems
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

test.beforeAll(async ({ baseURL, browser, request }) => {
  await reset(request)
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    const response = await page.goto(new URL("/f%C3%B6rfattare/StrindbergA/biblinfo", baseURL).href, {
      waitUntil: "networkidle"
    })
    expect(response?.status()).toBe(200)
  } finally {
    await context.close()
  }
})
test.beforeEach(async ({ request }) => reset(request))

test("mounts Biblinfo while its initial pipeline is pending", async ({ page }) => {
  await page.goto("/f%C3%B6rfattare/StrindbergA/biblinfo", { waitUntil: "networkidle" })
  await routerPush(page, "/f%C3%B6rfattare/DramaOnly/dramawebben")
  await expect(page.getByRole("heading", { name: "Dramatikern" })).toHaveCount(1)

  let releaseAuthor = () => {}
  const authorGate = new Promise<void>(resolve => {
    releaseAuthor = resolve
  })
  let markAuthorStarted = () => {}
  const authorStarted = new Promise<void>(resolve => {
    markAuthorStarted = resolve
  })
  let markAuthorDelivered = () => {}
  const authorDelivered = new Promise<void>(resolve => {
    markAuthorDelivered = resolve
  })
  const authorRoute = async (route: Route) => {
    const response = await route.fetch()
    markAuthorStarted()
    await authorGate
    await route.fulfill({ response })
    markAuthorDelivered()
  }

  let releaseBibliography = () => {}
  const bibliographyGate = new Promise<void>(resolve => {
    releaseBibliography = resolve
  })
  let markBibliographyStarted = () => {}
  const bibliographyStarted = new Promise<void>(resolve => {
    markBibliographyStarted = resolve
  })
  let markBibliographyDelivered = () => {}
  const bibliographyDelivered = new Promise<void>(resolve => {
    markBibliographyDelivered = resolve
  })
  const bibliographyRoute = async (route: Route) => {
    const response = await route.fetch()
    markBibliographyStarted()
    await bibliographyGate
    await route.fulfill({ response })
    markBibliographyDelivered()
  }

  await page.route("**/api/v2/authors/**", authorRoute)
  await page.route("**/api/v2/bibliography/entries**", bibliographyRoute)
  try {
    await beginRouterPush(page, "/f%C3%B6rfattare/NoIntro/biblinfo")
    await authorStarted

    await expect(page).toHaveURL("/f%C3%B6rfattare/NoIntro/biblinfo")
    await expect(page.locator("body")).toHaveClass(/page-authorInfo/u)
    await expect(page.getByRole("status", { name: "Laddar bibliografisk databas" })).toHaveCount(1)
    await expect(page.getByRole("heading", { name: "Dramatikern" })).toHaveCount(0)

    releaseAuthor()
    await authorDelivered
    await bibliographyStarted

    await expect(page.getByRole("status", { name: "Laddar bibliografisk databas" })).toHaveCount(1)

    releaseBibliography()
    await bibliographyDelivered
    await expect(page.getByRole("heading", { name: "Författare utan introduktion" })).toHaveCount(1)
    await expect(page.locator(".num_hits")).toHaveText("3 träffar")
  } finally {
    releaseAuthor()
    releaseBibliography()
    await page.unroute("**/api/v2/bibliography/entries**", bibliographyRoute)
    await page.unroute("**/api/v2/authors/**", authorRoute)
  }
})

test("hydrates once and preserves the legacy one-hit, next, previous, and all controls", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const browserBibliographyRequests: string[] = []
  page.on("request", browserRequest => {
    if (new URL(browserRequest.url()).pathname === "/api/v2/bibliography/entries") {
      browserBibliographyRequests.push(browserRequest.url())
    }
  })
  await page.goto("/författare/StrindbergA/biblinfo", { waitUntil: "networkidle" })
  const wholeTextSearch = page.getByRole("textbox", {
    name: "Fritextsökning i hela databasen"
  })
  await expect(wholeTextSearch).toBeVisible()
  await expect(wholeTextSearch).toHaveAttribute(
    "aria-label",
    "Fritextsökning i hela databasen"
  )
  await expect(page.getByRole("combobox", { name: "Verk" })).toBeDisabled()

  await expect(page.locator(".num_hits")).toHaveText("3 träffar")
  await expect(page.locator(".results > div")).toHaveCount(1)
  await expect(page.locator(".results")).toContainText("Gösta Berlings saga")
  await expect(page.locator(".results")).toContainText("[tom]")

  const next = page.getByRole("button", { name: "Visa nästa sökträff" })
  await next.focus()
  await page.keyboard.press("Space")
  await expect(page.locator(".results")).toContainText("En herrgårdssägen")
  await expect(page.locator(".results")).not.toContainText("Gösta Berlings saga")
  await page.getByRole("button", { name: "Visa föregående sökträff" }).click()
  await expect(page.locator(".results")).toContainText("Gösta Berlings saga")
  await page.getByRole("button", { name: "Visa alla sökträffar" }).click()
  await expect(page.locator(".results > div")).toHaveCount(3)
  await expect(page.locator(".results")).toContainText("Jerusalem i forskningen")

  expect(await bibliographyRequests(request)).toEqual([
    "/private-v2/bibliography/entries"
  ])
  expect(browserBibliographyRequests).toEqual([])
  expect(problems).toEqual([])
})

test("submits exact resource filters and free text with latest-response ownership", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA/biblinfo", { waitUntil: "networkidle" })
  const form = page.locator("form.search")
  const search = form.getByPlaceholder("Fritextsökning i hela databasen")

  await page.getByLabel("Visa information om alla manuskript").check()
  await form.getByRole("button", { name: "Sök" }).click()
  await expect(page.locator(".num_hits")).toHaveText("1 träffar")
  await expect(page.locator(".results")).toContainText("Gösta Berlings saga")
  expect((await bibliographyRequests(request)).at(-1)).toBe(
    "/v2/bibliography/entries?resource=manus"
  )

  await page.getByLabel("Visa information om alla manuskript").uncheck()
  await request.put(`${fixture}/_bibliography_delays`, { data: { gösta: 500 } })
  await search.fill("gösta")
  const slow = form.getByRole("button", { name: "Sök" }).click()
  await expect.poll(async () => (await bibliographyRequests(request)).some(
    entry => entry.includes("whole_text=g%C3%B6sta")
  )).toBe(true)
  await search.fill("jerusalem")
  await form.getByRole("button", { name: "Sök" }).click()
  await expect(page.locator(".results")).toContainText("Jerusalem i forskningen")
  await slow
  await page.waitForTimeout(550)
  await expect(page.locator(".results")).toContainText("Jerusalem i forskningen")
  await expect(page.locator(".results")).not.toContainText("Gösta Berlings saga")
  expect(problems).toEqual([])
})

test("rejects overlong free text locally without replacing truthful results", async ({
  page,
  request
}) => {
  await page.goto("/författare/StrindbergA/biblinfo", { waitUntil: "networkidle" })
  const search = page.getByPlaceholder("Fritextsökning i hela databasen")
  const initialRequests = await bibliographyRequests(request)
  await search.evaluate((input, value) => {
    const field = input as HTMLInputElement
    field.value = value
    field.dispatchEvent(new Event("input", { bubbles: true }))
  }, "x".repeat(201))
  await page.locator("form.search").getByRole("button", { name: "Sök" }).click()

  await expect(page.getByRole("alert")).toContainText("högst 200 tecken")
  await expect(page.locator(".results")).toContainText("Gösta Berlings saga")
  expect(await bibliographyRequests(request)).toEqual(initialRequests)
})

test("shows empty and failure states and keeps internal author navigation client-side", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/författare/StrindbergA/biblinfo", { waitUntil: "networkidle" })
  await page.getByPlaceholder("Fritextsökning i hela databasen").fill("saknas")
  await page.locator("form.search").getByRole("button", { name: "Sök" }).click()
  await expect(page.locator(".num_hits")).toHaveText("Inga träffar")
  await expect(page.locator(".results > div")).toHaveCount(0)

  await request.put(`${fixture}/_bibliography_failure`)
  await page.locator("form.search").getByRole("button", { name: "Sök" }).click()
  await expect(page.getByRole("alert")).toContainText(
    "Den bibliografiska databasen kan inte visas just nu."
  )

  await request.delete(`${fixture}/_bibliography_failure`)
  await page.evaluate(() => sessionStorage.setItem("biblinfo-client-marker", "kept"))
  await page.getByRole("link", { name: "Verk" }).click()
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/StrindbergA\/titlar$/u)
  expect(await page.evaluate(() => sessionStorage.getItem("biblinfo-client-marker"))).toBe("kept")
  expect(problems).toEqual([])
})

test("does not expose an untrusted profile search URL as navigation", async ({ page }) => {
  const problems = collectProblems(page)
  const response = await page.goto("/författare/UnsafeSearch/biblinfo", {
    waitUntil: "networkidle"
  })

  expect(response?.status()).toBe(200)
  await expect(page.getByRole("heading", { name: /Osäker sökprofil/u })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Författarsidor" })
    .getByRole("link", { name: "Sök i texterna" })).toHaveCount(0)
  expect(problems).toEqual([])
})
