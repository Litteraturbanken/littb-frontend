import type { H3Event } from "h3"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  editorCloseHref,
  fetchEditorManifest,
  fetchReaderManifest
} from "../../server/utils/work-manifest-client"
import type {
  EditorManifestResponse,
  ReaderManifestResponse
} from "../../shared/types/work-manifest"

const readerManifest = {
  alternate_media: {
    media_type: "faksimil",
    pages: [{ page_index: 0, page_name: "1" }]
  },
  author_id: "SöderbergH",
  contributors: [{
    author_id: "SöderbergH",
    full_name: "Hjalmar Söderberg",
    author_type: null,
    role: null
  }],
  declared_page_count: 2,
  display_title: "Doktor Glas",
  editor_work_id: "lb-editor-doktor-glas",
  end_page_name: "2",
  full_title: "Doktor Glas. Roman",
  has_dramawebben: false,
  has_nya_vagar: false,
  imprint_year: "1905",
  is_drama: false,
  media_type: "etext",
  page_step: 1,
  pages: [
    { page_index: 0, page_name: "1" },
    { page_index: 1, page_name: "2" }
  ],
  parts: [],
  searchable: true,
  start_page_name: "1",
  title_path: "DoktorGlas",
  urn: "urn:nbn:se:lb-lb-reader-doktor-glas",
  work_id: "lb-reader-doktor-glas"
} satisfies ReaderManifestResponse

const facsimileReaderManifest = {
  ...readerManifest,
  alternate_media: {
    media_type: "etext",
    pages: readerManifest.pages
  },
  media_type: "faksimil",
  pages: [
    { image_number: 1, page_index: 0, page_name: "1" },
    { image_number: 2, page_index: 1, page_name: "2" }
  ],
  preferred_size: 3,
  sizes: [{ size: 3, width: 625 }]
} satisfies ReaderManifestResponse

const completeManifest = {
  status: "complete",
  work_id: "lb-editor-boye",
  media_type: "faksimil",
  bounds: { kind: "dense", page_count: 9 },
  display_title: "Ett verkligt jordiskt liv. Brev",
  title_path: "EttVerkligtJordiskt",
  contributors: [
    {
      author_id: "BoyeK",
      full_name: "Karin Boye",
      author_type: null,
      role: null
    },
    {
      author_id: "HelgesonP",
      full_name: "Paulina Helgeson",
      author_type: "editor",
      role: null
    }
  ],
  pages: [
    { page_index: 0, page_name: "1" },
    { page_index: 1, page_name: "2" }
  ],
  parts: [{
    authors: [{
      author_id: "HelgesonP",
      full_name: "Paulina Helgeson",
      surname: "Helgeson"
    }],
    end_page_index: 1,
    end_page_name: "2",
    nav_title: null,
    short_title: null,
    source_index: 0,
    start_page_index: 0,
    start_page_name: "1",
    title: "Förord",
    title_id: "Förord"
  }],
  start_page_name: "1",
  end_page_name: "2",
  searchable: true,
  imprint_year: "2022",
  sizes: [{ size: 3, width: 625 }],
  public_reader_target: {
    author_id: "BoyeK",
    title_path: "EttVerkligtJordiskt",
    start_page_name: "1",
    media_type: "faksimil"
  }
} satisfies EditorManifestResponse

const boundsOnlyManifest = {
  status: "page_bounds_only",
  work_id: "lb-editor-fallback",
  media_type: "faksimil",
  bounds: { kind: "dense", page_count: 3 }
} satisfies EditorManifestResponse

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  })
}

function stubConfig(): void {
  vi.stubGlobal("useRuntimeConfig", () => ({ apiBase: "http://backend.test/v2" }))
}

function contributors(count: number): ReaderManifestResponse["contributors"] {
  return Array.from({ length: count }, (_, index) => ({
    author_id: `Author${index}`,
    full_name: `Author ${index}`,
    author_type: null,
    role: null
  }))
}

