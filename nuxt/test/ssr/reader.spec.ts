import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = "http://127.0.0.1:4100"
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`),
    request.delete(`${fixture}/_reader_ocr_requests`),
    request.delete(`${fixture}/_reader_jpeg_requests`),
    request.delete(`${fixture}/_reader_hit_requests`),
    request.delete(`${fixture}/_reader_hit_failure`),
    request.delete(`${fixture}/_reader_hit_delays`)
  ])
}

async function separateReaderRequests(request: APIRequestContext) {
  const ledgers = await Promise.all([
    "metadata",
    "html",
    "ocr",
    "jpeg"
  ].map(async kind => (
    await (await request.get(`${fixture}/_reader_${kind}_requests`)).json()
  ).requests as string[]))
  return {
    metadata: ledgers[0]!,
    html: ledgers[1]!,
    ocr: ledgers[2]!,
    jpeg: ledgers[3]!
  }
}

async function readerRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_requests`)).json()).requests
}

async function readerHitRequests(request: APIRequestContext): Promise<Array<{
  path: string
  query: string
}>> {
  return (await (await request.get(`${fixture}/_reader_hit_requests`)).json()).requests
}

test.beforeEach(async ({ request }) => resetReader(request))

test("the exact Doktor Glas page is complete in the SSR response", async ({ request }) => {
  const response = await request.get(readerPath)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("<title>Doktor Glas sida -2 etext | Litteraturbanken</title>")
  expect(html).toContain("Doktor Glas av Hjalmar Söderberg, sida -2 som etext.")
  expect(html).toMatch(/<body[^>]*class="focus page-reading ready"/)
  expect(html).toContain('href="/red/css/etext.css"')
  expect(html).toContain('href="/txt/css/lb-reader-doktor-glas-etext.css"')
  expect(html).toContain("DOKTOR")
  expect(html).toContain("GLAS")
  expect(html).toContain("HJALMAR SÖDERBERG")
  expect(html).toContain("-2 av 3")
  expect(html).toContain('href="/författare/S%C3%B6derbergH"')
  expect(html).toContain('href="/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext"')
  expect(html).toContain('href="/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"')
  expect(html).not.toContain("Hämtar sida")

  const recorded = await readerRequests(request)
  expect(recorded.filter(path => path.startsWith("/api/get_work_info?"))).toHaveLength(1)
  expect(recorded.filter(path => path.startsWith(
    "/txt/lb-reader-doktor-glas/res_00002.html?"
  ))).toHaveLength(1)
  expect(await readerHitRequests(request)).toEqual([])
})

test("canonical API returns the exact faksimil image arm without fetching assets", async ({
  request
}) => {
  const response = await request.get(
    "/api/reader/Lagerl%C3%B6fS/GostaBerlingsSaga/3/faksimil"
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    author: { id: "LagerlöfS", name: "Selma Lagerlöf" },
    description: "Gösta Berlings saga av Selma Lagerlöf, sida 3 som faksimil.",
    fullTitle: "Gösta Berlings saga. Roman",
    imageNumber: 9,
    imprintYear: "1891",
    mediaType: "faksimil",
    nextPageName: "5",
    pageCount: 3,
    pageIndex: 1,
    pageName: "3",
    preferredSize: 3,
    previousPageName: "1",
    sources: [
      {
        size: 1,
        url: "/txt/lb-reader-gosta-berlings-saga/" +
          "lb-reader-gosta-berlings-saga_1/" +
          "lb-reader-gosta-berlings-saga_1_0009.jpeg",
        width: 320
      },
      {
        size: 3,
        url: "/txt/lb-reader-gosta-berlings-saga/" +
          "lb-reader-gosta-berlings-saga_3/" +
          "lb-reader-gosta-berlings-saga_3_0009.jpeg",
        width: 640
      },
      {
        size: 5,
        url: "/txt/lb-reader-gosta-berlings-saga/" +
          "lb-reader-gosta-berlings-saga_5/" +
          "lb-reader-gosta-berlings-saga_5_0009.jpeg",
        width: 1280
      }
    ],
    title: "Gösta Berlings saga",
    workId: "lb-reader-gosta-berlings-saga"
  })
  expect(await separateReaderRequests(request)).toEqual({
    metadata: [
      "/api/get_work_info?authorid=Lagerl%C3%B6fS" +
        "&exclude=content_vector&titlepath=GostaBerlingsSaga"
    ],
    html: [],
    ocr: [],
    jpeg: []
  })
  expect(await readerHitRequests(request)).toEqual([])
})

