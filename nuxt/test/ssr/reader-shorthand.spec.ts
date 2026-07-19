import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const resolveBase = "/api/reader/resolve/S%C3%B6derbergH"
const resolvePath = `${resolveBase}/DoktorGlas/etext`
const shorthandBase = "/författare/SöderbergH/titlar"
const facsimileResolveBase = "/api/reader/resolve/Lagerl%C3%B6fS"
const facsimileShorthandBase = "/författare/Lagerl%C3%B6fS/titlar"

const readerStatuses = [
  ["DoktorGlas", 200],
  ["SiblingPagesReader", 200],
  ["MissingReader", 404],
  ["NoRequestedMediaReader", 404],
  ["WrongAuthorReader", 404],
  ["MissingStartReader", 404],
  ["MalformedStartReader", 502],
  ["OutOfListStartReader", 404],
  ["MalformedPagesReader", 502],
  ["NullPageIndexReader", 502],
  ["FalsePageIndexReader", 502],
  ["EmptyPageIndexReader", 502],
  ["StringPageIndexReader", 502],
  ["UnsafePageIndexReader", 502],
  ["MediaMismatchReader", 404],
  ["MalformedReader", 502],
  ["UnavailableReader", 502]
] as const
const legacyFallbackTitles = new Set([
  "MissingReader",
  "NoRequestedMediaReader",
  "WrongAuthorReader",
  "MediaMismatchReader"
])

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_metadata_delays`),
    request.delete(`${fixture}/_source_info_requests`),
    request.delete(`${fixture}/_source_info_failure`),
    request.delete(`${fixture}/_source_info_delays`),
    request.delete(`${fixture}/_source_info_static_requests`)
  ])
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

async function sourceInfoRequests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_source_info_requests`)).json()).requests
}

