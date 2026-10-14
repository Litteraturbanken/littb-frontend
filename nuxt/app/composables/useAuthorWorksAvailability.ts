export async function useAuthorWorksAvailability(authorId: Ref<string>) {
  const client = useLbApiClient()
  const key = computed(() => `author-works-availability:${authorId.value}`)
  const { data } = await useAsyncData(key, async () => {
    const identity = authorId.value
    try {
      const { data: body, response } = await client.GET("/authors/{author_id}/works-availability", {
        params: { path: { author_id: identity } }
      })
      if (response.status === 200 && body?.author_id === identity && typeof body.has_works === "boolean") {
        return { identity, hasWorks: body.has_works }
      }
    } catch { /* An unavailable API must not be treated as an empty list. */ }
    return { identity, hasWorks: null }
  }, {
    getCachedData: (cacheKey, nuxtApp) => nuxtApp.payload.data[cacheKey]
  })
  return computed(() => data.value?.identity === authorId.value ? data.value.hasWorks : null)
}
