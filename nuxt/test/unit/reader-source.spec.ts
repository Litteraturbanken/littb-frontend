import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest"

import {
  buildFacsimileSources,
  facsimileImageUrl,
  facsimileSourcePair,
  fetchReaderPageHtml,
  isReaderMediaType,
  loadReaderMetadata,
  maximumReaderEtextBytes,
  normalizeReaderMetadata,
  preferredFacsimileSize,
  resolveReaderPartNavigation
} from "../../server/utils/reader-source"

import type { ManagedAssetHtml } from "../../shared/types/renderable-html"
import type { ReaderEtextPage, ReaderPart } from "../../shared/types/reader"
import type { transformManagedReaderHtml } from "../../shared/utils/renderable-html"

function representation(overrides: Record<string, unknown> = {}) {
  return {
    authors: [{ authorid: "LagerlöfS", full_name: "Selma Lagerlöf" }],
    faksimil_sizes: [4, 0, 2],
    lbworkid: "lb 12/!*'()",
    mediatype: "faksimil",
    pages: [
      { imagenumber: 27, pageindex: 4, pagename: "scan-A" },
      { imagenumber: 9, pageindex: 1, pagename: "3" }
    ],
    shorttitle: "Gösta Berlings saga",
    startpagename: "scan-A",
    title: "Gösta Berlings saga. Fullständig titel",
    titlepath: "GostaBerlingsSaga",
    width: { size_1: 300, size_3: 625, size_5: 1200 },
    ...overrides
  }
}

function payload(...items: unknown[]) {
  return { data: items }
}

function normalize(overrides: Record<string, unknown> = {}) {
  return normalizeReaderMetadata(
    payload(representation(overrides)),
    "https://example.test/base",
    "LagerlöfS",
    "GostaBerlingsSaga",
    "faksimil"
  )
}

