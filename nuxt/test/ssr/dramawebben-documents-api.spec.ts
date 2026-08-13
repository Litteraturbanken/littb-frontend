import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const omApi = "/nuxt-api/dramawebben/documents/om"
const kringtexterApi = "/nuxt-api/dramawebben/documents/kringtexter"

type ManagedRequest = {
  method: string
  path: string
  authorization: string | null
  cookie: string | null
}

async function resetDramawebben(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_dramawebben_document_requests`),
    request.delete(`${fixture}/_dramawebben_document_failure`),
    request.delete(`${fixture}/_dramawebben_document_redirect_target_requests`)
  ])
}

async function managedRequests(request: APIRequestContext): Promise<ManagedRequest[]> {
  return (await (await request.get(
    `${fixture}/_dramawebben_document_requests`
  )).json()).requests
}

async function redirectTargetRequests(request: APIRequestContext): Promise<unknown[]> {
  return (await (await request.get(
    `${fixture}/_dramawebben_document_redirect_target_requests`
  )).json()).requests
}

async function setFailure(request: APIRequestContext, failure: string) {
  const response = await request.put(`${fixture}/_dramawebben_document_failure`, {
    data: { failure }
  })
  expect(response.status()).toBe(200)
}

async function expectLocalError(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
  status: 404 | 502,
  code: "dramawebben_document_not_found" | "dramawebben_document_unavailable"
) {
  expect(response.status()).toBe(status)
  expect(response.headers()["cache-control"]).toBe("no-store")
  const body = await response.text()
  const payload = JSON.parse(body) as { data?: { code?: string } }
  expect(payload.data?.code).toBe(code)
  expect(body).not.toMatch(/127\.0\.0\.1:4100|red\/dramawebben|upstream-payload-probe|evil\.test/iu)
}

test.beforeEach(async ({ request }) => resetDramawebben(request))

for (const [kind, api, sourcePath, heading] of [
  ["om", omApi, "/red/dramawebben/om.html", "Om Dramawebben"],
  [
    "kringtexter",
    kringtexterApi,
    "/red/dramawebben/kringtexter/kringtexter.html",
    "Mer läsning om svensk dramatik"
  ]
] as const) {
  test(`returns the exact sanitized ${kind} contract`, async ({ request }) => {
    const response = await request.get(api)

    expect(response.status()).toBe(200)
    expect(response.headers()["cache-control"]).toBe("no-store")
    expect(response.headers()["content-type"]).toContain("application/json")
    const payload = await response.json()
    expect(payload.documentKind).toBe(kind)
    expect(payload.bodyHtml).toContain(heading)
    expect(payload.bodyHtml).not.toMatch(/<(?:html|head|body|title|meta)\b/iu)
    expect(payload.bodyHtml).not.toMatch(/<(?:script|style|form|iframe|object|svg|math)\b/iu)
    expect(await managedRequests(request)).toEqual([{
      method: "GET",
      path: sourcePath,
      authorization: null,
      cookie: null
    }])
  })
}

test("does not forward public query, cookies, or authorization", async ({ request }) => {
  const response = await request.get(
    `${omApi}?repeat=one&repeat=two&source=https%3A%2F%2Fevil.test`,
    { headers: { authorization: "Bearer public-probe", cookie: "probe=secret" } }
  )

  expect(response.status()).toBe(200)
  expect(await managedRequests(request)).toEqual([{
    method: "GET",
    path: "/red/dramawebben/om.html",
    authorization: null,
    cookie: null
  }])
})

for (const kind of ["pjäser", "forfattare", "OM", "%252e%252e"]) {
  test(`rejects the non-mapped public name ${kind} before fetching`, async ({ request }) => {
    const response = await request.get(`/nuxt-api/dramawebben/documents/${kind}`)
    await expectLocalError(response, 404, "dramawebben_document_not_found")
    expect(await managedRequests(request)).toEqual([])
  })
}

test("sanitizes the malicious fixture through the public boundary", async ({ request }) => {
  await setFailure(request, "malicious")
  const response = await request.get(omApi)
  expect(response.status()).toBe(200)
  const payload = await response.json()

  expect(payload.bodyHtml).toContain("safe-visible-probe")
  expect(payload.bodyHtml).not.toMatch(/script-probe|form-probe|svg-probe|comment-probe/iu)
  expect(payload.bodyHtml).not.toMatch(/javascript:|data:|http:\/\/evil\.test|\.\.\/private/iu)
  expect(payload.bodyHtml).toContain('target="_blank"')
  expect(payload.bodyHtml).toMatch(/rel="[^"]*noopener[^"]*noreferrer[^"]*"/u)
})

for (const [failure, status, code] of [
  ["content-404", 404, "dramawebben_document_not_found"],
  ["content-502", 502, "dramawebben_document_unavailable"],
  ["wrong-content-type", 502, "dramawebben_document_unavailable"],
  ["oversized-declared", 502, "dramawebben_document_unavailable"],
  ["oversized-streamed", 502, "dramawebben_document_unavailable"]
] as const) {
  test(`maps ${failure} to the local non-leaking ${status}`, async ({ request }) => {
    await setFailure(request, failure)
    const response = await request.get(omApi)
    await expectLocalError(response, status, code)
    expect(await managedRequests(request)).toEqual([{
      method: "GET",
      path: "/red/dramawebben/om.html",
      authorization: null,
      cookie: null
    }])
  })
}

test("blocks an upstream redirect without contacting its target", async ({ request }) => {
  await setFailure(request, "content-redirect")
  const response = await request.get(omApi)

  await expectLocalError(response, 502, "dramawebben_document_unavailable")
  expect(await redirectTargetRequests(request)).toEqual([])
})
