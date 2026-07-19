import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = "http://127.0.0.1:4100"
const nuxtOrigin = `http://127.0.0.1:${process.env.LITTB_NUXT_TEST_PORT || 3000}`
const legacyDescription = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."
const neutralError = "Innehållet kan inte visas just nu."

const requestLedgers = [
  "/_requests",
  "/_author_document_requests",
  "/_author_profile_requests",
  "/_author_works_requests",
  "/_home_requests",
  "/_library_query_requests",
  "/_presentation_requests",
  "/_text_search/requests"
] as const

async function resetRequestLedgers(request: APIRequestContext) {
  await Promise.all([
    ...requestLedgers.map(path => request.delete(`${fixture}${path}`)),
    request.delete(`${fixture}/_dramawebben_document_requests`),
    request.delete(`${fixture}/_dramawebben_document_failure`),
    request.delete(`${fixture}/_dramawebben_document_redirect_target_requests`)
  ])
}

async function expectNoDataRequests(request: APIRequestContext) {
  for (const path of requestLedgers) {
    const payload = await (await request.get(`${fixture}${path}`)).json()
    const values = path === "/_text_search/requests"
      ? [...payload.results, ...payload.count, ...payload.options]
      : payload.requests
    expect(values, path).toEqual([])
  }
}

async function dramawebbenRequests(request: APIRequestContext) {
  return (await (await request.get(
    `${fixture}/_dramawebben_document_requests`
  )).json()).requests
}

async function setDramawebbenFailure(request: APIRequestContext, failure: string) {
  const response = await request.put(`${fixture}/_dramawebben_document_failure`, {
    data: { failure }
  })
  expect(response.status()).toBe(200)
}

function normalizedText(value: string | null | undefined) {
  return value?.replace(/\s+/gu, " ").trim()
}

