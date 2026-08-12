import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type RequestListener,
  type Server,
  type ServerResponse
} from "node:http"
import { once } from "node:events"
import { gzipSync } from "node:zlib"

import { createApp, createRouter, toNodeListener, type H3Event } from "h3"
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

async function redProxyOrigin(
  contentBase: string,
  onEvent?: (event: H3Event) => void
): Promise<string> {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler)
  vi.stubGlobal("useRuntimeConfig", () => ({ contentBase }))
  const handler = (await import("../../server/routes/red/[...path]")).default
  const observedHandler = (event: H3Event) => {
    onEvent?.(event)
    return handler(event)
  }
  const router = createRouter()
    .get("/red/**:path", observedHandler)
    .head("/red/**:path", observedHandler)
  const { origin } = await listen(toNodeListener(createApp().use(router.handler)))
  return origin
}

async function rawRequest(origin: string, path: string): Promise<{
  body: string
  headers: IncomingHttpHeaders
  status: number
}> {
  const url = new URL(origin)
  return await new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: url.hostname,
      path,
      port: url.port
    }, (response) => {
      const chunks: Buffer[] = []
      response.on("data", chunk => chunks.push(Buffer.from(chunk)))
      response.on("end", () => resolve({
        body: Buffer.concat(chunks).toString("utf8"),
        headers: response.headers,
        status: response.statusCode ?? 0
      }))
    })
    request.on("error", reject)
    request.end()
  })
}

afterEach(async () => {
  vi.unstubAllGlobals()
  const servers = openServers.splice(0)
  for (const server of servers) server.close()
  await Promise.all(servers.map(server => once(server, "close")))
})

