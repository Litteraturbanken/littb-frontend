import { Readable } from "node:stream"

import type { H3Event } from "h3"
import { describe, expect, test, vi } from "vitest"

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

const intakeConfig = {
  apiBase: "http://localhost:4100",
  allowedOrigins: "",
  deploymentEnvironment: "stage",
  deploymentGitSha: "a".repeat(40),
  hmacSecret: "test-observability-secret-material-0123456789",
  hmacSecretFile: ""
}

function acceptedResponse(accepted = 1): Response {
  return new Response(JSON.stringify({ accepted }), {
    status: 202,
    headers: { "content-type": "application/json" }
  })
}

function intakeRequestWithBody(
  body: string,
  request: Readable = Readable.from([Buffer.from(body)])
): H3Event {
  const nodeRequest = Object.assign(request, {
    headers: {
      "content-length": String(Buffer.byteLength(body)),
      "content-type": "application/json",
      host: "localhost",
      origin: "http://localhost"
    },
    socket: { encrypted: false, remoteAddress: "127.0.0.2" }
  })
  return {
    context: {},
    node: {
      req: nodeRequest,
      res: { statusCode: 200, statusMessage: "" }
    }
  } as unknown as H3Event
}

function hydrationIntakeEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: intakeEventId,
    event_name: "browser.hydration_error",
    error_type: "HydrationMismatch",
    resource_kind: "document",
    correlation_token: null,
    ...overrides
  }
}

function dictionaryIntakeEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e",
    event_name: "business.dictionary_lookup",
    word_length: 7,
    outcome: "both",
    selected_dictionary: "so",
    duration_ms: 125,
    ...overrides
  }
}