test("canonical faksimil requires an exact representation", async ({ request }) => {
  const response = await request.get(
    "/api/reader/S%C3%B6derbergH/DoktorGlas/-2/faksimil"
  )
  expect(response.status()).toBe(404)
  expect(await separateReaderRequests(request)).toEqual({
    metadata: [
      "/api/get_work_info?authorid=S%C3%B6derbergH" +
        "&exclude=content_vector&titlepath=DoktorGlas"
    ],
    html: [],
    ocr: [],
    jpeg: []
  })
})

test("canonical unknown media fails before reader IO", async ({ request }) => {
  const response = await request.get(
    "/api/reader/Lagerl%C3%B6fS/GostaBerlingsSaga/3/pdf"
  )
  expect(response.status()).toBe(404)
  expect(await separateReaderRequests(request)).toEqual({
    metadata: [], html: [], ocr: [], jpeg: []
  })
})

test("canonical missing faksimil page fails before asset IO", async ({ request }) => {
  const response = await request.get(
    "/api/reader/Lagerl%C3%B6fS/GostaBerlingsSaga/missing/faksimil"
  )
  expect(response.status()).toBe(404)
  const recorded = await separateReaderRequests(request)
  expect(recorded.metadata).toHaveLength(1)
  expect({ html: recorded.html, ocr: recorded.ocr, jpeg: recorded.jpeg }).toEqual({
    html: [], ocr: [], jpeg: []
  })
})

for (const titlePath of [
  "MalformedFacsimileImageReader",
  "MalformedFacsimileSizesReader",
  "MalformedFacsimileWidthReader"
]) {
  test(`${titlePath} is a 502 without asset IO`, async ({ request }) => {
    const response = await request.get(
      `/api/reader/Lagerl%C3%B6fS/${titlePath}/3/faksimil`
    )
    expect(response.status()).toBe(502)
    const recorded = await separateReaderRequests(request)
    expect(recorded.metadata).toHaveLength(1)
    expect({ html: recorded.html, ocr: recorded.ocr, jpeg: recorded.jpeg }).toEqual({
      html: [], ocr: [], jpeg: []
    })
  })
}

test("canonical search state fetches one private hit window and marks its exact range", async ({
  request
}) => {
  const response = await request.get(
    `${readerPath}?q=doktor%20glas&hit=1&unknown=bevara%20mig`
  )
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(await readerHitRequests(request)).toEqual([{
    path: "/private-v2/works/lb-reader-doktor-glas/search-hits",
    query: "media_type=etext&query=doktor%20glas&offset=0&limit=3" +
      "&word_forms=false&include_older_spellings=true&prefix=false&suffix=false"
  }])
  expect(html).toMatch(/<span[^>]*class="[^"]*\bmarkee\b[^"]*"[^>]*id="w2_1"|<span[^>]*id="w2_1"[^>]*class="[^"]*\bmarkee\b/)
  expect(html).toMatch(/<span[^>]*class="[^"]*\bmarkee\b[^"]*\bflip\b[^"]*"[^>]*id="w2_2"|<span[^>]*id="w2_2"[^>]*class="[^"]*\bmarkee\b[^"]*\bflip\b/)
  expect(html).toContain("Sökträff 2 av 5")
  expect(html).toContain(
    "href=\"/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext" +
    "?q=doktor+glas&amp;hit=1&amp;unknown=bevara+mig\""
  )
  expect(html).toContain(
    "href=\"/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext" +
    "?q=doktor+glas&amp;hit=1&amp;unknown=bevara+mig\""
  )
  expect(html).toContain(
    "href=\"/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext" +
    "?q=doktor+glas&amp;hit=0&amp;unknown=bevara+mig\""
  )
  expect(html).toContain(
    "href=\"/författare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext" +
    "?q=doktor+glas&amp;hit=2&amp;unknown=bevara+mig\""
  )
})

test("canonical flags map exactly to the generated hit request", async ({ request }) => {
  const response = await request.get(
    `${readerPath}?q=glas&hit=0&lemma=1&ej_modern=1&prefix=1&suffix=1`
  )
  expect(response.status()).toBe(200)
  expect(await readerHitRequests(request)).toEqual([{
    path: "/private-v2/works/lb-reader-doktor-glas/search-hits",
    query: "media_type=etext&query=glas&offset=0&limit=3" +
      "&word_forms=true&include_older_spellings=false&prefix=true&suffix=true"
  }])
})

