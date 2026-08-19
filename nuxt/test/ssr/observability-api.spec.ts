import { createHmac } from "node:crypto"

import { expect, test } from "@playwright/test"

const fixtureOrigin = `http://127.0.0.1:${Number(process.env.LBAPI_FIXTURE_PORT || 4100)}`
const appOrigin = `http://127.0.0.1:${Number(process.env.LITTB_NUXT_TEST_PORT || 3000)}`
const secret = "test-observability-secret-material-0123456789"

function event(eventId = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d") {
  return {
    event_id: eventId,
    event_name: "browser.error",
    error_type: "TypeError",
    resource_kind: "unknown",
    correlation_token: null
  }
}

function hydrationEvent(eventId = "018f47c0-4d5b-7a62-8f41-a04b5df3fd92") {
  return {
    ...event(eventId),
    event_name: "browser.hydration_error",
    error_type: "HydrationMismatch",
    resource_kind: "document"
  }
}

test.beforeEach(async ({ request }) => {
  await request.delete(`${fixtureOrigin}/_observability_requests`)
})

test("same-origin browser events are rebuilt and signed as trusted events", async ({ request }) => {
  const body = JSON.stringify({ events: [event()] })
  const response = await request.post("/_observability/events", {
    data: body,
    headers: {
      "content-type": "application/json",
      origin: appOrigin,
      cookie: "private-session=must-not-be-forwarded",
      "user-agent": "Private Browser Identity"
    }
  })

  expect(response.status()).toBe(202)
  expect(await response.json()).toEqual({ accepted: 1 })
  const ledgerResponse = await request.get(`${fixtureOrigin}/_observability_requests`)
  const ledger = (await ledgerResponse.json()).requests
  expect(ledger).toHaveLength(1)
  const forwarded = JSON.parse(ledger[0].body)
  expect(forwarded.events).toHaveLength(1)
  expect(forwarded.events[0]).toMatchObject({
    schema_version: "lb.observability.v1",
    event_id: event().event_id,
    event_name: "browser.error",
    event_kind: "error",
    severity: "error",
    service: "lb-frontend",
    producer: "browser",
    environment: "stage",
    deployment_git_sha: "a".repeat(40),
    request_id: null,
    trace_id: null,
    span_id: null,
    route: null,
    error_type: "TypeError",
    attributes: { component: null, resource_kind: "unknown" }
  })
  expect(forwarded.events[0].error_fingerprint).toMatch(/^[0-9a-f]{64}$/u)
  expect(Date.parse(forwarded.events[0].timestamp)).not.toBeNaN()
  const timestamp = ledger[0].headers["x-lb-observability-timestamp"]
  const expectedSignature = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${ledger[0].body}`)
    .digest("hex")}`
  expect(ledger[0].headers["x-lb-observability-signature"])
    .toBe(expectedSignature)
  expect(ledger[0].headers.cookie).toBeUndefined()
  expect(ledger[0].body).not.toContain("private-session")
  expect(ledger[0].body).not.toContain("Private Browser Identity")
})

test("hydration intake forwards only the compact trusted event", async ({ request }) => {
  const response = await request.post("/_observability/events", {
    data: JSON.stringify({ events: [hydrationEvent()] }),
    headers: { "content-type": "application/json", origin: appOrigin }
  })

  expect(response.status()).toBe(202)
  const ledger = (await (await request.get(
    `${fixtureOrigin}/_observability_requests`
  )).json()).requests
  const forwarded = JSON.parse(ledger[0].body).events[0]
  expect(forwarded).toMatchObject({
    event_name: "browser.hydration_error",
    error_type: "HydrationMismatch",
    attributes: { component: null, resource_kind: "document" }
  })
  for (const diagnostic of [
    "console", "html", "dom", "props", "url", "query", "stack",
    "user_agent", "ip", "cookie", "selected_text"
  ]) {
    expect(forwarded[diagnostic]).toBeUndefined()
  }
})

test("same-origin validation accepts a configured public alias", async ({ request }) => {
  const body = JSON.stringify({
    events: [event("018f47c0-4d5b-7a62-8f41-a04b5df3fd90")]
  })
  const response = await request.post("/_observability/events", {
    data: body,
    headers: {
      "content-type": "application/json",
      origin: "https://stage.litteraturbanken.se",
      "x-forwarded-host": "stage.litteraturbanken.se",
      "x-forwarded-proto": "https"
    }
  })

  expect(response.status()).toBe(202)
})

