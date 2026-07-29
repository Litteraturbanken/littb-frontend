import { createHmac } from "node:crypto"

import { expect, test } from "@playwright/test"

const fixtureOrigin = `http://127.0.0.1:${Number(process.env.LBAPI_FIXTURE_PORT || 4100)}`
const appOrigin = `http://127.0.0.1:${Number(process.env.LITTB_NUXT_TEST_PORT || 3000)}`
const secret = "test-observability-secret-material-0123456789"

function event(eventId = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d") {
  return {
    schema_version: "lb.observability.v1",
    timestamp: "2026-07-29T20:00:00Z",
    event_id: eventId,
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
    route: "/bibliotek",
    http_method: null,
    status_code: null,
    duration_ms: null,
    error_type: "TypeError",
    error_fingerprint: "b".repeat(64),
    attributes: { component: "Library", resource_kind: "unknown" }
  }
}

test.beforeEach(async ({ request }) => {
  await request.delete(`${fixtureOrigin}/_observability_requests`)
})

test("same-origin browser events are signed over the exact forwarded bytes", async ({ request }) => {
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
  expect(ledger[0].body).toBe(body)
  const timestamp = ledger[0].headers["x-lb-observability-timestamp"]
  const expectedSignature = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`
  expect(ledger[0].headers["x-lb-observability-signature"])
    .toBe(expectedSignature)
  expect(ledger[0].headers.cookie).toBeUndefined()
  expect(ledger[0].body).not.toContain("private-session")
  expect(ledger[0].body).not.toContain("Private Browser Identity")
})

test("cross-origin, malformed, oversized, and privacy-unsafe batches fail closed", async ({ request }) => {
  const validBody = JSON.stringify({ events: [event()] })
  const crossOrigin = await request.post("/_observability/events", {
    data: validBody,
    headers: { "content-type": "application/json", origin: "https://evil.invalid" }
  })
  expect(crossOrigin.status()).toBe(403)

  const wrongType = await request.post("/_observability/events", {
    data: validBody,
    headers: { "content-type": "text/plain", origin: appOrigin }
  })
  expect(wrongType.status()).toBe(415)

  const unsafe = event("018f47c0-4d5b-7a62-8f41-a04b5df3fd8e")
  const unsafeResponse = await request.post("/_observability/events", {
    data: JSON.stringify({ events: [{ ...unsafe, query: "private phrase" }] }),
    headers: { "content-type": "application/json", origin: appOrigin }
  })
  expect(unsafeResponse.status()).toBe(422)

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
