import { afterEach, describe, expect, test, vi } from "vitest"

import { useLbApiClient } from "../../app/composables/useLbApiClient"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("SSR-aware lb-api client", () => {
  test("keeps the browser path on the public API without server correlation", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      apiBase: "http://backend.test/v2",
      public: { apiBase: "http://frontend.test/api/v2" }
    }))
    let request: Request | undefined
    vi.stubGlobal("fetch", vi.fn(async input => {
      request = input as Request
      return new Response(JSON.stringify({ authors: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    }))

    const client = useLbApiClient()
    await client.POST("/authors/resolve", {
      body: { author_ids: ["SöderbergH"] }
    })

    expect(request?.url).toBe("http://frontend.test/api/v2/authors/resolve")
    expect(request?.headers.get("x-request-id")).toBeNull()
    expect(request?.headers.get("traceparent")).toBeNull()
  })
})
