import { markRaw, ref } from "vue"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { useReaderDictionaryEmbed } from "../../app/composables/useReaderDictionaryEmbed"

const reportDictionaryLookupOutcome = vi.hoisted(() => vi.fn(async () => {}))

vi.mock("../../app/lib/observability/dictionary-lookup", () => ({
  reportDictionaryLookupOutcome
}))

const firstRequestId = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8e"
const secondRequestId = "018f47c0-4d5b-7a62-8f41-a04b5df3fd8f"
const startedAt = Date.parse("2026-08-24T10:00:00.000Z")

type Lifecycle = ReturnType<typeof useReaderDictionaryEmbed>

type Harness = {
  addEventListener: ReturnType<typeof vi.fn>
  attachFrame: (frameSource?: object) => void
  lifecycle: Lifecycle
  message: (data: unknown, options?: { origin?: string, source?: object }) => void
  mount: () => void
  removeEventListener: ReturnType<typeof vi.fn>
  routeChange: () => void
  source: object
  unmount: () => void
}

function createHarness(
  origin = "https://svenska.se",
  parentHostname = "stage.litteraturbanken.se"
): Harness {
  let mountHook: (() => void) | undefined
  let routeChangeHook: (() => void) | undefined
  let unmountHook: (() => void) | undefined
  let messageListener: ((event: MessageEvent) => void) | undefined
  const source = {}
  const addEventListener = vi.fn((type: string, listener: EventListener) => {
    if (type === "message") messageListener = listener as (event: MessageEvent) => void
  })
  const removeEventListener = vi.fn()

  vi.stubGlobal("ref", ref)
  vi.stubGlobal("useRoute", () => ({ fullPath: "/red/1" }))
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { svenskaReaderEmbedOrigin: origin }
  }))
  vi.stubGlobal("onMounted", (callback: () => void) => { mountHook = callback })
  vi.stubGlobal("onBeforeUnmount", (callback: () => void) => { unmountHook = callback })
  vi.stubGlobal("watch", (_source: () => unknown, callback: () => void) => {
    routeChangeHook = callback
    return vi.fn()
  })
  vi.stubGlobal("window", {
    addEventListener,
    location: { hostname: parentHostname },
    removeEventListener
  })

  const lifecycle = useReaderDictionaryEmbed()

  return {
    addEventListener,
    attachFrame(frameSource = source) {
      lifecycle.frame.value = markRaw({ contentWindow: frameSource }) as HTMLIFrameElement
    },
    lifecycle,
    message(data, options = {}) {
      expect(messageListener).toBeTypeOf("function")
      messageListener?.({
        data,
        origin: options.origin ?? origin,
        source: options.source ?? source
      } as MessageEvent)
    },
    mount() {
      expect(mountHook).toBeTypeOf("function")
      mountHook?.()
    },
    removeEventListener,
    routeChange() {
      expect(routeChangeHook).toBeTypeOf("function")
      routeChangeHook?.()
    },
    source,
    unmount() {
      expect(unmountHook).toBeTypeOf("function")
      unmountHook?.()
    }
  }
}

function protocolMessage(
  requestId: string,
  event: "ready" | "result" | "empty" | "error",
  result: Record<string, unknown> = {}
) {
  return {
    type: "svenska-reader-lookup",
    version: 1,
    requestId,
    event,
    ...result
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(startedAt)
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn()
      .mockReturnValueOnce(firstRequestId)
      .mockReturnValueOnce(secondRequestId)
  })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  reportDictionaryLookupOutcome.mockReset()
})

