import { describe, expect, test, vi } from "vitest"

import {
  BrowserObservabilityReporter,
  classifyBrowserError,
  createBrowserErrorEvent,
  type BrowserEvent
} from "../../app/lib/observability/browser"

const GIT_SHA = "a".repeat(40)

function reporterOptions(overrides: Record<string, unknown> = {}) {
  return {
    endpoint: "/_observability/events",
    environment: "stage" as const,
    deploymentGitSha: GIT_SHA,
    route: () => "/sök",
    autoFlush: false,
    ...overrides
  }
}

async function enqueueNumberedEvents(
  reporter: BrowserObservabilityReporter,
  count: number
): Promise<string[]> {
  const eventIds: string[] = []
  for (let index = 0; index < count; index += 1) {
    const eventId = `018f47c0-4d5b-7a62-8f41-${String(index).padStart(12, "0")}`
    eventIds.push(eventId)
    reporter.enqueue(await createBrowserErrorEvent({
      eventName: "browser.error",
      error: new Error(`discarded-${index}`),
      component: `Component${index}`,
      resourceKind: "unknown",
      route: "/bibliotek",
      environment: "stage",
      deploymentGitSha: GIT_SHA,
      randomUUID: () => eventId
    }))
  }
  return eventIds
}

async function beaconBodies(beacon: ReturnType<typeof vi.fn>): Promise<string[][]> {
  return await Promise.all(beacon.mock.calls.map(async call => (
    JSON.parse(await (call[1] as Blob).text()).events.map(
      (event: { event_id: string }) => event.event_id
    )
  )))
}

function fetchBodies(fetchMock: ReturnType<typeof vi.fn>): string[][] {
  return fetchMock.mock.calls.map(call => (
    JSON.parse(String(call[1]?.body)).events.map(
      (event: { event_id: string }) => event.event_id
    )
  ))
}

