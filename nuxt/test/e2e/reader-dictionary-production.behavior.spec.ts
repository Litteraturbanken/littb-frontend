import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

type DictionaryRequest = {
  scope: "private" | "public"
  path: string
  query: string
}

async function dictionaryRequests(request: APIRequestContext): Promise<DictionaryRequest[]> {
  return (await (await request.get(`${fixture}/_dictionary_requests`)).json()).requests
}

test.beforeEach(async ({ request }) => {
  await request.delete(`${fixture}/_dictionary_requests`)
})

test("the production browser dictionary API uses the private upstream", async ({ request }) => {
  const response = await request.get("/api/v2/dictionary/articles?word=DOKTOR")

  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    word: "DOKTOR",
    base_form: "DOKTOR",
    article_html: "<lemma id=\"unsafe\" onclick=\"bad()\"><grundform-clean>DOKTOR</grundform-clean><grundform>DOKTOR</grundform><lexem><def>En deterministisk ordboksartikel.</def></lexem><script>bad()</script></lemma>"
  })
  expect(await dictionaryRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/dictionary/articles",
    query: "?word=DOKTOR"
  }])
})
