import { createServer } from "node:http"
import { once } from "node:events"

import { createApp, toNodeListener } from "h3"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  proxyBackendRequest,
  safeBackendPath
} from "../../server/utils/backend-proxy"
import { initializeRequestObservability } from "../../server/utils/observability"

type UpstreamRequest = {
  body: Buffer
  headers: Headers
  method: string
  url: string
}

type UpstreamReply = {
  body?: Buffer | string
  headers?: Record<string, string | string[]>
  status?: number
  statusMessage?: string
}

async function exerciseProxy(options: {
  body?: Buffer
  headers?: Record<string, string>
  initializeObservability?: boolean
  method: "GET" | "HEAD" | "POST"
  path?: string
  query?: string
  reply?: UpstreamReply
  root?: boolean
}): Promise<{ request: UpstreamRequest, response: Response }> {
  let resolveRequest!: (request: UpstreamRequest) => void
  const requestPromise = new Promise<UpstreamRequest>(resolve => {
    resolveRequest = resolve
  })
  const upstream = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on("data", chunk => chunks.push(Buffer.from(chunk)))
    request.on("end", () => {
      resolveRequest({
        body: Buffer.concat(chunks),
        headers: new Headers(request.headers as Record<string, string>),
        method: request.method ?? "",
        url: request.url ?? ""
      })
      const reply = options.reply ?? {}
      response.writeHead(reply.status ?? 200, reply.statusMessage, reply.headers ?? {
        "content-type": "application/json"
      })
      response.end(reply.body ?? JSON.stringify({ ok: true }))
    })
  })
  upstream.listen(0, "127.0.0.1")
  await once(upstream, "listening")
  const upstreamAddress = upstream.address()
  if (!upstreamAddress || typeof upstreamAddress === "string") {
    throw new Error("Expected upstream TCP server")
  }
  const base = `http://127.0.0.1:${upstreamAddress.port}`

  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler)
  vi.stubGlobal("useRuntimeConfig", () => ({ libraryApiBase: base }))
  const rootHandler = options.root
    ? (await import("../../server/routes/api/index")).default
    : null
  const app = createApp().use(event => {
    if (options.initializeObservability !== false) {
      initializeRequestObservability(event, {
        environment: "development",
        deploymentGitSha: "0".repeat(40),
        emit: () => undefined
      })
    }
    return rootHandler
      ? rootHandler(event)
      : proxyBackendRequest(event, base, options.path ?? "authors/Söderberg H")
  })
  const proxy = createServer(toNodeListener(app))
  proxy.listen(0, "127.0.0.1")
  await once(proxy, "listening")
  const proxyAddress = proxy.address()
  if (!proxyAddress || typeof proxyAddress === "string") {
    throw new Error("Expected proxy TCP server")
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${proxyAddress.port}/public${options.query ?? ""}`,
      {
        method: options.method,
        headers: options.headers,
        body: options.body
      }
    )
    return { request: await requestPromise, response }
  } finally {
    proxy.close()
    upstream.close()
    await Promise.all([once(proxy, "close"), once(upstream, "close")])
  }
}

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
    ["v2 catch-all", "../../server/routes/api/v2/[...path]", "PATCH"],
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

describe("backend proxy trust boundary", () => {
  test.each(["GET", "HEAD", "POST"] as const)(
    "%s forwards only content negotiation, POST content type, and validated correlation",
    async method => {
      const body = method === "POST" ? Buffer.from([0, 255, 195, 40, 10]) : undefined
      const { request } = await exerciseProxy({
        method,
        body,
        query: "?term=%C3%A5&repeat=one&repeat=two&literal=%252F",
        headers: {
          accept: "application/problem+json, application/json;q=0.9",
          authorization: "Bearer browser-secret",
          cookie: "session=browser-secret",
          "content-type": "application/octet-stream",
          forwarded: "for=private.internal;proto=https",
          "proxy-authorization": "Basic private",
          "x-backend-private": "must-not-cross",
          "x-forwarded-for": "10.0.0.8",
          "x-request-id": "spoofed-request-id",
          traceparent: "spoofed-traceparent"
        }
      })

      expect(request.method).toBe(method)
      expect(request.url).toBe(
        "/authors/S%C3%B6derberg%20H?term=%C3%A5&repeat=one&repeat=two&literal=%252F"
      )
      expect(request.body).toEqual(body ?? Buffer.alloc(0))
      expect(request.headers.get("accept")).toBe(
        "application/problem+json, application/json;q=0.9"
      )
      expect(request.headers.get("content-type")).toBe(
        method === "POST" ? "application/octet-stream" : null
      )
      expect(request.headers.get("authorization")).toBeNull()
      expect(request.headers.get("cookie")).toBeNull()
      expect(request.headers.get("forwarded")).toBeNull()
      expect(request.headers.get("proxy-authorization")).toBeNull()
      expect(request.headers.get("x-backend-private")).toBeNull()
      expect(request.headers.get("x-forwarded-for")).toBeNull()
      expect(request.headers.get("x-request-id")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      )
      expect(request.headers.get("x-request-id")).not.toBe("spoofed-request-id")
      expect(request.headers.get("traceparent")).toMatch(
        /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u
      )
      expect(request.headers.get("traceparent")).not.toBe("spoofed-traceparent")
    }
  )

  test("legacy API root applies the same request boundary and preserves its raw query", async () => {
    const { request } = await exerciseProxy({
      root: true,
      method: "GET",
      query: "?q=kyrka&repeat=ett&repeat=tv%C3%A5",
      headers: {
        accept: "application/json",
        authorization: "Bearer browser-secret",
        cookie: "session=browser-secret",
        "x-private": "must-not-cross"
      }
    })

    expect(request.url).toBe("/?q=kyrka&repeat=ett&repeat=tv%C3%A5")
    expect(request.headers.get("accept")).toBe("application/json")
    expect(request.headers.get("authorization")).toBeNull()
    expect(request.headers.get("cookie")).toBeNull()
    expect(request.headers.get("x-private")).toBeNull()
  })

  test("drops spoofed correlation when no validated request context exists", async () => {
    const { request } = await exerciseProxy({
      initializeObservability: false,
      method: "GET",
      headers: {
        "x-request-id": "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d",
        traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"
      }
    })

    expect(request.headers.get("x-request-id")).toBeNull()
    expect(request.headers.get("traceparent")).toBeNull()
  })

  test.each([
    { status: 404, statusMessage: "Missing", body: "saknas" },
    { status: 503, statusMessage: "Unavailable", body: "försök senare" }
  ])("preserves upstream $status status and body", async reply => {
    const { response } = await exerciseProxy({
      method: "GET",
      reply: {
        ...reply,
        headers: { "content-type": "text/plain; charset=utf-8" }
      }
    })

    expect(response.status).toBe(reply.status)
    expect(response.statusText).toBe(reply.statusMessage)
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8")
    expect(await response.text()).toBe(reply.body)
  })

  test("keeps essential response metadata but drops cookies and private or hop-by-hop headers", async () => {
    const { response } = await exerciseProxy({
      method: "GET",
      reply: {
        body: "metadata",
        headers: {
          "cache-control": "public, max-age=60",
          connection: "x-upstream-private",
          "content-disposition": "inline; filename=metadata.txt",
          "content-language": "sv",
          "content-type": "text/plain; charset=utf-8",
          etag: '"backend-etag"',
          expires: "Wed, 21 Oct 2037 07:28:00 GMT",
          "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT",
          "retry-after": "120",
          "set-cookie": [
            "backend_session=secret; HttpOnly; Path=/",
            "backend_preference=secret; Path=/"
          ],
          vary: "Accept",
          "x-upstream-private": "must-not-cross"
        }
      }
    })

    expect(Object.fromEntries([
      "cache-control",
      "content-disposition",
      "content-language",
      "content-type",
      "etag",
      "expires",
      "last-modified",
      "retry-after",
      "vary"
    ].map(name => [name, response.headers.get(name)]))).toEqual({
      "cache-control": "public, max-age=60",
      "content-disposition": "inline; filename=metadata.txt",
      "content-language": "sv",
      "content-type": "text/plain; charset=utf-8",
      etag: '"backend-etag"',
      expires: "Wed, 21 Oct 2037 07:28:00 GMT",
      "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT",
      "retry-after": "120",
      vary: "Accept"
    })
    expect(response.headers.get("set-cookie")).toBeNull()
    expect(response.headers.get("connection")).not.toBe("x-upstream-private")
    expect(response.headers.get("x-upstream-private")).toBeNull()
  })

  test("preserves an upstream authentication challenge without forwarding browser credentials", async () => {
    const { request, response } = await exerciseProxy({
      method: "GET",
      headers: {
        authorization: "Bearer browser-secret",
        cookie: "session=browser-secret"
      },
      reply: {
        status: 401,
        statusMessage: "Unauthorized",
        body: "authentication required",
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "www-authenticate": 'Bearer realm="lb", error="invalid_token"'
        }
      }
    })

    expect(request.headers.get("authorization")).toBeNull()
    expect(request.headers.get("cookie")).toBeNull()
    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate"))
      .toBe('Bearer realm="lb", error="invalid_token"')
    expect(await response.text()).toBe("authentication required")
  })

  test("returns cross-origin redirects without contacting or disclosing correlation to the target", async () => {
    let targetContacted = false
    let targetHeaders: Headers | null = null
    const target = createServer((request, response) => {
      targetContacted = true
      targetHeaders = new Headers(request.headers as Record<string, string>)
      response.end("must not be reached")
    })
    target.listen(0, "127.0.0.1")
    await once(target, "listening")
    const targetAddress = target.address()
    if (!targetAddress || typeof targetAddress === "string") {
      throw new Error("Expected redirect target TCP server")
    }
    const targetUrl = `http://127.0.0.1:${targetAddress.port}/private`

    const upstream = createServer((_request, response) => {
      response.writeHead(307, { location: targetUrl })
      response.end()
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
        "redirect"
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
      const response = await fetch(`http://127.0.0.1:${proxyAddress.port}/redirect`, {
        redirect: "manual"
      })

      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toBe(targetUrl)
      expect(targetContacted).toBe(false)
      expect(targetHeaders).toBeNull()
    } finally {
      proxy.closeAllConnections()
      upstream.closeAllConnections()
      target.closeAllConnections()
      proxy.close()
      upstream.close()
      target.close()
      await Promise.all([once(proxy, "close"), once(upstream, "close"), once(target, "close")])
    }
  })

  test("aborts the upstream response when the downstream client disconnects", async () => {
    let resolveClosed!: (closedBeforeCompletion: boolean) => void
    const closed = new Promise<boolean>(resolve => {
      resolveClosed = resolve
    })
    const upstream = createServer((_request, response) => {
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
    upstream.listen(0, "127.0.0.1")
    await once(upstream, "listening")
    const upstreamAddress = upstream.address()
    if (!upstreamAddress || typeof upstreamAddress === "string") {
      throw new Error("Expected upstream TCP server")
    }

    const app = createApp().use(event => proxyBackendRequest(
      event,
      `http://127.0.0.1:${upstreamAddress.port}`,
      "slow"
    ))
    const proxy = createServer(toNodeListener(app))
    proxy.listen(0, "127.0.0.1")
    await once(proxy, "listening")
    const proxyAddress = proxy.address()
    if (!proxyAddress || typeof proxyAddress === "string") {
      throw new Error("Expected proxy TCP server")
    }

    try {
      const controller = new AbortController()
      const response = await fetch(`http://127.0.0.1:${proxyAddress.port}/slow`, {
        signal: controller.signal
      })
      await response.body?.getReader().read()
      controller.abort()

      expect(await Promise.race([
        closed,
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 300))
      ])).toBe(true)
    } finally {
      proxy.closeAllConnections()
      upstream.closeAllConnections()
      proxy.close()
      upstream.close()
      await Promise.all([once(proxy, "close"), once(upstream, "close")])
    }
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
