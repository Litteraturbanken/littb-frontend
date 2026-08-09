import { createServer, type RequestListener, type Server } from "node:http"
import { once } from "node:events"

import { createApp, createRouter, toNodeListener } from "h3"
import { afterEach, describe, expect, test, vi } from "vitest"

const openServers: Server[] = []

async function listen(listener: RequestListener): Promise<{
  origin: string
  server: Server
}> {
  const server = createServer(listener)
  openServers.push(server)
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server")
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    server
  }
}

async function redProxyOrigin(contentBase: string): Promise<string> {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler)
  vi.stubGlobal("useRuntimeConfig", () => ({ contentBase }))
  const handler = (await import("../../server/routes/red/[...path]")).default
  const router = createRouter().get("/red/**:path", handler)
  const { origin } = await listen(toNodeListener(createApp().use(router.handler)))
  return origin
}

afterEach(async () => {
  vi.unstubAllGlobals()
  const servers = openServers.splice(0)
  for (const server of servers) server.close()
  await Promise.all(servers.map(server => once(server, "close")))
})

describe("red content proxy boundary", () => {
  test("does not send client credentials or private headers to the content origin", async () => {
    let upstreamHeaders: Headers | undefined
    const upstream = await listen((request, response) => {
      upstreamHeaders = new Headers(request.headers as Record<string, string>)
      response.writeHead(200, { "content-type": "text/plain" })
      response.end("asset")
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const response = await fetch(`${proxyOrigin}/red/images/cover.txt`, {
      headers: {
        authorization: "Bearer client-secret",
        cookie: "session=client-secret",
        "x-private-client-header": "client-secret"
      }
    })
    await response.text()

    expect({
      authorization: upstreamHeaders?.get("authorization"),
      cookie: upstreamHeaders?.get("cookie"),
      privateHeader: upstreamHeaders?.get("x-private-client-header")
    }).toEqual({
      authorization: null,
      cookie: null,
      privateHeader: null
    })
  })

  test("forwards representation, range, and cache-validation request headers", async () => {
    let upstreamHeaders: Headers | undefined
    const upstream = await listen((request, response) => {
      upstreamHeaders = new Headers(request.headers as Record<string, string>)
      response.writeHead(200, { "content-type": "text/plain" })
      response.end("asset")
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const response = await fetch(`${proxyOrigin}/red/images/cover.jpg`, {
      headers: {
        accept: "image/avif,image/webp,image/jpeg",
        "cache-control": "no-cache",
        "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
        "if-none-match": '"asset-v1"',
        "if-range": '"asset-v1"',
        range: "bytes=10-19"
      }
    })
    await response.text()

    expect(Object.fromEntries([
      "accept",
      "cache-control",
      "if-modified-since",
      "if-none-match",
      "if-range",
      "range"
    ].map(name => [name, upstreamHeaders?.get(name)]))).toEqual({
      accept: "image/avif,image/webp,image/jpeg",
      "cache-control": "no-cache",
      "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
      "if-none-match": '"asset-v1"',
      "if-range": '"asset-v1"',
      range: "bytes=10-19"
    })
  })

  test("does not expose origin cookies while preserving asset response metadata", async () => {
    const upstream = await listen((_request, response) => {
      response.writeHead(206, {
        "accept-ranges": "bytes",
        "cache-control": "public, max-age=3600",
        "content-range": "bytes 0-3/8",
        "content-type": "image/jpeg",
        etag: '"asset-v1"',
        "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT",
        "set-cookie": [
          "origin_session=secret; Path=/; HttpOnly",
          "origin_preference=secret; Path=/"
        ]
      })
      response.end("data")
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const response = await fetch(`${proxyOrigin}/red/images/cover.jpg`)

    expect(response.status).toBe(206)
    expect(await response.text()).toBe("data")
    expect(Object.fromEntries([
      "accept-ranges",
      "cache-control",
      "content-range",
      "content-type",
      "etag",
      "last-modified"
    ].map(name => [name, response.headers.get(name)]))).toEqual({
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=3600",
      "content-range": "bytes 0-3/8",
      "content-type": "image/jpeg",
      etag: '"asset-v1"',
      "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT"
    })
    expect(response.headers.get("set-cookie")).toBeNull()
  })
})
