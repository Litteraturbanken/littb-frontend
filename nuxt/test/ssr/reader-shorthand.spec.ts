import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { request as makeHttpRequest } from "node:http"
import { fixtureOrigin, nuxtTestOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin
const resolveBase = "/nuxt-api/reader/resolve/S%C3%B6derbergH"
const resolvePath = `${resolveBase}/DoktorGlas/etext`
const shorthandBase = "/författare/SöderbergH/titlar"
const facsimileResolveBase = "/nuxt-api/reader/resolve/Lagerl%C3%B6fS"
const facsimileShorthandBase = "/författare/Lagerl%C3%B6fS/titlar"

const readerStatuses = [
  ["DoktorGlas", 200],
  ["SiblingPagesReader", 200],
  ["MissingReader", 404],
  ["NoRequestedMediaReader", 404],
  ["WrongAuthorReader", 404],
  ["MissingStartReader", 404],
  ["MalformedStartReader", 502],
  ["OutOfListStartReader", 502],
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
async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_editor_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_manifest_delays`),
    request.delete(`${fixture}/_source_info_requests`),
    request.delete(`${fixture}/_source_info_failure`),
    request.delete(`${fixture}/_source_info_delays`),
    request.delete(`${fixture}/_source_info_static_requests`)
  ])
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

async function readerManifestRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_manifest_requests`)).json()).requests
}

async function fixtureRequests(request: APIRequestContext, ledger: string): Promise<string[]> {
  return (await (await request.get(`${fixture}/${ledger}`)).json()).requests
}

async function sourceInfoRequests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_source_info_requests`)).json()).requests
}

async function sourceInfoStaticRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_source_info_static_requests`)).json()).requests
}

async function rawStatus(path: string): Promise<number> {
  const base = new URL(process.env.PLAYWRIGHT_TEST_BASE_URL || nuxtTestOrigin)
  return await new Promise((resolve, reject) => {
    const request = makeHttpRequest({
      hostname: base.hostname,
      port: base.port,
      method: "GET",
      path
    }, response => {
      response.resume()
      response.once("end", () => resolve(response.statusCode ?? 0))
    })
    request.once("error", reject)
    request.end()
  })
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

function expectedManifestRequest(
  titlePath: string,
  mediaType = "etext",
  authorId = "S%C3%B6derbergH"
) {
  return `/v2/works/${authorId}/${titlePath}/manifest?media_type=${mediaType}`
}

test.beforeEach(async ({ request }) => resetReader(request))
test.afterEach(async ({ request }) => {
  expect(await fixtureRequests(request, "_reader_metadata_requests")).toEqual([])
  expect(await fixtureRequests(request, "_editor_manifest_requests")).toEqual([])
})

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
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("DoktorGlas")
  ])
  expect(await readerRequests(request)).toEqual([])
})

test("resolves a reordered contributor manifest through its declared primary author", async ({
  request
}) => {
  const response = await request.get(
    "/nuxt-api/reader/resolve/PrimaryP/ReorderedPrimary/etext"
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    authorId: "PrimaryP",
    titlePath: "ReorderedPrimary",
    mediaType: "etext",
    startPageName: "-2",
    canonicalPath:
      "/författare/PrimaryP/titlar/ReorderedPrimary/sida/-2/etext"
  })
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("ReorderedPrimary", "etext", "PrimaryP")
  ])
  expect(await readerRequests(request)).toEqual([])
})

for (const [titlePath, status] of readerStatuses) {
  test(`${titlePath} resolves with ${status}`, async ({ request }) => {
    const response = await request.get(`${resolveBase}/${titlePath}/etext`)
    expect(response.status()).toBe(status)
    expect(await readerManifestRequests(request)).toEqual([
      expectedManifestRequest(titlePath)
    ])
    expect(await readerRequests(request)).toEqual([])
  })
}

test("uses uppercase RFC3986 escapes for every canonical Reader identity", async ({
  request
}) => {
  const response = await request.get(
    "/nuxt-api/reader/resolve/O%27Neil%21%28%29%2AA/" +
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("Rfc%21Reader%27%28%29%2A", "etext", "O%27Neil%21%28%29%2AA")
  ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("GostaBerlingsSaga", "faksimil", "Lagerl%C3%B6fS")
  ])
  expect(await readerRequests(request)).toEqual([])
})

