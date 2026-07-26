import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const readerPartsPath = "/författare/SöderbergH/titlar/DoktorGlasParts/sida/-1/etext"
const workScopedReaderPath = "/författare/SöderbergH/titlar/WorkScopedIdsReader/sida/-2/etext"
const facsimilePath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"
const dramaFacsimilePath = "/författare/AlmlöfN/titlar/Affarer/sida/-2/faksimil"
const longErrataPath = "/författare/LongErrataA/titlar/LongErrata/sida/-2/etext"
const facsimileImagePath = "/txt/lb-reader-gosta-berlings-saga/" +
  "lb-reader-gosta-berlings-saga_3/" +
  "lb-reader-gosta-berlings-saga_3_0009.jpeg"
const facsimileRetinaPath = "/txt/lb-reader-gosta-berlings-saga/" +
  "lb-reader-gosta-berlings-saga_5/" +
  "lb-reader-gosta-berlings-saga_5_0009.jpeg"
const facsimileLargePath = "/txt/lb-reader-gosta-berlings-saga/" +
  "lb-reader-gosta-berlings-saga_4/" +
  "lb-reader-gosta-berlings-saga_4_0009.jpeg"

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`),
    request.delete(`${fixture}/_reader_ocr_requests`),
    request.delete(`${fixture}/_reader_jpeg_requests`),
    request.delete(`${fixture}/_reader_hit_requests`),
    request.delete(`${fixture}/_reader_hit_failure`),
    request.delete(`${fixture}/_reader_hit_delays`),
    request.delete(`${fixture}/_source_info_requests`),
    request.delete(`${fixture}/_source_info_static_requests`),
    request.delete(`${fixture}/_source_info_failure`),
    request.delete(`${fixture}/_source_info_delays`),
    request.delete(`${fixture}/_source_info_static_failure`),
    request.delete(`${fixture}/_author_resolve_requests`),
    request.delete(`${fixture}/_author_resolve_failure`),
    request.delete(`${fixture}/_author_resolve_scenario`)
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

async function authorResolveRequests(request: APIRequestContext): Promise<Array<{
  path: string
  body: unknown
}>> {
  return (await (await request.get(`${fixture}/_author_resolve_requests`)).json()).requests
}

async function sourceInfoRequests(request: APIRequestContext): Promise<Array<{
  scope: "private" | "public"
  path: string
  query: string
}>> {
  return (await (await request.get(`${fixture}/_source_info_requests`)).json()).requests
}

async function sourceInfoStaticRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_source_info_static_requests`)).json()).requests
}

function expectSourceInfoStaticCacheLedger(requests: string[]): void {
  expect([
    [],
    [
      "/red/etc/provenance/provenance.json",
      "/red/etc/license/license.json"
    ]
  ]).toContainEqual(requests)
}

async function setAuthorResolveScenario(request: APIRequestContext, scenario: string) {
  await request.put(`${fixture}/_author_resolve_scenario`, { data: { scenario } })
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
  expect(html).toContain('href="/f%C3%B6rfattare/S%C3%B6derbergH"')
  expect(html).toContain('href="/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext"')
  expect(html).toContain('href="/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext"')
  expect(html).not.toContain("Hämtar sida")
  const sourceHref =
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext?om-boken"
  expect(html.split(`href="${sourceHref}"`)).toHaveLength(3)
  expect(html).toContain(`href="${sourceHref}">Doktor Glas</a>`)
  expect(html).toContain(`href="${sourceHref}">Mer om boken</a>`)
  expect(html).toContain('class="reader-context-ssr"')
  expect(html).not.toContain('class="reader-context-ssr sr-only"')
  expect(html).toContain("Sök i verket")
  expect(html).toContain('class="reader-work-search-trigger"')

  const recorded = await readerRequests(request)
  expect(recorded.filter(path => path.startsWith("/api/get_work_info?"))).toHaveLength(1)
  expect(recorded.filter(path => path.startsWith(
    "/txt/lb-reader-doktor-glas/res_00002.html?"
  ))).toHaveLength(1)
  expect(await readerHitRequests(request)).toEqual([])
  expect(await sourceInfoRequests(request)).toEqual([])
  expect(await sourceInfoStaticRequests(request)).toEqual([])
})

