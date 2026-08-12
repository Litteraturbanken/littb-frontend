import type { H3Event } from "h3"
import {
  brotliCompressSync as actualBrotliCompressSync,
  brotliDecompressSync
} from "node:zlib"
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest"

import { acceptsBrotliEncoding } from "../../server/utils/response-compression"

type BeforeResponseHook = (
  event: H3Event,
  response: { body: unknown }
) => Promise<void> | void

type PendingCompression = {
  body: Buffer
  callback: (error: Error | null, result?: Buffer) => void
  options: Parameters<typeof actualBrotliCompressSync>[1]
}

type ResponseOptions = {
  acceptEncoding?: string
  body?: unknown
  contentEncoding?: string
  contentType?: string
  method?: string
  path?: string
  status?: number
  vary?: string | string[]
}

class TestResponse {
  headersSent = false
  statusCode: number
  writableEnded = false
  readonly headers = new Map<string, string | string[] | number>()

  constructor(status: number) {
    this.statusCode = status
  }

  getHeader(name: string): string | string[] | number | undefined {
    return this.headers.get(name.toLowerCase())
  }

  removeHeader(name: string): void {
    this.headers.delete(name.toLowerCase())
  }

  setHeader(name: string, value: string | string[] | number): void {
    this.headers.set(name.toLowerCase(), value)
  }
}

let beforeResponse: BeforeResponseHook
const pendingCompressions: PendingCompression[] = []
const brotliCompressSync = vi.fn(actualBrotliCompressSync)

beforeAll(async () => {
  vi.doMock("node:zlib", async (importOriginal) => ({
    ...await importOriginal<typeof import("node:zlib")>(),
    brotliCompress(
      body: Buffer,
      options: PendingCompression["options"],
      callback: PendingCompression["callback"]
    ) {
      pendingCompressions.push({ body, callback, options })
    },
    brotliCompressSync
  }))
  vi.doMock("#server/utils/response-compression", () => ({ acceptsBrotliEncoding }))
  vi.stubGlobal("defineNitroPlugin", (register: (app: unknown) => void) => {
    register({
      hooks: {
        hook(name: string, handler: BeforeResponseHook) {
          if (name === "beforeResponse") beforeResponse = handler
        }
      }
    })
  })
  await import("../../server/plugins/response-compression")
})

beforeEach(() => {
  pendingCompressions.length = 0
  brotliCompressSync.mockClear()
})

function runResponse(options: ResponseOptions = {}) {
  const nodeResponse = new TestResponse(options.status ?? 200)
  nodeResponse.setHeader("content-type", options.contentType ?? "text/html; charset=utf-8")
  nodeResponse.setHeader("content-length", "4096")
  if (options.contentEncoding) {
    nodeResponse.setHeader("content-encoding", options.contentEncoding)
  }
  if (options.vary) nodeResponse.setHeader("vary", options.vary)
  const event = {
    method: options.method ?? "GET",
    node: {
      req: {
        headers: options.acceptEncoding
          ? { "accept-encoding": options.acceptEncoding }
          : {},
        method: options.method ?? "GET",
        url: options.path ?? "/reader"
      },
      res: nodeResponse
    },
    path: options.path ?? "/reader"
  } as unknown as H3Event
  const response = { body: options.body ?? "A".repeat(4_096) }

  const completion = Promise.resolve(beforeResponse(event, response))

  return { completion, nodeResponse, response }
}

describe("Brotli content negotiation", () => {
  test.each([
    [undefined, false],
    ["", false],
    ["br", true],
    ["BR", true],
    ["gzip, br", true],
    ["gzip;q=0.9, Br;q=0.25", true],
    ["br;q=0", false],
    ["gzip;q=1, br;q=0", false],
    ["br;q=bogus", false],
    ["br;q=-0.1", false],
    ["br;q=1.1", false],
    ["br;q=0.1234", false],
    ["br;level=1", false]
  ])("parses %j as %s", (header, accepted) => {
    expect(acceptsBrotliEncoding(header)).toBe(accepted)
  })
})

