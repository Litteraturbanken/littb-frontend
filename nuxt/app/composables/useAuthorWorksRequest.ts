import { isAuthorWorksResponse, type AuthorWorksResponse } from "~/lib/author-works"

type WorksResult = { status: number, works: AuthorWorksResponse | null }

export function useAuthorWorksRequest() {
  const client = useLbApiClient()
  const cache = useState<Record<string, WorksResult>>("author-works-cache", () => ({}))
  const handoff = useState<Record<string, WorksResult | undefined>>("author-works-handoff", () => ({}))
  const request = async (authorId: string): Promise<WorksResult> => {
    if (cache.value[authorId]) return cache.value[authorId]
    try {
      const { data, response } = await client.GET("/authors/{author_id}/works", {
        params: { path: { author_id: authorId } }
      })
      if (response.status === 200 && isAuthorWorksResponse(data) && data.author.author_id === authorId) {
        const result = { status: 200, works: data }
        cache.value[authorId] = result
        return result
      }
      return { status: response.status === 404 ? 404 : 503, works: null }
    } catch {
      return { status: 503, works: null }
    }
  }
  return {
    async preload(authorId: string) { handoff.value[authorId] = await request(authorId) },
    async load(authorId: string) {
      const result = handoff.value[authorId]
      if (result) {
        handoff.value[authorId] = undefined
        return result
      }
      return request(authorId)
    }
  }
}
