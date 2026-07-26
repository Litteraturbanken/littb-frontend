import { describe, expect, test } from "vitest"

import { sanitizeEditorEtextHtml } from "../../server/utils/editor-reader-html"

describe("Editor Reader e-text sanitizer", () => {
  test("preserves Reader typography and illustration markup", () => {
    expect(sanitizeEditorEtextHtml(`
      <div class="pname" pname="-2">
        <h1 id="title"><em>Doktor Glas</em></h1>
        <img class="graphicimg" src="/bilder/ornament.png" alt="">
      </div>
    `)).toContain('<img class="graphicimg" src="/bilder/ornament.png" alt="">')
  })

  test("removes active content, event handlers, and unsafe URLs", () => {
    const sanitized = sanitizeEditorEtextHtml(`
      <div onclick="alert(1)"><script>alert(1)</script>
        <a href="javascript:alert(1)" target="popup">text</a>
        <img src="data:text/html,unsafe" onerror="alert(1)">
      </div>
    `)

    expect(sanitized).toContain("text")
    expect(sanitized).not.toMatch(/script|onclick|onerror|javascript:|data:/iu)
  })

  test("fails closed for empty and oversized sources", () => {
    expect(sanitizeEditorEtextHtml("")).toBeNull()
    expect(sanitizeEditorEtextHtml("x".repeat(2 * 1024 * 1024 + 1))).toBeNull()
  })
})
