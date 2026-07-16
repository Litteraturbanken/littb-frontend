import type { ChildProcess } from "node:child_process"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { once } from "node:events"
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
      fetch(`${origin}/_home_requests`, { method: "DELETE" }),
      fetch(`${origin}/_home_failure`, { method: "DELETE" }),
      fetch(`${origin}/_presentation_requests`, { method: "DELETE" }),
      fetch(`${origin}/_presentation_failures`, { method: "DELETE" })
    ])
  })

  afterEach(async () => {
    await fetch(`${origin}/_contact_defer`, { method: "DELETE" })
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
})
