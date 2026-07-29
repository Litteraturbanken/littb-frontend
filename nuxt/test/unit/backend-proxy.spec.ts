import { createServer } from "node:http"
import { once } from "node:events"

import { createApp, toNodeListener } from "h3"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  proxyBackendRequest,
  safeBackendPath
} from "../../server/utils/backend-proxy"
import { initializeRequestObservability } from "../../server/utils/observability"

afterEach(() => {
  vi.unstubAllGlobals()
})

async function routeResponse(
  routePath: string,
  method: string
): Promise<Response> {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler)
  vi.stubGlobal("useRuntimeConfig", () => ({
    apiBase: "http://backend.invalid/v2",
    contentBase: "http://content.invalid",
    libraryApiBase: "http://backend.invalid"
  }))
  const handler = (await import(routePath)).default
  const app = createApp().use(handler)
  const server = createServer(toNodeListener(app))
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Expected TCP server")
  try {
    return await fetch(`http://127.0.0.1:${address.port}/asset`, { method })
  } finally {
    server.close()
    await once(server, "close")
  }
}

describe("backend proxy paths", () => {
  test("encodes every decoded path segment", () => {
    expect(safeBackendPath("authors/SöderbergH"))
      .toBe("authors/S%C3%B6derbergH")
    expect(safeBackendPath("works/a b%20c"))
      .toBe("works/a%20b%2520c")
  })

  test.each([
    undefined,
    "",
    "/authors",
    "authors/",
    "authors//SöderbergH",
    ".",
    "../private",
    "authors/../private",
    "reader\\private",
    "reader/\u0000private",
    "reader/\u001fprivate",
    "reader/\u007fprivate"
  ])("rejects unsafe backend path %j", value => {
    expect(() => safeBackendPath(value)).toThrowError(/Invalid backend path/u)
  })
})

describe("proxy method contracts", () => {
  test.each([
    ["backend catch-all", "../../server/routes/api/[...path]", "DELETE"],
    ["backend index", "../../server/routes/api/index", "PUT"]
  ])("%s returns its exact Allow header on 405", async (_label, route, method) => {
    const response = await routeResponse(route, method)

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("GET, HEAD, POST")
  })

  test("red asset route returns its exact Allow header on 405", async () => {
    const response = await routeResponse("../../server/routes/red/[...path]", "POST")

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("GET, HEAD")
  })
})

describe("proxy correlation", () => {
  test("forwards the current request and W3C trace identifiers", async () => {
    let upstreamHeaders: Headers | undefined
    const upstream = createServer((request, response) => {
      upstreamHeaders = new Headers(request.headers as Record<string, string>)
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ ok: true }))
    })
    upstream.listen(0, "127.0.0.1")
    await once(upstream, "listening")
    const upstreamAddress = upstream.address()
    if (!upstreamAddress || typeof upstreamAddress === "string") {
      throw new Error("Expected upstream TCP server")
    }

    const app = createApp().use(event => {
      initializeRequestObservability(event, {
        environment: "development",
        deploymentGitSha: "0".repeat(40),
        emit: () => undefined
      })
      return proxyBackendRequest(
        event,
        `http://127.0.0.1:${upstreamAddress.port}`,
        "stats"
      )
    })
    const proxy = createServer(toNodeListener(app))
    proxy.listen(0, "127.0.0.1")
    await once(proxy, "listening")
    const proxyAddress = proxy.address()
    if (!proxyAddress || typeof proxyAddress === "string") {
      throw new Error("Expected proxy TCP server")
    }

    try {
      await fetch(`http://127.0.0.1:${proxyAddress.port}/stats`, {
        headers: {
          "x-request-id": "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d",
          traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"
        }
      })

      expect(upstreamHeaders?.get("x-request-id")).toBe(
        "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d"
      )
      expect(upstreamHeaders?.get("traceparent")).toMatch(
        /^00-0123456789abcdef0123456789abcdef-[0-9a-f]{16}-01$/u
      )
    } finally {
      proxy.close()
      upstream.close()
      await Promise.all([once(proxy, "close"), once(upstream, "close")])
    }
  })
})
