import type {
  RouteLocationNormalized,
  RouterScrollBehavior
} from "vue-router"

type ReaderRoute = {
  identity: string
  page: string
}

type PendingReaderNavigation = {
  from: string
  left: number
  to: string
}

type PendingReaderScroll = {
  navigationId: number
  position: { left: number; top: number }
  resolve: (position: { left: number; top: number } | false) => void
  to: string
}

declare module "#app" {
  interface RuntimeNuxtHooks {
    "reader:page-ready": (fullPath: string, successful: boolean) => void
  }
}

function stringParam(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function readerRoute(route: RouteLocationNormalized): ReaderRoute | null {
  const author = stringParam(route.params.author)
  const title = stringParam(route.params.title)
  const page = stringParam(route.params.page)
  const mediaType = stringParam(route.params.mediatype)
  if (
    !author
    || !title
    || !page
    || (mediaType !== "etext" && mediaType !== "faksimil")
    || !/\/sida\/[^/]+\/(?:etext|faksimil)\/?$/.test(route.path)
  ) {
    return null
  }
  return {
    identity: JSON.stringify([author, title, mediaType]),
    page
  }
}

function isReaderPageNavigation(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized
): boolean {
  const destination = readerRoute(to)
  const source = readerRoute(from)
  return destination !== null
    && source !== null
    && destination.identity === source.identity
    && destination.page !== source.page
}

export default defineNuxtPlugin({
  name: "reader-horizontal-scroll",
  enforce: "post",
  setup(nuxtApp) {
    const router = useRouter()
    let defaultScrollBehavior: RouterScrollBehavior | undefined
    let navigationId = 0
    let pendingNavigation: PendingReaderNavigation | null = null
    let pendingScroll: PendingReaderScroll | null = null
    const readyRoutes = new Set<string>()

    router.beforeEach((to, from) => {
      const readerPageNavigation = isReaderPageNavigation(to, from)
      if (readerPageNavigation) readyRoutes.delete(to.fullPath)
      pendingNavigation = readerPageNavigation
        ? {
            from: from.fullPath,
            left: window.scrollX,
            to: to.fullPath
          }
        : null
    })

    router.afterEach((to, from, failure) => {
      if (
        failure
        && pendingNavigation?.from === from.fullPath
        && pendingNavigation.to === to.fullPath
      ) {
        pendingNavigation = null
      }
    })

    const readerScrollBehavior: RouterScrollBehavior = (to, from, savedPosition) => {
      navigationId += 1
      pendingScroll?.resolve(false)
      pendingScroll = null
      if (!isReaderPageNavigation(to, from)) {
        readyRoutes.clear()
        pendingNavigation = null
        return defaultScrollBehavior?.(to, from, savedPosition)
      }

      const currentNavigationId = navigationId
      const captured = pendingNavigation
      pendingNavigation = null
      const position = savedPosition
        ? { left: savedPosition.left, top: savedPosition.top }
        : {
            left: captured?.from === from.fullPath
              && captured.to === to.fullPath
              ? captured.left
              : window.scrollX,
            top: 0
          }

      if (readyRoutes.delete(to.fullPath)) {
        return position
      }

      return new Promise(resolve => {
        pendingScroll = {
          navigationId: currentNavigationId,
          position,
          resolve,
          to: to.fullPath
        }
      })
    }

    nuxtApp.hooks.hook("reader:page-ready", (fullPath, successful) => {
      const current = pendingScroll
      if (
        current
        && current.navigationId === navigationId
        && current.to === fullPath
      ) {
        pendingScroll = null
        current.resolve(successful ? current.position : { left: 0, top: 0 })
        return
      }
      if (successful && router.currentRoute.value.fullPath === fullPath) {
        readyRoutes.add(fullPath)
      }
    })

    // Nuxt installs its final scroll behavior from its own app:created hook.
    // Register after that hook so this wrapper remains the router's active behavior.
    nuxtApp.hooks.hookOnce("app:created", () => {
      defaultScrollBehavior = router.options.scrollBehavior
      router.options.scrollBehavior = readerScrollBehavior
    })
  }
})
