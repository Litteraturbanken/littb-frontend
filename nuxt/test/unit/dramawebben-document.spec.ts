import { readFileSync } from "node:fs"
import type { H3Event } from "h3"
import { parseHTML } from "linkedom"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  InvalidDramawebbenDocumentSource,
  loadDramawebbenDocument,
  parseDramawebbenDocumentBody
} from "../../server/utils/dramawebben-document"

const event = {} as H3Event
const maxBytes = 262_144

function managedResponse(
  body: BodyInit | null,
  init: ResponseInit = {}
): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init
  })
}

async function expectDocumentError(
  promise: Promise<unknown>,
  statusCode: 404 | 502,
  code: "dramawebben_document_not_found" | "dramawebben_document_unavailable"
) {
  await expect(promise).rejects.toMatchObject({
    statusCode,
    data: { code }
  })
  await expect(promise).rejects.not.toThrow(/managed\.test|upstream-payload-probe/iu)
}

function stubRuntimeConfig() {
  vi.stubGlobal("useRuntimeConfig", vi.fn(() => ({
    contentBase: "https://managed.test/"
  })))
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Dramawebben managed XHTML parsing", () => {
  test.each([
    ["om", "om.html", "Om Dramawebben"],
    ["kringtexter", "kringtexter.html", "Mer läsning om svensk dramatik"]
  ] as const)("preserves the current %s fixture inside the exact policy", (_, file, heading) => {
    const source = readFileSync(
      new URL(`../fixtures/dramawebben-content/${file}`, import.meta.url),
      "utf8"
    )
    const output = parseDramawebbenDocumentBody(source)
    const { document } = parseHTML(`<body>${output}</body>`)

    expect(document.querySelector("h2")?.textContent?.trim()).toBe(heading)
    expect(document.querySelectorAll("a").length).toBeGreaterThan(0)
    expect(output).not.toMatch(/<(?:html|head|body|title|meta)\b/iu)
    expect(output).not.toMatch(/<(?:script|style|form|iframe|object|svg|math)\b/iu)
    expect(output).not.toMatch(/\s(?:style|on\w+|srcdoc|id|lang|title)=/iu)
  })

  test("returns exactly the one body and strips document metadata and comments", () => {
    const output = parseDramawebbenDocumentBody([
      "<!doctype html><html><head><title>upstream-title</title>",
      '<meta name="private" content="upstream-head"></head><body>',
      '<div class="managed" id="drop"><h2>Body</h2><!-- body-comment --></div>',
      "</body></html>"
    ].join(""))

    expect(output).toBe('<div class="managed"><h2>Body</h2></div>')
    expect(output).not.toMatch(/doctype|upstream-title|upstream-head|body-comment/iu)
  })

  test.each([
    "<p>No explicit body</p>",
    "<!doctype html><html><head><title>No body</title></head></html>",
    "<!doctype html><html><body>one</body><body>two</body></html>"
  ])("rejects documents without exactly one body %#", source => {
    expect(() => parseDramawebbenDocumentBody(source))
      .toThrow(InvalidDramawebbenDocumentSource)
  })

  test("removes dangerous subtrees and unwraps every other unknown element", () => {
    const output = parseDramawebbenDocumentBody([
      "<!doctype html><html><body>",
      "<script>script-probe</script><style>style-probe</style>",
      "<form><p>form-probe</p></form><iframe>iframe-probe</iframe>",
      "<object>object-probe</object><svg><text>svg-probe</text></svg>",
      "<math><mi>math-probe</mi></math>",
      "<section>Unwrapped <span>also unwrapped <strong>kept</strong></span></section>",
      "</body></html>"
    ].join(""))

    for (const marker of [
      "script-probe", "style-probe", "form-probe", "iframe-probe",
      "object-probe", "svg-probe", "math-probe"
    ]) expect(output, marker).not.toContain(marker)
    expect(output).toContain("Unwrapped also unwrapped <strong>kept</strong>")
    expect(output).not.toMatch(/<(?:section|span)\b/iu)
  })

  test("retains only class globally and href, target, and rel on anchors", () => {
    const output = parseDramawebbenDocumentBody([
      "<!doctype html><html><body>",
      '<div class="kept" id="drop" lang="sv" title="drop" style="color:red" onclick="bad()">',
      '<a class="link" href="/safe" target="_self" rel="external" download data-x="drop">Safe</a>',
      "</div></body></html>"
    ].join(""))
    const { document } = parseHTML(`<body>${output}</body>`)
    const div = document.querySelector("div")
    const anchor = document.querySelector("a")

    expect([...div!.attributes].map(attribute => attribute.name)).toEqual(["class"])
    expect(anchor?.getAttribute("class")).toBe("link")
    expect(anchor?.getAttribute("href")).toBe("/safe")
    expect(anchor?.hasAttribute("target")).toBe(false)
    expect(anchor?.getAttribute("rel")).toBe("external")
    expect([...anchor!.attributes].map(attribute => attribute.name).sort())
      .toEqual(["class", "href", "rel"])
  })

  test.each([
    ["C0 control", "safe\u0001unsafe"],
    ["C1 control", "safe\u0085unsafe"],
    ["lone surrogate", "safe\ud800unsafe"],
    ["invalid token", "safe 1unsafe"],
    ["oversized token", `safe ${"a".repeat(65)}`],
    ["oversized value", Array.from(
      { length: 60 }, (_, index) => `class${String(index).padStart(4, "0")}`
    ).join(" ")]
  ])("removes a class with an unsafe %s", (_, value) => {
    const output = parseDramawebbenDocumentBody(
      `<!doctype html><html><body><div class="${value}">Body</div></body></html>`
    )
    expect(parseHTML(`<body>${output}</body>`).document.querySelector("div")
      ?.hasAttribute("class")).toBe(false)
  })

  test.each([
    ["C0 control", "external\u0001unsafe"],
    ["C1 control", "external\u0085unsafe"],
    ["lone surrogate", "external\udfffunsafe"],
    ["invalid token", "external unsafe_token"],
    ["oversized token", `external ${"a".repeat(33)}`],
    ["oversized value", Array.from(
      { length: 15 }, (_, index) => `relation${String(index).padStart(2, "0")}`
    ).join(" ")]
  ])("removes a rel with an unsafe %s", (_, value) => {
    const output = parseDramawebbenDocumentBody(
      `<!doctype html><html><body><a href="/safe" rel="${value}">Safe</a></body></html>`
    )
    expect(parseHTML(`<body>${output}</body>`).document.querySelector("a")
      ?.hasAttribute("rel")).toBe(false)
  })

  test("preserves class and rel tokens at their compatibility ceilings", () => {
    const className = `a${"1".repeat(63)}`
    const rel = `a${"1".repeat(31)}`
    const output = parseDramawebbenDocumentBody(
      `<!doctype html><html><body><a class="${className}" href="/safe" rel="${rel}">Safe</a></body></html>`
    )
    const anchor = parseHTML(`<body>${output}</body>`).document.querySelector("a")

    expect(anchor?.getAttribute("class")).toBe(className)
    expect(anchor?.getAttribute("rel")).toBe(rel)
  })

  test.each([
    ["fragment", "#section"],
    ["root relative", "/dramawebben/om?x=1#section"],
    ["absolute HTTPS", "https://example.test/path?q=1#section"]
  ])("preserves a safe %s href", (_, href) => {
    const output = parseDramawebbenDocumentBody(
      `<!doctype html><html><body><a href="${href}">Safe</a></body></html>`
    )
    expect(parseHTML(`<body>${output}</body>`).document.querySelector("a")?.getAttribute("href"))
      .toBe(href)
  })

  test.each([
    "relative/page.html",
    "../private",
    "//evil.test/path",
    "http://example.test/path",
    "javascript:alert(1)",
    "data:text/html,evil",
    "/../private",
    "/%2e%2e/private",
    "/%252e%252e/private",
    "/safe%0Aevil",
    "/safe\udfff",
    "https://example.test/%2e%2e/private",
    "https://example.test/path\\evil",
    "/%ZZ/private"
  ])("removes an unsafe href %#", href => {
    const output = parseDramawebbenDocumentBody(
      `<!doctype html><html><body><a href="${href}">Unsafe</a></body></html>`
    )
    expect(parseHTML(`<body>${output}</body>`).document.querySelector("a")?.hasAttribute("href"))
      .toBe(false)
  })

  test("hardens only _blank targets and preserves existing rel tokens", () => {
    const output = parseDramawebbenDocumentBody([
      "<!doctype html><html><body>",
      '<a href="https://example.test" target="_blank" rel="external noopener">Blank</a>',
      '<a href="/safe" target="popup">Popup</a>',
      "</body></html>"
    ].join(""))
    const anchors = [...parseHTML(`<body>${output}</body>`).document.querySelectorAll("a")]

    expect(anchors[0]?.getAttribute("target")).toBe("_blank")
    expect(anchors[0]?.getAttribute("rel")).toBe("external noopener noreferrer")
    expect(anchors[1]?.hasAttribute("target")).toBe(false)
  })

  test("normalizes an unsafe _blank rel before applying opener hardening", () => {
    const output = parseDramawebbenDocumentBody(
      '<!doctype html><html><body><a href="https://example.test" target="_blank" rel="external unsafe_token">Blank</a></body></html>'
    )
    const anchor = parseHTML(`<body>${output}</body>`).document.querySelector("a")

    expect(anchor?.getAttribute("target")).toBe("_blank")
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer")
  })
})