test("canonical Reader API projects exact work searchability", async ({ request }) => {
  const searchable = await request.get(
    "/api/reader/S%C3%B6derbergH/DoktorGlas/-2/etext"
  )
  expect(searchable.status()).toBe(200)
  expect((await searchable.json()).searchable).toBe(true)

  const inert = await request.get(
    "/api/reader/S%C3%B6derbergH/UnsearchableEtextReader/-2/etext"
  )
  expect(inert.status()).toBe(200)
  expect((await inert.json()).searchable).toBe(false)
})

test("legacy main-author contribution is present in the Reader SSR fallback", async ({
  request
}) => {
  const response = await request.get(longErrataPath)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain(
    'class="reader-context-ssr" aria-label="Läsinformation och sidnavigering"'
  )
  expect(html).toContain(
    'href="/f%C3%B6rfattare/LongErrataA">Rita Redaktör <span class="authortype">red.</span></a>'
  )
})

test("direct bare source-information SSR renders the Reader and complete modal once", async ({
  request
}) => {
  const response = await request.get(`${readerPath}?om-boken`)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("DOKTOR")
  expect(html).toContain('class="modal about fade in"')
  expect(html).toContain("Doktor Glas. Roman")
  expect(html).toContain("Hjalmar Söderberg")
  expect(html).toContain("Albert Bonniers förlag, Stockholm 1905")
  expect(html).toContain("Läs som")
  expect(html).toContain("Ladda ner")
  expect(html).toContain("Verket i")
  expect(html).toContain("Libris")
  expect(html).toContain("Hänvisa till detta verk")
  expect(html).toContain("Göteborgs universitetsbibliotek")
  expect(html).toContain("För e-boken gäller licensen CC0")
  expect(html).toContain("följande ändringar gjorts mot originalet")
  expect(html).not.toContain("Ett fel har uppstått.")
  expect(html).toMatch(/<body[^>]*class="focus page-reading ready modal-open"/u)
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/S%C3%B6derbergH/DoktorGlas/source-info",
    query: "?media_type=etext"
  }])
  expectSourceInfoStaticCacheLedger(await sourceInfoStaticRequests(request))
})

test("exact empty source-information assignment remains closed and makes no request", async ({
  request
}) => {
  const response = await request.get(`${readerPath}?om-boken=`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).not.toContain('class="modal about fade in"')
  expect(html).not.toContain("Ett fel har uppstått.")
  expect(await sourceInfoRequests(request)).toEqual([])
  expect(await sourceInfoStaticRequests(request)).toEqual([])
})

test("source-information failure stays modal-local on a successful Reader SSR", async ({
  request
}) => {
  await request.put(`${fixture}/_source_info_failure`)
  const response = await request.get(`${readerPath}?om-boken`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("DOKTOR")
  expect(html).toContain('class="modal about fade in"')
  expect(html).toContain("Ett fel har uppstått.")
  expect(await sourceInfoRequests(request)).toHaveLength(1)
})

test("the Nitro source-information boundary rejects a non-public canonical author", async ({
  request
}) => {
  const response = await request.get(
    "/api/reader/source-info/CanonicalNotPublicA/DoktorGlas?media_type=etext"
  )

  expect(response.status()).toBe(502)
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/CanonicalNotPublicA/DoktorGlas/source-info",
    query: "?media_type=etext"
  }])
  expect(await sourceInfoStaticRequests(request)).toEqual([])
})

