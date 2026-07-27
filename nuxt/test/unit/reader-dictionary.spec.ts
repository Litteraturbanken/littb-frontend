import { parseHTML } from "linkedom"
import { describe, expect, it } from "vitest"

import {
  readerWordFromTarget,
  sanitizeDictionaryArticle,
  selectedReaderWord
} from "../../app/lib/reader-dictionary"

describe("reader dictionary", () => {
  it("keeps inert SO markup while dropping active content and attributes", () => {
    const html = sanitizeDictionaryArticle(
      '<lemma id="safe" onclick="bad()"><grundform>hund</grundform>' +
      '<lexem><def>ett djur</def></lexem><script>alert(1)</script>' +
      '<a href="https://evil.invalid">länk</a></lemma>'
    )

    expect(html).toContain("<lemma><grundform>hund</grundform>")
    expect(html).toContain("<def>ett djur</def>")
    expect(html).not.toContain("onclick")
    expect(html).not.toContain("script")
    expect(html).not.toContain("href")
  })

  it("accepts exactly one bounded word selected inside the same Reader word", () => {
    const { document } = parseHTML(
      '<section class="reader_main"><span class="w">hund</span> katt</section>'
    )
    const word = document.querySelector(".w")!
    const selection = {
      getRangeAt: () => ({
        endContainer: word.firstChild,
        startContainer: word.firstChild
      }),
      isCollapsed: false,
      rangeCount: 1,
      toString: () => "hund"
    } as unknown as Selection

    expect(selectedReaderWord(selection, document.querySelector(".reader_main")!)).toEqual({
      element: word,
      word: "hund"
    })
  })

  it("recovers one bounded word from a nested Reader word target", () => {
    const { document } = parseHTML(
      '<section class="reader_main"><span class="w"><span id="ocr"> verkligt </span></span></section>'
    )
    const root = document.querySelector(".reader_main")!
    const word = document.querySelector<HTMLElement>(".w")!

    expect(readerWordFromTarget(document.querySelector("#ocr"), root)).toEqual({
      element: word,
      word: "verkligt"
    })
  })

  it.each([
    ["outside the Reader", '<span class="w"><span id="target">hund</span></span>'],
    ["a multi-word Reader target", '<section class="reader_main"><span class="w"><span id="target">två ord</span></span></section>'],
    ["a control-character Reader target", '<section class="reader_main"><span class="w"><span id="target">hu\u0007nd</span></span></section>'],
    ["a C1-control Reader target", '<section class="reader_main"><span class="w"><span id="target">hu\u0080nd</span></span></section>'],
    ["an overlong Reader target", `<section class="reader_main"><span class="w"><span id="target">${"x".repeat(101)}</span></span></section>`],
    ["an interactive Reader target", '<section class="reader_main"><span class="w"><a id="target">hund</a></span></section>']
  ])("rejects %s", (_name, markup) => {
    const { document } = parseHTML(markup)
    const root = document.querySelector(".reader_main")
      ?? document.createElement("section")

    expect(readerWordFromTarget(document.querySelector("#target"), root)).toBeNull()
  })
})
