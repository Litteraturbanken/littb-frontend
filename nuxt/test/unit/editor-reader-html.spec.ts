import { describe, expect, test } from "vitest"

import {
  fetchBoundedEditorJson,
  fetchBoundedEditorText,
  fetchTimedEditorHead,
  parseEditorPageIndexes,
  sanitizeEditorEtextHtml
} from "../../server/utils/editor-reader-html"

describe("Editor Reader e-text sanitizer", () => {
  test("preserves Reader typography and illustration markup", () => {
    expect(sanitizeEditorEtextHtml(`
      <div class="pname" pname="-2">
        <h1 id="title"><em>Doktor Glas</em></h1>
        <img class="graphicimg" src="/bilder/ornament.png" alt="">
      </div>
    `)).toContain('<img class="graphicimg" src="/bilder/ornament.png" alt="">')
  })

  test("removes active content, event handlers, and unsafe URLs", () => {
    const sanitized = sanitizeEditorEtextHtml(`
      <div onclick="alert(1)"><script>alert(1)</script>
        <a href="javascript:alert(1)" target="popup">text</a>
        <img src="data:text/html,unsafe" onerror="alert(1)">
      </div>
    `)

    expect(sanitized).toContain("text")
    expect(sanitized).not.toMatch(/script|onclick|onerror|javascript:|data:/iu)
  })

  test("fails closed for empty and oversized sources", () => {
    expect(sanitizeEditorEtextHtml("")).toBeNull()
    expect(sanitizeEditorEtextHtml("x".repeat(2 * 1024 * 1024 + 1))).toBeNull()
  })
})

describe("Editor Reader bounded source transport", () => {
  test("rejects a declared oversized response before reading its body", async () => {
    let bodyRead = false
    const response = {
      ok: true,
      headers: new Headers({ "content-length": "1001" }),
      get body() {
        bodyRead = true
        return new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("unsafe"))
            controller.close()
          }
        })
      }
    } as Response

    await expect(fetchBoundedEditorText("https://source.test/page", 1_000, {
      fetcher: async () => response
    })).rejects.toThrow("bounded source")
    expect(bodyRead).toBe(false)
  })

  test("rejects a streamed body as soon as decoded bytes exceed the bound", async () => {
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(700))
        controller.enqueue(new Uint8Array(400))
        controller.close()
      }
    }))

    await expect(fetchBoundedEditorText("https://source.test/page", 1_000, {
      fetcher: async () => response
    })).rejects.toThrow("bounded source")
  })

  test("aborts a source request at the configured timeout", async () => {
    await expect(fetchBoundedEditorText("https://source.test/page", 1_000, {
      timeoutMs: 10,
      fetcher: async (_input, init) => await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true })
      })
    })).rejects.toThrow()
  })

  test("parses JSON only after enforcing the transport byte bound", async () => {
    const fetcher = async () => new Response(JSON.stringify({ count: 3 }), {
      headers: { "content-type": "application/json" }
    })
    await expect(fetchBoundedEditorJson("https://source.test/metadata", 100, {
      fetcher
    })).resolves.toEqual({ count: 3 })
    await expect(fetchBoundedEditorJson("https://source.test/metadata", 5, {
      fetcher
    })).rejects.toThrow("bounded source")
  })

  test("times out a facsimile HEAD request", async () => {
    await expect(fetchTimedEditorHead("https://source.test/page.jpeg", {
      timeoutMs: 10,
      fetcher: async (_input, init) => await new Promise<Response>((_resolve, reject) => {
        expect(init?.method).toBe("HEAD")
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true })
      })
    })).rejects.toThrow()
  })
})

describe("Editor Reader sparse page bounds", () => {
  test("keeps sorted actual indices and caps the maximum raw index at 99,999", () => {
    expect(parseEditorPageIndexes([
      { pagename: "57", pageindex: 57 },
      { pagename: "2", pageindex: 2 },
      { pagename: "12", pageindex: 12 }
    ])).toEqual({ indexes: [2, 12, 57], pageCount: 58 })
    expect(parseEditorPageIndexes([{ pagename: "last", pageindex: 99_999 }]))
      .toEqual({ indexes: [99_999], pageCount: 100_000 })
    expect(parseEditorPageIndexes([{ pagename: "too far", pageindex: 100_000 }])).toBeNull()
  })
})