test("source information has presentation priority when both dialog keys are direct", async ({
  request
}) => {
  const response = await request.get(`${readerPath}?innehall&om-boken`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain('class="modal about fade in"')
  expect(html).not.toContain('class="modal chapters fade in"')
  expect(await sourceInfoRequests(request)).toHaveLength(1)
})

test("drama Reader projects closed copy and complete source-information facts", async ({
  request
}) => {
  const closed = await request.get(dramaFacsimilePath)
  expect(closed.status()).toBe(200)
  const closedHtml = await closed.text()
  expect(closedHtml).toContain("Mer om pjäsen")
  expect(await sourceInfoRequests(request)).toEqual([])

  const opened = await request.get(`${dramaFacsimilePath}?om-boken`)
  expect(opened.status()).toBe(200)
  const html = await opened.text()
  expect(html).toContain('class="modal about fade in"')
  expect(html).toContain("Affärer")
  expect(html).toContain("Antal akter")
  expect(html).toContain("Direktören")
  expect(html).toContain("Teaterkritik")
  const { document } = parseHTML(html)
  const sidebarLogo = document.querySelector(".reader-context-ssr .dw_logo")
  expect(sidebarLogo?.getAttribute("alt")).toBe("Dramawebben logotyp")
  expect(sidebarLogo?.parentElement?.getAttribute("href")).toBe("/dramawebben")
  expect(document.querySelector(".modal.about .dw_logo")).toBeNull()
  expect(document.querySelector("h3.introheader")).toBeNull()
  const roleSections = [...document.querySelectorAll(".dramaweb > div")]
  const roleSection = roleSections.find(section => (
    section.querySelector("h3")?.textContent?.trim() === "Rollista"
  ))
  const roles = roleSection?.querySelector("div")
  expect(roles?.innerHTML).toBe(
    '<i>Direktören</i>, grosshandlare<br><span class="role">Anna</span>, hans dotter'
  )
  expect([...roles?.children ?? []].map(child => child.tagName)).toEqual([
    "I",
    "BR",
    "SPAN"
  ])
  expect(await sourceInfoRequests(request)).toHaveLength(1)
})

test("partful SSR exposes one raw-preserving contents trigger without a dialog tree", async ({
  request
}) => {
  const response = await request.get(`${readerPartsPath}?repeat=one&repeat=two`)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain(
    "href=\"/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-1/etext" +
    "?repeat=one&amp;repeat=two&amp;innehall\""
  )
  expect(html.match(/>Innehållsförteckning<\/a>/gu)).toHaveLength(1)
  expect(html.match(/reader-context-ssr/gu)).toHaveLength(1)
  expect(html).not.toContain('role="dialog"')

  const partless = await request.get(
    "/författare/SöderbergH/titlar/PartlessReader/sida/-2/etext?repeat=one&repeat=two"
  )
  expect(partless.status()).toBe(200)
  expect(await partless.text()).not.toContain(">Innehållsförteckning</a>")
})

test("canonical API returns the exact searchable faksimil arm with selectable OCR", async ({
  request
}) => {
  const response = await request.get(
    "/api/reader/Lagerl%C3%B6fS/GostaBerlingsSaga/3/faksimil"
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    alternateMedia: null,
    author: {
      authorType: null,
      id: "LagerlöfS",
      name: "Selma Lagerlöf",
      role: null
    },
    description: "Gösta Berlings saga av Selma Lagerlöf, sida 3 som faksimil.",
    editorWorkId: null,
    fullTitle: "Gösta Berlings saga. Roman",
    hasDramawebben: false,
    hasNyaVagar: false,
    currentPartIndex: 0,
    endPageName: "5",
    imageNumber: 9,
    imprintYear: "1891",
    isDrama: false,
    mediaType: "faksimil",
    nextPageName: "5",
    nextPartPageName: null,
    ocrOverlay: {
      height: 900,
      html: '<div data-size="625x900"><span id="w1_147" class="w">OCR fixture</span></div>',
      width: 625
    },
    pageCount: 3,
    pageIndex: 1,
    pageMap: [
      { pageIndex: 0, pageName: "1" },
      { pageIndex: 1, pageName: "3" },
      { pageIndex: 2, pageName: "5" }
    ],
    pageName: "3",
    pageNames: ["1", "3", "5"],
    parts: [{
      authors: [{ id: "LagerlöfS", name: "Selma Lagerlöf", surname: "Lagerlöf" }],
      endPageIndex: 2,
      endPageName: "5",
      navTitle: "Gösta Berlings saga",
      shortTitle: "Gösta Berlings saga",
      sourceIndex: 0,
      startPageIndex: 0,
      startPageName: "1",
      title: "Gösta Berlings saga",
      titleId: "GostaBerlingsSaga"
    }],
    preferredSize: 3,
    previousPageName: "1",
    previousPartPageName: "1",
    searchable: true,
    sliderMaximum: null,
    sliderPercent: 0,
    sources: [
      {
        size: 2,
        url: "/txt/lb-reader-gosta-berlings-saga/" +
          "lb-reader-gosta-berlings-saga_2/" +
          "lb-reader-gosta-berlings-saga_2_0009.jpeg",
        width: 450
      },
      {
        size: 3,
        url: "/txt/lb-reader-gosta-berlings-saga/" +
          "lb-reader-gosta-berlings-saga_3/" +
          "lb-reader-gosta-berlings-saga_3_0009.jpeg",
        width: 625
      },
      {
        size: 4,
        url: "/txt/lb-reader-gosta-berlings-saga/" +
          "lb-reader-gosta-berlings-saga_4/" +
          "lb-reader-gosta-berlings-saga_4_0009.jpeg",
        width: 900
      },
      {
        size: 5,
        url: "/txt/lb-reader-gosta-berlings-saga/" +
          "lb-reader-gosta-berlings-saga_5/" +
          "lb-reader-gosta-berlings-saga_5_0009.jpeg",
        width: 1250
      }
    ],
    startPageName: "3",
    title: "Gösta Berlings saga",
    urn: null,
    workId: "lb-reader-gosta-berlings-saga"
  })
  expect(await separateReaderRequests(request)).toEqual({
    metadata: [
      "/api/get_work_info?authorid=Lagerl%C3%B6fS" +
        "&exclude=content_vector&titlepath=GostaBerlingsSaga"
    ],
    html: [],
    ocr: ["/txt/lb-reader-gosta-berlings-saga/ocr_00001.html"],
    jpeg: []
  })
  expect(await readerHitRequests(request)).toEqual([])
  expect(await authorResolveRequests(request)).toEqual([])
})

