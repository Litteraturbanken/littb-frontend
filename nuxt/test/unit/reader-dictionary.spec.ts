import { readFileSync } from "node:fs"

import { parseHTML } from "linkedom"
import { describe, expect, it } from "vitest"

import {
  readerWordFromTarget,
  sanitizeDictionaryArticle,
  selectedReaderWord
} from "../../app/lib/reader-dictionary"

const lookupSource = readFileSync(
  new URL("../../app/components/reader/ReaderDictionaryLookup.vue", import.meta.url),
  "utf8"
)
const dialogSource = readFileSync(
  new URL("../../app/components/reader/ReaderDictionaryDialog.vue", import.meta.url),
  "utf8"
)
const stylesSource = readFileSync(
  new URL("../../app/assets/styles/nuxt.scss", import.meta.url),
  "utf8"
)

describe("reader dictionary", () => {
  it("selects the validated embed path without removing the legacy lookup path", () => {
    expect(lookupSource).toContain("readerDictionaryMode")
    expect(lookupSource).toContain('if (mode === "embed")')
    expect(lookupSource).toContain("embed.start(selected.word)")
    expect(lookupSource).toContain("lookupLegacy(selected.word)")
    expect(lookupSource).toContain("Slå upp ${indicator.word} i SO och SAOB")
    expect(lookupSource).toContain("Slå upp ${indicator.word} i Svensk ordbok")
  })

  it("keeps a failed embed attempt reachable without trusting its rejected origin", () => {
    expect(lookupSource).toContain("const embedAttemptWord = ref<string | null>(null)")
    expect(lookupSource).toContain("embedAttemptWord.value = selected.word")
    expect(lookupSource).toContain('const safeSvenskaOrigin = "https://svenska.se"')
    expect(lookupSource).toContain("buildSvenskaDictionaryUrl(safeSvenskaOrigin, word)")
    expect(dialogSource).toContain("session: EmbedSession | null")
    expect(dialogSource).toContain('v-if="props.session"')
  })

  it("renders the authenticated embed session with accessible fallback states", () => {
    expect(dialogSource).toContain('mode: "legacy"')
    expect(dialogSource).toContain('mode: "embed"')
    expect(dialogSource).toContain('sandbox="allow-scripts allow-same-origin"')
    expect(dialogSource).toContain('referrerpolicy="origin"')
    expect(dialogSource).toContain("Slå upp ${props.word} i SO och SAOB")
    expect(dialogSource).toContain('role="status"')
    expect(dialogSource).toContain("Hittade inget uppslag")
    expect(dialogSource).toContain("Ordboken kunde inte laddas")
    expect(dialogSource).toContain(":href=\"props.fullSiteUrl\"")
    expect(dialogSource).toContain(':initial-focus="closeButton"')
    expect(stylesSource).toContain("min(72vh, 760px)")
  })

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
