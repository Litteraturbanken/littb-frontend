import { expect, test, type APIRequestContext } from "@playwright/test"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin

async function reset(request: APIRequestContext) {
  await request.delete(`${fixture}/_quick_search_requests`)
}

test("shell renders the semantic Quick Search trigger without querying during SSR", async ({ request }) => {
  await reset(request)

  const response = await request.get("/om/ide")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toMatch(
    /<a\b(?=[^>]*\brole="button")(?=[^>]*\btabindex="0")(?=[^>]*\btitle="Snabbkommando: (?:'|&#39;)s(?:'|&#39;)")(?=[^>]*\bclass="[^"]*quick-search-trigger)[^>]*>Snabbsökning<\/a>/
  )
  expect(html).not.toContain('role="dialog"')
  expect(html).not.toContain('id="autocomplete"')

  const log = await (await request.get(`${fixture}/_quick_search_requests`)).json()
  expect(log.queries).toEqual([])
})
