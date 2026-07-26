import { parseHTML } from "linkedom"
import { describe, expect, it } from "vitest"

import {
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
})
