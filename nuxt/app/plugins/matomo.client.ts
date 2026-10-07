import { nextTick } from "vue"
import { installMatomo } from "../lib/analytics/matomo"

export default defineNuxtPlugin({
  name: "matomo",
  setup(nuxtApp) {
    const views = installMatomo(window, document)
    if (!views) return
    const router = useRouter()
    const head = injectHead()
    let mounted = false
    let rendering = false
    const flush = async () => {
      await nextTick()
      if (!mounted || rendering) return
      const route = router.currentRoute.value
      // Resolve the destination head rather than racing its debounced DOM update.
      const tags = await head.resolveTags()
      if (rendering || route !== router.currentRoute.value) return
      const title = tags.find(tag => tag.tag === "title")?.textContent
      views.visit(route, typeof title === "string" ? title : document.title)
    }
    nuxtApp.hook("page:start", () => { rendering = true })
    nuxtApp.hook("page:finish", () => {
      rendering = false
      void flush()
    })
    nuxtApp.hook("app:mounted", () => {
      mounted = true
      void flush()
    })
    // Reused reader/components and query updates may not start a new Suspense.
    router.afterEach((to, from, failure) => {
      const destination = to.matched.at(-1)?.components?.default
      const source = from.matched.at(-1)?.components?.default
      if (!failure && destination === source) void flush()
    })
  }
})
