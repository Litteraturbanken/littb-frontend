import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const expectedRequests = [
  "/v2/epubs/popular?limit=30",
  "/v2/stats",
  "/v2/works/popular?limit=30"
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
