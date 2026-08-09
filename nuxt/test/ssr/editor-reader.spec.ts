import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

async function resetEditorRequests(request: APIRequestContext): Promise<void> {
  await Promise.all([
    request.delete(`${fixture}/_editor_manifest_requests`),
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_requests`)
  ])
}

async function requestLedger(
  request: APIRequestContext,
  path: string
): Promise<string[]> {
  const response = await request.get(`${fixture}${path}`)
  return (await response.json() as { requests: string[] }).requests
}

test.beforeEach(async ({ request }) => resetEditorRequests(request))
test.afterEach(async ({ request }) => {
  expect(await requestLedger(request, "/_reader_manifest_requests")).toEqual([])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])
  expect((await requestLedger(request, "/_reader_requests")).some(path => (
    path.includes("get_work_info") || path.includes("count_pages")
  ))).toBe(false)
})

for (const [partition, path] of [
  ["path", "/v2/works/%20/editor-manifest?media_type=faksimil"],
  ["query", "/v2/works/lb-editor-fallback/editor-manifest?media_type=pdf"]
] as const) {
  test(`the Editor fixture ledgers one invalid ${partition} request before its 422 response`, async ({
    request
  }) => {
    const response = await request.get(`${fixture}${path}`)

    expect(response.status()).toBe(422)
    expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([path])
  })
}

test("SSR renders editor metadata, OCR, and generated page bounds", async ({ request }) => {
  const apiResponse = await request.get("/api/editor/lb-editor-doktor/1/f")
  expect(apiResponse.status()).toBe(200)
  expect(apiResponse.headers()["cache-control"]).toBe("no-store")
  expect(await apiResponse.json()).toMatchObject({
    endPageName: "-1",
    imprintYear: "1905",
    metadataAvailable: true,
    pageName: null
  })
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-doktor/editor-manifest?media_type=faksimil"
  ])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])
  expect((await requestLedger(request, "/_reader_requests")).some(path => (
    path.includes("get_work_info") || path.includes("count_pages")
  ))).toBe(false)

  await resetEditorRequests(request)

  const response = await request.get("/editor/lb-editor-doktor/ix/1/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("src")).toBe(
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )
  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("srcset")).toBe(
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg 1x, "
    + "/txt/lb-editor-doktor/lb-editor-doktor_5/lb-editor-doktor_5_0002.jpeg 2x"
  )
  expect(document.querySelector(".editor-reader .img_area")?.getAttribute("style"))
    .toContain("width:625px")
  const overlay = document.querySelector(".editor-reader .overlay")
  expect(overlay?.localName).toBe("div")
  expect(overlay?.innerHTML).toBe(
    '<div data-size="2500x3600"><span class="w">OCR</span></div>'
  )
  expect(overlay?.getAttribute("style"))
    .toContain("scale(0.25)")
  expect(document.querySelector('input[aria-label="Gå till sida"]')?.getAttribute("max"))
    .toBe("2")
  expect(document.querySelector(".reader-context-ssr .editor-imprint-year")?.textContent)
    .toBe(" (1905)")
  expect(document.querySelector(".reader-context-ssr .pages")?.textContent)
    .toBe("av -1")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-doktor/editor-manifest?media_type=faksimil"
  ])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])

  expect((await request.get("/editor/lb-editor-doktor/ix/3/f")).status()).toBe(404)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-doktor/editor-manifest?media_type=faksimil"
  ))
})

test("SSR renders typed bounds-only navigation without metadata controls", async ({
  request
}) => {
  const apiResponse = await request.get("/api/editor/lb-editor-fallback/1/f")
  expect(apiResponse.status()).toBe(200)
  expect(apiResponse.headers()["cache-control"]).toBe("no-store")
  expect(await apiResponse.json()).toMatchObject({
    endPageName: null,
    imprintYear: null,
    metadataAvailable: false,
    pageCount: 3,
    pageIndexes: null,
    pageName: null
  })
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-fallback/editor-manifest?media_type=faksimil"
  ])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])

  await resetEditorRequests(request)

  const response = await request.get("/editor/lb-editor-fallback/ix/1/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("src")).toBe(
    "/txt/lb-editor-fallback/lb-editor-fallback_3/lb-editor-fallback_3_0002.jpeg"
  )
  expect(document.querySelector('input[aria-label="Gå till sida"]')?.getAttribute("max"))
    .toBe("2")
  expect(document.querySelector(".editor-reader .overlay")?.textContent).toContain(
    "SAFE OCR"
  )
  expect(document.querySelector(".editor-reader script")).toBeNull()
  expect(document.querySelector(".editor-reader [onclick]")).toBeNull()
  expect(document.querySelector(".editor-reader .overlay #mainview")?.textContent)
    .toContain("SAFE OCR")
  expect(document.querySelector(".editor-reader .overlay .absolute")).toBeNull()
  expect(document.querySelector(".editor-reader .overlay .pointer-events-auto")).toBeNull()
  expect(document.querySelector(".editor-reader .overlay > [data-size]")?.getAttribute("style"))
    .not.toContain("999999999999")
  expect(document.querySelector(".reader-context-ssr .editor-metadata-controls")).toBeNull()
  expect(document.querySelector('.reader-context-ssr a[rel="next"]')).not.toBeNull()
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-fallback/editor-manifest?media_type=faksimil"
  ])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])

  expect((await request.get("/editor/lb-editor-fallback/ix/3/f")).status()).toBe(404)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-fallback/editor-manifest?media_type=faksimil"
  ))
})

test("SSR keeps the facsimile useful when optional OCR is unavailable", async ({
  request
}) => {
  const response = await request.get("/editor/lb-editor-no-ocr/ix/1/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")).not.toBeNull()
  expect(document.querySelector(".editor-reader .overlay")).toBeNull()
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-no-ocr/editor-manifest?media_type=faksimil"
  ])
})

test("SSR reports an unavailable editor when both metadata and page count fail", async ({
  request
}) => {
  expect((await request.get("/editor/lb-editor-unavailable/ix/1/f")).status()).toBe(502)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-unavailable/editor-manifest?media_type=faksimil"
  ])
})

test("SSR sanitizes bounded editor e-text before it enters the DTO", async ({ request }) => {
  const response = await request.get("/api/editor/lb-editor-doktor-glas/1/e")
  expect(response.status()).toBe(200)
  const body = await response.json()

  expect(body.html).toContain("EDITORSSIDA 1")
  expect(body.html).toContain('<em class="emphasis">bevarad</em>')
  expect(body.html).not.toMatch(/script|onclick|javascript:/iu)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-doktor-glas/editor-manifest?media_type=etext"
  ])
})

test("SSR fails clearly when the selected editor facsimile asset is missing", async ({
  request
}) => {
  expect((await request.get("/api/editor/lb-editor-missing-image/1/f")).status()).toBe(502)
  expect((await request.get("/editor/lb-editor-missing-image/ix/1/f")).status()).toBe(502)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-missing-image/editor-manifest?media_type=faksimil"
  ))
})

test("SSR uses generated dense bounds for the exact e-text representation", async ({ request }) => {
  const apiResponse = await request.get("/api/editor/lb-editor-doktor-glas/2/e")
  expect(apiResponse.status()).toBe(200)
  expect(await apiResponse.json()).toMatchObject({
    metadataAvailable: true,
    pageCount: 3,
    pageIndex: 2
  })

  const response = await request.get("/editor/lb-editor-doktor-glas/ix/2/e")
  expect(response.status()).toBe(200)
  expect((await response.text())).toContain("EDITORSSIDA 2")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-doktor-glas/editor-manifest?media_type=etext"
  ))
})

test("SSR derives sparse typed Editor bounds from the largest page index", async ({ request }) => {
  const response = await request.get("/api/editor/lb-editor-sparse/12/f")

  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({
    pageCount: 58,
    pageIndex: 12,
    pageIndexes: [2, 12, 57],
    nextIndex: 57,
    previousIndex: 2
  })
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-sparse/editor-manifest?media_type=faksimil"
  ])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])

  expect((await request.get("/api/editor/lb-editor-sparse/13/f")).status()).toBe(404)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-sparse/editor-manifest?media_type=faksimil"
  ))
})

test("SSR selects the requested representation and uses its typed close target", async ({
  request
}) => {
  const response = await request.get("/editor/lb-editor-mixed/ix/4/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("src")).toBe(
    "/txt/lb-editor-mixed/lb-editor-mixed_3/lb-editor-mixed_3_0005.jpeg"
  )
  expect(document.querySelector('input[aria-label="Gå till sida"]')?.getAttribute("max"))
    .toBe("4")
  expect([...document.querySelectorAll('a[href*="/f%C3%B6rfattare/"]')]
    .find(link => link.textContent?.includes("Stäng editor"))?.getAttribute("href")).toBe(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
  )
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-mixed/editor-manifest?media_type=faksimil"
  ])
})

test("SSR keeps the exact raw query spelling in editor page links", async ({ request }) => {
  const response = await request.get(
    "/editor/lb-editor-doktor/ix/1/f?bare&repeat=%2f&repeat=%2F"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector('a[rel="next"]')?.getAttribute("href")).toBe(
    "/editor/lb-editor-doktor/ix/2/f?bare&repeat=%2f&repeat=%2F"
  )
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-doktor/editor-manifest?media_type=faksimil"
  ])
})

test("SSR exposes bounded Editor contributors, mapped readable bounds, and part navigation", async ({
  request
}) => {
  const apiResponse = await request.get("/api/editor/lb-editor-boye/0/f")

  expect(apiResponse.status()).toBe(200)
  expect(await apiResponse.json()).toMatchObject({
    contributors: [
      { author_id: "BoyeK", author_type: null, full_name: "Karin Boye", role: null },
      {
        author_id: "HelgesonP",
        author_type: "editor",
        full_name: "Paulina Helgeson",
        role: null
      }
    ],
    currentPart: null,
    firstReadableIndex: 2,
    lastReadableIndex: 8,
    nextPartIndex: 4,
    previousPartIndex: null,
    searchable: true,
    titlePath: "EttVerkligtJordiskt"
  })

  const response = await request.get("/editor/lb-editor-boye/ix/0/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector(".reader-context-ssr .author")?.textContent)
    .toBe("Karin Boye & Paulina Helgeson red.")
  expect(document.querySelector('.reader-context-ssr a[href="/editor/lb-editor-boye/ix/2/f"]')
    ?.textContent).toContain("Gå till första sidan")
  expect(document.querySelector('.reader-context-ssr a[href="/editor/lb-editor-boye/ix/4/f"]')
    ?.textContent).toContain("Gå till nästa del")
  expect(document.querySelector('.reader-context-ssr a[href="/editor/lb-editor-boye/ix/0/f?innehall"]')
    ?.textContent).toBe("Innehållsförteckning")
  expect(document.querySelector('.reader-context-ssr a[href="/editor/lb-editor-boye/ix/0/f?om-boken"]')
    ?.textContent).toBe("Mer om boken")
  expect(document.querySelector('.reader-context-ssr a[href="/editor/lb-editor-boye/ix/0/f?fokus"]')
    ?.textContent).toBe("Läsfokus")
  expect(document.querySelector(".reader-context-ssr .reader-work-search-trigger")?.textContent)
    .toBe("Sök i verket")

  expect(document.querySelector(".reader-context-ssr .current_part")).toBeNull()

  const partResponse = await request.get("/editor/lb-editor-boye/ix/4/f")
  expect(partResponse.status()).toBe(200)
  const partDocument = parseHTML(await partResponse.text()).document
  expect(partDocument.querySelector(".reader-context-ssr .current_part .header")?.textContent)
    .toContain("Paulina Helgeson")
  expect(partDocument.querySelector(".reader-context-ssr .current_part .navtitle")?.textContent)
    .toBe("Förord")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(3).fill(
    "/v2/works/lb-editor-boye/editor-manifest?media_type=faksimil"
  ))
})

test("SSR renders a requested Editor source-information dialog", async ({ request }) => {
  const response = await request.get("/editor/lb-editor-doktor/ix/1/f?keep=%2f&om-boken")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const dialog = document.querySelector('.modal.about[role="dialog"]')
  expect(dialog?.textContent).toContain("Doktor Glas. Roman")
  expect(dialog?.querySelector('a[href="/f%C3%B6rfattare/S%C3%B6derbergH"]')?.textContent)
    .toContain("Hjalmar Söderberg")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-doktor/editor-manifest?media_type=faksimil"
  ])
})

test("SSR restores a serialized Editor search hit and marquee", async ({ request }) => {
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?show_search_work&s_query=brev" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=0&traff=w5_1&traffslut=w5_2"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const navigation = document.querySelector("#search_nav")
  expect(navigation?.textContent).toContain("Träff 1, sida 5")
  expect(document.querySelector("#w5_1.markee")).not.toBeNull()
  expect(document.querySelector("#w5_2.markee.flip")).not.toBeNull()
  expect([...navigation?.querySelectorAll("a") ?? []].some(link => (
    link.getAttribute("href") === ""
  ))).toBe(false)
  expect(navigation?.querySelector('a[href="/editor/lb8345227/ix/4/f"]')?.textContent)
    .toBe("Stäng träffvisningen")
  expect(navigation?.textContent).not.toContain("Gå direkt till träff")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb8345227/editor-manifest?media_type=faksimil"
  ])
})

test("SSR rejects serialized Editor markers that do not match the fetched hit", async ({
  request
}) => {
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?s_query=brev" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=0&traff=w5_9&traffslut=w5_9"
  )

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav")?.textContent)
    .toContain("Sökträffen kunde inte hämtas.")
  expect(document.querySelector(".editor-reader .markee")).toBeNull()
})

test("SSR restores a live-style bare prefix Editor search session", async ({ request }) => {
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?keep=%2f&keep=%2F&show_search_work&s_query=brev" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_prefix&s_word_form_only" +
    "&s_include_modernized&hit_index=0&traff=w5_1&traffslut=w5_2#prefix-session"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav")?.textContent).toContain("357 sökträffar")
  expect(document.querySelector("#w5_1.markee")).not.toBeNull()
  expect(document.querySelector('#search_nav a[rel="next"]')?.getAttribute("href")).toBe(
    "/editor/lb8345227/ix/5/f?keep=%2f&keep=%2F&show_search_work" +
      "&s_query=brev&s_lbworkid=lb8345227&s_mediatype=faksimil" +
      "&s_word_form_only=true&s_include_modernized=true&s_prefix=true" +
      "&hit_index=1&traff=w6_1&traffslut=w6_1"
  )
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb8345227/editor-manifest?media_type=faksimil"
  ])
})

test("SSR accepts the last Editor hit reachable through the bounded API offset", async ({
  request
}) => {
  await request.delete(`${fixture}/_reader_hit_requests`)
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?s_query=editor-max-direct" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=1000001&traff=w5_1&traffslut=w5_1"
  )

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav")?.textContent)
    .toContain("Träff 1000002, sida 5")
  const requests = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
  expect(requests.requests).toEqual([
    expect.objectContaining({
      query: expect.stringContaining(
        "query=editor-max-direct&offset=1000000&limit=3"
      )
    })
  ])
})

for (const invalidResponse of [
  {
    query: "incomplete-window",
    workId: "lb8345227",
    mediaType: "faksimil",
    route: "/editor/lb8345227/ix/4/f",
    range: "w5_1"
  },
  {
    query: "editor-etext-page-mismatch",
    workId: "lb-editor-doktor-glas",
    mediaType: "etext",
    route: "/editor/lb-editor-doktor-glas/ix/1/e",
    range: "w2_1"
  },
  {
    query: "editor-sparse-gap",
    workId: "lb-editor-sparse",
    mediaType: "faksimil",
    route: "/editor/lb-editor-sparse/ix/12/f",
    range: "w14_1"
  },
  {
    query: "editor-leading-zero-page",
    workId: "lb8345227",
    mediaType: "faksimil",
    route: "/editor/lb8345227/ix/4/f",
    range: "w05_1"
  }
] as const) {
  test(`SSR rejects an Editor ${invalidResponse.query} hit response`, async ({ request }) => {
    const response = await request.get(
      `${invalidResponse.route}?s_query=${invalidResponse.query}` +
      `&s_lbworkid=${invalidResponse.workId}&s_mediatype=${invalidResponse.mediaType}` +
      "&s_word_form_only=true&s_include_modernized=true&hit_index=0" +
      `&traff=${invalidResponse.range}&traffslut=${invalidResponse.range}`
    )

    expect(response.status()).toBe(200)
    const { document } = parseHTML(await response.text())
    expect(document.querySelector("#search_nav")?.textContent)
      .toContain("Sökträffen kunde inte hämtas.")
  })
}

test("SSR rejects partial Editor contributor and part metadata atomically", async ({ request }) => {
  for (const workId of [
    "lb-editor-malformed-contributor",
    "lb-editor-malformed-part"
  ]) {
    const apiResponse = await request.get(`/api/editor/${workId}/0/f`)
    expect(apiResponse.status()).toBe(200)
    expect(await apiResponse.json()).toMatchObject({
      authorId: null,
      authorName: null,
      closeHref: null,
      contributors: [],
      currentPart: null,
      firstReadableIndex: 0,
      imprintYear: null,
      lastReadableIndex: 8,
      metadataAvailable: false,
      nextPartIndex: null,
      parts: [],
      previousPartIndex: null,
      searchable: false,
      title: null,
      titlePath: null
    })

    const response = await request.get(`/editor/${workId}/ix/0/f`)
    expect(response.status()).toBe(200)
    const document = parseHTML(await response.text()).document
    expect(document.querySelector("title")?.textContent)
      .toBe(`${workId} sida 0 | Litteraturbanken`)
    expect(document.querySelector(".reader-context-ssr .editor-metadata-controls")).toBeNull()
    expect(document.body.textContent).not.toContain("Ett verkligt jordiskt liv. Brev")
    expect(document.body.textContent).not.toContain("2022")
    expect(document.querySelector('a[href*="EttVerkligtJordiskt"]')).toBeNull()
    expect(document.querySelector('.reader-context-ssr a[href$="/ix/4/f"]')).toBeNull()
    expect(document.querySelector('.reader-context-ssr a[rel="next"]')?.getAttribute("href"))
      .toBe(`/editor/${workId}/ix/1/f`)
  }
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-malformed-contributor/editor-manifest?media_type=faksimil",
    "/v2/works/lb-editor-malformed-contributor/editor-manifest?media_type=faksimil",
    "/v2/works/lb-editor-malformed-part/editor-manifest?media_type=faksimil",
    "/v2/works/lb-editor-malformed-part/editor-manifest?media_type=faksimil"
  ])
})
