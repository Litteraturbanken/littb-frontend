import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"

async function reset(request: APIRequestContext) {
  await request.delete(`${fixture}/_quick_search_requests`)
}

test("shell renders the semantic Quick Search trigger without querying during SSR", async ({ request }) => {
  await reset(request)

  const response = await request.get("/om/ide")
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toMatch(
    /<button\b(?=[^>]*\btype="button")(?=[^>]*\btitle="Snabbkommando: (?:'|&#39;)s(?:'|&#39;)")(?=[^>]*\bclass="[^"]*quick-search-trigger)[^>]*>Snabbsökning<\/button>/
  )
  expect(html).not.toContain('role="dialog"')
  expect(html).not.toContain('id="autocomplete"')

  const log = await (await request.get(`${fixture}/_quick_search_requests`)).json()
  expect(log.queries).toEqual([])
})
