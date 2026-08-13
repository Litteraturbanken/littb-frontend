import { createServer } from "node:http"
import { once } from "node:events"

import { describe, expect, test, vi } from "vitest"

import {
  fetchManagedText,
  managedPresentationBackgroundTextRules,
  managedPresentationDocumentTextRules,
  type ManagedTextRules
} from "../../shared/utils/managed-text"

const rules: ManagedTextRules = {
  authorityOrigin: "https://assets.test",
  allowedPathPrefixes: ["/txt/"],
  allowedContentTypes: ["text/html"],
  maximumBytes: 64
}

function managedResponse(
  body: BodyInit | null,
  options: ResponseInit & { url?: string } = {}
): Response {
  const { url = "https://assets.test/txt/work/res_00001.html", ...init } = options
  const response = new Response(body, init)
  Object.defineProperty(response, "url", { value: url })
  return response
}

function responseFetcher(response: Response): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(async () => response)
}

function unreadResponse(
  options: ResponseInit & { url?: string } = {},
  cancellationError?: Error
): {
  cancelled: ReturnType<typeof vi.fn>
  cleanup: () => void
  response: Response
  unexpectedRead: Promise<void>
} {
  const cancelled = vi.fn()
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  let signalUnexpectedRead: (() => void) | undefined
  const unexpectedRead = new Promise<void>(resolve => {
    signalUnexpectedRead = resolve
  })
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController
      streamController.enqueue(new TextEncoder().encode("unread"))
    },
    pull() {
      signalUnexpectedRead?.()
    },
    cancel(reason: unknown) {
      cancelled(reason)
      if (cancellationError) throw cancellationError
    }
  })
  return {
    cancelled,
    cleanup() {
      try {
        controller?.error(new Error("Unread response test cleanup"))
      } catch {
        // The expected cancellation has already closed the stream.
      }
    },
    response: managedResponse(body, options),
    unexpectedRead
  }
}

async function expectCancelledRejection(options: {
  expected: string | typeof TypeError
  response: Response
  cancelled: ReturnType<typeof vi.fn>
  cleanup: () => void
  unexpectedRead: Promise<void>
  managedRules?: ManagedTextRules
  requestUrl?: string
}): Promise<void> {
  const fetcher = responseFetcher(options.response)
  const operation = fetchManagedText(
    options.requestUrl ?? "https://assets.test/txt/work/res_00001.html",
    options.managedRules ?? rules,
    fetcher
  )
  const outcome = await Promise.race([
    operation.then(
      value => ({ kind: "fulfilled" as const, value }),
      error => ({ error, kind: "rejected" as const })
    ),
    options.unexpectedRead.then(() => ({ kind: "read" as const }))
  ])
  if (outcome.kind === "read") {
    options.cleanup()
    await operation.catch(() => undefined)
    throw new Error("Managed text validation read an unread response body")
  }
  try {
    expect(outcome.kind).toBe("rejected")
    if (outcome.kind !== "rejected") return
    if (typeof options.expected === "string") {
      expect(outcome.error).toBeInstanceOf(Error)
      expect((outcome.error as Error).message).toContain(options.expected)
    } else {
      expect(outcome.error).toBeInstanceOf(options.expected)
    }
    expect(options.cancelled).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledOnce()
  } finally {
    options.cleanup()
  }
}

function encodeLayers(value: string, layers: number): string {
  let encoded = value
  for (let index = 0; index < layers; index += 1) encoded = encodeURIComponent(encoded)
  return encoded
}

