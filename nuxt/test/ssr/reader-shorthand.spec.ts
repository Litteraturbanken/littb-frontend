import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const resolveBase = "/api/reader/resolve/S%C3%B6derbergH"
const resolvePath = `${resolveBase}/DoktorGlas/etext`

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

for (const [titlePath, status] of [
  ["DoktorGlas", 200],
  ["SiblingPagesReader", 200],
  ["MissingReader", 404],
  ["NoRequestedMediaReader", 404],
  ["WrongAuthorReader", 404],
  ["MissingStartReader", 404],
  ["MalformedStartReader", 502],
  ["OutOfListStartReader", 404],
  ["MalformedPagesReader", 502],
  ["MediaMismatchReader", 404],
  ["MalformedReader", 502],
  ["UnavailableReader", 502]
] as const) {
  test(`${titlePath} resolves with ${status}`, async ({ request }) => {
    const response = await request.get(`${resolveBase}/${titlePath}/etext`)
    expect(response.status()).toBe(status)
    expect(await readerRequests(request)).toEqual([
      expectedMetadataRequest(titlePath)
    ])
  })
}

test("rejects unsupported faksimil without upstream IO", async ({ request }) => {
  const response = await request.get(`${resolveBase}/DoktorGlas/faksimil`)
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
