import { afterEach, describe, expect, test, vi } from "vitest"

import { createRuntimeLbApiClient } from "../../app/composables/useLbApiClient"

const REQUEST_ID = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d"
const TRACEPARENT
  = "00-0123456789abcdef0123456789abcdef-fedcba9876543210-01"

afterEach(() => {
  vi.unstubAllGlobals()
})

function runtime(context: unknown) {
  return {
    config: {
      apiBase: "http://backend.test/v2",
      public: { apiBase: "/api/v2" }
    },
    event: { context: { observability: { context } } }
  }
}

describe("SSR-aware lb-api client", () => {
  test("uses the private backend with only validated request correlation", async () => {
    const { config, event } = runtime({
      requestId: REQUEST_ID,
      traceparent: TRACEPARENT,
      untrusted: "private"
    })
    let request: Request | undefined
    vi.stubGlobal("fetch", vi.fn(async input => {
      request = input as Request
      return new Response(JSON.stringify({ authors: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    }))

    const client = createRuntimeLbApiClient(config, event, true)
    await client.POST("/authors/resolve", {
      body: { author_ids: ["SöderbergH"] }
    })

    expect(request?.url).toBe("http://backend.test/v2/authors/resolve")
    expect(request?.headers.get("x-request-id")).toBe(REQUEST_ID)
    expect(request?.headers.get("traceparent")).toBe(TRACEPARENT)
    expect(request?.headers.get("untrusted")).toBeNull()
  })

  test("does not forward malformed values from a mutated request context", async () => {
    const { config, event } = runtime({
      requestId: "../../spoofed",
      traceparent: "00-not-a-trace"
    })
    let request: Request | undefined
    vi.stubGlobal("fetch", vi.fn(async input => {
      request = input as Request
      return new Response(JSON.stringify({ authors: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    }))

    const client = createRuntimeLbApiClient(config, event, true)
    await client.POST("/authors/resolve", {
      body: { author_ids: ["SöderbergH"] }
    })

    expect(request?.headers.get("x-request-id")).toBeNull()
    expect(request?.headers.get("traceparent")).toBeNull()
  })

  test("keeps the browser path on the public API without server correlation", async () => {
    const { config, event } = runtime({
      requestId: REQUEST_ID,
      traceparent: TRACEPARENT
    })
    config.public.apiBase = "http://frontend.test/api/v2"
    let request: Request | undefined
    vi.stubGlobal("fetch", vi.fn(async input => {
      request = input as Request
      return new Response(JSON.stringify({ authors: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    }))

    const client = createRuntimeLbApiClient(config, event, false)
    await client.POST("/authors/resolve", {
      body: { author_ids: ["SöderbergH"] }
    })

    expect(request?.url).toBe("http://frontend.test/api/v2/authors/resolve")
    expect(request?.headers.get("x-request-id")).toBeNull()
    expect(request?.headers.get("traceparent")).toBeNull()
  })
})
