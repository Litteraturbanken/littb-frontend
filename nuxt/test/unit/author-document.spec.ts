import { readFileSync } from "node:fs"
import { parseHTML } from "linkedom"
import { describe, expect, test } from "vitest"

import {
  InvalidAuthorDocumentSource,
  expectedAuthorDocumentSource,
  parseAuthorDocumentBody
} from "../../server/utils/author-document"
import {
  semerAuthorDocumentAssets,
  semerAuthorDocumentDescriptor
} from "../fixtures/author-document-data.mjs"

type Descriptor = Parameters<typeof expectedAuthorDocumentSource>[0]

const descriptor = (overrides: Partial<Descriptor> = {}): Descriptor => ({
  author_id: "SöderbergH",
  normalized_author_id: "SoderbergH",
  full_name: "Hjalmar Söderberg",
  birth_year: "1869",
  death_year: "1941",
  has_introduction: true,
  has_dramawebben: false,
  search_url: "/sok?forfattare=S%C3%B6derbergH&avancerad",
  audio_url:
    "https://litteraturbanken.se/ljudochbild/författare/soderbergh",
  document_kind: "presentation",
  source_path: "/red/forfattare/SoderbergH/presentation/index.html",
  ...overrides
})

describe("strict author document descriptors", () => {
  test("accepts the exact Almqvist semer descriptor and managed source path", () => {
    expect(expectedAuthorDocumentSource(
      semerAuthorDocumentDescriptor,
      "AlmqvistCJL",
      "semer"
    )).toBe("/red/forfattare/AlmqvistCJL/semer/index.html")
  })

  test.each([
    { author_id: "AtterbomPDA" },
    { document_kind: "presentation" },
    { source_path: "https://evil.test/red/forfattare/AlmqvistCJL/semer/index.html" },
    { source_path: "//evil.test/red/forfattare/AlmqvistCJL/semer/index.html" },
    { source_path: "/red/forfattare/../semer/index.html" },
    { source_path: "/red/forfattare/%2e%2e/semer/index.html" },
    { source_path: "/red/forfattare/%252e%252e/semer/index.html" },
    { source_path: "/red/forfattare/AlmqvistCJL/semer/index.html?download=1" },
    { source_path: "/red/forfattare/AlmqvistCJL/semer/index.html#main" },
    { source_path: "/red/forfattare/AlmqvistCJL/semer/index.html\u0000" },
    { source_path: "/red/forfattare/AlmqvistCJL/presentation/index.html" },
    { source_path: "/red/forfattare/AlmqvistCJL/semer/other.html" }
  ])("rejects a non-exact Almqvist semer descriptor %#", overrides => {
    expect(() => expectedAuthorDocumentSource(
      { ...semerAuthorDocumentDescriptor, ...overrides },
      "AlmqvistCJL",
      "semer"
    )).toThrow("Invalid author document descriptor")
  })

  test("reconstructs and accepts the one exact managed source path", () => {
    expect(expectedAuthorDocumentSource(
      descriptor(),
      "SöderbergH",
      "presentation"
    )).toBe("/red/forfattare/SoderbergH/presentation/index.html")
  })

  test.each([
    "//red/forfattare/SoderbergH/presentation/index.html",
    "https://evil.test/red/forfattare/SoderbergH/presentation/index.html",
    "/red/forfattare/../presentation/index.html",
    "/red/forfattare/%2e%2e/presentation/index.html",
    "/red/forfattare/%252e%252e/presentation/index.html",
    "/red/forfattare/SoderbergH%2fpresentation/index.html",
    "/red/forfattare/SoderbergH%5cpresentation/index.html",
    "/red/forfattare/SoderbergH/presentation/index.html?x=1",
    "/red/forfattare/SoderbergH/presentation/index.html#x",
    "/red/forfattare/SoderbergH/bibliografi/index.html",
    "/red/forfattare/SoderbergH/presentation/extra/index.html",
    "/red/forfattare/SoderbergH/presentation/index.html\u0000",
    "/red/forfattare/SoderbergH/presentation/index.html\u007f",
    "/red/forfattare/SoderbergH/presentation/index.html\u0085",
    "/red/forfattare/SoderbergH/presentation/index.html%"
  ])("rejects a non-exact managed source path %#", sourcePath => {
    expect(() => expectedAuthorDocumentSource(
      descriptor({ source_path: sourcePath }),
      "SöderbergH",
      "presentation"
    )).toThrow("Invalid author document descriptor")
  })

  test.each([
    "../private",
    "%2e%2e",
    "SoderbergH/presentation",
    "SoderbergH\\presentation",
    " SoderbergH",
    "SoderbergH ",
    "Soderberg\u0000H",
    "Soderberg\u007fH",
    "Soderberg\u0085H",
    "\ud800",
    "A".repeat(101)
  ])("rejects an unsafe normalized identity before using its path %#", normalized => {
    expect(() => expectedAuthorDocumentSource(
      descriptor({
        normalized_author_id: normalized,
        source_path: "/red/forfattare/SoderbergH/presentation/index.html"
      }),
      "SöderbergH",
      "presentation"
    )).toThrow("Invalid author document descriptor")
  })

  test.each([
    { author_id: "LagerlöfS" },
    { document_kind: "bibliografi" },
    { normalized_author_id: "O'Neil!()*A" },
    { search_url: "/sok?forfattare=SoderbergH&avancerad" },
    { audio_url: "https://evil.test/ljudochbild/författare/soderbergh" }
  ])("rejects a descriptor identity or reconstructed link mismatch %#", overrides => {
    expect(() => expectedAuthorDocumentSource(
      descriptor(overrides as Partial<Descriptor>),
      "SöderbergH",
      "presentation"
    )).toThrow("Invalid author document descriptor")
  })

  test("uses uppercase RFC3986 encoding for every reconstructed descriptor field", () => {
    const exact = descriptor({
      author_id: "O'Neil!()*A",
      normalized_author_id: "O'Neil!()*A",
      search_url: "/sok?forfattare=O%27Neil%21%28%29%2AA&avancerad",
      audio_url:
        "https://litteraturbanken.se/ljudochbild/författare/o%27neil%21%28%29%2Aa",
      source_path:
        "/red/forfattare/O%27Neil%21%28%29%2AA/presentation/index.html"
    })
    expect(expectedAuthorDocumentSource(
      exact,
      "O'Neil!()*A",
      "presentation"
    )).toBe(exact.source_path)
  })

  test.each(["search_url", "audio_url", "normalized_author_id"] as const)(
    "contains lone surrogates in %s inside the invalid-descriptor boundary",
    key => {
      expect(() => expectedAuthorDocumentSource(
        descriptor({ [key]: "\ud800" }),
        "SöderbergH",
        "presentation"
      )).toThrow("Invalid author document descriptor")
    }
  )

  test("rejects undeclared descriptor fields at the strict local schema boundary", () => {
    expect(() => expectedAuthorDocumentSource(
      { ...descriptor(), unexpected: "must not cross the boundary" },
      "SöderbergH",
      "presentation"
    )).toThrow("Invalid author document descriptor")
  })
})

