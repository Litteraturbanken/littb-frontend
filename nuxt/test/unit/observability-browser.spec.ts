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
})
