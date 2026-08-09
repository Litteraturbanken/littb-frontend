import type { H3Event } from "h3"
import { brotliDecompressSync } from "node:zlib"
import { beforeAll, describe, expect, test, vi } from "vitest"

import { acceptsBrotliEncoding } from "../../server/utils/response-compression"

type BeforeResponseHook = (
  event: H3Event,
  response: { body: unknown }
) => void

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

beforeAll(async () => {
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

  beforeResponse(event, response)

  return { nodeResponse, response }
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
    (acceptEncoding) => {
      const { nodeResponse, response } = runResponse({ acceptEncoding })

      expect(response.body).toBe("A".repeat(4_096))
      expect(nodeResponse.getHeader("content-encoding")).toBeUndefined()
      expect(nodeResponse.getHeader("vary")).toBe("Accept-Encoding")
      expect(nodeResponse.getHeader("content-length")).toBe("4096")
    }
  )

  test("compresses the same eligible representation when Brotli is accepted", () => {
    const { nodeResponse, response } = runResponse({ acceptEncoding: "br" })

    expect(Buffer.isBuffer(response.body)).toBe(true)
    expect(brotliDecompressSync(response.body as Buffer).toString()).toBe("A".repeat(4_096))
    expect(nodeResponse.getHeader("content-encoding")).toBe("br")
    expect(nodeResponse.getHeader("vary")).toBe("Accept-Encoding")
    expect(nodeResponse.getHeader("content-length")).toBeUndefined()
  })

  test("merges and case-insensitively deduplicates existing Vary tokens", () => {
    const { nodeResponse } = runResponse({
      vary: ["Origin, ACCEPT-ENCODING", "origin, Cookie", "accept-encoding"]
    })

    expect(nodeResponse.getHeader("vary")).toBe("Origin, ACCEPT-ENCODING, Cookie")
  })

  test("preserves a wildcard Vary header", () => {
    const { nodeResponse } = runResponse({ vary: "*" })

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
  ] satisfies [string, ResponseOptions][])("does not vary or compress %s", (_case, options) => {
    const { nodeResponse, response } = runResponse({ ...options, acceptEncoding: "br" })

    expect(response.body).toEqual(options.body ?? "A".repeat(4_096))
    expect(nodeResponse.getHeader("content-encoding")).toBe(options.contentEncoding)
    expect(nodeResponse.getHeader("vary")).toBeUndefined()
    expect(nodeResponse.getHeader("content-length")).toBe("4096")
  })

  test("varies an eligible HEAD representation", () => {
    const { nodeResponse } = runResponse({ method: "HEAD" })

    expect(nodeResponse.getHeader("vary")).toBe("Accept-Encoding")
  })
})
