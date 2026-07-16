import type { ChildProcess } from "node:child_process"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest"

const nuxtRoot = fileURLToPath(new URL("../..", import.meta.url))
const port = 42_000 + process.pid % 10_000
const origin = `http://127.0.0.1:${port}`
let fixture: ChildProcess

async function waitUntilReady() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/health`)
      if (response.ok) return
    } catch {
      // The fixture process has not bound its port yet.
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error("v2 fixture server did not become ready")
}

describe("v2 fixture server Contact operation", () => {
  beforeAll(async () => {
    fixture = spawn(process.execPath, ["test/fixtures/v2-server.mjs"], {
      cwd: nuxtRoot,
      env: { ...process.env, LBAPI_FIXTURE_PORT: String(port) },
      stdio: "ignore"
    })
    await waitUntilReady()
  })

  afterAll(async () => {
    if (!fixture.killed && fixture.exitCode === null) {
      fixture.kill("SIGTERM")
      await once(fixture, "exit")
    }
  })

  beforeEach(async () => {
    await Promise.all([
      fetch(`${origin}/_requests`, { method: "DELETE" }),
      fetch(`${origin}/_contact_submissions`, { method: "DELETE" }),
      fetch(`${origin}/_failure`, { method: "DELETE" })
    ])
  })

  test("accepts and separately records the exact submitted body", async () => {
    const body = {
      sender_name: "Anna Andersson",
      sender_address: "anna@example.test",
      message: "Hej!",
      audience: "litteraturbanken"
    }
    const response = await fetch(`${origin}/v2/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ status: "accepted" })
    expect(response.headers.get("access-control-allow-methods")).toContain("POST")
    expect(await (await fetch(`${origin}/_contact_submissions`)).json()).toEqual({
      contactSubmissions: [body]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/contact"]
    })
  })

  test("returns a typed 502 failure and reset removes recorded attempts", async () => {
    await fetch(`${origin}/_failure`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource: "contact" })
    })

    const response = await fetch(`${origin}/v2/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sender_name: null,
        sender_address: "a@b",
        message: "Hej!",
        audience: "oversattarlexikon"
      })
    })

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: {
        code: "contact_delivery_failed",
        message: "Unable to send contact message",
        details: null
      }
    })

    await fetch(`${origin}/_contact_submissions`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_contact_submissions`)).json()).toEqual({
      contactSubmissions: []
    })
  })
})
