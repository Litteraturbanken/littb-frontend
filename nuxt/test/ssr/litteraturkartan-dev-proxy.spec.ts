import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const sentinel = "litteraturkartan-upstream-fixture"

async function resetMapLedger(request: APIRequestContext) {
  await request.delete(`${fixture}/_litteraturkartan_requests`)
}

async function mapRequests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixture}/_litteraturkartan_requests`)
  return (await response.json()).requests
}

function expectUpstreamBody(body: string) {
  expect(body).toContain(sentinel)
  expect(body).not.toContain('id="__nuxt"')
  expect(body).not.toContain("site-shell")
  expect(body).not.toContain("leftCorridor")
}

test.beforeEach(async ({ request }) => resetMapLedger(request))

test("proxies the Litteraturkartan root without rendering the Nuxt shell", async ({
  request
}) => {
  const response = await request.get("/litteraturkartan")

  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toBe("text/html; charset=utf-8")
  expectUpstreamBody(await response.text())
  expect(await mapRequests(request)).toEqual(["/litteraturkartan"])
})

test("proxies the exact Litteraturkartan root with its query intact", async ({
  request
}) => {
  const path = "/litteraturkartan?view=map"
  const response = await request.get(path)

  expect(response.status()).toBe(200)
  expectUpstreamBody(await response.text())
  expect(await mapRequests(request)).toEqual([path])
})

test("preserves an encoded nested Litteraturkartan path and query exactly", async ({
  request
}) => {
  const path = "/litteraturkartan/region/%C3%96land/%E2%80%93?view=text%2Fbild&empty="
  const response = await request.get(path)

  expect(response.status()).toBe(200)
  expectUpstreamBody(await response.text())
  expect(await mapRequests(request)).toEqual([path])
})

test("does not proxy Litteraturkartan prefix lookalikes", async ({ request }) => {
  for (const path of ["/litteraturkartans", "/litteraturkartan-preview/nested"]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
    expect(await response.text(), path).not.toContain(sentinel)
  }
  expect(await mapRequests(request)).toEqual([])
})
