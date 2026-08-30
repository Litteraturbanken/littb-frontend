import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin
const root = "/f%C3%B6rfattare/Lagerl%C3%B6fS/omtexterna"
const published = `${root}/PublishedWorks.html`
const scholarly = `${root}/ScholarlyEditions.html`

type ManagedRequest = { method: string, path: string }

const adjacentLedgers = [
  { path: "/_requests", field: "requests" },
  { path: "/_contact_submissions", field: "contactSubmissions" },
  { path: "/_quick_search_requests", field: "queries" },
  { path: "/_work_lookup_requests", field: "requests" },
  { path: "/_author_resolve_requests", field: "requests" },
  { path: "/_author_profile_requests", field: "requests" },
  { path: "/_author_works_requests", field: "requests" },
  { path: "/_home_requests", field: "requests" },
  { path: "/_presentation_requests", field: "requests" },
  { path: "/_litteraturkartan_requests", field: "requests" },
  { path: "/_reader_requests", field: "requests" },
  { path: "/_reader_metadata_requests", field: "requests" },
  { path: "/_reader_html_requests", field: "requests" },
  { path: "/_reader_ocr_requests", field: "requests" },
  { path: "/_reader_jpeg_requests", field: "requests" },
  { path: "/_reader_hit_requests", field: "requests" },
  { path: "/_export_faksimil_requests", field: "requests" },
  { path: "/_library_relevance_requests", field: "requests" },
  { path: "/_library_query_requests", field: "requests" },
  { path: "/_dramawebben_document_requests", field: "requests" },
  { path: "/_dramawebben_document_redirect_target_requests", field: "requests" },
  { path: "/_dramawebben_excluded_data_requests", field: "requests" },
  { path: "/_sla_excluded_data_requests", field: "requests" },
  { path: "/_author_document_asset_requests", field: "requests" },
  { path: "/_author_document_redirect_target_requests", field: "requests" },
  { path: "/_legacy_author_route_requests", field: "requests" },
  { path: "/_author_document_pdf_requests", field: "requests" },
  { path: "/_text_search/requests", field: "textSearchOperations" }
] as const

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_sla_article_descriptor_requests`),
    request.delete(`${fixture}/_sla_article_source_requests`),
    request.delete(`${fixture}/_sla_article_descriptor_failure`),
    request.delete(`${fixture}/_sla_article_source_failure`),
    request.delete(`${fixture}/_author_document_requests`),
    ...adjacentLedgers.map(ledger => request.delete(`${fixture}${ledger.path}`))
  ])
}

async function requests(
  request: APIRequestContext,
  resource: "descriptor" | "source"
): Promise<ManagedRequest[]> {
  return (await (await request.get(
    `${fixture}/_sla_article_${resource}_requests`
  )).json()).requests
}

async function expectNoFanOut(request: APIRequestContext) {
  expect((await (await request.get(
    `${fixture}/_author_document_requests`
  )).json()).requests, "/_author_document_requests").toEqual([])
  for (const ledger of adjacentLedgers) {
    const response = await request.get(`${fixture}${ledger.path}`)
    expect(response.status(), ledger.path).toBe(200)
    const payload = await response.json()
    if (ledger.field === "textSearchOperations") {
      expect(payload, ledger.path).toEqual({
        results: [], options: [], chronology: []
      })
    } else {
      expect(payload[ledger.field], ledger.path).toEqual([])
    }
  }
}

async function routerPush(page: Page, path: string) {
  await page.evaluate(async target => {
    const app = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: { $router: { push: (path: string) => Promise<void> } }
        }
      }
    }
    await app.__vue_app__?.config.globalProperties.$router.push(target)
  }, path)
}

function collectProblems(page: Page) {
  const problems: string[] = []
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())
      || /hydration|unhandled/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  return problems
}

function collectExpectedClient502(page: Page) {
  const problems: string[] = []
  const diagnostics: string[] = []
  const responses: Array<{ path: string, status: number }> = []
  const exactDiagnostic = "Failed to load resource: the server responded with a status of 502 (Bad Gateway)"
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (message.type() === "error" && message.text() === exactDiagnostic) {
      diagnostics.push(message.text())
    } else if (["error", "warning"].includes(message.type())
      || /hydration|unhandled/iu.test(message.text())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on("response", response => {
    if (response.status() === 502) {
      const url = new URL(response.url())
      responses.push({ path: `${url.pathname}${url.search}`, status: response.status() })
    }
  })
  return { diagnostics, problems, responses }
}

async function installFirewall(page: Page) {
  const browserArticleRequests: string[] = []
  const unexpected: string[] = []
  const allowed = new Set([
    "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/PublishedWorks.html",
    "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/ScholarlyEditions.html",
    "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/Introduktion.html"
  ])
  page.on("request", request => {
    const url = new URL(request.url())
    if (url.pathname.startsWith("/nuxt-api/author-documents/")) {
      browserArticleRequests.push(`${url.pathname}${url.search}`)
    }
  })
  await page.route("**/*", route => {
    const request = route.request()
    const url = new URL(request.url())
    const label = `${request.method()} ${url.href}`
    if (url.pathname.startsWith("/nuxt-api/author-documents/")) {
      if (request.method() === "GET" && allowed.has(`${url.pathname}${url.search}`)) {
        return route.continue()
      }
      unexpected.push(label)
      return route.abort("blockedbyclient")
    }
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost"
    const http = url.protocol === "http:" || url.protocol === "https:"
    const dataRequest = ["fetch", "xhr", "eventsource", "websocket"]
      .includes(request.resourceType())
    const sourcePath = /^\/(?:api|legacy-api|red|private-v2|v2|export)(?:\/|$)/u
      .test(url.pathname)
    if ((local && url.port === "4100")
      || (local && (dataRequest || sourcePath))
      || (http && !local)) {
      unexpected.push(label)
      return route.abort("blockedbyclient")
    }
    return route.continue()
  })
  return { browserArticleRequests, unexpected }
}

async function expectShell(page: Page) {
  await expect(page).toHaveTitle("Selma Lagerlöf, Om texterna | Litteraturbanken")
  await expect(page.locator('meta[name="description"]'))
    .toHaveAttribute("content", "Selma Lagerlöf, Om texterna")
  await expect(page.locator("body")).toHaveClass("focus page-authorInfo site-sla ready")
  await expect(page.locator("#mainview > .contents > div > h1"))
    .toHaveText("Selma Lagerlöf (1858-1940)")
  await expect(page.locator("#mainview > .contents > div > h1")).toBeVisible()
  await expect(page.locator("#mainview > .contents > div > nav > ul.links")).toBeHidden()
  await expect(page.locator(".portrait_container, .portrait")).toHaveCount(0)
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => expectNoFanOut(request))

test("hydrates one SSR-owned article without browser refetch or legacy fan-out", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const firewall = await installFirewall(page)
  expect((await page.goto(published, { waitUntil: "networkidle" }))?.status()).toBe(200)

  await expectShell(page)
  await expect(page.locator(".page_content > .content.unbox"))
    .toContainText("Published works")
  expect(await requests(request, "descriptor")).toEqual([{
    method: "GET",
    path: "/private-v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/PublishedWorks.html"
  }])
  expect(await requests(request, "source")).toEqual([{
    method: "GET",
    path: "/red/sla/PublishedWorks.html"
  }])
  expect(firewall.browserArticleRequests).toEqual([])
  expect(firewall.unexpected).toEqual([])
  await expectNoFanOut(request)
  expect(problems).toEqual([])
})

test("query and native footnote fragments change history without refetch or popup", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const firewall = await installFirewall(page)
  const footnoteRoute = `${root}/ForeGostaBerling.html`
  await page.goto(footnoteRoute, { waitUntil: "networkidle" })
  const initialDescriptor = await requests(request, "descriptor")
  const initialSource = await requests(request, "source")

  await routerPush(page, `${footnoteRoute}?repeat=one&repeat=two`)
  await expect(page).toHaveURL(/repeat=one&repeat=two$/u)
  expect(await requests(request, "descriptor")).toEqual(initialDescriptor)
  expect(await requests(request, "source")).toEqual(initialSource)

  const reference = page.locator(".page_content a.footnote[href^='#']").first()
  const href = await reference.getAttribute("href")
  expect(href).toMatch(/^#/u)
  await reference.click()
  await expect.poll(() => new URL(page.url()).hash).toBe(href)
  await expect(page.locator(`[id="${href!.slice(1)}"]`)).toHaveCount(1)
  await expect(page.locator("dialog, [role='dialog'], [data-headlessui-state]"))
    .toHaveCount(0)
  expect(await requests(request, "descriptor")).toEqual(initialDescriptor)
  expect(await requests(request, "source")).toEqual(initialSource)
  expect(firewall.browserArticleRequests).toEqual([])
  expect(firewall.unexpected).toEqual([])
  expect(problems).toEqual([])
})

test("article navigation clears stale content and ignores a late older result", async ({
  page,
  request
}) => {
  const problems = collectProblems(page)
  const firewall = await installFirewall(page)
  await page.goto(published, { waitUntil: "networkidle" })
  await reset(request)

  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let markStarted!: () => void
  const started = new Promise<void>(resolve => { markStarted = resolve })
  await page.route("**/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/Introduktion.html", async route => {
    markStarted()
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
          searchUrl: "/sok?forfattare=Lagerl%C3%B6fS&avancerad",
          audioUrl: "https://litteraturbanken.se/ljudochbild/författare/lagerlofs"
        },
        articleId: "Introduktion.html",
        sourcePath: "/red/sla/Introduktion.html",
        bodyHtml: "<p>late-introduction-probe</p>"
      })
    })
  })

  const slow = routerPush(page, `${root}/Introduktion.html`)
  await started
  await expect(page.locator(".preloader")).toBeVisible()
  await expect(page.locator(".page_content")).toHaveCount(0)
  await routerPush(page, scholarly)
  await expect(page.locator(".page_content")).toContainText("Scholarly editions")
  release()
  await slow
  await page.waitForTimeout(100)

  await expect(page).toHaveURL(/ScholarlyEditions\.html$/u)
  await expect(page.locator(".page_content")).not.toContainText("late-introduction-probe")
  expect(await requests(request, "descriptor")).toEqual([{
    method: "GET",
    path: "/private-v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/ScholarlyEditions.html"
  }])
  expect(await requests(request, "source")).toEqual([{
    method: "GET",
    path: "/red/sla/ScholarlyEditions.html"
  }])
  expect(firewall.browserArticleRequests).toEqual([
    "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/Introduktion.html",
    "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/ScholarlyEditions.html"
  ])
  expect(firewall.unexpected).toEqual([])
  expect(problems).toEqual([])
})

test("client errors clear accepted content and a later article recovers", async ({
  page,
  request
}) => {
  const evidence = collectExpectedClient502(page)
  await page.goto(published, { waitUntil: "networkidle" })
  await request.put(`${fixture}/_sla_article_source_failure`, {
    data: { failure: "status-503" }
  })
  await routerPush(page, scholarly)
  await expect(page.locator(".error")).toHaveText("Artikeln kan inte visas just nu.")
  await expect(page.locator(".page_content")).toHaveCount(0)

  await request.delete(`${fixture}/_sla_article_source_failure`)
  await routerPush(page, `${root}/Introduktion.html`)
  await expect(page.locator(".page_content")).toContainText("Introduktion")
  await expect(page.locator(".error")).toHaveCount(0)
  expect(evidence.diagnostics).toEqual([
    "Failed to load resource: the server responded with a status of 502 (Bad Gateway)"
  ])
  expect(evidence.responses).toEqual([{
    path: "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/ScholarlyEditions.html",
    status: 502
  }])
  expect(evidence.problems).toEqual([])
})

test("invalid nested identities are global 404s before any article or legacy fetch", async ({
  page,
  request
}) => {
  const firewall = await installFirewall(page)
  for (const path of [
    "/f%C3%B6rfattare/S%C3%B6derbergH/omtexterna/PublishedWorks.html",
    "/f%C3%B6rfattare/Lagerl%C3%B6fS/presentation/PublishedWorks.html",
    "/f%C3%B6rfattare/Lagerl%C3%B6fS/omtexterna/NotRegistered.html",
    "/f%C3%B6rfattare/Lagerl%C3%B6fS/omtexterna/publishedWorks.html",
    "/f%C3%B6rfattare/Lagerl%C3%B6fS/omtexterna/%252e%252e"
  ]) {
    await reset(request)
    expect((await page.goto(path, { waitUntil: "networkidle" }))?.status(), path).toBe(404)
    expect(await requests(request, "descriptor"), path).toEqual([])
    expect(await requests(request, "source"), path).toEqual([])
    await expectNoFanOut(request)
  }
  expect(firewall.browserArticleRequests).toEqual([])
  expect(firewall.unexpected).toEqual([])
})
