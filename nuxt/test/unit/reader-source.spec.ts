import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest"

import {
  buildFacsimileSources,
  facsimileImageUrl,
  facsimileSourcePair,
  fetchReaderPageHtml,
  isReaderMediaType,
  loadReaderMetadata,
  maximumReaderEtextBytes,
  preferredFacsimileSize,
  rebaseRelativeStylesheetReferences,
  readerFacsimileMetadata,
  resolveReaderPartNavigation
} from "../../server/utils/reader-source"

import type { H3Event } from "h3"
import type {
  ReaderManifestResponse,
  WorkManifestPart
} from "../../shared/types/work-manifest"
import type { ManagedAssetHtml } from "../../shared/types/renderable-html"
import type { ReaderEtextPage } from "../../shared/types/reader"
import type { transformManagedReaderHtml } from "../../shared/utils/renderable-html"

const readerManifest = {
  alternate_media: {
    media_type: "faksimil",
    pages: [
      { page_index: 1, page_name: "-3" },
      { page_index: 4, page_name: "-2" }
    ]
  },
  author_id: "SöderbergH",
  contributors: [
    {
      author_id: "SöderbergH",
      full_name: "Hjalmar Söderberg",
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
  declared_page_count: 6,
  display_title: "Doktor Glas",
  editor_work_id: "lb-editor-doktor-glas",
  end_page_name: "-2",
  full_title: "Doktor Glas. Roman",
  has_dramawebben: true,
  has_nya_vagar: true,
  imprint_year: "1905",
  is_drama: false,
  media_type: "etext",
  page_step: 2,
  pages: [
    { page_index: 1, page_name: "-3" },
    { page_index: 4, page_name: "-2" }
  ],
  parts: [{
    authors: [{
      author_id: "SöderbergH",
      full_name: "Hjalmar Söderberg",
      surname: "Söderberg"
    }],
    end_page_index: 4,
    end_page_name: "-2",
    nav_title: "Romanen",
    short_title: null,
    source_index: 0,
    start_page_index: 1,
    start_page_name: "-3",
    title: "Doktor Glas",
    title_id: "DoktorGlas"
  }],
  searchable: true,
  start_page_name: "-3",
  title_path: "DoktorGlas",
  urn: "urn:nbn:se:lb-lb-reader-doktor-glas",
  work_id: "lb-reader-doktor-glas"
} satisfies ReaderManifestResponse

const facsimileManifest = {
  alternate_media: {
    media_type: "etext",
    pages: [{ page_index: 57, page_name: "58" }]
  },
  author_id: "AarnsethF",
  contributors: [{
    author_id: "AarnsethF",
    full_name: "Fredrik Aarnseth",
    author_type: null,
    role: null
  }],
  declared_page_count: 100,
  display_title: "Rallarliv",
  editor_work_id: null,
  end_page_name: "58",
  full_title: "Rallarliv",
  has_dramawebben: false,
  has_nya_vagar: false,
  imprint_year: null,
  is_drama: false,
  media_type: "faksimil",
  page_step: 1,
  pages: [{ image_number: 58, page_index: 57, page_name: "58" }],
  parts: [],
  preferred_size: 3,
  searchable: true,
  sizes: [
    { size: 1, width: 300 },
    { size: 3, width: 625 },
    { size: 5, width: 1200 }
  ],
  start_page_name: "58",
  title_path: "Rallarliv",
  urn: null,
  work_id: "lb3203777"
} satisfies ReaderManifestResponse

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" }
})

