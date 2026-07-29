import { Readable } from "node:stream"

import type { H3Event } from "h3"
import { describe, expect, test } from "vitest"

import {
  ObservabilityIntakeGuard,
  readBoundedRequestBody
} from "../../server/utils/observability-intake"

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

    expect(guard.reserveNewEvents([event], 1_000)).toEqual([event])
    expect(guard.reserveNewEvents([event], 2_000)).toEqual([])
    guard.release([event.event_id])
    expect(guard.reserveNewEvents([event], 3_000)).toEqual([event])
    expect(guard.reserveNewEvents([event], 303_001)).toEqual([event])
  })
})