const managedBody = [
  "<!doctype html><html><head><title>Managed</title></head><body>",
  '<div class="presentation" id="managed" lang="sv" title="Levnad" data-drop="x">',
  "<h2>Presentation</h2>",
  '<p style="color:red" onclick="bad()" ng-click="bad()" v-html="bad">',
  "Text <em>betoning</em> <strong>styrka</strong></p>",
  "<dl><dt>Term</dt><dd>Definition</dd></dl>",
  '<figure><img src="/red/bilder/portrait.jpg" alt="Porträtt" width="10" height="20"><figcaption>Bild</figcaption></figure>',
  '<table><caption>Tabell</caption><colgroup span="2"><col span="1"></colgroup><thead><tr><th scope="col" colspan="2">H</th></tr></thead><tbody><tr><td headers="h" rowspan="2">D</td></tr></tbody></table>',
  '<ol start="2" reversed type="I"><li value="4">Punkt</li></ol>',
  '<a href="/forfattare/SoderbergH/titlar/Forvillelser/sida/3/etext">Legacy Reader</a>',
  '<a href="SoderbergH_presentation.pdf" download target="_self">PDF</a>',
  '<a href="https://example.test/info" target="_blank" rel="external">Extern</a>',
  '<mark>Okänd <i>formatering</i></mark>',
  "</div></body></html>"
].join("")