async function sourceInfoStaticRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_source_info_static_requests`)).json()).requests
}

async function navigateClient(page: Page, rawPath: string): Promise<void> {
  await page.evaluate(async path => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        push: (target: string) => Promise<void>
      } } } }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    await router.push(path)
  }, rawPath)
}

async function startClientNavigation(page: Page, rawPath: string): Promise<void> {
  await page.evaluate(path => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: {
        push: (target: string) => Promise<void>
      } } } }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    void router.push(path)
  }, rawPath)
}

function expectedMetadataRequest(titlePath: string) {
  return "/api/get_work_info?authorid=S%C3%B6derbergH" +
    `&exclude=content_vector&titlepath=${titlePath}`
}

function expectedLegacyMetadataRequest(titlePath: string) {
  return "/legacy-api/get_work_info?authorid=S%C3%B6derbergH" +
    `&exclude=content_vector&titlepath=${titlePath}`
}

test.beforeEach(async ({ request }) => resetReader(request))

test("resolves exact Reader metadata without fetching page HTML", async ({ request }) => {
  const response = await request.get(resolvePath)
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    authorId: "SöderbergH",
    titlePath: "DoktorGlas",
    mediaType: "etext",
    startPageName: "-2",
    canonicalPath: "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
  })
  expect(await readerRequests(request)).toEqual([
    expectedMetadataRequest("DoktorGlas")
  ])
})

for (const [titlePath, status] of readerStatuses) {
  test(`${titlePath} resolves with ${status}`, async ({ request }) => {
    const response = await request.get(`${resolveBase}/${titlePath}/etext`)
    expect(response.status()).toBe(status)
    const requests = await readerRequests(request)
    expect(requests).toEqual([
      expectedMetadataRequest(titlePath),
      ...(legacyFallbackTitles.has(titlePath)
        ? [expectedLegacyMetadataRequest(titlePath)]
        : [])
    ])
    expect(requests.some(path => path.includes("/txt/"))).toBe(false)
  })
}

test("uses uppercase RFC3986 escapes for every canonical Reader identity", async ({
  request
}) => {
  const response = await request.get(
    "/api/reader/resolve/O%27Neil%21%28%29%2AA/" +
    "Rfc%21Reader%27%28%29%2A/etext"
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    authorId: "O'Neil!()*A",
    titlePath: "Rfc!Reader'()*",
    mediaType: "etext",
    startPageName: "-2!'()*",
    canonicalPath:
      "/författare/O%27Neil%21%28%29%2AA/titlar/" +
      "Rfc%21Reader%27%28%29%2A/sida/-2%21%27%28%29%2A/etext"
  })
  expect((await readerRequests(request)).some(path => path.includes("/txt/"))).toBe(false)
})

test("resolves the exact faksimil representation without asset IO", async ({ request }) => {
  const response = await request.get(
    `${facsimileResolveBase}/GostaBerlingsSaga/faksimil`
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    authorId: "LagerlöfS",
    canonicalPath:
      "/författare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/sida/3/faksimil",
    mediaType: "faksimil",
    startPageName: "3",
    titlePath: "GostaBerlingsSaga"
  })
  expect(await readerRequests(request)).toEqual([
    "/api/get_work_info?authorid=Lagerl%C3%B6fS" +
      "&exclude=content_vector&titlepath=GostaBerlingsSaga"
  ])
})

test("resolver rejects unknown media before upstream IO", async ({ request }) => {
  const response = await request.get(`${resolveBase}/DoktorGlas/pdf`)
  expect(response.status()).toBe(404)
  expect(await readerRequests(request)).toEqual([])
})

test("does not forward public query parameters upstream", async ({ request }) => {
  const response = await request.get(
    `${resolvePath}?om-boken&repeat=first&repeat=second&unknown=bevara`
  )
  expect(response.status()).toBe(200)
  expect(await readerRequests(request)).toEqual([
    expectedMetadataRequest("DoktorGlas")
  ])
})

test("inherits valid sibling pages without fetching page HTML", async ({ request }) => {
  const response = await request.get(`${resolveBase}/SiblingPagesReader/etext`)
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    authorId: "SöderbergH",
    titlePath: "SiblingPagesReader",
    mediaType: "etext",
    startPageName: "-2",
    canonicalPath:
      "/författare/S%C3%B6derbergH/titlar/SiblingPagesReader/sida/-2/etext"
  })
  expect(await readerRequests(request)).toEqual([
    expectedMetadataRequest("SiblingPagesReader")
  ])
  expect((await readerRequests(request)).some(path => path.includes("/txt/"))).toBe(false)
})

test("canonical Reader rejects a wrong returned author", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/WrongAuthorReader/sida/-2/etext"
  )
  expect(response.status()).toBe(404)
  expect((await readerRequests(request)).some(path => path.includes("/res_"))).toBe(false)
})

test("canonical Reader accepts a valid page without start metadata", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/MissingStartReader/sida/-2/etext"
  )
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain("DOKTOR")
})

test("canonical Reader rejects present malformed start metadata", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/MalformedStartReader/sida/-2/etext"
  )
  expect(response.status()).toBe(502)
  expect((await readerRequests(request)).some(path => path.includes("/res_"))).toBe(false)
})

test("SSR preserves the raw shorthand query in a canonical redirect", async ({ request }) => {
  const response = await request.get(
    `${shorthandBase}/DoktorGlas/etext` +
    "?innehall&repeat=one&repeat=two&bare&empty=&plus=a+b&percent=a%20b" +
      "&slash=%2f&slash=%2F",
    { maxRedirects: 0 }
  )
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext" +
    "?innehall&repeat=one&repeat=two&bare&empty=&plus=a+b&percent=a%20b" +
      "&slash=%2f&slash=%2F"
  )
  expect((await readerRequests(request)).some(path => path.includes("/res_"))).toBe(false)
})

for (const [titlePath, resolverStatus] of readerStatuses) {
  const expectedStatus = resolverStatus === 200 ? 307 : resolverStatus
  test(`shorthand ${titlePath} responds with ${expectedStatus}`, async ({ request }) => {
    const response = await request.get(`${shorthandBase}/${titlePath}/etext`, {
      maxRedirects: 0
    })
    expect(response.status()).toBe(expectedStatus)
  })
}

test("faksimil shorthand preserves raw duplicate and unknown query values", async ({
  request
}) => {
  const response = await request.get(
    `${facsimileShorthandBase}/GostaBerlingsSaga/faksimil` +
      "?unknown=bevara%20mig&repeat=%2f&repeat=%2F&bare",
    { maxRedirects: 0 }
  )
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe(
    "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/sida/3/faksimil" +
      "?unknown=bevara%20mig&repeat=%2f&repeat=%2F&bare"
  )
  expect(await readerRequests(request)).toEqual([
    "/api/get_work_info?authorid=Lagerl%C3%B6fS" +
      "&exclude=content_vector&titlepath=GostaBerlingsSaga"
  ])
})

test("shorthand rejects unknown media before upstream IO", async ({ request }) => {
  const response = await request.get(`${shorthandBase}/DoktorGlas/pdf`, {
    maxRedirects: 0
  })
  expect(response.status()).toBe(404)
  expect(await readerRequests(request)).toEqual([])
})

test("source-information resolver selects the default readable representation", async ({
  request
}) => {
  const response = await request.get(`${resolveBase}/DoktorGlas`)
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    authorId: "SöderbergH",
    canonicalPath:
      "/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext",
    mediaType: "etext",
    startPageName: "-2",
    titlePath: "DoktorGlas"
  })
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/S%C3%B6derbergH/DoktorGlas/source-info",
    query: ""
  }])
  expect(await sourceInfoStaticRequests(request)).toEqual([])
})

test("source-information resolver selects requested media when available", async ({
  request
}) => {
  const response = await request.get(
    "/api/reader/resolve/Alml%C3%B6fN/Affarer?media_type=faksimil"
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    authorId: "AlmlöfN",
    canonicalPath:
      "/författare/Alml%C3%B6fN/titlar/Affarer/sida/-2/faksimil",
    mediaType: "faksimil",
    startPageName: "-2",
    titlePath: "Affarer"
  })
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/Alml%C3%B6fN/Affarer/source-info",
    query: "?media_type=faksimil"
  }])
})

test("source-information resolver accepts the backend requested-media fallback", async ({
  request
}) => {
  const response = await request.get(
    `${resolveBase}/DoktorGlas?media_type=faksimil`
  )
  expect(response.status()).toBe(200)
  expect((await response.json()).mediaType).toBe("etext")
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/S%C3%B6derbergH/DoktorGlas/source-info",
    query: "?media_type=faksimil"
  }])
})

for (const [alias, destination] of [
  [
    "/författare/SöderbergH/titlar/DoktorGlas",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext?om-boken"
  ],
  [
    "/författare/SöderbergH/titlar/DoktorGlas/info",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext?om-boken"
  ],
  [
    "/författare/AlmlöfN/titlar/Affarer/info/faksimil",
    "/f%C3%B6rfattare/Alml%C3%B6fN/titlar/Affarer/sida/-2/faksimil?om-boken"
  ]
] as const) {
  test(`${alias} replaces history with the canonical source-information Reader`, async ({
    request
  }) => {
    const response = await request.get(
      `${alias}?incoming=discard%20me&om-boken=&repeat=one&repeat=two#discarded`,
      { maxRedirects: 0 }
    )
    expect(response.status()).toBe(307)
    expect(response.headers().location).toBe(destination)
    expect(await sourceInfoRequests(request)).toHaveLength(1)
    expect(await sourceInfoStaticRequests(request)).toEqual([])
  })
}

