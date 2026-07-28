import { describe, expect, test } from "vitest"

import { parseReaderOcrOverlay } from "../../server/utils/reader-ocr"
import { readerManifestPartAuthorLabel } from "../../shared/utils/reader-author"

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