describe("HTML response compression boundary", () => {
  test.each([undefined, "gzip"])(
    "varies an eligible identity response when the request accepts %j",
    async (acceptEncoding) => {
      const { completion, nodeResponse, response } = runResponse({ acceptEncoding })
      await completion

      expect(response.body).toBe("A".repeat(4_096))
      expect(nodeResponse.getHeader("content-encoding")).toBeUndefined()
      expect(nodeResponse.getHeader("vary")).toBe("Accept-Encoding")
      expect(nodeResponse.getHeader("content-length")).toBe("4096")
    }
  )

  test("compresses without invoking the synchronous Brotli API", async () => {
    const { completion, nodeResponse, response } = runResponse({ acceptEncoding: "br" })
    let settled = false
    void completion.finally(() => { settled = true })

    expect(pendingCompressions).toHaveLength(1)
    expect(settled).toBe(false)
    expect(response.body).toBe("A".repeat(4_096))
    expect(nodeResponse.getHeader("content-encoding")).toBeUndefined()
    expect(nodeResponse.getHeader("content-length")).toBe("4096")
    expect(brotliCompressSync).not.toHaveBeenCalled()

    const pending = pendingCompressions.shift()!
    pending.callback(null, actualBrotliCompressSync(pending.body, pending.options))
    await completion

    expect(Buffer.isBuffer(response.body)).toBe(true)
    expect(brotliDecompressSync(response.body as Buffer).toString()).toBe("A".repeat(4_096))
    expect(nodeResponse.getHeader("content-encoding")).toBe("br")
    expect(nodeResponse.getHeader("vary")).toBe("Accept-Encoding")
    expect(nodeResponse.getHeader("content-length")).toBeUndefined()
  })

  test("leaves the identity representation intact when async compression fails", async () => {
    const { completion, nodeResponse, response } = runResponse({ acceptEncoding: "br" })
    pendingCompressions.shift()!.callback(new Error("compression unavailable"))

    await expect(completion).rejects.toThrow("compression unavailable")
    expect(response.body).toBe("A".repeat(4_096))
    expect(nodeResponse.getHeader("content-encoding")).toBeUndefined()
    expect(nodeResponse.getHeader("content-length")).toBe("4096")
    expect(nodeResponse.getHeader("vary")).toBe("Accept-Encoding")
  })

  test("merges and case-insensitively deduplicates existing Vary tokens", async () => {
    const { completion, nodeResponse } = runResponse({
      vary: ["Origin, ACCEPT-ENCODING", "origin, Cookie", "accept-encoding"]
    })
    await completion

    expect(nodeResponse.getHeader("vary")).toBe("Origin, ACCEPT-ENCODING, Cookie")
  })

  test("preserves a wildcard Vary header", async () => {
    const { completion, nodeResponse } = runResponse({ vary: "*" })
    await completion

    expect(nodeResponse.getHeader("vary")).toBe("*")
  })

  test.each([
    ["a short body", { body: "A".repeat(1_023) }],
    ["a non-string body", { body: Buffer.from("A".repeat(4_096)) }],
    ["an existing encoding", { contentEncoding: "gzip" }],
    ["a non-success status", { status: 404 }],
    ["an error route", { path: "/__nuxt_error" }],
    ["a non-HTML representation", { contentType: "text/plain" }],
    ["a POST response", { method: "POST" }],
    ["an OPTIONS response", { method: "OPTIONS" }]
  ] satisfies [string, ResponseOptions][])("does not vary or compress %s", async (_case, options) => {
    const { completion, nodeResponse, response } = runResponse({
      ...options,
      acceptEncoding: "br"
    })
    await completion

    expect(response.body).toEqual(options.body ?? "A".repeat(4_096))
    expect(nodeResponse.getHeader("content-encoding")).toBe(options.contentEncoding)
    expect(nodeResponse.getHeader("vary")).toBeUndefined()
    expect(nodeResponse.getHeader("content-length")).toBe("4096")
  })

  test("varies an eligible HEAD representation", async () => {
    const { completion, nodeResponse } = runResponse({ method: "HEAD" })
    await completion

    expect(nodeResponse.getHeader("vary")).toBe("Accept-Encoding")
  })
})
