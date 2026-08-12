import { once } from "node:events"
import { createServer } from "node:http"

import { createApp, toNodeListener, type H3Event } from "h3"
import { afterEach, describe, expect, test, vi } from "vitest"

import { createServerLbApiClient } from "../../server/utils/server-lb-api-client"
import { initializeRequestObservability } from "../../server/utils/observability"

const VALID_REQUEST_ID = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d"
const VALID_TRACE_ID = "0123456789abcdef0123456789abcdef"
const VALID_PARENT_ID = "0123456789abcdef"

afterEach(() => {
  vi.unstubAllGlobals()
})

async function captureServerRequest(
  incomingHeaders: Record<string, string>
): Promise<Request> {
  let backendRequest: Request | undefined
  vi.stubGlobal("useRuntimeConfig", () => ({
    apiBase: "http://backend.test/v2"
  }))
  const app = createApp().use(async event => {
    initializeRequestObservability(event, {
      environment: "development",
      deploymentGitSha: "0".repeat(40),
      emit: () => undefined
    })
    const client = createServerLbApiClient(event, async request => {
      backendRequest = request
      return new Response(JSON.stringify({
        author_id: "SöderbergH",
        title_id: "DoktorGlas"
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    })
    await client.POST("/legacy-author-routes/resolve", {
      body: {
        media_type: "etext",
        normalized_author_id: "SöderbergH",
        normalized_title_id: "DoktorGlas"
      }
    })
    return { ok: true }
  })
  const server = createServer(toNodeListener(app))
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server")
  }
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/resolve`, {
      headers: incomingHeaders
    })
    expect(response.status).toBe(200)
    await response.arrayBuffer()
  } finally {
    server.close()
    await once(server, "close")
  }
  if (!backendRequest) throw new Error("Expected a backend request")
  return backendRequest
}

function eventWithCorrelation(): H3Event {
  return {
    context: {
      observability: {
        context: {
          requestId: VALID_REQUEST_ID,
          traceId: VALID_TRACE_ID,
          spanId: VALID_PARENT_ID,
          traceparent: `00-${VALID_TRACE_ID}-${VALID_PARENT_ID}-01`
        },
        startedNs: 0n
      }
    }
  } as H3Event
}

describe("server lb-api client", () => {
  test("forwards only validated correlation context with the original URL and body", async () => {
    const request = await captureServerRequest({
      authorization: "Bearer untrusted",
      cookie: "session=untrusted",
      "x-request-id": VALID_REQUEST_ID,
      traceparent: `00-${VALID_TRACE_ID}-${VALID_PARENT_ID}-00`,
      "x-untrusted": "untrusted"
    })

    expect(request.url).toBe("http://backend.test/v2/legacy-author-routes/resolve")
    expect(request.method).toBe("POST")
    expect(request.headers.get("x-request-id")).toBe(VALID_REQUEST_ID)
    expect(request.headers.get("traceparent")).toMatch(
      new RegExp(`^00-${VALID_TRACE_ID}-[0-9a-f]{16}-00$`, "u")
    )
    expect(request.headers.get("authorization")).toBeNull()
    expect(request.headers.get("cookie")).toBeNull()
    expect(request.headers.get("x-untrusted")).toBeNull()
    await expect(request.clone().json()).resolves.toEqual({
      media_type: "etext",
      normalized_author_id: "SöderbergH",
      normalized_title_id: "DoktorGlas"
    })
  })

  test("replaces invalid inbound correlation values before forwarding", async () => {
    const request = await captureServerRequest({
      "x-request-id": "../../untrusted",
      traceparent: "00-not-a-trace"
    })

    expect(request.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    )
    expect(request.headers.get("traceparent")).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u
    )
    expect(request.headers.get("traceparent")).not.toContain("not-a-trace")
  })

  test("preserves abort propagation and the original fetch rejection", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      apiBase: "http://backend.test/v2"
    }))
    const controller = new AbortController()
    let backendSignal: AbortSignal | undefined
    const rejection = new DOMException("cancelled", "AbortError")
    const client = createServerLbApiClient(eventWithCorrelation(), request => {
      backendSignal = request.signal
      return new Promise((_resolve, reject) => {
        request.signal.addEventListener("abort", () => reject(rejection), {
          once: true
        })
      })
    })

    const pending = client.GET("/works/{author_id}/{title_path}/manifest", {
      params: {
        path: { author_id: "SöderbergH", title_path: "DoktorGlas" },
        query: { media_type: "etext" }
      },
      signal: controller.signal
    })
    controller.abort()

    await expect(pending).rejects.toBe(rejection)
    expect(backendSignal?.aborted).toBe(true)
  })
})
