import { describe, expect, test } from "vitest"

import {
  markEditorEtextHtml,
  markReaderOcrHtml,
  markReaderSearchOcrHtml
} from "../../app/lib/search-hit-highlight"
import {
  issueEditorEtextHtml,
  issueReaderOcrHtml
} from "../../shared/utils/renderable-html"

describe("markEditorEtextHtml", () => {
  const source = issueEditorEtextHtml(
    '<p><span id="w1" class="w keep">One</span> <span id="w2" class="w">Two</span> '
    + '<span id="w3" class="w last">Three</span><em data-probe="kept">tail</em></p>'
  )

  test.each([
    ["missing start", "missing", "w3"],
    ["missing end", "w1", "missing"],
    ["reversed bounds", "w3", "w1"]
  ])("keeps every byte unchanged for %s", (_label, fromWordId, toWordId) => {
    expect(markEditorEtextHtml(source, fromWordId, toWordId)).toBe(source)
  })

  test("marks the exact contiguous span range with alternating flip classes", () => {
    expect(markEditorEtextHtml(source, "w1", "w3")).toBe(
      '<p><span id="w1" class="w keep markee">One</span> '
      + '<span id="w2" class="w markee flip">Two</span> '
      + '<span id="w3" class="w last markee">Three</span>'
      + '<em data-probe="kept">tail</em></p>'
    )
  })

  test("uses the last matching end span and preserves markup outside the range", () => {
    const repeated = issueEditorEtextHtml(
      '<section><span id="from" class="w">A</span><span id="to" class="w old">B</span>'
      + '<strong>middle</strong><span id="to" class="w">C</span><i>tail</i></section>'
    )

    expect(markEditorEtextHtml(repeated, "from", "to")).toBe(
      '<section><span id="from" class="w markee">A</span>'
      + '<span id="to" class="w old markee flip">B</span>'
      + '<strong>middle</strong><span id="to" class="w markee">C</span>'
      + '<i>tail</i></section>'
    )
  })

  test("marks OCR HTML with the same exact contiguous class semantics", () => {
    const overlay = issueReaderOcrHtml(
      '<div data-size="625x900"><span id="w1" class="w keep">One</span>'
      + '<span id="w2" class="w">Two</span></div>'
    )

    expect(markReaderOcrHtml(overlay, "w1", "w2")).toBe(
      '<div data-size="625x900"><span id="w1" class="w keep markee">One</span>'
      + '<span id="w2" class="w markee flip">Two</span></div>'
    )
  })

  test("keeps Reader OCR bytes unchanged when the search hit belongs to another page", () => {
    const overlay = issueReaderOcrHtml('<div><span id="w1" class="w">One</span></div>')

    expect(markReaderSearchOcrHtml(overlay, {
      fromWordId: "w1",
      hitPageIndex: 4,
      hitPageName: "5",
      pageIndex: 5,
      pageName: "6",
      toWordId: "w1"
    })).toBe(overlay)
  })

  test("marks complete contiguous visible duplicate groups in Reader OCR", () => {
    const overlay = issueReaderOcrHtml(
      '<div><span id="from" class="w">A</span><span id="from" class="w keep">B</span>'
      + '<i>middle</i><span id="to" class="w">C</span><span id="to" class="w">D</span>'
      + "<strong>tail</strong></div>"
    )

    expect(markReaderSearchOcrHtml(overlay, {
      fromWordId: "from",
      hitPageIndex: 4,
      hitPageName: "5",
      pageIndex: 4,
      pageName: "5",
      toWordId: "to"
    })).toBe(
      '<div><span id="from" class="w markee">A</span>'
      + '<span id="from" class="w keep markee flip">B</span><i>middle</i>'
      + '<span id="to" class="w markee">C</span>'
      + '<span id="to" class="w markee flip">D</span><strong>tail</strong></div>'
    )
  })

  test.each([
    ["hidden", ' hidden=""', "visible"],
    ["aria-hidden", ' aria-hidden="true"', "visible"],
    ["empty text", "", "   "]
  ])("rejects a Reader OCR duplicate group with a %s member", (_label, attribute, text) => {
    const overlay = issueReaderOcrHtml(
      `<div><span id="from" class="w">A</span><span id="from" class="w"${attribute}>`
      + `${text}</span><span id="to" class="w">C</span></div>`
    )

    expect(markReaderSearchOcrHtml(overlay, {
      fromWordId: "from",
      hitPageIndex: 4,
      hitPageName: "5",
      pageIndex: 4,
      pageName: "5",
      toWordId: "to"
    })).toBe(overlay)
  })
})
