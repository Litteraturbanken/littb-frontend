import type { ChildProcess } from "node:child_process"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { once } from "node:events"
import { request as httpRequest } from "node:http"
import { fileURLToPath } from "node:url"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test
} from "vitest"

import {
  authorProfiles,
  dramaOnlyAuthorProfile,
  lagerlofAuthorProfile,
  noIntroAuthorProfile,
  rfc3986AuthorProfile,
  strindbergAuthorProfile
} from "../fixtures/author-profile-data.mjs"

const nuxtRoot = fileURLToPath(new URL("../..", import.meta.url))
const port = 42_000 + process.pid % 10_000
const origin = `http://127.0.0.1:${port}`
let fixture: ChildProcess

async function waitUntilReady() {
  await waitUntilReadyAt(origin)
}

async function waitUntilReadyAt(targetOrigin: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${targetOrigin}/health`)
      if (response.ok) return
    } catch {
      // The fixture process has not bound its port yet.
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error("v2 fixture server did not become ready")
}

async function contactSubmissions() {
  return await contactSubmissionsAt(origin)
}

async function contactSubmissionsAt(targetOrigin: string) {
  return await (await fetch(`${targetOrigin}/_contact_submissions`)).json() as {
    contactSubmissions: unknown[]
  }
}

async function waitForContactSubmission() {
  return await waitForContactSubmissionAt(origin)
}

async function waitForContactSubmissionAt(targetOrigin: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ledger = await contactSubmissionsAt(targetOrigin)
    if (ledger.contactSubmissions.length > 0) return ledger
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error("Contact submission was not recorded")
}

async function quickSearchRequests() {
  return await (await fetch(`${origin}/_quick_search_requests`)).json() as {
    queries: string[]
  }
}

async function workLookupRequests() {
  return await (await fetch(`${origin}/_work_lookup_requests`)).json() as {
    requests: Array<{ path: string, body: unknown }>
  }
}

async function postWorkLookup(path: string, body: unknown) {
  return await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}

async function authorResolveRequests() {
  return await (await fetch(`${origin}/_author_resolve_requests`)).json() as {
    requests: Array<{ path: string, body: unknown }>
  }
}

async function authorProfileRequests() {
  return await (await fetch(`${origin}/_author_profile_requests`)).json() as {
    requests: string[]
  }
}

async function rawGet(path: string) {
  return await new Promise<{ status: number, body: unknown }>((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port,
      method: "GET",
      path
    }, response => {
      const chunks: Buffer[] = []
      response.on("data", chunk => chunks.push(Buffer.from(chunk)))
      response.on("end", () => {
        try {
          resolve({
            status: response.statusCode || 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
          })
        } catch (error) {
          reject(error)
        }
      })
    })
    request.on("error", reject)
    request.end()
  })
}

async function postAuthorResolve(path: string, body: unknown) {
  return await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}

async function homeRequests() {
  return await (await fetch(`${origin}/_home_requests`)).json() as {
    requests: string[]
  }
}

async function presentationRequests() {
  return await (await fetch(`${origin}/_presentation_requests`)).json() as {
    requests: string[]
  }
}

async function litteraturkartanRequests() {
  return await (await fetch(`${origin}/_litteraturkartan_requests`)).json() as {
    requests: string[]
  }
}

async function libraryRelevanceRequests() {
  return await (await fetch(`${origin}/_library_relevance_requests`)).json() as {
    requests: Array<{ path: string, query: Record<string, string> }>
  }
}

describe("v2 fixture server operations", () => {
  beforeAll(async () => {
    fixture = spawn(process.execPath, ["test/fixtures/v2-server.mjs"], {
      cwd: nuxtRoot,
      env: { ...process.env, LBAPI_FIXTURE_PORT: String(port) },
      stdio: "ignore"
    })
    await waitUntilReady()
  })

  afterAll(async () => {
    await fetch(`${origin}/_contact_defer`, { method: "DELETE" }).catch(() => {})
    if (!fixture.killed && fixture.exitCode === null) {
      const exited = once(fixture, "exit")
      fixture.kill("SIGTERM")
      const forceKill = setTimeout(() => fixture.kill("SIGKILL"), 1_000)
      await exited
      clearTimeout(forceKill)
    }
  })

  beforeEach(async () => {
    await Promise.all([
      fetch(`${origin}/_requests`, { method: "DELETE" }),
      fetch(`${origin}/_contact_submissions`, { method: "DELETE" }),
      fetch(`${origin}/_failure`, { method: "DELETE" }),
      fetch(`${origin}/_contact_defer`, { method: "DELETE" }),
      fetch(`${origin}/_quick_search_requests`, { method: "DELETE" }),
      fetch(`${origin}/_quick_search_failure`, { method: "DELETE" }),
      fetch(`${origin}/_quick_search_delays`, { method: "DELETE" }),
      fetch(`${origin}/_work_lookup_requests`, { method: "DELETE" }),
      fetch(`${origin}/_work_lookup_failure`, { method: "DELETE" }),
      fetch(`${origin}/_work_lookup_delays`, { method: "DELETE" }),
      fetch(`${origin}/_author_resolve_requests`, { method: "DELETE" }),
      fetch(`${origin}/_author_resolve_failure`, { method: "DELETE" }),
      fetch(`${origin}/_author_resolve_delays`, { method: "DELETE" }),
      fetch(`${origin}/_author_profile_requests`, { method: "DELETE" }),
      fetch(`${origin}/_author_profile_failure`, { method: "DELETE" }),
      fetch(`${origin}/_home_requests`, { method: "DELETE" }),
      fetch(`${origin}/_home_failure`, { method: "DELETE" }),
      fetch(`${origin}/_presentation_requests`, { method: "DELETE" }),
      fetch(`${origin}/_presentation_failures`, { method: "DELETE" }),
      fetch(`${origin}/_litteraturkartan_requests`, { method: "DELETE" }),
      fetch(`${origin}/_library_relevance_requests`, { method: "DELETE" }),
      fetch(`${origin}/_library_relevance_failure`, { method: "DELETE" }),
      fetch(`${origin}/_library_relevance_delays`, { method: "DELETE" })
    ])
  })

  afterEach(async () => {
    await fetch(`${origin}/_contact_defer`, { method: "DELETE" })
  })

  test("serves complete deterministic author profiles on public and private paths", async () => {
    expect([...authorProfiles.values()]).toEqual([
      strindbergAuthorProfile,
      lagerlofAuthorProfile,
      dramaOnlyAuthorProfile,
      noIntroAuthorProfile,
      rfc3986AuthorProfile
    ])

    const expectedRequests: string[] = []
    for (const profile of authorProfiles.values()) {
      const encodedId = encodeURIComponent(profile.author_id).replace(
        /[!'()*]/g,
        character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
      )
      for (const prefix of ["/v2", "/private-v2"]) {
        const path = `${prefix}/authors/${encodedId}`
        const response = await fetch(`${origin}${path}`)

        expect(response.status, path).toBe(200)
        expect(await response.json(), path).toEqual(profile)
        expectedRequests.push(path)
      }
    }

    expect(await authorProfileRequests()).toEqual({ requests: expectedRequests })
  })

  test("author profiles return standard 404s and record the original encoded path", async () => {
    const paths = [
      "/v2/authors/Missing%20Author",
      "/private-v2/authors/Ok%C3%A4nd"
    ]

    for (const path of paths) {
      const response = await fetch(`${origin}${path}`)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: {
          code: "not_found",
          message: "Resource not found",
          details: null
        }
      })
    }

    expect(await authorProfileRequests()).toEqual({ requests: paths })
  })

  test("author profiles reject malformed encoded IDs with typed validation errors", async () => {
    const paths = [
      "/v2/authors/%25",
      "/private-v2/authors/%20StrindbergA",
      "/v2/authors/StrindbergA%2Fextra",
      "/private-v2/authors/bad%5Csegment",
      "/v2/authors/bad%C2%85segment",
      "/v2/authors/bad%ZZsegment"
    ]

    for (const path of paths) {
      const response = await fetch(`${origin}${path}`)
      expect(response.status, path).toBe(422)
      expect(await response.json(), path).toEqual({
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: null
        }
      })
    }

    expect(await authorProfileRequests()).toEqual({ requests: paths })
  })

  test("author profiles reject and record literal and encoded dot segments", async () => {
    const paths = [
      "/v2/authors/.",
      "/private-v2/authors/..",
      "/v2/authors/%2E",
      "/private-v2/authors/%2e%2e"
    ]

    for (const path of paths) {
      expect(await rawGet(path)).toEqual({
        status: 422,
        body: {
          error: {
            code: "validation_error",
            message: "Request validation failed",
            details: null
          }
        }
      })
    }

    expect(await authorProfileRequests()).toEqual({ requests: paths })
  })

  test("author profile failures are typed, resettable, and isolated", async () => {
    await fetch(`${origin}/v2/stats`)
    await fetch(`${origin}/v2/quick-search?query=strindberg`)

    expect(await (await fetch(`${origin}/_author_profile_failure`)).json()).toEqual({
      failure: false
    })
    await fetch(`${origin}/_author_profile_failure`, { method: "PUT" })
    expect(await (await fetch(`${origin}/_author_profile_failure`)).json()).toEqual({
      failure: true
    })

    const response = await fetch(`${origin}/private-v2/authors/StrindbergA`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: {
        code: "author_profile_unavailable",
        message: "Unable to load author profile",
        details: null
      }
    })
    expect(await authorProfileRequests()).toEqual({
      requests: ["/private-v2/authors/StrindbergA"]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })

    await fetch(`${origin}/_author_profile_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_author_profile_failure`)).json()).toEqual({
      failure: false
    })
    expect((await fetch(`${origin}/v2/authors/StrindbergA`)).status).toBe(200)
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })
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

  test("records a deferred submission before releasing its response", async () => {
    const body = {
      sender_name: null,
      sender_address: "a@b",
      message: "Vänta",
      audience: "litteraturbanken"
    }
    await fetch(`${origin}/_contact_defer`, { method: "PUT" })

    let settled = false
    const pendingResponse = fetch(`${origin}/v2/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }).then(response => {
      settled = true
      return response
    })

    expect(await waitForContactSubmission()).toEqual({
      contactSubmissions: [body]
    })
    expect(settled).toBe(false)
    expect(await (await fetch(`${origin}/_contact_defer`)).json()).toEqual({
      deferred: true,
      pending: 1
    })

    await fetch(`${origin}/_contact_defer`, { method: "DELETE" })
    const response = await pendingResponse
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ status: "accepted" })
  })

  test("SIGTERM exits with an outstanding deferred Contact request", async () => {
    const shutdownPort = port + 1
    const shutdownOrigin = `http://127.0.0.1:${shutdownPort}`
    const shutdownFixture = spawn(process.execPath, ["test/fixtures/v2-server.mjs"], {
      cwd: nuxtRoot,
      env: { ...process.env, LBAPI_FIXTURE_PORT: String(shutdownPort) },
      stdio: "ignore"
    })
    const exited = once(shutdownFixture, "exit")
    let forced = false

    try {
      await waitUntilReadyAt(shutdownOrigin)
      await fetch(`${shutdownOrigin}/_contact_defer`, { method: "PUT" })
      void fetch(`${shutdownOrigin}/v2/contact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sender_name: null,
          sender_address: "a@b",
          message: "Vänta",
          audience: "litteraturbanken"
        })
      }).catch(() => {})
      await waitForContactSubmissionAt(shutdownOrigin)

      shutdownFixture.kill("SIGTERM")
      let timeout: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        exited,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("fixture did not exit after SIGTERM")),
            500
          )
        })
      ]).finally(() => clearTimeout(timeout))
    } finally {
      if (shutdownFixture.exitCode === null) {
        forced = true
        shutdownFixture.kill("SIGKILL")
        await exited
      }
    }

    expect(forced).toBe(false)
  })

  test("returns deterministic typed Quick Search rows, correction, and no-hit envelopes", async () => {
    const populated = await (await fetch(
      `${origin}/v2/quick-search?query=strindberg`
    )).json()
    const correction = await (await fetch(
      `${origin}/v2/quick-search?query=strindbrg`
    )).json()
    const noHit = await (await fetch(
      `${origin}/v2/quick-search?query=inga`
    )).json()

    expect(populated).toEqual({
      items: [
        {
          kind: "author",
          label: "Strindberg, August (1849-1912)",
          url: "/författare/StrindbergA",
          type_label: "Författare",
          media_type_label: null
        },
        {
          kind: "work",
          label: "Strindberg – Röda rummet",
          url: "/författare/StrindbergA/titlar/RodaRummet/sida/1/etext",
          type_label: "Verk",
          media_type_label: "etext"
        },
        {
          kind: "part",
          label: "Lagerlöf – Landskapet",
          url: "/författare/LagerlofS/titlar/GostaBerlingsSaga/sida/3/faksimil",
          type_label: "Del",
          media_type_label: "faksimil"
        }
      ],
      correction: null
    })
    expect(correction).toEqual({ items: [], correction: "strindberg" })
    expect(noHit).toEqual({ items: [], correction: null })
  })

  test("records and resets Quick Search queries without changing the general request ledger", async () => {
    await fetch(`${origin}/v2/stats`)
    await fetch(`${origin}/v2/quick-search?query=strindberg%20r%C3%B6da`)

    expect(await quickSearchRequests()).toEqual({
      queries: ["strindberg röda"]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })

    await fetch(`${origin}/_quick_search_requests`, { method: "DELETE" })
    expect(await quickSearchRequests()).toEqual({ queries: [] })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
  })

  test("returns a typed Quick Search 503 until its independent failure control is reset", async () => {
    await fetch(`${origin}/_quick_search_failure`, { method: "PUT" })

    const failed = await fetch(`${origin}/v2/quick-search?query=strindberg`)
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({
      error: {
        code: "quick_search_unavailable",
        message: "Unable to load quick-search results",
        details: null
      }
    })

    await fetch(`${origin}/_quick_search_failure`, { method: "DELETE" })
    const restored = await fetch(`${origin}/v2/quick-search?query=strindberg`)
    expect(restored.status).toBe(200)
    expect((await restored.json()).items).toHaveLength(3)
  })

  test("applies per-query delays so a later Quick Search response can finish first", async () => {
    await fetch(`${origin}/_quick_search_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ strindberg: 80, inga: 0 })
    })

    const completionOrder: string[] = []
    const slow = fetch(`${origin}/v2/quick-search?query=strindberg`).then(() => {
      completionOrder.push("strindberg")
    })
    const fast = fetch(`${origin}/v2/quick-search?query=inga`).then(() => {
      completionOrder.push("inga")
    })
    await Promise.all([slow, fast])

    expect(completionOrder).toEqual(["inga", "strindberg"])
    expect(await quickSearchRequests()).toEqual({
      queries: ["strindberg", "inga"]
    })
    expect(await (await fetch(`${origin}/_quick_search_delays`)).json()).toEqual({
      delays: { strindberg: 80, inga: 0 }
    })

    await fetch(`${origin}/_quick_search_delays`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_quick_search_delays`)).json()).toEqual({
      delays: {}
    })
  })

  test("work lookup serves deterministic rows for exact ID and title bodies with CORS", async () => {
    const byId = await postWorkLookup("/v2/works/lookup", {
      work_id: "lb238704",
      titles: []
    })
    const byTitles = await postWorkLookup("/v2/works/lookup", {
      work_id: null,
      titles: ["Röda rummet", "Gösta Berlings saga"]
    })

    expect(byId.status).toBe(200)
    expect(byId.headers.get("access-control-allow-origin")).toBe("*")
    expect(byId.headers.get("access-control-allow-methods")).toContain("POST")
    expect(await byId.json()).toEqual({
      items: [
        {
          work_id: "lb238704",
          author: {
            label: "Strindberg",
            url: "/författare/StrindbergA"
          },
          title: {
            label: "Röda rummet",
            url: "/författare/StrindbergA/titlar/RodaRummet/etext"
          },
          media: [
            {
              label: "etext",
              url: "/författare/StrindbergA/titlar/RodaRummet/etext"
            },
            {
              label: "faksimil",
              url: "/författare/StrindbergA/titlar/RodaRummet/faksimil"
            }
          ]
        }
      ]
    })
    expect(byTitles.status).toBe(200)
    expect((await byTitles.json()).items.map((item: { work_id: string }) => (
      item.work_id
    ))).toEqual(["lb238704", "lb278171"])
  })

  test("work lookup matches the lowercase compact Unicode route title", async () => {
    const response = await postWorkLookup("/v2/works/lookup", {
      work_id: null,
      titles: ["rödarummet"]
    })

    expect(response.status).toBe(200)
    expect((await response.json()).items.map((item: { work_id: string }) => (
      item.work_id
    ))).toEqual(["lb238704"])
  })

  test("work lookup matches the visual authority title aliases", async () => {
    const response = await postWorkLookup("/v2/works/lookup", {
      work_id: null,
      titles: ["Titel", "Titel två"]
    })

    expect(response.status).toBe(200)
    expect((await response.json()).items.map((item: { work_id: string }) => (
      item.work_id
    ))).toEqual(["lb238704", "lb278171"])
  })

  test("work lookup records path and body then resets without touching other ledgers", async () => {
    const body = { work_id: null, titles: ["Röda rummet"] }
    await fetch(`${origin}/v2/stats`)
    await fetch(`${origin}/v2/quick-search?query=strindberg`)
    await postWorkLookup("/v2/works/lookup", body)

    expect(await workLookupRequests()).toEqual({
      requests: [{ path: "/v2/works/lookup", body }]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })

    await fetch(`${origin}/_work_lookup_requests`, { method: "DELETE" })
    expect(await workLookupRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })
  })

  test("work lookup has an independent exact 503 control", async () => {
    await fetch(`${origin}/_work_lookup_failure`, { method: "PUT" })

    const failed = await postWorkLookup("/v2/works/lookup", {
      work_id: "lb238704",
      titles: []
    })

    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({
      error: {
        code: "work_lookup_unavailable",
        message: "Unable to load ID lookup results",
        details: null
      }
    })
    expect((await fetch(`${origin}/v2/stats`)).status).toBe(200)
    expect((await fetch(
      `${origin}/v2/quick-search?query=strindberg`
    )).status).toBe(200)

    await fetch(`${origin}/_work_lookup_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_work_lookup_failure`)).json()).toEqual({
      failure: false
    })
    expect((await postWorkLookup("/v2/works/lookup", {
      work_id: "lb238704",
      titles: []
    })).status).toBe(200)

    await fetch(`${origin}/_failure`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource: "works" })
    })
    expect((await fetch(`${origin}/v2/works/popular`)).status).toBe(503)
    expect((await postWorkLookup("/v2/works/lookup", {
      work_id: "lb238704",
      titles: []
    })).status).toBe(200)
  })

  test("work lookup uses serialized bodies for deterministic latest-response ordering", async () => {
    const slowBody = { work_id: null, titles: ["Röda rummet"] }
    const fastBody = { work_id: "lb278171", titles: [] }
    const delays = {
      [JSON.stringify(slowBody)]: 80,
      [JSON.stringify(fastBody)]: 0
    }
    await fetch(`${origin}/_work_lookup_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(delays)
    })

    const completionOrder: string[] = []
    const slow = postWorkLookup("/v2/works/lookup", slowBody).then(() => {
      completionOrder.push("slow")
    })
    const fast = postWorkLookup("/v2/works/lookup", fastBody).then(() => {
      completionOrder.push("fast")
    })
    await Promise.all([slow, fast])

    expect(completionOrder).toEqual(["fast", "slow"])
    expect(await workLookupRequests()).toEqual({
      requests: [
        { path: "/v2/works/lookup", body: slowBody },
        { path: "/v2/works/lookup", body: fastBody }
      ]
    })
    expect(await (await fetch(`${origin}/_work_lookup_delays`)).json()).toEqual({
      delays
    })

    await fetch(`${origin}/_work_lookup_delays`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_work_lookup_delays`)).json()).toEqual({
      delays: {}
    })
  })

  test("work lookup exposes a separately addressable duplicate representation", async () => {
    const response = await postWorkLookup("/v2/works/lookup", {
      work_id: "lb-duplicate",
      titles: []
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.items[0].media).toEqual([
      {
        label: "etext",
        url: "/författare/TestAuthor/titlar/Duplicate/etext"
      },
      {
        label: "etext",
        url: "/författare/TestAuthor/titlar/Duplicate/etext"
      }
    ])
  })

  test("author resolve accepts public and private requests with normalized request ordering", async () => {
    const body = {
      author_ids: [" StrindbergA ", "UnknownAuthor", "LongNameAuthor", "LagerlofS"]
    }
    const expected = {
      items: [
        {
          author_id: "StrindbergA",
          full_name: "August Strindberg",
          surname: "Strindberg"
        },
        {
          author_id: "LongNameAuthor",
          full_name: "Anna Maria Lovisa Charlotta von Långnamn",
          surname: null
        },
        {
          author_id: "LagerlofS",
          full_name: "Selma Lagerlöf",
          surname: "Lagerlöf"
        }
      ]
    }

    const publicResponse = await postAuthorResolve("/v2/authors/resolve", body)
    const privateResponse = await postAuthorResolve("/private-v2/authors/resolve", body)

    expect(publicResponse.status).toBe(200)
    expect(await publicResponse.json()).toEqual(expected)
    expect(privateResponse.status).toBe(200)
    expect(await privateResponse.json()).toEqual(expected)
    expect(await authorResolveRequests()).toEqual({
      requests: [
        { path: "/v2/authors/resolve", body },
        { path: "/private-v2/authors/resolve", body }
      ]
    })
  })

  test("author resolve failure and ledger resets remain isolated from other fixture state", async () => {
    const lookupBody = { work_id: "lb238704", titles: [] }
    await fetch(`${origin}/v2/stats`)
    await postWorkLookup("/v2/works/lookup", lookupBody)
    await postAuthorResolve("/v2/authors/resolve", { author_ids: ["StrindbergA"] })

    await fetch(`${origin}/_author_resolve_requests`, { method: "DELETE" })
    expect(await authorResolveRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await workLookupRequests()).toEqual({
      requests: [{ path: "/v2/works/lookup", body: lookupBody }]
    })

    await fetch(`${origin}/_author_resolve_failure`, { method: "PUT" })
    expect(await (await fetch(`${origin}/_author_resolve_failure`)).json()).toEqual({
      failure: true
    })
    const failedBody = { author_ids: ["LagerlofS"] }
    const failed = await postAuthorResolve("/private-v2/authors/resolve", failedBody)
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({
      error: {
        code: "author_resolve_unavailable",
        message: "Unable to resolve authors",
        details: null
      }
    })
    expect(await authorResolveRequests()).toEqual({
      requests: [{ path: "/private-v2/authors/resolve", body: failedBody }]
    })

    await fetch(`${origin}/_author_resolve_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_author_resolve_failure`)).json()).toEqual({
      failure: false
    })
    expect((await postAuthorResolve(
      "/v2/authors/resolve",
      { author_ids: ["LagerlofS"] }
    )).status).toBe(200)
  })

  test("author resolve uses serialized bodies for deterministic delayed responses", async () => {
    const slowBody = { author_ids: ["StrindbergA"] }
    const fastBody = { author_ids: ["LagerlofS"] }
    const delays = {
      [JSON.stringify(slowBody)]: 80,
      [JSON.stringify(fastBody)]: 0
    }
    await fetch(`${origin}/_author_resolve_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(delays)
    })

    const completionOrder: string[] = []
    const slow = postAuthorResolve("/v2/authors/resolve", slowBody).then(() => {
      completionOrder.push("slow")
    })
    const fast = postAuthorResolve("/v2/authors/resolve", fastBody).then(() => {
      completionOrder.push("fast")
    })
    await Promise.all([slow, fast])

    expect(completionOrder).toEqual(["fast", "slow"])
    expect(await authorResolveRequests()).toEqual({
      requests: [
        { path: "/v2/authors/resolve", body: slowBody },
        { path: "/v2/authors/resolve", body: fastBody }
      ]
    })
    expect(await (await fetch(`${origin}/_author_resolve_delays`)).json()).toEqual({
      delays
    })

    await fetch(`${origin}/_author_resolve_delays`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_author_resolve_delays`)).json()).toEqual({
      delays: {}
    })
  })

  test("author resolve rejects every invalid strict request without recording it", async () => {
    const invalidBodies: unknown[] = [
      { author_ids: [] },
      { author_ids: ["Duplicate", "Duplicate"] },
      { author_ids: ["Duplicate", " Duplicate "] },
      { author_ids: Array.from({ length: 51 }, (_, index) => `Author${index}`) },
      { author_ids: [" "] },
      { author_ids: ["x".repeat(101)] },
      {},
      { author_ids: "StrindbergA" },
      { author_ids: ["StrindbergA", 42] },
      { author_ids: ["StrindbergA"], unexpected: true },
      null,
      ["StrindbergA"]
    ]

    for (const body of invalidBodies) {
      const response = await postAuthorResolve("/v2/authors/resolve", body)
      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: null
        }
      })
    }
    expect(await authorResolveRequests()).toEqual({ requests: [] })
  })

  test("work lookup private-v2 dispatch preserves original paths for every v2 fixture", async () => {
    const contactBody = {
      sender_name: null,
      sender_address: "a@b",
      message: "Hej!",
      audience: "litteraturbanken"
    }
    const lookupBody = { work_id: "lb238704", titles: [] }
    const responses = [
      await fetch(`${origin}/private-v2/stats`),
      await fetch(`${origin}/private-v2/works/popular?limit=1`),
      await fetch(`${origin}/private-v2/epubs/popular?limit=1`),
      await fetch(`${origin}/private-v2/quick-search?query=strindberg`),
      await fetch(`${origin}/private-v2/contact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactBody)
      }),
      await postWorkLookup("/private-v2/works/lookup", lookupBody)
    ]

    expect(responses.map(response => response.status)).toEqual([
      200, 200, 200, 200, 202, 200
    ])
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: [
        "/private-v2/stats",
        "/private-v2/works/popular?limit=1",
        "/private-v2/epubs/popular?limit=1",
        "/private-v2/contact"
      ]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })
    expect(await contactSubmissions()).toEqual({
      contactSubmissions: [contactBody]
    })
    expect(await workLookupRequests()).toEqual({
      requests: [{ path: "/private-v2/works/lookup", body: lookupBody }]
    })
  })

  test("serves and separately records the exact Home fragment and rendered assets", async () => {
    await fetch(`${origin}/v2/stats`)

    const fragment = await fetch(
      `${origin}/red/om/start/startsida-ny.html?fixture-cache`
    )
    const stylesheet = await fetch(
      `${origin}/red/css/startsida.css?fixture-cache`
    )
    const background = await fetch(
      `${origin}/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg`
    )

    expect(fragment.status).toBe(200)
    expect(fragment.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(createHash("sha256").update(await fragment.text()).digest("hex")).toBe(
      "d6b6c2c33c1043d6df34ee2d8dae9d5f612754546f51a7f78b5f9b7ef39d6688"
    )
    expect(stylesheet.status).toBe(200)
    expect(stylesheet.headers.get("content-type")).toBe("text/css; charset=utf-8")
    expect(createHash("sha256").update(await stylesheet.text()).digest("hex")).toBe(
      "80e9c19f1fcfa3c2364edcdad9755192e358000bab3449e78867fa9daccdb2ea"
    )
    expect(background.status).toBe(200)
    expect(background.headers.get("content-type")).toBe("image/jpeg")
    expect(createHash("sha256").update(Buffer.from(await background.arrayBuffer())).digest("hex"))
      .toBe("e3a36d33654320df4bbb81fb7c70b3cc716c8d9ed425d06547a4f52951e52922")

    expect(await homeRequests()).toEqual({
      requests: [
        "/red/om/start/startsida-ny.html?fixture-cache",
        "/red/css/startsida.css?fixture-cache",
        "/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg"
      ]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: [] })
    expect(await contactSubmissions()).toEqual({ contactSubmissions: [] })

    await fetch(`${origin}/_home_requests`, { method: "DELETE" })
    expect(await homeRequests()).toEqual({ requests: [] })
  })

  test("Home content failure is independent and resettable without failing its assets", async () => {
    await fetch(`${origin}/_home_failure`, { method: "PUT" })

    const failed = await fetch(
      `${origin}/red/om/start/startsida-ny.html?failed-cache`
    )
    expect(failed.status).toBe(503)
    expect(failed.headers.get("content-type")).toBe("text/plain; charset=utf-8")
    expect(await failed.text()).toBe("content unavailable")
    expect((await fetch(`${origin}/red/css/startsida.css?failed-cache`)).status).toBe(200)
    expect((await fetch(
      `${origin}/red/bilder/bakgrundsbilder/start_bkg_172_2026.jpg`
    )).status).toBe(200)
    expect((await fetch(`${origin}/v2/quick-search?query=strindberg`)).status).toBe(200)
    expect((await fetch(`${origin}/v2/stats`)).status).toBe(200)

    await fetch(`${origin}/_home_failure`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_home_failure`)).json()).toEqual({ failure: false })
    expect((await fetch(
      `${origin}/red/om/start/startsida-ny.html?restored-cache`
    )).status).toBe(200)
  })

  test("does not serve a near-match for the fixed Home content path", async () => {
    const response = await fetch(
      `${origin}/red/om/start/startsida-ny-copy.html?fixture-cache`
    )

    expect(response.status).toBe(404)
    expect(await homeRequests()).toEqual({ requests: [] })
  })

  test("serves exact Presentation XHTML, XML, and rendered assets with isolated accounting", async () => {
    await fetch(`${origin}/v2/stats`)
    await fetch(`${origin}/v2/quick-search?query=strindberg`)
    await fetch(`${origin}/red/om/start/startsida-ny.html`)

    const expected = [
      ["/red/presentationer/presentationerForfattare.html?fixture-cache", "text/html; charset=utf-8"],
      ["/red/presentationer/specialomraden/Censur.html", "text/html; charset=utf-8"],
      ["/red/presentationer/specialomraden/Rostratt.html", "text/html; charset=utf-8"],
      ["/red/presentationer/specialomraden/FigurdiktenSomBarockBlandkonst.html", "text/html; charset=utf-8"],
      ["/red/presentationer/vandringar/VandringElam.html", "text/html; charset=utf-8"],
      ["/red/bilder/bakgrundsbilder/backgrounds.xml", "application/xml; charset=utf-8"],
      ["/red/presentationer/specialomraden/Rostratt.css", "text/css; charset=utf-8"],
      ["/app/style/litteraturbanken.css", "text/css; charset=utf-8"],
      ["/app/style/date.css", "text/css; charset=utf-8"],
      ...Array.from({ length: 10 }, (_, index) => [
        `/red/presentationer/specialomraden/Burmanbilder/${index + 1}.jpg`,
        "image/jpeg"
      ] as const),
      ["/red/presentationer/specialomraden/Figurdiktensombarockblandkonst.pdf", "application/pdf"],
      ["/red/bilder/bakgrundsbilder/rostratt_a.jpg", "image/jpeg"],
      ["/red/bilder/bakgrundsbilder/rostratt_b.jpg", "image/jpeg"]
    ] as const

    for (const [path, contentType] of expected) {
      const response = await fetch(`${origin}${path}`)
      expect(response.status, path).toBe(200)
      expect(response.headers.get("content-type"), path).toBe(contentType)
      expect((await response.arrayBuffer()).byteLength, path).toBeGreaterThan(0)
    }

    expect(await presentationRequests()).toEqual({
      requests: expected.map(([path]) => path)
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })
    expect(await homeRequests()).toEqual({
      requests: ["/red/om/start/startsida-ny.html"]
    })

    await fetch(`${origin}/_presentation_requests`, { method: "DELETE" })
    expect(await presentationRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({
      requests: ["/v2/stats"]
    })
    expect(await quickSearchRequests()).toEqual({ queries: ["strindberg"] })
    expect(await homeRequests()).toEqual({
      requests: ["/red/om/start/startsida-ny.html"]
    })
  })

  test("Presentation XHTML, XML, and asset failures are independent and resettable", async () => {
    const fail = async (resource: "xhtml" | "xml" | "asset") => {
      await fetch(`${origin}/_presentation_failures`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resource })
      })
    }

    await fail("xhtml")
    await fail("asset")
    expect(await (await fetch(`${origin}/_presentation_failures`)).json()).toEqual({
      failures: ["xhtml", "asset"]
    })
    expect((await fetch(`${origin}/red/presentationer/specialomraden/Censur.html`)).status)
      .toBe(503)
    expect((await fetch(`${origin}/red/presentationer/specialomraden/Rostratt.css`)).status)
      .toBe(503)
    expect((await fetch(`${origin}/red/bilder/bakgrundsbilder/backgrounds.xml`)).status)
      .toBe(200)

    await fetch(`${origin}/_presentation_failures`, { method: "DELETE" })
    await fail("xml")
    expect((await fetch(`${origin}/red/presentationer/specialomraden/Censur.html`)).status)
      .toBe(200)
    expect((await fetch(`${origin}/red/presentationer/specialomraden/Rostratt.css`)).status)
      .toBe(200)
    const xml = await fetch(`${origin}/red/bilder/bakgrundsbilder/backgrounds.xml`)
    expect(xml.status).toBe(503)
    expect(xml.headers.get("content-type")).toBe("text/plain; charset=utf-8")

    await fetch(`${origin}/_presentation_failures`, { method: "DELETE" })
    expect(await (await fetch(`${origin}/_presentation_failures`)).json()).toEqual({
      failures: []
    })
    expect((await fetch(`${origin}/red/bilder/bakgrundsbilder/backgrounds.xml`)).status)
      .toBe(200)
  })

  test("records but never serves non-allowlisted Presentation paths", async () => {
    const unknownDocument = "/red/presentationer/specialomraden/FutureEditorialAddition.html"
    const unknownAsset = "/red/presentationer/specialomraden/Rostratt-copy.css"

    expect((await fetch(`${origin}${unknownDocument}?probe=1`)).status).toBe(404)
    expect((await fetch(`${origin}${unknownAsset}`)).status).toBe(404)
    expect(await presentationRequests()).toEqual({
      requests: [`${unknownDocument}?probe=1`, unknownAsset]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({ requests: [] })
    expect(await homeRequests()).toEqual({ requests: [] })
    expect(await quickSearchRequests()).toEqual({ queries: [] })
    expect(await contactSubmissions()).toEqual({ contactSubmissions: [] })
  })

  test("serves Litteraturkartan paths and resets only its exact request ledger", async () => {
    await fetch(`${origin}/v2/stats`)
    await fetch(`${origin}/v2/quick-search?query=strindberg`)
    await fetch(`${origin}/red/om/ide/omlitteraturbanken.html?content=1`)
    await fetch(`${origin}/red/om/start/startsida-ny.html?home=1`)

    const root = await fetch(`${origin}/litteraturkartan`)
    const nestedPath = "/litteraturkartan/region/%C3%96land/%E2%80%93?view=text%2Fbild&empty="
    const nested = await fetch(`${origin}${nestedPath}`)

    expect(root.status).toBe(200)
    expect(root.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(await root.text()).toContain("litteraturkartan-upstream-fixture")
    expect(nested.status).toBe(200)
    expect(await nested.text()).toContain("litteraturkartan-upstream-fixture")
    expect(await litteraturkartanRequests()).toEqual({
      requests: ["/litteraturkartan", nestedPath]
    })

    const genericLedger = await (await fetch(`${origin}/_requests`)).json()
    const quickSearchLedger = await quickSearchRequests()
    const homeLedger = await homeRequests()

    await fetch(`${origin}/_litteraturkartan_requests`, { method: "DELETE" })

    expect(await litteraturkartanRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual(genericLedger)
    expect(await quickSearchRequests()).toEqual(quickSearchLedger)
    expect(await homeRequests()).toEqual(homeLedger)
  })

  test("serves public and private legacy Library relevance responses with isolated accounting", async () => {
    const types = "etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress"
    const query = "q=%28R%C3%B6da+rummet%29&from=0&to=100&sort_field=_score%7Cdesc"
    const publicResponse = await fetch(`${origin}/api/relevance/${types}?${query}`)
    const privateResponse = await fetch(`${origin}/legacy-api/relevance/${types}?q=%28Selma%29`)
    const background = await fetch(
      `${origin}/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg`
    )
    const mixedResponse = await fetch(`${origin}/api/relevance/${types}?q=%28blandat%29`)
    const malformedResponse = await fetch(
      `${origin}/api/relevance/${types}?q=%28malformed-top%29`
    )

    expect(publicResponse.status).toBe(200)
    expect(privateResponse.status).toBe(200)
    expect(background.status).toBe(200)
    expect(background.headers.get("content-type")).toBe("image/jpeg")
    expect(createHash("sha256").update(Buffer.from(await background.arrayBuffer())).digest("hex"))
      .toBe("4191d7e2db8638781fa15ae06e12d8f05eff57caeb3c3f37661cbe8846465c1c")
    expect((await mixedResponse.json() as { data: unknown[] }).data).toHaveLength(17)
    expect(await malformedResponse.json()).toEqual({ data: "invalid", hits: 0, suggest: [] })
    const publicBody = await publicResponse.json() as { data: unknown[], hits: number }
    const privateBody = await privateResponse.json() as { data: unknown[], hits: number }
    expect(publicBody.hits).toBe(publicBody.data.length)
    expect(privateBody.hits).toBe(privateBody.data.length)
    expect(publicBody.data).not.toEqual(privateBody.data)
    expect(await libraryRelevanceRequests()).toEqual({
      requests: [
        {
          path: `/api/relevance/${types}`,
          query: {
            q: "(Röda rummet)",
            from: "0",
            to: "100",
            sort_field: "_score|desc"
          }
        },
        {
          path: `/legacy-api/relevance/${types}`,
          query: { q: "(Selma)" }
        },
        {
          path: `/api/relevance/${types}`,
          query: { q: "(blandat)" }
        },
        {
          path: `/api/relevance/${types}`,
          query: { q: "(malformed-top)" }
        }
      ]
    })
    expect(await (await fetch(`${origin}/_requests`)).json()).toEqual({ requests: [] })
  })

  test("Library relevance failure, delay, and reset controls are isolated", async () => {
    await fetch(`${origin}/_library_relevance_delays`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "(slow)|sortkey|asc": 30 })
    })
    const started = Date.now()
    expect((await fetch(
      `${origin}/api/relevance/test?q=%28slow%29&sort_field=sortkey%7Casc`
    )).status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(20)

    await fetch(`${origin}/_library_relevance_failure`, { method: "PUT" })
    expect((await fetch(`${origin}/legacy-api/relevance/test?q=%28failed%29`)).status).toBe(503)
    expect(await (await fetch(`${origin}/_library_relevance_failure`)).json())
      .toEqual({ failure: true })

    await fetch(`${origin}/_library_relevance_requests`, { method: "DELETE" })
    await fetch(`${origin}/_library_relevance_failure`, { method: "DELETE" })
    await fetch(`${origin}/_library_relevance_delays`, { method: "DELETE" })
    expect(await libraryRelevanceRequests()).toEqual({ requests: [] })
    expect(await (await fetch(`${origin}/_library_relevance_failure`)).json())
      .toEqual({ failure: false })
    expect(await (await fetch(`${origin}/_library_relevance_delays`)).json())
      .toEqual({ delays: {} })
    expect((await fetch(`${origin}/v2/stats`)).status).toBe(200)
  })
})
