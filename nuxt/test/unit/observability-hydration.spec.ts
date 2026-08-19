import type { AppConfig } from "vue"
import { describe, expect, test, vi } from "vitest"

import {
  INITIAL_HYDRATION_MAX_LIFETIME_MS,
  installHydrationObserver,
  isHydrationDiagnostic,
  scheduleInitialHydrationCleanup
} from "../../app/lib/observability/hydration"

const HYDRATION_DIAGNOSTICS = [
  "Hydration completed but contains mismatches.",
  "Hydration text mismatch in",
  "Hydration children mismatch on",
  "Hydration text content mismatch on",
  "Hydration node mismatch:"
]

function createObserver(options: {
  warnHandler?: NonNullable<AppConfig["warnHandler"]>
  consoleError?: Console["error"]
} = {}) {
  const vueConfig: Pick<AppConfig, "warnHandler"> = {}
  const consoleObject = {
    error: options.consoleError ?? vi.fn()
  } as Pick<Console, "error">
  vueConfig.warnHandler = options.warnHandler
  const onHydration = vi.fn()
  installHydrationObserver({
    vueConfig,
    consoleObject,
    onHydration,
    onMounted: () => {}
  })

  return {
    consoleObject,
    onHydration,
    vueConfig
  }
}

describe("hydration diagnostics", () => {
  test.each(HYDRATION_DIAGNOSTICS)("recognizes %s", diagnostic => {
    expect(isHydrationDiagnostic(diagnostic)).toBe(true)
  })

  test.each([
    "this will cause hydration errors",
    "ordinary warning",
    new Error("Hydration text mismatch in"),
    { message: "Hydration text mismatch in" },
    null
  ])("rejects non-terminal diagnostic %j", diagnostic => {
    expect(isHydrationDiagnostic(diagnostic)).toBe(false)
  })
})

