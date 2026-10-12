import type { components } from "~/lib/api/generated/lbapi"

type ProfileResult = {
  data?: components["schemas"]["AuthorProfile"]
  response: { status: number }
}

// A navigation-scoped handoff, not a persistent profile cache. The page consumes
// the response obtained before the router commits its browser-history entry.
export function useAuthorProfileRequest() {
  const client = useLbApiClient()
  const handoff = useState<{ authorId: string, result: ProfileResult } | null>(
    "author-profile-request", () => null
  )
  const request = async (authorId: string): Promise<ProfileResult> => {
    try {
      const { data, response } = await client.GET("/authors/{author_id}", {
        params: { path: { author_id: authorId } }
      })
      return { data, response: { status: response.status } }
    } catch {
      return { response: { status: 503 } }
    }
  }
  return {
    async preload(authorId: string) {
      const result = await request(authorId)
      handoff.value = { authorId, result }
    },
    async load(authorId: string): Promise<ProfileResult> {
      if (handoff.value?.authorId === authorId) {
        const result = handoff.value.result
        handoff.value = null
        return result
      }
      return request(authorId)
    }
  }
}
