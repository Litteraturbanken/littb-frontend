import { validateAuthorRouteParam } from "~/lib/author-profile"

export default defineNuxtRouteMiddleware(async (to, from) => {
  // SSR already awaits the profile and serializes it for hydration.
  if (import.meta.server || useNuxtApp().isHydrating || to.path === from.path) return
  const value = to.params.author
  const authorId = Array.isArray(value) ? value[0] : value
  if (!authorId || !validateAuthorRouteParam(authorId)) return
  const variant = to.path.endsWith("/dramawebben") ? "dramawebben" : "ordinary"
  const identity = `${variant}:${authorId}`
  // A canonical ordinary-to-Dramawebben redirect already carries its profile.
  const handoffs = useState<Record<string, { identity: string } | undefined>>(
    "author-profile-handoffs", () => ({})
  )
  if (handoffs.value[identity]?.identity === identity) return
  // The navigation link also awaits works availability. Resolve both before
  // committing the URL so a slow sidebar cannot delay the destination title.
  await Promise.all([
    useAuthorProfileRequest().preload(authorId),
    useAuthorWorksAvailability(ref(authorId))
  ])
})