test("cross-origin, malformed, oversized, and privacy-unsafe batches fail closed", async ({ request }) => {
  const validBody = JSON.stringify({ events: [event()] })
  const crossOrigin = await request.post("/_observability/events", {
    data: validBody,
    headers: {
      "content-type": "application/json",
      origin: "https://evil.invalid",
      "x-forwarded-host": "evil.invalid"
    }
  })
  expect(crossOrigin.status()).toBe(403)

  const wrongType = await request.post("/_observability/events", {
    data: validBody,
    headers: { "content-type": "text/plain", origin: appOrigin }
  })
  expect(wrongType.status()).toBe(415)

  for (const forged of [
    { ...event(), event_name: "request.failed" },
    { ...event(), timestamp: "2026-01-01T00:00:00Z" },
    { ...event(), deployment_git_sha: "f".repeat(40) },
    { ...event(), producer: "fastapi" },
    { ...event(), error_type: "selectedSecret" },
    { ...event(), component: "selectedSecret" },
    { ...event(), query: "private phrase" }
  ]) {
    const unsafeResponse = await request.post("/_observability/events", {
      data: JSON.stringify({ events: [forged] }),
      headers: { "content-type": "application/json", origin: appOrigin }
    })
    expect(unsafeResponse.status()).toBe(422)
  }

  const tooMany = await request.post("/_observability/events", {
    data: JSON.stringify({
      events: Array.from({ length: 11 }, (_, index) => event(
        `018f47c0-4d5b-7a62-8f41-${String(index).padStart(12, "0")}`
      ))
    }),
    headers: { "content-type": "application/json", origin: appOrigin }
  })
  expect(tooMany.status()).toBe(422)

  const oversized = await request.post("/_observability/events", {
    data: JSON.stringify({ events: [event()], padding: "x".repeat(17_000) }),
    headers: { "content-type": "application/json", origin: appOrigin }
  })
  expect(oversized.status()).toBe(413)

  const ledgerResponse = await request.get(`${fixtureOrigin}/_observability_requests`)
  expect((await ledgerResponse.json()).requests).toEqual([])
})

test("an issued correlation token links only its exact server request", async ({ request }) => {
  const incomingTraceId = "0123456789abcdef0123456789abcdef"
  const correlatedResponse = await request.get("/robots.txt", {
    headers: {
      traceparent: `00-${incomingTraceId}-0123456789abcdef-00`
    }
  })
  const token = correlatedResponse.headers()["x-lb-observability-correlation"]
  const requestId = correlatedResponse.headers()["x-request-id"]
  const traceparent = correlatedResponse.headers().traceparent
  expect(token).toMatch(/^[0-9a-f-]{36}$/u)
  expect(traceparent).toMatch(
    new RegExp(`^00-${incomingTraceId}-[0-9a-f]{16}-00$`, "u")
  )

  const correlatedEvent = {
    ...event("018f47c0-4d5b-7a62-8f41-a04b5df3fd91"),
    correlation_token: token
  }
  expect((await request.post("/_observability/events", {
    data: JSON.stringify({ events: [correlatedEvent] }),
    headers: { "content-type": "application/json", origin: appOrigin }
  })).status()).toBe(202)

  const ledger = (await (await request.get(
    `${fixtureOrigin}/_observability_requests`
  )).json()).requests
  const forwarded = JSON.parse(ledger[0].body).events[0]
  expect(forwarded.event_id).toBe(correlatedEvent.event_id)
  expect(forwarded.request_id).toBe(requestId)
  expect(forwarded.trace_id).toBe(traceparent.split("-")[1])
  expect(forwarded.span_id).toMatch(/^[0-9a-f]{16}$/u)
  expect(forwarded.span_id).not.toBe(traceparent.split("-")[2])
})

test("replayed event IDs are acknowledged without a second upstream delivery", async ({ request }) => {
  const body = JSON.stringify({
    events: [event("018f47c0-4d5b-7a62-8f41-a04b5df3fd8f")]
  })
  const options = {
    data: body,
    headers: { "content-type": "application/json", origin: appOrigin }
  }

  expect((await request.post("/_observability/events", options)).status()).toBe(202)
  const replay = await request.post("/_observability/events", options)
  expect(replay.status()).toBe(202)
  expect(await replay.json()).toEqual({ accepted: 0 })

  const ledgerResponse = await request.get(`${fixtureOrigin}/_observability_requests`)
  expect((await ledgerResponse.json()).requests).toHaveLength(1)
})
