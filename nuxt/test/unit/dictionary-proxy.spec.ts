import { once } from "node:events"
import { createServer, type Server } from "node:http"

import { createApp, toNodeListener } from "h3"
import { afterEach, describe, expect, test, vi } from "vitest"

import { initializeRequestObservability } from "../../server/utils/observability"

interface RunningProxy {
  baseUrl: string
  close: () => Promise<void>
}

async function listen(server: Server): Promise<string> {
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server")
  }
  return `http://127.0.0.1:${address.port}`
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections()
  server.close()
  await once(server, "close")
}

async function startDictionaryProxy(apiBase: string): Promise<RunningProxy> {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler)
  vi.stubGlobal("useRuntimeConfig", () => ({ apiBase }))
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
  return {
    baseUrl: await listen(proxy),
    close: () => closeServer(proxy)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("dictionary backend proxy", () => {
  test("preserves query and body through an explicit request and response allowlist", async () => {
    let upstreamRequest: { headers: Headers, url: string } | undefined
    const upstream = createServer((request, response) => {
      upstreamRequest = {
        headers: new Headers(request.headers as Record<string, string>),
        url: request.url ?? ""
      }
      response.writeHead(200, {
        "cache-control": "public, max-age=60",
        connection: "x-upstream-hop",
        "content-type": "application/json",
        "set-cookie": "backend=secret; HttpOnly",
        traceparent: "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
        "x-dictionary-response": "private",
        "x-request-id": "11111111-1111-4111-8111-111111111111",
        "x-upstream-hop": "private"
      })
      response.end(JSON.stringify([{ word: "kyrka" }]))
    })
    const upstreamBase = await listen(upstream)
    const proxy = await startDictionaryProxy(`${upstreamBase}/v2`)

    try {
      const response = await fetch(
        `${proxy.baseUrl}/api/v2/dictionary/articles?word=kyrka&limit=7`,
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
      expect(response.headers.get("cache-control")).toBe("public, max-age=60")
      expect(response.headers.get("content-type")).toBe("application/json")
      expect(response.headers.get("set-cookie")).toBeNull()
      expect(response.headers.get("x-dictionary-response")).toBeNull()
      expect(response.headers.get("x-upstream-hop")).toBeNull()
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
      expect(response.headers.get("x-request-id"))
        .toBe(upstreamRequest?.headers.get("x-request-id"))
      expect(response.headers.get("traceparent"))
        .toBe(upstreamRequest?.headers.get("traceparent"))
    } finally {
      await Promise.all([proxy.close(), closeServer(upstream)])
    }
  })

  test("returns a cross-origin redirect without contacting its target", async () => {
    let targetContacted = false
    let targetHeaders: Headers | undefined
    const target = createServer((request, response) => {
      targetContacted = true
      targetHeaders = new Headers(request.headers as Record<string, string>)
      response.end("must not be reached")
    })
    const targetBase = await listen(target)
    const upstream = createServer((_request, response) => {
      response.writeHead(307, { location: `${targetBase}/private` })
      response.end()
    })
    const upstreamBase = await listen(upstream)
    const proxy = await startDictionaryProxy(`${upstreamBase}/v2`)

    try {
      const response = await fetch(
        `${proxy.baseUrl}/api/v2/dictionary/articles?word=kyrka`,
        { redirect: "manual" }
      )

      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toBe(`${targetBase}/private`)
      expect(targetContacted).toBe(false)
      expect(targetHeaders).toBeUndefined()
    } finally {
      await Promise.all([
        proxy.close(),
        closeServer(upstream),
        closeServer(target)
      ])
    }
  })

  test("aborts the upstream response when the dictionary client disconnects", async () => {
    let resolveClosed!: (closedBeforeCompletion: boolean) => void
    const closed = new Promise<boolean>(resolve => {
      resolveClosed = resolve
    })
    const upstream = createServer((_request, response) => {
      let completed = false
      response.writeHead(200, { "content-type": "application/json" })
      response.write("[")
      const interval = setInterval(() => response.write("{}"), 25)
      const completion = setTimeout(() => {
        completed = true
        clearInterval(interval)
        response.end("]")
      }, 5_000)
      response.on("close", () => {
        clearInterval(interval)
        clearTimeout(completion)
        resolveClosed(!completed)
      })
    })
    const upstreamBase = await listen(upstream)
    const proxy = await startDictionaryProxy(`${upstreamBase}/v2`)

    try {
      const controller = new AbortController()
      const response = await fetch(
        `${proxy.baseUrl}/api/v2/dictionary/articles?word=kyrka`,
        { signal: controller.signal }
      )
      await response.body?.getReader().read()
      controller.abort()

      expect(await Promise.race([
        closed,
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 300))
      ])).toBe(true)
    } finally {
      await Promise.all([proxy.close(), closeServer(upstream)])
    }
  })
})
