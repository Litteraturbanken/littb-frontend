import { Readable } from "node:stream"

import type { H3Event } from "h3"
import { describe, expect, test } from "vitest"

import {
  handleObservabilityIntake,
  ObservabilityIntakeGuard,
  readBoundedRequestBody
} from "../../server/utils/observability-intake"

const intakeEventId = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d"

function intakeRequest(): H3Event {
  const body = Buffer.from(JSON.stringify({
    events: [{
      event_id: intakeEventId,
      event_name: "browser.error",
      error_type: "TypeError",
      resource_kind: "unknown",
      correlation_token: null
    }]
  }))
  const request = Object.assign(Readable.from([body]), {
    headers: {
      "content-length": String(body.byteLength),
      "content-type": "application/json",
      host: "localhost",
      origin: "http://localhost"
    },
    socket: { encrypted: false, remoteAddress: "127.0.0.1" }
  })
  return {
    context: {},
    node: {
      req: request,
      res: { statusCode: 200, statusMessage: "" }
    }
  } as unknown as H3Event
}

describe("observability intake guard", () => {
  test("stops buffering a streamed request at the configured limit", async () => {
    const request = Readable.from([
      Buffer.alloc(10, 1),
      Buffer.alloc(7, 2),
      Buffer.alloc(1_000, 3)
    ])
    const event = { node: { req: request } } as unknown as H3Event

    await expect(readBoundedRequestBody(event, 16)).rejects.toMatchObject({
      statusCode: 413
    })
  })

  test("accepts a streamed request exactly at the configured limit", async () => {
    const request = Readable.from([Buffer.from("12345678"), Buffer.from("abcdefgh")])
    const event = { node: { req: request } } as unknown as H3Event

    await expect(readBoundedRequestBody(event, 16)).resolves.toEqual(
      Buffer.from("12345678abcdefgh")
    )
  })

  test("enforces a per-client window and recovers after it", () => {
    const guard = new ObservabilityIntakeGuard()
    for (let index = 0; index < 60; index += 1) {
      expect(() => guard.enforceRate("hashed-client", 1_000)).not.toThrow()
    }

    expect(() => guard.enforceRate("hashed-client", 1_000)).toThrowError(
      expect.objectContaining({ statusCode: 429 })
    )
    expect(() => guard.enforceRate("hashed-client", 61_001)).not.toThrow()
  })

  test("deduplicates event IDs temporarily and releases failed deliveries", () => {
    const guard = new ObservabilityIntakeGuard()
    const event = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d" }
    const firstOwner = Symbol("first request")

    expect(guard.reserveNewEvents([event], 1_000, firstOwner)).toEqual([event])
    expect(guard.reserveNewEvents([event], 2_000, Symbol("duplicate"))).toEqual([])
    guard.release([event.event_id], firstOwner)
    expect(guard.reserveNewEvents([event], 3_000, Symbol("retry"))).toEqual([event])
    expect(guard.reserveNewEvents([event], 303_001, Symbol("expired")))
      .toEqual([event])
  })

  test("an expired reservation cannot release a newer owner of the same ID", () => {
    const guard = new ObservabilityIntakeGuard()
    const event = { event_id: intakeEventId }
    const oldOwner = Symbol("old request")
    const newOwner = Symbol("new request")

    expect(guard.reserveNewEvents([event], 1_000, oldOwner)).toEqual([event])
    expect(guard.reserveNewEvents([event], 301_001, newOwner)).toEqual([event])
    guard.release([event.event_id], oldOwner)

    expect(guard.reserveNewEvents([event], 301_002, Symbol("third request")))
      .toEqual([])
  })

  test("releases event IDs when signing preparation fails before delivery", async () => {
    const guard = new ObservabilityIntakeGuard()
    const config = {
      apiBase: "http://localhost:4100",
      allowedOrigins: "",
      deploymentEnvironment: "stage",
      deploymentGitSha: "a".repeat(40),
      hmacSecret: "",
      hmacSecretFile: "/missing/observability-secret"
    }
    const options = {
      fetch: () => Promise.reject(new Error("must not deliver")),
      guard,
      now: () => 1_000
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(handleObservabilityIntake(
        intakeRequest(),
        config,
        options
      )).rejects.toMatchObject({ statusCode: 503 })
    }
  })
})
