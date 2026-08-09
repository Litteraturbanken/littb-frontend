import { createError, type H3Event } from "h3"
import type { PathSerializer } from "openapi-fetch"

import { createLbApiClient } from "../../app/lib/api/client"
import type {
  EditorManifestResponse,
  ReaderManifestResponse
} from "../../shared/types/work-manifest"
import type { ReaderMediaType } from "../../shared/types/reader"
import {
  isEditorManifestResponse,
  isReaderManifestResponse
} from "./work-manifest-validation"

function readerPageNotFound(): never {
  throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
}

function invalidReaderSource(): never {
  throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
}

function unavailableReaderSource(): never {
  throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" })
}

function editorPageNotFound(): never {
  throw createError({ statusCode: 404, statusMessage: "Editor page not found" })
}

function invalidEditorSource(): never {
  throw createError({ statusCode: 502, statusMessage: "Invalid Editor source" })
}

function unavailableEditorSource(): never {
  throw createError({ statusCode: 502, statusMessage: "Editor source unavailable" })
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

const manifestPathSerializer: PathSerializer = (pathname, pathParams) => (
  pathname.replace(/\{([^{}]+)\}/gu, (_placeholder, name: string) => {
    const value = pathParams[name]
    if (typeof value !== "string") throw new TypeError("Invalid work manifest identity")
    return encodeRfc3986Segment(value)
  })
)

export function editorCloseHref(
  target: Extract<EditorManifestResponse, { status: "complete" }>["public_reader_target"]
): string | null {
  if (target === null) return null
  return [
    "/f%C3%B6rfattare",
    encodeRfc3986Segment(target.author_id),
    "titlar",
    encodeRfc3986Segment(target.title_path),
    "sida",
    encodeRfc3986Segment(target.start_page_name),
    encodeRfc3986Segment(target.media_type)
  ].join("/")
}

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
    pathSerializer: manifestPathSerializer
  })
  let result: Awaited<ReturnType<typeof request>>
  try {
    result = await request()
  } catch (error) {
    if (isAbortError(error)) throw error
    if (error instanceof SyntaxError) invalidReaderSource()
    unavailableReaderSource()
  }

  if (result.data !== undefined) {
    const data: unknown = result.data
    if (!isReaderManifestResponse(data, authorId, titlePath, mediaType)) {
      invalidReaderSource()
    }
    return data
  }
  if (result.response.status === 404 || result.response.status === 422) {
    readerPageNotFound()
  }
  if (result.response.status === 503) unavailableReaderSource()
  invalidReaderSource()
}

export async function fetchEditorManifest(
  event: H3Event,
  workId: string,
  mediaType: ReaderMediaType
): Promise<EditorManifestResponse> {
  const client = createLbApiClient(useRuntimeConfig(event).apiBase)
  const request = () => client.GET("/works/{work_id}/editor-manifest", {
    params: {
      path: { work_id: workId },
      query: { media_type: mediaType }
    },
    pathSerializer: manifestPathSerializer
  })
  let result: Awaited<ReturnType<typeof request>>
  try {
    result = await request()
  } catch (error) {
    if (isAbortError(error)) throw error
    if (error instanceof SyntaxError) invalidEditorSource()
    unavailableEditorSource()
  }

  if (result.data !== undefined) {
    const data: unknown = result.data
    if (!isEditorManifestResponse(data, workId, mediaType)) invalidEditorSource()
    return data
  }
  if (result.response.status === 404 || result.response.status === 422) {
    editorPageNotFound()
  }
  if (result.response.status === 503) unavailableEditorSource()
  invalidEditorSource()
}
