import { readFileSync } from "node:fs"

import type { H3Event } from "h3"
import { parseHTML } from "linkedom"
import { afterEach, describe, expect, test, vi } from "vitest"

import type { components } from "../../app/lib/api/generated/lbapi"
import {
  InvalidSlaArticleSource,
  expectedSlaArticleSource,
  loadSlaArticle,
  parseSlaArticleBody
} from "../../server/utils/sla-article"
import { slaArticleDescriptors, slaArticleFixtures } from "../fixtures/sla-article-data.mjs"

type Descriptor = components["schemas"]["SlaArticleDescriptor"]

const articleId = "TextkritiskaRiktlinjer.html" as const
const exactDescriptor = slaArticleDescriptors[articleId] as Descriptor

function descriptor(overrides: Partial<Descriptor> = {}): Descriptor {
  return { ...exactDescriptor, ...overrides }
}

describe("strict SLA article descriptors", () => {
  test("accepts only the exact requested tuple and registry-owned source", () => {
    expect(expectedSlaArticleSource(exactDescriptor, "LagerlöfS", articleId))
      .toBe("/red/sla/TextkritiskaRiktlinjer.html")
  })

  test("accepts a registry-owned article without an audio recording", () => {
    expect(expectedSlaArticleSource(
      descriptor({ audio_url: null }),
      "LagerlöfS",
      articleId
    )).toBe("/red/sla/TextkritiskaRiktlinjer.html")
  })

  test.each([
    { author_id: "SöderbergH" },
    { normalized_author_id: "LagerlöfS" },
    { full_name: "Provider probe" },
    { birth_year: null },
    { death_year: "0000" },
    { has_introduction: false },
    { has_dramawebben: false },
    { search_url: null },
    { document_kind: "presentation" },
    { article_id: "Introduktion.html" },
    { source_path: "/red/sla/Introduktion.html" },
    { source_path: "/red/sla/TextkritiskaRiktlinjer.html?raw=1" },
    { source_path: "/red/sla/%54extkritiskaRiktlinjer.html" },
    { search_url: "/sok?forfattare=LagerlofS&avancerad" },
    { audio_url: "https://evil.test/ljudochbild/författare/lagerlofs" }
  ])("rejects an inexact descriptor field %#", overrides => {
    expect(() => expectedSlaArticleSource(
      descriptor(overrides as Partial<Descriptor>),
      "LagerlöfS",
      articleId
    )).toThrow("Invalid SLA article descriptor")
  })

  test("rejects extra fields at the strict local schema boundary", () => {
    expect(() => expectedSlaArticleSource(
      { ...exactDescriptor, unexpected: "must not cross" },
      "LagerlöfS",
      articleId
    )).toThrow("Invalid SLA article descriptor")
  })
})

function parsedBody(source: string) {
  return parseHTML(`<body>${source}</body>`).document
}

const allowedElements = new Set([
  "a", "blockquote", "br", "col", "colgroup", "div", "em", "h1", "h2", "h3",
  "hr", "li", "ol", "p", "span", "strong", "sup", "table", "tbody", "td", "th",
  "thead", "tr", "ul"
])

