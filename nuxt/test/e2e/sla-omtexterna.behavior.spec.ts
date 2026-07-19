import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const slaRoute = "/f%C3%B6rfattare/Lagerl%C3%B6fS/omtexterna"
const expectedDocumentRequests = [
  {
    kind: "descriptor",
    path: "/private-v2/authors/Lagerl%C3%B6fS/documents/omtexterna"
  },
  { kind: "content", path: "/red/sla/omtexterna.html" }
] as const
const adjacentLedgers = [
  "/_requests",
  "/_sla_excluded_data_requests",
  "/_author_profile_requests",
  "/_author_works_requests",
  "/_home_requests",
  "/_library_query_requests",
  "/_reader_requests",
  "/_reader_metadata_requests",
  "/_reader_html_requests",
  "/_reader_ocr_requests",
  "/_reader_jpeg_requests",
  "/_reader_hit_requests",
  "/_presentation_requests",
  "/_dramawebben_excluded_data_requests",
  "/_author_document_asset_requests",
  "/_author_document_pdf_requests",
  "/_author_document_redirect_target_requests"
] as const

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_document_requests`),
    request.delete(`${fixture}/_author_document_failure`),
    request.delete(`${fixture}/_author_document_delay`),
    ...adjacentLedgers.map(ledger => request.delete(`${fixture}${ledger}`))
  ])
}

async function documentRequests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_author_document_requests`)).json()).requests
}

async function expectAdjacentLedgersEmpty(request: APIRequestContext) {
  for (const ledger of adjacentLedgers) {
    const response = await request.get(`${fixture}${ledger}`)
    expect(response.status(), ledger).toBe(200)
    expect((await response.json()).requests, ledger).toEqual([])
  }
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

function collectProblems(page: Page, ignored: RegExp[] = []) {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if ((["error", "warning"].includes(message.type()) || /hydration|unhandled/iu.test(message.text()))
      && !ignored.some(pattern => pattern.test(message.text()))) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  return problems
}

async function installDataFirewall(page: Page) {
  const browserDocumentRequests: string[] = []
  const unexpected: string[] = []
  await page.route("**/*", route => {
    const request = route.request()
    const url = new URL(request.url())
    const label = `${request.method()} ${url.href}`
    if (url.pathname.startsWith("/api/author-documents/")) {
      browserDocumentRequests.push(`${url.pathname}${url.search}`)
      return route.continue()
    }
    const productionOrigin = url.hostname === "litteraturbanken.se"
      || url.hostname.endsWith(".litteraturbanken.se")
    const unexpectedLocalData = url.port === "4100"
      || url.pathname.startsWith("/api/")
      || url.pathname.startsWith("/legacy-api/")
    if (productionOrigin || unexpectedLocalData) {
      unexpected.push(label)
      return route.abort("blockedbyclient")
    }
    return route.continue()
  })
  return { browserDocumentRequests, unexpected }
}

async function expectExactLanding(page: Page) {
  await expect(page).toHaveTitle("Selma Lagerlöf, Om texterna | Litteraturbanken")
  await expect(page.locator('meta[name="description"]'))
    .toHaveAttribute("content", "Selma Lagerlöf, Om texterna")
  await expect(page.locator("body")).toHaveClass("focus page-authorInfo site-sla ready")
  await expect(page.locator("#mainview > .contents > div > h1"))
    .toHaveText("Selma Lagerlöf (1858-1940)")
  await expect(page.locator("#mainview > .contents > div > h1")).toBeVisible()
  await expect(page.locator("#mainview > .contents > div > nav > ul.links")).toBeHidden()
  await expect(page.locator(".portrait_container, .portrait")).toHaveCount(0)
  await expect(page.locator(".page_content > .content.unbox")).toContainText(
    "Utgåvor och andra vetenskapliga texter i Selma Lagerlöf-arkivet"
  )
  await expect(page.locator(".page_content a.ulink")).toHaveCount(21)
}

test.beforeEach(async ({ request }) => reset(request))

test("hydrates the exact SLA landing without browser refetches or legacy fan-out", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const firewall = await installDataFirewall(page)
  const response = await page.goto(slaRoute, { waitUntil: "networkidle" })

  expect(response?.status()).toBe(200)
  await expectExactLanding(page)
  expect(await documentRequests(request)).toEqual(expectedDocumentRequests)
  expect(firewall.browserDocumentRequests).toEqual([])
  expect(firewall.unexpected).toEqual([])
  await expectAdjacentLedgersEmpty(request)
  expect(problems).toEqual([])
})

