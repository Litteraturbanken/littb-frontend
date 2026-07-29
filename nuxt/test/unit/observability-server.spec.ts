import { createServer } from "node:http"
import { once } from "node:events"

import { createApp, createRouter, eventHandler, toNodeListener } from "h3"
import { describe, expect, test, vi } from "vitest"

import {
  createObservabilityContext,
  initializeRequestObservability,
  type ObservabilityRequestEvent
} from "../../server/utils/observability"

const VALID_REQUEST_ID = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d"
const VALID_TRACE_ID = "0123456789abcdef0123456789abcdef"
const VALID_PARENT_ID = "0123456789abcdef"

describe("Nuxt observability context", () => {
  test("continues valid request and trace identifiers with a new server span", () => {
    const context = createObservabilityContext({
      requestId: VALID_REQUEST_ID,
      traceparent: `00-${VALID_TRACE_ID}-${VALID_PARENT_ID}-01`
    })

    expect(context.requestId).toBe(VALID_REQUEST_ID)
    expect(context.traceId).toBe(VALID_TRACE_ID)
    expect(context.spanId).toMatch(/^[0-9a-f]{16}$/u)
    expect(context.spanId).not.toBe(VALID_PARENT_ID)
    expect(context.traceparent).toBe(
      `00-${VALID_TRACE_ID}-${context.spanId}-01`
    )
  })

  test.each([
    ["request ID", { requestId: "../../secret", traceparent: undefined }],
    ["oversized request ID", { requestId: "a".repeat(1000), traceparent: undefined }],
    ["traceparent", { requestId: undefined, traceparent: "00-not-a-trace" }],
    ["zero trace", {
      requestId: undefined,
      traceparent: `00-${"0".repeat(32)}-${VALID_PARENT_ID}-01`
    }],
    ["zero parent span", {
      requestId: undefined,
      traceparent: `00-${VALID_TRACE_ID}-${"0".repeat(16)}-01`
    }]
  ])("replaces an invalid incoming %s", (_label, incoming) => {
    const context = createObservabilityContext(incoming)

    expect(context.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    )
    expect(context.traceId).toMatch(/^[0-9a-f]{32}$/u)
    expect(context.traceId).not.toBe("0".repeat(32))
  })

  test("replaces a trace whose parent span is all zero", () => {
    const context = createObservabilityContext({
      traceparent: `00-${VALID_TRACE_ID}-${"0".repeat(16)}-01`
    })

    expect(context.traceId).not.toBe(VALID_TRACE_ID)
  })
})

describe("Nuxt request events", () => {
  test("returns correlation headers and emits exactly one query-free completion event", async () => {
    const emitted: ObservabilityRequestEvent[] = []
    const router = createRouter().get(
      "/works/:workId",
      eventHandler(() => ({ ok: true }))
    )
    const app = createApp()
      .use(eventHandler(event => {
        initializeRequestObservability(event, {
          environment: "stage",
          deploymentGitSha: "a".repeat(40),
          emit: value => emitted.push(value),
          nowNs: (() => {
            let value = 1_000_000_000n
            return () => {
              value += 5_000_000n
              return value
            }
          })()
        })
      }))
      .use(router.handler)
    const server = createServer(toNodeListener(app))
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("Expected a TCP server")
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/works/lb123?phrase=private-value`,
        {
          headers: {
            "x-request-id": VALID_REQUEST_ID,
            traceparent: `00-${VALID_TRACE_ID}-${VALID_PARENT_ID}-01`
          }
        }
      )
      await response.text()
      await vi.waitFor(() => expect(emitted).toHaveLength(1))

      expect(response.headers.get("x-request-id")).toBe(VALID_REQUEST_ID)
      expect(response.headers.get("traceparent")).toMatch(
        new RegExp(`^00-${VALID_TRACE_ID}-[0-9a-f]{16}-01$`, "u")
      )
      expect(emitted[0]).toMatchObject({
        schema_version: "lb.observability.v1",
        event_name: "request.completed",
        service: "lb-frontend",
        producer: "nuxt-server",
        environment: "stage",
        deployment_git_sha: "a".repeat(40),
        request_id: VALID_REQUEST_ID,
        trace_id: VALID_TRACE_ID,
        route: "/works/:workId",
        http_method: "GET",
        status_code: 200
      })
      expect(JSON.stringify(emitted[0])).not.toContain("private-value")
      expect(emitted[0].duration_ms).toBeGreaterThanOrEqual(0)
    } finally {
      server.close()
      await once(server, "close")
    }
  })

  test("emits one failure event for a failed response", async () => {
    const emitted: ObservabilityRequestEvent[] = []
    const router = createRouter().get("/missing", eventHandler(() => {
      throw new Error("secret error message")
    }))
    const app = createApp()
      .use(eventHandler(event => {
        initializeRequestObservability(event, {
          environment: "development",
          deploymentGitSha: "0".repeat(40),
          emit: value => emitted.push(value)
        })
      }))
      .use(router.handler)
    const server = createServer(toNodeListener(app))
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("Expected a TCP server")
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/missing`)
      await response.text()
      await vi.waitFor(() => expect(emitted).toHaveLength(1))

      expect(response.status).toBe(500)
      expect(emitted[0]).toMatchObject({
        event_name: "request.failed",
        severity: "error",
        status_code: 500,
        route: "/missing"
      })
      expect(JSON.stringify(emitted[0])).not.toContain("secret error message")
    } finally {
      server.close()
      await once(server, "close")
    }
  })
})