describe("bounded SLA article sanitization", () => {
  test("preserves the complete frozen 23-body href ledger except malformed italic", () => {
    for (const article of slaArticleFixtures) {
      const source = readFileSync(
        new URL(`../fixtures/sla-article-content/${article.file}`, import.meta.url),
        "utf8"
      )
      const sourceDocument = parseHTML(source).document
      const expectedHrefs = [...sourceDocument.querySelectorAll("body a[href]")]
        .map(anchor => anchor.getAttribute("href"))
        .filter(href => href !== "italic")

      const output = parseSlaArticleBody(source)
      const outputDocument = parsedBody(output)
      const actualHrefs = [...outputDocument.querySelectorAll("a[href]")]
        .map(anchor => anchor.getAttribute("href"))

      expect(actualHrefs, article.articleId).toEqual(expectedHrefs)
      expect([...outputDocument.querySelectorAll("*")].every(element =>
        element.localName === "body" || allowedElements.has(element.localName)
      ), article.articleId).toBe(true)
      expect(output, article.articleId).not.toMatch(/<(?:html|head|body|title|meta)\b/iu)
      expect(output, article.articleId).not.toMatch(/\s(?:on\w+|srcdoc|xml:lang|data-[\w-]+)=/iu)
    }
  })

  test("keeps every frozen fragment paired with a retained same-body id", () => {
    for (const article of slaArticleFixtures) {
      const source = readFileSync(
        new URL(`../fixtures/sla-article-content/${article.file}`, import.meta.url),
        "utf8"
      )
      const document = parsedBody(parseSlaArticleBody(source))
      for (const anchor of document.querySelectorAll("a[href^='#']")) {
        const href = anchor.getAttribute("href")!
        expect(document.getElementById(href.slice(1)), `${article.articleId}: ${href}`)
          .not.toBeNull()
      }
    }
  })

  test("retains exactly the audited semantic table/list/anchor attributes", () => {
    const output = parseSlaArticleBody([
      "<!doctype html><html><body>",
      '<div class="article" id="idm1" lang="sv" xml:lang="sv" title="drop" data-x="drop">',
      '<a class="footnote" id="ftn.idm1" href="#idm1" target="_top" rel="external" download="drop">Note</a>',
      '<ol class="orderedlist" type="I" start="2"><li>One</li></ol>',
      '<table border="1" summary="Trygg sammanfattning" cellpadding="2"><colgroup><col class="c1"></colgroup>',
      '<thead><tr><th colspan="2" rowspan="2">H</th></tr></thead>',
      '<tbody><tr><td class="auto-generated" colspan="2">D</td></tr></tbody></table>',
      "</div></body></html>"
    ].join(""))
    const document = parsedBody(output)

    expect([...document.querySelector("div")!.attributes].map(attribute => attribute.name).sort())
      .toEqual(["class", "id", "lang"])
    expect([...document.querySelector("a")!.attributes].map(attribute => attribute.name).sort())
      .toEqual(["class", "href", "id", "rel", "target"])
    expect([...document.querySelector("ol")!.attributes].map(attribute => attribute.name).sort())
      .toEqual(["class", "type"])
    expect([...document.querySelector("table")!.attributes].map(attribute => attribute.name).sort())
      .toEqual(["border", "summary"])
    expect([...document.querySelector("th")!.attributes].map(attribute => attribute.name).sort())
      .toEqual(["colspan"])
    expect([...document.querySelector("td")!.attributes].map(attribute => attribute.name).sort())
      .toEqual(["class"])
  })

  test("preserves HTML-safe line controls and removes an unsafe summary control", () => {
    const output = parseSlaArticleBody([
      "<!doctype html><html><body>",
      '<table id="safe" summary="tab\tline\nreturn\r"><tr><td>Safe</td></tr></table>',
      '<table id="unsafe" summary="vertical\u000btab"><tr><td>Unsafe</td></tr></table>',
      "</body></html>"
    ].join(""))
    const document = parsedBody(output)

    expect(document.querySelector("#safe")?.hasAttribute("summary")).toBe(true)
    expect(document.querySelector("#unsafe")?.hasAttribute("summary")).toBe(false)
  })

  test("removes active subtrees and unwraps unknown inert elements", () => {
    const output = parseSlaArticleBody([
      "<!doctype html><html><head><title>head-probe</title></head><body>",
      "<!-- comment-probe --><script>script-probe</script><style>style-probe</style>",
      "<form><p>form-probe</p></form><iframe>iframe-probe</iframe>",
      "<svg><text>svg-probe</text></svg><template>template-probe</template>",
      "<section>unwrapped <mark>nested <em>kept</em></mark></section>",
      "</body></html>"
    ].join(""))
    expect(output).toContain("unwrapped nested <em>kept</em>")
    expect(output).not.toMatch(/(?:head|comment|script|style|form|iframe|svg|template)-probe/iu)
    expect(output).not.toMatch(/<(?:section|mark)\b/iu)
  })

  test.each([
    ["h1", "title", " CLEAR : BOTH ; ", "clear: both"],
    ["h2", "title", "clear:both", "clear: both"],
    ["ul", "itemizedlist", " list-style-type : disc ; ", "list-style-type: disc"],
    ["hr", "", "width:100; text-align:left;margin-left: 0", "width: 100; text-align: left; margin-left: 0"]
  ])("canonicalizes the complete audited %s style", (element, className, style, expected) => {
    const output = parseSlaArticleBody(
      `<!doctype html><html><body><${element} class="${className}" style="${style}">Safe</${element}></body></html>`
    )
    expect(parsedBody(output).querySelector(element)?.getAttribute("style")).toBe(expected)
  })

  test.each([
    ["h1", "title", "clear: both; color: red"],
    ["h2", "title", "clear: both; clear: both"],
    ["h1", "title", "cl\\65 ar: both"],
    ["h2", "title", "clear/**/: both"],
    ["ul", "itemizedlist", "list-style-type: var(--probe)"],
    ["hr", "", "width:100; text-align:left; margin-left:url(https://evil.test)"],
    ["hr", "", "width:100; text-align:left; margin-left:0!important"],
    ["h1", "other", "clear: both"]
  ])("drops the entire mixed, duplicate, escaped, or misplaced style %#", (
    element,
    className,
    style
  ) => {
    const output = parseSlaArticleBody(
      `<!doctype html><html><body><${element} class="${className}" style="${style}">Safe</${element}></body></html>`
    )
    expect(parsedBody(output).querySelector(element)?.hasAttribute("style")).toBe(false)
  })

  test.each([
    "#idm1",
    "/författare/LagerlöfS",
    "/forfattare/LagerlofS",
    "/författare/LagerlöfS/titlar/GostaBerlingsSaga/info",
    "/forfattare/LagerlofS/titlar/GostaBerlingsSaga/sida/1/etext",
    "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/2/faksimil/",
    "/författare/LagerlöfS/omtexterna/Introduktion.html",
    "/forfattare/LagerlofS/omtexterna/SelmaLagerlofShort.html",
    "/författare/LagerlöfS/titlar",
    "/författare/LagerlöfS/jamfor",
    "/författare/LagerlöfS/jamfor.html",
    "/författare/LagerlöfS/SelmaLagerlofEnglish",
    "/författare/LagerlöfS/omtexterna",
    "/bibliotek?sort=titlar&filter=selma%20lagerlöf",
    "/red/sla/VisualiseringGBSms.pdf",
    "/red/om/omtexerna/ManuskriptforteckningOL.pdf",
    "http://www.svenskavitterhetssamfundet.se/",
    "https://example.test/editorial"
  ])("retains one bounded href family %#", href => {
    const target = href === "#idm1" ? '<span id="idm1">Target</span>' : ""
    const output = parseSlaArticleBody(
      `<!doctype html><html><body><a href="${href}" target="_top">Safe</a>${target}</body></html>`
    )
    expect(parsedBody(output).querySelector("a")?.getAttribute("href")).toBe(href)
  })

  test.each([
    "italic",
    "relative.html",
    "//evil.test/path",
    "\\\\evil.test\\path",
    "javascript:alert(1)",
    "https://user:pass@example.test/path",
    "/författare/LagerlöfS/omtexterna/Unknown.html",
    "/författare/LagerlöfS/omtexterna/introduktion.html",
    "/författare/LagerlöfS/omtexterna/%49ntroduktion.html",
    "/författare/LagerlöfS/omtexterna/../private",
    "/författare/LagerlöfS/omtexterna/%252e%252e/private",
    "/författare/LagerlöfS/titlar/Title/sida/1/etext?x=1",
    "/författare/LagerlöfS?x=1",
    "/bibliotek?filter=selma%20lagerlöf&sort=titlar",
    "/bibliotek?sort=titlar&filter=selma%2520lagerlöf",
    "/red/sla/Other.pdf",
    "/unregistered/root",
    "/%ZZ/private",
    " https://example.test"
  ])("removes an href outside the closed policy %#", href => {
    const output = parseSlaArticleBody(
      `<!doctype html><html><body><a href="${href}" target="_top" rel="external">Unsafe</a></body></html>`
    )
    const anchor = parsedBody(output).querySelector("a")!
    expect(anchor.hasAttribute("href")).toBe(false)
    expect(anchor.hasAttribute("target")).toBe(false)
    expect(anchor.hasAttribute("rel")).toBe(false)
  })

  test("drops a fragment href when its target is removed or missing", () => {
    const output = parseSlaArticleBody([
      "<!doctype html><html><body>",
      '<a href="#missing" target="_top">Missing</a>',
      '<a href="#inside-active">Removed</a><script id="inside-active">bad</script>',
      "</body></html>"
    ].join(""))
    expect([...parsedBody(output).querySelectorAll("a")].every(anchor =>
      !anchor.hasAttribute("href") && !anchor.hasAttribute("target")
    )).toBe(true)
  })

  test.each([
    "<p>No body</p>",
    "<!doctype html><html><head></head></html>",
    "<!doctype html><html><body>one</body><body>two</body></html>",
    "not html"
  ])("rejects missing, multiple, or malformed bodies %#", source => {
    expect(() => parseSlaArticleBody(source)).toThrow(InvalidSlaArticleSource)
  })

  test("is deterministic and idempotent", () => {
    const source = readFileSync(
      new URL("../fixtures/sla-article-content/Introduktion.html", import.meta.url),
      "utf8"
    )
    const once = parseSlaArticleBody(source)
    expect(parseSlaArticleBody(`<!doctype html><html><body>${once}</body></html>`)).toBe(once)
  })
})