describe("browser event normalization", () => {
  test("classifies chunk-loading failures without retaining their message", () => {
    expect(classifyBrowserError(
      new Error("Failed to fetch dynamically imported module: https://example.test/private?q=secret")
    )).toBe("browser.chunk_error")
    expect(classifyBrowserError(new TypeError("ordinary failure")))
      .toBe("browser.error")
  })

  test("creates a generated-contract event with no raw error, URL, or query", async () => {
    const event = await createBrowserErrorEvent({
      eventName: "browser.error",
      error: new TypeError(
        "kyrka https://example.test/sök?fras=kyrka selected secret"
      ),
      component: "SearchResults",
      resourceKind: "script",
      route: "/sök",
      environment: "stage",
      deploymentGitSha: GIT_SHA
    })

    expect(event).toMatchObject({
      schema_version: "lb.observability.v1",
      event_name: "browser.error",
      event_kind: "error",
      producer: "browser",
      environment: "stage",
      route: "/sök",
      error_type: "TypeError",
      attributes: {
        component: "SearchResults",
        resource_kind: "script"
      }
    })
    expect(event.error_fingerprint).toMatch(/^[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(event)
    for (const privateValue of [
      "kyrka",
      "selected secret",
      "example.test",
      "?fras=",
      "stack",
      "message",
      "cookie",
      "user-agent"
    ]) {
      expect(serialized.toLowerCase()).not.toContain(privateValue)
    }
  })

  test("drops unsafe route and component values rather than cleaning user data", async () => {
    const event = await createBrowserErrorEvent({
      eventName: "browser.error",
      error: "secret rejection value",
      component: "component with private words",
      resourceKind: "unknown",
      route: "/sök?fras=private",
      environment: "production",
      deploymentGitSha: GIT_SHA
    })

    expect(event.route).toBeNull()
    expect(event.attributes.component).toBeNull()
    expect(JSON.stringify(event)).not.toContain("private")
    expect(JSON.stringify(event)).not.toContain("secret rejection")
  })
})

describe("browser event delivery", () => {
  test("deduplicates equivalent failures inside its bounded window", async () => {
    const deliveries: string[] = []
    const reporter = new BrowserObservabilityReporter(reporterOptions({
      fetch: vi.fn(async (_url: string, init: RequestInit) => {
        deliveries.push(String(init.body))
        return new Response(JSON.stringify({ accepted: 1 }), { status: 202 })
      })
    }))

    await reporter.capture(new TypeError("first private message"))
    await reporter.capture(new TypeError("different private message"))
    await reporter.flush()

    expect(deliveries).toHaveLength(1)
    const body = JSON.parse(deliveries[0])
    expect(body.events).toHaveLength(1)
    expect(body.events[0]).toEqual({
      event_id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      event_name: "browser.error",
      error_type: "TypeError",
      resource_kind: "unknown",
      correlation_token: null
    })
    expect(deliveries[0]).not.toContain("deployment_git_sha")
    expect(deliveries[0]).not.toContain("timestamp")
  })

  test("serializes an explicitly undefined correlation token as required null", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock }))

    await reporter.capture(new Error("private"), { correlationToken: undefined })
    await reporter.flush()

    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(sent.events[0]).toHaveProperty("correlation_token", null)
  })

  test("normalizes an explicitly undefined enqueue token as required null", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock }))
    const event = await createBrowserErrorEvent({
      eventName: "browser.error",
      error: new Error("private"),
      environment: "stage",
      deploymentGitSha: GIT_SHA
    })

    reporter.enqueue(event, undefined as unknown as null)
    await reporter.flush()

    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(sent.events[0]).toHaveProperty("correlation_token", null)
  })

  test("reserves a captured event synchronously before asynchronous hashing can finish", async () => {
    const digest = vi.spyOn(globalThis.crypto.subtle, "digest")
    const beacon = vi.fn(() => true)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ beacon }))

    const capture = reporter.capture(new Error("private"))
    const exitFlush = reporter.flush(true)

    expect(beacon).toHaveBeenCalledOnce()
    await Promise.all([capture, exitFlush])
    expect(digest).not.toHaveBeenCalled()
    digest.mockRestore()
  })

  test("retains equivalent enqueued failures with distinct correlation tokens", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock }))
    const firstToken = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e"
    const secondToken = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8f"
    const event = await createBrowserErrorEvent({
      eventName: "browser.error",
      error: new Error("private"),
      environment: "stage",
      deploymentGitSha: GIT_SHA,
      randomUUID: () => "018f47c0-4d5b-7a62-8f41-a04b5df3fd80"
    })

    reporter.enqueue(event, firstToken)
    reporter.enqueue({
      ...event,
      event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd81"
    }, secondToken)
    await reporter.flush()

    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(sent.events.map((event: { correlation_token: string }) => event.correlation_token))
      .toEqual([firstToken, secondToken])
  })

  test("still deduplicates equivalent API failures with the same correlation token", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock }))
    const token = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e"

    await reporter.capture(new Error("first private message"), { correlationToken: token })
    await reporter.capture(new Error("second private message"), { correlationToken: token })
    await reporter.flush()

    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(sent.events).toHaveLength(1)
    expect(sent.events[0].correlation_token).toBe(token)
  })

  test.each(["capture-first", "enqueue-first"])(
    "deduplicates equivalent capture and enqueue events with the same token: %s",
    async order => {
      const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
      const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock }))
      const token = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e"
      const event = await createBrowserErrorEvent({
        eventName: "browser.error",
        error: new Error("private"),
        route: "/sök",
        environment: "stage",
        deploymentGitSha: GIT_SHA
      })
      const capture = () => reporter.capture(new Error("different private message"), {
        correlationToken: token
      })
      const enqueue = () => reporter.enqueue(event, token)

      if (order === "capture-first") {
        await capture()
        enqueue()
      } else {
        enqueue()
        await capture()
      }
      await reporter.flush()

      const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
      expect(sent.events).toHaveLength(1)
    }
  )

  test("caps each batch at ten events and retains the remainder", async () => {
    const sizes: number[] = []
    const reporter = new BrowserObservabilityReporter(reporterOptions({
      fetch: vi.fn(async (_url: string, init: RequestInit) => {
        sizes.push(JSON.parse(String(init.body)).events.length)
        return new Response(JSON.stringify({ accepted: 10 }), { status: 202 })
      })
    }))
    for (let index = 0; index < 12; index += 1) {
      reporter.enqueue(await createBrowserErrorEvent({
        eventName: "browser.error",
        error: new Error(`discarded-${index}`),
        component: `Component${index}`,
        resourceKind: "unknown",
        route: "/bibliotek",
        environment: "stage",
        deploymentGitSha: GIT_SHA
      }))
    }

    await reporter.flush()
    await reporter.flush()

    expect(sizes).toEqual([10, 2])
  })

  test("accepts an equivalent event after its unsent queue record is evicted", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock }))
    const first = await createBrowserErrorEvent({
      eventName: "browser.error",
      error: new Error("discarded-first"),
      component: "EvictedComponent",
      resourceKind: "unknown",
      route: "/bibliotek",
      environment: "stage",
      deploymentGitSha: GIT_SHA,
      randomUUID: () => "018f47c0-4d5b-7a62-8f41-000000000000"
    })
    reporter.enqueue(first)
    const fillerIds = await enqueueNumberedEvents(reporter, 50)
    const replacementId = "018f47c0-4d5b-7a62-8f41-999999999999"
    reporter.enqueue({ ...first, event_id: replacementId })

    for (let index = 0; index < 5; index += 1) await reporter.flush()

    expect(fetchBodies(fetchMock).flat()).toEqual([
      ...fillerIds.slice(1),
      replacementId
    ])
  })

  test("does not let an old evicted generation clear a newer dedup marker", async () => {
    let now = 0
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    const reporter = new BrowserObservabilityReporter(reporterOptions({
      fetch: fetchMock,
      nowMs: () => now
    }))
    const first = await createBrowserErrorEvent({
      eventName: "browser.error",
      error: new Error("discarded-first"),
      component: "GenerationComponent",
      resourceKind: "unknown",
      route: "/bibliotek",
      environment: "stage",
      deploymentGitSha: GIT_SHA,
      randomUUID: () => "018f47c0-4d5b-7a62-8f41-100000000000"
    })
    reporter.enqueue(first)
    now = 60_001
    const secondId = "018f47c0-4d5b-7a62-8f41-100000000001"
    reporter.enqueue({ ...first, event_id: secondId })
    await enqueueNumberedEvents(reporter, 49)
    reporter.enqueue({
      ...first,
      event_id: "018f47c0-4d5b-7a62-8f41-100000000002"
    })

    for (let index = 0; index < 5; index += 1) await reporter.flush()

    const delivered = fetchBodies(fetchMock).flat()
    expect(delivered.filter(eventId => eventId.startsWith(
      "018f47c0-4d5b-7a62-8f41-10000000000"
    ))).toEqual([secondId])
    expect(delivered).toHaveLength(50)
  })

  test("strips non-intake fields before delivery", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    const reporter = new BrowserObservabilityReporter(reporterOptions({
      fetch: fetchMock
    }))
    const valid = await createBrowserErrorEvent({
      eventName: "browser.error",
      error: new Error("discarded"),
      component: "SafeComponent",
      resourceKind: "unknown",
      route: "/bibliotek",
      environment: "stage",
      deploymentGitSha: GIT_SHA
    })
    const oversized = {
      ...valid,
      event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d",
      attributes: { ...valid.attributes, component: "x".repeat(20_000) }
    } as BrowserEvent

    reporter.enqueue(
      oversized,
      "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e"
    )
    await reporter.flush()

    expect(fetchMock).toHaveBeenCalledOnce()
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(sent.events[0]).toEqual({
      event_id: oversized.event_id,
      event_name: "browser.error",
      error_type: "Error",
      resource_kind: "unknown",
      correlation_token: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e"
    })
    expect(JSON.stringify(sent)).not.toContain("x".repeat(100))
  })

  test("uses beacon on page exit and falls back to isolated keepalive fetch", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline")
    })
    const beacon = vi.fn(() => false)
    const reporter = new BrowserObservabilityReporter(reporterOptions({
      fetch: fetchMock,
      beacon
    }))
    await reporter.capture(new Error("private"))

    await expect(reporter.flush(true)).resolves.toBeUndefined()

    expect(beacon).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" }
    })
  })

  test("does not fetch after a successful beacon", async () => {
    const fetchMock = vi.fn()
    const beacon = vi.fn(() => true)
    const reporter = new BrowserObservabilityReporter(reporterOptions({
      fetch: fetchMock,
      beacon
    }))
    await reporter.capture(new Error("private"))

    await reporter.flush(true)

    expect(beacon).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test.each(["missing", "non-function", "throwing getter"])(
    "falls back without losing the batch when default sendBeacon is %s",
    async failure => {
      const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator")
      try {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          ...(failure === "throwing getter"
            ? { get: () => { throw new Error("navigator unavailable") } }
            : { value: failure === "missing" ? undefined : { sendBeacon: "not callable" } })
        })
        const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
        const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock }))
        const eventIds = await enqueueNumberedEvents(reporter, 23)

        await expect(reporter.flush(true)).resolves.toBeUndefined()

        expect(fetchBodies(fetchMock)).toEqual([
          eventIds.slice(0, 10),
          eventIds.slice(10, 20),
          eventIds.slice(20)
        ])
      } finally {
        if (originalNavigator) {
          Object.defineProperty(globalThis, "navigator", originalNavigator)
        } else {
          Reflect.deleteProperty(globalThis, "navigator")
        }
      }
    }
  )

  test.each([11, 23])(
    "drains all %i queued page-exit events through ordered beacon batches",
    async count => {
      const fetchMock = vi.fn()
      const beacon = vi.fn(() => true)
      const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
      const eventIds = await enqueueNumberedEvents(reporter, count)

      const exitFlush = reporter.flush(true)
      expect(beacon).toHaveBeenCalledTimes(Math.ceil(count / 10))

      expect(await beaconBodies(beacon)).toEqual(Array.from(
        { length: Math.ceil(count / 10) },
        (_, batchIndex) => Array.from(
          { length: Math.min(10, count - batchIndex * 10) },
          (_, eventIndex) => eventIds[batchIndex * 10 + eventIndex]
        )
      ))
      await exitFlush
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  test("initiates every budget-fitting exit fallback before yielding", async () => {
    const releases: Array<() => void> = []
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
      releases.push(() => resolve(new Response(null, { status: 202 })))
    }))
    const beacon = vi.fn(() => false)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const eventIds = await enqueueNumberedEvents(reporter, 23)

    const exitFlush = reporter.flush(true)

    expect(fetchBodies(fetchMock)).toEqual([
      eventIds.slice(0, 10),
      eventIds.slice(10, 20),
      eventIds.slice(20)
    ])
    for (const release of releases) release()
    await exitFlush
  })

  test("reconciles out-of-order fallback failures ahead of concurrent events", async () => {
    vi.useFakeTimers()
    try {
      const releases: Array<(status: number) => void> = []
      const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
        releases.push(status => resolve(new Response(null, { status })))
      }))
      const beacon = vi.fn(() => false)
      const reporter = new BrowserObservabilityReporter(reporterOptions({
        fetch: fetchMock,
        beacon,
        autoFlush: true
      }))
      const eventIds = await enqueueNumberedEvents(reporter, 23)

      const firstExitFlush = reporter.flush(true)
      const secondExitFlush = reporter.flush(true)
      expect(fetchBodies(fetchMock)).toEqual([
        eventIds.slice(0, 10),
        eventIds.slice(10, 20),
        eventIds.slice(20)
      ])
      const concurrent = await createBrowserErrorEvent({
        eventName: "browser.error",
        error: new Error("discarded-concurrent"),
        component: "ConcurrentComponent",
        resourceKind: "unknown",
        route: "/bibliotek",
        environment: "stage",
        deploymentGitSha: GIT_SHA,
        randomUUID: () => "018f47c0-4d5b-7a62-8f41-999999999997"
      })
      reporter.enqueue(concurrent)
      releases[2]?.(503)
      releases[1]?.(202)
      releases[0]?.(503)
      await Promise.all([firstExitFlush, secondExitFlush])

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(vi.getTimerCount()).toBe(1)
      fetchMock.mockResolvedValue(new Response(null, { status: 202 }))
      await reporter.flush()
      await reporter.flush()
      await reporter.flush()
      expect(fetchBodies(fetchMock).slice(3).flat()).toEqual([
        ...eventIds.slice(0, 10),
        ...eventIds.slice(20),
        concurrent.event_id
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  test("keeps the complete page-exit beacon drain below its explicit byte budget", async () => {
    const beacon = vi.fn(() => true)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ beacon }))
    const eventIds = await enqueueNumberedEvents(reporter, 50)

    await reporter.flush(true)

    expect(beacon).toHaveBeenCalledTimes(5)
    expect(beacon.mock.calls.reduce(
      (total, call) => total + (call[1] as Blob).size,
      0
    )).toBeLessThanOrEqual(60 * 1024)
    expect((await beaconBodies(beacon)).flat()).toEqual(eventIds)
  })

  test("stops before a fallback and later beacon bodies exceed the exit byte budget", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    let call = 0
    const beacon = vi.fn(() => ++call !== 1)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const eventIds: string[] = []
    for (let index = 0; index < 6; index += 1) {
      const eventId = `018f47c0-4d5b-7a62-8f41-${String(index).padStart(12, "0")}`
      const event = await createBrowserErrorEvent({
        eventName: "browser.error",
        error: new Error(`discarded-${index}`),
        component: `Budget${index}`,
        resourceKind: "unknown",
        route: "/bibliotek",
        environment: "stage",
        deploymentGitSha: GIT_SHA,
        randomUUID: () => eventId
      })
      eventIds.push(eventId)
      reporter.enqueue({ ...event, error_type: "E".repeat(13_000) } as BrowserEvent)
    }

    await reporter.flush(true)

    expect((await beaconBodies(beacon)).flat()).toEqual(eventIds.slice(0, 4))
    expect(String(fetchMock.mock.calls[0]?.[1]?.body).length + beacon.mock.calls.slice(1).reduce(
      (total, beaconCall) => total + (beaconCall[1] as Blob).size,
      0
    )).toBeLessThanOrEqual(60 * 1024)

    await reporter.flush(true)
    expect((await beaconBodies(beacon)).flat()).toEqual(eventIds)
  })

  test.each([
    ["first", 1],
    ["middle", 2]
  ] as const)(
    "continues the page-exit drain after the %s beacon batch uses a successful fallback",
    async (_position, failedCall) => {
      vi.useFakeTimers()
      try {
        const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
        let call = 0
        const beacon = vi.fn(() => {
          call += 1
          return call !== failedCall
        })
        const reporter = new BrowserObservabilityReporter(reporterOptions({
          fetch: fetchMock,
          beacon,
          autoFlush: true
        }))
        const eventIds = await enqueueNumberedEvents(reporter, 23)

        await reporter.flush(true)

        expect((await beaconBodies(beacon)).flat()).toEqual(eventIds)
        expect(fetchBodies(fetchMock)).toEqual([
          eventIds.slice((failedCall - 1) * 10, failedCall * 10)
        ])
        expect(vi.getTimerCount()).toBe(0)
      } finally {
        vi.useRealTimers()
      }
    }
  )

  test("continues the page-exit drain after a thrown beacon uses a successful fallback", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    let call = 0
    const beacon = vi.fn(() => {
      call += 1
      if (call === 2) throw new Error("beacon unavailable")
      return true
    })
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const eventIds = await enqueueNumberedEvents(reporter, 23)

    await reporter.flush(true)

    expect((await beaconBodies(beacon)).flat()).toEqual(eventIds)
    expect(fetchBodies(fetchMock)).toEqual([eventIds.slice(10, 20)])
  })

  test("initiates the remaining exit transports before awaiting fallback success", async () => {
    let releaseFallback: (() => void) | undefined
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
      releaseFallback = () => resolve(new Response(null, { status: 202 }))
    }))
    let call = 0
    const beacon = vi.fn(() => ++call !== 1)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const eventIds = await enqueueNumberedEvents(reporter, 23)

    const exitFlush = reporter.flush(true)
    expect(await beaconBodies(beacon)).toEqual([
      eventIds.slice(0, 10),
      eventIds.slice(10, 20),
      eventIds.slice(20)
    ])
    expect(fetchBodies(fetchMock)).toEqual([eventIds.slice(0, 10)])

    releaseFallback?.()
    await exitFlush

    expect((await beaconBodies(beacon)).flat()).toEqual(eventIds)
  })

  test("requeues only a page-exit batch whose beacon and fallback both fail", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
    let call = 0
    const beacon = vi.fn(() => ++call !== 2)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const eventIds = await enqueueNumberedEvents(reporter, 21)

    await reporter.flush(true)
    await reporter.flush()
    await reporter.flush()
    await reporter.flush()

    expect(fetchBodies(fetchMock)).toEqual([
      eventIds.slice(10, 20),
      eventIds.slice(10, 20)
    ])
  })

  test("page exit synchronously drains the tail around an in-flight normal flush", async () => {
    vi.useFakeTimers()
    try {
      let releaseFetch: (() => void) | undefined
      const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
        releaseFetch = () => resolve(new Response(null, { status: 202 }))
      }))
      const beacon = vi.fn(() => true)
      const reporter = new BrowserObservabilityReporter(reporterOptions({
        fetch: fetchMock,
        beacon,
        autoFlush: true
      }))
      const eventIds = await enqueueNumberedEvents(reporter, 21)

      const normalFlush = reporter.flush()
      const exitFlush = reporter.flush(true)
      expect(await beaconBodies(beacon)).toEqual([
        eventIds.slice(10, 20),
        eventIds.slice(20)
      ])
      releaseFetch?.()
      await Promise.all([normalFlush, exitFlush])
      await vi.advanceTimersByTimeAsync(1_000)

      expect(fetchBodies(fetchMock)).toEqual([
        eventIds.slice(0, 10)
      ])
      expect(beacon).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  test("deduplicates page-exit calls while an active failure is requeued before its tail", async () => {
    let releaseFetch: (() => void) | undefined
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => {
        releaseFetch = () => resolve(new Response(null, { status: 503 }))
      }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
    const beacon = vi.fn(() => true)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const eventIds = await enqueueNumberedEvents(reporter, 21)

    const normalFlush = reporter.flush()
    const firstExitFlush = reporter.flush(true)
    const secondExitFlush = reporter.flush(true)
    expect((await beaconBodies(beacon)).flat()).toEqual(eventIds.slice(10))
    releaseFetch?.()
    await Promise.all([normalFlush, firstExitFlush, secondExitFlush])

    expect((await beaconBodies(beacon)).flat()).toEqual([
      ...eventIds.slice(10),
      ...eventIds.slice(0, 10)
    ])
    expect(fetchBodies(fetchMock)).toEqual([
      eventIds.slice(0, 10)
    ])
  })

  test.each([408, 425, 429])(
    "exit-drains an active retryable %i response and its tail without a timer",
    async status => {
      vi.useFakeTimers()
      try {
        let releaseFetch: (() => void) | undefined
        const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
          releaseFetch = () => resolve(new Response(null, { status }))
        }))
        const beacon = vi.fn(() => true)
        const reporter = new BrowserObservabilityReporter(reporterOptions({
          fetch: fetchMock,
          beacon,
          autoFlush: true
        }))
        const eventIds = await enqueueNumberedEvents(reporter, 23)

        const normalFlush = reporter.flush()
        const exitFlush = reporter.flush(true)
        expect((await beaconBodies(beacon)).flat()).toEqual(eventIds.slice(10))
        releaseFetch?.()
        await Promise.all([normalFlush, exitFlush])

        expect((await beaconBodies(beacon)).flat()).toEqual([
          ...eventIds.slice(10),
          ...eventIds.slice(0, 10)
        ])
        expect(fetchBodies(fetchMock)).toEqual([eventIds.slice(0, 10)])
        expect(vi.getTimerCount()).toBe(0)
      } finally {
        vi.useRealTimers()
      }
    }
  )

  test("shares the page-exit byte budget between a tail and requeued active head", async () => {
    vi.useFakeTimers()
    try {
      let releaseFetch: (() => void) | undefined
      const fetchMock = vi.fn()
        .mockImplementationOnce(() => new Promise<Response>(resolve => {
          releaseFetch = () => resolve(new Response(null, { status: 503 }))
        }))
        .mockResolvedValueOnce(new Response(null, { status: 202 }))
      const beacon = vi.fn(() => true)
      const reporter = new BrowserObservabilityReporter(reporterOptions({
        fetch: fetchMock,
        beacon,
        autoFlush: true
      }))
      const eventIds: string[] = []
      for (let index = 0; index < 6; index += 1) {
        const eventId = `018f47c0-4d5b-7a62-8f41-${String(index).padStart(12, "0")}`
        const event = await createBrowserErrorEvent({
          eventName: "browser.error",
          error: new Error(`discarded-${index}`),
          component: `Budget${index}`,
          resourceKind: "unknown",
          route: "/bibliotek",
          environment: "stage",
          deploymentGitSha: GIT_SHA,
          randomUUID: () => eventId
        })
        eventIds.push(eventId)
        reporter.enqueue({ ...event, error_type: "E".repeat(13_000) } as BrowserEvent)
      }

      const normalFlush = reporter.flush()
      const firstExitFlush = reporter.flush(true)
      const secondExitFlush = reporter.flush(true)
      releaseFetch?.()
      await Promise.all([normalFlush, firstExitFlush, secondExitFlush])

      expect((await beaconBodies(beacon)).flat()).toEqual(eventIds.slice(1, 4))
      expect(beacon.mock.calls.reduce(
        (total, beaconCall) => total + (beaconCall[1] as Blob).size,
        0
      )).toBeLessThanOrEqual(60 * 1024)
      expect(vi.getTimerCount()).toBe(1)

      await vi.advanceTimersByTimeAsync(1_000)
      expect(fetchBodies(fetchMock).at(-1)).toEqual([eventIds[0]])
    } finally {
      vi.useRealTimers()
    }
  })

  test.each([202, 503])(
    "reserves active keepalive bytes from the exit budget when it settles with %i",
    async status => {
      let releaseFetch: (() => void) | undefined
      const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
        releaseFetch = () => resolve(new Response(null, { status }))
      }))
      const beacon = vi.fn(() => true)
      const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
      const eventIds: string[] = []
      for (let index = 0; index < 6; index += 1) {
        const eventId = `018f47c0-4d5b-7a62-8f41-${String(index).padStart(12, "0")}`
        const event = await createBrowserErrorEvent({
          eventName: "browser.error",
          error: new Error(`discarded-${index}`),
          component: `Budget${index}`,
          resourceKind: "unknown",
          route: "/bibliotek",
          environment: "stage",
          deploymentGitSha: GIT_SHA,
          randomUUID: () => eventId
        })
        eventIds.push(eventId)
        reporter.enqueue({ ...event, error_type: "E".repeat(13_000) } as BrowserEvent)
      }

      const normalFlush = reporter.flush()
      const exitFlush = reporter.flush(true)
      releaseFetch?.()
      await Promise.all([normalFlush, exitFlush])

      const initiatedBytes = String(fetchMock.mock.calls[0]?.[1]?.body).length
        + beacon.mock.calls.reduce(
          (total, beaconCall) => total + (beaconCall[1] as Blob).size,
          0
        )
      expect(initiatedBytes).toBeLessThanOrEqual(60 * 1024)
      expect((await beaconBodies(beacon)).flat()).toEqual(eventIds.slice(1, 4))
    }
  )

  test("charges a blocked tail transport before considering an active retry", async () => {
    vi.useFakeTimers()
    try {
      let releaseActive: (() => void) | undefined
      const fetchMock = vi.fn()
        .mockImplementationOnce(() => new Promise<Response>(resolve => {
          releaseActive = () => resolve(new Response(null, { status: 503 }))
        }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValue(new Response(null, { status: 202 }))
      let beaconCall = 0
      const beacon = vi.fn(() => ++beaconCall < 3)
      const reporter = new BrowserObservabilityReporter(reporterOptions({
        fetch: fetchMock,
        beacon,
        autoFlush: true
      }))
      const eventIds: string[] = []
      for (let index = 0; index < 6; index += 1) {
        const eventId = `018f47c0-4d5b-7a62-8f41-${String(index).padStart(12, "0")}`
        const event = await createBrowserErrorEvent({
          eventName: "browser.error",
          error: new Error(`discarded-${index}`),
          component: `BudgetBlocked${index}`,
          resourceKind: "unknown",
          route: "/bibliotek",
          environment: "stage",
          deploymentGitSha: GIT_SHA,
          randomUUID: () => eventId
        })
        eventIds.push(eventId)
        reporter.enqueue({ ...event, error_type: "E".repeat(13_000) } as BrowserEvent)
      }

      const normalFlush = reporter.flush()
      const exitFlush = reporter.flush(true)
      releaseActive?.()
      await Promise.all([normalFlush, exitFlush])

      expect(await beaconBodies(beacon)).toEqual([
        [eventIds[1]],
        [eventIds[2]],
        [eventIds[3]]
      ])
      expect(fetchBodies(fetchMock)).toEqual([[eventIds[0]], [eventIds[3]]])
      const initiatedBytes = String(fetchMock.mock.calls[0]?.[1]?.body).length
        + (beacon.mock.calls[0]?.[1] as Blob).size
        + (beacon.mock.calls[1]?.[1] as Blob).size
        + String(fetchMock.mock.calls[1]?.[1]?.body).length
      expect(initiatedBytes).toBeLessThanOrEqual(60 * 1024)
      expect(vi.getTimerCount()).toBe(1)

      await vi.advanceTimersByTimeAsync(1_000)
      expect(fetchBodies(fetchMock).at(-1)).toEqual([eventIds[0]])
    } finally {
      vi.useRealTimers()
    }
  })

  test("waits for an active successful delivery before exit-draining only its tail", async () => {
    let releaseFetch: (() => void) | undefined
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
      releaseFetch = () => resolve(new Response(null, { status: 202 }))
    }))
    const beacon = vi.fn(() => true)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const eventIds = await enqueueNumberedEvents(reporter, 23)

    const normalFlush = reporter.flush()
    const exitFlush = reporter.flush(true)
    expect((await beaconBodies(beacon)).flat()).toEqual(eventIds.slice(10))
    releaseFetch?.()
    await Promise.all([normalFlush, exitFlush])

    expect((await beaconBodies(beacon)).flat()).toEqual(eventIds.slice(10))
    expect(fetchBodies(fetchMock)).toEqual([eventIds.slice(0, 10)])
  })

  test("does not retry a blocked exit tail after its active delivery settles", async () => {
    let releaseActive: (() => void) | undefined
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => {
        releaseActive = () => resolve(new Response(null, { status: 202 }))
      }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
    const beacon = vi.fn(() => false)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const eventIds = await enqueueNumberedEvents(reporter, 23)

    const normalFlush = reporter.flush()
    const exitFlush = reporter.flush(true)
    releaseActive?.()
    await Promise.all([normalFlush, exitFlush])

    expect(beacon).toHaveBeenCalledTimes(2)
    expect(fetchBodies(fetchMock)).toEqual([
      eventIds.slice(0, 10),
      eventIds.slice(10, 20),
      eventIds.slice(20)
    ])

    await reporter.flush()
    expect(fetchBodies(fetchMock).at(-1)).toEqual(eventIds.slice(10, 20))
  })

  test("attempts a newly requeued active head without retrying an already blocked tail", async () => {
    vi.useFakeTimers()
    try {
      let releaseActive: (() => void) | undefined
      const fetchMock = vi.fn()
        .mockImplementationOnce(() => new Promise<Response>(resolve => {
          releaseActive = () => resolve(new Response(null, { status: 503 }))
        }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 202 }))
        .mockResolvedValueOnce(new Response(null, { status: 202 }))
        .mockResolvedValueOnce(new Response(null, { status: 202 }))
      let call = 0
      const beacon = vi.fn(() => {
        call += 1
        return call === 2
      })
      const reporter = new BrowserObservabilityReporter(reporterOptions({
        fetch: fetchMock,
        beacon,
        autoFlush: true
      }))
      const eventIds = await enqueueNumberedEvents(reporter, 23)

      const normalFlush = reporter.flush()
      const firstExitFlush = reporter.flush(true)
      const secondExitFlush = reporter.flush(true)
      releaseActive?.()
      await Promise.all([normalFlush, firstExitFlush, secondExitFlush])

      expect(await beaconBodies(beacon)).toEqual([
        eventIds.slice(10, 20),
        eventIds.slice(20),
        eventIds.slice(0, 10)
      ])
      expect(fetchBodies(fetchMock)).toEqual([
        eventIds.slice(0, 10),
        eventIds.slice(10, 20),
        eventIds.slice(0, 10)
      ])
      expect(vi.getTimerCount()).toBe(1)

      await vi.advanceTimersByTimeAsync(1_000)
      await vi.advanceTimersByTimeAsync(1_000)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(fetchBodies(fetchMock).slice(-3)).toEqual([
        eventIds.slice(10, 20),
        eventIds.slice(0, 10),
        eventIds.slice(10, 20)
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  test("caps a deferred active requeue ahead of a refilled queue", async () => {
    let releaseActive: (() => void) | undefined
    const delivered: string[][] = []
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => {
        releaseActive = () => resolve(new Response(null, { status: 503 }))
      }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementation(async (_url: string, init: RequestInit) => {
        delivered.push(JSON.parse(String(init.body)).events.map(
          (event: { event_id: string }) => event.event_id
        ))
        return new Response(null, { status: 202 })
      })
    let beaconCall = 0
    const beacon = vi.fn(() => ++beaconCall === 1)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const firstIds = await enqueueNumberedEvents(reporter, 10)
    const normalFlush = reporter.flush()
    const refillIds: string[] = []
    for (let index = 10; index < 60; index += 1) {
      const eventId = `018f47c0-4d5b-7a62-8f41-${String(index).padStart(12, "0")}`
      refillIds.push(eventId)
      reporter.enqueue(await createBrowserErrorEvent({
        eventName: "browser.error",
        error: new Error(`discarded-${index}`),
        component: `Component${index}`,
        resourceKind: "unknown",
        route: "/bibliotek",
        environment: "stage",
        deploymentGitSha: GIT_SHA,
        randomUUID: () => eventId
      }))
    }
    const exitFlush = reporter.flush(true)

    releaseActive?.()
    await Promise.all([normalFlush, exitFlush])
    for (let index = 0; index < 5; index += 1) await reporter.flush()

    expect(delivered.flat()).toEqual([...firstIds, ...refillIds.slice(10, 50)])
  })

  test("releases a tail dedup marker when an active requeue truncates it", async () => {
    let releaseActive: (() => void) | undefined
    const delivered: string[][] = []
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => {
        releaseActive = () => resolve(new Response(null, { status: 503 }))
      }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementation(async (_url: string, init: RequestInit) => {
        delivered.push(JSON.parse(String(init.body)).events.map(
          (event: { event_id: string }) => event.event_id
        ))
        return new Response(null, { status: 202 })
      })
    const beacon = vi.fn(() => false)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const activeIds = await enqueueNumberedEvents(reporter, 10)
    const normalFlush = reporter.flush()
    const refillEvents: BrowserEvent[] = []
    for (let index = 10; index < 60; index += 1) {
      const eventId = `018f47c0-4d5b-7a62-8f41-${String(index).padStart(12, "0")}`
      const event = await createBrowserErrorEvent({
        eventName: "browser.error",
        error: new Error(`discarded-${index}`),
        component: `Component${index}`,
        resourceKind: "unknown",
        route: "/bibliotek",
        environment: "stage",
        deploymentGitSha: GIT_SHA,
        randomUUID: () => eventId
      })
      refillEvents.push(event)
      reporter.enqueue(event)
    }
    const exitFlush = reporter.flush(true)
    releaseActive?.()
    await Promise.all([normalFlush, exitFlush])

    const replacementId = "018f47c0-4d5b-7a62-8f41-999999999998"
    reporter.enqueue({ ...refillEvents.at(-1)!, event_id: replacementId })
    for (let index = 0; index < 5; index += 1) await reporter.flush()

    expect(delivered.flat()).toEqual([
      ...activeIds.slice(1),
      ...refillEvents.slice(0, 40).map(event => event.event_id),
      replacementId
    ])
  })

  test("retries a transient delivery failure without another event", async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 202 }))
      const reporter = new BrowserObservabilityReporter(reporterOptions({
        fetch: fetchMock,
        autoFlush: true
      }))
      await reporter.capture(new Error("private"))

      await vi.advanceTimersByTimeAsync(1_000)
      expect(fetchMock).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(1_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  test("retries a throttled delivery after backoff without losing the batch", async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 429 }))
        .mockResolvedValueOnce(new Response(null, { status: 202 }))
      const reporter = new BrowserObservabilityReporter(reporterOptions({
        fetch: fetchMock,
        autoFlush: true
      }))
      const eventIds = await enqueueNumberedEvents(reporter, 3)

      await vi.advanceTimersByTimeAsync(1_000)
      expect(fetchBodies(fetchMock)).toEqual([eventIds])

      await vi.advanceTimersByTimeAsync(1_000)
      expect(fetchBodies(fetchMock)).toEqual([eventIds, eventIds])
    } finally {
      vi.useRealTimers()
    }
  })

  test("requeues a page-exit 429 fallback ahead of its untouched tail", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
    const beacon = vi.fn(() => false)
    const reporter = new BrowserObservabilityReporter(reporterOptions({ fetch: fetchMock, beacon }))
    const eventIds = await enqueueNumberedEvents(reporter, 23)

    await reporter.flush(true)
    await reporter.flush()
    await reporter.flush()
    await reporter.flush()

    expect(beacon).toHaveBeenCalledTimes(3)
    expect(fetchBodies(fetchMock)).toEqual([
      eventIds.slice(0, 10),
      eventIds.slice(10, 20),
      eventIds.slice(20),
      eventIds.slice(0, 10)
    ])
  })

  test.each([400, 403, 413, 415, 422])(
    "treats terminal intake status %i as delivered without retry",
    async status => {
      vi.useFakeTimers()
      try {
        const fetchMock = vi.fn(async () => new Response(null, { status }))
        const reporter = new BrowserObservabilityReporter(reporterOptions({
          fetch: fetchMock,
          autoFlush: true
        }))
        await enqueueNumberedEvents(reporter, 1)

        await vi.advanceTimersByTimeAsync(60_000)

        expect(fetchMock).toHaveBeenCalledOnce()
        expect(vi.getTimerCount()).toBe(0)
      } finally {
        vi.useRealTimers()
      }
    }
  )

  test.each([401, 404, 408, 409, 425, 429])(
    "retries nonterminal client status %i",
    async status => {
      vi.useFakeTimers()
      try {
        const fetchMock = vi.fn()
          .mockResolvedValueOnce(new Response(null, { status }))
          .mockResolvedValueOnce(new Response(null, { status: 202 }))
        const reporter = new BrowserObservabilityReporter(reporterOptions({
          fetch: fetchMock,
          autoFlush: true
        }))
        const eventIds = await enqueueNumberedEvents(reporter, 1)

        await vi.advanceTimersByTimeAsync(2_000)

        expect(fetchBodies(fetchMock)).toEqual([eventIds, eventIds])
      } finally {
        vi.useRealTimers()
      }
    }
  )

  test("reschedules an event queued during an in-flight flush", async () => {
    const firstEvent = await createBrowserErrorEvent({
      eventName: "browser.error",
      error: new Error("discarded-a"),
      component: "FirstComponent",
      resourceKind: "unknown",
      route: "/bibliotek",
      environment: "stage",
      deploymentGitSha: GIT_SHA
    })
    const secondEvent = await createBrowserErrorEvent({
      eventName: "browser.error",
      error: new Error("discarded-b"),
      component: "SecondComponent",
      resourceKind: "unknown",
      route: "/bibliotek",
      environment: "stage",
      deploymentGitSha: GIT_SHA
    })
    vi.useFakeTimers()
    try {
      let releaseFirst: (() => void) | undefined
      const firstDelivery = new Promise<Response>((resolve) => {
        releaseFirst = () => resolve(new Response(null, { status: 202 }))
      })
      const fetchMock = vi.fn()
        .mockImplementationOnce(() => firstDelivery)
        .mockResolvedValueOnce(new Response(null, { status: 202 }))
      const reporter = new BrowserObservabilityReporter(reporterOptions({
        fetch: fetchMock,
        autoFlush: true
      }))

      reporter.enqueue(firstEvent)
      const activeFlush = reporter.flush()
      reporter.enqueue(secondEvent)
      await vi.advanceTimersByTimeAsync(1_000)
      releaseFirst?.()
      await activeFlush
      await vi.advanceTimersByTimeAsync(1_000)

      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