const maliciousBody = [
  "<!doctype html><html><body>",
  '<p data-malicious-marker="raw" onmouseover="steal()" srcdoc="bad">Trygg text</p>',
  '<a href="javascript:alert(1)">JS</a>',
  '<a href="java%0Ascript:alert(1)">Kodad kontroll</a>',
  '<a href="//evil.test/path">Protokollrelativ</a>',
  '<a href="\\\\evil.test\\path">Bakstreck</a>',
  '<a href="/%252e%252e/private">Traversal</a>',
  '<a href="/%ZZ/private">Felaktig kodning</a>',
  '<a href="#safe">Fragment</a>',
  '<a href="mailto:editor@example.test">E-post</a>',
  '<a href="tel:+461234">Telefon</a>',
  '<img src="http://example.test/insecure.png" alt="HTTP">',
  '<img src="data:image/png;base64,evil" alt="Data">',
  '<img src="https://example.test/safe.png" alt="HTTPS">',
  "<!-- comment-probe -->",
  "<script>script-probe</script><style>style-probe</style>",
  "<form><p>form-probe</p></form><iframe>frame-probe</iframe>",
  "<svg><text>svg-probe</text></svg><math><mi>math-probe</mi></math>",
  "<template>template-probe</template><video>video-probe</video>",
  "</body></html>"
].join("")

