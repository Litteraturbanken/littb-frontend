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
    const fetcher = responseFetcher(managedResponse("unavailable", {
      headers: { "content-type": "text/html" },
      status: 503
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toThrow("Managed text request failed")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test.each([
    ["missing", undefined],
    ["wrong", "application/xhtml+xml; charset=utf-8"]
  ])("rejects a %s content type without retrying", async (_label, contentType) => {
    const headers = contentType === undefined ? undefined : { "content-type": contentType }
    const fetcher = responseFetcher(managedResponse("<p>text</p>", { headers }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toThrow("Managed text content type is not allowed")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test("rejects an oversized declared body without retrying", async () => {
    const fetcher = responseFetcher(managedResponse("tiny", {
      headers: {
        "content-length": "65",
        "content-type": "text/html"
      }
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toThrow("Managed text exceeds byte limit")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test("rejects an oversized actual body without retrying", async () => {
    const fetcher = responseFetcher(managedResponse("x".repeat(65), {
      headers: { "content-type": "text/html" }
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toThrow("Managed text exceeds byte limit")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test("rejects a cross-authority final URL without retrying", async () => {
    const fetcher = responseFetcher(managedResponse("<p>text</p>", {
      headers: { "content-type": "text/html" },
      url: "https://redirected.test/txt/work/res_00001.html"
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toThrow("Managed text final authority is not allowed")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test("rejects a final path outside the allowed prefix without retrying", async () => {
    const fetcher = responseFetcher(managedResponse("<p>text</p>", {
      headers: { "content-type": "text/html" },
      url: "https://assets.test/private/work/res_00001.html"
    }))

    await expect(fetchManagedText(
      "https://assets.test/txt/work/res_00001.html",
      rules,
      fetcher
    )).rejects.toThrow("Managed text final path is not allowed")
    expect(fetcher).toHaveBeenCalledOnce()
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
})
