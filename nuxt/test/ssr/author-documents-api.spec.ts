import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const presentationApi = "/api/author-documents/S%C3%B6derbergH/presentation"
const bibliographyApi = "/api/author-documents/Lagerl%C3%B6fS/bibliografi"

type AuthorDocumentRequest = {
  kind: "descriptor" | "content"
  path: string
}

async function resetAuthorDocuments(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_document_requests`),
    request.delete(`${fixture}/_author_document_redirect_target_requests`),
    request.delete(`${fixture}/_author_document_failure`),
    request.delete(`${fixture}/_author_document_delay`)
  ])
}

async function redirectTargetRequests(request: APIRequestContext): Promise<unknown[]> {
  return (await (await request.get(
    `${fixture}/_author_document_redirect_target_requests`
  )).json()).requests
}

async function authorDocumentRequests(
  request: APIRequestContext
): Promise<AuthorDocumentRequest[]> {
  return (await (await request.get(`${fixture}/_author_document_requests`)).json()).requests
}

async function setFailure(request: APIRequestContext, failure: string) {
  const response = await request.put(`${fixture}/_author_document_failure`, {
    data: { failure }
  })
  expect(response.status()).toBe(200)
}

async function expectErrorCode(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
  status: number,
  code: string
) {
  expect(response.status()).toBe(status)
  const payload = await response.json() as { data?: { code?: string } }
  expect(payload.data?.code).toBe(code)
  expect(JSON.stringify(payload)).not.toMatch(/private-v2|red\/forfattare|evil\.test/iu)
}

test.beforeEach(async ({ request }) => resetAuthorDocuments(request))

test("loads and sanitizes the exact Söderberg presentation through private origins", async ({
  request
}) => {
  const response = await request.get(presentationApi)
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toBe("no-store")
  const payload = await response.json()

  expect(payload.author).toEqual({
    authorId: "SöderbergH",
    fullName: "Hjalmar Söderberg",
    lifespan: "1869-1941",
    hasIntroduction: true,
    hasDramawebben: false,
    searchUrl: "/sok?forfattare=S%C3%B6derbergH&avancerad",
    audioUrl: "https://litteraturbanken.se/ljudochbild/författare/soderbergh"
  })
  expect(payload.documentKind).toBe("presentation")
  expect(payload.bodyHtml).toContain("Hjalmar Söderberg, född 1869")
  expect(payload.bodyHtml).toContain(
    'href="/forfattare/SoderbergH/titlar/Forvillelser/sida/3/etext"'
  )
  expect(payload.bodyHtml).not.toMatch(/<(?:script|style|form|iframe|svg|math)\b/iu)
  expect(await authorDocumentRequests(request)).toEqual([
    {
      kind: "descriptor",
      path: "/private-v2/authors/S%C3%B6derbergH/documents/presentation"
    },
    {
      kind: "content",
      path: "/red/forfattare/SoderbergH/presentation/index.html"
    }
  ])
})

test("loads the exact Lagerlöf bibliography and preserves inline PDF behavior", async ({
  request
}) => {
  const response = await request.get(bibliographyApi)
  expect(response.status()).toBe(200)
  const payload = await response.json()

  expect(payload.author).toEqual({
    authorId: "LagerlöfS",
    fullName: "Selma Lagerlöf",
    lifespan: "1858-1940",
    hasIntroduction: true,
    hasDramawebben: true,
    searchUrl: "/sok?forfattare=Lagerl%C3%B6fS&avancerad",
    audioUrl: "https://litteraturbanken.se/ljudochbild/författare/lagerlofs"
  })
  expect(payload.documentKind).toBe("bibliografi")
  expect(payload.bodyHtml).toContain("Selma Lagerlöf. Bibliografi")
  expect(payload.bodyHtml).toContain(
    'href="/red/forfattare/LagerlofS/bibliografi/LagerlofS_bibliografi.pdf"'
  )
  expect(payload.bodyHtml).toContain('target="_blank"')
  expect(payload.bodyHtml).toMatch(/rel="[^"]*noopener[^"]*noreferrer[^"]*"/u)
})

test("supports the sparse descriptor without inventing optional navigation", async ({
  request
}) => {
  const response = await request.get("/api/author-documents/SparseDocument/presentation")
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    author: {
      authorId: "SparseDocument",
      fullName: "Författare utan tilläggsnavigering",
      lifespan: "",
      hasIntroduction: false,
      hasDramawebben: false,
      searchUrl: null,
      audioUrl: null
    },
    documentKind: "presentation",
    bodyHtml: '<p id="sparse-document-body">Ett litet giltigt författardokument.</p>'
  })
})

for (const [failure, status, code] of [
  ["descriptor-404", 404, "author_document_author_not_found"],
  ["content-404", 404, "author_document_not_found"],
  ["descriptor-503", 502, "author_document_unavailable"],
  ["content-503", 502, "author_document_unavailable"],
  ["malformed-descriptor", 502, "author_document_unavailable"],
  ["unsafe-source-path", 502, "author_document_unavailable"],
  ["malformed-content", 502, "author_document_unavailable"]
] as const) {
  test(`translates ${failure} to the non-leaking local ${status} ${code}`, async ({
    request
  }) => {
    await setFailure(request, failure)
    const response = await request.get(presentationApi)
    await expectErrorCode(response, status, code)

    const requests = await authorDocumentRequests(request)
    if (["malformed-descriptor", "unsafe-source-path"].includes(failure)) {
      expect(requests.filter(entry => entry.kind === "content")).toEqual([])
    }
  })
}

for (const failure of [
  "descriptor-redirect-307",
  "descriptor-redirect-308",
  "content-redirect"
] as const) {
  test(`blocks ${failure} without contacting its redirect target`, async ({ request }) => {
    await setFailure(request, failure)
    const response = await request.get(presentationApi)
    await expectErrorCode(response, 502, "author_document_unavailable")
    expect(await redirectTargetRequests(request)).toEqual([])
  })
}

test("rejects unsupported kinds and unsafe author params without upstream content", async ({
  request
}) => {
  for (const path of [
    "/api/author-documents/S%C3%B6derbergH/omtexterna",
    "/api/author-documents/%252e%252e/presentation",
    "/api/author-documents/%20S%C3%B6derbergH/presentation",
    `/api/author-documents/${"A".repeat(101)}/presentation`
  ]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
  }
  expect((await authorDocumentRequests(request)).filter(entry => entry.kind === "content"))
    .toEqual([])
})

test("does not forward public query, cookies, or authorization to either private request", async ({
  request
}) => {
  const response = await request.get(
    `${presentationApi}?repeat=one&repeat=two&unknown=%2f`,
    { headers: { authorization: "Bearer public-probe", cookie: "probe=secret" } }
  )
  expect(response.status()).toBe(200)
  expect(await authorDocumentRequests(request)).toEqual([
    {
      kind: "descriptor",
      path: "/private-v2/authors/S%C3%B6derbergH/documents/presentation"
    },
    {
      kind: "content",
      path: "/red/forfattare/SoderbergH/presentation/index.html"
    }
  ])
})
