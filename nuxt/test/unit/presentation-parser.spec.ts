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
        <style>p.image { text-align: center; }</style>
        <link rel="stylesheet" href="app/style/theme.css">
        <style>p.image { text-align: center; }</style>
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
        { kind: "inline", textContent: "p.image { text-align: center; }" },
        { kind: "stylesheet", href: "/app/style/theme.css" },
        { kind: "inline", textContent: "p.image { text-align: center; }" }
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

  test("allows only approved ordinary anchor navigation schemes", () => {
    const parsed = parsePresentationDocument(`
      <html><body><h1>URL-prov</h1>
        <a id="relative" href="red/presentationer/file.pdf" download>PDF</a>
        <a id="root" href="/författare/Test">Rot</a>
        <a id="fragment" href="#del">Del</a>
        <a id="mail" href="mailto:test@example.test">Mejl</a>
        <a id="telephone" href="tel:+461234">Telefon</a>
        <a id="http" href="http://example.test/path">HTTP</a>
        <a id="external" href="https://example.test/path">Extern</a>
        <a id="protocol-relative" href="//cdn.example.test/file">CDN</a>
        <a id="file" href="file:///etc/passwd">Fil</a>
        <a id="blob" href="blob:https://example.test/id">Blob</a>
        <a id="intent" href="intent://example.test/#Intent">Intent</a>
        <a id="custom" href="custom:document">Annan</a>
        <a id="credential" href="https://user:password@example.test/path">Inloggad</a>
        <a id="control" href="https://example.test/&#x0B;path">Kontroll</a>
        <a id="encoded-control" href="https://example.test/%0Bpath">Kodad kontroll</a>
        <a id="malformed" href="https://">Trasig</a>
        <a id="malformed-escape" href="https://example.test/%">Trasig kodning</a>
      </body></html>`)

    expect(parsed.bodyHtml).toContain('id="relative" href="/red/presentationer/file.pdf" download')
    for (const value of [
      "/författare/Test",
      "#del",
      "mailto:test@example.test",
      "tel:+461234",
      "http://example.test/path",
      "https://example.test/path"
    ]) expect(parsed.bodyHtml).toContain(value)
    for (const id of ["protocol-relative", "file", "blob", "intent", "custom", "credential", "control", "encoded-control", "malformed", "malformed-escape"]) {
      expect(parsed.bodyHtml).toContain(`id="${id}"`)
      expect(parsed.bodyHtml).not.toContain(`id="${id}" href=`)
    }
  })

  test("keeps only canonical owned Presentation image sources", () => {
    const parsed = parsePresentationDocument(`
      <html><body><h1>Bild-prov</h1>
        <img id="owned" src="/red/presentationer/specialomraden/Burmanbilder/1.jpg">
        <img id="relative" src="images/ett.jpg">
        <img id="other-red" src="/red/andra/ett.jpg">
        <img id="external" src="https://evil.test/ett.jpg">
        <img id="protocol-relative" src="//evil.test/ett.jpg">
        <img id="encoded-traversal" src="/red/presentationer/%252e%252e/andra/ett.jpg">
      </body></html>`)

    expect(parsed.bodyHtml).toContain(
      'id="owned" src="/red/presentationer/specialomraden/Burmanbilder/1.jpg"'
    )
    for (const id of ["relative", "other-red", "external", "protocol-relative", "encoded-traversal"]) {
      expect(parsed.bodyHtml).toContain(`id="${id}"`)
      expect(parsed.bodyHtml).not.toContain(`id="${id}" src=`)
    }
  })

  test("removes non-src body subresource attributes and inline styles", () => {
    const parsed = parsePresentationDocument(`
      <html><body><h1>Attribut-prov</h1>
        <img id="image" src="/red/presentationer/specialomraden/Burmanbilder/1.jpg" srcset="https://evil.test/srcset.jpg 1x" ATTRIBUTIONSRC="https://evil.test/image-attribution">
        <table id="legacy-background" background="https://evil.test/background.jpg"><tr><td>Tabell</td></tr></table>
        <p id="inline-style" style="background-image:url(https://evil.test/style.jpg)">Text</p>
        <p id="other-url-attributes" src="/red/presentationer/specialomraden/Burmanbilder/1.jpg" action="https://evil.test/action" poster="https://evil.test/poster.jpg" xlink:href="https://evil.test/vector">Fler attribut</p>
        <a id="ping-link" href="/författare/Test" ping="https://evil.test/ping" attributionsrc="https://evil.test/link-attribution">Länk</a>
      </body></html>`)

    expect(parsed.bodyHtml).toContain('id="image" src="/red/presentationer/specialomraden/Burmanbilder/1.jpg"')
    expect(parsed.bodyHtml).toContain('id="legacy-background">')
    expect(parsed.bodyHtml).toContain('id="inline-style">Text</p>')
    expect(parsed.bodyHtml).toContain('id="other-url-attributes">Fler attribut</p>')
    expect(parsed.bodyHtml).toContain('id="ping-link" href="/författare/Test">Länk</a>')
    expect(parsed.bodyHtml).not.toMatch(/(?:srcset|background=|style=|action=|poster=|xlink:href|ping=|attributionsrc|evil\.test)/iu)
  })

  test("issues stylesheet hrefs only for normalized root-owned paths", () => {
    const parsed = parsePresentationDocument(`
      <html><head>
        <link rel="stylesheet" href="app/style/article.css">
        <link rel="stylesheet" href="/red/presentationer/theme.css?edition=1">
        <link rel="stylesheet" href="https://other.test/external.css">
        <link rel="stylesheet" href="//other.test/protocol-relative.css">
      </head><body><h1>Stilmallar</h1></body></html>
    `)

    expect(parsed.styleNodes).toEqual([
      { kind: "stylesheet", href: "/app/style/article.css" },
      { kind: "stylesheet", href: "/red/presentationer/theme.css?edition=1" }
    ])
  })

  test.each([
    "@import url(https://evil.test/import.css);",
    "@namespace remote url(https://evil.test/namespace.xml);",
    "p { background-image: url(https://evil.test/image.jpg); }",
    "p { background-image: u\\72l(https://evil.test/escaped-image.jpg); }",
    "p { background-image: image-set(\"https://evil.test/image-set.jpg\" 1x); }",
    "p { content: image(\"https://evil.test/image-function.jpg\"); }",
    "p { src: src(\"https://evil.test/src-function.jpg\"); }",
    "p { width: expression(alert(1)); }",
    "p { behavior: url(#default#time2); }",
    "p { -moz-binding: url(https://evil.test/binding.xml#target); }",
    "p.image { text-align: center; &:hover { text-align: center; } }",
    "p { color: red;"
  ])("drops unsafe or malformed head inline CSS: %s", styleText => {
    const parsed = parsePresentationDocument(
      "<html><head>"
      + "<style>p.image { text-align: center; }</style>"
      + "<style>" + styleText + "</style>"
      + "</head><body><h1>CSS-prov</h1></body></html>"
    )

    expect(parsed.styleNodes).toEqual([
      { kind: "inline", textContent: "p.image { text-align: center; }" }
    ])
  })

  test.each(["", "/* editorial note */"])('drops head inline CSS without an allowed rule: %j', styleText => {
    expect(parsePresentationDocument(
      `<html><head><style>${styleText}</style></head><body><h1>CSS-prov</h1></body></html>`
    ).styleNodes).toEqual([])
  })

  test.each([
    "p.image { text-align: center; } @import url(https://evil.test/late.css);",
    "/* comment */ p.image { text-align: center; }",
    "\u0000p.image { text-align: center; }",
    "\u00a0p.image { text-align: center; }",
    "p.image { text-align: center; color: red; }",
    "p.image { text-align: center; } p.image { text-align: center; }",
    "P.image { text-align: center; }",
    "p.image { TEXT-ALIGN: CENTER; }"
  ])("drops CSS outside the exact case-sensitive head grammar: %j", styleText => {
    expect(parsePresentationDocument(
      `<html><head><style>${styleText}</style></head><body><h1>CSS-prov</h1></body></html>`
    ).styleNodes).toEqual([])
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

  test("keeps safe editorial markup while inerting executable body markup and URL attributes", () => {
    const parsed = parsePresentationDocument(`
      <html><body><h1>Säkert innehåll</h1>
        <p id="safe-copy" class="article">Bevara <em>denna</em> text.</p>
        <a id="safe-link" href="red/presentationer/file.pdf">PDF</a>
        <img id="safe-image" src="/red/presentationer/specialomraden/Burmanbilder/1.jpg" alt="Ett motiv">
        <p id="event-probe" onclick="window.executed = true" v-html="window.executed" @click="window.executed = true" :title="window.executed" ng-click="window.executed = true" data-ng-click="window.executed = true">Inert text</p>
        <img id="image-probe" src="java&#x0B;script:alert(1)" onerror="window.executed = true" srcdoc="&lt;script&gt;window.executed = true&lt;/script&gt;">
        <a id="link-probe" href="data:text/html,&lt;script&gt;window.executed = true&lt;/script&gt;">Inert länktext</a>
        <iframe srcdoc="&lt;script&gt;window.executed = true&lt;/script&gt;">iframe-probe</iframe>
        <object data="https://evil.example/object">object-probe</object>
        <embed src="https://evil.example/embed">embed-probe</embed>
        <audio src="https://evil.example/audio">audio-probe</audio>
        <video src="https://evil.example/video">video-probe</video>
        <form action="https://evil.example/form"><input value="form-probe"><button>form-button</button></form>
        <button type="button">button-probe</button>
        <svg><a href="javascript:alert(1)">svg-probe</a></svg>
        <math><mi>math-probe</mi></math>
      </body></html>
    `)

    expect(parsed.bodyHtml).toContain('<p id="safe-copy" class="article">Bevara <em>denna</em> text.</p>')
    expect(parsed.bodyHtml).toContain('id="safe-link" href="/red/presentationer/file.pdf"')
    expect(parsed.bodyHtml).toContain('id="safe-image" src="/red/presentationer/specialomraden/Burmanbilder/1.jpg" alt="Ett motiv"')
    expect(parsed.bodyHtml).toContain('id="event-probe">Inert text</p>')
    expect(parsed.bodyHtml).toContain('id="image-probe"')
    expect(parsed.bodyHtml).toContain('id="link-probe">Inert länktext</a>')
    expect(parsed.bodyHtml).not.toMatch(/(?:onerror|onclick|srcdoc|v-html|@click|:title|ng-click|data-ng-click|javascript:|data:text)/iu)
    expect(parsed.bodyHtml).not.toMatch(/<(?:iframe|object|embed|audio|video|form|button|svg|math)\b/iu)
    expect(parsed.bodyHtml).not.toMatch(/(?:audio-probe|video-probe|form-probe|form-button|button-probe|svg-probe|math-probe)/iu)
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
  test.each([
    "@import url(https://evil.test/import.css);",
    "@namespace remote url(https://evil.test/namespace.xml);",
    "html { background-image: url(https://evil.test/image.jpg); }",
    "html { background-image: u\\72l(https://evil.test/escaped-image.jpg); }",
    "html { background-image: image-set(\"https://evil.test/image-set.jpg\" 1x); }",
    "html { content: image(\"https://evil.test/image-function.jpg\"); }",
    "html { src: src(\"https://evil.test/src-function.jpg\"); }",
    "html { width: expression(alert(1)); }",
    "html { behavior: url(#default#time2); }",
    "html { -moz-binding: url(https://evil.test/binding.xml#target); }",
    "html { background-color: #382a32; &amp;:hover { background-color: #382a32; } }",
    "html { color: red;"
  ])("drops unsafe or malformed background inline CSS: %s", styleText => {
    const [rule] = parseBackgroundRules(
      "<backgrounds><background target=\"/presentationer/*\" url=\"/red/bilder/bakgrundsbilder/rostratt_a.jpg\">"
      + "<style>" + styleText + "</style>"
      + "</background></backgrounds>"
    )

    expect(rule).toEqual({
      target: "/presentationer/*",
      imagePath: "/red/bilder/bakgrundsbilder/rostratt_a.jpg",
      className: null,
      styleText: null
    })
  })

  test.each(["", "/* editorial note */"])('drops background inline CSS without an allowed rule: %j', styleText => {
    const [rule] = parseBackgroundRules(
      '<backgrounds><background target="/presentationer/*"><style>'
      + styleText
      + '</style></background></backgrounds>'
    )

    expect(rule?.styleText ?? null).toBeNull()
  })

  test.each([
    "html { background-color: #382a32; } @import url(https://evil.test/late.css);",
    "/* comment */ html { background-color: #382a32; }",
    "\u0000html { background-color: #382a32; }",
    "\u00a0html { background-color: #382a32; }",
    "html { background-color: #382a32; color: red; }",
    "html { background-color: #382a32; } html { background-color: #382a32; }",
    "HTML { background-color: #382a32; }",
    "html { BACKGROUND-COLOR: #382a32; }",
    "html { background-color: #382A32; }"
  ])("drops CSS outside the exact case-sensitive background grammar: %j", styleText => {
    const [rule] = parseBackgroundRules(
      '<backgrounds><background target="/presentationer/*"><style>'
      + styleText
      + '</style></background></backgrounds>'
    )

    expect(rule?.styleText ?? null).toBeNull()
  })

  test.each([
    ["duplicate XML declaration", "<?xml version=\"1.0\"?><?xml version=\"1.0\"?><backgrounds></backgrounds>"],
    ["XML declaration inside the root", "<backgrounds><?xml version=\"1.0\"?></backgrounds>"],
    ["processing instruction inside the root", "<backgrounds><?editor keep?></backgrounds>"],
    ["empty processing instruction", "<??><backgrounds></backgrounds>"],
    ["reserved XML processing instruction", "<?xml keep?><backgrounds></backgrounds>"],
    ["literal less-than sign in an attribute", "<backgrounds><background target=\"/presentationer/*\" url=\"/red/bilder/a<.jpg\" /></backgrounds>"],
    ["CDATA terminator in text", "<backgrounds>text ]]></backgrounds>"],
    ["invalid XML 1.0 numeric entity", "<backgrounds>&#x1;</backgrounds>"],
    ["form-feed outside the root", "\f<backgrounds></backgrounds>"],
    ["non-breaking space outside the root", "\u00a0<backgrounds></backgrounds>"]
  ])("fails closed for strict XML violation: %s", (_label, source) => {
    expect(parseBackgroundRules(source)).toEqual([])
  })

  test.each([
    ["truncated background", '<backgrounds><background target="/presentationer/*" url="/red/bilder/bakgrundsbilder/rostratt_a.jpg">'],
    ["mismatched nested nodes", '<backgrounds><background target="/presentationer/*" url="/red/bilder/bakgrundsbilder/rostratt_a.jpg"><style>one</background></style></backgrounds>'],
    ["truncated style", '<backgrounds><background target="/presentationer/*" url="/red/bilder/bakgrundsbilder/rostratt_a.jpg"><style>one</style>'],
    ["undeclared entity", '<backgrounds><background target="/presentationer/*" url="/red/bilder/bakgrundsbilder/rostratt_a.jpg"><style>&unknown;</style></background></backgrounds>'],
    ["invalid comment", '<backgrounds><background target="/presentationer/*" url="/red/bilder/bakgrundsbilder/rostratt_a.jpg"><!-- invalid -- comment --></background></backgrounds>']
  ])("fails closed for %s XML", (_label, source) => {
    expect(parseBackgroundRules(source)).toEqual([])
  })

  test("fails closed for structural mutations of the reviewed background fixture", async () => {
    const source = await readFile(fileURLToPath(new URL("backgrounds.xml", fixtureRoot)), "utf8")
    for (const mutation of [
      source.replace("</backgrounds>", ""),
      source.replace("</style>", "</background>")
    ]) expect(parseBackgroundRules(mutation)).toEqual([])
  })

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

  test.each([
    "/red/background.jpg');color:red;/*",
    "/red/background.jpg\n);color:red;/*"
  ])("rejects background URLs that can escape the CSS url token: %s", imagePath => {
    const encodedImagePath = imagePath
      .replaceAll("&", "&amp;")
      .replaceAll("'", "&apos;")
      .replaceAll("\n", "&#10;")
    const [rule] = parseBackgroundRules(`
      <backgrounds>
        <background target="/presentationer/specialomraden/*" url="${encodedImagePath}" />
      </backgrounds>
    `)

    expect(rule?.imagePath).toBeNull()
  })

  test.each([
    "//cdn.example.test/background.jpg",
    "https://cdn.example.test/background.jpg",
    "mailto:editor@example.test",
    "tel:+461234",
    "/red/other/background.jpg",
    "/red/bilder/../presentationer/background.jpg",
    "/red/bilder/%2e%2e/presentationer/background.jpg",
    "/red/bilder/background.jpg\\\\outside"
  ])("rejects non-owned background asset URL %s", imagePath => {
    const encodedImagePath = imagePath
      .replaceAll("&", "&amp;")
      .replaceAll("\u0000", "&#0;")
    const [rule] = parseBackgroundRules(`
      <backgrounds>
        <background target="/presentationer/specialomraden/*" url="${encodedImagePath}" />
      </backgrounds>
    `)

    expect(rule?.imagePath).toBeNull()
  })

  test("rejects an XML-invalid background control entity before rule extraction", () => {
    expect(parseBackgroundRules(`
      <backgrounds>
        <background target="/presentationer/specialomraden/*" url="/red/bilder/background.jpg&#0;" />
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