function partAuthors(count: number): typeof completeManifest.parts[number]["authors"] {
  return Array.from({ length: count }, (_, index) => ({
    author_id: `PartAuthor${index}`,
    full_name: `Part Author ${index}`,
    surname: `Surname${index}`
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("generated Reader manifest client", () => {
  test("preserves a valid Reader manifest", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(readerManifest)))
    stubConfig()

    const manifest = await fetchReaderManifest(
      {} as H3Event,
      "SöderbergH",
      "DoktorGlas",
      "etext"
    )

    expect(manifest).toEqual(readerManifest)
  })

  test.each([
    ["a later route author and the same contributor in distinct roles", {
      ...readerManifest,
      contributors: [
        {
          author_id: "BoyeK",
          full_name: "Karin Boye",
          author_type: null,
          role: null
        },
        ...readerManifest.contributors,
        {
          ...readerManifest.contributors[0],
          role: "translator"
        }
      ]
    }, "SöderbergH", "DoktorGlas", "etext"],
    ["inclusive scalar and facsimile-width maxima", {
      ...facsimileReaderManifest,
      declared_page_count: 100_000,
      display_title: "D".repeat(2_000),
      full_title: "F".repeat(2_000),
      imprint_year: "1".repeat(100),
      page_step: 100_000,
      pages: [{ image_number: 99_999, page_index: 99_999, page_name: "1" }],
      start_page_name: "1",
      end_page_name: "1",
      sizes: [{ size: 3, width: 10_000 }]
    }, "SöderbergH", "DoktorGlas", "faksimil"],
    ["the contributor collection maximum", {
      ...readerManifest,
      author_id: "Author99",
      contributors: contributors(100)
    }, "Author99", "DoktorGlas", "etext"],
    ["100-code-point identifiers and text", {
      ...readerManifest,
      author_id: "𐐷".repeat(100),
      contributors: [{
        author_id: "𐐷".repeat(100),
        full_name: "𐐷".repeat(100),
        author_type: null,
        role: null
      }],
      editor_work_id: "E".repeat(100),
      pages: [{ page_index: 0, page_name: "𐐷".repeat(100) }],
      start_page_name: "𐐷".repeat(100),
      end_page_name: "𐐷".repeat(100),
      title_path: "T".repeat(100),
      urn: "U".repeat(100),
      work_id: "W".repeat(100)
    }, "𐐷".repeat(100), "T".repeat(100), "etext"]
  ] as const)("preserves a valid Reader manifest with %s", async (
    _case,
    body,
    authorId,
    titlePath,
    mediaType
  ) => {
    vi.stubGlobal("fetch", vi.fn(async () => json(body)))
    stubConfig()

    await expect(fetchReaderManifest(
      {} as H3Event,
      authorId,
      titlePath,
      mediaType
    )).resolves.toEqual(body)
  })

  test("preserves the exact part-author maximum and arbitrary valid source index", async () => {
    const body = {
      ...readerManifest,
      parts: [{
        authors: partAuthors(100),
        end_page_index: 1,
        end_page_name: "2",
        nav_title: null,
        short_title: null,
        source_index: 9_999,
        start_page_index: 0,
        start_page_name: "1",
        title: "Del",
        title_id: null
      }]
    }
    vi.stubGlobal("fetch", vi.fn(async () => json(body)))
    stubConfig()

    await expect(fetchReaderManifest(
      {} as H3Event,
      "SöderbergH",
      "DoktorGlas",
      "etext"
    )).resolves.toEqual(body)
  })

  test.each([
    ["an empty object", {}],
    ["an unknown media discriminant", { ...readerManifest, media_type: "pdf" }],
    ["the wrong requested media", facsimileReaderManifest],
    ["a mismatched requested author", {
      ...readerManifest,
      author_id: "BoyeK",
      contributors: [{ ...readerManifest.contributors[0], author_id: "BoyeK" }]
    }],
    ["a mismatched requested title", { ...readerManifest, title_path: "Främlingarna" }],
    ["a missing requested contributor", {
      ...readerManifest,
      contributors: [{
        author_id: "BoyeK",
        full_name: "Karin Boye",
        author_type: null,
        role: null
      }]
    }],
    ["an exact duplicate contributor tuple", {
      ...readerManifest,
      contributors: [readerManifest.contributors[0], readerManifest.contributors[0]]
    }],
    ["more than 100 contributors", {
      ...readerManifest,
      contributors: [readerManifest.contributors[0], ...contributors(100)]
    }],
    ["an invalid contributor", { ...readerManifest, contributors: [{}] }],
    ["an empty alternate-media page collection", {
      ...readerManifest,
      alternate_media: { media_type: "faksimil", pages: [] }
    }],
    ["a missing start navigation page", {
      ...readerManifest,
      start_page_name: "missing"
    }],
    ["a missing end navigation page", {
      ...readerManifest,
      end_page_name: "missing"
    }],
    ["a page step above the inclusive maximum", {
      ...readerManifest,
      page_step: 100_001
    }],
    ["a declared page count above the inclusive maximum", {
      ...readerManifest,
      declared_page_count: 100_001
    }],
    ["an imprint year over 100 code points", {
      ...readerManifest,
      imprint_year: "1".repeat(101)
    }],
    ["an untrimmed display title", {
      ...readerManifest,
      display_title: " Doktor Glas"
    }],
    ["a display title over 2,000 code points", {
      ...readerManifest,
      display_title: "D".repeat(2_001)
    }],
    ["more than 100 part authors", {
      ...readerManifest,
      parts: [{
        authors: partAuthors(101),
        end_page_index: 1,
        end_page_name: "2",
        nav_title: null,
        short_title: null,
        source_index: 0,
        start_page_index: 0,
        start_page_name: "1",
        title: "Del",
        title_id: null
      }]
    }],
    ["a part source index at the exclusive maximum", {
      ...readerManifest,
      parts: [{
        authors: [],
        end_page_index: 1,
        end_page_name: "2",
        nav_title: null,
        short_title: null,
        source_index: 10_000,
        start_page_index: 0,
        start_page_name: "1",
        title: "Del",
        title_id: null
      }]
    }],
    ["an unsafe part title identifier", {
      ...readerManifest,
      parts: [{
        authors: [],
        end_page_index: 1,
        end_page_name: "2",
        nav_title: null,
        short_title: null,
        source_index: 0,
        start_page_index: 0,
        start_page_name: "1",
        title: "Del",
        title_id: "Del/1"
      }]
    }],
    ["an invalid page", {
      ...readerManifest,
      pages: [{ page_index: -1, page_name: "1" }]
    }],
    ["a page index at the exclusive maximum", {
      ...readerManifest,
      pages: [{ page_index: 100_000, page_name: "1" }]
    }],
    ["an invalid alternate-media page", {
      ...readerManifest,
      alternate_media: {
        media_type: "faksimil",
        pages: [{ page_index: 0, page_name: "" }]
      }
    }],
    ["a part with a mismatched page identity", {
      ...readerManifest,
      parts: [{
        authors: [],
        end_page_index: 0,
        end_page_name: "2",
        nav_title: null,
        short_title: null,
        source_index: 1,
        start_page_index: 0,
        start_page_name: "1",
        title: "Del",
        title_id: null
      }]
    }],
    ["an extra top-level field", { ...readerManifest, private: true }],
    ["an extra nested field", {
      ...readerManifest,
      contributors: [{ ...readerManifest.contributors[0], private: true }]
    }]
  ])("maps a 200 Reader manifest containing %s to invalid source", async (
    _case,
    body
  ) => {
    vi.stubGlobal("fetch", vi.fn(async () => json(body)))
    stubConfig()

    await expect(fetchReaderManifest(
      {} as H3Event,
      "SöderbergH",
      "DoktorGlas",
      "etext"
    )).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: "Invalid reader source"
    })
  })

  test.each([
    ["an identifier over 100 code points", "A".repeat(101)],
    ["a leading-space identifier", " SöderbergH"],
    ["a trailing-space identifier", "SöderbergH "],
    ["a dot identifier", "."],
    ["a parent identifier", ".."],
    ["an identifier containing a slash", "Söderberg/H"],
    ["an identifier containing a backslash", "Söderberg\\H"],
    ["an identifier containing a query delimiter", "Söderberg?H"],
    ["an identifier containing a fragment delimiter", "Söderberg#H"],
    ["an identifier containing a control character", "Söderberg\u0000H"]
  ])("rejects %s", async (_case, authorId) => {
    const body = {
      ...readerManifest,
      author_id: authorId,
      contributors: [{ ...readerManifest.contributors[0], author_id: authorId }]
    }
    vi.stubGlobal("fetch", vi.fn(async () => json(body)))
    stubConfig()

    await expect(fetchReaderManifest(
      {} as H3Event,
      authorId,
      "DoktorGlas",
      "etext"
    )).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: "Invalid reader source"
    })
  })

  test.each([
    ["page name over 100 code points", "P".repeat(101)],
    ["leading-space page name", " 1"],
    ["trailing-space page name", "1 "],
    ["control-bearing page name", "1\u0000"]
  ])("rejects a %s", async (_case, pageName) => {
    const body = {
      ...readerManifest,
      pages: [{ page_index: 0, page_name: pageName }],
      start_page_name: pageName,
      end_page_name: pageName
    }
    vi.stubGlobal("fetch", vi.fn(async () => json(body)))
    stubConfig()

    await expect(fetchReaderManifest(
      {} as H3Event,
      "SöderbergH",
      "DoktorGlas",
      "etext"
    )).rejects.toMatchObject({ statusCode: 502 })
  })

  test("rejects a facsimile width above the backend maximum", async () => {
    const body = {
      ...facsimileReaderManifest,
      sizes: [{ size: 3, width: 10_000.1 }]
    }
    vi.stubGlobal("fetch", vi.fn(async () => json(body)))
    stubConfig()

    await expect(fetchReaderManifest(
      {} as H3Event,
      "SöderbergH",
      "DoktorGlas",
      "faksimil"
    )).rejects.toMatchObject({ statusCode: 502 })
  })
})

