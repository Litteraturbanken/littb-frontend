import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const readerPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const readerPartsPath = "/författare/SöderbergH/titlar/DoktorGlasParts/sida/-1/etext"
const workScopedReaderPath = "/författare/SöderbergH/titlar/WorkScopedIdsReader/sida/-2/etext"
const facsimilePath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"
const dramaFacsimilePath = "/författare/AlmlöfN/titlar/Affarer/sida/-2/faksimil"
const sparseReaderPath = "/författare/SparseA/titlar/SparseTitle/sida/-2/etext"
const longErrataPath = "/författare/LongErrataA/titlar/LongErrata/sida/-2/etext"
const hugeErrataPath = "/författare/HugeErrataA/titlar/HugeErrata/sida/-2/etext"
const boyeFacsimilePath = "/författare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil"
const facsimileImagePath = "/txt/lb-reader-gosta-berlings-saga/" +
  "lb-reader-gosta-berlings-saga_3/" +
  "lb-reader-gosta-berlings-saga_3_0009.jpeg"
const facsimileRetinaPath = "/txt/lb-reader-gosta-berlings-saga/" +
  "lb-reader-gosta-berlings-saga_5/" +
  "lb-reader-gosta-berlings-saga_5_0009.jpeg"
const facsimileLargePath = "/txt/lb-reader-gosta-berlings-saga/" +
  "lb-reader-gosta-berlings-saga_4/" +
  "lb-reader-gosta-berlings-saga_4_0009.jpeg"

function expectedReaderManifest(
  authorId: string,
  titlePath: string,
  mediaType: "etext" | "faksimil" = "etext"
): string {
  return `/v2/works/${encodeURIComponent(authorId)}/${encodeURIComponent(titlePath)}`
    + `/manifest?media_type=${mediaType}`
}

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_editor_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`),
    request.delete(`${fixture}/_reader_ocr_requests`),
    request.delete(`${fixture}/_reader_jpeg_requests`),
    request.delete(`${fixture}/_reader_hit_requests`),
    request.delete(`${fixture}/_reader_hit_failure`),
    request.delete(`${fixture}/_reader_hit_delays`),
    request.delete(`${fixture}/_source_info_requests`),
    request.delete(`${fixture}/_similar_work_requests`),
    request.delete(`${fixture}/_similar_work_failure`),
    request.delete(`${fixture}/_similar_work_malformed`),
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

async function readerManifestRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_reader_manifest_requests`)).json()).requests
}

