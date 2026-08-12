import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"

type ResolverRequest = {
  path: string
  body: {
    normalized_author_id: string
    normalized_title_id: string | null
    media_type: "etext" | "faksimil" | null
  }
}

async function resetLegacyRoutes(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_legacy_author_route_requests`),
    request.delete(`${fixture}/_legacy_author_route_failure`),
    request.delete(`${fixture}/_author_document_redirect_target_requests`)
  ])
}

async function redirectTargetRequests(request: APIRequestContext): Promise<unknown[]> {
  return (await (await request.get(
    `${fixture}/_author_document_redirect_target_requests`
  )).json()).requests
}

async function resolverRequests(request: APIRequestContext): Promise<ResolverRequest[]> {
  return (await (await request.get(`${fixture}/_legacy_author_route_requests`)).json()).requests
}

test.beforeEach(async ({ request }) => resetLegacyRoutes(request))

test("canonicalizes a normalized profile with one private author-only resolution", async ({
  request
}) => {
  const response = await request.get("/forfattare/LagerlofS", { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe("/f%C3%B6rfattare/Lagerl%C3%B6fS")
  expect(await resolverRequests(request)).toEqual([{
    path: "/private-v2/legacy-author-routes/resolve",
    body: {
      normalized_author_id: "LagerlofS",
      normalized_title_id: null,
      media_type: null
    }
  }])
})

test("normalizes an accented legacy profile before private resolution", async ({
  request
}) => {
  const response = await request.get("/forfattare/Lagerl%C3%B6fS", {
    maxRedirects: 0
  })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe("/f%C3%B6rfattare/Lagerl%C3%B6fS")
  expect(await resolverRequests(request)).toEqual([{
    path: "/private-v2/legacy-author-routes/resolve",
    body: {
      normalized_author_id: "LagerlofS",
      normalized_title_id: null,
      media_type: null
    }
  }])
})

test("canonicalizes both Reader identities and preserves the raw query byte-for-byte", async ({
  request
}) => {
  const query = "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  const response = await request.get(
    `/forfattare/SoderbergH/titlar/Forvillelser/sida/3/etext${query}`,
    { maxRedirects: 0 }
  )
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/F%C3%B6rvillelser/sida/3/etext" + query
  )
  expect(await resolverRequests(request)).toEqual([{
    path: "/private-v2/legacy-author-routes/resolve",
    body: {
      normalized_author_id: "SoderbergH",
      normalized_title_id: "Forvillelser",
      media_type: "etext"
    }
  }])
})

test("uses author-only resolution for safe unsupported suffixes", async ({ request }) => {
  const response = await request.get(
    "/forfattare/SoderbergH/titlar/Forvillelser/sida/3/audio",
    { maxRedirects: 0 }
  )
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/Forvillelser/sida/3/audio"
  )
  expect((await resolverRequests(request))[0]?.body).toEqual({
    normalized_author_id: "SoderbergH",
    normalized_title_id: null,
    media_type: null
  })
})

test("preserves a non-Reader fourth segment above the Reader title cap", async ({ request }) => {
  const suffix = "T".repeat(201)
  const response = await request.get(`/forfattare/SoderbergH/mer/${suffix}`, {
    maxRedirects: 0
  })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe(`/f%C3%B6rfattare/S%C3%B6derbergH/mer/${suffix}`)
  expect((await resolverRequests(request))[0]?.body).toEqual({
    normalized_author_id: "SoderbergH",
    normalized_title_id: null,
    media_type: null
  })
})

test("canonicalizes the Almqvist semer suffix and preserves its raw query", async ({
  request
}) => {
  const response = await request.get("/forfattare/AlmqvistCJL/semer?x=1", {
    maxRedirects: 0
  })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe("/f%C3%B6rfattare/AlmqvistCJL/semer?x=1")
  expect(await resolverRequests(request)).toEqual([{
    path: "/private-v2/legacy-author-routes/resolve",
    body: {
      normalized_author_id: "AlmqvistCJL",
      normalized_title_id: null,
      media_type: null
    }
  }])
})

for (const [length, reachesResolver] of [
  [100, true],
  [101, false]
] as const) {
  test(`enforces local author boundary ${length} -> resolver ${reachesResolver}`, async ({
    request
  }) => {
    const response = await request.get(`/forfattare/${"A".repeat(length)}`, {
      maxRedirects: 0
    })
    expect(response.status()).toBe(404)
    expect((await resolverRequests(request)).length > 0).toBe(reachesResolver)
  })
}

for (const [length, reachesResolver] of [
  [100, true],
  [101, true],
  [200, true],
  [201, false]
] as const) {
  test(`enforces local title boundary ${length} -> resolver ${reachesResolver}`, async ({
    request
  }) => {
    const response = await request.get(
      `/forfattare/SoderbergH/titlar/${"T".repeat(length)}/sida/1/etext`,
      { maxRedirects: 0 }
    )
    expect(response.status()).toBe(404)
    expect((await resolverRequests(request)).length > 0).toBe(reachesResolver)
  })
}

test("rejects an encoded fixed Reader segment with a 201-character title locally", async ({
  request
}) => {
  const response = await request.get(
    `/forfattare/SoderbergH/%74itlar/${"T".repeat(201)}/sida/1/etext`,
    { maxRedirects: 0 }
  )
  expect(response.status()).toBe(404)
  expect(await resolverRequests(request)).toEqual([])
})

for (const [label, path] of [
  ["raw author", `/forfattare/${"A".repeat(901)}`],
  ["nested encoded author", `/forfattare/${"%2525252541".repeat(82)}`],
  [
    "nested encoded Reader title",
    `/forfattare/A/titlar/${"%2525252554".repeat(164)}/sida/1/etext`
  ]
] as const) {
  test(`rejects an oversized ${label} before resolver IO`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(404)
    expect(await resolverRequests(request)).toEqual([])
  })
}

test("accepts a direct UTF-8 author encoding at the raw ceiling", async ({ request }) => {
  const response = await request.get(`/forfattare/${encodeURIComponent("文".repeat(100))}`, {
    maxRedirects: 0
  })
  expect(response.status()).toBe(404)
  expect(await resolverRequests(request)).toHaveLength(1)
})

for (const [label, identity] of [
  ["fullwidth slash", "A／B"],
  ["fullwidth backslash", "A＼B"],
  ["fullwidth percent", "A％B"],
  ["fullwidth dot", "．"],
  ["fullwidth dotdot", "．．"],
  ["combining marks only", "\u0301\u0308"],
  ["ligature expansion", "ﬃ".repeat(34)]
] as const) {
  test(`rejects normalized ${label} before resolver IO`, async ({ request }) => {
    const path = `/forfattare/${encodeURIComponent(identity)}`
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(404)
    expect(await resolverRequests(request)).toEqual([])
  })
}

test("rejects an unsafe normalized identity locally for HEAD too", async ({ request }) => {
  const response = await request.fetch(`/forfattare/${encodeURIComponent("A／B")}`, {
    method: "HEAD",
    maxRedirects: 0
  })
  expect(response.status()).toBe(404)
  expect(await resolverRequests(request)).toEqual([])
})

for (const path of [
  "/forfattare/SoderbergH%2Fprivate",
  "/forfattare/SoderbergH%252Fprivate",
  "/forfattare/SoderbergH%5Cprivate",
  "/forfattare/%252e%252e",
  "/forfattare/%ZZ",
  "/forfattare/%00",
  "/forfattare/%C2%85"
]) {
  test(`rejects unsafe input locally without resolver IO ${path}`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(404)
    expect(await resolverRequests(request)).toEqual([])
  })
}

test("handles GET and HEAD only and never loops canonical routes", async ({ request }) => {
  const head = await request.fetch("/forfattare/LagerlofS", {
    method: "HEAD",
    maxRedirects: 0
  })
  expect(head.status()).toBe(307)
  expect(head.headers().location).toBe("/f%C3%B6rfattare/Lagerl%C3%B6fS")

  await resetLegacyRoutes(request)
  const post = await request.post("/forfattare/LagerlofS", { maxRedirects: 0 })
  expect(post.status()).toBe(404)
  expect(await resolverRequests(request)).toEqual([])

  const canonical = await request.get("/f%C3%B6rfattare/Lagerl%C3%B6fS", {
    maxRedirects: 0
  })
  expect(canonical.status()).toBe(200)
  expect(canonical.headers().location).toBeUndefined()
  expect(await resolverRequests(request)).toEqual([])
})

test("maps an unresolved normalized identity to a non-leaking local 404", async ({
  request
}) => {
  const response = await request.get("/forfattare/Missing", {
    headers: { accept: "application/json" },
    maxRedirects: 0
  })
  expect(response.status()).toBe(404)
  const payload = await response.json() as { data?: { code?: string } }
  expect(payload.data?.code).toBe("legacy_author_route_not_found")
  expect(JSON.stringify(payload)).not.toContain("private-v2")
})

for (const [failure, status] of [
  ["malformed-200", 502],
  ["extra-key-200", 502],
  ["resolver-503", 502]
] as const) {
  test(`maps resolver ${failure} to a non-leaking local ${status}`, async ({ request }) => {
    const configured = await request.put(`${fixture}/_legacy_author_route_failure`, {
      data: { failure }
    })
    expect(configured.status()).toBe(200)

    const response = await request.get("/forfattare/LagerlofS", {
      headers: { accept: "application/json" },
      maxRedirects: 0
    })
    expect(response.status()).toBe(status)
    const payload = await response.json() as { data?: { code?: string } }
    expect(payload.data?.code).toBe("legacy_author_route_unavailable")
    expect(JSON.stringify(payload)).not.toMatch(/private-v2|127\.0\.0\.1:4100/iu)
  })
}

for (const failure of ["resolver-redirect-307", "resolver-redirect-308"] as const) {
  test(`blocks ${failure} without replaying the resolver POST`, async ({ request }) => {
    const configured = await request.put(`${fixture}/_legacy_author_route_failure`, {
      data: { failure }
    })
    expect(configured.status()).toBe(200)

    const response = await request.get("/forfattare/LagerlofS", {
      headers: { accept: "application/json" },
      maxRedirects: 0
    })
    expect(response.status()).toBe(502)
    const payload = await response.json() as { data?: { code?: string } }
    expect(payload.data?.code).toBe("legacy_author_route_unavailable")
    expect(await redirectTargetRequests(request)).toEqual([])
  })
}

test("the profile redirect reaches rendered canonical profile content", async ({ request }) => {
  const response = await request.get("/forfattare/LagerlofS")
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain("Selma Lagerlöf")
})

test("the Reader redirect reaches rendered canonical Reader content", async ({ request }) => {
  const response = await request.get(
    "/forfattare/SoderbergH/titlar/Forvillelser/sida/3/etext"
  )
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("FÖRVILLELSER")
  expect(html).toContain("KANONISK SIDA TRE")
})
