import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const articleId = "PublishedWorks.html"
const api = `/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/${articleId}`
const descriptorPath
  = `/private-v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/${articleId}`
const sourcePath = `/red/sla/${articleId}`
const exactBodyHtml = `<div class="article" lang="en"><div class="titlepage"><div><div><h1 class="title"><a id="idp1"></a>Published works</h1></div></div><hr></div><div class="sect1"><div class="titlepage"><div><div><h1 class="title" style="clear: both"><a id="idp2"></a>Published works</h1></div></div></div><p><a class="ulink" href="/bibliotek?sort=titlar&filter=selma%20lagerlöf" target="_top">Here you can find Selma Lagerlöf’s published texts in different editions</a>. You can
            choose between reading facsimiles of the published works or an authoritative e-text. You
            can also choose to <a class="ulink" href="/författare/LagerlöfS/jamfor.html" target="_top">compare two editions against one another</a>. Choose which work and which
            edition is to be shown by clicking the titles on the right. The selection of editions
            available to compare, are those displaying important differences. Within the e-text,
            there are word explanations and a critical commentary to the text, which explains the
            history of the works and the differences between different editions.</p></div></div>`

type ManagedRequest = {
  method: string
  path: string
}

type ManagedHeaders = {
  authorization: string | null
  cookie: string | null
  origin: string | null
}

async function requests(
  request: APIRequestContext,
  resource: "descriptor" | "source"
): Promise<ManagedRequest[]> {
  const response = await request.get(`${fixture}/_sla_article_${resource}_requests`)
  expect(response.status()).toBe(200)
  return (await response.json() as { requests: ManagedRequest[] }).requests
}

