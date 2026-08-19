import type { AppConfig } from "vue"
import { describe, expect, test, vi } from "vitest"

import {
  installHydrationObserver,
  isHydrationDiagnostic
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

  test("keeps interception through the mount turn before restoring it", async () => {
    const previousWarnHandler = vi.fn()
    const previousConsoleError = vi.fn()
    const vueConfig: Pick<AppConfig, "warnHandler"> = { warnHandler: previousWarnHandler }
    const consoleObject = { error: previousConsoleError } as Pick<Console, "error">
    const onHydration = vi.fn()
    let mountedCleanup: (() => void) | undefined
    installHydrationObserver({
      vueConfig,
      consoleObject,
      onHydration,
      onMounted: callback => {
        mountedCleanup = callback
      }
    })

    mountedCleanup?.()

    expect(vueConfig.warnHandler).not.toBe(previousWarnHandler)
    expect(consoleObject.error).not.toBe(previousConsoleError)
    consoleObject.error("Hydration completed but contains mismatches.")
    expect(onHydration).toHaveBeenCalledExactlyOnceWith()

    await Promise.resolve()
    expect(vueConfig.warnHandler).toBe(previousWarnHandler)
    expect(consoleObject.error).toBe(previousConsoleError)
    consoleObject.error("Hydration node mismatch:")
    expect(onHydration).toHaveBeenCalledExactlyOnceWith()
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