test("real faksimil search hit falls back to backend metadata when the asset source omits it", async ({
  request
}) => {
  const continuation =
    "?q=kyrka&hit=0&traff=w58_123&traffslut=w58_123" +
    "&s_query=kyrka&s_lbworkid=lb3203777&s_mediatype=faksimil" +
    "&s_word_form_only=true&s_include_modernized=true&hit_index=0" +
    "&s_from=0&s_to=29&s_page=1&s_page_size=30"
  const response = await request.get(
    `/f%C3%B6rfattare/AarnsethF/titlar/Rallarliv/sida/58/faksimil${continuation}`
  )

  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("<title>Rallarliv sida 58 faksimil | Litteraturbanken</title>")
  expect(html).toContain("Rallarliv av Fredrik Aarnseth, sida 58 som faksimil.")
  expect(html).toContain(
    'src="/txt/lb3203777/lb3203777_3/lb3203777_3_0058.jpeg"'
  )
  expect(html).toMatch(
    /id="w58_123"[^>]*class="[^"]*\bmarkee\b|class="[^"]*\bmarkee\b[^"]*"[^>]*id="w58_123"/
  )
  expect(await separateReaderRequests(request)).toEqual({
    metadata: [
      "/api/get_work_info?authorid=AarnsethF&exclude=content_vector&titlepath=Rallarliv",
      "/legacy-api/get_work_info?authorid=AarnsethF" +
        "&exclude=content_vector&titlepath=Rallarliv"
    ],
    html: [],
    ocr: ["/txt/lb3203777/ocr_00057.html"],
    jpeg: []
  })
  expect(await readerHitRequests(request)).toEqual([])
})

