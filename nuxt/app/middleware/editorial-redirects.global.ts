// Initial requests redirect in Nitro. Resolve client-side Vue navigation too,
// without downloading the redirect table into the browser.
export default defineNuxtRouteMiddleware(async to => {
  if (import.meta.server) return
  if (!/^\/(?:forfattare|författare|f%C3%B6rfattare)\//iu.test(to.path)) return
  try {
    const { target } = await $fetch<{ target: string | null }>("/nuxt-api/editorial-redirect", {
      query: { path: to.path }, timeout: 5000, retry: 0
    })
    if (target && target.startsWith("/f%C3%B6rfattare/") && target !== to.path) {
      return navigateTo(target + to.fullPath.slice(to.path.length), { replace: true })
    }
  } catch {
    // Ordinary navigation remains available if the resolver is unavailable.
  }
})
