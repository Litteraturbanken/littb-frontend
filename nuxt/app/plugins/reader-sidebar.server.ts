// Nuxt inserts only its default #teleports target automatically. The reader's
// dedicated shell target must receive Vue's SSR markup before hydration too.
export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.hook("app:rendered", ({ ssrContext, renderResult }) => {
    const sidebar = ssrContext?.teleports?.["#toolkit-right"]
    if (!sidebar || !renderResult) return
    const target = /(<div\b[^>]*\bid="toolkit-right"[^>]*\bdata-reader-sidebar-target[^>]*>)(<\/div>)/u
    if (!target.test(renderResult.html)) {
      throw new Error("Reader sidebar SSR target is missing")
    }
    renderResult.html = renderResult.html.replace(target, (_match, open, close) => (
      open + sidebar + close
    ))
  })
})