async function editorManifestRequests(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${fixture}/_editor_manifest_requests`)).json()).requests
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

async function similarWorkRequests(request: APIRequestContext): Promise<Array<{
  scope: "private" | "public"
  path: string
  query: string
}>> {
  return (await (await request.get(`${fixture}/_similar_work_requests`)).json()).requests
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

test.beforeEach(async ({ request }) => resetReader(request))
test.afterEach(async ({ request }) => {
  expect((await separateReaderRequests(request)).metadata).toEqual([])
  expect(await editorManifestRequests(request)).toEqual([])
})

for (const [partition, path] of [
  ["path", "/v2/works/%20/DoktorGlas/manifest?media_type=etext"],
  ["query", "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=pdf"]
] as const) {
  test(`the Reader fixture ledgers one invalid ${partition} request before its 422 response`, async ({
    request
  }) => {
    const response = await request.get(`${fixture}${path}`)

    expect(response.status()).toBe(422)
    expect(await readerManifestRequests(request)).toEqual([path])
  })
}

test("the exact Doktor Glas page is complete in the SSR response", async ({ request }) => {
  const response = await request.get(readerPath)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain("<title>Doktor Glas sida -2 etext | Litteraturbanken</title>")
  expect(html).toContain("Doktor Glas av Hjalmar Söderberg, sida -2 som etext.")
  expect(html).toMatch(/<body[^>]*class="focus page-reading ready"/)
  expect(html).toContain('data-reader-shared-styles=""')
  expect(html).toContain(".txt .center { text-align: center; }")
  expect(html).toContain('data-reader-work-styles=""')
  expect(html).toContain(".txt .titelsida { font-family: Georgia, serif;")
  expect(html).not.toContain('href="/red/css/etext.css"')
  expect(html).not.toContain('href="/txt/css/lb-reader-doktor-glas-etext.css"')
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
  expect(html).toContain(
    'data-reader-title-tooltip-content="Doktor Glas. Roman"'
  )
  expect(html).toContain(`href="${sourceHref}">Mer om boken</a>`)
  expect(html).toContain('class="reader-context-ssr"')
  expect(html).not.toContain('class="reader-context-ssr sr-only"')
  expect(html).toContain("Sök i verket")
  expect(html).toContain('class="reader-work-search-trigger"')

  const { document } = parseHTML(html)
  const notices = [...document.querySelectorAll(
    '.reader-page > div[role="status"][aria-live="polite"]:not(.reader-search-state)'
  )]
  expect(notices).toHaveLength(2)
  expect(notices.every(notice => notice.textContent === "" && notice.className === "")).toBe(true)
  const eTextHost = document.querySelector(".reader_main > .etext.txt")
  expect(eTextHost?.tagName).toBe("DIV")
  expect(document.querySelectorAll(".reader_main > .etext.txt")).toHaveLength(1)
  expect(eTextHost?.textContent).toContain("HJALMAR SÖDERBERG")

  const recorded = await readerRequests(request)
  expect(await readerManifestRequests(request)).toEqual([
    "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"
  ])
  expect(await authorResolveRequests(request)).toEqual([])
  expect(recorded.some(path => (
    path.includes("get_work_info")
    || path.includes("count_pages")
    || path.includes("authors/resolve")
  ))).toBe(false)
  expect(recorded.filter(path => path.startsWith(
    "/txt/lb-reader-doktor-glas/res_00002.html?"
  ))).toHaveLength(1)
  expect((await separateReaderRequests(request)).html).toEqual([
    "/txt/lb-reader-doktor-glas/res_00002.html?username=app"
  ])
  expect(await readerHitRequests(request)).toEqual([])
  expect(await sourceInfoRequests(request)).toEqual([])
  expect(await sourceInfoStaticRequests(request)).toEqual([])
})

test("canonical Reader API projects exact work searchability", async ({ request }) => {
  const searchable = await request.get(
    "/nuxt-api/reader/S%C3%B6derbergH/DoktorGlas/-2/etext"
  )
  expect(searchable.status()).toBe(200)
  expect(searchable.headers()["cache-control"]).toBe("no-store")
  expect((await searchable.json()).searchable).toBe(true)

  const inert = await request.get(
    "/nuxt-api/reader/S%C3%B6derbergH/UnsearchableEtextReader/-2/etext"
  )
  expect(inert.status()).toBe(200)
  expect((await inert.json()).searchable).toBe(false)
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas"),
    expectedReaderManifest("SöderbergH", "UnsearchableEtextReader")
  ])
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
  const { document } = parseHTML(html)
  const link = document.querySelector(".reader-context-ssr .author a")
  expect(link?.getAttribute("href")).toBe("/f%C3%B6rfattare/LongErrataA")
  expect(link?.textContent?.trim()).toBe("Rita Redaktör red.")
  expect(link?.querySelector(".authortype")?.textContent).toBe("red.")
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("LongErrataA", "LongErrata")
  ])
})

test("Reader source-information SSR renders inline errata markup in every visible cell", async ({
  request
}) => {
  const response = await request.get(`${hugeErrataPath}?om-boken`)
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const cells = [...document.querySelectorAll(".modal.about .errata_table tbody tr:first-child td")]
  expect(cells.map(cell => cell.innerHTML)).toEqual([
    "sid. <em>1</em>",
    "rättning <em>1</em>",
    "notering <strong>1</strong>"
  ])
})

test("Boye Reader API and SSR retain ordered work contributors", async ({ request }) => {
  const api = await request.get(
    "/nuxt-api/reader/BoyeK/EttVerkligtJordiskt/3/faksimil"
  )
  expect(api.status()).toBe(200)
  const body = await api.json()
  expect(body.description).toBe(
    "Ett verkligt jordiskt av Karin Boye & Paulina Helgeson (red.), sida 3 som faksimil."
  )
  expect(body.contributors).toEqual([
    {
      author_id: "BoyeK",
      author_type: null,
      full_name: "Karin Boye",
      role: null
    },
    {
      author_id: "HelgesonP",
      author_type: "editor",
      full_name: "Paulina Helgeson",
      role: null
    }
  ])
  expect(body.ocrOverlay).toEqual({
    height: 900,
    html: '<div data-size="625x900"><span class="w">Boye OCR</span></div>',
    width: 625
  })

  const response = await request.get(boyeFacsimilePath)
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const context = document.querySelector(".reader-context-ssr")
  const links = [...context?.querySelectorAll(".author a") ?? []]
  expect(links.map(link => [link.textContent?.trim(), link.getAttribute("href")])).toEqual([
    ["Karin Boye", "/f%C3%B6rfattare/BoyeK"],
    ["Paulina Helgeson red.", "/f%C3%B6rfattare/HelgesonP"]
  ])
  expect(context?.querySelector(".author em")?.textContent).toBe("&")
  expect(context?.querySelector(".author .authortype")?.textContent).toBe("red.")
  const ocrLayer = document.querySelector(".reader-ocr-layer .overlay")
  expect(ocrLayer?.localName).toBe("div")
  expect(ocrLayer?.innerHTML).toBe(
    '<div data-size="625x900"><span class="w">Boye OCR</span></div>'
  )
  expect(ocrLayer?.getAttribute("style")).toContain("width:625px")
  expect(ocrLayer?.querySelector('[data-size="625x900"]')?.textContent).toBe("Boye OCR")
  expect(await readerManifestRequests(request)).toEqual(Array(2).fill(
    expectedReaderManifest("BoyeK", "EttVerkligtJordiskt", "faksimil")
  ))
})

test("Reader keeps contributor order while selecting the declared primary author", async ({
  request
}) => {
  const api = await request.get(
    "/nuxt-api/reader/PrimaryP/ReorderedPrimary/-2/etext"
  )
  expect(api.status()).toBe(200)
  const body = await api.json()
  expect(body.author).toEqual({
    author_id: "PrimaryP",
    author_type: null,
    full_name: "Pia Primary",
    role: null
  })
  expect(body.contributors.map((item: { author_id: string }) => item.author_id))
    .toEqual(["EditorE", "PrimaryP"])
  expect(body.description).toBe(
    "ReorderedPrimary av Erika Editor (red.) & Pia Primary, sida -2 som etext."
  )

  const response = await request.get(
    "/författare/PrimaryP/titlar/ReorderedPrimary/sida/-2/etext"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const links = [...document.querySelectorAll(".reader-context-ssr .author a")]
  expect(links.map(link => link.textContent?.trim())).toEqual([
    "Erika Editor red.",
    "Pia Primary"
  ])
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
  const { document } = parseHTML(html)
  const sourceDescription = document.querySelector(".modal.about .sourcedesc")
  expect(sourceDescription?.localName).toBe("div")
  expect(sourceDescription?.innerHTML).toBe("Albert Bonniers förlag, Stockholm 1905.")
  const license = document.querySelector(".modal.about .license")
  expect(license?.localName).toBe("div")
  expect(license?.innerHTML).toContain("För e-boken gäller licensen CC0")
  const errataCell = document.querySelector(".modal.about .errata_table tbody tr td:nth-child(2)")
  expect(errataCell?.localName).toBe("td")
  expect(errataCell?.innerHTML).toBe("rättning <em>1</em>")
  const similarRows = [...document.querySelectorAll(".reader-similar-works tbody tr")]
  expect(similarRows.map(row => ({
    author: row.querySelector("td:first-child")?.textContent?.trim(),
    label: row.querySelector("a")?.textContent?.trim(),
    href: row.querySelector("a")?.getAttribute("href")
  }))).toEqual([
    {
      author: "Boye",
      label: "Bebådelse [1941]",
      href: "/f%C3%B6rfattare/BoyeK/titlar/Beb%C3%A5delse/sida/3/etext"
    },
    {
      author: "Boye",
      label: "Bebådelse [Samlade skrifter 8, 1948]",
      href: "/f%C3%B6rfattare/BoyeK/titlar/Beb%C3%A5delse1948/sida/3/etext"
    },
    {
      author: "Boye",
      label: "Uppgörelser",
      href: "/f%C3%B6rfattare/BoyeK/titlar/Uppg%C3%B6relser/sida/3/etext"
    },
    {
      author: "Benedictsson",
      label: "Modern [1888]",
      href: "/f%C3%B6rfattare/BenedictssonV/titlar/Modern/sida/1/etext"
    },
    {
      author: "Boye",
      label: "Ur funktion",
      href: "/f%C3%B6rfattare/BoyeK/titlar/UrFunktion/sida/3/etext"
    }
  ])
  expect(document.querySelector(".reader-similar-works h3")?.textContent?.trim())
    .toBe("Läs gärna också")
  expect(html).not.toContain("content_vector")
  expect(html).not.toContain("Ett fel har uppstått.")
  expect(html).toMatch(/<body[^>]*class="focus page-reading ready modal-open"/u)
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/S%C3%B6derbergH/DoktorGlas/source-info",
    query: "?media_type=etext"
  }])
  expect(await similarWorkRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/lb1728740/similar",
    query: "?media_type=etext"
  }])
  expectSourceInfoStaticCacheLedger(await sourceInfoStaticRequests(request))
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
})

test("provenance-dependent license stays absent when no provenance was projected", async ({
  request
}) => {
  const response = await request.get(`${sparseReaderPath}?om-boken`)
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const dialog = document.querySelector(".about-modal")

  expect(dialog?.querySelector(".header .title")?.textContent?.trim()).toBe("Glest verk")
  expect(dialog?.querySelector(".provenance")).toBeNull()
  expect(dialog?.querySelector(".license")).toBeNull()
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
})

test("the Nitro source-information boundary rejects a non-public canonical author", async ({
  request
}) => {
  const response = await request.get(
    "/nuxt-api/reader/source-info/CanonicalNotPublicA/DoktorGlas?media_type=etext"
  )

  expect(response.status()).toBe(502)
  expect(await sourceInfoRequests(request)).toEqual([{
    scope: "private",
    path: "/private-v2/works/CanonicalNotPublicA/DoktorGlas/source-info",
    query: "?media_type=etext"
  }])
  expect(await sourceInfoStaticRequests(request)).toEqual([])
  expect(await readerManifestRequests(request)).toEqual([])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
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
  expect(roles?.localName).toBe("div")
  expect(roles?.innerHTML).toBe(
    '<i>Direktören</i>, grosshandlare<br><span class="role">Anna</span>, hans dotter'
  )
  expect([...roles?.children ?? []].map(child => child.tagName)).toEqual([
    "I",
    "BR",
    "SPAN"
  ])
  expect(await sourceInfoRequests(request)).toHaveLength(1)
  expect(await readerManifestRequests(request)).toEqual(Array(2).fill(
    expectedReaderManifest("AlmlöfN", "Affarer", "faksimil")
  ))
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlasParts"),
    expectedReaderManifest("SöderbergH", "PartlessReader")
  ])
})

test("direct contents SSR exposes its complete native table of contents", async ({
  request
}) => {
  const response = await request.get(
    `${readerPartsPath}?repeat=one&repeat=two&innehall`
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const dialog = document.querySelector('[role="dialog"][aria-modal="true"]')

  expect(dialog?.querySelector("h2.sr-only")?.textContent).toBe("Innehållsförteckning")
  expect(dialog?.querySelectorAll(".part_menu > li")).toHaveLength(5)
  expect([...dialog?.querySelectorAll(".part_menu a") ?? []].find(
    link => link.textContent?.trim() === "Mellandelen"
  )?.getAttribute("href")).toBe(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlasParts/sida/-3/etext" +
    "?repeat=one&repeat=two"
  )
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlasParts")
  ])
})

test("search-hit SSR exposes native close and validated return routes", async ({ request }) => {
  const origin = "/s%C3%B6k?fras=doktor&traffsida=2"
  const response = await request.get(
    `${readerPath}?q=doktor%20glas&hit=1&s_return=${encodeURIComponent(origin)}`
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const navigation = document.querySelector(
    '.reader-context-ssr [aria-label="Sökträffsnavigering"]'
  )
  const links = [...navigation?.querySelectorAll("a") ?? []]
  const close = links.find(link => link.textContent?.trim() === "Stäng träffvisningen")
  const searchReturn = links.find(link => link.textContent?.trim() === "Tillbaka till sökningen")

  expect(close?.getAttribute("href")).toBe(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext" +
    `?s_return=${encodeURIComponent(origin)}`
  )
  expect(searchReturn?.getAttribute("href")).toBe(origin)
  expect(await readerHitRequests(request)).toHaveLength(1)
})

test("unsearchable Reader SSR retains search-origin close and return routes", async ({ request }) => {
  const origin = "/s%C3%B6k?fras=glas&traffsida=2"
  const path = "/författare/SöderbergH/titlar/UnsearchableEtextReader/sida/-2/etext"
  const response = await request.get(
    `${path}?q=glas&hit=0&s_return=${encodeURIComponent(origin)}`
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const navigation = document.querySelector(
    '.reader-context-ssr [aria-label="Sökträffsnavigering"]'
  )
  const links = [...navigation?.querySelectorAll("a") ?? []]
  const close = links.find(link => link.textContent?.trim() === "Stäng träffvisningen")
  const searchReturn = links.find(link => link.textContent?.trim() === "Tillbaka till sökningen")

  expect(close?.getAttribute("href")).toBe(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/UnsearchableEtextReader/sida/-2/etext" +
      `?s_return=${encodeURIComponent(origin)}`
  )
  expect(searchReturn?.getAttribute("href")).toBe(origin)
  expect(links.map(link => link.textContent?.trim())).not.toContain("Föregående sökträff")
  expect(links.map(link => link.textContent?.trim())).not.toContain("Nästa sökträff")
  expect(await readerHitRequests(request)).toEqual([])
})

test("canonical API returns the exact searchable faksimil arm with selectable OCR", async ({
  request
}) => {
  const response = await request.get(
    "/nuxt-api/reader/Lagerl%C3%B6fS/GostaBerlingsSaga/3/faksimil"
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    alternateMedia: null,
    alternateMediaPageMap: null,
    author: {
      author_id: "LagerlöfS",
      author_type: null,
      full_name: "Selma Lagerlöf",
      role: null
    },
    contributors: [{
      author_id: "LagerlöfS",
      author_type: null,
      full_name: "Selma Lagerlöf",
      role: null
    }],
    declaredPageCount: null,
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
      html: '<div data-size="625x900"><span id="w3_147" class="w">OCR fixture</span></div>',
      width: 625
    },
    pageCount: 3,
    pageIndex: 1,
    pageMap: [
      { image_number: 7, page_index: 0, page_name: "1" },
      { image_number: 9, page_index: 1, page_name: "3" },
      { image_number: 12, page_index: 2, page_name: "5" }
    ],
    pageName: "3",
    pageNames: ["1", "3", "5"],
    pageStep: 1,
    parts: [{
      authors: [{
        author_id: "LagerlöfS",
        full_name: "Selma Lagerlöf",
        surname: "Lagerlöf"
      }],
      end_page_index: 2,
      end_page_name: "5",
      nav_title: "Gösta Berlings saga",
      short_title: "Gösta Berlings saga",
      source_index: 0,
      start_page_index: 0,
      start_page_name: "1",
      title: "Gösta Berlings saga",
      title_id: "GostaBerlingsSaga"
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
    metadata: [],
    html: [],
    ocr: ["/txt/lb-reader-gosta-berlings-saga/ocr_00001.html"],
    jpeg: []
  })
  expect(await readerManifestRequests(request)).toEqual([
    "/v2/works/Lagerl%C3%B6fS/GostaBerlingsSaga/manifest?media_type=faksimil"
  ])
  expect(await readerHitRequests(request)).toEqual([])
  expect(await authorResolveRequests(request)).toEqual([])
})

test("Rallarliv keeps its canonical hit marquee and assets on one v2 manifest", async ({
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
  expect(new URL(response.url()).pathname).toBe(
    "/f%C3%B6rfattare/AarnsethF/titlar/Rallarliv/sida/58/faksimil"
  )
  const html = await response.text()
  expect(html).toContain("<title>Rallarliv sida 58 faksimil | Litteraturbanken</title>")
  expect(html).toContain("Rallarliv av Fredrik Aarnseth, sida 58 som faksimil.")
  expect(html).toContain(
    'src="/txt/lb3203777/lb3203777_3/lb3203777_3_0058.jpeg"'
  )
  expect(html).toMatch(
    /id="w58_123"[^>]*class="[^"]*\bmarkee\b|class="[^"]*\bmarkee\b[^"]*"[^>]*id="w58_123"/
  )
  expect(html).toContain("Sökträff 1 av 3")
  expect(html).toContain("Nästa sökträff")
  expect(html).toContain("sida/99/faksimil?q=kyrka&amp;hit=1")
  expect(html).toContain("traff=w99_20&amp;traffslut=w99_21")
  expect(html).toContain("hit_index=1")
  expect(await readerManifestRequests(request)).toEqual([
    "/v2/works/AarnsethF/Rallarliv/manifest?media_type=faksimil"
  ])
  expect(await separateReaderRequests(request)).toEqual({
    metadata: [],
    html: [],
    ocr: ["/txt/lb3203777/ocr_00057.html"],
    jpeg: []
  })
  expect(await authorResolveRequests(request)).toEqual([])
  expect(await readerHitRequests(request)).toEqual([{
    path: "/private-v2/works/lb3203777/search-hits",
    query: "media_type=faksimil&query=kyrka&offset=0&limit=3" +
      "&word_forms=false&include_older_spellings=true&prefix=false&suffix=false"
  }])
})

test("canonical API projects source-ordered generated Reader navigation without author lookup", async ({
  request
}) => {
  const response = await request.get(
    "/nuxt-api/reader/S%C3%B6derbergH/DoktorGlasParts/-1/etext"
  )
  expect(response.status()).toBe(200)
  const body = await response.json()

  expect(body).toMatchObject({
    currentPartIndex: 2,
    endPageName: "5",
    nextPartPageName: "3",
    pageIndex: 4,
    pageMap: [
      { page_index: 1, page_name: "-4" },
      { page_index: 2, page_name: "-3" },
      { page_index: 3, page_name: "-2" },
      { page_index: 4, page_name: "-1" },
      { page_index: 5, page_name: "1" },
      { page_index: 6, page_name: "2" },
      { page_index: 7, page_name: "3" },
      { page_index: 8, page_name: "4" },
      { page_index: 9, page_name: "5" }
    ],
    pageName: "-1",
    pageNames: ["-4", "-3", "-2", "-1", "1", "2", "3", "4", "5"],
    previousPartPageName: "-2",
    startPageName: "-3"
  })
  expect(body.parts).toEqual([
    expect.objectContaining({
      authors: [{
        author_id: "SöderbergH",
        full_name: "Hjalmar Söderberg",
        surname: "Söderberg"
      }],
      source_index: 0,
      start_page_name: "-4",
      end_page_name: "1"
    }),
    expect.objectContaining({
      authors: [{
        author_id: "MörikeE",
        full_name: "Eduard Mörike",
        surname: "Mörike"
      }],
      source_index: 1
    }),
    expect.objectContaining({
      authors: [
        { author_id: "RilkeRM", full_name: "Rainer Maria Rilke", surname: "Rilke" },
        { author_id: "ShelleyPB", full_name: "Percy Bysshe Shelley", surname: "Shelley" }
      ],
      source_index: 2
    }),
    expect.objectContaining({ source_index: 3 }),
    expect.objectContaining({ source_index: 4 })
  ])
  expect(await authorResolveRequests(request)).toEqual([])
  expect(await readerManifestRequests(request)).toEqual([
    "/v2/works/S%C3%B6derbergH/DoktorGlasParts/manifest?media_type=etext"
  ])
  expect(await separateReaderRequests(request)).toEqual({
    metadata: [],
    html: ["/txt/lb-reader-doktor-glas-parts/res_00004.html?username=app"],
    ocr: [],
    jpeg: []
  })
})

test("navigation projection keeps a page gap empty and chooses the first same-start source", async ({
  request
}) => {
  const gap = await request.get("/nuxt-api/reader/S%C3%B6derbergH/DoktorGlasParts/2/etext")
  expect(gap.status()).toBe(200)
  expect(await gap.json()).toMatchObject({
    currentPartIndex: null,
    previousPartPageName: "-2",
    nextPartPageName: "3"
  })
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlasParts")
  ])

  await resetReader(request)
  const tie = await request.get("/nuxt-api/reader/S%C3%B6derbergH/DoktorGlasParts/3/etext")
  expect(tie.status()).toBe(200)
  expect(await tie.json()).toMatchObject({
    currentPartIndex: 3,
    previousPartPageName: "-2",
    nextPartPageName: null
  })
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlasParts")
  ])
})

test("partless metadata publishes empty navigation without calling the author resolver", async ({
  request
}) => {
  const response = await request.get(
    "/nuxt-api/reader/S%C3%B6derbergH/PartlessReader/-2/etext"
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({
    currentPartIndex: null,
    nextPartPageName: null,
    parts: [],
    previousPartPageName: null
  })
  expect(await authorResolveRequests(request)).toEqual([])
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "PartlessReader")
  ])
})

for (const title of [
  "MalformedPartsReader",
  "UnknownPartPageReader",
  "ReversedPartReader"
] as const) {
  test(`${title} fails before resolver and page asset IO`, async ({ request }) => {
    const response = await request.get(
      `/nuxt-api/reader/S%C3%B6derbergH/${title}/-1/etext`
    )
    expect(response.status()).toBe(502)
    expect(await authorResolveRequests(request)).toEqual([])
    const ledgers = await separateReaderRequests(request)
    expect(ledgers.html).toEqual([])
    expect(ledgers.ocr).toEqual([])
    expect(ledgers.jpeg).toEqual([])
    expect(await readerManifestRequests(request)).toEqual([
      expectedReaderManifest("SöderbergH", title)
    ])
  })
}

test("nullable generated part-author names remain direct without author lookup", async ({
  request
}) => {
  const api = await request.get(
    "/nuxt-api/reader/S%C3%B6derbergH/ReaderAuthorOmission/-1/etext"
  )
  expect(api.status()).toBe(200)
  expect((await api.json()).parts[0].authors).toEqual([{
    author_id: "MissingSummaryAuthor",
    full_name: null,
    surname: null
  }])
  expect(await authorResolveRequests(request)).toEqual([])
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "ReaderAuthorOmission")
  ])
})

for (const title of [
  "ReaderLocalWhitespaceName",
  "ReaderLocalControlName"
] as const) {
  test(`${title} rejects a malformed work contributor before resolver and page IO`, async ({
    request
  }) => {
    const response = await request.get(`/nuxt-api/reader/S%C3%B6derbergH/${title}/-1/etext`)
    expect(response.status()).toBe(502)
    expect(await authorResolveRequests(request)).toEqual([])
    expect((await separateReaderRequests(request)).html).toEqual([])
    expect(await readerManifestRequests(request)).toEqual([
      expectedReaderManifest("SöderbergH", title)
    ])
  })
}

for (const title of [
  "ReaderMatchingWhitespaceAuthorId",
  "ReaderMatchingControlAuthorId"
] as const) {
  test(`${title} rejects an unsafe locally matched author before resolver and page IO`, async ({
    request
  }) => {
    const response = await request.get(`/nuxt-api/reader/S%C3%B6derbergH/${title}/-1/etext`)
    expect(response.status()).toBe(502)
    expect(await authorResolveRequests(request)).toEqual([])
    expect((await separateReaderRequests(request)).html).toEqual([])
    expect(await readerManifestRequests(request)).toEqual([
      expectedReaderManifest("SöderbergH", title)
    ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("LagerlöfS", "GostaBerlingsSaga", "faksimil")
  ])
})

test("faksimil preserves search-shaped and invalid size queries with faksimil hits", async ({
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
  expect(html).toContain("reader-search-state")
  expect(html).not.toContain("search_nav")
  expect(html).not.toContain("markee")
  expect(await readerHitRequests(request)).toEqual([{
    path: "/private-v2/works/lb-reader-gosta-berlings-saga/search-hits",
    query: "media_type=faksimil&query=doktor&offset=0&limit=3" +
      "&word_forms=false&include_older_spellings=true&prefix=false&suffix=false"
  }])
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("LagerlöfS", "GostaBerlingsSaga", "faksimil")
  ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("LagerlöfS", "GostaBerlingsSaga", "faksimil")
  ])
})

test("a sparse faksimil manifest server-renders its selected available source", async ({
  request
}) => {
  const path = "/f%C3%B6rfattare/Lagerl%C3%B6fS/titlar/" +
    "SparseFacsimileSizes/sida/3/faksimil?storlek=2"
  const response = await request.get(path)
  expect(response.status()).toBe(200)
  const html = await response.text()
  const work = "lb-reader-sparse-facsimile-sizes"

  expect(html).toContain(`src="/txt/${work}/${work}_2/${work}_2_0009.jpeg"`)
  expect(html).toContain(
    `srcset="/txt/${work}/${work}_2/${work}_2_0009.jpeg 1x, ` +
    `/txt/${work}/${work}_4/${work}_4_0009.jpeg 2x"`
  )
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("LagerlöfS", "SparseFacsimileSizes", "faksimil")
  ])
})

