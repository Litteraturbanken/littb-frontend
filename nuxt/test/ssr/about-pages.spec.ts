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

test("Help fetches its allowlisted content and activates only Help during SSR", async ({ request }) => {
  await reset(request)
  const response = await request.get("/om/hjalp")
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("Hjälp")
  expect(html).toContain("Söka efter en text eller en författare")
  expect(html).toContain("Hämta och läsa texter i epubformatet")
  expect(html).toContain("Textstorlek")
  expect(html).not.toContain("XHTML 1.0 Strict")
  expect(html).not.toContain("<!DOCTYPE html PUBLIC")
  expect(html).toContain('<div class="help_content content unbox page-help"')
  expect(html.match(/<a\b(?=[^>]*\bclass="active")(?=[^>]*\bhref="\/om\/)[^>]*>/g) ?? []).toHaveLength(1)
  expect(html).toMatch(/<a\b(?=[^>]*\bclass="active")(?=[^>]*\bhref="\/om\/hjalp")[^>]*>/)
  const log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual(["/red/om/hjalp/hjalp.html"])
})

test("Help content failure preserves the active About shell without leaking upstream text", async ({ request }) => {
  await reset(request)
  await request.put(`${fixture}/_failure`, { data: { resource: "content" } })
  const response = await request.get("/om/hjalp")
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("Om Litteraturbanken")
  expect(html).toMatch(/<a\b(?=[^>]*\bclass="active")(?=[^>]*\bhref="\/om\/hjalp")[^>]*>/)
  expect(html).not.toContain("Söka efter en text eller en författare")
  expect(html).not.toContain("content unavailable")
  const log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests.length).toBeGreaterThan(0)
  expect(new Set(log.requests)).toEqual(new Set(["/red/om/hjalp/hjalp.html"]))
})

test("unknown About page is a real 404 and cannot select a remote path", async ({ request }) => {
  await reset(request)
  const response = await request.get("/om/not-allowed")
  expect(response.status()).toBe(404)
  const log = await (await request.get(`${fixture}/_requests`)).json()
  expect(log.requests).toEqual([])
})

test("Contact renders exact metadata, copy, and active state without submitting during SSR", async ({ request }) => {
  await reset(request)
  await request.delete(`${fixture}/_contact_submissions`)

  const response = await request.get("/om/kontakt")
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("<title>Om LB | Litteraturbanken</title>")
  expect(html).toContain('name="description" content="Litteraturbankens kontaktforumlär och utskicksanmälan."')
  expect(html).toContain("Vill du skicka ett meddelande till oss? Då kan du använda formuläret här nedan.")
  expect(html).toContain("Vill du få Litteraturbankens utskick? Skriv in din epostadress här.")
  expect(html).toContain("Tack för ditt meddelande, vi svarar så fort vi kan.")
  expect(html).toContain("Tack för din anmälan.")
  expect(html).toContain("Ett fel uppstod. Vänligen försök igen senare.")
  expect(html.match(/<a\b(?=[^>]*\bclass="active")(?=[^>]*\bhref="\/om\/)[^>]*>/g) ?? []).toHaveLength(1)
  expect(html).toMatch(/<a\b(?=[^>]*\bclass="active")(?=[^>]*\bhref="\/om\/kontakt")[^>]*>/)

  const submissions = await (await request.get(`${fixture}/_contact_submissions`)).json()
  expect(submissions.contactSubmissions).toEqual([])
})
