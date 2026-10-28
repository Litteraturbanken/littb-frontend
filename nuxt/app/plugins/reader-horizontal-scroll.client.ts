import type {
  RouteLocationNormalized,
  RouterScrollBehavior
} from "vue-router"

type ReaderRoute = {
  identity: string
  page: string
  kind: "public" | "editor"
}

type PendingPageScroll = {
  results?: boolean
  initial?: boolean
  navigationId: number
  position: { left: number; top: number }
  resolve: (position: { left: number; top: number } | false) => void
  to: string
}

declare module "#app" {
  interface RuntimeNuxtHooks {
    "results:page-ready": (fullPath: string) => void
    "reader:page-ready": (fullPath: string, successful: boolean) => void
  }
}

function stringParam(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function readerRoute(route: RouteLocationNormalized): ReaderRoute | null {
  const editorWork = stringParam(route.params.lbid)
  const editorIndex = stringParam(route.params.ix)
  const editorMedia = stringParam(route.params.mediatype)
  if (editorWork && editorIndex && editorMedia
    && /^\/editor\/[^/]+\/ix\/[^/]+\/[^/]+\/?$/.test(route.path)) {
    return {
      identity: JSON.stringify(["editor", editorWork, editorMedia]),
      page: editorIndex,
      kind: "editor"
    }
  }
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
    identity: JSON.stringify(["public", author, title, mediaType]),
    page,
    kind: "public"
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
    let pendingScroll: PendingPageScroll | null = null
    const readyRoutes = new Set<string>()
    let initialReaderPositioned = false
    let readyResultsRoute: string | null = null
    // Match the side-by-side reader layout; narrow screens keep user scroll control.
    const initialPosition = () => window.innerWidth >= 1024
      ? { left: 1000, top: 0 }
      : false as const

    router.beforeEach((to, from) => {
      readyResultsRoute = null
      if (pendingScroll?.results) {
        pendingScroll.resolve(false)
        pendingScroll = null
      }
      if (isReaderPageNavigation(to, from)) readyRoutes.clear()
    })

    const pageScrollBehavior: RouterScrollBehavior = (to, from, savedPosition) => {
      navigationId += 1
      pendingScroll?.resolve(false)
      pendingScroll = null
      if (savedPosition && ["/bibliotek", "/epub", "/sok", "/sök", "/s%C3%B6k"].includes(to.path.replace(/\/$/, ""))) {
        readyRoutes.clear()
        // Result pages mount before their client-fetched rows. Restoring earlier
        // clamps the browser's saved offset to the short loading page.
        if (readyResultsRoute === to.fullPath) return savedPosition
        return new Promise(resolve => {
          pendingScroll = {
            results: true,
            navigationId,
            position: { left: savedPosition.left, top: savedPosition.top },
            resolve,
            to: to.fullPath
          }
        })
      }
      const enteringReader = readerRoute(to)?.kind === "public"
        && readerRoute(to)?.identity !== readerRoute(from)?.identity
        && !savedPosition
      if (enteringReader) {
        initialReaderPositioned = true
        if (readyRoutes.delete(to.fullPath)) return initialPosition()
        return new Promise(resolve => {
          pendingScroll = {
            initial: true,
            navigationId,
            position: { left: 0, top: 0 },
            resolve,
            to: to.fullPath
          }
        })
      }
      if (!isReaderPageNavigation(to, from)) {
        readyRoutes.clear()
        return defaultScrollBehavior?.(to, from, savedPosition)
      }

      // Same-work page turns reuse the reader and its viewport. Forward
      // navigation needs no scroll operation; Back/Forward keeps native saved
      // positions rather than forcing every new page to the top.
      return savedPosition ?? false
    }

    nuxtApp.hooks.hook("results:page-ready", fullPath => {
      if (router.currentRoute.value.fullPath !== fullPath) return
      readyResultsRoute = fullPath
      const current = pendingScroll
      if (current?.results && current.navigationId === navigationId && current.to === fullPath) {
        pendingScroll = null
        current.resolve(current.position)
      }
    })

    nuxtApp.hooks.hook("reader:page-ready", (fullPath, successful) => {
      const current = pendingScroll
      if (
        current
        && current.navigationId === navigationId
        && current.to === fullPath
      ) {
        pendingScroll = null
        current.resolve(successful
          ? current.initial ? initialPosition() : current.position
          : { left: 0, top: 0 })
        return
      }
      if (successful && router.currentRoute.value.fullPath === fullPath) {
        readyRoutes.add(fullPath)
        // The initial hydrated route may predate the router wrapper.
        if (!initialReaderPositioned) {
          initialReaderPositioned = true
          const position = initialPosition()
          if (position) window.scrollTo(position)
        }
      }
    })

    // Nuxt installs its final scroll behavior from its own app:created hook.
    // Register after that hook so this wrapper remains the router's active behavior.
    nuxtApp.hooks.hookOnce("app:created", () => {
      defaultScrollBehavior = router.options.scrollBehavior
      router.options.scrollBehavior = pageScrollBehavior
    })
  }
})
