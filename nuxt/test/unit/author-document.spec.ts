import { readFileSync } from "node:fs"
import type { H3Event } from "h3"
import { parseHTML } from "linkedom"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  InvalidAuthorDocumentSource,
  expectedAuthorDocumentSource,
  loadAuthorDocument,
  parseAuthorDocumentBody
} from "../../server/utils/author-document"
import {
  lagerlofOmtexterna,
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
  test("accepts only the exact SLA omtexterna tuple and fixed source", () => {
    expect(expectedAuthorDocumentSource(
      lagerlofOmtexterna,
      "LagerlöfS",
      "omtexterna"
    )).toBe("/red/sla/omtexterna.html")
  })

  test.each([
    [{ author_id: "SöderbergH" }, "LagerlöfS", "omtexterna"],
    [{ normalized_author_id: "LagerlöfS" }, "LagerlöfS", "omtexterna"],
    [{ document_kind: "presentation" }, "LagerlöfS", "omtexterna"],
    [{ source_path: "/red/forfattare/LagerlofS/omtexterna/index.html" }, "LagerlöfS", "omtexterna"],
    [{ source_path: "/red/sla/omtexterna.html?authority=exact" }, "LagerlöfS", "omtexterna"],
    [{}, "SöderbergH", "omtexterna"],
    [{}, "LagerlöfS", "presentation"]
  ] as const)("rejects a non-exact SLA descriptor tuple %#", (overrides, author, kind) => {
    expect(() => expectedAuthorDocumentSource(
      { ...lagerlofOmtexterna, ...overrides },
      author,
      kind
    )).toThrow("Invalid author document descriptor")
  })

  test("rejects extra keys on the otherwise exact SLA descriptor", () => {
    expect(() => expectedAuthorDocumentSource(
      { ...lagerlofOmtexterna, unexpected: "must not cross the boundary" },
      "LagerlöfS",
      "omtexterna"
    )).toThrow("Invalid author document descriptor")
  })

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
  test("preserves the real SLA landing through its exact element and attribute policy", () => {
    const source = readFileSync(
      new URL("../fixtures/author-document-content/LagerlofS-omtexterna.html", import.meta.url),
      "utf8"
    )
    const output = parseAuthorDocumentBody(source, "omtexterna")
    const { document } = parseHTML(`<body>${output}</body>`)
    const elements = [...document.querySelectorAll("*")]
    const links = [...document.querySelectorAll("a[href]")]

    expect(links).toHaveLength(21)
    expect(new Set(elements.map(element => element.localName))).toEqual(new Set([
      "a", "body", "div", "h1", "h2", "hr", "li", "p", "span", "ul"
    ]))
    expect(elements.some(element => element.hasAttribute("xml:lang"))).toBe(false)
    expect([...document.querySelectorAll("h1[style], h2[style]")]
      .map(element => element.getAttribute("style")))
      .toEqual(Array(6).fill("clear: both"))
    expect([...document.querySelectorAll("ul[style]")]
      .map(element => element.getAttribute("style")))
      .toEqual(Array(4).fill("list-style-type: disc"))
    expect(links.every(link => link.getAttribute("href")
      ?.startsWith("/författare/LagerlöfS/"))).toBe(true)
    expect(links.every(link => link.getAttribute("target") === "_top")).toBe(true)
    expect(output).not.toMatch(/<(?:html|head|body|title|meta)\b/iu)
    expect(output).not.toMatch(/\s(?:onclick|data-probe|xml:lang)=/iu)
  })

  test("removes dangerous SLA subtrees and unwraps every unknown inert element", () => {
    const output = parseAuthorDocumentBody([
      "<!doctype html><html><head><title>head-probe</title></head><body>",
      "<!-- comment-probe --><script>script-probe</script><style>style-probe</style>",
      "<form><p>form-probe</p></form><iframe>iframe-probe</iframe>",
      "<section>unwrapped <em>nested-unwrapped <span>kept</span></em></section>",
      "</body></html>"
    ].join(""), "omtexterna")

    expect(output).toContain("unwrapped nested-unwrapped <span>kept</span>")
    expect(output).not.toMatch(/head-probe|comment-probe|script-probe|style-probe/iu)
    expect(output).not.toMatch(/form-probe|iframe-probe|<(?:section|em)\b/iu)
  })

  test("retains only the SLA landing attributes and only the _top target", () => {
    const output = parseAuthorDocumentBody([
      "<!doctype html><html><body>",
      '<div class="kept" id="kept" lang="sv" xml:lang="sv" title="drop" data-x="drop">',
      '<a class="link" id="link" lang="sv" href="/författare/LagerlöfS/omtexterna/Safe.html" target="_top" rel="external" download="x">Top</a>',
      '<a href="/författare/LagerlöfS/omtexterna/Safe.html" target="_blank">Blank</a>',
      "</div></body></html>"
    ].join(""), "omtexterna")
    const { document } = parseHTML(`<body>${output}</body>`)
    const div = document.querySelector("div")!
    const [top, blank] = [...document.querySelectorAll("a")]

    expect([...div.attributes].map(attribute => attribute.name).sort())
      .toEqual(["class", "id", "lang"])
    expect([...top!.attributes].map(attribute => attribute.name).sort())
      .toEqual(["class", "href", "id", "lang", "rel", "target"])
    expect(top?.getAttribute("target")).toBe("_top")
    expect(blank?.hasAttribute("target")).toBe(false)
  })

  test.each([
    "/författare/LagerlöfS/omtexterna/../private.html",
    "/författare/LagerlöfS/omtexterna/%2e%2e/private.html",
    "/författare/LagerlöfS/omtexterna/%252e%252e/private.html",
    "/författare/LagerlöfS/omtexterna/Safe.html%0Aevil",
    "/författare/LagerlöfS\\omtexterna\\Safe.html",
    "//evil.test/författare/LagerlöfS/Safe.html",
    "https://litteraturbanken.se/författare/LagerlöfS/Safe.html",
    "/författare/StrindbergA/omtexterna/Safe.html",
    "/forfattare/LagerlofS/omtexterna/Safe.html",
    "relative.html",
    "#fragment",
    "/%ZZ/private"
  ])("removes an href outside the exact safe SLA subtree %#", href => {
    const output = parseAuthorDocumentBody(
      `<!doctype html><html><body><a href="${href}">Unsafe</a></body></html>`,
      "omtexterna"
    )
    expect(parseHTML(`<body>${output}</body>`).document.querySelector("a")
      ?.hasAttribute("href")).toBe(false)
  })

  test.each([
    ["h1", "title", "clear: both", "clear: both"],
    ["h2", "section title", " CLEAR : BOTH ; ", "clear: both"],
    ["ul", "itemizedlist", "list-style-type: disc; ", "list-style-type: disc"]
  ])("canonicalizes the one complete SLA %s style", (element, className, style, expected) => {
    const output = parseAuthorDocumentBody(
      `<!doctype html><html><body><${element} class="${className}" style="${style}">Safe</${element}></body></html>`,
      "omtexterna"
    )
    expect(parseHTML(`<body>${output}</body>`).document.querySelector(element)
      ?.getAttribute("style")).toBe(expected)
  })

  test.each([
    ["h1", "clear: both; color: red"],
    ["h1", "clear: both; clear: both"],
    ["h1", "clear: both;;"],
    ["h1", "cl\\65 ar: both"],
    ["h1", "clear/**/: both"],
    ["h1", "clear: var(--probe)"],
    ["h1", "clear: url(https://evil.test)"],
    ["h1", "--probe: both"],
    ["h1", "clear: both !important"],
    ["ul", "list-style-type: disc; color: red"],
    ["ul", "list-style-type: disc!important"],
    ["p", "clear: both"]
  ])("drops the full unsafe SLA style %#", (element, style) => {
    const output = parseAuthorDocumentBody(
      `<!doctype html><html><body><${element} style="${style}">Safe</${element}></body></html>`,
      "omtexterna"
    )
    expect(parseHTML(`<body>${output}</body>`).document.querySelector(element)
      ?.hasAttribute("style")).toBe(false)
  })

  test.each([
    ["h1", "other", "clear: both"],
    ["h2", "", "clear: both"],
    ["ul", "other", "list-style-type: disc"]
  ])("drops the otherwise safe style outside the exact title/list class %#", (
    element,
    className,
    style
  ) => {
    const output = parseAuthorDocumentBody(
      `<!doctype html><html><body><${element} class="${className}" style="${style}">Safe</${element}></body></html>`,
      "omtexterna"
    )
    expect(parseHTML(`<body>${output}</body>`).document.querySelector(element)
      ?.hasAttribute("style")).toBe(false)
  })

  test.each(["presentation", "bibliografi", "semer"] as const)(
    "continues to strip every inline style from %s documents",
    kind => {
      const output = parseAuthorDocumentBody(
        '<!doctype html><html><body><h1 style="clear: both">Safe</h1></body></html>',
        kind
      )
      expect(parseHTML(`<body>${output}</body>`).document.querySelector("h1")
        ?.hasAttribute("style")).toBe(false)
    }
  )

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

const event = {} as H3Event

function stubAuthorRuntimeConfig() {
  vi.stubGlobal("useRuntimeConfig", vi.fn(() => ({
    apiBase: "https://private-api.test/v2",
    contentBase: "https://managed.test/"
  })))
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  })
}

function htmlResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init
  })
}

function stubSlaResponses(sourceResponse: Response) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(jsonResponse(lagerlofOmtexterna))
    .mockResolvedValueOnce(sourceResponse)
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

async function expectUnavailable(promise: Promise<unknown>, statusCode: 404 | 502, code: string) {
  await expect(promise).rejects.toMatchObject({ statusCode, data: { code } })
  await expect(promise).rejects.not.toThrow(/private-api|managed\.test|upstream-probe/iu)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("SLA author document transport boundary", () => {
  test("uses only the fixed private descriptor and source requests", async () => {
    stubAuthorRuntimeConfig()
    const fetchMock = stubSlaResponses(htmlResponse(
      "<!doctype html><html><body><h1 class=\"title\" style=\"clear: both\">Safe</h1></body></html>"
    ))

    await expect(loadAuthorDocument(event, "LagerlöfS", "omtexterna"))
      .resolves.toMatchObject({
        documentKind: "omtexterna",
        bodyHtml: '<h1 class="title" style="clear: both">Safe</h1>'
      })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const descriptorRequest = fetchMock.mock.calls[0]?.[0] as Request
    expect(descriptorRequest.url).toBe(
      "https://private-api.test/v2/authors/Lagerl%C3%B6fS/documents/omtexterna"
    )
    expect(descriptorRequest.redirect).toBe("manual")
    expect(fetchMock.mock.calls[1]).toEqual([
      "https://managed.test/red/sla/omtexterna.html",
      { method: "GET", redirect: "manual" }
    ])
  })

  test.each([
    [404, "text/plain", 404, "author_document_not_found"],
    [503, "text/plain", 502, "author_document_unavailable"],
    [301, "text/html", 502, "author_document_unavailable"],
    [302, "text/html", 502, "author_document_unavailable"],
    [307, "text/html", 502, "author_document_unavailable"],
    [308, "text/html", 502, "author_document_unavailable"],
    [200, "application/xhtml+xml", 502, "author_document_unavailable"]
  ] as const)("cancels a rejected SLA source response %#", async (
    sourceStatus,
    contentType,
    publicStatus,
    code
  ) => {
    stubAuthorRuntimeConfig()
    const source = new Response("upstream-probe", {
      status: sourceStatus,
      headers: { "content-type": contentType }
    })
    const cancel = vi.spyOn(source.body!, "cancel")
    stubSlaResponses(source)

    await expectUnavailable(
      loadAuthorDocument(event, "LagerlöfS", "omtexterna"),
      publicStatus,
      code
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  test.each([
    "text/plain",
    "application/xhtml+xml",
    "text/html-malformed",
    "text/html; boundary=x",
    "text/html; charset=utf-8; boundary=x",
    ""
  ])("rejects and cancels the non-exact SLA media type %#", async contentType => {
    stubAuthorRuntimeConfig()
    const source = new Response("upstream-probe", {
      status: 200,
      headers: contentType ? { "content-type": contentType } : {}
    })
    const cancel = vi.spyOn(source.body!, "cancel")
    stubSlaResponses(source)

    await expectUnavailable(
      loadAuthorDocument(event, "LagerlöfS", "omtexterna"),
      502,
      "author_document_unavailable"
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  test.each([
    "text/html",
    " TEXT/HTML ",
    "text/html; charset=UTF-8",
    'text/html; CHARSET="utf-8"'
  ])("accepts the exact SLA media type with optional charset %#", async contentType => {
    stubAuthorRuntimeConfig()
    stubSlaResponses(new Response(
      "<!doctype html><html><body><p>Safe</p></body></html>",
      { status: 200, headers: { "content-type": contentType } }
    ))

    await expect(loadAuthorDocument(event, "LagerlöfS", "omtexterna"))
      .resolves.toMatchObject({ documentKind: "omtexterna", bodyHtml: "<p>Safe</p>" })
  })

  test.each([
    [404, 404, "author_document_author_not_found"],
    [503, 502, "author_document_unavailable"],
    [307, 502, "author_document_unavailable"],
    [308, 502, "author_document_unavailable"]
  ] as const)("cancels a rejected descriptor response %#", async (
    descriptorStatus,
    publicStatus,
    code
  ) => {
    stubAuthorRuntimeConfig()
    const descriptorResponse = jsonResponse({ upstream: "probe" }, descriptorStatus)
    const cancel = vi.spyOn(descriptorResponse.body!, "cancel")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(descriptorResponse))

    await expectUnavailable(
      loadAuthorDocument(event, "LagerlöfS", "omtexterna"),
      publicStatus,
      code
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  test("preserves the legacy media-type and larger-cap behavior for existing kinds", async () => {
    stubAuthorRuntimeConfig()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(descriptor()))
      .mockResolvedValueOnce(new Response(
        "<!doctype html><html><body><h1 style=\"clear: both\">Safe</h1></body></html>",
        { status: 200, headers: { "content-type": "application/xhtml+xml" } }
      ))
    vi.stubGlobal("fetch", fetchMock)

    await expect(loadAuthorDocument(event, "SöderbergH", "presentation"))
      .resolves.toMatchObject({ documentKind: "presentation", bodyHtml: "<h1>Safe</h1>" })
  })

  test("cancels an over-limit declared SLA body before reading", async () => {
    stubAuthorRuntimeConfig()
    let readerRequested = false
    const cancel = vi.fn(async () => undefined)
    const source = {
      status: 200,
      headers: new Headers({
        "content-type": "text/html; charset=utf-8",
        "content-length": "262145"
      }),
      body: {
        cancel,
        getReader() {
          readerRequested = true
          throw new Error("declared oversize must not be read")
        }
      }
    } as unknown as Response
    stubSlaResponses(source)

    await expectUnavailable(
      loadAuthorDocument(event, "LagerlöfS", "omtexterna"),
      502,
      "author_document_unavailable"
    )
    expect(cancel).toHaveBeenCalledOnce()
    expect(readerRequested).toBe(false)
  })

  test("cancels a streamed SLA body immediately after crossing 262144 bytes", async () => {
    stubAuthorRuntimeConfig()
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(200_000).fill(120))
        controller.enqueue(new Uint8Array(62_145).fill(120))
      },
      cancel() {
        cancelled = true
      }
    })
    stubSlaResponses(htmlResponse(body))

    await expectUnavailable(
      loadAuthorDocument(event, "LagerlöfS", "omtexterna"),
      502,
      "author_document_unavailable"
    )
    expect(cancelled).toBe(true)
  })

  test("accepts an SLA body at exactly 262144 streamed bytes", async () => {
    stubAuthorRuntimeConfig()
    const prefix = "<!doctype html><html><body><p>"
    const suffix = "</p></body></html>"
    const source = `${prefix}${"x".repeat(262_144 - prefix.length - suffix.length)}${suffix}`
    expect(Buffer.byteLength(source)).toBe(262_144)
    stubSlaResponses(htmlResponse(source))

    await expect(loadAuthorDocument(event, "LagerlöfS", "omtexterna"))
      .resolves.toMatchObject({ documentKind: "omtexterna" })
  })

  test("maps an SLA source fetch rejection without leaking its error", async () => {
    stubAuthorRuntimeConfig()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(lagerlofOmtexterna))
      .mockRejectedValueOnce(new Error("upstream-probe fetch rejected"))
    vi.stubGlobal("fetch", fetchMock)

    await expectUnavailable(
      loadAuthorDocument(event, "LagerlöfS", "omtexterna"),
      502,
      "author_document_unavailable"
    )
  })
})
