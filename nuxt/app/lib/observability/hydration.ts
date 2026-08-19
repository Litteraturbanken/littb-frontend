import type { AppConfig } from "vue"

type WarnHandler = NonNullable<AppConfig["warnHandler"]>

interface HydrationObserverOptions {
  vueConfig: Pick<AppConfig, "warnHandler">
  consoleObject: Pick<Console, "error">
  onHydration: () => void
  onMounted: (cleanup: () => void) => void
}

const TERMINAL_HYDRATION_DIAGNOSTIC = "Hydration completed but contains mismatches."

export const INITIAL_HYDRATION_MAX_LIFETIME_MS = 1_000

export function scheduleInitialHydrationCleanup(
  cleanup: () => void,
  isHydrating: () => boolean
): void {
  let firstFrame: number | undefined
  let secondFrame: number | undefined
  let finished = false
  const fallback = setTimeout(finish, INITIAL_HYDRATION_MAX_LIFETIME_MS)

  function finish(): void {
    if (finished) return
    finished = true
    if (firstFrame !== undefined) cancelAnimationFrame(firstFrame)
    if (secondFrame !== undefined) cancelAnimationFrame(secondFrame)
    clearTimeout(fallback)
    cleanup()
  }

  function scheduleFrames(): void {
    firstFrame = requestAnimationFrame(() => {
      firstFrame = undefined
      secondFrame = requestAnimationFrame(() => {
        secondFrame = undefined
        finish()
      })
    })
  }

  function waitForInitialHydration(): void {
    if (!isHydrating()) {
      scheduleFrames()
      return
    }
    firstFrame = requestAnimationFrame(waitForInitialHydration)
  }

  waitForInitialHydration()
}

export function isHydrationDiagnostic(value: unknown): boolean {
  return value === TERMINAL_HYDRATION_DIAGNOSTIC
    || (typeof value === "string"
      && value.startsWith("Hydration ")
      && value.includes(" mismatch"))
}

export function installHydrationObserver(options: HydrationObserverOptions): () => void {
  const previousWarnHandler = options.vueConfig.warnHandler
  const previousConsoleError = options.consoleObject.error
  let reported = false
  let cleanedUp = false

  function reportInitialHydration(args: unknown[]): void {
    if (cleanedUp || reported || !args.some(isHydrationDiagnostic)) return
    reported = true
    try {
      options.onHydration()
    } catch {
      // Reporting must not change application error handling.
    }
  }

  const warnHandler: WarnHandler = function(this: unknown, ...args) {
    previousWarnHandler?.apply(this, args)
    reportInitialHydration(args)
  }
  function consoleError(this: unknown, ...args: unknown[]): void {
    previousConsoleError.apply(this, args)
    reportInitialHydration(args)
  }
  function cleanup(): void {
    if (cleanedUp) return
    cleanedUp = true
    clearTimeout(lifetimeDeadline)
    if (options.vueConfig.warnHandler === warnHandler) {
      options.vueConfig.warnHandler = previousWarnHandler
    }
    if (options.consoleObject.error === consoleError) {
      options.consoleObject.error = previousConsoleError
    }
  }

  options.vueConfig.warnHandler = warnHandler
  options.consoleObject.error = consoleError
  const lifetimeDeadline = setTimeout(cleanup, INITIAL_HYDRATION_MAX_LIFETIME_MS)
  options.onMounted(cleanup)
  return cleanup
}
