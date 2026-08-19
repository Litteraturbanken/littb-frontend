import { spawn, type ChildProcess } from "node:child_process"
import { createServer, type Server } from "node:http"
import { once } from "node:events"

import { afterEach, describe, expect, test } from "vitest"

type RecordedRequest = {
  body: Buffer
  headers: Headers
  method: string
  url: string
}

const openChildren: ChildProcess[] = []
const openServers: Server[] = []
const gitSha = "a".repeat(40)
const imageDigest = `sha256:${"b".repeat(64)}`

async function listen(server: Server): Promise<string> {
  openServers.push(server)
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Expected TCP server")
  return `http://127.0.0.1:${address.port}`
}

async function reservePort(): Promise<number> {
  const server = createServer()
  const origin = await listen(server)
  const port = Number(new URL(origin).port)
  server.close()
  await once(server, "close")
  openServers.splice(openServers.indexOf(server), 1)
  return port
}

async function readerOrigin(label: string): Promise<{
  origin: string
  requests: RecordedRequest[]
}> {
  const requests: RecordedRequest[] = []
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on("data", chunk => chunks.push(Buffer.from(chunk)))
    request.on("end", () => {
      requests.push({
        body: Buffer.concat(chunks),
        headers: new Headers(request.headers as Record<string, string>),
        method: request.method ?? "",
        url: request.url ?? ""
      })
      response.writeHead(207, "Multi-Status", {
        "accept-ranges": "bytes",
        "access-control-allow-origin": "https://origin.invalid",
        "cache-control": "private, max-age=17",
        "clear-site-data": "\"cookies\"",
        connection: "expires, x-reader-hop",
        "content-disposition": "inline; filename=reader.bin",
        "content-language": "sv",
        "content-range": "bytes 0-3/4",
        "content-security-policy": "default-src https://origin.invalid",
        "content-type": "application/octet-stream",
        etag: '"reader-v1"',
        expires: "Wed, 21 Oct 2037 07:28:00 GMT",
        "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT",
        "permissions-policy": "camera=*",
        "proxy-authenticate": "Basic realm=origin",
        refresh: "0; url=https://origin.invalid/private",
        "set-cookie": [
          "reader_session=secret; Path=/; HttpOnly",
          "reader_preference=secret; Path=/"
        ],
        vary: "Accept, Range",
        "www-authenticate": "Bearer realm=origin",
        "x-reader-hop": "origin-hop-secret",
        "x-reader-private": "origin-private",
        "x-reader-origin": label
      })
      response.end(Buffer.from([0, 255, label.charCodeAt(0), 10]))
    })
  })
  return { origin: await listen(server), requests }
}

async function redirectingReaderOrigin(): Promise<{
  origin: string
  requests: string[]
}> {
  const requests: string[] = []
  let origin = ""
  const server = createServer((request, response) => {
    const url = request.url ?? ""
    requests.push(url)
    const locations: Record<string, string> = {
      "/txt/redirect-external": "https://private-origin.invalid/secret",
      "/txt/redirect-local": `${origin}/bilder/redirected%20cover.jpg?size=2`,
      "/txt/redirect-private": `${origin}/private-network-target`
    }
    response.writeHead(307, "Temporary Redirect", {
      location: locations[url],
      "set-cookie": "redirect_session=secret; Path=/; HttpOnly",
      "x-reader-private": "redirect-private"
    })
    response.end("redirect body")
  })
  origin = await listen(server)
  return { origin, requests }
}

async function waitForNuxt(child: ChildProcess, origin: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Nuxt exited with ${child.exitCode}`)
    try {
      const response = await fetch(`${origin}/_deployment`)
      if (response.status === 200) return
    } catch {
      // The listener is not ready yet.
    }
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error("Timed out waiting for built Nuxt server")
}

async function startBuiltNuxt(options: {
  deploymentEnvironment?: "production" | "staging"
  readerSourceBase?: string
}): Promise<string> {
  const port = await reservePort()
  const environment = { ...process.env }
  delete environment.READER_SOURCE_PROXY_TARGET
  if (options.readerSourceBase === undefined) {
    delete environment.NUXT_READER_SOURCE_BASE
  } else {
    environment.NUXT_READER_SOURCE_BASE = options.readerSourceBase
  }
  Object.assign(environment, {
    HOST: "127.0.0.1",
    IMAGE_DIGEST: imageDigest,
    NUXT_DEPLOYMENT_ENVIRONMENT: options.deploymentEnvironment ?? "staging",
    NUXT_DEPLOYMENT_GIT_SHA: gitSha,
    NUXT_DEPLOYMENT_IMAGE_DIGEST: imageDigest,
    PORT: String(port)
  })
  const child = spawn(process.execPath, [".output/server/index.mjs"], {
    cwd: process.cwd(),
    env: environment,
    stdio: ["ignore", "pipe", "pipe"]
  })
  openChildren.push(child)
  const origin = `http://127.0.0.1:${port}`
  await waitForNuxt(child, origin)
  return origin
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  await Promise.race([
    once(child, "exit"),
    new Promise(resolve => setTimeout(resolve, 2_000))
  ])
  if (child.exitCode === null) child.kill("SIGKILL")
}

