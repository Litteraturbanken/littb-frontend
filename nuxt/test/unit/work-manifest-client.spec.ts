import type { H3Event } from "h3"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  editorCloseHref,
  fetchEditorManifest,
  fetchReaderManifest
} from "../../server/utils/work-manifest-client"
import type { EditorManifestResponse } from "../../shared/types/work-manifest"

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
