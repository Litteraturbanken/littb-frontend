import { validateAuthorRouteParam } from "~/lib/author-profile"

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.server || useNuxtApp().isHydrating || to.path === from.path) return
  const value = to.params.author
  const authorId = Array.isArray(value) ? value[0] : value
  if (!authorId || !validateAuthorRouteParam(authorId) || from.params.author !== authorId) return
  // Retain the current author shell until the requested tab is ready.
  const pending = useState<string | null>("author-tab-pending", () => null)
  pending.value = to.fullPath
  await useAuthorWorksRequest().preload(authorId)
})