async function requestHeaders(request: APIRequestContext) {
  const response = await request.get(`${fixture}/_sla_article_request_headers`)
  expect(response.status()).toBe(200)
  return await response.json() as {
    descriptor: ManagedHeaders[]
    source: ManagedHeaders[]
  }
}

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_sla_article_descriptor_requests`),
    request.delete(`${fixture}/_sla_article_source_requests`),
    request.delete(`${fixture}/_sla_article_descriptor_failure`),
    request.delete(`${fixture}/_sla_article_source_failure`),
    request.delete(`${fixture}/_sla_article_redirect_target_requests`),
    request.delete(`${fixture}/_sla_article_source_cancellations`),
    request.delete(`${fixture}/_sla_article_request_headers`)
  ])
}

async function setFailure(
  request: APIRequestContext,
  resource: "descriptor" | "source",
  failure: string
) {
  const response = await request.put(`${fixture}/_sla_article_${resource}_failure`, {
    data: { failure }
  })
  expect(response.status()).toBe(200)
}

async function expectLocalError(
  response: APIResponse,
  status: 404 | 502,
  code: "sla_article_not_found" | "sla_article_unavailable"
) {
  expect(response.status()).toBe(status)
  expect(response.headers()["cache-control"]).toBe(
    status === 404 ? "no-cache" : "no-store"
  )
  const body = await response.text()
  const payload = JSON.parse(body) as { data?: { code?: string } }
  expect(payload.data?.code).toBe(code)
  expect(body).not.toMatch(
    /127\.0\.0\.1:4100|private-v2|red\/sla|upstream-provider-payload-probe|evil\.test/iu
  )
}

test.beforeEach(async ({ request }) => reset(request))

test("fixture controls reset descriptor and source failures independently", async ({
  request
}) => {
  await setFailure(request, "descriptor", "status-503")
  await setFailure(request, "source", "status-503")

  await request.delete(`${fixture}/_sla_article_descriptor_failure`)
  expect(await (await request.get(`${fixture}/_sla_article_descriptor_failure`)).json())
    .toEqual({ failure: null })
  expect(await (await request.get(`${fixture}/_sla_article_source_failure`)).json())
    .toEqual({ failure: "status-503" })

  await request.delete(`${fixture}/_sla_article_source_failure`)
  expect(await (await request.get(`${fixture}/_sla_article_source_failure`)).json())
    .toEqual({ failure: null })
})

test("fixture exposes cancellation of a rejected over-limit response stream", async ({
  request
}) => {
  await setFailure(request, "source", "oversized-streamed")
  const response = await fetch(`${fixture}${sourcePath}`)
  const reader = response.body!.getReader()
  let bytes = 0
  while (bytes <= 262_144) {
    const result = await reader.read()
    expect(result.done).toBe(false)
    bytes += result.value!.byteLength
  }
  await reader.cancel()

  await expect.poll(async () => {
    const result = await request.get(`${fixture}/_sla_article_source_cancellations`)
    return (await result.json() as { requests: ManagedRequest[] }).requests
  }).toEqual([{ method: "GET", path: sourcePath }])
})

test("returns the exact bounded article response", async ({ request }) => {
  const response = await request.get(api)
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toBe("no-store")
  expect(response.headers()["content-type"]).toContain("application/json")

  const payload = await response.json()
  expect(payload).toEqual({
    author: {
      authorId: "LagerlöfS",
      fullName: "Selma Lagerlöf",
      lifespan: "1858-1940",
      hasIntroduction: true,
      hasDramawebben: true,
      searchUrl: "/sok?forfattare=Lagerl%C3%B6fS&avancerad",
      audioUrl: "https://litteraturbanken.se/ljudochbild/författare/lagerlofs"
    },
    articleId,
    sourcePath,
    bodyHtml: exactBodyHtml
  })
  expect(await requests(request, "descriptor")).toEqual([
    { method: "GET", path: descriptorPath }
  ])
  expect(await requests(request, "source")).toEqual([
    { method: "GET", path: sourcePath }
  ])
})

test("rejects local route variants before either managed request", async ({ request }) => {
  const paths = [
    `/nuxt-api/author-documents/S%C3%B6derbergH/omtexterna/${articleId}`,
    "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/NotRegistered.html",
    "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/publishedWorks.html",
    "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/%50ublishedWorks.html",
    "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/%2550ublishedWorks.html",
    "/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/%252e%252e",
    `/nuxt-api/author-documents/Lagerl%C3%B6fS/omtexterna/${articleId}/extra`
  ]
  for (const path of paths) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
  }
  expect(await requests(request, "descriptor")).toEqual([])
  expect(await requests(request, "source")).toEqual([])
})

test("rejects every non-GET method before either managed request", async ({ request }) => {
  for (const method of ["head", "post", "put", "patch", "delete"] as const) {
    const response = await request[method](api)
    expect([404, 405]).toContain(response.status())
  }
  expect(await requests(request, "descriptor")).toEqual([])
  expect(await requests(request, "source")).toEqual([])
})

for (const failure of ["source-query", "extra-field"] as const) {
  test(`rejects descriptor ${failure} before source fetching`, async ({ request }) => {
    await setFailure(request, "descriptor", failure)
    await expectLocalError(await request.get(api), 502, "sla_article_unavailable")
    expect(await requests(request, "descriptor")).toEqual([
      { method: "GET", path: descriptorPath }
    ])
    expect(await requests(request, "source")).toEqual([])
  })
}

for (const [failure, status, code] of [
  ["status-404", 404, "sla_article_not_found"],
  ["status-503", 502, "sla_article_unavailable"],
  ["malformed-json", 502, "sla_article_unavailable"]
] as const) {
  test(`maps descriptor ${failure} to the local non-leaking ${status}`, async ({
    request
  }) => {
    await setFailure(request, "descriptor", failure)
    await expectLocalError(await request.get(api), status, code)
    expect(await requests(request, "source")).toEqual([])
  })
}

for (const failure of ["redirect-307", "redirect-308"] as const) {
  test(`keeps descriptor ${failure} manual`, async ({ request }) => {
    await setFailure(request, "descriptor", failure)
    await expectLocalError(await request.get(api), 502, "sla_article_unavailable")
    expect(await (await request.get(
      `${fixture}/_sla_article_redirect_target_requests`
    )).json()).toEqual({ requests: [] })
    expect(await requests(request, "source")).toEqual([])
  })
}

for (const [failure, status, code] of [
  ["status-404", 404, "sla_article_not_found"],
  ["status-503", 502, "sla_article_unavailable"],
  ["wrong-media-type", 502, "sla_article_unavailable"],
  ["oversized-declared", 502, "sla_article_unavailable"],
  ["oversized-streamed", 502, "sla_article_unavailable"],
  ["rejected-stream", 502, "sla_article_unavailable"],
  ["missing-body", 502, "sla_article_unavailable"],
  ["multiple-bodies", 502, "sla_article_unavailable"]
] as const) {
  test(`maps source ${failure} to the local non-leaking ${status}`, async ({ request }) => {
    await setFailure(request, "source", failure)
    await expectLocalError(await request.get(api), status, code)
    expect(await requests(request, "descriptor")).toHaveLength(1)
    expect(await requests(request, "source")).toEqual([
      { method: "GET", path: sourcePath }
    ])
  })
}

test("keeps a source redirect manual and never contacts its target", async ({ request }) => {
  await setFailure(request, "source", "redirect-302")
  await expectLocalError(await request.get(api), 502, "sla_article_unavailable")
  expect(await (await request.get(
    `${fixture}/_sla_article_redirect_target_requests`
  )).json()).toEqual({ requests: [] })
})

for (const failure of [
  "media-without-charset",
  "media-with-quoted-charset",
  "exact-declared-cap",
  "exact-streamed-cap"
] as const) {
  test(`accepts source ${failure} at the exact boundary`, async ({ request }) => {
    await setFailure(request, "source", failure)
    const response = await request.get(api)
    expect(response.status()).toBe(200)
    const payload = await response.json()
    expect(payload.articleId).toBe(articleId)
    if (failure.startsWith("exact-")) {
      expect(payload.bodyHtml).toContain("cap-boundary-start")
      expect(payload.bodyHtml).toContain("cap-boundary-end")
    }
  })
}

test("cancels the over-limit managed source response", async ({ request }) => {
  await setFailure(request, "source", "oversized-streamed")
  await expectLocalError(await request.get(api), 502, "sla_article_unavailable")
  await expect.poll(async () => {
    return await (await request.get(
      `${fixture}/_sla_article_source_cancellations`
    )).json()
  }).toEqual({ requests: [{ method: "GET", path: sourcePath }] })
})

test("does not forward public query, cookies, authorization, or origin", async ({ request }) => {
  const response = await request.get(
    `${api}?repeat=one&repeat=two&source=https%3A%2F%2Fevil.test`,
    {
      headers: {
        authorization: "Bearer public-probe",
        cookie: "probe=secret",
        origin: "https://evil.test"
      }
    }
  )
  expect(response.status()).toBe(200)
  expect(await requests(request, "descriptor")).toEqual([
    { method: "GET", path: descriptorPath }
  ])
  expect(await requests(request, "source")).toEqual([
    { method: "GET", path: sourcePath }
  ])
  expect(await requestHeaders(request)).toEqual({
    descriptor: [{ authorization: null, cookie: null, origin: null }],
    source: [{ authorization: null, cookie: null, origin: null }]
  })
})

test("resets descriptor and source ledgers independently", async ({ request }) => {
  expect((await request.get(api)).status()).toBe(200)
  await request.delete(`${fixture}/_sla_article_descriptor_requests`)
  expect(await requests(request, "descriptor")).toEqual([])
  expect(await requests(request, "source")).toHaveLength(1)

  await request.delete(`${fixture}/_sla_article_source_requests`)
  expect(await requests(request, "source")).toEqual([])
})
