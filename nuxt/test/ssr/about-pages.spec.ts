import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"

const pages = [
  ["ide", "/red/om/ide/omlitteraturbanken.html", ["Introduktion", "Om urvalet av texter", "Mål"]],
  ["organisation", "/red/om/ide/organisation.html", ["Organisation", "Teknisk utveckling", "Tidigare medarbetare"]],
  ["rattigheter", "/red/om/rattigheter/rattigheter.html", ["Rättigheter och material", "Creative Commons", "Licenser på metadata"]],
  ["tack", "/red/om/tack.html", ["Litteraturbanken tackar", "Kungl. biblioteket", "Uppsala universitetsbibliotek"]]
] as const

const unlistedPages = [
  [
    "mål",
    "/red/om/visioner/visioner.html",
    ["Mål", "Digitaliseringen är också en fråga om demokrati", "Litteraturbanken, 2023"],
    "<title>Mål</title>"
  ],
  [
    "english.html",
    "/red/om/ide/english.html",
    ["The Swedish Literature Bank", "Board", "Technical developers"],
    "<title>ENGLISH</title>"
  ],
  [
    "deutsch.html",
    "/red/om/ide/deutsch.html",
    ["Die Schwedische Literaturbank", "Vorstand", "Technische Entwickler"],
    "<title>DEUTSCH</title>"
  ],
  [
    "francais.html",
    "/red/om/ide/francais.html",
    ["La Banque de littérature suédoise", "Comité directeur", "Développement technique"],
    "<title>FRANÇAIS</title>"
  ]
] as const

async function reset(request: APIRequestContext) {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
}

for (const [slug, contentPath, markers] of pages) {
  test(`${slug} fetches its allowlisted content during SSR`, async ({ request }) => {
    await reset(request)
    const response = await request.get(`/om/${slug}`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("<title>Om LB | Litteraturbanken</title>")
    expect(html).toContain("Om Litteraturbanken")
    for (const marker of markers) expect(html).toContain(marker)
    expect(html).not.toContain("XHTML 1.0 Transitional")
    expect(html).not.toMatch(/<title>(?:OM_LITTERATURBANKEN|ORGANISATION|RÄTTIGHETER)<\/title>/)
    const log = await (await request.get(`${fixture}/_requests`)).json()
    expect(log.requests).toEqual([contentPath])
  })
}

for (const [slug, contentPath, markers, upstreamTitle] of unlistedPages) {
  test(`${slug} fetches its allowlisted content without activating an About link during SSR`, async ({ request }) => {
    await reset(request)
    const response = await request.get(`/om/${slug}`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    for (const marker of markers) expect(html).toContain(marker)
    expect(html).not.toContain("XHTML 1.0")
    expect(html).not.toContain(upstreamTitle)
    expect(html.match(/<a\b(?=[^>]*\bclass="active")(?=[^>]*\bhref="\/om\/)[^>]*>/g) ?? []).toHaveLength(0)
    const log = await (await request.get(`${fixture}/_requests`)).json()
    expect(log.requests).toEqual([contentPath])
  })
}

test("content failure preserves the About shell without leaking upstream text", async ({ request }) => {
  await reset(request)
  await request.put(`${fixture}/_failure`, { data: { resource: "content" } })
  const response = await request.get("/om/ide")
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("Om Litteraturbanken")
  expect(html).not.toContain("Introduktion")
  expect(html).not.toContain("content unavailable")
})

test("unknown About page is a real 404 and cannot select a remote path", async ({ request }) => {
  await reset(request)
  const response = await request.get("/om/not-allowed")
  expect(response.status()).toBe(404)
  const log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual([])
})
