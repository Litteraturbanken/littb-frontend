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
        "cache-control": "private, max-age=17",
        "content-type": "application/octet-stream",
        "x-reader-origin": label
      })
      response.end(Buffer.from([0, 255, label.charCodeAt(0), 10]))
    })
  })
  return { origin: await listen(server), requests }
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
        headers: { "content-type": "application/octet-stream", "x-reader-test": "first" },
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
    expect(firstResponse.headers.get("x-reader-origin")).toBe("A")
    expect(Buffer.from(await firstResponse.arrayBuffer())).toEqual(Buffer.from([0, 255, 65, 10]))
    expect(secondResponse.headers.get("x-reader-origin")).toBe("B")
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
      expect(request.headers.get("x-reader-test")).toBe(marker)
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
    expect(response.headers.get("x-reader-origin")).toBe("R")
    expect(reader.requests.map(request => request.url)).toEqual([path])
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
