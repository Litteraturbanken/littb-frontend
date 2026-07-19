import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

type ResolverRequest = {
  path: string
  body: {
    kind: "play" | "author"
    legacy_url: string
  }
}

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_legacy_dramawebben_route_requests`),
    request.delete(`${fixture}/_legacy_dramawebben_route_failure`),
    request.delete(`${fixture}/_legacy_dramawebben_redirect_target_requests`)
  ])
}

async function resolverRequests(request: APIRequestContext): Promise<ResolverRequest[]> {
  return (await (await request.get(
    `${fixture}/_legacy_dramawebben_route_requests`
  )).json()).requests
}

test.beforeEach(async ({ request }) => reset(request))

test("temporarily redirects a legacy play to its first canonical media URL", async ({
  request
}) => {
  const response = await request.get(
    "/dramawebben/pjas/fiskargossarne?discarded=yes&discarded=again",
    { maxRedirects: 0 }
  )

  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe(
    "/f%C3%B6rfattare/StrindbergA/titlar/Fiskargossarne/sida/1/etext"
  )
  expect(await resolverRequests(request)).toEqual([{
    path: "/private-v2/dramawebben/legacy-routes/resolve",
    body: { kind: "play", legacy_url: "fiskargossarne" }
  }])
})

test("temporarily redirects a legacy author to the canonical Dramawebben profile", async ({
  request
}) => {
  const response = await request.get("/dramawebben/forfattare/strindberg?discarded=yes", {
    maxRedirects: 0
  })

  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe(
    "/f%C3%B6rfattare/StrindbergA/dramawebben"
  )
  expect(await resolverRequests(request)).toEqual([{
    path: "/private-v2/dramawebben/legacy-routes/resolve",
    body: { kind: "author", legacy_url: "strindberg" }
  }])
})

for (const [legacyUrl, location] of [
  ["pdf-only", "/txt/lb9/lb9.pdf"],
  [
    "information-only",
    "/dramawebben/pj%C3%A4ser?om-boken&authorid=StrindbergA&titlepath=Info"
  ]
] as const) {
  test(`accepts the generated ${legacyUrl} media URL shape`, async ({ request }) => {
    const response = await request.get(`/dramawebben/pjas/${legacyUrl}`, {
      maxRedirects: 0
    })

    expect(response.status()).toBe(307)
    expect(response.headers().location).toBe(location)
  })
}

for (const [kind, path] of [
  ["play", "/dramawebben/pjas/missing"],
  ["author", "/dramawebben/forfattare/missing"]
] as const) {
  test(`redirects an unresolved legacy ${kind} to the plays fallback`, async ({ request }) => {
    const response = await request.get(`${path}?discarded=yes`, { maxRedirects: 0 })

    expect(response.status()).toBe(307)
    expect(response.headers().location).toBe("/dramawebben/pj%C3%A4ser/")
  })
}

test("handles HEAD but never resolves unsafe methods", async ({ request }) => {
  const head = await request.fetch("/dramawebben/pjas/fiskargossarne", {
    method: "HEAD",
    maxRedirects: 0
  })
  expect(head.status()).toBe(307)

  await reset(request)
  const post = await request.post("/dramawebben/pjas/fiskargossarne", {
    maxRedirects: 0
  })
  expect(post.status()).toBe(404)
  expect(await resolverRequests(request)).toEqual([])
})

for (const path of [
  "/dramawebben/pjas/a%2Fb",
  "/dramawebben/pjas/a%252Fb",
  "/dramawebben/pjas/a%5Cb",
  "/dramawebben/pjas/%252e%252e",
  "/dramawebben/pjas/%00",
  "/dramawebben/forfattare/%C2%85",
  `/dramawebben/pjas/${"x".repeat(201)}`,
  "/dramawebben/pjas/a/b",
  "/dramawebben/pjas/"
]) {
  test(`rejects unsafe or non-matching input without resolver IO: ${path.slice(0, 80)}`, async ({
    request
  }) => {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(404)
    expect(await resolverRequests(request)).toEqual([])
  })
}

for (const failure of [
  "malformed-200",
  "extra-key-200",
  "resolver-503"
] as const) {
  test(`maps ${failure} to a non-leaking 502`, async ({ request }) => {
    await request.put(`${fixture}/_legacy_dramawebben_route_failure`, {
      data: { failure }
    })

    const response = await request.get("/dramawebben/pjas/fiskargossarne", {
      headers: { accept: "application/json" },
      maxRedirects: 0
    })
    expect(response.status()).toBe(502)
    const payload = await response.json() as { data?: { code?: string } }
    expect(payload.data?.code).toBe("legacy_dramawebben_route_unavailable")
    expect(JSON.stringify(payload)).not.toMatch(/private-v2|127\.0\.0\.1:4100/iu)
  })
}

for (const failure of ["resolver-redirect-307", "resolver-redirect-308"] as const) {
  test(`blocks ${failure} without following or replaying the resolver POST`, async ({ request }) => {
    await request.put(`${fixture}/_legacy_dramawebben_route_failure`, {
      data: { failure }
    })

    const response = await request.get("/dramawebben/forfattare/strindberg", {
      maxRedirects: 0
    })
    expect(response.status()).toBe(502)
    expect((await (await request.get(
      `${fixture}/_legacy_dramawebben_redirect_target_requests`
    )).json()).requests).toEqual([])
  })
}