test("canonical faksimil selects the requested alternate representation", async ({ request }) => {
  const response = await request.get(
    "/nuxt-api/reader/S%C3%B6derbergH/DoktorGlas/-2/faksimil"
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
    metadata: [],
    html: [],
    ocr: [],
    jpeg: []
  })
  expect(await readerManifestRequests(request)).toEqual([
    "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=faksimil"
  ])
})

test("canonical unknown media fails before reader IO", async ({ request }) => {
  const response = await request.get(
    "/nuxt-api/reader/Lagerl%C3%B6fS/GostaBerlingsSaga/3/pdf"
  )
  expect(response.status()).toBe(404)
  expect(await separateReaderRequests(request)).toEqual({
    metadata: [], html: [], ocr: [], jpeg: []
  })
  expect(await readerManifestRequests(request)).toEqual([])
})

test("canonical missing faksimil page fails before asset IO", async ({ request }) => {
  const response = await request.get(
    "/nuxt-api/reader/Lagerl%C3%B6fS/GostaBerlingsSaga/missing/faksimil"
  )
  expect(response.status()).toBe(404)
  const recorded = await separateReaderRequests(request)
  expect(recorded.metadata).toEqual([])
  expect(await readerManifestRequests(request)).toEqual([
    "/v2/works/Lagerl%C3%B6fS/GostaBerlingsSaga/manifest?media_type=faksimil"
  ])
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
      `/nuxt-api/reader/Lagerl%C3%B6fS/${titlePath}/3/faksimil`
    )
    expect(response.status()).toBe(502)
    const recorded = await separateReaderRequests(request)
    expect(recorded.metadata).toEqual([])
    expect(await readerManifestRequests(request)).toEqual([
      `/v2/works/Lagerl%C3%B6fS/${titlePath}/manifest?media_type=faksimil`
    ])
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
    "?q=doktor%20glas&amp;hit=1&amp;unknown=bevara%20mig&amp;snapshot=gen-fixture-0001\""
  )
  expect(html).toContain(
    "href=\"/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-1/etext" +
    "?q=doktor%20glas&amp;hit=1&amp;unknown=bevara%20mig&amp;snapshot=gen-fixture-0001\""
  )
  expect(html).toContain(
    "href=\"/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-3/etext" +
    "?q=doktor+glas&amp;hit=0&amp;unknown=bevara+mig&amp;snapshot=gen-fixture-0001\""
  )
  expect(html).toContain(
    "href=\"/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext" +
    "?q=doktor+glas&amp;hit=2&amp;unknown=bevara+mig&amp;snapshot=gen-fixture-0001\""
  )
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
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
    "?q=kyrka&amp;hit=1&amp;snapshot=gen-fixture-0001\""
  )
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "WorkScopedIdsReader")
  ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
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
    expect(await readerManifestRequests(request)).toEqual([
      expectedReaderManifest("SöderbergH", "DoktorGlas")
    ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
})

