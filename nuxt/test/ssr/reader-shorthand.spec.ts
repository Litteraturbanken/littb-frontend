import { expect, test, type APIRequestContext } from "@playwright/test"

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

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_metadata_delays`)
  ])
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

function expectedMetadataRequest(titlePath: string) {
  return "/api/get_work_info?authorid=S%C3%B6derbergH" +
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
    expect(await readerRequests(request)).toEqual([
      expectedMetadataRequest(titlePath)
    ])
    if (titlePath.endsWith("PageIndexReader")) {
      expect((await readerRequests(request)).some(path => path.includes("/txt/"))).toBe(false)
    }
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
    "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F",
    { maxRedirects: 0 }
  )
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext" +
    "?bare&empty=&plus=a+b&percent=a%20b&repeat=%2f&repeat=%2F"
  )
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
