import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

import { slaArticleFixtures } from "../fixtures/sla-article-data.mjs"

const fixture = "http://127.0.0.1:4100"
const routeRoot = "/författare/Lagerl%C3%B6fS/omtexterna"

type ManagedRequest = { method: string, path: string }

const adjacentLedgers = [
  { path: "/_requests", field: "requests" },
  { path: "/_contact_submissions", field: "contactSubmissions" },
  { path: "/_quick_search_requests", field: "queries" },
  { path: "/_author_document_requests", field: "requests" },
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

async function setFailure(
  request: APIRequestContext,
  resource: "descriptor" | "source",
  failure: string
) {
  const response = await request.put(`${fixture}/_sla_article_${resource}_failure`, {
    data: { failure }
  })
  expect(response.status()).toBe(200)
}

async function expectNoFanOut(request: APIRequestContext) {
  for (const ledger of adjacentLedgers) {
    const response = await request.get(`${fixture}${ledger.path}`)
    expect(response.status(), ledger.path).toBe(200)
    const payload = await response.json()
    if (ledger.field === "textSearchOperations") {
      expect(payload, ledger.path).toEqual({
        results: [],
        count: [],
        options: [],
        chronology: []
      })
    } else {
      expect(payload[ledger.field], ledger.path).toEqual([])
    }
  }
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => expectNoFanOut(request))

test("SSR renders the exact SLA article shell and page-local managed body", async ({
  request
}) => {
  const articleId = "PublishedWorks.html"
  const response = await request.get(`${routeRoot}/${articleId}`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.title).toBe("Selma Lagerlöf, Om texterna | Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe("Selma Lagerlöf, Om texterna")
  expect(document.documentElement.getAttribute("style"))
    .toMatch(/forf2_bkg(?:\.[A-Za-z0-9_-]+)?\.jpg/u)
  expect(document.body.className).toBe("focus page-authorInfo site-sla ready")

  const host = document.querySelector("#mainview > .contents > div")
  expect(host?.querySelector(":scope > h1")?.textContent?.replace(/\s+/gu, " ").trim())
    .toBe("Selma Lagerlöf (1858-1940)")
  expect(host?.querySelector(":scope > nav > ul.links")).not.toBeNull()
  expect([...document.querySelectorAll("ul.links a")].map(link => link.textContent?.trim()))
    .toEqual(["Introduktion", "Verk", "Ljud", "Dramawebben", "Sök i texterna"])
  expect(document.querySelector(".portrait_container, .portrait")).toBeNull()

  const body = document.querySelector(".page_content > .content.unbox")
  expect(body?.textContent).toContain("Published works")
  expect(body?.querySelector("a[href]")?.getAttribute("href"))
    .toBe("/bibliotek?sort=titlar&filter=selma%20lagerlöf")
  expect(body?.querySelector("script, style, form, iframe, svg, math, meta, title"))
    .toBeNull()
  expect(document.querySelector("dialog, [role='dialog'], [data-headlessui-state]"))
    .toBeNull()
  expect(html).not.toMatch(/private-v2|127\.0\.0\.1:4100|red\.litteraturbanken\.se/iu)

  expect(await requests(request, "descriptor")).toEqual([{
    method: "GET",
    path: `/private-v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/${articleId}`
  }])
  expect(await requests(request, "source")).toEqual([{
    method: "GET",
    path: `/red/sla/${articleId}`
  }])
})

test("SSR keeps native footnote fragments paired without popup markup", async ({ request }) => {
  const response = await request.get(`${routeRoot}/ForeGostaBerling.html`)
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const body = document.querySelector(".page_content > .content.unbox")!
  const references = [...body.querySelectorAll("a[href^='#']")]

  expect(references.length).toBeGreaterThan(0)
  for (const reference of references) {
    expect(body.querySelector(`[id="${reference.getAttribute("href")!.slice(1)}"]`))
      .not.toBeNull()
  }
  expect(document.querySelector("dialog, [role='dialog'], [data-headlessui-state]"))
    .toBeNull()
})

test("SSR owns every registered article without legacy fan-out", async ({ request }) => {
  for (const article of slaArticleFixtures) {
    await reset(request)
    const response = await request.get(`${routeRoot}/${article.articleId}`)
    expect(response.status(), article.articleId).toBe(200)
    const { document } = parseHTML(await response.text())
    expect(document.querySelector(".page_content > .content.unbox"), article.articleId)
      .not.toBeNull()
    expect(await requests(request, "descriptor"), article.articleId).toHaveLength(1)
    expect(await requests(request, "source"), article.articleId).toEqual([{
      method: "GET",
      path: article.sourcePath
    }])
    await expectNoFanOut(request)
  }
})

test("direct query variants keep the same query-free article identity", async ({ request }) => {
  const response = await request.get(
    `${routeRoot}/PublishedWorks.html?repeat=one&repeat=two&fragment=%2F`
  )
  expect(response.status()).toBe(200)
  expect(await requests(request, "descriptor")).toEqual([{
    method: "GET",
    path: "/private-v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/PublishedWorks.html"
  }])
  expect(await requests(request, "source")).toEqual([{
    method: "GET",
    path: "/red/sla/PublishedWorks.html"
  }])
})

for (const [resource, failure, status, message] of [
  ["descriptor", "status-404", 404, "Artikeln kan inte hittas. Kontrollera adressen."],
  ["source", "status-404", 404, "Artikeln kan inte hittas. Kontrollera adressen."],
  ["source", "status-503", 502, "Artikeln kan inte visas just nu."]
] as const) {
  test(`SSR maps ${resource} ${failure} to the redacted ${status} article shell`, async ({
    request
  }) => {
    await setFailure(request, resource, failure)
    const response = await request.get(`${routeRoot}/PublishedWorks.html`)
    expect(response.status()).toBe(status)
    const body = await response.text()
    const { document } = parseHTML(body)
    expect(document.body.className).toBe("focus page-authorInfo site-sla ready")
    expect(document.querySelector(".error")?.textContent?.replace(/\s+/gu, " ").trim())
      .toBe(message)
    expect(document.querySelector('nav[aria-label="Huvudnavigation"]')).not.toBeNull()
    expect(document.querySelector("h1, .page_content")).toBeNull()
    expect(body).not.toMatch(/private-v2|red\/sla|upstream-provider-payload-probe/iu)
  })
}

test("invalid nested identities become global 404s before any article fetch", async ({
  request
}) => {
  for (const route of [
    "/författare/S%C3%B6derbergH/omtexterna/PublishedWorks.html",
    "/författare/Lagerl%C3%B6fS/presentation/PublishedWorks.html",
    "/författare/Lagerl%C3%B6fS/omtexterna/NotRegistered.html",
    "/författare/Lagerl%C3%B6fS/omtexterna/publishedWorks.html",
    "/författare/Lagerl%C3%B6fS/omtexterna/%252e%252e"
  ]) {
    await reset(request)
    expect((await request.get(route)).status(), route).toBe(404)
    expect(await requests(request, "descriptor"), route).toEqual([])
    expect(await requests(request, "source"), route).toEqual([])
  }
})