test("preserves query-only push, back, and forward without refetching", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const firewall = await installDataFirewall(page)
  await page.goto(`${slaRoute}?direct=one&direct=two&encoded=%2F`, { waitUntil: "networkidle" })
  await expectExactLanding(page)
  const initialRequests = await documentRequests(request)

  const queryPath = `${slaRoute}?repeat=one&repeat=two&unknown=%2F`
  await routerPush(page, queryPath)
  await expect(page).toHaveURL(/repeat=one&repeat=two&unknown=%2F$/u)
  await expectExactLanding(page)
  expect(await documentRequests(request)).toEqual(initialRequests)

  await page.goBack()
  await expect.poll(() => new URL(page.url()).searchParams.getAll("direct"))
    .toEqual(["one", "two"])
  expect(new URL(page.url()).searchParams.get("encoded")).toBe("/")
  expect(await documentRequests(request)).toEqual(initialRequests)

  await page.goForward()
  await expect(page).toHaveURL(/repeat=one&repeat=two&unknown=%2F$/u)
  expect(await documentRequests(request)).toEqual(initialRequests)
  expect(firewall.browserDocumentRequests).toEqual([])
  expect(firewall.unexpected).toEqual([])
  await expectAdjacentLedgersEmpty(request)
  expect(problems).toEqual([])
})

for (const failure of ["descriptor-503", "content-503"] as const) {
  test(`keeps a stable redacted SLA shell for ${failure}`, async ({ page, request }) => {
    const problems = collectProblems(page, [
      /^Failed to load resource: the server responded with a status of 502 \(Bad Gateway\)$/u
    ])
    const firewall = await installDataFirewall(page)
    await request.put(`${fixture}/_author_document_failure`, { data: { failure } })

    const response = await page.goto(slaRoute, { waitUntil: "networkidle" })
    expect(response?.status()).toBe(502)
    await expect(page.locator("body")).toHaveClass("focus page-authorInfo site-sla ready")
    await expect(page.locator("#mainview > .contents > div > .error")).toHaveText(
      "Ett fel har inträffat. Författardokumentet kan inte visas just nu."
    )
    await expect(page.locator(".page_content")).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText("private-v2")
    await expect(page.locator("body")).not.toContainText("red/sla")
    expect(firewall.browserDocumentRequests).toEqual([])
    expect(firewall.unexpected).toEqual([])
    await expectAdjacentLedgersEmpty(request)
    expect(problems).toEqual([])
  })
}

test("a late SLA result cannot replace a newer adjacent author document", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const firewall = await installDataFirewall(page)
  await page.goto("/författare/AlmqvistCJL/semer", { waitUntil: "networkidle" })
  await reset(request)

  let releaseSla!: () => void
  const gate = new Promise<void>(resolve => { releaseSla = resolve })
  let slaStarted!: () => void
  const started = new Promise<void>(resolve => { slaStarted = resolve })
  await page.route(/\/api\/author-documents\/Lagerl(?:%C3%B6|ö)fS\/omtexterna$/iu, async route => {
    slaStarted()
    await gate
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        author: {
          authorId: "LagerlöfS",
          fullName: "Selma Lagerlöf",
          lifespan: "1858-1940",
          hasIntroduction: true,
          hasDramawebben: true,
          searchUrl: "/sök?författare=LagerlöfS",
          audioUrl: "https://litteraturbanken.se/ljudochbild/författare/lagerlofs"
        },
        documentKind: "omtexterna",
        bodyHtml: "<h1>late-sla-probe</h1>"
      })
    })
  })

  const slowSla = routerPush(page, slaRoute)
  await started
  await expect(page.locator(".preloader")).toBeVisible()
  await expect(page.locator(".page_content")).toHaveCount(0)
  await routerPush(page, "/f%C3%B6rfattare/Lagerl%C3%B6fS/bibliografi")
  await expect(page).toHaveTitle("Selma Lagerlöf, Bibliografi | Litteraturbanken")
  await expect(page.locator(".page_content")).toContainText("Selma Lagerlöf. Bibliografi")
  releaseSla()
  await slowSla
  await page.waitForTimeout(100)

  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/Lagerl%C3%B6fS\/bibliografi$/u)
  await expect(page.locator(".page_content")).not.toContainText("late-sla-probe")
  await expect(page.locator("body")).not.toHaveClass(/site-sla/u)
  expect(await documentRequests(request)).toEqual([
    {
      kind: "descriptor",
      path: "/private-v2/authors/Lagerl%C3%B6fS/documents/bibliografi"
    },
    {
      kind: "content",
      path: "/red/forfattare/LagerlofS/bibliografi/index.html"
    }
  ])
  expect(firewall.unexpected).toEqual([])
  await expectAdjacentLedgersEmpty(request)
  expect(problems).toEqual([])
})

test("rejects unsupported SLA identities as global 404s before any data fetch", async ({
  page,
  request
}) => {
  const firewall = await installDataFirewall(page)
  for (const route of [
    "/författare/S%C3%B6derbergH/omtexterna",
    "/författare/Lagerl%C3%B6fS/omtexterna/Introduktion.html",
    "/författare/Lagerl%C3%B6fS/omtexterna.html",
    "/författare/Lagerl%C3%B6fS/biblinfo",
    "/författare/Lagerl%C3%B6fS/%25"
  ]) {
    await reset(request)
    const response = await page.goto(route, { waitUntil: "networkidle" })
    expect(response?.status(), route).toBe(404)
    expect(await documentRequests(request), route).toEqual([])
    await expectAdjacentLedgersEmpty(request)
  }
  expect(firewall.browserDocumentRequests).toEqual([])
  expect(firewall.unexpected).toEqual([])
})