describe("red content proxy boundary", () => {
  test("cancels a streaming upstream response when the downstream client disconnects", async () => {
    let requestAborted = false
    let responseClosedBeforeEnd = false
    let resolveClosed!: (closedBeforeCompletion: boolean) => void
    const closed = new Promise<boolean>(resolve => {
      resolveClosed = resolve
    })
    const upstream = await listen((_request, response) => {
      let completed = false
      response.writeHead(200, { "content-type": "application/octet-stream" })
      response.write(Buffer.alloc(1024, 1))
      const interval = setInterval(() => response.write(Buffer.alloc(1024, 2)), 25)
      const completion = setTimeout(() => {
        completed = true
        clearInterval(interval)
        response.end()
      }, 5_000)
      response.on("close", () => {
        clearInterval(interval)
        clearTimeout(completion)
        resolveClosed(!completed)
      })
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin, (event) => {
      event.node.req.once("aborted", () => { requestAborted = true })
      event.node.res.once("close", () => {
        responseClosedBeforeEnd = !event.node.res.writableEnded
      })
    })
    const url = new URL("/red/assets/slow.bin", proxyOrigin)

    const downstream = httpRequest(url)
    downstream.on("error", () => undefined)
    const firstChunk = new Promise<void>((resolve, reject) => {
      downstream.on("response", (response) => {
        response.once("data", () => resolve())
        response.on("error", () => undefined)
      })
      downstream.on("error", reject)
    })
    downstream.end()
    await firstChunk
    downstream.destroy()

    expect(await Promise.race([
      closed,
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1_000))
    ])).toBe(true)
    expect(responseClosedBeforeEnd).toBe(true)
    expect(requestAborted || responseClosedBeforeEnd).toBe(true)
  })

  test("removes disconnect listeners after a normally completed response", async () => {
    let upstreamClosedBeforeCompletion: boolean | undefined
    const upstream = await listen((_request, response) => {
      let completed = false
      response.on("close", () => {
        upstreamClosedBeforeCompletion = !completed
      })
      response.writeHead(200, { "content-type": "text/plain" })
      completed = true
      response.end("complete asset")
    })
    let request: IncomingMessage | undefined
    let response: ServerResponse | undefined
    const proxyOrigin = await redProxyOrigin(upstream.origin, (event) => {
      request = event.node.req
      response = event.node.res
    })

    const result = await fetch(`${proxyOrigin}/red/assets/complete.txt`)

    expect(await result.text()).toBe("complete asset")
    expect(upstreamClosedBeforeCompletion).toBe(false)
    expect(request?.listenerCount("aborted")).toBe(0)
    expect(response?.listenerCount("close")).toBe(0)
  })

  test("decodes each raw path segment exactly once and forwards canonical encoding", async () => {
    const upstreamTargets: string[] = []
    const upstream = await listen((request, response) => {
      upstreamTargets.push(request.url ?? "")
      response.writeHead(200, { "content-type": "text/plain" })
      response.end("asset")
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const encoded = await rawRequest(
      proxyOrigin,
      "/red/images/Svensk%20lyrik/F%c3%b6rfattare%3F%23.jpg?download=a%2Fb&mode=a+b"
    )
    const safelyNestedEncoding = await rawRequest(
      proxyOrigin,
      "/red/images/F%25C3%25B6rfattare/cover%2520one.jpg"
    )

    expect(encoded.status).toBe(200)
    expect(safelyNestedEncoding.status).toBe(200)
    expect(upstreamTargets).toEqual([
      "/red/images/Svensk%20lyrik/F%C3%B6rfattare%3F%23.jpg?download=a%2Fb&mode=a+b",
      "/red/images/F%25C3%25B6rfattare/cover%2520one.jpg"
    ])
  })

  test.each([
    "/red/images/%2e%2e/private.txt",
    "/red/images/%252e%252e/private.txt",
    "/red/images/safe%2Fprivate.txt",
    "/red/images/safe%252fprivate.txt",
    "/red/images/safe%5cprivate.txt",
    "/red/images/safe%255cprivate.txt",
    "/red/images/safe%250Aprivate.txt",
    "/red/images/%E0%A4%A.txt"
  ])("rejects unsafe or malformed encoded asset path %s", async (path) => {
    let upstreamRequests = 0
    const upstream = await listen((_request, response) => {
      upstreamRequests += 1
      response.writeHead(200)
      response.end("unexpected")
    })
    const proxyOrigin = await redProxyOrigin(upstream.origin)

    const response = await rawRequest(proxyOrigin, path)

    expect(response.status).toBe(400)
    expect(upstreamRequests).toBe(0)
  })

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
      location: null,
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

  test("only exposes static asset response metadata", async () => {
    const upstream = await listen((_request, response) => {
      response.writeHead(200, {
        "accept-ranges": "bytes",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=3600",
        "clear-site-data": "\"cookies\"",
        connection: "x-origin-hop, bad/name",
        "content-disposition": "inline; filename=cover.txt",
        "content-language": "sv",
        "content-security-policy": "default-src https://origin.invalid",
        "content-type": "text/plain; charset=utf-8",
        etag: '"asset-v1"',
        expires: "Wed, 21 Oct 2037 07:28:00 GMT",
        "keep-alive": "timeout=99",
        "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT",
        location: "https://origin.invalid/private",
        "permissions-policy": "camera=*",
        "proxy-authenticate": "Basic realm=origin",
        refresh: "0; url=https://origin.invalid/private",
        "set-cookie": "origin_session=secret; Path=/; HttpOnly",
        vary: "Accept",
        "www-authenticate": "Bearer realm=origin",
        "x-origin-hop": "origin-secret",
        "x-static-metadata": "origin-only"
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
    expect(response.headers.get("x-static-metadata")).toBeNull()
    expect(Object.fromEntries([
      "clear-site-data",
      "content-security-policy",
      "location",
      "permissions-policy",
      "refresh",
      "set-cookie",
      "access-control-allow-origin",
      "www-authenticate"
    ].map(name => [name, response.headers.get(name)]))).toEqual({
      "clear-site-data": null,
      "content-security-policy": null,
      location: null,
      "permissions-policy": null,
      refresh: null,
      "set-cookie": null,
      "access-control-allow-origin": null,
      "www-authenticate": null
    })
    expect(Object.fromEntries([
      "accept-ranges",
      "cache-control",
      "content-disposition",
      "content-language",
      "content-type",
      "etag",
      "expires",
      "last-modified",
      "vary"
    ].map(name => [name, response.headers.get(name)]))).toEqual({
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=3600",
      "content-disposition": "inline; filename=cover.txt",
      "content-language": "sv",
      "content-type": "text/plain; charset=utf-8",
      etag: '"asset-v1"',
      expires: "Wed, 21 Oct 2037 07:28:00 GMT",
      "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT",
      vary: "Accept"
    })
  })

  test("lets Fetch negotiate and decode compression instead of copying the client encoding", async () => {
    let upstreamAcceptEncoding: string | undefined
    const upstream = await listen((request, response) => {
      upstreamAcceptEncoding = request.headers["accept-encoding"]
      response.writeHead(200, {
        "content-encoding": "gzip",
        "content-length": String(gzipSync("compressed asset").byteLength),
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
    expect(response.headers.get("content-length")).toBeNull()
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
