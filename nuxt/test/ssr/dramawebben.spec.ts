import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

import { dramawebbenCatalogExpected } from "../fixtures/dramawebben-catalog-data.mjs"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
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
  "/_dramawebben_catalog_requests",
  "/_source_info_requests",
  "/_source_info_static_requests",
  "/_dramawebben_excluded_data_requests",
  "/_text_search/requests"
] as const

async function resetRequestLedgers(request: APIRequestContext) {
  await Promise.all([
    ...requestLedgers.map(path => request.delete(`${fixture}${path}`)),
    request.delete(`${fixture}/_dramawebben_document_requests`),
    request.delete(`${fixture}/_dramawebben_document_failure`),
    request.delete(`${fixture}/_dramawebben_document_redirect_target_requests`),
    request.delete(`${fixture}/_dramawebben_catalog_failure`),
    request.delete(`${fixture}/_source_info_failure`),
    request.delete(`${fixture}/_source_info_delays`),
    request.delete(`${fixture}/_source_info_static_failure`)
  ])
}

async function expectNoDataRequests(
  request: APIRequestContext,
  allowed: readonly string[] = []
) {
  for (const path of requestLedgers) {
    if (allowed.includes(path)) continue
    const payload = await (await request.get(`${fixture}${path}`)).json()
    const values = path === "/_text_search/requests"
      ? [...payload.results, ...payload.count, ...payload.options]
      : payload.requests
    expect(values, path).toEqual([])
  }
}

async function catalogRequests(request: APIRequestContext) {
  return (await (await request.get(
    `${fixture}/_dramawebben_catalog_requests`
  )).json()).requests
}

async function sourceInfoRequests(request: APIRequestContext) {
  return (await (await request.get(
    `${fixture}/_source_info_requests`
  )).json()).requests
}

async function setCatalogFailure(request: APIRequestContext, failure: string) {
  const response = await request.put(`${fixture}/_dramawebben_catalog_failure`, {
    data: { failure }
  })
  expect(response.status()).toBe(200)
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

function expectCatalogRootSiblings(document: Document, dialogOpen: boolean) {
  const hashTarget = document.querySelector("#dw")
  const shellCover = document.querySelector("#mainview > .cover")
  const shell = document.querySelector("#mainview > .subpage")

  expect(hashTarget).not.toBeNull()
  expect(shellCover).not.toBeNull()
  expect(shell).not.toBeNull()
  expect(hashTarget?.parentNode).toBe(shellCover?.parentNode)
  expect(hashTarget?.parentNode).toBe(shell?.parentNode)
  expect(hashTarget?.nextElementSibling).toBe(shellCover)
  expect(shellCover?.nextElementSibling).toBe(shell)
  if (dialogOpen) {
    const dialog = document.querySelector('.modal.about[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.parentNode).toBe(shell?.parentNode)
    expect(shell?.nextElementSibling).toBe(dialog)
  } else {
    expect(shell?.nextElementSibling).toBeNull()
    expect(shell?.nextSibling?.nodeType).toBe(8)
  }
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
      href: "/s%C3%B6k?avancerad&keywords=keyword:Dramawebben",
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
  kind: "pjäser" | "om" | "kringtexter",
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
    { href: "/s%C3%B6k?avancerad&keywords=keyword:Dramawebben", label: "Sök" },
    { href: "/dramawebben/om", label: "Om" },
    { href: "/", label: "Till Litteraturbanken" }
  ])
  expect([...(wrapper?.querySelectorAll("ul.links li.active a") ?? [])].map(
    link => link.getAttribute("href")
  )).toEqual(kind === "pjäser"
    ? ["/dramawebben/pjäser"]
    : kind === "kringtexter"
      ? ["/dramawebben/kringtexter"]
      : [])

  const content = wrapper?.querySelector(".page_content")
  expect(content).not.toBeNull()
  expect(content?.textContent).toContain(expectedBody)
  expect(content?.querySelector("html, head, body, title, meta")).toBeNull()
  expect(content?.querySelector("script, style, form, iframe, object, svg, math")).toBeNull()
}

test.beforeEach(async ({ request }) => resetRequestLedgers(request))

test("SSR renders the populated catalog through one private typed request", async ({
  request
}) => {
  const response = await request.get("/dramawebben/pjäser")

  expect(response.status()).toBe(200)
  const html = await response.text()
  expectManagedShell(html, "pjäser", "Dömd")
  const { document } = parseHTML(html)
  expectCatalogRootSiblings(document, false)
  const rows = [...document.querySelectorAll("table.contenttable:not(.authors) tbody tr")]
  expect(rows.map(row => normalizedText(row.textContent))).toEqual(
    dramawebbenCatalogExpected.plays
  )
  const firstReadHref = document.querySelector(
    'a[href$="/AgrellA/titlar/Domd/sida/1/etext#dw"]'
  )?.getAttribute("href")
  expect(firstReadHref).toBe(
    "/f%C3%B6rfattare/AgrellA/titlar/Domd/sida/1/etext#dw"
  )
  expect(document.querySelector(
    'table.contenttable:not(.authors) td.author a'
  )?.getAttribute("href")).toBe(
    "/f%C3%B6rfattare/AgrellA/dramawebben"
  )
  expect(await catalogRequests(request)).toEqual([{
    method: "GET",
    path: "/private-v2/dramawebben/catalog",
    authorization: null,
    cookie: null
  }])
  await expectNoDataRequests(request, ["/_dramawebben_catalog_requests"])
})

