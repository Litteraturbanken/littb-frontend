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
    guard.accept([event.event_id], retryOwner)
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
    guard.accept([event.event_id], oldOwner)
    expect(guard.reserveNewEvents([event], 301_001, newOwner)).toEqual([event])
    guard.release([event.event_id], oldOwner)
    guard.accept([event.event_id], oldOwner)

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
    guard.accept([first.event_id], firstOwner)
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
    await expect(firstDelivery).rejects.toMatchObject({ statusCode: 502 })
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

  test.each([0, 1])("commits a valid upstream accepted count of %i", async accepted => {
    const fetchImplementation = vi.fn(async () => acceptedResponse(accepted))
    const options = {
      fetch: fetchImplementation,
      guard: new ObservabilityIntakeGuard(),
      now: () => 1_000
    }
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted })
    await expect(handleObservabilityIntake(
      intakeRequest(),
      intakeConfig,
      options
    )).resolves.toEqual({ accepted: 0 })
    expect(fetchImplementation).toHaveBeenCalledOnce()
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