afterEach(async () => {
  const children = openChildren.splice(0)
  await Promise.all(children.map(stopChild))
  const servers = openServers.splice(0)
  for (const server of servers) server.close()
  await Promise.all(servers.map(server => once(server, "close")))
})

describe("built Reader runtime proxy", () => {
  test("the same build selects either runtime origin and preserves proxy semantics", async () => {
    const firstReader = await readerOrigin("A")
    const secondReader = await readerOrigin("B")
    const firstNuxt = await startBuiltNuxt({ readerSourceBase: firstReader.origin })
    const secondNuxt = await startBuiltNuxt({ readerSourceBase: secondReader.origin })
    const path = "/txt/S%C3%B6derbergH/file%20one.bin?download=a%2Fb&empty="
    const body = Uint8Array.from([0, 255, 195, 40, 10])

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${firstNuxt}${path}`, {
        body,
        headers: {
          accept: "application/octet-stream",
          authorization: "Bearer browser-secret",
          "cache-control": "max-age=0",
          cookie: "reader_session=browser-secret",
          "content-type": "application/octet-stream",
          forwarded: "for=private.internal;proto=https",
          "if-match": '"reader-v1"',
          "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
          "if-none-match": '"reader-v1"',
          "if-range": '"reader-v1"',
          "if-unmodified-since": "Thu, 22 Oct 2015 07:28:00 GMT",
          origin: "https://private-client.invalid",
          pragma: "client-no-cache",
          "proxy-authorization": "Basic browser-secret",
          range: "bytes=0-3",
          referer: "https://private-client.invalid/account",
          "x-forwarded-for": "10.0.0.8",
          "x-forwarded-host": "private.internal",
          "x-forwarded-proto": "https",
          "x-reader-private": "browser-private",
          "x-reader-test": "first"
        },
        method: "POST"
      }),
      fetch(`${secondNuxt}${path}`, {
        body,
        headers: { "content-type": "application/octet-stream", "x-reader-test": "second" },
        method: "POST"
      })
    ])

    expect(firstResponse.status).toBe(207)
    expect(firstResponse.statusText).toBe("Multi-Status")
    expect(firstResponse.headers.get("cache-control")).toBe("private, max-age=17")
    expect(firstResponse.headers.get("content-type")).toBe("application/octet-stream")
    expect(Object.fromEntries([
      "accept-ranges",
      "content-disposition",
      "content-language",
      "content-range",
      "etag",
      "last-modified",
      "vary"
    ].map(name => [name, firstResponse.headers.get(name)]))).toEqual({
      "accept-ranges": "bytes",
      "content-disposition": "inline; filename=reader.bin",
      "content-language": "sv",
      "content-range": "bytes 0-3/4",
      etag: '"reader-v1"',
      "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT",
      vary: "Accept, Range"
    })
    for (const name of [
      "access-control-allow-origin",
      "clear-site-data",
      "content-security-policy",
      "expires",
      "permissions-policy",
      "proxy-authenticate",
      "refresh",
      "set-cookie",
      "www-authenticate",
      "x-reader-hop",
      "x-reader-origin",
      "x-reader-private"
    ]) {
      expect(firstResponse.headers.get(name), name).toBeNull()
    }
    expect(Buffer.from(await firstResponse.arrayBuffer())).toEqual(Buffer.from([0, 255, 65, 10]))
    expect(Buffer.from(await secondResponse.arrayBuffer())).toEqual(Buffer.from([0, 255, 66, 10]))
    expect(firstReader.requests).toHaveLength(1)
    expect(secondReader.requests).toHaveLength(1)
    for (const [request, marker] of [
      [firstReader.requests[0], "first"],
      [secondReader.requests[0], "second"]
    ] as const) {
      expect(request.method).toBe("POST")
      expect(request.url).toBe(path)
      expect(request.body).toEqual(Buffer.from(body))
      expect(request.headers.get("content-type")).toBe("application/octet-stream")
      if (marker === "first") {
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
        ].map(name => [name, request.headers.get(name)]))).toEqual({
          accept: "application/octet-stream",
          "cache-control": "max-age=0",
          "if-match": '"reader-v1"',
          "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
          "if-none-match": '"reader-v1"',
          "if-range": '"reader-v1"',
          "if-unmodified-since": "Thu, 22 Oct 2015 07:28:00 GMT",
          pragma: "client-no-cache",
          range: "bytes=0-3"
        })
        for (const name of [
          "authorization",
          "cookie",
          "forwarded",
          "origin",
          "proxy-authorization",
          "referer",
          "x-forwarded-for",
          "x-forwarded-host",
          "x-forwarded-proto",
          "x-reader-private",
          "x-reader-test"
        ]) {
          expect(request.headers.get(name), name).toBeNull()
        }
      }
    }
  })

  test.each([
    "/txt/work/file.txt?raw=one%2Ftwo",
    "/bilder/ornament/image.png?size=2",
    "/export/faksimil/work.pdf?download=1"
  ])("proxies the exact Reader namespace path %s", async (path) => {
    const reader = await readerOrigin("R")
    const nuxt = await startBuiltNuxt({ readerSourceBase: reader.origin })

    const response = await fetch(`${nuxt}${path}`)

    expect(response.status).toBe(207)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from([0, 255, 82, 10]))
    expect(response.headers.get("x-reader-origin")).toBeNull()
    expect(reader.requests.map(request => request.url)).toEqual([path])
  })

  test("rewrites only same-source redirects that stay inside Reader proxy namespaces", async () => {
    const reader = await redirectingReaderOrigin()
    const nuxt = await startBuiltNuxt({ readerSourceBase: reader.origin })

    const local = await fetch(`${nuxt}/txt/redirect-local`, { redirect: "manual" })
    const external = await fetch(`${nuxt}/txt/redirect-external`, { redirect: "manual" })
    const privatePath = await fetch(`${nuxt}/txt/redirect-private`, { redirect: "manual" })

    expect(local.status).toBe(307)
    expect(local.statusText).toBe("Temporary Redirect")
    expect(local.headers.get("location")).toBe("/bilder/redirected%20cover.jpg?size=2")
    expect(await local.text()).toBe("redirect body")
    expect(external.status).toBe(307)
    expect(external.headers.get("location")).toBeNull()
    expect(privatePath.status).toBe(307)
    expect(privatePath.headers.get("location")).toBeNull()
    for (const response of [local, external, privatePath]) {
      expect(response.headers.get("set-cookie")).toBeNull()
      expect(response.headers.get("x-reader-private")).toBeNull()
    }
    expect(reader.requests).toEqual([
      "/txt/redirect-local",
      "/txt/redirect-external",
      "/txt/redirect-private"
    ])
  })

  test.each([
    undefined,
    "ftp://reader.invalid",
    "https://user:secret@reader.invalid",
    "https://reader.invalid/?query=1",
    "https://reader.invalid/#fragment"
  ])("fails closed for invalid runtime base %s", async (readerSourceBase) => {
    const nuxt = await startBuiltNuxt({ readerSourceBase })

    const response = await fetch(`${nuxt}/txt/work/file.txt`)

    expect(response.status).toBe(500)
  })

  test("rejects the public frontend authority in production", async () => {
    const nuxt = await startBuiltNuxt({
      deploymentEnvironment: "production",
      readerSourceBase: "https://litteraturbanken.se"
    })

    const response = await fetch(`${nuxt}/txt/work/file.txt`)

    expect(response.status).toBe(500)
  })

  test.each([
    "/txt/safe/%252e%252e/private.txt",
    "/bilder/safe%252fprivate.png",
    "/export/faksimil/%255c%255cevil.test/private.pdf"
  ])("rejects traversal and authority-escape path %s", async (path) => {
    const reader = await readerOrigin("R")
    const nuxt = await startBuiltNuxt({ readerSourceBase: reader.origin })

    const response = await fetch(`${nuxt}${path}`)

    expect(response.status).toBe(400)
    expect(reader.requests).toEqual([])
  })
})
