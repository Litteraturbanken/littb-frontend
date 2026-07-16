import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"

async function resetReader(request: APIRequestContext) {
  await request.delete(`${fixture}/_reader_requests`)
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

test.beforeEach(async ({ request }) => resetReader(request))

test("the exact Doktor Glas page is complete in the SSR response", async ({ request }) => {
  const response = await request.get(readerPath)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("<title>Doktor Glas sida -2 etext | Litteraturbanken</title>")
  expect(html).toContain("Doktor Glas av Hjalmar Söderberg, sida -2 som etext.")
  expect(html).toMatch(/<body[^>]*class="focus page-reading ready"/)
  expect(html).toContain('href="/red/css/etext.css"')
  expect(html).toContain('href="/txt/css/lb-reader-doktor-glas-etext.css"')
  expect(html).toContain("DOKTOR GLAS")
  expect(html).toContain("HJALMAR SÖDERBERG")
  expect(html).toContain("-2 av 3")
  expect(html).toContain('href="/författare/SöderbergH/titlar/DoktorGlas/sida/-3/etext"')
  expect(html).toContain('href="/författare/SöderbergH/titlar/DoktorGlas/sida/-1/etext"')
  expect(html).not.toContain("Hämtar sida")

  const recorded = await readerRequests(request)
  expect(recorded.filter(path => path.startsWith("/api/get_work_info?"))).toHaveLength(1)
  expect(recorded.filter(path => path.startsWith(
    "/txt/lb-reader-doktor-glas/res_00002.html?"
  ))).toHaveLength(1)
})

test("an unknown page is a real 404", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/missing/etext"
  )
  expect(response.status()).toBe(404)
  expect(await response.text()).not.toContain("DOKTOR GLAS")
  const recorded = await readerRequests(request)
  expect(recorded.filter(path => path.startsWith("/api/get_work_info?"))).toHaveLength(1)
  expect(recorded.filter(path => path.includes("/res_"))).toHaveLength(0)
})
