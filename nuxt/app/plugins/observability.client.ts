import type { EventEnvironment } from "../lib/observability/events"
import { BrowserObservabilityReporter } from "../lib/observability/browser"
import { observeApiFailures } from "../lib/api/client"

function environment(value: unknown): EventEnvironment {
  if (value === "stage" || value === "staging") return "stage"
  if (value === "production") return "production"
  return "development"
}

function resourceKind(target: EventTarget | null):
  "document" | "script" | "style" | "image" | "unknown" {
  if (target === document) return "document"
  if (target instanceof HTMLScriptElement) return "script"
  if (target instanceof HTMLLinkElement) return "style"
  if (target instanceof HTMLImageElement) return "image"
  return "unknown"
}

export default defineNuxtPlugin({
  name: "observability",
  enforce: "pre",
  setup(nuxtApp) {
    const config = useRuntimeConfig()
    const router = useRouter()
    const reporter = new BrowserObservabilityReporter({
      endpoint: "/_observability/events",
      environment: environment(config.public.observabilityEnvironment),
      deploymentGitSha: String(config.public.observabilityGitSha || ""),
      route: () => router.currentRoute.value.matched.at(-1)?.path ?? null
    })

    observeApiFailures(failure => {
      const error = new Error()
      error.name = failure.errorType
      void reporter.capture(error, {
        correlationToken: failure.correlationToken
      })
    })

    nuxtApp.hooks.hook("vue:error", error => {
      void reporter.capture(error)
    })
    nuxtApp.hooks.hook("app:error", error => {
      void reporter.capture(error)
    })
    router.onError(error => {
      void reporter.capture(error)
    })
    window.addEventListener("error", browserEvent => {
      void reporter.capture(
        browserEvent.error instanceof Error ? browserEvent.error : new Error(),
        { resourceKind: resourceKind(browserEvent.target) }
      )
    }, { capture: true })
    window.addEventListener("unhandledrejection", browserEvent => {
      void reporter.capture(browserEvent.reason, {
        eventName: "browser.unhandled_rejection"
      })
    })
    window.addEventListener("pagehide", () => {
      void reporter.flush(true)
    })
  }
})