test("a malformed hit response is contained locally", async ({ request }) => {
  const response = await request.get(`${readerPath}?q=malformed-response&hit=0`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("DOKTOR")
  expect(html).toContain("Sökträffen kunde inte hämtas.")
  expect(html).not.toContain("markee")
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
})

test("a self-consistent hit for a page outside the Reader manifest is rejected", async ({
  request
}) => {
  const response = await request.get(`${readerPath}?q=missing-reader-page&hit=0`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("DOKTOR")
  expect(html).toContain("Sökträffen kunde inte hämtas.")
  expect(html).not.toContain("markee")
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
})

test("an incomplete hit window is contained locally", async ({ request }) => {
  const response = await request.get(`${readerPath}?q=incomplete-window&hit=1`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("DOKTOR")
  expect(html).toContain("Sökträffen kunde inte hämtas.")
  expect(html).not.toContain("Ingen sådan sökträff.")
  expect(html).not.toContain("markee")
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
})

for (const mismatch of [
  {
    label: "etext page-name-scoped word id",
    path: readerPath,
    query: "etext-name-word",
    mediaType: "etext",
    stableContent: ["DOKTOR"]
  }
]) {
  test(`${mismatch.label} is rejected before hit presentation`, async ({ request }) => {
    const response = await request.get(`${mismatch.path}?q=${mismatch.query}&hit=0`)
    expect(response.status()).toBe(200)
    const html = await response.text()

    for (const content of mismatch.stableContent) {
      expect(html).toContain(content)
    }
    expect(html).toContain("Sökträffen kunde inte hämtas.")
    expect(html).not.toContain("reader-search-position")
    expect(html).toContain("reader-hit-navigation")
    expect(html).toContain(">Stäng träffvisningen</a>")
    expect(html).not.toContain(">Föregående sökträff</a>")
    expect(html).not.toContain(">Nästa sökträff</a>")
    expect(html).not.toContain("markee")
    expect(await readerHitRequests(request)).toEqual([expect.objectContaining({
      path: expect.stringContaining("/works/"),
      query: expect.stringContaining(
        `media_type=${mismatch.mediaType}&query=${mismatch.query}`
      )
    })])
    expect(await readerManifestRequests(request)).toEqual([
      mismatch.mediaType === "etext"
        ? expectedReaderManifest("SöderbergH", "DoktorGlas")
        : expectedReaderManifest("AarnsethF", "Rallarliv", "faksimil")
    ])
  })
}

test("faksimil word identity may differ from the physical page index", async ({ request }) => {
  const response = await request.get(
    "/författare/AarnsethF/titlar/Rallarliv/sida/58/faksimil" +
    "?q=faksimil-index-word&hit=0"
  )
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("Sökträff 1 av 1")
  expect(html).not.toContain("Sökträffen kunde inte hämtas.")
  expect(html).toContain('id="w58_123"')
  expect(await readerHitRequests(request)).toEqual([expect.objectContaining({
    path: expect.stringContaining("/works/"),
    query: expect.stringContaining("media_type=faksimil&query=faksimil-index-word")
  })])
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("AarnsethF", "Rallarliv", "faksimil")
  ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
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
    expect(await readerManifestRequests(request)).toEqual([
      expectedReaderManifest("SöderbergH", "WorkScopedIdsReader")
    ])
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
    expect(await readerManifestRequests(request)).toEqual([
      expectedReaderManifest("SöderbergH", "DoktorGlas")
    ])
  })
}

test("an unsafe missing range is rejected as malformed enhancement data", async ({ request }) => {
  const response = await request.get(`${readerPath}?q=missing-range&hit=0`)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("DOKTOR")
  expect(html).toContain("Sökträffen kunde inte hämtas.")
  expect(html).not.toContain("markee")
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
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
    expect(await readerManifestRequests(request)).toEqual([
      expectedReaderManifest("SöderbergH", "DoktorGlas")
    ])
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
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ])
})