test("canonical API projects source-ordered nested Reader navigation and resolves missing authors once", async ({
  request
}) => {
  const response = await request.get(
    "/api/reader/S%C3%B6derbergH/DoktorGlasParts/-1/etext"
  )
  expect(response.status()).toBe(200)
  const body = await response.json()

  expect(body).toMatchObject({
    currentPartIndex: 2,
    endPageName: "5",
    nextPartPageName: "3",
    pageIndex: 4,
    pageMap: [
      { pageIndex: 1, pageName: "-4" },
      { pageIndex: 2, pageName: "-3" },
      { pageIndex: 3, pageName: "-2" },
      { pageIndex: 4, pageName: "-1" },
      { pageIndex: 5, pageName: "1" },
      { pageIndex: 6, pageName: "2" },
      { pageIndex: 7, pageName: "3" },
      { pageIndex: 8, pageName: "4" },
      { pageIndex: 9, pageName: "5" }
    ],
    pageName: "-1",
    pageNames: ["-4", "-3", "-2", "-1", "1", "2", "3", "4", "5"],
    previousPartPageName: "-2",
    startPageName: "-3"
  })
  expect(body.parts).toEqual([
    expect.objectContaining({
      authors: [{ id: "SöderbergH", name: "Hjalmar Söderberg", surname: "Söderberg" }],
      sourceIndex: 0,
      startPageName: "-4",
      endPageName: "1"
    }),
    expect.objectContaining({
      authors: [{ id: "MörikeE", name: "Eduard Mörike", surname: "Mörike" }],
      sourceIndex: 1
    }),
    expect.objectContaining({
      authors: [
        { id: "RilkeRM", name: "Rainer Maria Rilke", surname: "Rilke" },
        { id: "ShelleyPB", name: "Percy Bysshe Shelley", surname: "Shelley" }
      ],
      sourceIndex: 2
    }),
    expect.objectContaining({ sourceIndex: 3 }),
    expect.objectContaining({ sourceIndex: 4 })
  ])
  expect(await authorResolveRequests(request)).toEqual([{
    path: "/private-v2/authors/resolve",
    body: { author_ids: ["MörikeE", "RilkeRM", "ShelleyPB"] }
  }])
  expect(await separateReaderRequests(request)).toEqual({
    metadata: [
      "/api/get_work_info?authorid=S%C3%B6derbergH" +
        "&exclude=content_vector&titlepath=DoktorGlasParts"
    ],
    html: ["/txt/lb-reader-doktor-glas-parts/res_00004.html?username=app"],
    ocr: [],
    jpeg: []
  })
})

test("navigation projection keeps a page gap empty and chooses the first same-start source", async ({
  request
}) => {
  const gap = await request.get("/api/reader/S%C3%B6derbergH/DoktorGlasParts/2/etext")
  expect(gap.status()).toBe(200)
  expect(await gap.json()).toMatchObject({
    currentPartIndex: null,
    previousPartPageName: "-2",
    nextPartPageName: "3"
  })

  await resetReader(request)
  const tie = await request.get("/api/reader/S%C3%B6derbergH/DoktorGlasParts/3/etext")
  expect(tie.status()).toBe(200)
  expect(await tie.json()).toMatchObject({
    currentPartIndex: 3,
    previousPartPageName: "-2",
    nextPartPageName: null
  })
})