function expectSourceError(callback: () => unknown, statusCode: number) {
  expect(callback).toThrow(expect.objectContaining({ statusCode }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("managed Reader e-text boundary", () => {
  test("retains the Reader authority through the DTO and marker path", () => {
    expectTypeOf<string>().not.toMatchTypeOf<ReaderEtextPage["html"]>()
    expectTypeOf<ManagedAssetHtml<"home-editorial">>()
      .not.toMatchTypeOf<ReaderEtextPage["html"]>()
    expectTypeOf<ReaderEtextPage["html"]>()
      .toEqualTypeOf<Parameters<typeof transformManagedReaderHtml>[0]>()
  })

  test("requests the exact legacy asset once and preserves decoded text for route normalization", async () => {
    const source = `a\u00adb${"x".repeat(maximumReaderEtextBytes - 4)}`
    expect(new TextEncoder().encode(source)).toHaveLength(maximumReaderEtextBytes)
    const response = new Response(source, {
      headers: {
        "content-length": String(maximumReaderEtextBytes),
        "content-type": "text/html; charset=utf-8"
      }
    })
    Object.defineProperty(response, "url", {
      value: "https://assets.test/txt/lb%20reader/res_00004.html?username=app"
    })
    const fetcher = vi.fn<typeof fetch>(async () => response)
    vi.stubGlobal("fetch", fetcher)

    await expect(fetchReaderPageHtml(
      "https://assets.test",
      "lb reader",
      4
    )).resolves.toBe(source)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith(
      "https://assets.test/txt/lb%20reader/res_00004.html?username=app",
      { redirect: "follow" }
    )
  })

  test.each([
    ["declared", true],
    ["actual", false]
  ])("rejects a %s Reader body above the exact byte budget", async (_label, declared) => {
    const source = declared ? "small" : "x".repeat(maximumReaderEtextBytes + 1)
    const response = new Response(source, {
      headers: {
        ...(declared
          ? { "content-length": String(maximumReaderEtextBytes + 1) }
          : {}),
        "content-type": "text/html"
      }
    })
    Object.defineProperty(response, "url", {
      value: "https://assets.test/txt/work/res_00001.html?username=app"
    })
    const fetcher = vi.fn<typeof fetch>(async () => response)
    vi.stubGlobal("fetch", fetcher)

    await expect(fetchReaderPageHtml(
      "https://assets.test",
      "work",
      1
    )).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: "Reader source unavailable"
    })
    expect(fetcher).toHaveBeenCalledOnce()
  })
})

describe("reader media and exact representation selection", () => {
  test("accepts only the two exact Reader media types", () => {
    expect(isReaderMediaType("etext")).toBe(true)
    expect(isReaderMediaType("faksimil")).toBe(true)
    expect(isReaderMediaType("Faksimil")).toBe(false)
    expect(isReaderMediaType("faksimil ")).toBe(false)
    expect(isReaderMediaType("pdf")).toBe(false)
  })

  test("selects the exact media and title representation while retaining its identity", () => {
    const metadata = normalizeReaderMetadata(
      payload(
        representation({ mediatype: "etext" }),
        representation({ titlepath: "AnnanTitel" }),
        representation()
      ),
      "https://example.test/base",
      "LagerlöfS",
      "GostaBerlingsSaga",
      "faksimil"
    )

    expect(metadata).toMatchObject({
      author: { id: "LagerlöfS", name: "Selma Lagerlöf" },
      isDrama: false,
      mediaType: "faksimil",
      titlePath: "GostaBerlingsSaga",
      workId: "lb 12/!*'()"
    })
  })

  test("projects the selected representation's drama classification", () => {
    expect(normalize({ texttype: "drama" })).toMatchObject({ isDrama: true })
    expect(normalize({ texttype: "roman" })).toMatchObject({ isDrama: false })
    expect(normalize({ texttype: undefined })).toMatchObject({ isDrama: false })
  })

  test("projects only an actual Dramawebben object for the Reader sidebar", () => {
    expect(normalize({ dramawebben: {} })).toMatchObject({ hasDramawebben: true })
    expect(normalize({ dramawebben: null })).toMatchObject({ hasDramawebben: false })
    expect(normalize({ dramawebben: true })).toMatchObject({ hasDramawebben: false })
    expect(normalize({ dramawebben: "yes" })).toMatchObject({ hasDramawebben: false })
  })

  test("projects a valid explicit page count for legacy slider positioning", () => {
    expect(normalize({ page_count: 2 })).toMatchObject({ explicitPageCount: 2 })
    expect(normalize({ page_count: 1 })).toMatchObject({ explicitPageCount: 1 })
    expect(normalize({ page_count: undefined })).toMatchObject({ explicitPageCount: null })
    expect(normalize({ page_count: 0 })).toMatchObject({ explicitPageCount: null })
    expect(normalize({ page_count: 2.5 })).toMatchObject({ explicitPageCount: null })
    expect(normalize({ page_count: "2" })).toMatchObject({ explicitPageCount: null })
  })

  test("projects the legacy facsimile page step used by pager navigation", () => {
    expect(normalize({ pagestep: "2" })).toMatchObject({ pageStep: 2 })
    expect(normalize({ pagestep: 3 })).toMatchObject({ pageStep: 3 })
    expect(normalize({ pagestep: undefined })).toMatchObject({ pageStep: 1 })
    expect(normalize({ pagestep: "0" })).toMatchObject({ pageStep: 1 })
    expect(normalize({ pagestep: "2.5" })).toMatchObject({ pageStep: 1 })
  })

  test("projects only safe legacy main-author contribution values", () => {
    expect(normalize({
      authors: [{
        authorid: "LagerlöfS",
        full_name: "Selma Lagerlöf",
        role: "translator",
        type: "editor"
      }]
    }).author).toEqual({
      id: "LagerlöfS",
      name: "Selma Lagerlöf",
      authorType: "editor",
      role: "translator"
    })
    expect(normalize({
      authors: [{
        authorid: "LagerlöfS",
        full_name: "Selma Lagerlöf",
        role: "unknown",
        type: "editor\n"
      }]
    }).author).toEqual({
      id: "LagerlöfS",
      name: "Selma Lagerlöf",
      authorType: null,
      role: null
    })
  })

  test("retains ordered work contributors with normalized contribution values", () => {
    const metadata = normalize({
      authors: [
        {
          authorid: "LagerlöfS",
          full_name: "Selma Lagerlöf"
        },
        {
          authorid: "HelgesonP",
          full_name: "Paulina Helgeson",
          role: "unknown",
          type: "EDITOR"
        }
      ]
    })

    expect(metadata.contributors).toEqual([
      {
        id: "LagerlöfS",
        name: "Selma Lagerlöf",
        authorType: null,
        role: null
      },
      {
        id: "HelgesonP",
        name: "Paulina Helgeson",
        authorType: "editor",
        role: null
      }
    ])
    expect(metadata.author).toEqual(metadata.contributors[0])
  })

  test("validates the primary route author without rejecting other contributors", () => {
    expect(normalize({
      authors: [
        { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" },
        { authorid: "HelgesonP", full_name: "Paulina Helgeson", type: "editor" }
      ]
    }).contributors).toHaveLength(2)

    expectSourceError(() => normalize({
      authors: [
        { authorid: "HelgesonP", full_name: "Paulina Helgeson", type: "editor" },
        { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" }
      ]
    }), 404)
  })

  test.each([
    ["non-array", {}],
    ["empty", []],
    ["too many", [
      { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" },
      ...Array.from({ length: 100 }, (_, index) => ({
        authorid: `Contributor${index}`,
        full_name: `Contributor ${index}`
      }))
    ]],
    ["non-object entry", [
      { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" },
      null
    ]],
    ["missing contributor ID", [
      { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" },
      { full_name: "Paulina Helgeson" }
    ]],
    ["whitespace contributor ID", [
      { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" },
      { authorid: " HelgesonP", full_name: "Paulina Helgeson" }
    ]],
    ["control character in contributor name", [
      { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" },
      { authorid: "HelgesonP", full_name: "Paulina\nHelgeson" }
    ]],
    ["C1 character in contributor name", [
      { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" },
      { authorid: "HelgesonP", full_name: "Paulina\u0080Helgeson" }
    ]],
    ["overlong contributor name", [
      { authorid: "LagerlöfS", full_name: "Selma Lagerlöf" },
      { authorid: "HelgesonP", full_name: "x".repeat(2_001) }
    ]]
  ])("rejects %s work contributor metadata", (_label, authors) => {
    expectSourceError(() => normalize({ authors }), 502)
  })

  test("rejects absent exact media/title and mismatched author identities", () => {
    expectSourceError(() => normalizeReaderMetadata(
      payload(representation({ mediatype: "etext" })),
      "https://example.test/base",
      "LagerlöfS",
      "GostaBerlingsSaga",
      "faksimil"
    ), 404)
    expectSourceError(() => normalize({
      authors: [{ authorid: "SöderbergH", full_name: "Hjalmar Söderberg" }]
    }), 404)
  })

  test("rejects unknown media before runtime config or upstream I/O", async () => {
    const runtimeConfig = vi.fn(() => ({ readerSourceBase: "https://example.test" }))
    const fetch = vi.fn()
    vi.stubGlobal("useRuntimeConfig", runtimeConfig)
    vi.stubGlobal("$fetch", fetch)

    await expect(loadReaderMetadata(
      {} as Parameters<typeof loadReaderMetadata>[0],
      "LagerlöfS",
      "GostaBerlingsSaga",
      "pdf"
    )).rejects.toMatchObject({ statusCode: 404 })
    expect(runtimeConfig).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  test("falls back to backend metadata for the real Rallarliv faksimil identity", async () => {
    const runtimeConfig = vi.fn(() => ({
      libraryApiBase: "http://backend.test",
      readerSourceBase: "https://assets.test"
    }))
    const fetch = vi.fn()
      .mockResolvedValueOnce({ hits: 0, data: [] })
      .mockResolvedValueOnce(payload(representation({
        authors: [{
          authorid: "AarnsethF",
          full_name: "Fredrik Aarnseth",
          surname: "Aarnseth"
        }],
        lbworkid: "lb3203777",
        pages: [{ imagenumber: 58, pageindex: 57, pagename: "58" }],
        shorttitle: "Rallarliv",
        title: "Rallarliv",
        titlepath: "Rallarliv"
      })))
    vi.stubGlobal("useRuntimeConfig", runtimeConfig)
    vi.stubGlobal("$fetch", fetch)

    const metadata = await loadReaderMetadata(
      {} as Parameters<typeof loadReaderMetadata>[0],
      "AarnsethF",
      "Rallarliv",
      "faksimil"
    )

    expect(metadata).toMatchObject({
      base: "https://assets.test",
      mediaType: "faksimil",
      pages: [{ imageNumber: 58, pageIndex: 57, pageName: "58" }],
      workId: "lb3203777"
    })
    expect(fetch).toHaveBeenNthCalledWith(1, "https://assets.test/api/get_work_info", {
      query: {
        authorid: "AarnsethF",
        exclude: "content_vector",
        titlepath: "Rallarliv"
      },
      retry: 0
    })
    expect(fetch).toHaveBeenNthCalledWith(2, "http://backend.test/get_work_info", {
      query: {
        authorid: "AarnsethF",
        exclude: "content_vector",
        titlepath: "Rallarliv"
      },
      retry: 0
    })
  })

  test("preserves e-text sibling-page inheritance by work identity", () => {
    const metadata = normalizeReaderMetadata(
      payload(
        representation({ mediatype: "etext", pages: undefined }),
        representation({
          pages: [
            { imagenumber: 19, pageindex: 2, pagename: "-1" },
            { imagenumber: 20, pageindex: 3, pagename: "1" }
          ]
        })
      ),
      "https://example.test/base",
      "LagerlöfS",
      "GostaBerlingsSaga",
      "etext"
    )

    expect(metadata).toMatchObject({
      mediaType: "etext",
      pages: [
        { pageIndex: 2, pageName: "-1" },
        { pageIndex: 3, pageName: "1" }
      ]
    })
  })

  test.each([
    ["page name", [
      { pageindex: 0, pagename: "1" },
      { pageindex: 1, pagename: "1" }
    ]],
    ["page index", [
      { pageindex: 0, pagename: "1" },
      { pageindex: 0, pagename: "2" }
    ]]
  ])("rejects duplicate e-text %s identities", (_label, pages) => {
    expectSourceError(() => normalizeReaderMetadata(
      payload(representation({ mediatype: "etext", pages })),
      "https://example.test/base",
      "LagerlöfS",
      "GostaBerlingsSaga",
      "etext"
    ), 502)
  })
})

describe("reader part normalization", () => {
  const pages = ["-4", "-3", "-2", "-1", "1"].map((pagename, pageindex) => ({
    imagenumber: pageindex + 1,
    pageindex,
    pagename
  }))
  const part = {
    authors: [{ authorid: "SöderbergH" }],
    endpagename: "-1",
    navtitle: "Romanen",
    shorttitle: "",
    startpagename: "-3",
    title: "Doktor Glas",
    titleid: "part-doktor-glas"
  }

  function partMetadata(overrides: Record<string, unknown> = {}) {
    return normalize({
      authors: [
        { authorid: "LagerlöfS", full_name: "Selma Lagerlöf", surname: "Lagerlöf" },
        {
          authorid: "SöderbergH",
          full_name: "Hjalmar Söderberg",
          surname: "Söderberg"
        }
      ],
      endpagename: "1",
      pages,
      parts: [part],
      ...overrides
    })
  }

  test.each([
    ["absent", undefined],
    ["null", null],
    ["empty", []]
  ])("accepts a valid %s partless representation", (_label, parts) => {
    const metadata = partMetadata({ parts })
    expect(metadata.parts).toEqual([])
  })

  test("normalizes exact page bounds, optional labels, and local part authors", () => {
    const metadata = partMetadata()

    expect(metadata).toMatchObject({
      endPageName: "1",
      startPageName: "scan-A"
    })
    expect(metadata.parts).toEqual([{
      sourceIndex: 0,
      startPageName: "-3",
      startPageIndex: 1,
      endPageName: "-1",
      endPageIndex: 3,
      title: "Doktor Glas",
      navTitle: "Romanen",
      shortTitle: null,
      titleId: "part-doktor-glas",
      authors: [{
        id: "SöderbergH",
        name: "Hjalmar Söderberg",
        surname: "Söderberg"
      }]
    }])
  })

  test("normalizes empty optional labels and an unknown valid author to null", () => {
    const metadata = partMetadata({
      parts: [{
        ...part,
        authors: [{ authorid: "Okänd" }],
        navtitle: "",
        shorttitle: "",
        titleid: ""
      }]
    })

    expect(metadata.parts[0]).toMatchObject({
      authors: [{ id: "Okänd", name: null, surname: null }],
      navTitle: null,
      shortTitle: null,
      titleId: null
    })
  })

  test.each([
    ["whitespace full name", { full_name: " Hjalmar Söderberg", surname: "Söderberg" }],
    ["control full name", { full_name: "Hjalmar\nSöderberg", surname: "Söderberg" }]
  ])("rejects a work contributor with %s", (_label, invalidSummary) => {
    expectSourceError(() => partMetadata({
      authors: [
        { authorid: "LagerlöfS", full_name: "Selma Lagerlöf", surname: "Lagerlöf" },
        { authorid: "SöderbergH", ...invalidSummary }
      ]
    }), 502)
  })

  test.each([
    ["whitespace surname", { full_name: "Hjalmar Söderberg", surname: " Söderberg" }],
    ["control surname", { full_name: "Hjalmar Söderberg", surname: "Söderberg\n" }]
  ])("does not trust a local author with %s", (_label, invalidSummary) => {
    const metadata = partMetadata({
      authors: [
        { authorid: "LagerlöfS", full_name: "Selma Lagerlöf", surname: "Lagerlöf" },
        { authorid: "SöderbergH", ...invalidSummary }
      ]
    })

    expect(metadata.parts[0]?.authors).toEqual([{
      id: "SöderbergH",
      name: null,
      surname: null
    }])
  })

  test.each([
    ["surrounding whitespace", " SöderbergH"],
    ["control characters", "SöderbergH\n"]
  ])("rejects a matching local and part author ID with %s", (_label, authorid) => {
    expectSourceError(() => partMetadata({
      authors: [
        { authorid: "LagerlöfS", full_name: "Selma Lagerlöf", surname: "Lagerlöf" },
        { authorid, full_name: "Hjalmar Söderberg", surname: "Söderberg" }
      ],
      parts: [{ ...part, authors: [{ authorid }] }]
    }), 502)
  })

  test("preserves duplicate ranges and equal starts in source order", () => {
    const metadata = partMetadata({ parts: [part, { ...part }, { ...part, title: "Tredje" }] })
    expect(metadata.parts.map(item => ({
      sourceIndex: item.sourceIndex,
      startPageIndex: item.startPageIndex,
      title: item.title
    }))).toEqual([
      { sourceIndex: 0, startPageIndex: 1, title: "Doktor Glas" },
      { sourceIndex: 1, startPageIndex: 1, title: "Doktor Glas" },
      { sourceIndex: 2, startPageIndex: 1, title: "Tredje" }
    ])
  })

  test.each([
    ["non-array container", {}],
    ["non-record item", ["part"]],
    ["missing title", [{ ...part, title: undefined }]],
    ["wrong title type", [{ ...part, title: 1 }]],
    ["missing start", [{ ...part, startpagename: undefined }]],
    ["wrong start type", [{ ...part, startpagename: 1 }]],
    ["missing end", [{ ...part, endpagename: undefined }]],
    ["wrong end type", [{ ...part, endpagename: 1 }]],
    ["wrong nav title type", [{ ...part, navtitle: 1 }]],
    ["wrong short title type", [{ ...part, shorttitle: 1 }]],
    ["wrong title id type", [{ ...part, titleid: 1 }]],
    ["unknown start endpoint", [{ ...part, startpagename: "missing" }]],
    ["unknown end endpoint", [{ ...part, endpagename: "missing" }]],
    ["reversed endpoints", [{ ...part, startpagename: "-1", endpagename: "-3" }]],
    ["non-array authors", [{ ...part, authors: {} }]],
    ["missing author id", [{ ...part, authors: [{}] }]],
    ["wrong author id type", [{ ...part, authors: [{ authorid: 1 }] }]]
  ])("rejects a malformed parts graph with %s", (_label, parts) => {
    expectSourceError(() => partMetadata({ parts }), 502)
  })

  test.each([
    ["overlong page name", { pages: [{ imagenumber: 1, pageindex: 0, pagename: "p".repeat(101) }] }],
    ["too many pages", { pages: Array.from({ length: 100_001 }, (_, pageindex) => ({
      imagenumber: pageindex,
      pageindex,
      pagename: String(pageindex)
    })) }],
    ["too many parts", { parts: Array.from({ length: 10_001 }, () => part) }],
    ["too many part authors", { parts: [{
      ...part,
      authors: Array.from({ length: 101 }, (_, index) => ({ authorid: `Author${index}` }))
    }] }],
    ["overlong part author id", { parts: [{
      ...part,
      authors: [{ authorid: "a".repeat(101) }]
    }] }],
    ["overlong part title", { parts: [{ ...part, title: "t".repeat(2_001) }] }],
    ["overlong optional part title", { parts: [{ ...part, navtitle: "n".repeat(2_001) }] }],
    ["overlong optional title id", { parts: [{ ...part, titleid: "i".repeat(101) }] }]
  ])("rejects %s at the public Reader bounds", (_label, overrides) => {
    expectSourceError(() => partMetadata(overrides), 502)
  })

  test.each([
    ["start page", { startpagename: "s".repeat(101) }],
    ["end page", { endpagename: "e".repeat(101) }]
  ])("rejects an overlong declared %s name", (_label, overrides) => {
    expectSourceError(() => partMetadata(overrides), 502)
  })
})

describe("nested and overlapping Reader part navigation", () => {
  function navigationPart(
    sourceIndex: number,
    startPageIndex: number,
    endPageIndex: number,
    startPageName = String(startPageIndex)
  ): ReaderPart {
    return {
      authors: [],
      endPageIndex,
      endPageName: String(endPageIndex),
      navTitle: null,
      shortTitle: null,
      sourceIndex,
      startPageIndex,
      startPageName,
      title: `Part ${sourceIndex}`,
      titleId: null
    }
  }

  const parts: ReaderPart[] = [
    navigationPart(0, 0, 4),
    navigationPart(1, 1, 2),
    navigationPart(2, 3, 4, "2"),
    navigationPart(3, 6, 7),
    navigationPart(4, 6, 8),
    navigationPart(5, 9, 10)
  ]

  test("selects the last active stable overlap and bounds neighboring starts", () => {
    expect(resolveReaderPartNavigation(parts, 4)).toEqual({
      currentPartIndex: 2,
      previousPartPageName: "2",
      nextPartPageName: "6"
    })
  })

  test("chooses the first source entry at an exact equal start", () => {
    expect(resolveReaderPartNavigation(parts, 6)).toEqual({
      currentPartIndex: 3,
      previousPartPageName: "2",
      nextPartPageName: "9"
    })
  })

  test("chooses the last active entry when inside equal-start ranges", () => {
    expect(resolveReaderPartNavigation(parts, 7)).toEqual({
      currentPartIndex: 4,
      previousPartPageName: "6",
      nextPartPageName: "9"
    })
  })

  test("keeps gaps empty while retaining nearest bounded part starts", () => {
    expect(resolveReaderPartNavigation(parts, 5)).toEqual({
      currentPartIndex: null,
      previousPartPageName: "2",
      nextPartPageName: "6"
    })
  })

  test.each([
    [-1, { currentPartIndex: null, previousPartPageName: null, nextPartPageName: "0" }],
    [11, { currentPartIndex: null, previousPartPageName: "9", nextPartPageName: null }]
  ])("bounds navigation outside all parts at page %s", (pageIndex, expected) => {
    expect(resolveReaderPartNavigation(parts, pageIndex)).toEqual(expected)
  })

  test("rejects a graph whose public source indexes no longer match source order", () => {
    expect(() => resolveReaderPartNavigation([
      navigationPart(1, 0, 1)
    ], 0)).toThrow(RangeError)
  })
})

describe("faksimil page identities", () => {
  test("keeps public page name, numeric order, and JPEG image number distinct", () => {
    const metadata = normalize()
    expect(metadata.mediaType).toBe("faksimil")
    if (metadata.mediaType !== "faksimil") throw new Error("wrong test media")

    expect(metadata.pages).toEqual([
      { imageNumber: 9, pageIndex: 1, pageName: "3" },
      { imageNumber: 27, pageIndex: 4, pageName: "scan-A" }
    ])
  })

  test("allows distinct page identities to share one JPEG image number", () => {
    const metadata = normalize({
      pages: [
        { imagenumber: 9, pageindex: 0, pagename: "1" },
        { imagenumber: 9, pageindex: 1, pagename: "2" }
      ]
    })
    expect(metadata.mediaType).toBe("faksimil")
    if (metadata.mediaType !== "faksimil") throw new Error("wrong test media")

    expect(metadata.pages).toEqual([
      { imageNumber: 9, pageIndex: 0, pageName: "1" },
      { imageNumber: 9, pageIndex: 1, pageName: "2" }
    ])
  })

  test.each([
    ["missing image number", [{ pageindex: 0, pagename: "1" }]],
    ["negative image number", [{ imagenumber: -1, pageindex: 0, pagename: "1" }]],
    ["unsafe image number", [{ imagenumber: Number.MAX_SAFE_INTEGER + 1, pageindex: 0, pagename: "1" }]],
    ["negative page index", [{ imagenumber: 1, pageindex: -1, pagename: "1" }]],
    ["unsafe page index", [{ imagenumber: 1, pageindex: Number.MAX_SAFE_INTEGER + 1, pagename: "1" }]],
    ["missing page name", [{ imagenumber: 1, pageindex: 0 }]],
    ["duplicate page name", [
      { imagenumber: 1, pageindex: 0, pagename: "1" },
      { imagenumber: 2, pageindex: 1, pagename: "1" }
    ]],
    ["duplicate page index", [
      { imagenumber: 1, pageindex: 0, pagename: "1" },
      { imagenumber: 2, pageindex: 0, pagename: "2" }
    ]]
  ])("rejects %s", (_label, pages) => {
    expectSourceError(() => normalize({ pages }), 502)
  })

  test("does not inherit image-less e-text pages into the exact faksimil arm", () => {
    expectSourceError(() => normalizeReaderMetadata(
      payload(
        representation({ pages: undefined }),
        representation({
          mediatype: "etext",
          pages: [{ pageindex: 0, pagename: "1" }]
        })
      ),
      "https://example.test/base",
      "LagerlöfS",
      "GostaBerlingsSaga",
      "faksimil"
    ), 502)
  })
})

describe("faksimil logical sizes", () => {
  test("maps zero-based indexes to logical sizes and sorts them numerically", () => {
    const metadata = normalize()
    expect(metadata.mediaType).toBe("faksimil")
    if (metadata.mediaType !== "faksimil") throw new Error("wrong test media")

    expect(metadata.sizes).toEqual([
      { size: 1, width: 300 },
      { size: 3, width: 625 },
      { size: 5, width: 1200 }
    ])
    expect(metadata.preferredSize).toBe(3)
  })

  test.each([
    ["empty sizes", []],
    ["duplicate indexes", [0, 0]],
    ["negative index", [-1]],
    ["out-of-range index", [5]],
    ["non-integer index", [1.5]]
  ])("rejects %s", (_label, faksimilSizes) => {
    expectSourceError(() => normalize({ faksimil_sizes: faksimilSizes }), 502)
  })

  test.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN, "625"])(
    "rejects non-positive or non-finite advertised width %s",
    width => {
      expectSourceError(() => normalize({
        faksimil_sizes: [2],
        width: { size_3: width }
      }), 502)
    }
  )

  test("prefers size 3, then the closest lower size, then the smallest higher size", () => {
    expect(preferredFacsimileSize([
      { size: 1, width: 100 },
      { size: 3, width: 300 },
      { size: 5, width: 500 }
    ])).toBe(3)
    expect(preferredFacsimileSize([
      { size: 1, width: 100 },
      { size: 2, width: 200 },
      { size: 5, width: 500 }
    ])).toBe(2)
    expect(preferredFacsimileSize([
      { size: 4, width: 400 },
      { size: 5, width: 500 }
    ])).toBe(4)
  })
})

describe("faksimil JPEG sources", () => {
  test("RFC3986-encodes every work-id segment and pads only the image number", () => {
    expect(facsimileImageUrl).toHaveLength(3)
    expect(facsimileImageUrl(
      "lb 12/!*'()",
      3,
      27
    )).toBe(
      "/txt/lb%2012%2F%21%2A%27%28%29/" +
      "lb%2012%2F%21%2A%27%28%29_3/" +
      "lb%2012%2F%21%2A%27%28%29_3_0027.jpeg"
    )
  })

  test("builds numerically sorted sources and pairs N with N+2 at 1x/2x", () => {
    expect(buildFacsimileSources).toHaveLength(3)
    const sources = buildFacsimileSources(
      "lb1",
      9,
      [
        { size: 5, width: 1200 },
        { size: 1, width: 300 },
        { size: 3, width: 625 }
      ]
    )

    expect(sources.map(source => source.size)).toEqual([1, 3, 5])
    expect(facsimileSourcePair(sources, 3)).toEqual({
      oneX: sources[1],
      twoX: sources[2]
    })
    expect(facsimileSourcePair(sources, 5)).toEqual({
      oneX: sources[2],
      twoX: null
    })
  })
})