test("resolver rejects unknown media before upstream IO", async ({ request }) => {
  const response = await request.get(`${resolveBase}/DoktorGlas/pdf`)
  expect(response.status()).toBe(404)
  expect(await readerManifestRequests(request)).toEqual([])
  expect(await readerRequests(request)).toEqual([])
})

test("does not forward public query parameters upstream", async ({ request }) => {
  const response = await request.get(
    `${resolvePath}?om-boken&repeat=first&repeat=second&unknown=bevara`
  )
  expect(response.status()).toBe(200)
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("DoktorGlas")
  ])
  expect(await readerRequests(request)).toEqual([])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("SiblingPagesReader")
  ])
  expect((await readerRequests(request)).some(path => path.includes("/txt/"))).toBe(false)
})

test("canonical Reader rejects a wrong returned author", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/WrongAuthorReader/sida/-2/etext"
  )
  expect(response.status()).toBe(404)
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("WrongAuthorReader")
  ])
  expect((await readerRequests(request)).some(path => path.includes("/res_"))).toBe(false)
})

test("canonical Reader accepts a valid page without start metadata", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/MissingStartReader/sida/-2/etext"
  )
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain("DOKTOR")
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("MissingStartReader")
  ])
})

test("canonical Reader rejects present malformed start metadata", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/MalformedStartReader/sida/-2/etext"
  )
  expect(response.status()).toBe(502)
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("MalformedStartReader")
  ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("DoktorGlas")
  ])
  expect((await readerRequests(request)).some(path => path.includes("/res_"))).toBe(false)
})

for (const [titlePath, resolverStatus] of readerStatuses) {
  const expectedStatus = resolverStatus === 200 ? 307 : resolverStatus
  test(`shorthand ${titlePath} responds with ${expectedStatus}`, async ({ request }) => {
    const response = await request.get(`${shorthandBase}/${titlePath}/etext`, {
      maxRedirects: 0
    })
    expect(response.status()).toBe(expectedStatus)
    expect(await readerManifestRequests(request)).toEqual([
      expectedManifestRequest(titlePath)
    ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("GostaBerlingsSaga", "faksimil", "Lagerl%C3%B6fS")
  ])
  expect(await readerRequests(request)).toEqual([])
})

test("shorthand rejects unknown media before upstream IO", async ({ request }) => {
  const response = await request.get(`${shorthandBase}/DoktorGlas/pdf`, {
    maxRedirects: 0
  })
  expect(response.status()).toBe(404)
  expect(await readerManifestRequests(request)).toEqual([])
  expect(await readerRequests(request)).toEqual([])
})

test("shorthand rejects raw dot identities before resolver IO", async ({ request }) => {
  for (const path of [
    "/f%C3%B6rfattare/%2E/titlar/DoktorGlas/etext",
    `${shorthandBase}/%2E%2E/etext`
  ]) {
    expect([400, 404]).toContain(await rawStatus(path))
  }
  for (const path of [
    "/f%C3%B6rfattare/%252E/titlar/DoktorGlas/etext",
    `${shorthandBase}/%252E%252E/etext`
  ]) {
    expect([400, 404]).toContain(await rawStatus(path))
  }
  expect(await readerManifestRequests(request)).toEqual([])
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
  expect(await readerManifestRequests(request)).toEqual([])
  expect(await sourceInfoStaticRequests(request)).toEqual([])
})

test("source-information resolver selects requested media when available", async ({
  request
}) => {
  const response = await request.get(
    "/nuxt-api/reader/resolve/Alml%C3%B6fN/Affarer?media_type=faksimil"
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
  expect(await readerManifestRequests(request)).toEqual([])
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
  expect(await readerManifestRequests(request)).toEqual([])
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
    expect(await readerManifestRequests(request)).toEqual([])
    expect(await sourceInfoRequests(request)).toHaveLength(1)
    expect(await sourceInfoStaticRequests(request)).toEqual([])
  })
}

test("a bare-title alias and canonical Reader independently load source information", async ({
  request
}) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/DoktorGlas"
  )
  expect(response.status()).toBe(200)
  expect(response.url()).toContain(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext?om-boken"
  )
  // The 307 resolver and its canonical destination are separate stateless HTTP
  // requests; the destination owns the dialog payload it renders.
  expect(await sourceInfoRequests(request)).toHaveLength(2)
  expect(await readerRequests(request)).toEqual([
    "/txt/lb-reader-doktor-glas/res_00002.html?username=app",
    "/red/css/etext.css",
    "/txt/css/lb-reader-doktor-glas-etext.css"
  ])
  expect(await readerManifestRequests(request)).toEqual([
    expectedManifestRequest("DoktorGlas")
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
  await page.evaluate(() => {
    const scope = window as typeof window & { __sourceInfoAliasAbortSeen?: boolean }
    scope.__sourceInfoAliasAbortSeen = false
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const request = input instanceof Request ? input : null
      const url = request?.url ?? String(input)
      const signal = request?.signal ?? init?.signal
      if (url.includes("/nuxt-api/reader/resolve/S%C3%B6derbergH/DoktorGlas")) {
        signal?.addEventListener("abort", () => {
          scope.__sourceInfoAliasAbortSeen = true
        }, { once: true })
      }
      return originalFetch(input, init)
    }
  })
  const resolverRequestFailed = page.waitForEvent("requestfailed", browserRequest =>
    new URL(browserRequest.url()).pathname.endsWith(
      "/nuxt-api/reader/resolve/S%C3%B6derbergH/DoktorGlas"
    )
  )

  await startClientNavigation(
    page,
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas"
  )
  await expect.poll(async () => (await sourceInfoRequests(request)).length).toBe(1)
  await navigateClient(page, "/")

  expect((await resolverRequestFailed).failure()?.errorText).toMatch(/abort/iu)
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __sourceInfoAliasAbortSeen?: boolean }
  ).__sourceInfoAliasAbortSeen)).toBe(true)
  await page.waitForTimeout(400)
  await expect(page).toHaveURL("/")
  expect(await readerManifestRequests(request)).toEqual([])
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
    expect(await readerManifestRequests(request)).toEqual([])
  })
}

