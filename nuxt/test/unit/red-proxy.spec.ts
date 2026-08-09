import { createServer, type RequestListener, type Server } from "node:http"
import { once } from "node:events"
import { gzipSync } from "node:zlib"

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
  const router = createRouter()
    .get("/red/**:path", handler)
    .head("/red/**:path", handler)
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
        "cache-control": "max-age=0",
        "if-match": '"asset-v1"',
        "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
        "if-none-match": '"asset-v1"',
        "if-range": '"asset-v1"',
        "if-unmodified-since": "Thu, 22 Oct 2015 07:28:00 GMT",
        pragma: "client-no-cache",
        range: "bytes=10-19"
      }
    })
    await response.text()

    expect(Object.fromEntries([
      "accept",
      "cache-control",
      "if-match",
      "if-modified-since",
      "if-none-match",
      "if-range",
      "if-unmodified-since",
      "pragma",
      "range"
    ].map(name => [name, upstreamHeaders?.get(name)]))).toEqual({
      accept: "image/avif,image/webp,image/jpeg",
      "cache-control": "max-age=0",
      "if-match": '"asset-v1"',
      "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
      "if-none-match": '"asset-v1"',
      "if-range": '"asset-v1"',
      "if-unmodified-since": "Thu, 22 Oct 2015 07:28:00 GMT",
      pragma: "client-no-cache",
      range: "bytes=10-19"
    })
  })

  test("returns upstream redirects without following them across origins", async () => {
    let redirectTargetHeaders: Headers | undefined
    let redirectTargetRequests = 0
    const redirectTarget = await listen((request, response) => {
      redirectTargetRequests += 1
      redirectTargetHeaders = new Headers(request.headers as Record<string, string>)
      response.writeHead(200, { "content-type": "text/plain" })
      response.end("private target")
    })
    const upstream = await listen((_request, response) => {
      response.writeHead(307, {
        location: `${redirectTarget.origin}/private-network-target`
      })
      response.end()
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const response = await fetch(`${proxyOrigin}/red/images/cover.jpg`, {
      headers: {
        "if-none-match": '"asset-v1"',
        range: "bytes=10-19"
      },
      redirect: "manual"
    })
    await response.text()

    expect({
      location: response.headers.get("location"),
      status: response.status,
      targetIfNoneMatch: redirectTargetHeaders?.get("if-none-match"),
      targetRange: redirectTargetHeaders?.get("range"),
      targetRequests: redirectTargetRequests
    }).toEqual({
      location: `${redirectTarget.origin}/private-network-target`,
      status: 307,
      targetIfNoneMatch: undefined,
      targetRange: undefined,
      targetRequests: 0
    })
  })

  test("preserves HEAD range status and metadata without returning a body", async () => {
    let upstreamMethod: string | undefined
    let upstreamRange: string | undefined
    const upstream = await listen((request, response) => {
      upstreamMethod = request.method
      upstreamRange = request.headers.range
      response.writeHead(206, {
        "accept-ranges": "bytes",
        "content-range": "bytes 10-19/100",
        "content-type": "image/jpeg",
        etag: '"asset-v1"'
      })
      response.end("not returned for HEAD")
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const response = await fetch(`${proxyOrigin}/red/images/cover.jpg`, {
      headers: { range: "bytes=10-19" },
      method: "HEAD"
    })

    expect(response.status).toBe(206)
    expect(await response.text()).toBe("")
    expect({
      acceptRanges: response.headers.get("accept-ranges"),
      contentRange: response.headers.get("content-range"),
      etag: response.headers.get("etag"),
      upstreamMethod,
      upstreamRange
    }).toEqual({
      acceptRanges: "bytes",
      contentRange: "bytes 10-19/100",
      etag: '"asset-v1"',
      upstreamMethod: "HEAD",
      upstreamRange: "bytes=10-19"
    })
  })

  test("preserves a cache-validation 304 response", async () => {
    const upstream = await listen((request, response) => {
      expect(request.headers["if-none-match"]).toBe('"asset-v1"')
      response.writeHead(304, {
        "cache-control": "public, max-age=3600",
        etag: '"asset-v1"',
        "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT"
      })
      response.end()
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const response = await fetch(`${proxyOrigin}/red/images/cover.jpg`, {
      headers: { "if-none-match": '"asset-v1"' }
    })

    expect(response.status).toBe(304)
    expect(await response.text()).toBe("")
    expect({
      cacheControl: response.headers.get("cache-control"),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    }).toEqual({
      cacheControl: "public, max-age=3600",
      etag: '"asset-v1"',
      lastModified: "Wed, 21 Oct 2015 07:28:00 GMT"
    })
  })

  test("preserves a failed If-Match precondition as 412", async () => {
    const upstream = await listen((request, response) => {
      if (request.headers["if-match"] === '"stale-asset"') {
        response.writeHead(412, { etag: '"current-asset"' })
        response.end("precondition failed")
        return
      }
      response.writeHead(200)
      response.end("unexpected match")
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const response = await fetch(`${proxyOrigin}/red/images/cover.jpg`, {
      headers: { "if-match": '"stale-asset"' }
    })

    expect(response.status).toBe(412)
    expect(await response.text()).toBe("precondition failed")
    expect(response.headers.get("etag")).toBe('"current-asset"')
  })

  test("does not copy origin hop-by-hop response headers", async () => {
    const upstream = await listen((_request, response) => {
      response.writeHead(200, {
        connection: "x-origin-hop, bad/name",
        "keep-alive": "timeout=99",
        "proxy-authenticate": "Basic realm=origin",
        "x-origin-hop": "origin-secret",
        "x-static-metadata": "preserved"
      })
      response.end("asset")
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const response = await fetch(`${proxyOrigin}/red/images/cover.jpg`)
    await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("connection")).not.toBe("x-origin-hop, bad/name")
    expect(response.headers.get("keep-alive")).not.toBe("timeout=99")
    expect(response.headers.get("proxy-authenticate")).toBeNull()
    expect(response.headers.get("x-origin-hop")).toBeNull()
    expect(response.headers.get("x-static-metadata")).toBe("preserved")
  })

  test("lets Fetch negotiate and decode compression instead of copying the client encoding", async () => {
    let upstreamAcceptEncoding: string | undefined
    const upstream = await listen((request, response) => {
      upstreamAcceptEncoding = request.headers["accept-encoding"]
      response.writeHead(200, {
        "content-encoding": "gzip",
        "content-type": "text/plain",
        etag: '"compressed-v1"'
      })
      response.end(gzipSync("compressed asset"))
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const response = await fetch(`${proxyOrigin}/red/assets/compressed.txt`, {
      headers: { "accept-encoding": "client-only-encoding" }
    })

    expect(upstreamAcceptEncoding).not.toBe("client-only-encoding")
    expect(response.headers.get("content-encoding")).toBeNull()
    expect(response.headers.get("etag")).toBe('"compressed-v1"')
    expect(await response.text()).toBe("compressed asset")
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
