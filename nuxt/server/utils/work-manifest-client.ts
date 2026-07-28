import { createError, type H3Event } from "h3"
import type { PathSerializer } from "openapi-fetch"

import { createLbApiClient } from "../../app/lib/api/client"
import type { ReaderManifestResponse } from "../../shared/types/work-manifest"
import type { ReaderMediaType } from "../../shared/types/reader"

function readerPageNotFound(): never {
  throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
}

function invalidReaderSource(): never {
  throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
}

function unavailableReaderSource(): never {
  throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" })
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

const readerManifestPathSerializer: PathSerializer = (pathname, pathParams) => (
  pathname.replace(/\{([^{}]+)\}/gu, (_placeholder, name: string) => {
    const value = pathParams[name]
    if (typeof value !== "string") throw new TypeError("Invalid Reader manifest identity")
    return encodeRfc3986Segment(value)
  })
)

export async function fetchReaderManifest(
  event: H3Event,
  authorId: string,
  titlePath: string,
  mediaType: ReaderMediaType
): Promise<ReaderManifestResponse> {
  const client = createLbApiClient(useRuntimeConfig(event).apiBase)
  const request = () => client.GET("/works/{author_id}/{title_path}/manifest", {
    params: {
      path: { author_id: authorId, title_path: titlePath },
      query: { media_type: mediaType }
    },
    pathSerializer: readerManifestPathSerializer
  })
  let result: Awaited<ReturnType<typeof request>>
  try {
    result = await request()
  } catch (error) {
    if (isAbortError(error)) throw error
    if (error instanceof SyntaxError) invalidReaderSource()
    unavailableReaderSource()
  }

  if (result.data !== undefined) return result.data
  if (result.response.status === 404 || result.response.status === 422) {
    readerPageNotFound()
  }
  if (result.response.status === 503) unavailableReaderSource()
  invalidReaderSource()
}
