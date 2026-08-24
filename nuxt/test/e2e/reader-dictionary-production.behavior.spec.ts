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

test("the explicit legacy mode keeps the Reader dictionary rollback usable", async ({
  page,
  request
}) => {
  await page.goto(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext",
    { waitUntil: "networkidle" }
  )
  await page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first().dblclick()
  await page.getByRole("button", { name: "Slå upp DOKTOR i Svensk ordbok" }).click()

  await expect(page.locator("._so_article"))
    .toContainText("En deterministisk ordboksartikel.")
  expect(await dictionaryRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/dictionary/articles",
    query: "?word=DOKTOR"
  }])
})

for (const [name, response] of [
  ["API failure", {
    status: 503,
    json: {
      error: {
        code: "dictionary_unavailable",
        message: "Dictionary unavailable",
        details: null
      }
    }
  }],
  ["invalid article", {
    status: 200,
    json: {
      word: "DOKTOR",
      base_form: "",
      article_html: "<lemma><grundform>DOKTOR</grundform></lemma>"
    }
  }],
  ["sanitized-empty article", {
    status: 200,
    json: {
      word: "DOKTOR",
      base_form: "DOKTOR",
      article_html: "<script>bad()</script>"
    }
  }]
] as const) {
  test(`${name} restores focus to the initiating Reader word`, async ({ page }) => {
    await page.route("**/api/v2/dictionary/articles?word=DOKTOR", route => (
      route.fulfill(response)
    ))
    await page.goto(
      "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext",
      { waitUntil: "networkidle" }
    )
    const word = page.locator(".reader_main .w").filter({ hasText: "DOKTOR" }).first()
    await word.dblclick()
    const scrollBeforeLookup = await page.evaluate(() => window.scrollY)

    await page.getByRole("button", { name: "Slå upp DOKTOR i Svensk ordbok" }).click()

    await expect(page.locator(".alert_popup")).toHaveText("Hittade inget uppslag")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(word).toBeFocused()
    await expect(word).toHaveAttribute("tabindex", "-1")
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeLookup)

    await page.locator(".reader-work-search-trigger").focus()
    await expect(page.locator(".reader-work-search-trigger")).toBeFocused()
    await expect.poll(() => word.getAttribute("tabindex")).toBeNull()
  })
}