test("partless metadata publishes empty navigation without calling the author resolver", async ({
  request
}) => {
  const response = await request.get(
    "/api/reader/S%C3%B6derbergH/PartlessReader/-2/etext"
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({
    currentPartIndex: null,
    nextPartPageName: null,
    parts: [],
    previousPartPageName: null
  })
  expect(await authorResolveRequests(request)).toEqual([])
})

for (const title of [
  "MalformedPartsReader",
  "UnknownPartPageReader",
  "ReversedPartReader"
] as const) {
  test(`${title} fails before resolver and page asset IO`, async ({ request }) => {
    const response = await request.get(
      `/api/reader/S%C3%B6derbergH/${title}/-1/etext`
    )
    expect(response.status()).toBe(502)
    expect(await authorResolveRequests(request)).toEqual([])
    const ledgers = await separateReaderRequests(request)
    expect(ledgers.html).toEqual([])
    expect(ledgers.ocr).toEqual([])
    expect(ledgers.jpeg).toEqual([])
  })
}

for (const scenario of [
  "primitive",
  "wrong-container",
  "non-array-items",
  "oversized-items",
  "extra-top-key",
  "malformed-item",
  "extra-item-key",
  "duplicate",
  "unrequested",
  "empty-id",
  "whitespace-id",
  "control-id",
  "overlong-id",
  "empty-name",
  "whitespace-name",
  "control-name",
  "overlong-name",
  "wrong-surname",
  "empty-surname",
  "whitespace-surname",
  "control-surname",
  "overlong-surname",
  "disconnect"
] as const) {
  test(`rejects malformed author resolver scenario ${scenario} before page IO`, async ({
    request
  }) => {
    await setAuthorResolveScenario(request, scenario)
    const response = await request.get(
      "/api/reader/S%C3%B6derbergH/DoktorGlasParts/-1/etext"
    )
    expect(response.status()).toBe(502)
    expect((await authorResolveRequests(request))).toHaveLength(1)
    expect((await separateReaderRequests(request)).html).toEqual([])
  })
}

test("contains an author resolver non-200 before page IO", async ({ request }) => {
  await request.put(`${fixture}/_author_resolve_failure`)
  const response = await request.get(
    "/api/reader/S%C3%B6derbergH/DoktorGlasParts/-1/etext"
  )
  expect(response.status()).toBe(502)
  expect((await authorResolveRequests(request))).toHaveLength(1)
  expect((await separateReaderRequests(request)).html).toEqual([])
})

for (const [title, expectedCalls] of [
  ["ReaderTooManyAuthors", 0],
  ["ReaderUnsafePartAuthor", 0]
] as const) {
  test(`${title} is rejected before resolver and page IO`, async ({ request }) => {
    const response = await request.get(`/api/reader/S%C3%B6derbergH/${title}/-4/etext`)
    expect(response.status()).toBe(502)
    expect(await authorResolveRequests(request)).toHaveLength(expectedCalls)
    expect((await separateReaderRequests(request)).html).toEqual([])
  })
}

for (const [title, expectedAuthor] of [
  [
    "ReaderAuthorOmission",
    { id: "MissingSummaryAuthor", name: "MissingSummaryAuthor", surname: "MissingSummaryAuthor" }
  ],
  [
    "ReaderAuthorNullSurname",
    { id: "NullSurnameAuthor", name: "Förnamn Efternamn", surname: "Förnamn Efternamn" }
  ]
] as const) {
  test(`${title} completes deterministic author fallbacks`, async ({ request }) => {
    const response = await request.get(`/api/reader/S%C3%B6derbergH/${title}/-1/etext`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.parts[0].authors).toEqual([expectedAuthor])
    expect(await authorResolveRequests(request)).toHaveLength(1)
    expect((await separateReaderRequests(request)).html).toHaveLength(1)
  })
}

for (const title of [
  "ReaderLocalWhitespaceName",
  "ReaderLocalControlName",
  "ReaderLocalWhitespaceSurname",
  "ReaderLocalControlSurname"
] as const) {
  test(`${title} resolves instead of trusting malformed local author text`, async ({
    request
  }) => {
    const response = await request.get(`/api/reader/S%C3%B6derbergH/${title}/-1/etext`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.parts[0].authors).toEqual([{
      id: "MörikeE",
      name: "Eduard Mörike",
      surname: "Mörike"
    }])
    expect(await authorResolveRequests(request)).toEqual([{
      path: "/private-v2/authors/resolve",
      body: { author_ids: ["MörikeE"] }
    }])
    expect((await separateReaderRequests(request)).html).toHaveLength(1)
  })
}

for (const title of [
  "ReaderMatchingWhitespaceAuthorId",
  "ReaderMatchingControlAuthorId"
] as const) {
  test(`${title} rejects an unsafe locally matched author before resolver and page IO`, async ({
    request
  }) => {
    const response = await request.get(`/api/reader/S%C3%B6derbergH/${title}/-1/etext`)
    expect(response.status()).toBe(502)
    expect(await authorResolveRequests(request)).toEqual([])
    expect((await separateReaderRequests(request)).html).toEqual([])
  })
}

test("the exact faksimil page renders its fixed scan without e-text output", async ({
  request
}) => {
  const response = await request.get(facsimilePath)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain(
    "<title>Gösta Berlings saga sida 3 faksimil | Litteraturbanken</title>"
  )
  expect(html).toContain(
    "Gösta Berlings saga av Selma Lagerlöf, sida 3 som faksimil."
  )
  expect(html).toContain("type-faksimil")
  expect(html).toMatch(/class="img_area"[^>]*style="[^"]*width:\s*625px/)
  expect(html).toMatch(/<img[^>]*class="faksimil"/)
  expect(html).toContain(`src="${facsimileImagePath}"`)
  expect(html).toContain(
    `srcset="${facsimileImagePath} 1x, ${facsimileRetinaPath} 2x"`
  )
  expect(html).toMatch(/<img[^>]*class="faksimil"[^>]*width="625"/)
  expect(html).toContain(
    'alt="Gösta Berlings saga av Selma Lagerlöf, sida 3"'
  )
  expect(html).toContain(
    'href="/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/sida/1/faksimil"'
  )
  expect(html).toContain(
    'href="/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/GostaBerlingsSaga/sida/5/faksimil"'
  )
  expect(html).not.toContain('class="etext')
  expect(html).not.toContain('href="/red/css/etext.css"')
  expect(html).not.toContain("-etext.css")
  expect(await readerHitRequests(request)).toEqual([])
})

