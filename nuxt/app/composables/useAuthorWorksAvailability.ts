import { isAuthorWorksResponse } from "~/lib/author-works"

export async function useAuthorWorksAvailability(authorId: Ref<string>) {
  const client = useLbApiClient()
  const key = computed(() => `author-works-availability:${authorId.value}`)
  const { data } = await useAsyncData(key, async () => {
    const identity = authorId.value
    try {
      const { data: body, response } = await client.GET("/authors/{author_id}/works", {
        params: { path: { author_id: identity } }
      })
      if (response.status === 200 && isAuthorWorksResponse(body)
        && body.author.author_id === identity) {
        return { identity, hasWorks: body.authored_sections.some(section => section.items.length > 0) }
      }
    } catch { /* An unavailable API must not be treated as an empty list. */ }
    return { identity, hasWorks: null }
  }, {
    getCachedData: (cacheKey, nuxtApp) => nuxtApp.payload.data[cacheKey]
  })
  return computed(() => data.value?.identity === authorId.value ? data.value.hasWorks : null)
}