describe("managed text transport", () => {
  test("accepts the largest measured production Presentation document", async () => {
    const documentPath = "/red/presentationer/specialomraden/ProductionSized.html"
    const document = "x".repeat(75_220)
    const documentResponse = managedResponse(document, {
      headers: { "content-type": "text/html; charset=utf-8" },
      url: `https://assets.test${documentPath}`
    })

    await expect(fetchManagedText(
      `https://assets.test${documentPath}`,
      managedPresentationDocumentTextRules("https://assets.test"),
      responseFetcher(documentResponse)
    )).resolves.toBe(document)
  })

  test.each(["text/xml; charset=utf-8", "application/xml"])(
    "accepts the measured production Presentation background as %s",
    async contentType => {
      const backgroundPath = "/red/bilder/bakgrundsbilder/backgrounds.xml"
      const background = "x".repeat(4_741)
      const backgroundResponse = managedResponse(background, {
        headers: { "content-type": contentType },
        url: `https://assets.test${backgroundPath}`
      })
      await expect(fetchManagedText(
        `https://assets.test${backgroundPath}`,
        managedPresentationBackgroundTextRules("https://assets.test"),
        responseFetcher(backgroundResponse)
      )).resolves.toBe(background)
    }
  )

  test("decodes the exact UTF-8 bytes from one allowed HTML request", async () => {
    const bytes = new TextEncoder().encode("Sjö\n<p>text</p>")
    const fetcher = responseFetcher(managedResponse(bytes, {
      headers: { "content-type": "Text/HTML ; Charset=UTF-8" }
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html?username=app",
      rules,
      fetcher
    )).resolves.toBe("Sjö\n<p>text</p>")
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith(
      "https://assets.test/txt/work/res_00001.html?username=app",
      { redirect: "manual" }
    )
  })

  test("rejects a cross-authority redirect without contacting its target", async () => {
    const redirected = unreadResponse({
      headers: {
        location: "https://internal.test/private",
        "content-type": "text/html"
      },
      status: 302,
      url: "https://assets.test/txt/work/res_00001.html"
    })
    const fetcher = vi.fn<typeof fetch>(async () => redirected.response)

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toThrow("Managed text final authority is not allowed")
    expect(fetcher).toHaveBeenCalledOnce()
    expect(redirected.cancelled).toHaveBeenCalledOnce()
    redirected.cleanup()
  })

  test("installed Node fetch does not follow a rejected redirect target", async () => {
    let targetRequests = 0
    const target = createServer((_request, response) => {
      targetRequests += 1
      response.writeHead(200, { "content-type": "text/html" })
      response.end("private")
    })
    target.listen(0, "127.0.0.1")
    await once(target, "listening")
    const targetAddress = target.address()
    if (!targetAddress || typeof targetAddress === "string") {
      throw new Error("Expected managed text target TCP server")
    }

    const origin = createServer((_request, response) => {
      response.writeHead(302, {
        location: `http://127.0.0.1:${targetAddress.port}/private`
      })
      response.end("redirect")
    })
    origin.listen(0, "127.0.0.1")
    await once(origin, "listening")
    const originAddress = origin.address()
    if (!originAddress || typeof originAddress === "string") {
      throw new Error("Expected managed text origin TCP server")
    }
    const originUrl = `http://127.0.0.1:${originAddress.port}`

    try {
      await expect(fetchManagedText(
        `${originUrl}/txt/start.html`,
        { ...rules, authorityOrigin: originUrl }
      )).rejects.toThrow("Managed text final authority is not allowed")
      expect(targetRequests).toBe(0)
    } finally {
      origin.close()
      target.close()
      await Promise.all([once(origin, "close"), once(target, "close")])
    }
  })

  test("follows a bounded same-authority relative and absolute redirect chain", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(managedResponse(null, {
        headers: { location: "next.html?step=1" },
        status: 302,
        url: "https://assets.test/txt/work/res_00001.html?initial=1"
      }))
      .mockResolvedValueOnce(managedResponse(null, {
        headers: { location: "https://assets.test/txt/final.html?source=redirect" },
        status: 307,
        url: "https://assets.test/txt/work/next.html?step=1"
      }))
      .mockResolvedValueOnce(managedResponse("redirected", {
        headers: { "content-type": "text/html" },
        url: "https://assets.test/txt/final.html?source=redirect"
      }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html?initial=1",
      rules,
      fetcher
    )).resolves.toBe("redirected")
    expect(fetcher.mock.calls).toEqual([
      [
        "https://assets.test/txt/work/res_00001.html?initial=1",
        { redirect: "manual" }
      ],
      ["https://assets.test/txt/work/next.html?step=1", { redirect: "manual" }],
      ["https://assets.test/txt/final.html?source=redirect", { redirect: "manual" }]
    ])
  })

  test("resolves a root-relative managed client URL against its configured authority", async () => {
    const fetcher = responseFetcher(managedResponse("relative", {
      headers: { "content-type": "text/html" },
      url: "https://assets.test/txt/work/res_00001.html?client=1"
    }))

    await expect(fetchManagedText(
      "/txt/work/res_00001.html?client=1",
      rules,
      fetcher
    )).resolves.toBe("relative")
    expect(fetcher).toHaveBeenCalledWith(
      "https://assets.test/txt/work/res_00001.html?client=1",
      { redirect: "manual" }
    )
  })

  test.each([
    ["missing Location", undefined, "Managed text redirect location is not allowed"],
    ["malformed Location", "https://[", "Managed text redirect location is not allowed"],
    [
      "credential-bearing Location",
      "https://reader:secret@assets.test/txt/secret.html",
      "Managed text redirect location is not allowed"
    ],
    [
      "disallowed Location path",
      "/private/secret.html",
      "Managed text final path is not allowed"
    ],
    [
      "encoded traversal Location path",
      "/txt/work/%2e%2e/private.html",
      "Managed text final path is not allowed"
    ],
    [
      "nested encoded separator Location path",
      "/txt/work/safe%252fprivate.html",
      "Managed text final path is not allowed"
    ]
  ])("rejects a %s without a second request", async (_label, location, expected) => {
    const headers = new Headers()
    if (location !== undefined) headers.set("location", location)
    const redirected = unreadResponse({
      headers,
      status: 302,
      url: "https://assets.test/txt/work/res_00001.html"
    })
    const fetcher = vi.fn<typeof fetch>(async () => redirected.response)

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toThrow(expected)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(redirected.cancelled).toHaveBeenCalledOnce()
    redirected.cleanup()
  })

  test("stops a redirect loop at the managed redirect limit", async () => {
    const redirects = Array.from({ length: 6 }, (_, index) => managedResponse(null, {
      headers: { location: `/txt/loop-${index + 1}.html` },
      status: 308,
      url: `https://assets.test/txt/loop-${index}.html`
    }))
    const fetcher = vi.fn<typeof fetch>(async () => {
      const response = redirects.shift()
      if (!response) throw new Error("Managed text exceeded the redirect test boundary")
      return response
    })

    await expect(fetchManagedText(
      "https://assets.test/txt/loop-0.html",
      rules,
      fetcher
    )).rejects.toThrow("Managed text redirect limit exceeded")
    expect(fetcher).toHaveBeenCalledTimes(6)
  })

  test("rejects a non-success response without retrying", async () => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      status: 503
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text request failed"
    })
  })

  test.each([
    ["missing", undefined],
    ["wrong", "application/xhtml+xml; charset=utf-8"]
  ])("rejects a %s content type without retrying", async (_label, contentType) => {
    const headers = contentType === undefined ? undefined : { "content-type": contentType }
    const rejected = unreadResponse({ headers })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text content type is not allowed"
    })
  })

  test.each([
    ["invalid", "invalid", "Managed text has an invalid declared length"],
    ["oversized", "65", "Managed text exceeds byte limit"]
  ])("rejects an %s declared body length without retrying", async (
    _label,
    contentLength,
    expected
  ) => {
    const rejected = unreadResponse({
      headers: {
        "content-length": contentLength,
        "content-type": "text/html"
      }
    })

    await expectCancelledRejection({ ...rejected, expected })
  })

  test("rejects an oversized actual body without retrying", async () => {
    const cancelled = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(65)))
      },
      cancel(reason: unknown) {
        cancelled(reason)
      }
    })
    const fetcher = responseFetcher(managedResponse(body, {
      headers: { "content-type": "text/html" }
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toThrow("Managed text exceeds byte limit")
    expect(cancelled).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test("rejects a cross-authority final URL without retrying", async () => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: "https://redirected.test/txt/work/res_00001.html"
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final authority is not allowed"
    })
  })

  test("rejects a final path outside the allowed prefix without retrying", async () => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: "https://assets.test/private/work/res_00001.html"
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final path is not allowed"
    })
  })

  test("rejects a malformed final URL and cancels its unread body", async () => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: "://not-a-url"
    })

    await expectCancelledRejection({ ...rejected, expected: TypeError })
  })

  test("rejects credential-bearing final URLs and cancels their unread bodies", async () => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: "https://reader:secret@assets.test/txt/work/res_00001.html"
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final URL credentials are not allowed"
    })
  })

  test.each([
    ["empty userinfo", "https://@assets.test/txt/work/res_00001.html", rules],
    ["empty username and password", "https://:@assets.test/txt/work/res_00001.html", rules],
    ["embedded tab", "https://assets.\ttest/txt/work/res_00001.html", rules],
    ["embedded newline", "https://assets.\ntest/txt/work/res_00001.html", rules],
    ["empty port", "https://assets.test:/txt/work/res_00001.html", rules],
    [
      "empty bracketed IPv6 port",
      "https://[2001:db8::1]:/txt/work/res_00001.html",
      { ...rules, authorityOrigin: "https://[2001:db8::1]" }
    ],
    ["empty authority", "https:///assets.test/txt/work/res_00001.html", rules]
  ])("rejects a final URL with raw %s and cancels its unread body", async (
    label,
    url,
    managedRules
  ) => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final URL is not allowed",
      managedRules,
      requestUrl: label === "empty bracketed IPv6 port"
        ? "https://[2001:db8::1]/txt/work/res_00001.html"
        : undefined
    })
  })

  test.each([
    ["embedded NUL", "https://assets.\u0000test/txt/work/res_00001.html"],
    ["embedded DEL", "https://assets.\u007ftest/txt/work/res_00001.html"]
  ])("rejects a final URL with %s and cancels its unread body", async (_label, url) => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url
    })

    await expectCancelledRejection({ ...rejected, expected: TypeError })
  })

  test("rejects a blob final URL even when the root path prefix is allowed", async () => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: "blob:https://assets.test/reader-page"
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final URL is not allowed",
      managedRules: { ...rules, allowedPathPrefixes: ["/"] }
    })
  })

  test.each([
    ["HTTP for HTTPS", "http://assets.test/txt/work/res_00001.html", rules],
    [
      "HTTPS for HTTP",
      "https://assets.test/txt/work/res_00001.html",
      { ...rules, authorityOrigin: "http://assets.test" }
    ]
  ])("rejects a final response using %s and cancels its unread body", async (
    _label,
    url,
    managedRules
  ) => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final protocol is not allowed",
      managedRules,
      requestUrl: `${new URL(managedRules.authorityOrigin).origin}/txt/work/res_00001.html`
    })
  })

  test("does not treat an allowed path prefix sibling as a descendant", async () => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: "https://assets.test/managed/page-evil"
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final path is not allowed",
      managedRules: { ...rules, allowedPathPrefixes: ["/managed/page"] },
      requestUrl: "https://assets.test/managed/page"
    })
  })

  test.each([
    "/txt/%2f..%2fprivate",
    "/txt/%2F..%2Fprivate",
    "/txt/%5c..%5cprivate",
    "/txt/%5C..%5Cprivate",
    "/txt\\..\\private",
    "/txt/work/%2e%2e/page.html",
    "/txt/work/.%2E/page.html"
  ])("rejects unsafe encoded path form %s", async path => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: `https://assets.test${path}`
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final path is not allowed"
    })
  })

  test.each([
    "/txt/%252f..%252fprivate",
    "/txt/%252F..%252Fprivate",
    "/txt/%255c..%255cprivate",
    "/txt/%255C..%255Cprivate",
    "/txt/work/%252e%252e/page.html",
    "/txt/work/%252E%252e/page.html",
    "/txt/%25252f..%25252fprivate",
    "/txt/%25252F..%25252Fprivate"
  ])("rejects recursively encoded unsafe path form %s", async path => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: `https://assets.test${path}`
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final path is not allowed"
    })
  })

  test.each([
    "/txt/work/%",
    "/txt/work/%2",
    "/txt/work/%GG"
  ])("rejects malformed path encoding %s", async path => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: `https://assets.test${path}`
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final path is not allowed"
    })
  })

  test("rejects excessive recursive path encoding", async () => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: `https://assets.test/txt/file${encodeLayers(" ", 9)}name.html`
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final path is not allowed"
    })
  })

  test.each([
    ["exact prefix", "/managed/page", "/managed/page"],
    ["prefix descendant", "/managed/page", "/managed/page/child"],
    ["trailing-slash prefix exact path", "/managed/page/", "/managed/page"],
    ["trailing-slash prefix descendant", "/managed/page/", "/managed/page/child"]
  ])("accepts an allowed %s", async (_label, prefix, path) => {
    const fetcher = responseFetcher(managedResponse("ordinary", {
      headers: { "content-type": "text/html" },
      url: `https://assets.test${path}`
    }))

    await expect(fetchManagedText(
      `https://assets.test${path}`,
      { ...rules, allowedPathPrefixes: [prefix] },
      fetcher
    )).resolves.toBe("ordinary")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test("normalizes default ports and permits ordinary percent-encoded filename characters", async () => {
    const fetcher = responseFetcher(managedResponse("Sjö fil", {
      headers: { "content-type": "text/html" },
      url: "https://assets.test/txt/Sj%C3%B6%20fil%2Ehtml"
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/Sj%C3%B6%20fil%2Ehtml",
      { ...rules, authorityOrigin: "https://assets.test:443/" },
      fetcher
    )).resolves.toBe("Sjö fil")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test.each([
    "/txt/Sj%C3%B6.html",
    "/txt/two%20words.html",
    "/txt/file%2Ename.html",
    "/txt/file%252Ename.html"
  ])("permits safe encoded filename path %s", async path => {
    const fetcher = responseFetcher(managedResponse("ordinary", {
      headers: { "content-type": "text/html" },
      url: `https://assets.test${path}`
    }))

    await expect(fetchManagedText(
      `https://assets.test${path}`,
      rules,
      fetcher
    )).resolves.toBe("ordinary")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test.each([
    ["malformed", "://not-an-origin"],
    ["credentials", "https://reader:secret@assets.test"],
    ["empty userinfo", "https://@assets.test"],
    ["empty username and password", "https://:@assets.test"],
    ["embedded tab", "https://assets.\ttest"],
    ["embedded newline", "https://assets.\ntest"],
    ["embedded space", "https://assets. test"],
    ["embedded NUL", "https://assets.\u0000test"],
    ["embedded DEL", "https://assets.\u007ftest"],
    ["empty port", "https://assets.test:"],
    ["empty bracketed IPv6 port", "https://[2001:db8::1]:"],
    ["empty authority", "https://"],
    ["file scheme", "file:///tmp/assets"],
    ["opaque scheme", "data:text/plain,assets"],
    ["path", "https://assets.test/txt"],
    ["normalized dot path", "https://assets.test/."],
    ["encoded normalized dot path", "https://assets.test/%2e"],
    ["backslash path", "https://assets.test\\txt"],
    ["query", "https://assets.test?tenant=reader"],
    ["empty query", "https://assets.test?"],
    ["fragment", "https://assets.test#reader"],
    ["empty fragment", "https://assets.test#"]
  ])("rejects a configured authority with %s before fetching", async (_label, authorityOrigin) => {
    const fetcher = responseFetcher(managedResponse("must not fetch", {
      headers: { "content-type": "text/html" }
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      { ...rules, authorityOrigin },
      fetcher
    )).rejects.toThrow("Managed text configured authority is not allowed")
    expect(fetcher).not.toHaveBeenCalled()
  })

  test("permits a configured nondefault port and requires the final response to match it", async () => {
    const fetcher = responseFetcher(managedResponse("port text", {
      headers: { "content-type": "text/html" },
      url: "https://assets.test:8443/txt/work/res_00001.html"
    }))

    await expect(fetchManagedText(
      "https://assets.test:8443/txt/work/res_00001.html",
      { ...rules, authorityOrigin: "https://assets.test:8443" },
      fetcher
    )).resolves.toBe("port text")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test.each([
    [
      "uppercase HTTPS host and explicit default port",
      "HTTPS://ASSETS.TEST:443/",
      "HTTPS://ASSETS.TEST:443/txt/work/res_00001.html?username=app#page"
    ],
    [
      "explicit HTTP default port",
      "http://assets.test:80",
      "http://assets.test/txt/work/res_00001.html"
    ],
    [
      "bracketed IPv6 default port",
      "https://[2001:db8::1]:443",
      "https://[2001:db8::1]/txt/work/res_00001.html"
    ],
    [
      "bracketed IPv6 nondefault port",
      "https://[2001:db8::1]:8443",
      "https://[2001:db8::1]:8443/txt/work/res_00001.html"
    ]
  ])("permits %s", async (_label, authorityOrigin, url) => {
    const fetcher = responseFetcher(managedResponse("canonical", {
      headers: { "content-type": "text/html" },
      url
    }))

    await expect(fetchManagedText(
      url,
      { ...rules, authorityOrigin },
      fetcher
    )).resolves.toBe("canonical")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test("rejects a final response whose port does not match the configured origin", async () => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: "https://assets.test/txt/work/res_00001.html"
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final authority is not allowed",
      managedRules: { ...rules, authorityOrigin: "https://assets.test:8443" },
      requestUrl: "https://assets.test:8443/txt/work/res_00001.html"
    })
  })

  test("preserves the validation error when unread-body cancellation rejects", async () => {
    const cancellationError = new Error("cancel failed")
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      status: 503
    }, cancellationError)

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text request failed"
    })
  })

  test("rejects malformed UTF-8 without retrying", async () => {
    const fetcher = responseFetcher(managedResponse(new Uint8Array([0xc3, 0x28]), {
      headers: { "content-type": "text/html" }
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toThrow(TypeError)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test("propagates AbortError without retrying", async () => {
    const abortError = new DOMException("aborted", "AbortError")
    const fetcher = vi.fn<typeof fetch>(async () => Promise.reject(abortError))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toBe(abortError)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test("propagates a body-read AbortError without retrying", async () => {
    const abortError = new DOMException("read aborted", "AbortError")
    const body = new ReadableStream<Uint8Array>({
      pull() {
        throw abortError
      }
    })
    const fetcher = responseFetcher(managedResponse(body, {
      headers: { "content-type": "text/html" }
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toBe(abortError)
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