const event = {} as H3Event

function stubRuntimeConfig() {
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

async function expectUnavailable(
  promise: Promise<unknown>,
  statusCode: 404 | 502,
  code: string
) {
  await expect(promise).rejects.toMatchObject({ statusCode, data: { code } })
  await expect(promise).rejects.not.toThrow(/private-api|managed\.test|upstream-probe/iu)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("SLA article transport boundary", () => {
  test("uses only the exact typed descriptor and registry-owned source requests", async () => {
    stubRuntimeConfig()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(exactDescriptor))
      .mockResolvedValueOnce(htmlResponse(
        '<!doctype html><html><body><h1 class="title" style="clear: both">Safe</h1></body></html>'
      ))
    vi.stubGlobal("fetch", fetchMock)

    await expect(loadSlaArticle(event, "LagerlöfS", articleId)).resolves.toEqual({
      author: {
        authorId: "LagerlöfS",
        fullName: "Selma Lagerlöf",
        lifespan: "1858-1940",
        hasIntroduction: true,
        hasDramawebben: true,
        searchUrl: "/sok?forfattare=Lagerl%C3%B6fS&avancerad",
        audioUrl: "https://litteraturbanken.se/ljudochbild/författare/lagerlofs"
      },
      articleId,
      sourcePath: "/red/sla/TextkritiskaRiktlinjer.html",
      bodyHtml: '<h1 class="title" style="clear: both">Safe</h1>'
    })

    const descriptorRequest = fetchMock.mock.calls[0]?.[0] as Request
    expect(descriptorRequest.url).toBe(
      "https://private-api.test/v2/authors/Lagerl%C3%B6fS/documents/omtexterna/articles/TextkritiskaRiktlinjer.html"
    )
    expect(descriptorRequest.redirect).toBe("manual")
    expect(fetchMock.mock.calls[1]).toEqual([
      "https://managed.test/red/sla/TextkritiskaRiktlinjer.html",
      { method: "GET", redirect: "manual" }
    ])
  })

  test("loads article HTML when the descriptor has no audio recording", async () => {
    stubRuntimeConfig()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(descriptor({ audio_url: null })))
      .mockResolvedValueOnce(htmlResponse(
        "<!doctype html><html><body><p>Safe article</p></body></html>"
      ))
    vi.stubGlobal("fetch", fetchMock)

    const article = await loadSlaArticle(event, "LagerlöfS", articleId)

    expect(article.author.audioUrl).toBeNull()
    expect(article.bodyHtml).toBe("<p>Safe article</p>")
    expect(fetchMock.mock.calls[1]).toEqual([
      "https://managed.test/red/sla/TextkritiskaRiktlinjer.html",
      { method: "GET", redirect: "manual" }
    ])
  })

  test("rejects and cancels an invalid descriptor before source fetching", async () => {
    stubRuntimeConfig()
    const response = jsonResponse({ ...exactDescriptor, unexpected: "upstream-probe" })
    const cancel = vi.spyOn(response.body!, "cancel")
    const fetchMock = vi.fn().mockResolvedValueOnce(response)
    vi.stubGlobal("fetch", fetchMock)

    await expectUnavailable(
      loadSlaArticle(event, "LagerlöfS", articleId),
      502,
      "sla_article_unavailable"
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()
  })

  test.each([
    [404, "text/html", 404, "sla_article_not_found"],
    [503, "text/html", 502, "sla_article_unavailable"],
    [302, "text/html", 502, "sla_article_unavailable"],
    [200, "application/xhtml+xml", 502, "sla_article_unavailable"]
  ] as const)("rejects and cancels source status/media %#", async (
    status,
    contentType,
    publicStatus,
    code
  ) => {
    stubRuntimeConfig()
    const source = new Response("upstream-probe", {
      status,
      headers: { "content-type": contentType }
    })
    const cancel = vi.spyOn(source.body!, "cancel")
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(exactDescriptor))
      .mockResolvedValueOnce(source))

    await expectUnavailable(
      loadSlaArticle(event, "LagerlöfS", articleId),
      publicStatus,
      code
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  test.each([
    "text/html; charset=iso-8859-1",
    'text/html; charset="windows-1252"'
  ])("rejects and cancels a non-UTF-8 SLA article declaration %#", async contentType => {
    stubRuntimeConfig()
    const source = new Response("<!doctype html><html><body><p>Safe</p></body></html>", {
      status: 200,
      headers: { "content-type": contentType }
    })
    const cancel = vi.spyOn(source.body!, "cancel")
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(exactDescriptor))
      .mockResolvedValueOnce(source))

    await expectUnavailable(
      loadSlaArticle(event, "LagerlöfS", articleId),
      502,
      "sla_article_unavailable"
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  test("cancels a declared body above 262144 before reading", async () => {
    stubRuntimeConfig()
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
          throw new Error("must not read")
        }
      }
    } as unknown as Response
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(exactDescriptor))
      .mockResolvedValueOnce(source))

    await expectUnavailable(
      loadSlaArticle(event, "LagerlöfS", articleId),
      502,
      "sla_article_unavailable"
    )
    expect(cancel).toHaveBeenCalledOnce()
    expect(readerRequested).toBe(false)
  })

  test("cancels a streamed body immediately after crossing 262144 bytes", async () => {
    stubRuntimeConfig()
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
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(exactDescriptor))
      .mockResolvedValueOnce(htmlResponse(body)))

    await expectUnavailable(
      loadSlaArticle(event, "LagerlöfS", articleId),
      502,
      "sla_article_unavailable"
    )
    expect(cancelled).toBe(true)
  })
})
