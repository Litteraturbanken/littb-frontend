import { describe, expect, test, vi } from "vitest"

import {
  fetchManagedText,
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
): { cancelled: ReturnType<typeof vi.fn>, response: Response } {
  const cancelled = vi.fn()
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("unread"))
      closeTimer = setTimeout(() => controller.close(), 25)
    },
    cancel(reason: unknown) {
      if (closeTimer) clearTimeout(closeTimer)
      cancelled(reason)
      if (cancellationError) throw cancellationError
    }
  })
  return { cancelled, response: managedResponse(body, options) }
}

async function expectCancelledRejection(options: {
  expected: string | typeof TypeError
  response: Response
  cancelled: ReturnType<typeof vi.fn>
  managedRules?: ManagedTextRules
}): Promise<void> {
  const fetcher = responseFetcher(options.response)
  const rejection = expect(fetchManagedText(
    "https://assets.test/txt/work/res_00001.html",
    options.managedRules ?? rules,
    fetcher
  )).rejects
  if (typeof options.expected === "string") {
    await rejection.toThrow(options.expected)
  } else {
    await rejection.toThrow(options.expected)
  }
  expect(options.cancelled).toHaveBeenCalledOnce()
  expect(fetcher).toHaveBeenCalledOnce()
}

describe("managed text transport", () => {
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
      { redirect: "follow" }
    )
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

  test("does not treat an allowed path prefix sibling as a descendant", async () => {
    const rejected = unreadResponse({
      headers: { "content-type": "text/html" },
      url: "https://assets.test/managed/page-evil"
    })

    await expectCancelledRejection({
      ...rejected,
      expected: "Managed text final path is not allowed",
      managedRules: { ...rules, allowedPathPrefixes: ["/managed/page"] }
    })
  })

  test.each([
    "/txt/%2f..%2fprivate",
    "/txt/%2F..%2Fprivate",
    "/txt/%5c..%5cprivate",
    "/txt/%5C..%5Cprivate",
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
      "https://assets.test/txt/work/res_00001.html",
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
      { ...rules, authorityOrigin: "https://assets.test:443" },
      fetcher
    )).resolves.toBe("Sjö fil")
    expect(fetcher).toHaveBeenCalledOnce()
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