function expectStartShell(html: string) {
  const { document } = parseHTML(html)

  expect(document.title).toBe("Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe(legacyDescription)
  expect(document.body.className).toBe("focus page-dramaweb ready")
  expect(document.querySelector("#mainview > .cover")).not.toBeNull()
  expect(document.querySelector("#mainview > .cover.show")).toBeNull()

  const wrapper = document.querySelector("#mainview > .startpage")
  expect(wrapper).not.toBeNull()
  expect(wrapper?.classList.contains("subpage")).toBe(false)
  expect(wrapper?.querySelector(".logo h1 a")?.getAttribute("href")).toBe("/dramawebben")
  const logo = wrapper?.querySelector(".logo h1 img")
  expect(logo?.getAttribute("src")).toMatch(/dramawebben_vit(?:\.[A-Za-z0-9_-]+)?\.svg/u)
  expect(logo?.getAttribute("alt")).toBe("Dramawebben")
  expect(wrapper?.querySelector(".logo h2")?.textContent?.replace(/\s+/gu, " ").trim())
    .toBe("Fri svensk dramatik hos Litteraturbanken")

  const links = [...(wrapper?.querySelectorAll("ul.links a") ?? [])].map(link => ({
    href: link.getAttribute("href"),
    label: link.textContent?.replace(/\s+/gu, " ").trim()
  }))
  expect(links).toEqual([
    { href: "/dramawebben/pjäser", label: "Pjäser" },
    { href: "/dramawebben/kringtexter", label: "Mer läsning" },
    {
      href: "/sok?avancerad&keywords=keyword:Dramawebben",
      label: "Sök i pjäserna"
    },
    { href: "/dramawebben/om", label: "Om dramawebben" },
    { href: "/", label: "Till Litteraturbanken" }
  ])
  expect(wrapper?.querySelectorAll("ul.links li.active")).toHaveLength(0)

  const content = wrapper?.querySelector(".page_content")
  expect(content).not.toBeNull()
  expect(content?.children).toHaveLength(0)
  expect(content?.textContent?.trim()).toBe("")
}

function expectManagedShell(
  html: string,
  kind: "om" | "kringtexter",
  expectedBody: string
) {
  const { document } = parseHTML(html)

  expect(document.title).toBe("Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe(legacyDescription)
  expect(document.body.className).toBe("focus page-dramaweb drama-dramasubpage ready")
  expect(document.querySelector("#mainview > .cover.show")).not.toBeNull()
  expect(document.querySelector("#mainview > .cover:not(.show)")).toBeNull()

  const wrapper = document.querySelector("#mainview > .subpage")
  expect(wrapper).not.toBeNull()
  expect(wrapper?.classList.contains("startpage")).toBe(false)
  expect(wrapper?.querySelector(".logo h1 a")?.getAttribute("href")).toBe("/dramawebben")
  expect(wrapper?.querySelector(".logo h1 img")?.getAttribute("alt")).toBe("Dramawebben")
  expect(wrapper?.querySelector(".logo h1 img")?.getAttribute("src"))
    .toMatch(/dramawebben_vit(?:\.[A-Za-z0-9_-]+)?\.svg/u)
  expect(normalizedText(wrapper?.querySelector(".logo h2")?.textContent))
    .toBe("Fri svensk dramatik hos Litteraturbanken")

  const links = [...(wrapper?.querySelectorAll("ul.links a") ?? [])].map(link => ({
    href: link.getAttribute("href"),
    label: normalizedText(link.textContent)
  }))
  expect(links).toEqual([
    { href: "/dramawebben/pjäser", label: "Pjäser" },
    { href: "/dramawebben/kringtexter", label: "Mer läsning" },
    { href: "/sok?avancerad&keywords=keyword:Dramawebben", label: "Sök" },
    { href: "/dramawebben/om", label: "Om" },
    { href: "/", label: "Till Litteraturbanken" }
  ])
  expect([...(wrapper?.querySelectorAll("ul.links li.active a") ?? [])].map(
    link => link.getAttribute("href")
  )).toEqual(kind === "kringtexter" ? ["/dramawebben/kringtexter"] : [])

  const content = wrapper?.querySelector(".page_content")
  expect(content).not.toBeNull()
  expect(content?.textContent).toContain(expectedBody)
  expect(content?.querySelector("html, head, body, title, meta")).toBeNull()
  expect(content?.querySelector("script, style, form, iframe, object, svg, math")).toBeNull()
}

test.beforeEach(async ({ request }) => resetRequestLedgers(request))

test("SSR renders the exact data-free Dramawebben start shell", async ({ request }) => {
  const response = await request.get("/dramawebben")

  expect(response.status()).toBe(200)
  expectStartShell(await response.text())
  await expectNoDataRequests(request)
})

test("a root query leaves the empty shell and request ownership unchanged", async ({
  request
}) => {
  const path = "/dramawebben?fran=test&repeat=one&repeat=two&unknown=%2F"
  const response = await request.get(path, { maxRedirects: 0 })

  expect(response.status()).toBe(200)
  expect(response.url()).toBe(`${nuxtOrigin}${path}`)
  expectStartShell(await response.text())
  await expectNoDataRequests(request)
})

for (const documentCase of [
  {
    kind: "om",
    route: "/dramawebben/om",
    source: "/red/dramawebben/om.html",
    body: "Om Dramawebben"
  },
  {
    kind: "kringtexter",
    route: "/dramawebben/kringtexter",
    source: "/red/dramawebben/kringtexter/kringtexter.html",
    body: "Mer läsning om svensk dramatik"
  }
] as const) {
  test(`SSR renders the exact sanitized ${documentCase.kind} document`, async ({ request }) => {
    const response = await request.get(documentCase.route)

    expect(response.status()).toBe(200)
    const html = await response.text()
    expectManagedShell(html, documentCase.kind, documentCase.body)
    const { document } = parseHTML(html)
    expect(document.querySelector(".page_content")?.innerHTML)
      .not.toMatch(/OM_DRAMAWEBBEN|PRESENTATIONER|upstream-payload-probe/iu)
    expect(await dramawebbenRequests(request)).toEqual([{
      method: "GET",
      path: documentCase.source,
      authorization: null,
      cookie: null
    }])
    await expectNoDataRequests(request)
  })
}

for (const invalidName of ["pjäser", "författare", "unknown"]) {
  test(`${invalidName} uses the global 404 before any source fetch`, async ({ request }) => {
    const response = await request.get(`/dramawebben/${invalidName}`)

    expect(response.status()).toBe(404)
    const html = await response.text()
    expect(html).not.toContain(neutralError)
    expect(await dramawebbenRequests(request)).toEqual([])
    await expectNoDataRequests(request)
  })
}

test("SSR renders only the sanitized malicious source body", async ({ request }) => {
  await setDramawebbenFailure(request, "malicious")
  const response = await request.get("/dramawebben/om")

  expect(response.status()).toBe(200)
  const html = await response.text()
  expectManagedShell(html, "om", "safe-visible-probe")
  expect(html).not.toMatch(
    /script-probe|form-probe|svg-probe|comment-probe|javascript:|data:text|http:\/\/evil\.test|\.\.\/private/iu
  )
})

for (const [failure, status] of [
  ["content-404", 404],
  ["content-502", 502],
  ["content-redirect", 502],
  ["wrong-content-type", 502],
  ["oversized-declared", 502],
  ["oversized-streamed", 502]
] as const) {
  test(`SSR keeps the stable shell for ${failure}`, async ({ request }) => {
    await setDramawebbenFailure(request, failure)
    const response = await request.get("/dramawebben/om")

    expect(response.status()).toBe(status)
    const html = await response.text()
    expectManagedShell(html, "om", neutralError)
    expect(html).not.toMatch(
      /127\.0\.0\.1:410[01]|red\/dramawebben|upstream-payload-probe|content unavailable/iu
    )
    expect(await dramawebbenRequests(request)).toEqual([{
      method: "GET",
      path: "/red/dramawebben/om.html",
      authorization: null,
      cookie: null
    }])
  })
}