test("faksimil preserves search-shaped and invalid size queries without e-text hits", async ({
  request
}) => {
  const response = await request.get(
    `${facsimilePath}?q=doktor&hit=1&s_from=w1&s_to=w2&storlek=1` +
    "&return=first&return=second&unknown=bevara%20mig"
  )
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain(`src="${facsimileImagePath}"`)
  for (const pageName of ["1", "5"]) {
    expect(html).toContain(
      `/sida/${pageName}/faksimil?q=doktor&amp;hit=1&amp;s_from=w1&amp;s_to=w2` +
      "&amp;storlek=1&amp;return=first&amp;return=second&amp;unknown=bevara%20mig"
    )
  }
  expect(html).not.toContain("reader-search-state")
  expect(html).not.toContain("search_nav")
  expect(html).not.toContain("markee")
  expect(await readerHitRequests(request)).toEqual([])
})

test("an advertised direct faksimil size is server-rendered without a density pair", async ({
  request
}) => {
  const response = await request.get(`${facsimilePath}?storlek=4`)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toMatch(/class="img_area"[^>]*style="[^"]*width:\s*900px/)
  expect(html).toContain(`src="${facsimileLargePath}"`)
  expect(html).toMatch(/<img[^>]*class="faksimil"[^>]*width="900"/)
  expect(html).not.toMatch(/<img[^>]*class="faksimil"[^>]*srcset=/)
  expect(html).toContain("/sida/1/faksimil?storlek=4")
  expect(html).toContain("/sida/5/faksimil?storlek=4")
})