test("SSR gives both catalog tables stable non-visual column semantics", async ({ request }) => {
  const plays = parseHTML(await (await request.get("/dramawebben/pjäser")).text()).document
  const authors = parseHTML(await (await request.get(
    "/dramawebben/pjäser?visa=f%C3%B6rfattare"
  )).text()).document

  expect(normalizedText(plays.querySelector("table.contenttable caption")?.textContent))
    .toBe("Pjäser")
  expect([...plays.querySelectorAll("table.contenttable thead th")].map(header => ({
    scope: header.getAttribute("scope"),
    text: normalizedText(header.textContent)
  }))).toEqual([
    { scope: "col", text: "Författare" },
    { scope: "col", text: "Titel" },
    { scope: "col", text: "Format" }
  ])
  expect(normalizedText(authors.querySelector("table.authors caption")?.textContent))
    .toBe("Författare")
  expect([...authors.querySelectorAll("table.authors thead th")].map(header => ({
    scope: header.getAttribute("scope"),
    text: normalizedText(header.textContent)
  }))).toEqual([
    { scope: "col", text: "Författare" },
    { scope: "col", text: "Levnadsår" }
  ])
})

test("SSR renders a valid catalog source-information query in the initial HTML", async ({
  request
}) => {
  const response = await request.get(
    "/dramawebben/pjäser?om-boken&authorid=Alml%C3%B6fN&titlepath=Affarer&keep=1"
  )

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expectCatalogRootSiblings(document, true)
  const dialog = document.querySelector('.modal.about[role="dialog"]')
  expect(dialog?.getAttribute("aria-modal")).toBe("true")
  expect(normalizedText(dialog?.textContent)).toContain("Affärer")
  expect(dialog?.querySelector(".error")).toBeNull()
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/Alml%C3%B6fN/Affarer/source-info",
    query: ""
  }])
  expect(await catalogRequests(request)).toHaveLength(1)
})

test("SSR preserves Cendrillon infopost provenance, attribution, and live fact order", async ({
  request
}) => {
  const response = await request.get(
    "/dramawebben/pjäser?om-boken&authorid=WahlenbergA&titlepath=Cendrillon#dw"
  )

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const dialog = document.querySelector('.modal.about[role="dialog"]')
  expect(dialog?.querySelector(".error")).toBeNull()
  const provenance = dialog?.querySelector(".provenance")
  expect(provenance?.querySelector("a")?.getAttribute("href"))
    .toBe("http://www.dramawebben.se/")
  expect(provenance?.querySelector("img")?.getAttribute("src"))
    .toBe("/red/bilder/gemensamt/dramawebben_svart.svg")
  expect(provenance?.querySelector("p")).toBeNull()
  expect(normalizedText(dialog?.querySelector(".license")?.textContent)).toContain(
    "Vid användning ber vi att du hänvisar till Dramawebben och Litteraturbanken.se."
  )
  expect(normalizedText(dialog?.querySelector(".license")?.textContent))
    .not.toContain("hänvisar till och")
  expect([...dialog!.querySelectorAll(".dramaweb tbody tr")].map(row =>
    normalizedText(row.textContent)
  )).toEqual([
    "Svensk premiär1893",
    "Urpremiär1892",
    "Antal sidor96",
    "Antal akter3",
    "Antal roller8",
    "Antal män3",
    "Antal kvinnor4",
    "Antal övriga1"
  ])
})

for (const invalidDialogQuery of [
  "om-boken&authorid=Alml%C3%B6fN",
  "om-boken&authorid=..%2Fbad&titlepath=Affarer",
  "om-boken=&authorid=Alml%C3%B6fN&titlepath=Affarer",
  "om-boken&authorid=Alml%C3%B6fN&authorid=Other&titlepath=Affarer"
] as const) {
  test(`SSR ignores unsafe catalog source information: ${invalidDialogQuery}`, async ({
    request
  }) => {
    const response = await request.get(`/dramawebben/pjäser?${invalidDialogQuery}`)

    expect(response.status()).toBe(200)
    const { document } = parseHTML(await response.text())
    expect(document.querySelector('.modal.about[role="dialog"]')).toBeNull()
    expect(await sourceInfoRequests(request)).toEqual([])
    expect(await catalogRequests(request)).toHaveLength(1)
  })
}

