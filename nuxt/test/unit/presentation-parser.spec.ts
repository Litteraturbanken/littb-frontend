import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

import {
  parseBackgroundRules,
  parsePresentationDocument,
  selectBackgroundRule,
  validatePresentationSegments
} from "../../app/pages/presentationer/presentation-parser"

const fixtureRoot = new URL("../fixtures/presentation-content/", import.meta.url)
function encodeLayers(value: string, layers: number) {
  for (let layer = 0; layer < layers; layer += 1) value = encodeURIComponent(value)
  return value
}

describe("Presentation XHTML parser", () => {
  test("extracts the active body and head assets without executable wrappers", () => {
    const source = `<!doctype html>
      <html><head>
        <title>Upstream title</title>
        <meta name="description" content="Upstream description">
        <link rel="stylesheet" href="app/style/article.css">
        <style>.article { color: maroon; }</style>
        <link rel="stylesheet" href="app/style/theme.css">
        <style>.article { background: linen; }</style>
        <script>window.headLeak = true</script>
      </head><body>
        <h1>En rubrik med sex ord faktiskt</h1>
        <p class="article">Bevara <em>denna</em> text.</p>
        <script>window.bodyLeak = true</script>
      </body></html>`

    expect(parsePresentationDocument(source)).toEqual({
      bodyHtml: "\n        <h1>En rubrik med sex ord faktiskt</h1>\n        <p class=\"article\">Bevara <em>denna</em> text.</p>\n        \n      ",
      title: "En rubrik med sex ord | Litteraturbanken",
      description: "En rubrik med sex ord",
      styleNodes: [
        { kind: "stylesheet", href: "/app/style/article.css" },
        { kind: "inline", textContent: ".article { color: maroon; }" },
        { kind: "stylesheet", href: "/app/style/theme.css" },
        { kind: "inline", textContent: ".article { background: linen; }" }
      ]
    })
  })

  test("uses only the first h1 and concatenates its descendant text", () => {
    const parsed = parsePresentationDocument(`
      <html><body>
        <h1>Första <span>rubriken har flera</span> än fem ord</h1>
        <h1>Andra rubriken ignoreras</h1>
      </body></html>
    `)

    expect(parsed.description).toBe("Första rubriken har flera än")
    expect(parsed.title).toBe("Första rubriken har flera än | Litteraturbanken")
  })

  test("root-normalizes safe relative body URLs and preserves safe absolute forms", () => {
    const parsed = parsePresentationDocument(`
      <html><body><h1>URL-prov</h1>
        <a id="relative" href="red/presentationer/file.pdf" download>PDF</a>
        <img id="image" src="images/ett.jpg">
        <a id="root" href="/författare/Test">Rot</a>
        <a id="fragment" href="#del">Del</a>
        <a id="mail" href="mailto:test@example.test">Mejl</a>
        <a id="telephone" href="tel:+461234">Telefon</a>
        <a id="external" href="https://example.test/path">Extern</a>
        <a id="protocol-relative" href="//cdn.example.test/file">CDN</a>
      </body></html>`)

    expect(parsed.bodyHtml).toContain('id="relative" href="/red/presentationer/file.pdf" download')
    expect(parsed.bodyHtml).toContain('id="image" src="/images/ett.jpg"')
    for (const value of [
      "/författare/Test",
      "#del",
      "mailto:test@example.test",
      "tel:+461234",
      "https://example.test/path",
      "//cdn.example.test/file"
    ]) expect(parsed.bodyHtml).toContain(value)
  })

  test.each([
    "javascript:alert(1)",
    "java\u000bscript:alert(1)",
    " JAVASCRIPT:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>"
  ])("removes unsafe executable URL %s", unsafeUrl => {
    const parsed = parsePresentationDocument(
      `<html><body><h1>Säkert</h1><a href="${unsafeUrl}">Behåll text</a></body></html>`
    )

    expect(parsed.bodyHtml).toContain("Behåll text")
    expect(parsed.bodyHtml).not.toContain("href=")
    expect(parsed.bodyHtml.toLowerCase()).not.toContain(unsafeUrl.trim().toLowerCase())
  })

  test("returns a stable empty representation for missing or malformed document structure", () => {
    expect(parsePresentationDocument("")).toEqual({
      bodyHtml: "",
      title: "",
      description: "",
      styleNodes: []
    })
    expect(parsePresentationDocument("<html><head><style>.leak { color:red }")).toEqual({
      bodyHtml: "",
      title: "",
      description: "",
      styleNodes: []
    })
  })

  test("parses the frozen active style, download, and image authority", async () => {
    const source = await readFile(
      fileURLToPath(new URL("FigurdiktenSomBarockBlandkonst.html", fixtureRoot)),
      "utf8"
    )
    const parsed = parsePresentationDocument(source)

    expect(parsed.title).toBe("Figurdikten som barock blandkonst | Litteraturbanken")
    expect(parsed.description).toBe("Figurdikten som barock blandkonst")
    expect(parsed.styleNodes).toEqual([
      { kind: "stylesheet", href: "/app/style/litteraturbanken.css" },
      { kind: "stylesheet", href: "/app/style/date.css" },
      { kind: "inline", textContent: "\np.image {text-align:center}\n" }
    ])
    expect(parsed.bodyHtml).toContain(
      'href="/red/presentationer/specialomraden/Figurdiktensombarockblandkonst.pdf" download="" target="_self"'
    )
    expect(parsed.bodyHtml).toContain(
      'src="/red/presentationer/specialomraden/Burmanbilder/10.jpg"'
    )
  })
})

