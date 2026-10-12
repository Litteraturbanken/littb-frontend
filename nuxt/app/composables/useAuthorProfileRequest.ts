import type { components } from "~/lib/api/generated/lbapi"

type ProfileResult = {
  data?: components["schemas"]["AuthorProfile"]
  response: { status: number }
}

export function useAuthorProfileRequest() {
  const client = useLbApiClient()
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
  return { load: request }
}
