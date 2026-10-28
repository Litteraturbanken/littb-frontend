import { describe, expect, test, vi } from "vitest"
import { DomUtils, parseDocument } from "htmlparser2"
import { createCommentVNode, Fragment, h } from "vue"
import { renderToString } from "vue/server-renderer"
import { fetchReaderPageHtml, normalizeReaderPageHtml } from "../../server/utils/reader-source"

const publishedTitlePage = '<div class="pname" pname="3"><div class="title">Fadershuset</div><div class="tryckortssida _div1"/></div>'

describe("published Reader etext HTML", () => {
  test("normalizes empty non-void tokens without changing other source bytes", () => {
    const input = '<DIV data-label="quoted /> text" id="page"/><p /><span>Text &amp; \u00ad</span><!-- <div/> --><script>const sample = "<div/>";</script><style>.x::after { content: "<span/>"; }</style>'
    expect(normalizeReaderPageHtml(input)).toBe('<DIV data-label="quoted /> text" id="page"></DIV><p ></p><span>Text &amp; \u00ad</span><!-- <div/> --><script>const sample = "<div/>";</script><style>.x::after { content: "<span/>"; }</style>')
  })

  test("does not mistake an unquoted attribute slash for a self-closing token", () => {
    expect(normalizeReaderPageHtml('<div id=page/>')).toBe('<div id=page/>')
    expect(normalizeReaderPageHtml('<div id=page/ />')).toBe('<div id=page/ ></div>')
  })

  test.each(["script", "style", "title", "textarea", "xmp", "iframe", "noembed", "noframes", "noscript"])("preserves literal %s content", tag => {
    const input = `<${tag}><div title="quoted />"/></${tag}><p/>`
    expect(normalizeReaderPageHtml(input)).toBe(`<${tag}><div title="quoted />"/></${tag}><p></p>`)
  })

  test("preserves plaintext through EOF even after a literal closing tag", () => {
    const input = '<plaintext><div/></plaintext><p/>'
    expect(normalizeReaderPageHtml(input)).toBe(input)
  })

  test("preserves HTML void tags and foreign case-sensitive markup", () => {
    const input = '<br/><img src="scan.jpeg"/><hr/><basefont/><command/><frame/><isindex/><keygen/><svg viewBox="0 0 1 1"><linearGradient id="CaseSensitive"/><path d="M0 0"/></svg><math><mi/></math><div/>'
    expect(normalizeReaderPageHtml(input)).toBe(input.slice(0, -6) + '<div></div>')
  })

  test("keeps SSR fragment markers and following navigation outside etext", async () => {
    const render = (html: string) => renderToString(h("main", [
      h(Fragment, [h("div", { class: "etext", innerHTML: html }), h(Fragment, []), createCommentVNode()]),
      h("aside", { id: "reader-navigation" }, "Next page")
    ]))
    const parse = async (html: string) => {
      const tree = parseDocument(await render(html))
      const content = DomUtils.findOne(node => node.attribs.class === "etext", tree.children, true)!
      const navigation = DomUtils.findOne(node => node.attribs.id === "reader-navigation", tree.children, true)!
      return { content, navigation }
    }
    // Reproduce the actual browser parsing defect in the original SSR shape.
    const broken = await parse(publishedTitlePage)
    expect(broken.navigation.parent).toBe(broken.content)
    expect(broken.content.children.some(node => node.type === "comment")).toBe(true)
    const response = new Response(publishedTitlePage, { headers: { "content-type": "text/html" } })
    Object.defineProperty(response, "url", { value: "https://assets.test/txt/work/res_00003.html?username=app" })
    vi.stubGlobal("fetch", vi.fn(async () => response))
    try {
      const corrected = await parse(await fetchReaderPageHtml("https://assets.test", "work", 3))
      expect(corrected.navigation.parent).toBe(corrected.content.parent)
      expect(corrected.content.children.some(node => node.type === "comment")).toBe(false)
      expect(DomUtils.textContent(corrected.content)).toBe("Fadershuset")
    } finally { vi.unstubAllGlobals() }
  })
})
