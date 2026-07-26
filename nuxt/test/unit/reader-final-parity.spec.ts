import { describe, expect, test } from "vitest"

import { parseReaderOcrOverlay } from "../../server/utils/reader-ocr"
import { normalizeReaderMetadata } from "../../server/utils/reader-source"

function normalizeKeyword(keyword: unknown) {
  return normalizeReaderMetadata({
    hits: 1,
    data: [{
      authors: [{ authorid: "SöderbergH", full_name: "Hjalmar Söderberg" }],
      endpagename: "-1",
      keyword,
      lbworkid: "lb-reader-nya-vagar",
      mediatype: "etext",
      pages: [
        { pagename: "-2", pageindex: 2 },
        { pagename: "-1", pageindex: 3 }
      ],
      parts: [],
      searchable: true,
      shorttitle: "Nya vägar Reader",
      startpagename: "-2",
      title: "Nya vägar Reader",
      titlepath: "NyaVagarReader"
    }]
  }, "http://source.invalid", "SöderbergH", "NyaVagarReader", "etext")
}

describe("Reader final normal-parity metadata", () => {
  test("derives Nya vägar eligibility only from exact legacy keyword 1800", () => {
    expect(normalizeKeyword(["1800"])).toMatchObject({ hasNyaVagar: true })

    for (const keyword of [
      undefined,
      null,
      [],
      ["1800-tal"],
      [1800],
      "1800"
    ]) {
      expect(normalizeKeyword(keyword)).toMatchObject({ hasNyaVagar: false })
    }
  })

  test("accepts bounded OCR coordinates while removing active and unknown markup", () => {
    const overlay = parseReaderOcrOverlay(`
      <body><div data-size="625x900" id="root" onclick="alert(1)" class="parent unsafe"
        style="position:absolute;left:20px;width:625px;background:url(javascript:alert(1))">
        <div class="parent unsafe" style="top:30px;position:absolute">
          <span id="w1_147" class="w unsafe" onclick="alert(1)"
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
    expect(overlay?.html).toContain('id="w1_147"')
    expect(overlay?.html).toContain("left: 20px")
    expect(overlay?.html).not.toMatch(/script|onclick|javascript|unsafe|<a|bad id|id="root"|background|color/iu)
  })

  test.each([
    "",
    "<body></body>",
    "<body><div>missing size</div></body>",
    '<body><div data-size="0x900">zero</div></body>',
    '<body><div data-size="625x10001">too large</div></body>',
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