describe("Presentation background parser", () => {
  test("keeps ordered rules and exact duplicate declarations", async () => {
    const source = await readFile(
      fileURLToPath(new URL("backgrounds.xml", fixtureRoot)),
      "utf8"
    )
    const rules = parseBackgroundRules(source)

    expect(rules.map(rule => rule.target)).toEqual([
      "/presentationer/specialomraden/Rostratt.html",
      "/presentationer/specialomraden/*",
      "/presentationer/specialomraden/Rostratt.html",
      "/presentationer/vandringar/*",
      "/presentationer/*"
    ])
    expect(rules[2]).toEqual({
      target: "/presentationer/specialomraden/Rostratt.html",
      imagePath: "/red/bilder/bakgrundsbilder/rostratt_a.jpg",
      className: "add-border paper",
      styleText: "html { background-color: #382a32; }"
    })
  })

  test("uses the last exact declaration before the first ordered wildcard", async () => {
    const source = await readFile(
      fileURLToPath(new URL("backgrounds.xml", fixtureRoot)),
      "utf8"
    )
    const rules = parseBackgroundRules(source)

    const exact = selectBackgroundRule(
      rules,
      "/presentationer/specialomraden/Rostratt.html"
    )
    expect(exact?.imagePath).toBe("/red/bilder/bakgrundsbilder/rostratt_a.jpg")
    expect(exact?.className?.split(/\s+/)).toEqual(["add-border", "paper"])

    expect(selectBackgroundRule(
      rules,
      "/presentationer/specialomraden/Annan.html"
    )?.className).toBe("folder-fallback")
    expect(selectBackgroundRule(
      rules,
      "/presentationer/vandringar/Annan.html"
    )?.className).toBe("vandring plain")
    expect(selectBackgroundRule(rules, "/om/ide")).toBeNull()
  })

  test("ignores malformed and out-of-scope XML rules", () => {
    expect(parseBackgroundRules("not xml")).toEqual([])
    expect(parseBackgroundRules(`
      <backgrounds>
        <background target="/om/*" url="/red/other.jpg"></background>
        <background url="/red/missing-target.jpg"></background>
      </backgrounds>
    `)).toEqual([])
  })
})

describe("Presentation canonical route validation", () => {
  test.each([
    undefined,
    [],
    ["specialomraden", "Censur.html"],
    ["vandringar", "NyRedaktionellSida.html"]
  ])("accepts canonical segment value %j", segments => {
    expect(validatePresentationSegments(segments)).toBe(true)
  })

  test.each([
    "specialomraden/Censur.html",
    ["specialomraden"],
    ["unknown", "Censur.html"],
    ["specialomraden", ".html"],
    ["specialomraden", "Censur.txt"],
    ["specialomraden", "one", "two.html"],
    ["specialomraden", "../admin.html"],
    ["specialomraden", "admin\\secret.html"],
    ["specialomraden", "title?variant.html"],
    ["specialomraden", "title#fragment.html"],
    ["specialomraden", "title%3Fvariant.html"],
    ["specialomraden", "title%23fragment.html"],
    ["specialomraden", "%2e%2e%2fadmin.html"],
    ["specialomraden", "%252e%252e%252fadmin.html"],
    ["specialomraden", encodeLayers("../admin.html", 8)],
    ["specialomraden", encodeLayers("../admin.html", 17)],
    ["specialomraden", `${"a".repeat(513)}.html`]
  ])("rejects unsafe segment value %j", segments => {
    expect(validatePresentationSegments(segments)).toBe(false)
  })
})