for (const query of [
  "gender=unknown",
  "mediatype=unknown",
  "author=MissingAuthor",
  "number_of_pages=%2C"
] as const) {
  test(`SSR defaults the invalid catalog query ${query}`, async ({ request }) => {
    const response = await request.get(`/dramawebben/pjäser?${query}`)

    expect(response.status()).toBe(200)
    const { document } = parseHTML(await response.text())
    const rows = [...document.querySelectorAll("table.contenttable:not(.authors) tbody tr")]
    expect(rows.map(row => normalizedText(row.textContent))).toEqual(
      dramawebbenCatalogExpected.plays
    )
    expect(await catalogRequests(request)).toEqual([{
      method: "GET",
      path: "/private-v2/dramawebben/catalog",
      authorization: null,
      cookie: null
    }])
    await expectNoDataRequests(request, ["/_dramawebben_catalog_requests"])
  })
}

test("SSR rejects a structurally valid catalog with an unsafe media URL", async ({ request }) => {
  await setCatalogFailure(request, "unsafe-media-url-200")
  const response = await request.get("/dramawebben/pjäser")

  expect(response.status()).toBe(502)
  const html = await response.text()
  expectManagedShell(html, "pjäser", neutralError)
  expect(html).not.toContain("unsafe-media-url-probe")
  expect(await catalogRequests(request)).toEqual([{
    method: "GET",
    path: "/private-v2/dramawebben/catalog",
    authorization: null,
    cookie: null
  }])
  await expectNoDataRequests(request, ["/_dramawebben_catalog_requests"])
})

test("SSR rejects a catalog media URL that browsers normalize at a backslash", async ({
  request
}) => {
  await setCatalogFailure(request, "backslash-media-url-200")
  const response = await request.get("/dramawebben/pjäser")

  expect(response.status()).toBe(502)
  const html = await response.text()
  expectManagedShell(html, "pjäser", neutralError)
  expect(html).not.toContain("AgrellA\\escaped")
  expect(await catalogRequests(request)).toHaveLength(1)
  await expectNoDataRequests(request, ["/_dramawebben_catalog_requests"])
})

test("SSR accepts catalog works with omitted optional range metadata", async ({ request }) => {
  await setCatalogFailure(request, "omitted-range-field-200")
  const response = await request.get("/dramawebben/pjäser")

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const rows = [...document.querySelectorAll("table.contenttable:not(.authors) tbody tr")]
  expect(rows.map(row => normalizedText(row.textContent))).toEqual(
    dramawebbenCatalogExpected.plays
  )
})

test("SSR keeps #dw on a PDF-primary title while its media action downloads", async ({
  request
}) => {
  await setCatalogFailure(request, "pdf-primary-200")
  const response = await request.get("/dramawebben/pjäser")

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const firstRow = document.querySelector("table.contenttable:not(.authors) tbody tr")
  expect(firstRow?.querySelector("td.title a")?.getAttribute("href"))
    .toBe("/txt/lb-dramat-001/lb-dramat-001.pdf#dw")
  const mediaAction = firstRow?.querySelector("ul.mediatypes a")
  expect(mediaAction?.getAttribute("href"))
    .toBe("/txt/lb-dramat-001/lb-dramat-001.pdf")
  expect(mediaAction?.hasAttribute("download")).toBe(true)
  expect(mediaAction?.getAttribute("target")).toBe("_self")
  expect(await catalogRequests(request)).toEqual([{
    method: "GET",
    path: "/private-v2/dramawebben/catalog",
    authorization: null,
    cookie: null
  }])
  await expectNoDataRequests(request, ["/_dramawebben_catalog_requests"])
})

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

for (const invalidName of ["unknown"]) {
  test(`${invalidName} uses the global 404 before any source fetch`, async ({ request }) => {
    const response = await request.get(`/dramawebben/${invalidName}`)

    expect(response.status()).toBe(404)
    const html = await response.text()
    expect(html).not.toContain(neutralError)
    expect(await dramawebbenRequests(request)).toEqual([])
    await expectNoDataRequests(request)
  })
}

for (const [failure, status] of [
  ["status-503", 503],
  ["malformed-200", 502]
] as const) {
  test(`SSR keeps a stable catalog shell for ${failure}`, async ({ request }) => {
    await setCatalogFailure(request, failure)
    const response = await request.get("/dramawebben/pjäser")

    expect(response.status()).toBe(status)
    const html = await response.text()
    expectManagedShell(html, "pjäser", neutralError)
    expect(html).not.toMatch(
      /127\.0\.0\.1:4100|upstream-payload-probe|Unable to load Dramawebben catalog/iu
    )
    expect(await catalogRequests(request)).toEqual([{
      method: "GET",
      path: "/private-v2/dramawebben/catalog",
      authorization: null,
      cookie: null
    }])
    await expectNoDataRequests(request, ["/_dramawebben_catalog_requests"])
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
  await expectNoDataRequests(request)
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
    await expectNoDataRequests(request)
  })
}