test("an unknown e-text page is a work-specific real 404", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/DoktorGlas/sida/missing/etext"
  )
  expect(response.status()).toBe(404)
  const html = await response.text()
  expect(html).toContain("<title>Sidan kan inte hittas | Litteraturbanken</title>")
  expect(html).toContain("Hittar ingen sida &#39;missing&#39; i verket.")
  expect(html).not.toContain("DOKTOR GLAS")
  const recorded = await readerRequests(request)
  expect(recorded.filter(path => path.includes("/res_"))).toHaveLength(0)
  expect(await readerManifestRequests(request)).toEqual([
    "/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"
  ])
})

test("an encoded faksimil page is escaped in the work-specific 404", async ({ request }) => {
  const unsafePage = "A&B'<script>alert(1)</script>"
  const response = await request.get(
    `/författare/SöderbergH/titlar/DoktorGlas/sida/${encodeURIComponent(unsafePage)}/faksimil`
  )
  expect(response.status()).toBe(404)
  const html = await response.text()
  expect(html).toContain(
    "Hittar ingen sida &#39;A&amp;B&#39;&lt;script&gt;alert(1)&lt;/script&gt;&#39; i verket."
  )
  expect(html).not.toContain("<script>alert(1)</script>")
  expect(html).not.toContain("onerror=")
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "DoktorGlas", "faksimil")
  ])
})