for (const alias of [
  "/författare/SöderbergH/titlar/DoktorGlas",
  "/författare/SöderbergH/titlar/DoktorGlas/info"
]) {
  test(`${alias} makes one resolver request when upstream is unavailable`, async ({ request }) => {
    await request.put(`${fixture}/_source_info_failure`)
    const response = await request.get(alias, { maxRedirects: 0 })
    expect(response.status()).toBe(502)
    expect(await sourceInfoRequests(request)).toEqual([{
      scope: "private",
      path: "/private-v2/works/S%C3%B6derbergH/DoktorGlas/source-info",
      query: ""
    }])
    expect(await readerManifestRequests(request)).toEqual([])
  })
}

test("client media source-information aliases resolve the latest same-record media type", async ({
  page,
  request
}) => {
  await request.put(`${fixture}/_source_info_delays`, {
    data: { "AlmlöfN|Affarer": 350 }
  })
  await page.goto("/bibliotek", { waitUntil: "networkidle" })

  await startClientNavigation(
    page,
    "/f%C3%B6rfattare/Alml%C3%B6fN/titlar/Affarer/info/etext"
  )
  await expect.poll(async () => (await sourceInfoRequests(request)).length).toBe(1)
  await navigateClient(
    page,
    "/f%C3%B6rfattare/Alml%C3%B6fN/titlar/Affarer/info/faksimil"
  )

  await expect(page).toHaveURL(
    "/författare/AlmlöfN/titlar/Affarer/sida/-2/faksimil?om-boken"
  )
  const requests = await sourceInfoRequests(request)
  expect(requests.filter(({ query }: { query: string }) => query === "?media_type=etext"))
    .toHaveLength(1)
  // The alias and the canonical destination both load their own source-info payload.
  expect(requests.filter(({ query }: { query: string }) => query === "?media_type=faksimil"))
    .toHaveLength(2)
})
