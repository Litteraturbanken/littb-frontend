import { describe, expect, test, vi } from "vitest"

import { reportDictionaryLookupOutcome } from "../../app/lib/observability/dictionary-lookup"

describe("dictionary lookup observability", () => {
  test("posts one closed privacy-safe event with keepalive", async () => {
    const fetchImplementation = vi.fn(async () => new Response(null, { status: 202 }))

    await expect(reportDictionaryLookupOutcome({
      durationMs: 125,
      fetch: fetchImplementation,
      outcome: "both",
      selectedDictionary: "so",
      wordLength: 7
    })).resolves.toBeUndefined()

    expect(fetchImplementation).toHaveBeenCalledOnce()
    const [endpoint, init] = fetchImplementation.mock.calls[0] ?? []
    expect(endpoint).toBe("/_observability/events")
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true
    })
    const body = JSON.parse(String(init?.body))
    expect(body.events).toHaveLength(1)
    expect(body.events[0]).toMatchObject({
      event_name: "business.dictionary_lookup",
      word_length: 7,
      outcome: "both",
      selected_dictionary: "so",
      duration_ms: 125
    })
    expect(body.events[0].event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    )
    expect(Object.keys(body.events[0]).sort()).toEqual([
      "duration_ms",
      "event_id",
      "event_name",
      "outcome",
      "selected_dictionary",
      "word_length"
    ])
  })

  test("supports a custom endpoint and null selected dictionary", async () => {
    const fetchImplementation = vi.fn(async () => new Response(null, { status: 202 }))

    await reportDictionaryLookupOutcome({
      durationMs: 8_000,
      endpoint: "/events",
      fetch: fetchImplementation,
      outcome: "timeout",
      selectedDictionary: null,
      wordLength: 4
    })

    expect(fetchImplementation.mock.calls[0]?.[0]).toBe("/events")
    expect(JSON.parse(String(fetchImplementation.mock.calls[0]?.[1]?.body)))
      .toMatchObject({
        events: [{
          outcome: "timeout",
          selected_dictionary: null
        }]
      })
  })

  test("swallows delivery failures", async () => {
    const fetchImplementation = vi.fn(async () => {
      throw new Error("offline")
    })

    await expect(reportDictionaryLookupOutcome({
      durationMs: 10,
      fetch: fetchImplementation,
      outcome: "opened",
      selectedDictionary: null,
      wordLength: 4
    })).resolves.toBeUndefined()
  })
})
