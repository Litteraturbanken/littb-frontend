import type { AppConfig } from "vue"

type WarnHandler = NonNullable<AppConfig["warnHandler"]>

interface HydrationObserverOptions {
  vueConfig: Pick<AppConfig, "warnHandler">
  consoleObject: Pick<Console, "error">
  onHydration: () => void
  onMounted: (cleanup: () => void) => void
}

const TERMINAL_HYDRATION_DIAGNOSTIC = "Hydration completed but contains mismatches."

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
    if (reported || !args.some(isHydrationDiagnostic)) return
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
    if (options.vueConfig.warnHandler === warnHandler) {
      options.vueConfig.warnHandler = previousWarnHandler
    }
    if (options.consoleObject.error === consoleError) {
      options.consoleObject.error = previousConsoleError
    }
  }

  options.vueConfig.warnHandler = warnHandler
  options.consoleObject.error = consoleError
  options.onMounted(() => queueMicrotask(cleanup))
  return cleanup
}