function stubConfig() {
  vi.stubGlobal("useRuntimeConfig", () => ({
    apiBase: "http://backend.test/v2",
    readerSourceBase: "https://assets.test/"
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("generated Reader manifest boundary", () => {
  test("passes generated faksimil sizes directly into Reader metadata", () => {
    const metadata = readerFacsimileMetadata(facsimileManifest, "https://assets.test")

    expect(metadata.sizes).toBe(facsimileManifest.sizes)
    expect(metadata.sizes).toEqual([
      { size: 1, width: 300 },
      { size: 3, width: 625 },
      { size: 5, width: 1200 }
    ])
    expect(metadata.preferredSize).toBe(3)
  })

  test("loads one typed v2 manifest and never calls legacy metadata", async () => {
    const fetchMock = vi.fn(async () => json(readerManifest))
    vi.stubGlobal("fetch", fetchMock)
    stubConfig()

    const metadata = await loadReaderMetadata(
      {} as H3Event,
      "SöderbergH",
      "DoktorGlas",
      "etext"
    )

    expect(metadata).toMatchObject({
      alternateMedia: readerManifest.alternate_media,
      author: readerManifest.contributors[0],
      base: "https://assets.test",
      contributors: readerManifest.contributors,
      declaredPageCount: 6,
      hasDramawebben: true,
      hasNyaVagar: true,
      mediaType: "etext",
      pageStep: 2,
      pages: readerManifest.pages,
      parts: readerManifest.parts,
      workId: "lb-reader-doktor-glas"
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0].url).toBe(
      "http://backend.test/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"
    )
  })

  test("carries exact faksimil page identity, sizes, and preferred size", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(facsimileManifest)))
    stubConfig()

    const metadata = await loadReaderMetadata(
      {} as H3Event,
      "AarnsethF",
      "Rallarliv",
      "faksimil"
    )

    expect(metadata.mediaType).toBe("faksimil")
    if (metadata.mediaType !== "faksimil") throw new Error("Expected faksimil metadata")
    expect(metadata.pages).toEqual([
      { image_number: 58, page_index: 57, page_name: "58" }
    ])
    expect(metadata.sizes).toEqual(facsimileManifest.sizes)
    expect(metadata.preferredSize).toBe(3)
    expect(metadata.declaredPageCount).toBe(100)
  })

  test.each([404, 422])("maps manifest %s to public Reader 404", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: {
      code: "reader_manifest_not_found",
      message: "Reader manifest not found",
      details: null
    } }, status)))
    stubConfig()

    await expect(loadReaderMetadata(
      {} as H3Event,
      "SöderbergH",
      "MissingReader",
      "etext"
    )).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: "Reader page not found"
    })
  })

  test("maps manifest 500 to invalid Reader source", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: {
      code: "internal_error",
      message: "Unexpected server error",
      details: null
    } }, 500)))
    stubConfig()

    await expect(loadReaderMetadata(
      {} as H3Event,
      "SöderbergH",
      "MalformedReader",
      "etext"
    )).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: "Invalid reader source"
    })
  })

  test("maps manifest 503 and transport rejection to unavailable source", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ error: {
        code: "reader_manifest_unavailable",
        message: "Reader manifest unavailable",
        details: null
      } }, 503))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
    vi.stubGlobal("fetch", fetchMock)
    stubConfig()

    for (const titlePath of ["UnavailableReader", "TransportReader"]) {
      await expect(loadReaderMetadata(
        {} as H3Event,
        "SöderbergH",
        titlePath,
        "etext"
      )).rejects.toMatchObject({
        statusCode: 502,
        statusMessage: "Reader source unavailable"
      })
    }
  })

  test("does not convert an aborted manifest request", async () => {
    const abort = new DOMException("The operation was aborted", "AbortError")
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(abort)))
    stubConfig()

    await expect(loadReaderMetadata(
      {} as H3Event,
      "SöderbergH",
      "DoktorGlas",
      "etext"
    )).rejects.toBe(abort)
  })

  test("rejects unknown media before runtime config or upstream IO", async () => {
    const runtimeConfig = vi.fn()
    const fetchMock = vi.fn()
    vi.stubGlobal("useRuntimeConfig", runtimeConfig)
    vi.stubGlobal("fetch", fetchMock)

    await expect(loadReaderMetadata(
      {} as H3Event,
      "SöderbergH",
      "DoktorGlas",
      "pdf"
    )).rejects.toMatchObject({ statusCode: 404 })
    expect(runtimeConfig).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("Reader part navigation", () => {
  function part(
    sourceIndex: number,
    startPageIndex: number,
    endPageIndex: number,
    startPageName = String(startPageIndex)
  ): WorkManifestPart {
    return {
      authors: [],
      end_page_index: endPageIndex,
      end_page_name: String(endPageIndex),
      nav_title: null,
      short_title: null,
      source_index: sourceIndex,
      start_page_index: startPageIndex,
      start_page_name: startPageName,
      title: `Part ${sourceIndex}`,
      title_id: null
    }
  }

  const parts = [
    part(0, 0, 4),
    part(1, 1, 2),
    part(2, 3, 4, "2"),
    part(3, 6, 7),
    part(4, 6, 8),
    part(5, 9, 10)
  ]

  test("preserves overlap, equal-start, gap, and bounded navigation", () => {
    expect(resolveReaderPartNavigation(parts, 4)).toEqual({
      currentPartIndex: 2,
      previousPartPageName: "2",
      nextPartPageName: "6"
    })
    expect(resolveReaderPartNavigation(parts, 6)).toEqual({
      currentPartIndex: 3,
      previousPartPageName: "2",
      nextPartPageName: "9"
    })
    expect(resolveReaderPartNavigation(parts, 5)).toEqual({
      currentPartIndex: null,
      previousPartPageName: "2",
      nextPartPageName: "6"
    })
  })

  test("rejects source indexes that no longer match source order", () => {
    expect(() => resolveReaderPartNavigation([part(1, 0, 1)], 0)).toThrow(RangeError)
  })
})

describe("managed Reader e-text boundary", () => {
  test("rebases quoted and unquoted stylesheet references against their source URL", () => {
    expect(rebaseRelativeStylesheetReferences(`
@import "theme/base.css" screen;
@import url('../print.css');
.quoted { src: url("../fonts/font.woff2?#iefix"); }
.unquoted { background: url(images/paper.png); }
`, "/red/css/etext.css")).toBe(`
@import "/red/css/theme/base.css" screen;
@import url('/red/print.css');
.quoted { src: url("/red/fonts/font.woff2?#iefix"); }
.unquoted { background: url(/red/css/images/paper.png); }
`)
  })

  test("leaves root, data, HTTP, protocol-relative, and hash references unchanged", () => {
    const stylesheet = `
.root { background: url('/images/root.png'); }
.data { background: url(data:image/png;base64,AAAA); }
.http { background: url(https://assets.test/image.png); }
.protocol { background: url(//assets.test/image.png); }
.hash { clip-path: url(#mask); }
@import "http://assets.test/base.css";
`
    expect(rebaseRelativeStylesheetReferences(stylesheet, "/txt/css/work.css"))
      .toBe(stylesheet)
  })

  test("uses the work stylesheet directory for /txt/css references", () => {
    expect(rebaseRelativeStylesheetReferences(
      ".work { background: url(../bilder/ornament.png); }",
      "/txt/css/lb-work-etext.css"
    )).toBe(".work { background: url(/txt/bilder/ornament.png); }")
  })

  test("rebases resource tokens without rewriting strings or comments that display CSS text", () => {
    expect(rebaseRelativeStylesheetReferences(`
.url-label::before { content: "url(../labels/help.png)"; }
.import-label::before { content: '@import "theme/base.css"'; }
.escaped::before { content: "quoted \\"url(../still-text.png)\\""; }
/* url(../comments/help.png) and @import "comments/base.css" */
.resource { background: url(../images/paper.png); }
@import "theme/base.css" screen;
`, "/red/css/reader/main.css")).toBe(`
.url-label::before { content: "url(../labels/help.png)"; }
.import-label::before { content: '@import "theme/base.css"'; }
.escaped::before { content: "quoted \\"url(../still-text.png)\\""; }
/* url(../comments/help.png) and @import "comments/base.css" */
.resource { background: url(/red/css/images/paper.png); }
@import "/red/css/reader/theme/base.css" screen;
`)
  })

  test("retains the Reader authority through the DTO and marker path", () => {
    expectTypeOf<string>().not.toMatchTypeOf<ReaderEtextPage["html"]>()
    expectTypeOf<ManagedAssetHtml<"home-editorial">>()
      .not.toMatchTypeOf<ReaderEtextPage["html"]>()
    expectTypeOf<ReaderEtextPage["html"]>()
      .toEqualTypeOf<Parameters<typeof transformManagedReaderHtml>[0]>()
  })

  test("requests the exact bounded HTML asset and preserves decoded text", async () => {
    const source = `a\u00adb${"x".repeat(maximumReaderEtextBytes - 4)}`
    const response = new Response(source, {
      headers: {
        "content-length": String(maximumReaderEtextBytes),
        "content-type": "text/html; charset=utf-8"
      }
    })
    Object.defineProperty(response, "url", {
      value: "https://assets.test/txt/lb%20reader/res_00004.html?username=app"
    })
    const fetchMock = vi.fn<typeof fetch>(async () => response)
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchReaderPageHtml(
      "https://assets.test",
      "lb reader",
      4
    )).resolves.toBe(source)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://assets.test/txt/lb%20reader/res_00004.html?username=app",
      { redirect: "follow" }
    )
  })

  test("rejects an oversized declared Content-Length", async () => {
    const response = new Response("small", {
      headers: {
        "content-length": String(maximumReaderEtextBytes + 1),
        "content-type": "text/html"
      }
    })
    Object.defineProperty(response, "url", {
      value: "https://assets.test/txt/work/res_00001.html?username=app"
    })
    vi.stubGlobal("fetch", vi.fn(async () => response))

    await expect(fetchReaderPageHtml(
      "https://assets.test",
      "work",
      1
    )).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: "Reader source unavailable"
    })
  })

  test("rejects streamed body bytes above the exact byte budget", async () => {
    const response = new Response("x".repeat(maximumReaderEtextBytes + 1), {
      headers: { "content-type": "text/html" }
    })
    Object.defineProperty(response, "url", {
      value: "https://assets.test/txt/work/res_00001.html?username=app"
    })
    vi.stubGlobal("fetch", vi.fn(async () => response))

    await expect(fetchReaderPageHtml(
      "https://assets.test",
      "work",
      1
    )).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: "Reader source unavailable"
    })
  })
})