test("an unbounded Reader page name falls back to the generic 404 copy", async ({ request }) => {
  const boundedPage = "x".repeat(160)
  const boundedResponse = await request.get(
    `/författare/SöderbergH/titlar/DoktorGlas/sida/${boundedPage}/etext`
  )
  expect(boundedResponse.status()).toBe(404)
  expect(await boundedResponse.text()).toContain(
    `Hittar ingen sida &#39;${boundedPage}&#39; i verket.`
  )

  const response = await request.get(
    `/författare/SöderbergH/titlar/DoktorGlas/sida/${"x".repeat(161)}/etext`
  )
  expect(response.status()).toBe(404)
  const html = await response.text()
  expect(html).toContain("Du har angett en adress som inte finns på Litteraturbanken.")
  expect(html).not.toContain("Hittar ingen sida")
  expect(await readerManifestRequests(request)).toEqual(Array(2).fill(
    expectedReaderManifest("SöderbergH", "DoktorGlas")
  ))
})

test("a malformed Reader source stays a generic 502", async ({ request }) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/MalformedReader/sida/-2/etext"
  )
  expect(response.status()).toBe(502)
  const html = await response.text()
  expect(html).toContain("<title>Ett fel inträffade | Litteraturbanken</title>")
  expect(html).toContain("Ett fel inträffade. Vänligen försök igen senare.")
  expect(html).not.toContain("Hittar ingen sida")
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "MalformedReader")
  ])
})

