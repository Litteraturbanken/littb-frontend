import { createServer, type Server } from "node:http"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { resolve } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import * as readerOriginPreflight from "../../scripts/verify-reader-origin.mjs"

const cssPath = "/txt/css/lb1728740-etext.css"
const preflightCli = resolve(import.meta.dirname, "../../scripts/verify-reader-origin.mjs")
const payloadSentinel = "reader-origin-payload-must-not-be-logged"
const checkReaderOrigin = (
  readerOriginPreflight as unknown as {
    checkReaderOrigin?: (origin: string) => Promise<{ bytes: number, contentType: string, status: number }>
  }
).checkReaderOrigin

type Scenario = (request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse) => void

async function startServer(scenario: Scenario): Promise<{ origin: string, server: Server }> {
  const server = createServer(scenario)
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("Expected a TCP listener")
  return { origin: `http://127.0.0.1:${address.port}`, server }
}

async function closeServer(server: Server): Promise<void> {
  server.close()
  await once(server, "close")
}

async function runCli(origin: string): Promise<{ status: number | null, stderr: string, stdout: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [preflightCli], {
      env: { ...process.env, NUXT_READER_SOURCE_BASE: origin },
      stdio: ["ignore", "pipe", "pipe"]
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", chunk => { stdout += chunk })
    child.stderr.on("data", chunk => { stderr += chunk })
    child.once("error", rejectRun)
    child.once("close", status => resolveRun({ status, stderr, stdout }))
  })
}

describe("Reader origin startup preflight", () => {
  const servers: Server[] = []

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer))
  })

  test("requests the representative CSS asset and reports its bounded metadata", async () => {
    const { origin, server } = await startServer((request, response) => {
      expect(request.url).toBe(cssPath)
      response.writeHead(200, { "content-type": "text/css; charset=utf-8" })
      response.end("body { color: black; }")
    })
    servers.push(server)

    expect(typeof checkReaderOrigin).toBe("function")
    await expect(checkReaderOrigin?.(origin)).resolves.toEqual({
      bytes: 22,
      contentType: "text/css; charset=utf-8",
      status: 200
    })
    const result = await runCli(origin)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("status=200")
    expect(result.stdout).toContain("content_type=text/css; charset=utf-8")
    expect(result.stdout).toContain("bytes=22")
  })

  test.each([
    ["empty 200", (_request: unknown, response: import("node:http").ServerResponse) => {
      response.writeHead(200, { "content-type": "text/css" })
      response.end()
    }],
    ["missing content type", (_request: unknown, response: import("node:http").ServerResponse) => {
      response.writeHead(200)
      response.end(payloadSentinel)
    }],
    ["wrong content type", (_request: unknown, response: import("node:http").ServerResponse) => {
      response.writeHead(200, { "content-type": "text/html" })
      response.end(payloadSentinel)
    }],
    ["redirect", (_request: unknown, response: import("node:http").ServerResponse) => {
      response.writeHead(302, { location: cssPath })
      response.end(payloadSentinel)
    }],
    ["cross-origin redirect", (_request: unknown, response: import("node:http").ServerResponse) => {
      response.writeHead(302, { location: "https://example.test/reader.css" })
      response.end(payloadSentinel)
    }],
    ["oversized body", (_request: unknown, response: import("node:http").ServerResponse) => {
      response.writeHead(200, { "content-type": "text/css" })
      response.end(`${"x".repeat(1024 * 1024)}${payloadSentinel}`)
    }],
    ["timeout", (_request: unknown, _response: import("node:http").ServerResponse) => {}],
    ["HTTP error", (_request: unknown, response: import("node:http").ServerResponse) => {
      response.writeHead(503, { "content-type": "text/css" })
      response.end(payloadSentinel)
    }]
  ] as const)("fails payload-silently for %s", async (_name, scenario) => {
    const { origin, server } = await startServer(scenario as Scenario)
    servers.push(server)

    expect(typeof checkReaderOrigin).toBe("function")
    await expect(checkReaderOrigin?.(origin)).rejects.toThrow()
    const result = await runCli(origin)
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).not.toContain(payloadSentinel)
  }, 25_000)

  test("fails payload-silently for a transport error", async () => {
    const { origin, server } = await startServer((_request, response) => response.end())
    await closeServer(server)

    expect(typeof checkReaderOrigin).toBe("function")
    await expect(checkReaderOrigin?.(origin)).rejects.toThrow()
    const result = await runCli(origin)
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).not.toContain(payloadSentinel)
  })
})
