import { createServer, type Server } from "node:http"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { resolve } from "node:path"

import { afterEach, describe, expect, test, vi } from "vitest"

import * as publicResourcePreflight from "../../scripts/verify-public-resource.mjs"

const publicCssPath = "/red/css/etext.css"
const preflightCli = resolve(import.meta.dirname, "../../scripts/verify-public-resource.mjs")
const payloadSentinel = "public-resource-payload-must-not-be-logged"
const checkPublicResource = (
  publicResourcePreflight as unknown as {
    checkPublicResource?: (origin: string) => Promise<{ bytes: number, contentType: string, status: number }>
  }
).checkPublicResource

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
      env: { ...process.env, PUBLIC_RESOURCE_ORIGIN: origin },
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

function expectExactCliFailure(result: Awaited<ReturnType<typeof runCli>>) {
  expect(result.status).not.toBe(0)
  expect(result.stdout).toBe("")
  expect(result.stderr).toBe("Public resource preflight failed\n")
}

describe("public resource startup preflight", () => {
  const servers: Server[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(servers.splice(0).map(closeServer))
  })

  test("requests the public RED stylesheet and reports only bounded summary metadata", async () => {
    const { origin, server } = await startServer((request, response) => {
      expect(request.method).toBe("GET")
      expect(request.url).toBe(publicCssPath)
      response.writeHead(200, {
        "content-type": `text/css; fixture=${payloadSentinel}`
      })
      response.end("body { color: black; }")
    })
    servers.push(server)

    expect(typeof checkPublicResource).toBe("function")
    await expect(checkPublicResource?.(origin)).resolves.toEqual({
      bytes: 22,
      contentType: "text/css",
      status: 200
    })
    const result = await runCli(origin)
    expect(result.status).toBe(0)
    expect(result.stdout).toBe(
      "Public resource preflight passed: status=200 content_type=text/css bytes=22\n"
    )
    expect(`${result.stdout}${result.stderr}`).not.toContain(payloadSentinel)
  })

  test("accepts a response at the exact 1 MiB limit", async () => {
    const { origin, server } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/css" })
      response.end("x".repeat(1024 * 1024))
    })
    servers.push(server)

    await expect(checkPublicResource?.(origin)).resolves.toEqual({
      bytes: 1024 * 1024,
      contentType: "text/css",
      status: 200
    })
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
    ["redirect", (request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse) => {
      if (request.url === publicCssPath) {
        response.writeHead(302, { location: "/redirect-target.css" })
        response.end(payloadSentinel)
        return
      }
      response.writeHead(200, { "content-type": "text/css" })
      response.end("body { color: black; }")
    }],
    ["cross-origin redirect", (_request: unknown, response: import("node:http").ServerResponse) => {
      response.writeHead(302, { location: "https://example.test/reader.css" })
      response.end(payloadSentinel)
    }],
    ["one byte over the 1 MiB limit", (_request: unknown, response: import("node:http").ServerResponse) => {
      response.writeHead(200, { "content-type": "text/css" })
      response.end("x".repeat((1024 * 1024) + 1))
    }],
    ["HTTP error", (_request: unknown, response: import("node:http").ServerResponse) => {
      response.writeHead(503, { "content-type": "text/css" })
      response.end(payloadSentinel)
    }]
  ] as const)("fails payload-silently for %s", async (_name, scenario) => {
    const { origin, server } = await startServer(scenario as Scenario)
    servers.push(server)

    expect(typeof checkPublicResource).toBe("function")
    await expect(checkPublicResource?.(origin)).rejects.toThrow()
    const result = await runCli(origin)
    expectExactCliFailure(result)
    expect(`${result.stdout}${result.stderr}`).not.toContain(payloadSentinel)
  }, 25_000)

  test("uses the exact 10-second timeout and fails payload-silently", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout")
    const { origin, server } = await startServer((_request, _response) => {})
    servers.push(server)

    await expect(checkPublicResource?.(origin)).rejects.toThrow()
    expect(timeoutSpy).toHaveBeenCalledWith(10_000)

    const result = await runCli(origin)
    expectExactCliFailure(result)
    expect(`${result.stdout}${result.stderr}`).not.toContain(payloadSentinel)
  }, 25_000)

  test("fails payload-silently for a transport error", async () => {
    const { origin, server } = await startServer((_request, response) => response.end())
    await closeServer(server)

    expect(typeof checkPublicResource).toBe("function")
    await expect(checkPublicResource?.(origin)).rejects.toThrow()
    const result = await runCli(origin)
    expectExactCliFailure(result)
    expect(`${result.stdout}${result.stderr}`).not.toContain(payloadSentinel)
  })
})