describe("observability intake guard", () => {
  test("converts the compact dictionary outcome into a trusted business event", async () => {
    const fetchImplementation = vi.fn(async () => acceptedResponse())

    await expect(handleObservabilityIntake(
      intakeRequestWithBody(JSON.stringify({ events: [dictionaryIntakeEvent()] })),
      intakeConfig,
      {
        fetch: fetchImplementation,
        guard: new ObservabilityIntakeGuard(),
        now: () => Date.parse("2026-08-23T12:00:00Z")
      }
    )).resolves.toEqual({ accepted: 1 })

    const forwarded = JSON.parse(String(fetchImplementation.mock.calls[0]?.[1]?.body))
    expect(forwarded.events).toEqual([{
      schema_version: "lb.observability.v1",
      timestamp: "2026-08-23T12:00:00.000Z",
      event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e",
      event_name: "business.dictionary_lookup",
      event_kind: "business",
      severity: "info",
      service: "lb-frontend",
      producer: "browser",
      environment: "stage",
      deployment_git_sha: "a".repeat(40),
      request_id: null,
      trace_id: null,
      span_id: null,
      route: null,
      http_method: null,
      status_code: null,
      duration_ms: 125,
      error_type: null,
      error_fingerprint: null,
      attributes: {
        word_length: 7,
        found: true,
        outcome: "both",
        selected_dictionary: "so"
      }
    }])
    for (const privateField of ["word", "query", "url"]) {
      expect(forwarded.events[0]).not.toHaveProperty(privateField)
      expect(forwarded.events[0].attributes).not.toHaveProperty(privateField)
    }
  })

  test.each([
    ["opened", null],
    ["so", true],
    ["saob", true],
    ["both", true],
    ["empty", false],
    ["child_error", null],
    ["timeout", null]
  ])("derives found from the %s dictionary outcome", async (outcome, found) => {
    const fetchImplementation = vi.fn(async () => acceptedResponse())

    await handleObservabilityIntake(
      intakeRequestWithBody(JSON.stringify({
        events: [dictionaryIntakeEvent({ outcome })]
      })),
      intakeConfig,
      {
        fetch: fetchImplementation,
        guard: new ObservabilityIntakeGuard(),
        now: () => 1_000
      }
    )

    const forwarded = JSON.parse(String(fetchImplementation.mock.calls[0]?.[1]?.body))
    expect(forwarded.events[0].attributes.found).toBe(found)
  })

  test.each([
    ["unknown outcome", { outcome: "unknown" }],
    ["SAOL selection", { selected_dictionary: "saol" }],
    ["extra field", { extra: true }],
    ["zero word length", { word_length: 0 }],
    ["oversized word length", { word_length: 101 }],
    ["negative duration", { duration_ms: -1 }],
    ["oversized duration", { duration_ms: 60_001 }],
    ["private data", {
      word: "hemligt",
      query: "hemligt",
      url: "https://svenska.se/?q=hemligt"
    }]
  ])("rejects a dictionary outcome with %s", async (_case, overrides) => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>()

    await expect(handleObservabilityIntake(
      intakeRequestWithBody(JSON.stringify({
        events: [dictionaryIntakeEvent(overrides)]
      })),
      intakeConfig,
      {
        fetch: fetchImplementation,
        guard: new ObservabilityIntakeGuard(),
        now: () => 1_000
      }
    )).rejects.toMatchObject({ statusCode: 422 })
    expect(fetchImplementation).not.toHaveBeenCalled()
  })

  test("accepts only the exact compact hydration classification", async () => {
    const fetchImplementation = vi.fn(async () => acceptedResponse())
    const options = {
      fetch: fetchImplementation,
      guard: new ObservabilityIntakeGuard(),
      now: () => 1_000
    }

    await expect(handleObservabilityIntake(
      intakeRequestWithBody(JSON.stringify({ events: [hydrationIntakeEvent()] })),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 1 })
    expect(JSON.parse(String(fetchImplementation.mock.calls[0]?.[1]?.body)).events)
      .toMatchObject([{
        event_name: "browser.hydration_error",
        error_type: "HydrationMismatch",
        attributes: { resource_kind: "document" }
      }])

    for (const invalid of [
      hydrationIntakeEvent({ error_type: "TypeError" }),
      hydrationIntakeEvent({ resource_kind: "script" }),
      {
        ...hydrationIntakeEvent(),
        event_name: "browser.error",
        resource_kind: "unknown"
      }
    ]) {
      await expect(handleObservabilityIntake(
        intakeRequestWithBody(JSON.stringify({ events: [invalid] })),
        intakeConfig,
        options
      )).rejects.toMatchObject({ statusCode: 422 })
    }
    expect(fetchImplementation).toHaveBeenCalledOnce()
  })

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

  test("rejects an oversized chunk before copying it and closes the iterator", async () => {
    const oversized = new Uint8Array(1_000)
    let returned = false
    let yielded = false
    const uncopiable = new Proxy(oversized, {
      get(target, property) {
        if (property === "byteLength") return target.byteLength
        throw new Error("oversized chunk must not be copied")
      }
    })
    const request = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            if (yielded) return { done: true as const, value: undefined }
            yielded = true
            return { done: false as const, value: uncopiable }
          },
          async return() {
            returned = true
            return { done: true as const, value: undefined }
          }
        }
      }
    }
    const event = { node: { req: request } } as unknown as H3Event

    await expect(readBoundedRequestBody(event, 16)).rejects.toMatchObject({
      statusCode: 413
    })
    expect(returned).toBe(true)
  })

  test("counts multibyte strings by UTF-8 bytes before copying", async () => {
    const rejected = {
      node: { req: { async *[Symbol.asyncIterator]() { yield "å" } } }
    } as unknown as H3Event
    const accepted = {
      node: { req: { async *[Symbol.asyncIterator]() { yield "å" } } }
    } as unknown as H3Event

    await expect(readBoundedRequestBody(rejected, 1)).rejects.toMatchObject({
      statusCode: 413
    })
    await expect(readBoundedRequestBody(accepted, 2)).resolves.toEqual(
      Buffer.from("å")
    )
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

  test("preserves live client quotas when rate-limit capacity is full", () => {
    const guard = new ObservabilityIntakeGuard()
    for (let request = 0; request < 60; request += 1) {
      guard.enforceRate("existing-client", 1_000)
    }
    for (let client = 0; client < 9_999; client += 1) {
      guard.enforceRate(`client-${client}`, 1_000)
    }

    expect(() => guard.enforceRate("overflow-client", 1_000)).toThrowError(
      expect.objectContaining({ statusCode: 429 })
    )
    expect(() => guard.enforceRate("existing-client", 1_000)).toThrowError(
      expect.objectContaining({ statusCode: 429 })
    )
  })

  test("rate limits malformed bodies before reading the exhausted request", async () => {
    const guard = new ObservabilityIntakeGuard()
    const fetchImplementation = vi.fn<typeof globalThis.fetch>()
    const now = vi.fn(() => 1_000)
    const config = {
      apiBase: "http://localhost:4100",
      allowedOrigins: "",
      deploymentEnvironment: "stage",
      deploymentGitSha: "a".repeat(40),
      hmacSecret: "test-observability-secret-material-0123456789",
      hmacSecretFile: ""
    }
    const options = { fetch: fetchImplementation, guard, now }

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const body = attempt % 2 === 0 ? "{" : JSON.stringify({ events: [] })
      await expect(handleObservabilityIntake(
        intakeRequestWithBody(body),
        config,
        options
      )).rejects.toMatchObject({ statusCode: 422 })
    }

    for (const [header, value, statusCode] of [
      ["content-type", "text/plain", 415],
      ["origin", "https://evil.invalid", 403],
      ["content-length", String(16 * 1024 + 1), 413]
    ] as const) {
      const rejectedBeforeRate = intakeRequestWithBody("{")
      rejectedBeforeRate.node.req.headers[header] = value
      await expect(handleObservabilityIntake(
        rejectedBeforeRate,
        config,
        options
      )).rejects.toMatchObject({ statusCode })
    }

    let exhaustedBodyRead = false
    const exhaustedBody = new Readable({
      read() {
        exhaustedBodyRead = true
        this.push("{")
        this.push(null)
      }
    })
    await expect(handleObservabilityIntake(
      intakeRequestWithBody("{", exhaustedBody),
      config,
      options
    )).rejects.toMatchObject({ statusCode: 429 })
    expect(exhaustedBodyRead).toBe(false)
    expect(fetchImplementation).not.toHaveBeenCalled()

    now.mockReturnValue(61_000)
    let recoveredBodyRead = false
    const recoveredBody = new Readable({
      read() {
        recoveredBodyRead = true
        this.push("{")
        this.push(null)
      }
    })
    await expect(handleObservabilityIntake(
      intakeRequestWithBody("{", recoveredBody),
      config,
      options
    )).rejects.toMatchObject({ statusCode: 422 })
    expect(recoveredBodyRead).toBe(true)
    expect(now).toHaveBeenCalledTimes(62)
  })

  test("does not let an untrusted forwarded address bypass the client rate limit", async () => {
    const guard = new ObservabilityIntakeGuard()
    const fetchImplementation = vi.fn(async () => acceptedResponse())
    const options = {
      fetch: fetchImplementation,
      guard,
      now: () => 1_000
    }

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const event = intakeRequest()
      event.node.req.headers["x-forwarded-for"] = `203.0.113.${attempt}`
      await expect(handleObservabilityIntake(
        event,
        intakeConfig,
        options
      )).resolves.toEqual({ accepted: attempt === 0 ? 1 : 0 })
    }

    const rejected = intakeRequest()
    rejected.node.req.headers["x-forwarded-for"] = "198.51.100.200"
    await expect(handleObservabilityIntake(
      rejected,
      intakeConfig,
      options
    )).rejects.toMatchObject({ statusCode: 429 })
    expect(fetchImplementation).toHaveBeenCalledOnce()
  })

  test("deduplicates event IDs temporarily and releases failed deliveries", () => {
    const guard = new ObservabilityIntakeGuard()
    const event = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d" }
    const firstOwner = Symbol("first request")

    expect(guard.reserveNewEvents([event], 1_000, firstOwner)).toEqual([event])
    expect(() => guard.reserveNewEvents([event], 2_000, Symbol("pending duplicate")))
      .toThrowError(expect.objectContaining({ statusCode: 409 }))
    guard.release([event.event_id], firstOwner)
    const retryOwner = Symbol("retry")
    expect(guard.reserveNewEvents([event], 3_000, retryOwner)).toEqual([event])
    guard.accept([event.event_id], retryOwner, 3_000)
    expect(guard.reserveNewEvents([event], 4_000, Symbol("accepted duplicate")))
      .toEqual([])
    expect(guard.reserveNewEvents([event], 303_001, Symbol("expired")))
      .toEqual([event])
  })

  test("an expired reservation cannot release a newer owner of the same ID", () => {
    const guard = new ObservabilityIntakeGuard()
    const event = { event_id: intakeEventId }
    const oldOwner = Symbol("old request")
    const newOwner = Symbol("new request")

    expect(guard.reserveNewEvents([event], 1_000, oldOwner)).toEqual([event])
    guard.accept([event.event_id], oldOwner, 1_000)
    expect(guard.reserveNewEvents([event], 301_001, newOwner)).toEqual([event])
    guard.release([event.event_id], oldOwner)
    guard.accept([event.event_id], oldOwner, 301_001)

    expect(() => guard.reserveNewEvents(
      [event],
      301_002,
      Symbol("third request")
    )).toThrowError(expect.objectContaining({ statusCode: 409 }))
  })

  test("does not expire a pending reservation while its owner is in flight", () => {
    const guard = new ObservabilityIntakeGuard()
    const event = { event_id: intakeEventId }
    const owner = Symbol("in-flight request")

    expect(guard.reserveNewEvents([event], 0, owner)).toEqual([event])
    expect(() => guard.reserveNewEvents(
      [event],
      300_001,
      Symbol("late overlap")
    )).toThrowError(expect.objectContaining({ statusCode: 409 }))
    guard.release([event.event_id], owner)
    expect(guard.reserveNewEvents([event], 300_002, Symbol("retry")))
      .toEqual([event])
  })

  test("keeps mixed pending overlaps atomic and capacity owner-safe", () => {
    const guard = new ObservabilityIntakeGuard(3)
    const first = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd81" }
    const second = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd82" }
    const third = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd83" }
    const firstOwner = Symbol("first")
    const secondOwner = Symbol("second")

    expect(guard.reserveNewEvents([first], 1_000, firstOwner)).toEqual([first])
    guard.accept([first.event_id], firstOwner, 1_000)
    expect(guard.reserveNewEvents([second], 1_001, secondOwner)).toEqual([second])
    expect(() => guard.reserveNewEvents(
      [first, second, third],
      1_002,
      Symbol("mixed request")
    )).toThrowError(expect.objectContaining({ statusCode: 409 }))
    const thirdOwner = Symbol("third")
    expect(guard.reserveNewEvents([third], 1_003, thirdOwner)).toEqual([third])
    const fourth = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd84" }
    expect(guard.reserveNewEvents(
      [fourth],
      1_004,
      Symbol("accepted eviction")
    )).toEqual([fourth])
    expect(() => guard.reserveNewEvents(
      [{ event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd85" }],
      1_005,
      Symbol("all pending capacity")
    )).toThrowError(expect.objectContaining({ statusCode: 409 }))

    guard.release([first.event_id], firstOwner)
    expect(() => guard.reserveNewEvents(
      [third],
      1_006,
      Symbol("third overlap")
    )).toThrowError(expect.objectContaining({ statusCode: 409 }))
  })

  test("protects an accepted duplicate in the current batch from capacity eviction", () => {
    const guard = new ObservabilityIntakeGuard(2)
    const first = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd81" }
    const second = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd82" }
    const third = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd83" }
    const firstOwner = Symbol("first")
    const secondOwner = Symbol("second")

    expect(guard.reserveNewEvents([first], 1_000, firstOwner)).toEqual([first])
    guard.accept([first.event_id], firstOwner, 1_000)
    expect(guard.reserveNewEvents([second], 1_001, secondOwner)).toEqual([second])
    guard.accept([second.event_id], secondOwner, 1_001)
    expect(guard.reserveNewEvents([first, third], 1_002, Symbol("mixed"))).toEqual([third])
    expect(guard.reserveNewEvents([first], 1_003, Symbol("first replay"))).toEqual([])
  })

  test("evicts the oldest acceptance when a delayed owner succeeds last", () => {
    const guard = new ObservabilityIntakeGuard(2)
    const delayed = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd81" }
    const older = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd82" }
    const next = { event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd83" }
    const delayedOwner = Symbol("delayed")
    const olderOwner = Symbol("older")

    expect(guard.reserveNewEvents([delayed], 0, delayedOwner)).toEqual([delayed])
    expect(guard.reserveNewEvents([older], 1, olderOwner)).toEqual([older])
    guard.accept([older.event_id], olderOwner, 1)
    guard.accept([delayed.event_id], delayedOwner, 100)

    expect(guard.reserveNewEvents([next], 101, Symbol("capacity pressure")))
      .toEqual([next])
    expect(guard.reserveNewEvents([delayed], 102, Symbol("fresh replay")))
      .toEqual([])
  })

  test("makes overlapping delivery retryable until the exact owner settles", async () => {
    const guard = new ObservabilityIntakeGuard()
    let now = 0
    let settleFirst: ((response: Response) => void) | undefined
    const firstResponse = new Promise<Response>(resolve => {
      settleFirst = resolve
    })
    const fetchImplementation = vi.fn<typeof globalThis.fetch>()
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValueOnce(acceptedResponse())
    const options = {
      fetch: fetchImplementation,
      guard,
      now: () => now
    }

    const firstDelivery = handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )
    await vi.waitFor(() => expect(fetchImplementation).toHaveBeenCalledOnce())
    now = 300_001
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).rejects.toMatchObject({ statusCode: 409 })
    expect(fetchImplementation).toHaveBeenCalledOnce()

    settleFirst?.(new Response(null, { status: 503 }))
    await expect(firstDelivery).rejects.toMatchObject({ statusCode: 503 })
    now = 300_002
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 1 })
    expect(fetchImplementation).toHaveBeenCalledTimes(2)
  })

  test("times out a non-cooperative upstream and releases its pending owner", async () => {
    vi.useFakeTimers()
    try {
      const signals: AbortSignal[] = []
      let rejectLate: ((reason?: unknown) => void) | undefined
      const fetchImplementation = vi.fn<typeof globalThis.fetch>()
        .mockImplementationOnce((_target, init) => {
          if (init?.signal) signals.push(init.signal)
          return new Promise<Response>((_resolve, reject) => {
            rejectLate = reject
          })
        })
        .mockResolvedValueOnce(acceptedResponse())
      const options = {
        fetch: fetchImplementation,
        fetchTimeoutMs: 50,
        guard: new ObservabilityIntakeGuard(),
        now: () => 1_000
      }

      const timedOut = handleObservabilityIntake(
        intakeRequest(),
        intakeConfig,
        options
      )
      const timeoutFailure = expect(timedOut).rejects.toMatchObject({ statusCode: 502 })
      await vi.advanceTimersByTimeAsync(49)
      expect(signals[0]?.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await timeoutFailure
      expect(signals[0]?.aborted).toBe(true)

      await expect(handleObservabilityIntake(
        intakeRequest(),
        intakeConfig,
        options
      )).resolves.toEqual({ accepted: 1 })
      expect(fetchImplementation).toHaveBeenCalledTimes(2)
      rejectLate?.(new Error("late upstream rejection"))
      await Promise.resolve()
      await expect(handleObservabilityIntake(
        intakeRequest(),
        intakeConfig,
        options
      )).resolves.toEqual({ accepted: 0 })
      expect(fetchImplementation).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  test("times out a stalled upstream response body and releases its owner", async () => {
    vi.useFakeTimers()
    try {
      const signals: AbortSignal[] = []
      const fetchImplementation = vi.fn<typeof globalThis.fetch>()
        .mockImplementationOnce((_target, init) => {
          if (init?.signal) signals.push(init.signal)
          return Promise.resolve(new Response(new ReadableStream({
            start(controller) {
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode(JSON.stringify({ accepted: 1 })))
                controller.close()
              }, 51)
            }
          }), {
            status: 202,
            headers: { "content-type": "application/json" }
          }))
        })
        .mockResolvedValueOnce(acceptedResponse())
      const options = {
        fetch: fetchImplementation,
        fetchTimeoutMs: 50,
        guard: new ObservabilityIntakeGuard(),
        now: () => 1_000
      }

      const stalled = handleObservabilityIntake(
        intakeRequest(),
        intakeConfig,
        options
      )
      const timeoutFailure = expect(stalled).rejects.toMatchObject({ statusCode: 502 })
      await vi.advanceTimersByTimeAsync(51)
      await timeoutFailure
      expect(signals[0]?.aborted).toBe(true)

      await expect(handleObservabilityIntake(
        intakeRequest(),
        intakeConfig,
        options
      )).resolves.toEqual({ accepted: 1 })
      expect(fetchImplementation).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  test("suppresses later duplicates only after the pending owner succeeds", async () => {
    const guard = new ObservabilityIntakeGuard()
    let settleFirst: ((response: Response) => void) | undefined
    const fetchImplementation = vi.fn<typeof globalThis.fetch>()
      .mockReturnValueOnce(new Promise<Response>(resolve => {
        settleFirst = resolve
      }))
    const options = {
      fetch: fetchImplementation,
      guard,
      now: () => 1_000
    }

    const firstDelivery = handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )
    await vi.waitFor(() => expect(fetchImplementation).toHaveBeenCalledOnce())
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).rejects.toMatchObject({ statusCode: 409 })
    settleFirst?.(acceptedResponse())
    await expect(firstDelivery).resolves.toEqual({ accepted: 1 })
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 0 })
    expect(fetchImplementation).toHaveBeenCalledOnce()
  })

  test("starts the replay window when a delayed pending owner succeeds", async () => {
    let now = 0
    let settleFirst: ((response: Response) => void) | undefined
    const fetchImplementation = vi.fn<typeof globalThis.fetch>()
      .mockReturnValueOnce(new Promise<Response>(resolve => {
        settleFirst = resolve
      }))
      .mockResolvedValueOnce(acceptedResponse())
    const options = {
      fetch: fetchImplementation,
      guard: new ObservabilityIntakeGuard(),
      now: () => now
    }

    const firstDelivery = handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )
    await vi.waitFor(() => expect(fetchImplementation).toHaveBeenCalledOnce())
    now = 300_001
    settleFirst?.(acceptedResponse())
    await expect(firstDelivery).resolves.toEqual({ accepted: 1 })

    now = 300_002
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 0 })
    expect(fetchImplementation).toHaveBeenCalledOnce()

    now = 600_002
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 1 })
    expect(fetchImplementation).toHaveBeenCalledTimes(2)
  })

  test("commits an upstream conflict as accepted without another delivery", async () => {
    const guard = new ObservabilityIntakeGuard()
    const fetchImplementation = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
    const options = {
      fetch: fetchImplementation,
      guard,
      now: () => 1_000
    }

    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 0 })
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 0 })
    expect(fetchImplementation).toHaveBeenCalledOnce()
  })

  test("recovers a multi-event batch when the accepted response was lost", async () => {
    const secondEventId = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e"
    const acceptedIds = new Set<string>()
    const emittedIds: string[] = []
    let loseAcceptedResponse = true
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(async (_target, init) => {
      const forwarded = (JSON.parse(String(init?.body)) as {
        events: Array<{ event_id: string }>
      }).events
      if (forwarded.some(event => acceptedIds.has(event.event_id))) {
        return new Response(null, { status: 409 })
      }
      for (const event of forwarded) {
        acceptedIds.add(event.event_id)
        emittedIds.push(event.event_id)
      }
      if (loseAcceptedResponse) {
        loseAcceptedResponse = false
        throw new Error("accepted response lost")
      }
      return acceptedResponse(forwarded.length)
    })
    const options = {
      fetch: fetchImplementation,
      guard: new ObservabilityIntakeGuard(),
      now: () => 1_000
    }
    const body = JSON.stringify({
      events: [
        hydrationIntakeEvent(),
        hydrationIntakeEvent({ event_id: secondEventId })
      ]
    })

    await expect(handleObservabilityIntake(
      intakeRequestWithBody(body),
      intakeConfig,
      options
    )).rejects.toMatchObject({ statusCode: 502 })
    await expect(handleObservabilityIntake(
      intakeRequestWithBody(body),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 0 })
    await expect(handleObservabilityIntake(
      intakeRequestWithBody(body),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 0 })
    expect(emittedIds).toEqual([intakeEventId, secondEventId])
    expect(fetchImplementation).toHaveBeenCalledTimes(4)
  })

  test("recovers unseen events individually after a mixed replay conflict", async () => {
    const secondEventId = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e"
    const acceptedIds = new Set([intakeEventId])
    const emittedIds: string[] = []
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(async (_target, init) => {
      const forwarded = (JSON.parse(String(init?.body)) as {
        events: Array<{ event_id: string }>
      }).events
      if (forwarded.some(event => acceptedIds.has(event.event_id))) {
        return new Response(null, { status: 409 })
      }
      for (const event of forwarded) {
        acceptedIds.add(event.event_id)
        emittedIds.push(event.event_id)
      }
      return acceptedResponse(forwarded.length)
    })
    const options = {
      fetch: fetchImplementation,
      guard: new ObservabilityIntakeGuard(),
      now: () => 1_000
    }
    const body = JSON.stringify({
      events: [
        hydrationIntakeEvent(),
        hydrationIntakeEvent({ event_id: secondEventId })
      ]
    })

    await expect(handleObservabilityIntake(
      intakeRequestWithBody(body),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 1 })
    await expect(handleObservabilityIntake(
      intakeRequestWithBody(body),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 0 })
    expect(emittedIds).toEqual([secondEventId])
    expect(fetchImplementation).toHaveBeenCalledTimes(3)
  })

  test.each([
    ["invalid JSON", "not-json"],
    ["null body", "null"],
    ["array body", JSON.stringify([{ accepted: 1 }])],
    ["missing count", JSON.stringify({})],
    ["string count", JSON.stringify({ accepted: "1" })],
    ["negative count", JSON.stringify({ accepted: -1 })],
    ["fractional count", JSON.stringify({ accepted: 0.5 })],
    ["too-large count", JSON.stringify({ accepted: 2 })],
    ["unsafe count", JSON.stringify({ accepted: Number.MAX_SAFE_INTEGER + 1 })],
    ["extra field", JSON.stringify({ accepted: 1, status: "accepted" })]
  ])("releases a successful owner for an upstream %s response", async (_case, body) => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(body, { status: 202 }))
      .mockResolvedValueOnce(acceptedResponse())
    const options = {
      fetch: fetchImplementation,
      guard: new ObservabilityIntakeGuard(),
      now: () => 1_000
    }

    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).rejects.toMatchObject({ statusCode: 502 })
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 1 })
    expect(fetchImplementation).toHaveBeenCalledTimes(2)
  })

  test("commits a complete upstream accepted count", async () => {
    const fetchImplementation = vi.fn(async () => acceptedResponse(1))
    const options = {
      fetch: fetchImplementation,
      guard: new ObservabilityIntakeGuard(),
      now: () => 1_000
    }
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 1 })
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 0 })
    expect(fetchImplementation).toHaveBeenCalledOnce()
  })

  test("releases a partially accepted batch so every event remains retryable", async () => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(acceptedResponse(1))
      .mockResolvedValueOnce(acceptedResponse(2))
    const options = {
      fetch: fetchImplementation,
      guard: new ObservabilityIntakeGuard(),
      now: () => 1_000
    }
    const body = JSON.stringify({
      events: [
        hydrationIntakeEvent(),
        hydrationIntakeEvent({ event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e" })
      ]
    })

    await expect(handleObservabilityIntake(
      intakeRequestWithBody(body),
      intakeConfig,
      options
    )).rejects.toMatchObject({ statusCode: 502 })
    await expect(handleObservabilityIntake(
      intakeRequestWithBody(body),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 2 })
    expect(fetchImplementation).toHaveBeenCalledTimes(2)
  })

  test("releases event IDs when trusted event transformation fails", async () => {
    const resolveCorrelation = vi.fn()
      .mockImplementationOnce(() => {
        throw new Error("correlation resolver failed")
      })
      .mockReturnValue(null)
    const fetchImplementation = vi.fn(async () => acceptedResponse())
    const options = {
      fetch: fetchImplementation,
      guard: new ObservabilityIntakeGuard(),
      now: () => 1_000,
      resolveCorrelation
    }

    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).rejects.toThrow("correlation resolver failed")
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 1 })
    expect(resolveCorrelation).toHaveBeenCalledTimes(2)
    expect(fetchImplementation).toHaveBeenCalledOnce()
  })

  test.each([
    [400, 502],
    [401, 502],
    [404, 502],
    [413, 422],
    [415, 422],
    [422, 422],
    [500, 502],
    [503, 503]
  ])("maps upstream status %i to retry-safe %i and releases its reservation", async (
    upstreamStatus,
    intakeStatus
  ) => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: upstreamStatus }))
      .mockResolvedValueOnce(acceptedResponse())
    const options = {
      fetch: fetchImplementation,
      guard: new ObservabilityIntakeGuard(),
      now: () => 1_000
    }

    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).rejects.toMatchObject({ statusCode: intakeStatus })
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 1 })
    expect(fetchImplementation).toHaveBeenCalledTimes(2)
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
