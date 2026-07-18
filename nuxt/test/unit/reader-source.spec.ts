import { afterEach, describe, expect, test, vi } from "vitest"

import {
  buildFacsimileSources,
  facsimileImageUrl,
  facsimileSourcePair,
  isReaderMediaType,
  loadReaderMetadata,
  normalizeReaderMetadata,
  preferredFacsimileSize
} from "../../server/utils/reader-source"

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
      mediaType: "faksimil",
      titlePath: "GostaBerlingsSaga",
      workId: "lb 12/!*'()"
    })
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
    ]],
    ["duplicate image number", [
      { imagenumber: 1, pageindex: 0, pagename: "1" },
      { imagenumber: 1, pageindex: 1, pagename: "2" }
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