describe("Reader dictionary embed lifecycle", () => {
  test("mounts one listener before a UUID-correlated lookup enters loading", () => {
    const harness = createHarness()
    harness.mount()

    expect(harness.addEventListener).toHaveBeenCalledExactlyOnceWith(
      "message",
      harness.lifecycle.handleMessage
    )
    harness.lifecycle.start("hund")

    expect(harness.lifecycle.status.value).toBe("loading")
    expect(harness.lifecycle.session.value).toEqual({
      requestId: firstRequestId,
      startedAt,
      src: `https://svenska.se/embed/reader?word=hund&requestId=${firstRequestId}`,
      word: "hund"
    })
    expect(reportDictionaryLookupOutcome).toHaveBeenCalledExactlyOnceWith({
      durationMs: 0,
      outcome: "opened",
      selectedDictionary: null,
      wordLength: 4
    })
    expect(vi.getTimerCount()).toBe(1)
  })

  test.each([
    [["so"], "so", "so"],
    [["saob"], "saob", "saob"],
    [["so", "saob"], "saob", "both"]
  ] as const)(
    "keeps ready non-terminal and reports a terminal %s result once",
    (dictionaries, selectedDictionary, outcome) => {
      const harness = createHarness()
      harness.mount()
      harness.lifecycle.start("hund")
      harness.attachFrame()

      vi.advanceTimersByTime(125)
      harness.message(protocolMessage(firstRequestId, "ready"))
      expect(harness.lifecycle.status.value).toBe("loading")
      expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(1)

      harness.message(protocolMessage(firstRequestId, "result", {
        dictionaries: [...dictionaries],
        selectedDictionary
      }))
      expect(harness.lifecycle.status.value).toBe("result")
      expect(harness.lifecycle.selectedDictionary.value).toBe(selectedDictionary)
      expect(reportDictionaryLookupOutcome).toHaveBeenNthCalledWith(2, {
        durationMs: 125,
        outcome,
        selectedDictionary,
        wordLength: 4
      })

      harness.message(protocolMessage(firstRequestId, "error"))
      vi.advanceTimersByTime(8_001)
      expect(harness.lifecycle.status.value).toBe("result")
      expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  test("ready without a terminal child message still reaches the eight-second deadline", () => {
    const harness = createHarness()
    harness.mount()
    harness.lifecycle.start("hund")
    harness.attachFrame()

    vi.advanceTimersByTime(125)
    harness.message(protocolMessage(firstRequestId, "ready"))
    vi.advanceTimersByTime(7_874)
    expect(harness.lifecycle.status.value).toBe("loading")
    expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    expect(harness.lifecycle.status.value).toBe("timeout")
    expect(reportDictionaryLookupOutcome).toHaveBeenNthCalledWith(2, {
      durationMs: 8_000,
      outcome: "timeout",
      selectedDictionary: null,
      wordLength: 4
    })
    expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  test.each([
    ["empty", "empty", "empty"],
    ["error", "error", "child_error"]
  ] as const)("maps child %s to one terminal outcome", (event, status, outcome) => {
    const harness = createHarness()
    harness.mount()
    harness.lifecycle.start("hund")
    harness.attachFrame()
    vi.advanceTimersByTime(75)

    harness.message(protocolMessage(firstRequestId, event))

    expect(harness.lifecycle.status.value).toBe(status)
    expect(harness.lifecycle.selectedDictionary.value).toBeNull()
    expect(reportDictionaryLookupOutcome).toHaveBeenNthCalledWith(2, {
      durationMs: 75,
      outcome,
      selectedDictionary: null,
      wordLength: 4
    })
    vi.advanceTimersByTime(8_001)
    expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  test("times out after eight seconds and ignores later terminal messages", () => {
    const harness = createHarness()
    harness.mount()
    harness.lifecycle.start("hund")
    harness.attachFrame()

    vi.advanceTimersByTime(7_999)
    expect(harness.lifecycle.status.value).toBe("loading")
    vi.advanceTimersByTime(1)

    expect(harness.lifecycle.status.value).toBe("timeout")
    expect(reportDictionaryLookupOutcome).toHaveBeenNthCalledWith(2, {
      durationMs: 8_000,
      outcome: "timeout",
      selectedDictionary: null,
      wordLength: 4
    })
    harness.message(protocolMessage(firstRequestId, "result", {
      dictionaries: ["so"],
      selectedDictionary: "so"
    }))
    expect(harness.lifecycle.status.value).toBe("timeout")
    expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  test.each([
    ["wrong origin", { origin: "https://attacker.example" }],
    ["wrong frame window", { source: {} }]
  ])("ignores an otherwise valid message from the %s", (_label, messageOptions) => {
    const harness = createHarness()
    harness.mount()
    harness.lifecycle.start("hund")
    harness.attachFrame()

    harness.message(protocolMessage(firstRequestId, "result", {
      dictionaries: ["so"],
      selectedDictionary: "so"
    }), messageOptions)

    expect(harness.lifecycle.status.value).toBe("loading")
    expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
  })

  test("a newer lookup clears the old timer and rejects its stale request ID", () => {
    const harness = createHarness()
    harness.mount()
    harness.lifecycle.start("hund")
    harness.attachFrame()
    vi.advanceTimersByTime(100)

    harness.lifecycle.start("katt")
    harness.attachFrame()

    expect(harness.lifecycle.session.value?.requestId).toBe(secondRequestId)
    expect(vi.getTimerCount()).toBe(1)
    harness.message(protocolMessage(firstRequestId, "result", {
      dictionaries: ["so"],
      selectedDictionary: "so"
    }))
    expect(harness.lifecycle.status.value).toBe("loading")
    expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(2)

    harness.message(protocolMessage(secondRequestId, "empty"))
    expect(harness.lifecycle.status.value).toBe("empty")
    expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  test.each(["close", "route change"])("%s invalidates the active request", action => {
    const harness = createHarness()
    harness.mount()
    harness.lifecycle.start("hund")
    harness.attachFrame()

    if (action === "close") harness.lifecycle.close()
    else harness.routeChange()
    harness.lifecycle.handleFrameLoad()
    harness.message(protocolMessage(firstRequestId, "result", {
      dictionaries: ["so"],
      selectedDictionary: "so"
    }))

    expect(harness.lifecycle.status.value).toBe("closed")
    expect(harness.lifecycle.session.value).toBeNull()
    expect(harness.lifecycle.frame.value).toBeNull()
    expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  test("unmount removes the mounted listener and clears the active session", () => {
    const harness = createHarness()
    harness.mount()
    harness.lifecycle.start("hund")

    harness.unmount()

    expect(harness.removeEventListener).toHaveBeenCalledExactlyOnceWith(
      "message",
      harness.lifecycle.handleMessage
    )
    expect(harness.lifecycle.status.value).toBe("closed")
    expect(harness.lifecycle.session.value).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  test("invalid origin or URL configuration fails closed without a live frame", () => {
    const harness = createHarness("https://svenska.se/path")
    harness.mount()

    expect(() => harness.lifecycle.start("hund")).not.toThrow()

    expect(harness.lifecycle.status.value).toBe("error")
    expect(harness.lifecycle.session.value).toBeNull()
    expect(harness.lifecycle.frame.value).toBeNull()
    expect(reportDictionaryLookupOutcome).toHaveBeenNthCalledWith(1, {
      durationMs: 0,
      outcome: "opened",
      selectedDictionary: null,
      wordLength: 4
    })
    expect(reportDictionaryLookupOutcome).toHaveBeenNthCalledWith(2, {
      durationMs: 0,
      outcome: "child_error",
      selectedDictionary: null,
      wordLength: 4
    })
    expect(vi.getTimerCount()).toBe(0)
  })

  test("a production parent rejects a local-HTTP embed origin", () => {
    const harness = createHarness(
      "http://127.0.0.1:4173",
      "stage.litteraturbanken.se"
    )
    harness.mount()

    harness.lifecycle.start("hund")

    expect(harness.lifecycle.status.value).toBe("error")
    expect(harness.lifecycle.session.value).toBeNull()
    expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  test.each(["localhost", "127.0.0.1"])(
    "a production build on local parent %s accepts the local fixture origin",
    parentHostname => {
      const harness = createHarness("http://127.0.0.1:4173", parentHostname)
      harness.mount()

      harness.lifecycle.start("hund")

      expect(harness.lifecycle.status.value).toBe("loading")
      expect(harness.lifecycle.session.value?.src).toBe(
        `http://127.0.0.1:4173/embed/reader?word=hund&requestId=${firstRequestId}`
      )
      expect(reportDictionaryLookupOutcome).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(1)
    }
  )
})