describe("generated Editor manifest client", () => {
  test.each([
    [
      "a literal percent",
      {
        author_id: "A%2FB",
        title_path: "PercentTitle",
        start_page_name: "1",
        media_type: "etext"
      },
      "/f%C3%B6rfattare/A%252FB/titlar/PercentTitle/sida/1/etext"
    ],
    [
      "Unicode",
      {
        author_id: "SöderbergH",
        title_path: "Öppen",
        start_page_name: "första",
        media_type: "faksimil"
      },
      "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/%C3%96ppen/sida/f%C3%B6rsta/faksimil"
    ],
    [
      "spaces",
      {
        author_id: "Space Author",
        title_path: "Title Path",
        start_page_name: "first page",
        media_type: "etext"
      },
      "/f%C3%B6rfattare/Space%20Author/titlar/Title%20Path/sida/first%20page/etext"
    ]
  ] as const)("RFC3986-encodes %s in a structured Editor close target", (
    _case,
    target,
    expected
  ) => {
    expect(editorCloseHref(target)).toBe(expected)
  })

  test("returns the exact bounds-only Editor arm from the generated endpoint", async () => {
    const fetchMock = vi.fn(async () => json(boundsOnlyManifest))
    vi.stubGlobal("fetch", fetchMock)
    stubConfig()

    await expect(fetchEditorManifest(
      {} as H3Event,
      "lb-editor-fallback",
      "faksimil"
    )).resolves.toEqual(boundsOnlyManifest)
    expect(fetchMock.mock.calls[0]?.[0].url).toBe(
      "http://backend.test/v2/works/lb-editor-fallback/editor-manifest?media_type=faksimil"
    )
  })

  test("returns the complete Editor arm without copying nested transport values", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(completeManifest)))
    stubConfig()

    const manifest = await fetchEditorManifest(
      {} as H3Event,
      "lb-editor-boye",
      "faksimil"
    )

    expect(manifest.status).toBe("complete")
    if (manifest.status !== "complete") throw new Error("Expected complete Editor manifest")
    expect(manifest.contributors).toEqual(completeManifest.contributors)
    expect(manifest.parts).toEqual(completeManifest.parts)
  })

  test.each([
    ["the inclusive dense bound", {
      ...boundsOnlyManifest,
      bounds: { kind: "dense", page_count: 100_000 }
    }],
    ["the inclusive sparse index bound", {
      ...boundsOnlyManifest,
      bounds: { kind: "sparse", page_indexes: [99_999] }
    }],
    ["a complete dense manifest with no page metadata", {
      ...completeManifest,
      pages: [],
      parts: [],
      start_page_name: null,
      end_page_name: null
    }],
    ["a partial dense page collection", {
      ...completeManifest,
      pages: [{ page_index: 8, page_name: "9" }],
      parts: [],
      start_page_name: "9",
      end_page_name: "9"
    }],
    ["an exact sparse page collection", {
      ...completeManifest,
      bounds: { kind: "sparse", page_indexes: [1, 8] },
      pages: [
        { page_index: 1, page_name: "2" },
        { page_index: 8, page_name: "9" }
      ],
      parts: [],
      start_page_name: "2",
      end_page_name: "9"
    }],
    ["collection and scalar maxima", {
      ...completeManifest,
      contributors: contributors(100),
      parts: [{
        ...completeManifest.parts[0],
        authors: partAuthors(100),
        source_index: 9_999
      }],
      sizes: [{ size: 3, width: 10_000 }]
    }]
  ])("preserves an Editor manifest with %s", async (_case, body) => {
    vi.stubGlobal("fetch", vi.fn(async () => json(body)))
    stubConfig()

    await expect(fetchEditorManifest(
      {} as H3Event,
      body.work_id,
      body.media_type
    )).resolves.toEqual(body)
  })

  test.each([
    ["an empty object", {}],
    ["an unknown status discriminant", { ...completeManifest, status: "partial" }],
    ["the wrong requested media", { ...completeManifest, media_type: "etext" }],
    ["a mismatched requested work id", { ...completeManifest, work_id: "lb-editor-other" }],
    ["no complete contributors", { ...completeManifest, contributors: [] }],
    ["more than 100 complete contributors", {
      ...completeManifest,
      contributors: [completeManifest.contributors[0], ...contributors(100)]
    }],
    ["an exact duplicate contributor tuple", {
      ...completeManifest,
      contributors: [completeManifest.contributors[0], completeManifest.contributors[0]]
    }],
    ["an invalid complete contributor", { ...completeManifest, contributors: [{}] }],
    ["a missing complete start navigation page", {
      ...completeManifest,
      start_page_name: "missing"
    }],
    ["a missing complete end navigation page", {
      ...completeManifest,
      end_page_name: "missing"
    }],
    ["an invalid complete page", {
      ...completeManifest,
      pages: [{ page_index: -1, page_name: "1" }]
    }],
    ["a dense page at page count", {
      ...completeManifest,
      pages: [{ page_index: 9, page_name: "10" }],
      parts: [],
      start_page_name: "10",
      end_page_name: "10"
    }],
    ["an empty sparse page mapping", {
      ...completeManifest,
      bounds: { kind: "sparse", page_indexes: [0] },
      pages: [],
      parts: [],
      start_page_name: null,
      end_page_name: null
    }],
    ["a missing sparse page mapping", {
      ...completeManifest,
      bounds: { kind: "sparse", page_indexes: [0, 1, 2] }
    }],
    ["an extra sparse page mapping", {
      ...completeManifest,
      bounds: { kind: "sparse", page_indexes: [0] }
    }],
    ["more than 100 complete part authors", {
      ...completeManifest,
      parts: [{ ...completeManifest.parts[0], authors: partAuthors(101) }]
    }],
    ["a complete facsimile width above the maximum", {
      ...completeManifest,
      sizes: [{ size: 3, width: 10_000.1 }]
    }],
    ["an extra complete field", { ...completeManifest, private: true }],
    ["an invalid public Reader target", {
      ...completeManifest,
      public_reader_target: { author_id: "BoyeK" }
    }],
    ["zero dense page bounds", {
      ...boundsOnlyManifest,
      work_id: "lb-editor-boye",
      bounds: { kind: "dense", page_count: 0 }
    }],
    ["dense page bounds above the inclusive maximum", {
      ...boundsOnlyManifest,
      work_id: "lb-editor-boye",
      bounds: { kind: "dense", page_count: 100_001 }
    }],
    ["unsorted sparse page bounds", {
      ...boundsOnlyManifest,
      work_id: "lb-editor-boye",
      bounds: { kind: "sparse", page_indexes: [2, 1] }
    }]
  ])("maps a 200 Editor manifest containing %s to invalid source", async (
    _case,
    body
  ) => {
    vi.stubGlobal("fetch", vi.fn(async () => json(body)))
    stubConfig()

    await expect(fetchEditorManifest(
      {} as H3Event,
      "lb-editor-boye",
      "faksimil"
    )).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: "Invalid Editor source"
    })
  })

  test.each([404, 422])("maps Editor manifest %s to the public Editor 404", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: {
      code: "editor_manifest_not_found",
      message: "Editor manifest not found",
      details: null
    } }, status)))
    stubConfig()

    await expect(fetchEditorManifest(
      {} as H3Event,
      "lb-editor-missing",
      "etext"
    )).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: "Editor page not found"
    })
  })

  test("maps Editor manifest 500 and malformed success JSON to invalid source", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ error: {
        code: "internal_error",
        message: "Unexpected server error",
        details: null
      } }, 500))
      .mockResolvedValueOnce(new Response("{", {
        status: 200,
        headers: { "content-type": "application/json" }
      }))
    vi.stubGlobal("fetch", fetchMock)
    stubConfig()

    for (const workId of ["lb-editor-invalid", "lb-editor-malformed-json"]) {
      await expect(fetchEditorManifest(
        {} as H3Event,
        workId,
        "faksimil"
      )).rejects.toMatchObject({
        statusCode: 502,
        statusMessage: "Invalid Editor source"
      })
    }
  })

  test("maps Editor 503 and transport rejection to unavailable source", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ error: {
        code: "editor_manifest_unavailable",
        message: "Editor manifest unavailable",
        details: null
      } }, 503))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
    vi.stubGlobal("fetch", fetchMock)
    stubConfig()

    for (const workId of ["lb-editor-unavailable", "lb-editor-transport"]) {
      await expect(fetchEditorManifest(
        {} as H3Event,
        workId,
        "faksimil"
      )).rejects.toMatchObject({
        statusCode: 502,
        statusMessage: "Editor source unavailable"
      })
    }
  })

  test("does not convert an aborted Editor manifest request", async () => {
    const abort = new DOMException("The operation was aborted", "AbortError")
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(abort)))
    stubConfig()

    await expect(fetchEditorManifest(
      {} as H3Event,
      "lb-editor-boye",
      "faksimil"
    )).rejects.toBe(abort)
  })
})

test("Reader manifest client remains exported beside the Editor client", () => {
  expect(fetchReaderManifest).toBeTypeOf("function")
})
