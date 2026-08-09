import { afterEach, describe, expect, test, vi } from "vitest"

import {
  fetchReaderOcrOverlay,
  parseReaderOcrOverlay
} from "../../server/utils/reader-ocr"
import { readerManifestPartAuthorLabel } from "../../shared/utils/reader-author"

const maximumReaderOcrBytes = 512 * 1024

function ocrResponse(
  body: BodyInit | null,
  finalUrl: string,
  headers: HeadersInit = { "content-type": "text/html" }
): Response {
  const response = new Response(body, { headers })
  Object.defineProperty(response, "url", { value: finalUrl })
  return response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Reader final normal-parity assets", () => {
  test("uses generated nullable part-author names as display fallbacks only", () => {
    const author = {
      author_id: "MissingSummaryAuthor",
      full_name: null,
      surname: null
    }
    expect(readerManifestPartAuthorLabel(author, false)).toBe("MissingSummaryAuthor")
    expect(readerManifestPartAuthorLabel(author, true)).toBe("MissingSummaryAuthor")
    expect(author).toEqual({
      author_id: "MissingSummaryAuthor",
      full_name: null,
      surname: null
    })
  })

  test("accepts bounded OCR coordinates while removing active and unknown markup", () => {
    const overlay = parseReaderOcrOverlay(`
      <body><div data-size="625x900" id="root" onclick="alert(1)" class="parent unsafe"
        style="position:absolute;left:20px;width:625px;background:url(javascript:alert(1))">
        <div class="parent unsafe" style="top:30px;position:absolute">
          <span id="w3_147" class="w unsafe" onclick="alert(1)"
            style="left:4px;top:5px;font-size:12px;color:red">OCR fixture</span>
          <span id="bad id" class="w">invalid id</span>
          <script>alert(1)</script><a href="javascript:alert(1)">unsafe</a>
        </div>
      </div></body>
    `)

    expect(overlay).toMatchObject({ height: 900, width: 625 })
    expect(overlay?.html).toContain("OCR fixture")
    expect(overlay?.html).toContain('data-size="625x900"')
    expect(overlay?.html).toContain('class="parent"')
    expect(overlay?.html).toContain('class="w"')
    expect(overlay?.html).toContain('id="w3_147"')
    expect(overlay?.html).toContain("left: 20px")
    expect(overlay?.html).not.toMatch(
      /script|onclick|javascript|unsafe|<a|bad id|id="root"|background|color/iu
    )
  })

  test.each([
    "",
    "<body></body>",
    "<body><div>missing size</div></body>",
    '<body><div data-size="0x900">zero</div></body>',
    '<body><div data-size="625x10001">too large</div></body>'
  ])("rejects malformed OCR roots: %s", source => {
    expect(parseReaderOcrOverlay(source)).toBeNull()
  })

  test("accepts bounded decimal dimensions emitted by production OCR overlays", () => {
    expect(parseReaderOcrOverlay(
      '<div data-size="469.000000x646.500000"><span id="w355_145">kyrka</span></div>'
    )).toMatchObject({ width: 469, height: 646.5 })
  })

  test("rejects oversized OCR source bodies", () => {
    expect(parseReaderOcrOverlay("x".repeat(512 * 1024 + 1))).toBeNull()
  })
})

describe("Reader OCR managed transport", () => {
  test("accepts an exact-boundary UTF-8 overlay from the exact HTML asset", async () => {
    const prefix = '<div data-size="625x900"><span class="w">å'
    const suffix = "</span></div>"
    const fixedBytes = new TextEncoder().encode(`${prefix}${suffix}`).byteLength
    const source = `${prefix}${"x".repeat(maximumReaderOcrBytes - fixedBytes)}${suffix}`
    const response = ocrResponse(
      source,
      "https://assets.test/txt/lb%20work/ocr_00004.html",
      {
        "content-length": String(maximumReaderOcrBytes),
        "content-type": "text/html; charset=utf-8"
      }
    )
    const fetchMock = vi.fn<typeof fetch>(async () => response)
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchReaderOcrOverlay(
      "https://assets.test",
      "lb work",
      4
    )).resolves.toMatchObject({ width: 625, height: 900 })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://assets.test/txt/lb%20work/ocr_00004.html",
      { redirect: "follow" }
    )
  })

  test("cancels an unread body whose declared length exceeds the byte limit", async () => {
    const cancel = vi.fn()
    const response = ocrResponse(new ReadableStream<Uint8Array>({ cancel }),
      "https://assets.test/txt/work/ocr_00001.html", {
        "content-length": String(maximumReaderOcrBytes + 1),
        "content-type": "text/html"
      })
    vi.stubGlobal("fetch", vi.fn(async () => response))

    await expect(fetchReaderOcrOverlay(
      "https://assets.test",
      "work",
      1
    )).resolves.toBeNull()
    expect(cancel).toHaveBeenCalledOnce()
  })

  test("cancels a streamed body immediately after it crosses the byte limit", async () => {
    const cancel = vi.fn()
    const response = ocrResponse(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(maximumReaderOcrBytes))
        controller.enqueue(new Uint8Array(1))
      },
      cancel
    }), "https://assets.test/txt/work/ocr_00001.html")
    vi.stubGlobal("fetch", vi.fn(async () => response))

    await expect(fetchReaderOcrOverlay(
      "https://assets.test",
      "work",
      1
    )).resolves.toBeNull()
    expect(cancel).toHaveBeenCalledOnce()
  })

  test.each([
    [
      "a non-HTML content type",
      "https://assets.test/txt/work/ocr_00001.html",
      "application/json"
    ],
    [
      "a different final path",
      "https://assets.test/txt/work/ocr_00002.html",
      "text/html"
    ],
    [
      "a different final origin",
      "https://other.test/txt/work/ocr_00001.html",
      "text/html"
    ]
  ])("rejects and cancels %s", async (_case, finalUrl, contentType) => {
    const cancel = vi.fn()
    const response = ocrResponse(new ReadableStream<Uint8Array>({ cancel }), finalUrl, {
      "content-type": contentType
    })
    vi.stubGlobal("fetch", vi.fn(async () => response))

    await expect(fetchReaderOcrOverlay(
      "https://assets.test",
      "work",
      1
    )).resolves.toBeNull()
    expect(cancel).toHaveBeenCalledOnce()
  })
})
