import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = "http://127.0.0.1:4100"
const expectedRequests = [
  "/private-v2/epubs/popular?limit=30",
  "/private-v2/stats",
  "/private-v2/works/popular?limit=30"
]

async function resetFixture(request: APIRequestContext) {
  await request.delete(`${fixture}/_requests`)
  await request.delete(`${fixture}/_failure`)
}

test("direct HTML contains metadata, data, and rankings before hydration", async ({
  request
}) => {
  await resetFixture(request)

  const response = await request.get("/om/statistik")
  expect(response.status()).toBe(200)
  const html = await response.text()

  for (const text of [
    "<title>Om LB | Litteraturbanken</title>",
    "Statistik för Litteraturbanken.",
    "Om Litteraturbanken",
    "Litteraturbanken innehåller just nu",
    "De mest lästa verken",
    "De mest nedladdade epubarna",
    "16 237 verk",
    "5521 författare",
    "342 753 sidor etext",
    "2 737 882 sidor faksimil",
    "741 208 730 ord",
    "1513 epubfiler",
    "Doktor Glas",
    "Popular Work 30",
    "EPUB Work 30"
  ]) {
    expect(html).toContain(text)
  }

  const log = await (await request.get(`${fixture}/_requests`)).json()
  expect([...log.requests].sort()).toEqual(expectedRequests)
})

test("malformed dot identities drop only their ranking rows", async ({ request }) => {
  await resetFixture(request)
  await request.put(`${fixture}/_failure`, { data: { resource: "malformed-stat-paths" } })

  const response = await request.get("/om/statistik")
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)
  const rankings = document.querySelector(".content.stats")?.textContent ?? ""

  expect(rankings).toContain("Litteraturbanken innehåller just nu")
  expect(rankings).toContain("Fröken Julie")
  expect(rankings).toContain("EPUB Work 3")
  expect(rankings).not.toContain("Doktor Glas")
  expect(rankings).not.toContain("Samlade Verk 27")
  expect(html).not.toContain('href="/f%C3%B6rfattare/"')
  expect(html).not.toContain('href="/txt/epub/"')
})

test("malformed reader segments drop only their rows before hydration", async ({ request }) => {
  await resetFixture(request)
  await request.put(`${fixture}/_failure`, {
    data: { resource: "malformed-stat-route-segments" }
  })

  const response = await request.get("/om/statistik")
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)
  const lists = document.querySelectorAll(".content.stats > ul")
  const renderedRankings = [...lists].map(list => list.textContent ?? "").join("\n")

  expect(lists[0]?.textContent).toContain("16 237 verk")
  expect(lists[1]?.textContent).toContain("Valid statistics work sibling")
  expect(lists[1]?.textContent).toContain("Valid percent PDF filename")
  expect(lists[2]?.textContent).toContain("Valid percent EPUB filename")
  for (const text of [
    "Malformed slash author statistics work",
    "Malformed backslash author statistics work",
    "Malformed percent author statistics work",
    "Malformed slash title statistics work",
    "Malformed backslash title statistics work",
    "Malformed percent title statistics work",
    "Malformed slash page statistics work",
    "Malformed backslash page statistics work",
    "Malformed percent page statistics work",
    "Malformed slash EPUB author",
    "Malformed backslash EPUB author",
    "Malformed percent EPUB author"
  ]) expect(renderedRankings).not.toContain(text)

  expect(html).toContain(
    'href="/f%C3%B6rfattare/ValidStatisticsAuthor/titlar/ValidStatisticsWork/sida/1/etext"'
  )
  expect(html).toContain('href="/txt/valid%25statistics-pdf/valid%25statistics-pdf.pdf"')
  expect(html).toContain('href="/txt/epub/ValidEpubAuthor_Valid%25StatisticsEpub.epub"')
  for (const escaped of ["%2F", "%5C", "%25"]) {
    expect(html).not.toContain(`Unsafe${escaped}`)
  }
})