describe("Dramawebben managed source boundary", () => {
  test.each([
    ["om", "/red/dramawebben/om.html"],
    ["kringtexter", "/red/dramawebben/kringtexter/kringtexter.html"]
  ] as const)("maps only %s to its exact server-controlled source", async (kind, path) => {
    stubRuntimeConfig()
    const fetchMock = vi.fn(async () => managedResponse(
      `<!doctype html><html><body><h2>${kind}</h2></body></html>`
    ))
    vi.stubGlobal("fetch", fetchMock)

    await expect(loadDramawebbenDocument(event, kind)).resolves.toEqual({
      documentKind: kind,
      bodyHtml: `<h2>${kind}</h2>`
    })
    expect(fetchMock).toHaveBeenCalledWith(`https://managed.test${path}`, {
      method: "GET",
      redirect: "manual",
      signal: expect.any(AbortSignal)
    })
  })

  test.each(["pjäser", "forfattare", "../om", "OM", ""])(
    "rejects the non-mapped kind %# before fetching",
    async kind => {
      stubRuntimeConfig()
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)

      await expectDocumentError(
        loadDramawebbenDocument(event, kind as never),
        404,
        "dramawebben_document_not_found"
      )
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  test("does not add public headers, cookies, authorization, or query state", async () => {
    stubRuntimeConfig()
    const fetchMock = vi.fn(async () => managedResponse(
      "<!doctype html><html><body><p>Safe</p></body></html>"
    ))
    vi.stubGlobal("fetch", fetchMock)

    await loadDramawebbenDocument({
      node: { req: { headers: { cookie: "probe=secret", authorization: "Bearer public" } } },
      context: { query: { repeat: ["one", "two"] } }
    } as unknown as H3Event, "om")

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]).toEqual([
      "https://managed.test/red/dramawebben/om.html",
      {
        method: "GET",
        redirect: "manual",
        signal: expect.any(AbortSignal)
      }
    ])
  })

  test("aborts a fetch that exceeds the managed-source deadline", async () => {
    vi.useFakeTimers()
    stubRuntimeConfig()
    let signal: AbortSignal | undefined
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return await new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new Error("fetch-timeout-upstream-probe"))
        }, { once: true })
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = loadDramawebbenDocument(event, "om")
    let rejection: unknown
    void result.catch(error => { rejection = error })
    await vi.advanceTimersByTimeAsync(10_000)

    expect(signal?.aborted).toBe(true)
    expect(rejection).toMatchObject({
      statusCode: 502,
      data: { code: "dramawebben_document_unavailable" }
    })
    await expectDocumentError(result, 502, "dramawebben_document_unavailable")
    await expect(result).rejects.not.toThrow(/fetch-timeout-upstream-probe/iu)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  test("cancels a response body that stalls past the same deadline", async () => {
    vi.useFakeTimers()
    stubRuntimeConfig()
    let signal: AbortSignal | undefined
    let markReadStarted!: () => void
    const readStarted = new Promise<void>(resolve => { markReadStarted = resolve })
    const cancel = vi.fn(async () => undefined)
    const read = vi.fn(async () => {
      markReadStarted()
      return await new Promise<ReadableStreamReadResult<Uint8Array>>(() => undefined)
    })
    const response = {
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      body: { getReader: () => ({ read, cancel }) }
    } as unknown as Response
    vi.stubGlobal("fetch", vi.fn(async (
      _input: string | URL | Request,
      init?: RequestInit
    ) => {
      signal = init?.signal ?? undefined
      return response
    }))

    const result = loadDramawebbenDocument(event, "om")
    let rejection: unknown
    void result.catch(error => { rejection = error })
    await readStarted
    await vi.advanceTimersByTimeAsync(10_000)

    expect(signal?.aborted).toBe(true)
    expect(cancel).toHaveBeenCalledOnce()
    expect(rejection).toMatchObject({
      statusCode: 502,
      data: { code: "dramawebben_document_unavailable" }
    })
    await expectDocumentError(result, 502, "dramawebben_document_unavailable")
    expect(vi.getTimerCount()).toBe(0)
  })

  test("does not accept a parseable partial body when cancellation settles its stalled read", async () => {
    vi.useFakeTimers()
    stubRuntimeConfig()
    const source = new TextEncoder().encode(
      "<!doctype html><html><body><p>partial-upstream-probe</p></body></html>"
    )
    let markReadStarted!: () => void
    const readStarted = new Promise<void>(resolve => { markReadStarted = resolve })
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(source)
      },
      pull() {
        markReadStarted()
        return new Promise<void>(() => undefined)
      },
      cancel
    })
    const response = managedResponse(body)
    vi.stubGlobal("fetch", vi.fn(async () => response))

    const result = loadDramawebbenDocument(event, "om")
    let rejection: unknown
    void result.catch(error => { rejection = error })
    await readStarted
    await vi.advanceTimersByTimeAsync(10_000)

    expect(cancel).toHaveBeenCalledOnce()
    expect(rejection).toMatchObject({
      statusCode: 502,
      data: { code: "dramawebben_document_unavailable" }
    })
    await expect(result).rejects.not.toThrow(/partial-upstream-probe/iu)
    expect(vi.getTimerCount()).toBe(0)
  })

  test("clears the deadline after a successful managed response", async () => {
    vi.useFakeTimers()
    stubRuntimeConfig()
    let signal: AbortSignal | undefined
    vi.stubGlobal("fetch", vi.fn(async (
      _input: string | URL | Request,
      init?: RequestInit
    ) => {
      signal = init?.signal ?? undefined
      return managedResponse("<!doctype html><html><body><p>Safe</p></body></html>")
    }))

    await expect(loadDramawebbenDocument(event, "om")).resolves.toMatchObject({
      documentKind: "om"
    })
    expect(signal?.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(20_000)
    expect(signal?.aborted).toBe(false)
  })

  test.each([
    [404, "dramawebben_document_not_found", 404],
    [502, "dramawebben_document_unavailable", 502]
  ] as const)("maps upstream %i to the local non-leaking error", async (
    upstreamStatus,
    code,
    publicStatus
  ) => {
    stubRuntimeConfig()
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream-payload-probe", {
      status: upstreamStatus,
      headers: { "content-type": "text/plain" }
    })))
    await expectDocumentError(loadDramawebbenDocument(event, "om"), publicStatus, code)
  })

  test("cancels an upstream 404 body before returning the local 404", async () => {
    stubRuntimeConfig()
    let readerRequested = false
    const cancel = vi.fn(async () => undefined)
    const response = {
      status: 404,
      headers: new Headers({ "content-type": "text/plain" }),
      body: {
        cancel,
        getReader() {
          readerRequested = true
          throw new Error("upstream 404 body must not be read")
        }
      }
    } as unknown as Response
    vi.stubGlobal("fetch", vi.fn(async () => response))

    await expectDocumentError(
      loadDramawebbenDocument(event, "om"),
      404,
      "dramawebben_document_not_found"
    )
    expect(cancel).toHaveBeenCalledOnce()
    expect(readerRequested).toBe(false)
  })

  test("maps a fetch rejection to the local non-leaking 502", async () => {
    stubRuntimeConfig()
    const fetchMock = vi.fn(async () => {
      throw new Error("fetch-rejection-upstream-probe")
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = loadDramawebbenDocument(event, "om")
    await expectDocumentError(result, 502, "dramawebben_document_unavailable")
    await expect(result).rejects.not.toThrow(/fetch-rejection-upstream-probe/iu)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  test.each([301, 302, 307, 308])("rejects manual upstream redirect %i", async status => {
    stubRuntimeConfig()
    const fetchMock = vi.fn(async () => new Response(null, {
      status,
      headers: { location: "https://evil.test/upstream-payload-probe" }
    }))
    vi.stubGlobal("fetch", fetchMock)

    await expectDocumentError(
      loadDramawebbenDocument(event, "om"),
      502,
      "dramawebben_document_unavailable"
    )
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  test.each(["text/plain", "application/xhtml+xml", "text/html-malformed", ""])(
    "rejects invalid content type %#",
    async contentType => {
      stubRuntimeConfig()
      vi.stubGlobal("fetch", vi.fn(async () => managedResponse(
        "<!doctype html><html><body>upstream-payload-probe</body></html>",
        { headers: contentType ? { "content-type": contentType } : {} }
      )))
      await expectDocumentError(
        loadDramawebbenDocument(event, "om"),
        502,
        "dramawebben_document_unavailable"
      )
    }
  )

  test("rejects an over-limit declared body before reading it", async () => {
    stubRuntimeConfig()
    let readerRequested = false
    let cancelled = false
    const response = {
      status: 200,
      headers: new Headers({
        "content-type": "text/html",
        "content-length": String(maxBytes + 1)
      }),
      body: {
        async cancel() {
          cancelled = true
        },
        getReader() {
          readerRequested = true
          throw new Error("declared over-limit body must not be read")
        }
      }
    } as unknown as Response
    vi.stubGlobal("fetch", vi.fn(async () => response))

    await expectDocumentError(
      loadDramawebbenDocument(event, "om"),
      502,
      "dramawebben_document_unavailable"
    )
    expect(readerRequested).toBe(false)
    expect(cancelled).toBe(true)
  })

  test("rejects a streamed body immediately after it crosses the byte cap", async () => {
    stubRuntimeConfig()
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(200_000).fill(120))
        controller.enqueue(new Uint8Array(maxBytes - 200_000 + 1).fill(120))
      },
      cancel() {
        cancelled = true
      }
    })
    vi.stubGlobal("fetch", vi.fn(async () => managedResponse(body)))

    await expectDocumentError(
      loadDramawebbenDocument(event, "om"),
      502,
      "dramawebben_document_unavailable"
    )
    expect(cancelled).toBe(true)
  })

  test("accepts a complete document whose streamed body is exactly the byte cap", async () => {
    stubRuntimeConfig()
    const prefix = "<!doctype html><html><body><p>"
    const suffix = "</p></body></html>"
    const source = `${prefix}${"x".repeat(maxBytes - prefix.length - suffix.length)}${suffix}`
    expect(Buffer.byteLength(source)).toBe(maxBytes)
    vi.stubGlobal("fetch", vi.fn(async () => managedResponse(source)))

    const result = await loadDramawebbenDocument(event, "om")
    expect(result.documentKind).toBe("om")
    expect(result.bodyHtml).toHaveLength(maxBytes - prefix.length - suffix.length + 7)
  })

  test("maps malformed or non-single-body upstream payloads without leakage", async () => {
    stubRuntimeConfig()
    vi.stubGlobal("fetch", vi.fn(async () => managedResponse(
      "<!doctype html><html><head><title>upstream-payload-probe</title></head></html>"
    )))
    await expectDocumentError(
      loadDramawebbenDocument(event, "om"),
      502,
      "dramawebben_document_unavailable"
    )
  })
})