test("an empty 200 Reader manifest stays inside the generic 502 boundary", async ({
  request
}) => {
  const response = await request.get(
    "/författare/SöderbergH/titlar/EmptyManifestReader/sida/1/etext"
  )

  expect(response.status()).toBe(502)
  const html = await response.text()
  expect(html).toContain("<title>Ett fel inträffade | Litteraturbanken</title>")
  expect(html).toContain("Ett fel inträffade. Vänligen försök igen senare.")
  expect(await readerManifestRequests(request)).toEqual([
    expectedReaderManifest("SöderbergH", "EmptyManifestReader")
  ])
})

test("source-quality Reader SSR retains an unavailable occurrence on the current page", async ({
  request
}) => {
  const response = await request.get(
    `${readerPath}?q=source-quality-mixed&hit=1&snapshot=gen-fixture-0001`
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const navigation = document.querySelector(".reader-hit-navigation")
  const state = document.querySelector(".reader-search-state")

  expect(state?.textContent).toContain("Sökträff 2 av 3")
  expect(state?.textContent).toContain("Träffen kan inte öppnas exakt i läsaren.")
  expect(document.querySelector(".markee")).toBeNull()
  const nextHref = navigation?.querySelector('a[rel="next"]')?.getAttribute("href")
  expect(nextHref).toBeTruthy()
  const next = new URL(nextHref ?? "", "https://example.test")
  expect(next.pathname).toContain("/titlar/DoktorGlas/sida/-1/etext")
  expect(next.searchParams.get("hit")).toBe("2")
  expect(next.searchParams.get("snapshot")).toBe("gen-fixture-0001")
})

test("source-quality Reader browser traversal clears unavailable marks and restores an exact target", async ({
  page
}) => {
  await page.goto(`${readerPath.replace("/sida/-2/", "/sida/-3/")}?q=source-quality-mixed&hit=0`, {
    waitUntil: "networkidle"
  })
  await expect(page.locator(".markee")).toHaveCount(1)
  await page.getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page.locator("#search_nav")).toContainText("Träff 2")
  await expect(page.locator("#search_nav")).toContainText("Träffen kan inte öppnas exakt i läsaren.")
  expect(new URL(page.url()).pathname).toContain("/titlar/DoktorGlas/sida/-3/etext")
  expect(new URL(page.url()).searchParams.get("hit")).toBe("1")
  await expect(page.locator(".markee")).toHaveCount(0)
  await page.getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page.locator("#search_nav")).toContainText("Träff 3, sida -1")
  expect(new URL(page.url()).pathname).toContain("/titlar/DoktorGlas/sida/-1/etext")
  await expect(page.locator(".markee")).toHaveCount(1)
})

test("source-quality Reader keeps an unavailable selection through reload and history", async ({ page }) => {
  await page.goto(`${readerPath.replace("/sida/-2/", "/sida/-3/")}?q=source-quality-mixed&hit=0`, {
    waitUntil: "networkidle"
  })
  await page.getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page.locator(".markee")).toHaveCount(0)
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.locator("#search_nav")).toContainText("Träff 2")
  await expect(page.locator(".markee")).toHaveCount(0)
  await page.goBack({ waitUntil: "networkidle" })
  await expect(page.locator(".markee")).toHaveCount(1)
  await page.goForward({ waitUntil: "networkidle" })
  await expect(page.locator(".markee")).toHaveCount(0)
})

test("source-quality Reader fetches an uncached unavailable go-to hit on its current page", async ({ page }) => {
  await page.goto(`${readerPath.replace("/sida/-2/", "/sida/-3/")}?q=source-quality-mixed&hit=0`, {
    waitUntil: "networkidle"
  })
  await page.getByRole("button", { name: "Gå direkt till träff . . ." }).click()
  await page.getByLabel("Träffnummer").fill("2")
  await page.getByLabel("Träffnummer").press("Enter")
  await expect(page.locator("#search_nav")).toContainText("Träff 2")
  expect(new URL(page.url()).pathname).toContain("/titlar/DoktorGlas/sida/-3/etext")
  expect(new URL(page.url()).searchParams.get("hit")).toBe("1")
  await expect(page.locator(".markee")).toHaveCount(0)
})

