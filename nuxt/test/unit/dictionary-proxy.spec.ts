import { once } from "node:events"
import { createServer } from "node:http"

import { createApp, toNodeListener } from "h3"
import { afterEach, describe, expect, test, vi } from "vitest"

import { initializeRequestObservability } from "../../server/utils/observability"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("dictionary backend proxy", () => {
  test("preserves query and response while forwarding only trusted correlation headers", async () => {
    let upstreamRequest: { headers: Headers, url: string } | undefined
    const upstream = createServer((request, response) => {
      upstreamRequest = {
        headers: new Headers(request.headers as Record<string, string>),
        url: request.url ?? ""
      }
      response.writeHead(200, {
        "content-type": "application/json",
        "x-dictionary-response": "preserved"
      })
      response.end(JSON.stringify([{ word: "kyrka" }]))
    })
    upstream.listen(0, "127.0.0.1")
    await once(upstream, "listening")
    const upstreamAddress = upstream.address()
    if (!upstreamAddress || typeof upstreamAddress === "string") {
      throw new Error("Expected upstream TCP server")
    }

    vi.stubGlobal("defineEventHandler", (handler: unknown) => handler)
    vi.stubGlobal("useRuntimeConfig", () => ({
      apiBase: `http://127.0.0.1:${upstreamAddress.port}/v2`
    }))
    const dictionaryHandler = (
      await import("../../server/api/v2/dictionary/articles.get")
    ).default
    const app = createApp()
      .use(event => {
        initializeRequestObservability(event, {
          environment: "development",
          deploymentGitSha: "0".repeat(40),
          emit: () => undefined
        })
      })
      .use(dictionaryHandler)
    const proxy = createServer(toNodeListener(app))
    proxy.listen(0, "127.0.0.1")
    await once(proxy, "listening")
    const proxyAddress = proxy.address()
    if (!proxyAddress || typeof proxyAddress === "string") {
      throw new Error("Expected proxy TCP server")
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${proxyAddress.port}/api/v2/dictionary/articles?word=kyrka&limit=7`,
        {
          headers: {
            authorization: "Bearer untrusted",
            cookie: "session=untrusted",
            "x-private": "untrusted",
            "x-request-id": "../../spoofed",
            traceparent: "00-not-a-trace"
          }
        }
      )

      expect(response.status).toBe(200)
      expect(response.headers.get("x-dictionary-response")).toBe("preserved")
      await expect(response.json()).resolves.toEqual([{ word: "kyrka" }])
      expect(upstreamRequest?.url).toBe(
        "/v2/dictionary/articles?word=kyrka&limit=7"
      )
      expect(upstreamRequest?.headers.get("authorization")).toBeNull()
      expect(upstreamRequest?.headers.get("cookie")).toBeNull()
      expect(upstreamRequest?.headers.get("x-private")).toBeNull()
      expect(upstreamRequest?.headers.get("x-request-id")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      )
      expect(upstreamRequest?.headers.get("traceparent")).toMatch(
        /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u
      )
    } finally {
      proxy.close()
      upstream.close()
      await Promise.all([once(proxy, "close"), once(upstream, "close")])
    }
  })
})