test("a bare-title alias resolves once before the ordinary canonical Reader load", async ({
  request
}) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/DoktorGlas"
  )
  expect(response.status()).toBe(200)
  expect(response.url()).toContain(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext?om-boken"
  )
  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(await readerRequests(request)).toEqual([
    expectedMetadataRequest("DoktorGlas"),
    "/txt/lb-reader-doktor-glas/res_00002.html?username=app"
  ])
})

test("a late source-information alias cannot leave the route that replaced it", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_source_info_delays`, {
    data: { "SöderbergH|DoktorGlas": 350 }
  })
  await page.goto("/bibliotek", { waitUntil: "networkidle" })
  const resolverResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname.endsWith(
      "/api/reader/resolve/S%C3%B6derbergH/DoktorGlas"
    )
  )

  await startClientNavigation(
    page,
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas"
  )
  await expect.poll(async () => (await sourceInfoRequests(request)).length).toBe(1)
  await navigateClient(page, "/")

  expect((await resolverResponse).status()).toBe(200)
  await page.waitForTimeout(400)
  await expect(page).toHaveURL("/")
})

for (const [alias, expectedStatus] of [
  ["/författare/MissingA/titlar/MissingTitle", 404],
  ["/författare/ValidationA/titlar/ValidationTitle", 502],
  ["/författare/ServerErrorA/titlar/ServerErrorTitle/info", 502],
  ["/författare/MalformedA/titlar/MalformedTitle/info", 502],
  ["/författare/SparseA/titlar/SparseTitle/info", 404],
  ["/författare/SöderbergH/titlar/DoktorGlas/info/pdf", 404]
] as const) {
  test(`${alias} maps resolver failures to ${expectedStatus}`, async ({ request }) => {
    const response = await request.get(alias, { maxRedirects: 0 })
    expect(response.status()).toBe(expectedStatus)
  })
}

test("source-information aliases map upstream unavailability to the public 502", async ({
  request
}) => {
  await request.put(`${fixture}/_source_info_failure`)
  const response = await request.get(
    "/författare/SöderbergH/titlar/DoktorGlas/info",
    { maxRedirects: 0 }
  )
  expect(response.status()).toBe(502)
})