test("repeated unknown query values survive page and hit links only", async ({ request }) => {
  const response = await request.get(
    `${readerPath}?q=doktor%20glas&hit=1&return=first&return=second`
  )
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(await readerHitRequests(request)).toHaveLength(1)
  expect((await readerHitRequests(request))[0]?.query).not.toContain("return")
  for (const target of [
    "/sida/-3/etext?q=doktor+glas&amp;hit=1&amp;return=first&amp;return=second",
    "/sida/-1/etext?q=doktor+glas&amp;hit=1&amp;return=first&amp;return=second",
    "/sida/-3/etext?q=doktor+glas&amp;hit=0&amp;return=first&amp;return=second",
    "/sida/-2/etext?q=doktor+glas&amp;hit=2&amp;return=first&amp;return=second"
  ]) {
    expect(html).toContain(target)
  }
})

for (const invalidQuery of [
  "?q=doktor",
  "?hit=1",
  "?q=doktor&hit=01",
  "?q=doktor&hit=1000002",
  "?q=doktor&hit=1&lemma=true",
  "?q=doktor&hit=1&ej_modern=0",
  "?q=doktor&q=glas&hit=1",
  "?q=doktor&hit=1&hit=2",
  `?q=${"x".repeat(201)}&hit=1`
]) {
  test(`invalid search state ${invalidQuery.slice(0, 45)} stays an ordinary Reader`, async ({
    request
  }) => {
    const response = await request.get(`${readerPath}${invalidQuery}`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("DOKTOR")
    expect(html).not.toContain("Sökträff ")
    expect(html).not.toContain("markee")
    expect(await readerHitRequests(request)).toEqual([])
  })
}

test("an out-of-range cursor keeps readable content with a bounded message", async ({
  request
}) => {
  const response = await request.get(`${readerPath}?q=doktor&hit=99`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("DOKTOR")
  expect(html).toContain("Ingen sådan sökträff.")
  expect(html).not.toContain("markee")
  expect((await readerHitRequests(request))[0]?.query).toContain("offset=98&limit=3")
})

test("a failed hit enhancement keeps the valid Reader page", async ({ request }) => {
  await request.put(`${fixture}/_reader_hit_failure`)
  const response = await request.get(`${readerPath}?q=doktor&hit=1`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("DOKTOR")
  expect(html).toContain("Sökträffen kunde inte hämtas.")
  expect(html).not.toContain("markee")
  expect(await readerHitRequests(request)).toHaveLength(1)
})

test("a malformed hit response is contained locally", async ({ request }) => {
  const response = await request.get(`${readerPath}?q=malformed-response&hit=0`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("DOKTOR")
  expect(html).toContain("Sökträffen kunde inte hämtas.")
  expect(html).not.toContain("markee")
})

for (const query of ["page-mismatch", "reversed-range"]) {
  test(`${query} preserves the original Reader HTML without a marker`, async ({ request }) => {
    const response = await request.get(`${readerPath}?q=${query}&hit=0`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("DOKTOR")
    expect(html).toContain("Sökträff 1 av 1")
    expect(html).not.toContain("markee")
  })
}

test("an unsafe missing range is rejected as malformed enhancement data", async ({ request }) => {
  const response = await request.get(`${readerPath}?q=missing-range&hit=0`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("DOKTOR")
  expect(html).toContain("Sökträffen kunde inte hämtas.")
  expect(html).not.toContain("markee")
})

for (const query of ["safe-missing-range", "duplicate-range"]) {
  test(`${query} keeps valid search state and original unmarked HTML`, async ({ request }) => {
    const response = await request.get(`${readerPath}?q=${query}&hit=0`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("DOKTOR")
    expect(html).toContain("GLAS")
    expect(html).toContain("Sökträff 1 av 1")
    expect(html).not.toContain("Sökträffen kunde inte hämtas.")
    expect(html).not.toContain("markee")
  })
}

test("the maximum valid cursor never links to an unrequestable next hit", async ({ request }) => {
  const response = await request.get(`${readerPath}?q=max-edge&hit=1000001`)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect((await readerHitRequests(request))[0]?.query).toContain(
    "query=max-edge&offset=1000000&limit=3"
  )
  expect(html).toContain("Sökträff 1000002 av 1000003")
  expect(html).toContain(
    "/sida/-2/etext?q=max-edge&amp;hit=1000000"
  )
  expect(html).not.toContain(
    "/sida/-2/etext?q=max-edge&amp;hit=1000002"
  )
})

test("an unknown page is a real 404", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/missing/etext"
  )
  expect(response.status()).toBe(404)
  expect(await response.text()).not.toContain("DOKTOR GLAS")
  const recorded = await readerRequests(request)
  expect(recorded.filter(path => path.startsWith("/api/get_work_info?"))).toHaveLength(1)
  expect(recorded.filter(path => path.includes("/res_"))).toHaveLength(0)
})
