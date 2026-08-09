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
    ["an empty object", {}],
    ["an unknown media discriminant", { ...readerManifest, media_type: "pdf" }],
    ["the wrong requested media", facsimileReaderManifest],
    ["a mismatched requested author", {
      ...readerManifest,
      author_id: "BoyeK",
      contributors: [{ ...readerManifest.contributors[0], author_id: "BoyeK" }]
    }],
    ["a mismatched requested title", { ...readerManifest, title_path: "Främlingarna" }],
    ["an invalid contributor", { ...readerManifest, contributors: [{}] }],
    ["an invalid page", {
      ...readerManifest,
      pages: [{ page_index: -1, page_name: "1" }]
    }],
    ["an invalid alternate-media page", {
      ...readerManifest,
      alternate_media: {
        media_type: "faksimil",
        pages: [{ page_index: 0, page_name: "" }]
      }
    }],
    ["an invalid part", {
      ...readerManifest,
      parts: [{
        authors: [],
        end_page_index: 0,
        end_page_name: "1",
        nav_title: null,
        short_title: null,
        source_index: 1,
        start_page_index: 0,
        start_page_name: "1",
        title: "Del",
        title_id: null
      }]
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
    ["an empty object", {}],
    ["an unknown status discriminant", { ...completeManifest, status: "partial" }],
    ["the wrong requested media", { ...completeManifest, media_type: "etext" }],
    ["a mismatched requested work id", { ...completeManifest, work_id: "lb-editor-other" }],
    ["an invalid complete contributor", { ...completeManifest, contributors: [{}] }],
    ["an invalid complete page", {
      ...completeManifest,
      pages: [{ page_index: -1, page_name: "1" }]
    }],
    ["an invalid public Reader target", {
      ...completeManifest,
      public_reader_target: { author_id: "BoyeK" }
    }],
    ["zero dense page bounds", {
      ...boundsOnlyManifest,
      work_id: "lb-editor-boye",
      bounds: { kind: "dense", page_count: 0 }
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
