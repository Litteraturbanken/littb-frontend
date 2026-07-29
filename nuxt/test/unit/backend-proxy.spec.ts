import { createServer } from "node:http"
import { once } from "node:events"

import { createApp, toNodeListener } from "h3"
import { afterEach, describe, expect, test, vi } from "vitest"

import { safeBackendPath } from "../../server/utils/backend-proxy"

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
