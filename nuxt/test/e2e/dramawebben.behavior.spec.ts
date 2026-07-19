import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const legacyDescription = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_dramawebben_document_requests`),
    request.delete(`${fixture}/_dramawebben_document_failure`),
    request.delete(`${fixture}/_dramawebben_document_redirect_target_requests`),
    request.delete(`${fixture}/_dramawebben_excluded_data_requests`)
  ])
}

async function documentRequests(request: APIRequestContext) {
  return (await (await request.get(
    `${fixture}/_dramawebben_document_requests`
  )).json()).requests
}

async function expectNoExcludedDataRequests(request: APIRequestContext) {
  expect((await (await request.get(
    `${fixture}/_dramawebben_excluded_data_requests`
  )).json()).requests).toEqual([])
}

async function routerPush(page: Page, path: string) {
  await page.evaluate(async target => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: { $router: { push: (path: string) => Promise<void> } }
        }
      }
    }
    await root.__vue_app__?.config.globalProperties.$router.push(target)
  }, path)
}

function collectProblems(page: Page) {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type()) || /hydration|unhandled/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  return problems
}

async function expectExactLinks(page: Page, kind: "om" | "kringtexter") {
  await expect(page.locator(".subpage ul.links a")).toHaveText([
    "Pjäser", "Mer läsning", "Sök", "Om", "Till Litteraturbanken"
  ])
  expect(await page.locator(".subpage ul.links a").evaluateAll(links => links.map(link => ({
    href: link.getAttribute("href"),
    text: link.textContent?.replace(/\s+/gu, " ").trim()
  })))).toEqual([
    { href: "/dramawebben/pjäser", text: "Pjäser" },
    { href: "/dramawebben/kringtexter", text: "Mer läsning" },
    { href: "/sok?avancerad&keywords=keyword:Dramawebben", text: "Sök" },
    { href: "/dramawebben/om", text: "Om" },
    { href: "/", text: "Till Litteraturbanken" }
  ])
  await expect(page.locator(".subpage ul.links li.active a")).toHaveCount(
    kind === "kringtexter" ? 1 : 0
  )
  if (kind === "kringtexter") {
    await expect(page.locator(".subpage ul.links li.active a"))
      .toHaveAttribute("href", "/dramawebben/kringtexter")
  }
}

test.beforeEach(async ({ request }) => reset(request))

for (const documentCase of [
  {
    kind: "om",
    route: "/dramawebben/om",
    heading: "Om Dramawebben",
    source: "/red/dramawebben/om.html"
  },
  {
    kind: "kringtexter",
    route: "/dramawebben/kringtexter",
    heading: "Mer läsning om svensk dramatik",
    source: "/red/dramawebben/kringtexter/kringtexter.html"
  }
] as const) {
  test(`hydrates ${documentCase.kind} once with the exact shell and links`, async ({
    page,
    request
  }) => {
    const problems = collectProblems(page)
    await page.goto(documentCase.route, { waitUntil: "networkidle" })

    await expect(page).toHaveTitle("Litteraturbanken")
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      legacyDescription
    )
    await expect(page.locator("body")).toHaveClass(
      "focus page-dramaweb drama-dramasubpage ready"
    )
    await expect(page.locator("#mainview > .cover.show")).toHaveCount(1)
    await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
    await expect(page.locator(".subpage .logo h2")).toBeHidden()
    await expect(page.getByRole("heading", { name: documentCase.heading, exact: true }))
      .toBeVisible()
    await expectExactLinks(page, documentCase.kind)
    expect(await documentRequests(request)).toEqual([{
      method: "GET",
      path: documentCase.source,
      authorization: null,
      cookie: null
    }])
    await expectNoExcludedDataRequests(request)
    expect(problems).toEqual([])
  })
}

test("query-only history preserves the managed identity without refetching", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/om", { waitUntil: "networkidle" })
  const initialRequests = await documentRequests(request)

  const queryPath = "/dramawebben/om?repeat=one&repeat=two&unknown=%2F"
  await routerPush(page, queryPath)
  await expect(page).toHaveURL(new RegExp(`${queryPath.replace(/[?]/gu, "\\?")}$`, "u"))
  await expect(page.getByRole("heading", { name: "Om Dramawebben", exact: true })).toBeVisible()
  expect(await documentRequests(request)).toEqual(initialRequests)

  await page.goBack()
  await expect(page).toHaveURL(/\/dramawebben\/om$/u)
  expect(await documentRequests(request)).toEqual(initialRequests)

  await page.goForward()
  await expect(page).toHaveURL(/repeat=one&repeat=two&unknown=%2F$/u)
  expect(await documentRequests(request)).toEqual(initialRequests)
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("om and kringtexter navigation accepts only the current document identity", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/om", { waitUntil: "networkidle" })
  await routerPush(page, "/dramawebben/kringtexter")

  await expect(page).toHaveURL(/\/dramawebben\/kringtexter$/u)
  await expect(page.getByRole("heading", {
    name: "Mer läsning om svensk dramatik",
    exact: true
  })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Om Dramawebben", exact: true }))
    .toHaveCount(0)
  expect(await documentRequests(request)).toEqual([
    {
      method: "GET",
      path: "/red/dramawebben/om.html",
      authorization: null,
      cookie: null
    },
    {
      method: "GET",
      path: "/red/dramawebben/kringtexter/kringtexter.html",
      authorization: null,
      cookie: null
    }
  ])
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("a delayed om response cannot replace the latest kringtexter identity", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben", { waitUntil: "networkidle" })

  let releaseOm!: () => void
  const omGate = new Promise<void>(resolve => { releaseOm = resolve })
  let omRequested!: () => void
  const omStarted = new Promise<void>(resolve => { omRequested = resolve })
  await page.route("**/api/dramawebben/documents/om", async route => {
    omRequested()
    await omGate
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        documentKind: "om",
        bodyHtml: "<h2>Om Dramawebben</h2><p>late-om-probe</p>"
      })
    })
  })

  const slowOm = routerPush(page, "/dramawebben/om")
  await omStarted
  await expect(page.locator(".page_content")).not.toContainText("late-om-probe")

  await routerPush(page, "/dramawebben/kringtexter")
  await expect(page.getByRole("heading", {
    name: "Mer läsning om svensk dramatik",
    exact: true
  })).toBeVisible()
  releaseOm()
  await slowOm
  await page.waitForTimeout(100)

  await expect(page).toHaveURL(/\/dramawebben\/kringtexter$/u)
  await expect(page.locator(".page_content")).not.toContainText("late-om-probe")
  await expect(page.locator(".error")).toHaveCount(0)
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("a malformed successful document is redacted inside the stable latest shell", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  await page.goto("/dramawebben/om", { waitUntil: "networkidle" })
  await page.route("**/api/dramawebben/documents/kringtexter", route => route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ documentKind: "kringtexter", bodyHtml: 42 })
  }))

  await routerPush(page, "/dramawebben/kringtexter")
  await expect(page.locator("#mainview > .subpage")).toHaveCount(1)
  await expect(page.locator(".error")).toHaveText("Innehållet kan inte visas just nu.")
  await expect(page.locator(".page_content")).not.toContainText("Om Dramawebben")
  await expectExactLinks(page, "kringtexter")
  await expectNoExcludedDataRequests(request)
  expect(problems).toEqual([])
})

test("invalid document routes remain global 404s without managed fetches", async ({
  page,
  request
}) => {
  const response = await page.goto("/dramawebben/pjäser", { waitUntil: "networkidle" })

  expect(response?.status()).toBe(404)
  await expect(page.locator("#mainview > .subpage")).toHaveCount(0)
  expect(await documentRequests(request)).toEqual([])
  await expectNoExcludedDataRequests(request)
})