describe("initial hydration observer", () => {
  test("deactivates and restores at the install-time deadline when mount never fires", () => {
    vi.useFakeTimers()
    const previousWarnHandler = vi.fn()
    const previousConsoleError = vi.fn()
    const vueConfig: Pick<AppConfig, "warnHandler"> = { warnHandler: previousWarnHandler }
    const consoleObject = { error: previousConsoleError } as Pick<Console, "error">
    const onHydration = vi.fn()
    let registeredCleanup: (() => void) | undefined

    try {
      const cleanup = installHydrationObserver({
        vueConfig,
        consoleObject,
        onHydration,
        onMounted: callback => {
          registeredCleanup = callback
        }
      })
      const retainedWarnHandler = vueConfig.warnHandler
      const retainedConsoleError = consoleObject.error

      expect(registeredCleanup).toBe(cleanup)
      vi.advanceTimersByTime(INITIAL_HYDRATION_MAX_LIFETIME_MS)

      expect(vueConfig.warnHandler).toBe(previousWarnHandler)
      expect(consoleObject.error).toBe(previousConsoleError)
      retainedWarnHandler?.("Hydration node mismatch:", null, "trace")
      retainedConsoleError("Hydration completed but contains mismatches.")
      expect(previousWarnHandler).toHaveBeenCalledOnce()
      expect(previousConsoleError).toHaveBeenCalledOnce()
      expect(onHydration).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  test("preserves later interposers while permanently deactivating retained wrappers", () => {
    vi.useFakeTimers()
    const previousWarnHandler = vi.fn()
    const previousConsoleError = vi.fn()
    const vueConfig: Pick<AppConfig, "warnHandler"> = { warnHandler: previousWarnHandler }
    const consoleObject = { error: previousConsoleError } as Pick<Console, "error">
    const onHydration = vi.fn()

    try {
      installHydrationObserver({
        vueConfig,
        consoleObject,
        onHydration,
        onMounted: () => {}
      })
      const retainedWarnHandler = vueConfig.warnHandler
      const retainedConsoleError = consoleObject.error
      const interposedWarnHandler: NonNullable<AppConfig["warnHandler"]>
        = function(this: unknown, ...args) {
          retainedWarnHandler?.apply(this, args)
        }
      const interposedConsoleError: Console["error"] = function(this: unknown, ...args) {
        retainedConsoleError.apply(this, args)
      }
      vueConfig.warnHandler = interposedWarnHandler
      consoleObject.error = interposedConsoleError

      vi.advanceTimersByTime(INITIAL_HYDRATION_MAX_LIFETIME_MS)

      expect(vueConfig.warnHandler).toBe(interposedWarnHandler)
      expect(consoleObject.error).toBe(interposedConsoleError)
      vueConfig.warnHandler?.("Hydration text mismatch in", null, "trace")
      consoleObject.error("Hydration node mismatch:")
      expect(previousWarnHandler).toHaveBeenCalledOnce()
      expect(previousConsoleError).toHaveBeenCalledOnce()
      expect(onHydration).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  test("chains the previous warning handler with its original receiver and arguments", () => {
    const receiver = { source: "vue" }
    const previousWarnHandler = vi.fn()
    const { vueConfig } = createObserver({ warnHandler: previousWarnHandler })
    vueConfig.warnHandler?.call(receiver, "Hydration node mismatch:", null, "trace")

    expect(previousWarnHandler).toHaveBeenCalledExactlyOnceWith(
      "Hydration node mismatch:",
      null,
      "trace"
    )
    expect(previousWarnHandler.mock.instances[0]).toBe(receiver)
  })

  test("chains the previous console error with its original receiver and arguments", () => {
    const receiver = { source: "console" }
    const previousConsoleError = vi.fn()
    const vueConfig: Pick<AppConfig, "warnHandler"> = {}
    const consoleObject = { error: previousConsoleError } as Pick<Console, "error">
    const onHydration = vi.fn()
    installHydrationObserver({
      vueConfig,
      consoleObject,
      onHydration,
      onMounted: () => {}
    })

    consoleObject.error.call(receiver, "Hydration node mismatch:", { trace: true })

    expect(previousConsoleError).toHaveBeenCalledExactlyOnceWith(
      "Hydration node mismatch:",
      { trace: true }
    )
    expect(previousConsoleError.mock.instances[0]).toBe(receiver)
  })

  test("reports only the first terminal mismatch from warning and console paths", () => {
    const { consoleObject, onHydration, vueConfig } = createObserver()

    vueConfig.warnHandler?.("Hydration text mismatch in", null, "trace")
    consoleObject.error("Hydration node mismatch:")

    expect(onHydration).toHaveBeenCalledExactlyOnceWith()
  })

  test("does not report nearby or generic warnings", () => {
    const { consoleObject, onHydration, vueConfig } = createObserver()

    vueConfig.warnHandler?.("this will cause hydration errors", null, "trace")
    consoleObject.error("ordinary warning")

    expect(onHydration).not.toHaveBeenCalled()
  })

  test("uses app-mounted two-frame cleanup without suspense resolution", () => {
    vi.useFakeTimers()
    const previousWarnHandler = vi.fn()
    const previousConsoleError = vi.fn()
    const vueConfig: Pick<AppConfig, "warnHandler"> = { warnHandler: previousWarnHandler }
    const consoleObject = { error: previousConsoleError } as Pick<Console, "error">
    const onHydration = vi.fn()
    let registeredCleanup: (() => void) | undefined
    let mounted: (() => void) | undefined
    const animationFrames = new Map<number, FrameRequestCallback>()
    let nextFrame = 0

    try {
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        nextFrame += 1
        animationFrames.set(nextFrame, callback)
        return nextFrame
      })
      vi.stubGlobal("cancelAnimationFrame", (frame: number) => animationFrames.delete(frame))
      const cleanup = installHydrationObserver({
        vueConfig,
        consoleObject,
        onHydration,
        onMounted: callback => {
          registeredCleanup = callback
          mounted = () => scheduleInitialHydrationCleanup(callback, () => false)
        }
      })

      expect(registeredCleanup).toBe(cleanup)
      mounted?.()

      expect(vueConfig.warnHandler).not.toBe(previousWarnHandler)
      expect(consoleObject.error).not.toBe(previousConsoleError)
      consoleObject.error("Hydration completed but contains mismatches.")
      consoleObject.error("Hydration completed but contains mismatches.")
      expect(onHydration).toHaveBeenCalledExactlyOnceWith()

      animationFrames.get(1)?.(0)
      expect(vueConfig.warnHandler).not.toBe(previousWarnHandler)
      expect(consoleObject.error).not.toBe(previousConsoleError)
      animationFrames.get(2)?.(16)
      expect(vueConfig.warnHandler).toBe(previousWarnHandler)
      expect(consoleObject.error).toBe(previousConsoleError)
      consoleObject.error("Hydration node mismatch:")
      expect(onHydration).toHaveBeenCalledExactlyOnceWith()
      vi.advanceTimersByTime(INITIAL_HYDRATION_MAX_LIFETIME_MS)
      expect(onHydration).toHaveBeenCalledExactlyOnceWith()
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  test("bounds cleanup when animation frames never execute", () => {
    vi.useFakeTimers()
    const previousWarnHandler = vi.fn()
    const previousConsoleError = vi.fn()
    const vueConfig: Pick<AppConfig, "warnHandler"> = { warnHandler: previousWarnHandler }
    const consoleObject = { error: previousConsoleError } as Pick<Console, "error">
    let mounted: (() => void) | undefined
    const animationFrames = new Map<number, FrameRequestCallback>()

    try {
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        animationFrames.set(1, callback)
        return 1
      })
      vi.stubGlobal("cancelAnimationFrame", (frame: number) => animationFrames.delete(frame))
      installHydrationObserver({
        vueConfig,
        consoleObject,
        onHydration: () => {},
        onMounted: callback => {
          mounted = () => scheduleInitialHydrationCleanup(callback, () => true)
        }
      })

      mounted?.()
      expect(vueConfig.warnHandler).not.toBe(previousWarnHandler)
      vi.advanceTimersByTime(INITIAL_HYDRATION_MAX_LIFETIME_MS)
      expect(animationFrames).toEqual(new Map())
      expect(vueConfig.warnHandler).toBe(previousWarnHandler)
      expect(consoleObject.error).toBe(previousConsoleError)
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  test("starts two-frame cleanup after initial hydration finishes", () => {
    vi.useFakeTimers()
    let hydrating = true
    let nextFrame = 0
    const animationFrames = new Map<number, FrameRequestCallback>()
    const cleanup = vi.fn()

    try {
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        nextFrame += 1
        animationFrames.set(nextFrame, callback)
        return nextFrame
      })
      vi.stubGlobal("cancelAnimationFrame", (frame: number) => animationFrames.delete(frame))

      scheduleInitialHydrationCleanup(cleanup, () => hydrating)
      animationFrames.get(1)?.(0)
      expect(cleanup).not.toHaveBeenCalled()

      hydrating = false
      animationFrames.get(2)?.(16)
      animationFrames.get(3)?.(32)
      expect(cleanup).not.toHaveBeenCalled()
      animationFrames.get(4)?.(48)
      expect(cleanup).toHaveBeenCalledExactlyOnceWith()
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  test("allows explicit cleanup to run more than once", () => {
    const previousWarnHandler = vi.fn()
    const previousConsoleError = vi.fn()
    const vueConfig: Pick<AppConfig, "warnHandler"> = { warnHandler: previousWarnHandler }
    const consoleObject = { error: previousConsoleError } as Pick<Console, "error">
    const cleanup = installHydrationObserver({
      vueConfig,
      consoleObject,
      onHydration: () => {},
      onMounted: () => {}
    })

    cleanup()
    cleanup()

    expect(vueConfig.warnHandler).toBe(previousWarnHandler)
    expect(consoleObject.error).toBe(previousConsoleError)
  })
})