describe("managed author XHTML sanitization", () => {
  test("preserves the real Almqvist semer body inside the sanitizer boundary", () => {
    const source = readFileSync(
      new URL("../fixtures/author-document-content/AlmqvistCJL-semer.html", import.meta.url),
      "utf8"
    )
    const output = parseAuthorDocumentBody(source)
    const { document } = parseHTML(`<body>${output}</body>`)
    const headings = [...document.querySelectorAll("h1, h2")].map(node => node.textContent)
    const images = [...document.querySelectorAll("img")]
    const links = [...document.querySelectorAll("a")]

    expect(headings).toEqual([
      "Carl Jonas Love Almqvist",
      "Mera om och av författaren"
    ])
    expect(images).toHaveLength(13)
    expect(images.map(image => image.getAttribute("src")).sort())
      .toEqual(semerAuthorDocumentAssets.map(asset => asset.path).sort())
    const atterbomThumbnail = images.find(image => image.getAttribute("alt") === "4:e januari")
    expect(atterbomThumbnail?.getAttribute("width")).toBe("76")
    expect(atterbomThumbnail?.getAttribute("height")).toBe("100")
    expect(links.map(link => link.getAttribute("href"))).toEqual(expect.arrayContaining([
      "/forfattare/AlmqvistCJL/titlar/DetGarAn1838/sida/1/faksimil",
      "/forfattare/AtterbomPDA",
      "/red/forfattare/AlmqvistCJL/semer/pictures/Burman2003.pdf",
      "/red/forfattare/AlmqvistCJL/semer/AlmqvistOrdlistaSlutgiltig.pdf"
    ]))
    for (const link of links.filter(link => link.getAttribute("target") === "_blank")) {
      expect(link.getAttribute("rel")).toBe("noopener noreferrer")
    }
    expect(output).not.toMatch(/<(?:script|style|form|iframe|svg|math)\b/iu)
    expect(output).not.toMatch(/\s(?:style|on\w+|srcdoc|ng-[\w-]+|v-[\w-]+)=/iu)
    expect(output).not.toMatch(/(?:javascript:|data:|\/\/evil\.test)/iu)
  })

  test("preserves the complete editorial element and attribute policy", () => {
    const output = parseAuthorDocumentBody(managedBody)
    const { document } = parseHTML(`<body>${output}</body>`)
    const root = document.querySelector("#managed")

    expect(root?.getAttribute("class")).toBe("presentation")
    expect(root?.getAttribute("lang")).toBe("sv")
    expect(root?.getAttribute("title")).toBe("Levnad")
    expect(root?.hasAttribute("data-drop")).toBe(false)
    expect(output).toContain("<dl><dt>Term</dt><dd>Definition</dd></dl>")
    expect(output).toContain("<figure>")
    expect(output).toContain("<table>")
    expect(output).toContain('<ol start="2" reversed type="I"><li value="4">')
    expect(output).not.toContain("<mark")
    expect(output).toContain("Okänd <i>formatering</i>")
    expect(output).not.toMatch(/\s(?:style|on\w+|srcdoc|ng-[\w-]+|v-[\w-]+)=/iu)
  })

  test("preserves managed Reader and PDF behavior byte-for-byte", () => {
    const output = parseAuthorDocumentBody(managedBody)
    const { document } = parseHTML(`<body>${output}</body>`)
    const links = new Map(
      [...document.querySelectorAll("a")].map(anchor => [anchor.textContent, anchor])
    )

    expect(links.get("Legacy Reader")?.getAttribute("href")).toBe(
      "/forfattare/SoderbergH/titlar/Forvillelser/sida/3/etext"
    )
    expect(links.get("PDF")?.getAttribute("href")).toBe("SoderbergH_presentation.pdf")
    expect(links.get("PDF")?.hasAttribute("download")).toBe(true)
    expect(links.get("PDF")?.getAttribute("target")).toBe("_self")
    expect(links.get("Extern")?.getAttribute("rel")).toBe(
      "external noopener noreferrer"
    )
  })

  test("removes active subtrees, comments, unsafe URLs, and every raw marker", () => {
    const output = parseAuthorDocumentBody(maliciousBody)
    const { document } = parseHTML(`<body>${output}</body>`)

    for (const marker of [
      "data-malicious-marker",
      "script-probe",
      "style-probe",
      "form-probe",
      "frame-probe",
      "svg-probe",
      "math-probe",
      "template-probe",
      "video-probe",
      "comment-probe"
    ]) expect(output, marker).not.toContain(marker)

    for (const label of [
      "JS",
      "Kodad kontroll",
      "Protokollrelativ",
      "Bakstreck",
      "Traversal",
      "Felaktig kodning"
    ]) {
      const anchor = [...document.querySelectorAll("a")]
        .find(candidate => candidate.textContent === label)
      expect(anchor?.getAttribute("href"), label).toBeNull()
    }
    const images = [...document.querySelectorAll("img")]
    expect(images.find(image => image.getAttribute("alt") === "HTTP")?.getAttribute("src"))
      .toBeNull()
    expect(images.find(image => image.getAttribute("alt") === "Data")?.getAttribute("src"))
      .toBeNull()
    expect(images.find(image => image.getAttribute("alt") === "HTTPS")?.getAttribute("src"))
      .toBe("https://example.test/safe.png")
  })

  test("is deterministic and idempotent", () => {
    const once = parseAuthorDocumentBody(managedBody)
    expect(parseAuthorDocumentBody(`<!doctype html><html><body>${once}</body></html>`))
      .toBe(once)
  })

  test.each([
    "<p>No body</p>",
    "<!doctype html><html><head></head></html>",
    "<!doctype html><html><body>one</body><body>two</body></html>",
    "not html"
  ])("rejects missing, multiple, or malformed bodies %#", source => {
    expect(() => parseAuthorDocumentBody(source)).toThrow(InvalidAuthorDocumentSource)
  })

  test("fails closed when URL decoding does not stabilize within sixteen passes", () => {
    let unstable = "../private"
    for (let pass = 0; pass < 17; pass += 1) unstable = encodeURIComponent(unstable)
    const output = parseAuthorDocumentBody(
      `<!doctype html><html><body><a href="/${unstable}">Deep</a></body></html>`
    )
    expect(parseHTML(`<body>${output}</body>`).document.querySelector("a")?.getAttribute("href"))
      .toBeNull()
  })
})