test("canonical faksimil selects the requested alternate representation", async ({ request }) => {
  const response = await request.get(
    "/api/reader/S%C3%B6derbergH/DoktorGlas/-2/faksimil"
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({
    alternateMedia: { mediaType: "etext", pageName: "-2" },
    imageNumber: 2,
    mediaType: "faksimil",
    pageIndex: 2,
    pageName: "-2",
    workId: "lb-reader-doktor-glas"
  })
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
    "href=\"/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext" +
    "?q=doktor%20glas&amp;hit=1&amp;unknown=bevara%20mig\""
  )
  expect(html).toContain(
    "href=\"/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext" +
    "?q=doktor%20glas&amp;hit=1&amp;unknown=bevara%20mig\""
  )
  expect(html).toContain(
    "href=\"/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext" +
    "?q=doktor+glas&amp;hit=0&amp;unknown=bevara+mig\""
  )
  expect(html).toContain(
    "href=\"/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext" +
    "?q=doktor+glas&amp;hit=2&amp;unknown=bevara+mig\""
  )
})

test("work-scoped word ids are bound to the Reader work and mark the exact live range", async ({
  request
}) => {
  const response = await request.get(`${workScopedReaderPath}?q=kyrka&hit=0`)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(await readerHitRequests(request)).toEqual([{
    path: "/private-v2/works/lb7604979/search-hits",
    query: "media_type=etext&query=kyrka&offset=0&limit=3" +
      "&word_forms=false&include_older_spellings=true&prefix=false&suffix=false"
  }])
  expect(html).toMatch(/id="lb7604979_8654"[^>]*class="[^"]*\bmarkee\b|class="[^"]*\bmarkee\b[^"]*"[^>]*id="lb7604979_8654"/)
  expect(html).toMatch(/id="lb7604979_8658"[^>]*class="[^"]*\bmarkee\b|class="[^"]*\bmarkee\b[^"]*"[^>]*id="lb7604979_8658"/)
  expect(html).toContain("Sökträff 1 av 2")
  expect(html).toContain(
    "href=\"/f%C3%B6rfattare/S%C3%B6derbergH/titlar/WorkScopedIdsReader/sida/-1/etext" +
    "?q=kyrka&amp;hit=1\""
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
    "/sida/-3/etext?q=doktor%20glas&amp;hit=1&amp;return=first&amp;return=second",
    "/sida/-1/etext?q=doktor%20glas&amp;hit=1&amp;return=first&amp;return=second",
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

test("page-mismatch preserves the original Reader HTML without a marker", async ({
  request
}) => {
  const response = await request.get(`${readerPath}?q=page-mismatch&hit=0`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("DOKTOR")
  expect(html).toContain("Sökträff 1 av 1")
  expect(html).not.toContain("markee")
})

test("a leading-zero w page identity is rejected as malformed hit data", async ({
  request
}) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/-3/etext" +
    "?q=leading-zero-page&hit=0"
  )
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("FÖREGÅENDE")
  expect(html).toContain("Sökträffen kunde inte hämtas.")
  expect(html).not.toContain("markee")
})

for (const query of [
  "cross-work-id",
  "malformed-work-id",
  "descending-work-range",
  "mixed-work-range"
]) {
  test(`${query} is rejected as malformed work-scoped hit data`, async ({ request }) => {
    const response = await request.get(`${workScopedReaderPath}?q=${query}&hit=0`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("DEN")
    expect(html).toContain("Sökträffen kunde inte hämtas.")
    expect(html).not.toContain("markee")
  })
}

for (const query of ["reversed-range"]) {
  test(`${query} preserves the original Reader HTML without a marker`, async ({ request }) => {
    const response = await request.get(`${readerPath}?q=${query}&hit=0`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("DOKTOR")
    expect(html).toContain("Sökträffen kunde inte hämtas.")
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