test("source-quality Reader submits a first unavailable occurrence through its search controls", async ({ page }) => {
  await page.goto(readerPath, { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Sök i verket" }).click()
  await page.locator('input[aria-label="Sök i verket"]:visible').fill("source-quality-first-unavailable")
  await page.getByRole("button", { name: "Sök", exact: true }).click()

  await expect(page.locator("#search_nav")).toContainText("Träff 1")
  await expect(page.locator("#search_nav")).toContainText("Träffen kan inte öppnas exakt i läsaren.")
  const url = new URL(page.url())
  expect(decodeURIComponent(url.pathname)).toBe(readerPath)
  expect(url.searchParams.get("q")).toBe("source-quality-first-unavailable")
  expect(url.searchParams.get("hit")).toBe("0")
  expect(url.searchParams.get("snapshot")).toBe("gen-fixture-0001")
  await expect(page.locator(".markee")).toHaveCount(0)
})

test("source-quality Reader go-to fetches an uncached unavailable hit with its pinned snapshot", async ({
  page,
  request
}) => {
  await request.delete(`${fixture}/_reader_hit_requests`)
  await page.goto(`${readerPath.replace("/sida/-2/", "/sida/-3/")}?q=source-quality-uncached&hit=0`, {
    waitUntil: "networkidle"
  })
  await page.getByRole("button", { name: "Gå direkt till träff . . ." }).click()
  await page.getByLabel("Träffnummer").fill("5")
  await page.getByLabel("Träffnummer").press("Enter")

  await expect(page.locator("#search_nav")).toContainText("Träff 5")
  await expect(page.locator("#search_nav")).toContainText("Träffen kan inte öppnas exakt i läsaren.")
  expect(new URL(page.url()).pathname).toContain("/titlar/DoktorGlas/sida/-3/etext")
  expect(new URL(page.url()).searchParams.get("hit")).toBe("4")
  await expect(page.locator(".markee")).toHaveCount(0)
  await expect.poll(async () => (await readerHitRequests(request)).some(item => {
    const query = new URLSearchParams(item.query)
    return query.get("query") === "source-quality-uncached" &&
      query.get("offset") === "3" && query.get("limit") === "3" &&
      query.get("snapshot") === "gen-fixture-0001"
  })).toBe(true)
})

for (const staleStatus of [200, 409]) {
  test(`source-quality Reader ignores a held obsolete ${staleStatus} after selection and search changes`, async ({
    page
  }) => {
    await page.goto(`${readerPath.replace("/sida/-2/", "/sida/-3/")}?q=source-quality-uncached&hit=0`, {
      waitUntil: "networkidle"
    })
    await page.evaluate(status => {
      const nativeFetch = window.fetch.bind(window)
      let release!: () => void
      const gate = new Promise<void>(resolve => { release = resolve })
      const state = { started: false, release }
      Object.assign(window, { sourceQualityGate: state })
      window.fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input), location.href)
        if (url.pathname.endsWith("/search-hits") &&
          url.searchParams.get("query") === "source-quality-uncached" &&
          url.searchParams.get("offset") === "3") {
          const response = await nativeFetch(input, init)
          state.started = true
          await gate
          if (status === 409) {
            return new Response(JSON.stringify({
              error: {
                code: "text_search_snapshot_expired",
                message: "Text-search snapshot has expired",
                details: null
              }
            }), { status: 409, headers: { "content-type": "application/json" } })
          }
          return response
        }
        return nativeFetch(input, init)
      }
    }, staleStatus)
    await page.getByRole("button", { name: "Gå direkt till träff . . ." }).click()
    await page.getByLabel("Träffnummer").fill("5")
    await page.getByLabel("Träffnummer").press("Enter")
    await page.waitForFunction(() => (
      window as unknown as { sourceQualityGate: { started: boolean } }
    ).sourceQualityGate.started)

    await page.getByRole("link", { name: "Nästa sökträff" }).click()
    await expect(page.locator("#search_nav")).toContainText("Träff 2")
    await expect(page.locator(".markee")).toHaveCount(0)
    await page.getByRole("button", { name: "Sök i verket" }).click()
    await page.locator('input[aria-label="Sök i verket"]:visible').fill("source-quality-first-unavailable")
    await page.getByRole("button", { name: "Sök", exact: true }).click()
    await expect(page.locator("#search_nav")).toContainText("Träff 1")
    await expect(page.locator("#search_nav")).toContainText("Träffen kan inte öppnas exakt i läsaren.")

    await page.evaluate(async () => {
      ;(window as unknown as { sourceQualityGate: { release: () => void } }).sourceQualityGate.release()
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await expect(page.locator("#search_nav")).toContainText("Träff 1")
    expect(new URL(page.url()).searchParams.get("q")).toBe("source-quality-first-unavailable")
    await expect(page.locator(".markee")).toHaveCount(0)
  })
}

for (const query of ["source-quality-first-unavailable", "source-quality-ambiguous", "source-quality-unsupported"]) {
  test(`source-quality Reader accepts a first ${query} occurrence without a marker`, async ({ request }) => {
    const response = await request.get(`${readerPath}?q=${query}&hit=0&snapshot=gen-fixture-0001`)
    const { document } = parseHTML(await response.text())
    expect(response.status()).toBe(200)
    expect(document.querySelector(".reader-search-state")?.textContent)
      .toContain("Träffen kan inte öppnas exakt i läsaren.")
    expect(document.querySelector(".markee")).toBeNull()
  })
}

test("source-quality Reader keeps a faksimil occurrence markerless on its existing page", async ({ request }) => {
  const response = await request.get(
    `${facsimilePath}?q=source-quality-first-unavailable&hit=0&snapshot=gen-fixture-0001`
  )
  const { document } = parseHTML(await response.text())
  expect(response.status()).toBe(200)
  expect(document.querySelector(".reader-search-state")?.textContent)
    .toContain("Träffen kan inte öppnas exakt i läsaren.")
  expect(document.querySelector(".markee")).toBeNull()
})

test("source-quality Reader faksimil browser traversal changes image and raw marker only for exact hits", async ({
  page
}) => {
  await page.goto(`${facsimilePath}?q=source-quality-mixed&hit=0`, { waitUntil: "networkidle" })
  await expect(page.locator("img.faksimil")).toHaveAttribute("src", facsimileImagePath)
  expect(new URL(page.url()).searchParams.has("traff")).toBe(false)

  await page.getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page.locator("#search_nav")).toContainText("Träffen kan inte öppnas exakt i läsaren.")
  expect(new URL(page.url()).pathname).toContain("/sida/3/faksimil")
  expect(new URL(page.url()).searchParams.has("traff")).toBe(false)
  expect(new URL(page.url()).searchParams.has("traffslut")).toBe(false)
  await expect(page.locator("img.faksimil")).toHaveAttribute("src", facsimileImagePath)

  await page.getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page.locator("#search_nav")).toContainText("Träff 3, sida 5")
  expect(new URL(page.url()).pathname).toContain("/sida/5/faksimil")
  expect(new URL(page.url()).searchParams.get("traff")).toBe("w5_1")
  await expect(page.locator("img.faksimil")).toHaveAttribute("src", /_3_0012\.jpeg$/)
})