describe("faksimil assets", () => {
  test("accepts only exact Reader media and preserves preferred-size policy", () => {
    expect(isReaderMediaType("etext")).toBe(true)
    expect(isReaderMediaType("faksimil")).toBe(true)
    expect(isReaderMediaType("pdf")).toBe(false)
    expect(preferredFacsimileSize([
      { size: 1, width: 100 },
      { size: 2, width: 200 },
      { size: 5, width: 500 }
    ])).toBe(2)
  })

  test("RFC3986-encodes work IDs and keeps JPEG image number separate", () => {
    expect(facsimileImageUrl("lb 12/!*'()", 3, 27)).toBe(
      "/txt/lb%2012%2F%21%2A%27%28%29/" +
      "lb%2012%2F%21%2A%27%28%29_3/" +
      "lb%2012%2F%21%2A%27%28%29_3_0027.jpeg"
    )
  })

  test("builds sorted sources and pairs N with N+2", () => {
    const sources = buildFacsimileSources("lb1", 9, [
      { size: 5, width: 1200 },
      { size: 1, width: 300 },
      { size: 3, width: 625 }
    ])
    expect(sources.map(source => source.size)).toEqual([1, 3, 5])
    expect(facsimileSourcePair(sources, 3)).toEqual({
      oneX: sources[1],
      twoX: sources[2]
    })
  })
})
