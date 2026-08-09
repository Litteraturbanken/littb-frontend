import type { H3Event } from "h3"

import type { ReaderSourceInfo } from "../../shared/types/reader-source-info"
import {
  loadCachedReaderSourceInfoStaticDefinitions,
  type ReaderSourceInfoStaticDefinitions
} from "./reader-source-info-definitions"
import { buildReaderSourceInfo } from "./reader-source-info-projection"
import {
  exactKeys,
  isReaderSourceRecord,
  sourceInfoHttpError,
  validateReaderSourceInfoResponse,
  type ReaderMediaQuery,
  type WorkSourceInfoResponse
} from "./reader-source-info-validation"
import {
  createServerLbApiClient,
  type ServerLbApiClient
} from "./server-lb-api-client"

export {
  clearReaderSourceInfoStaticCache,
  fetchReaderSourceInfoStaticDefinitions,
  loadCachedReaderSourceInfoStaticDefinitions
} from "./reader-source-info-definitions"
export type { ReaderSourceInfoStaticDefinitions } from "./reader-source-info-definitions"
export {
  buildReaderSourceInfo,
  projectReaderSourceInfoLicense,
  projectReaderSourceInfoProvenance,
  resolveReaderSourceInfoAttributions
} from "./reader-source-info-projection"
export { sanitizeReaderSourceInfoHtml } from "./reader-source-info-sanitizer"
export {
  parseReaderSourceInfoRequest,
  validateReaderSourceInfoResponse
} from "./reader-source-info-validation"

export async function fetchWorkSourceInfo(
  client: ServerLbApiClient,
  authorId: string,
  titlePath: string,
  mediaType: ReaderMediaQuery | null
): Promise<WorkSourceInfoResponse> {
  const request = () => client.GET(
    "/works/{author_id}/{title_path}/source-info",
    {
      params: {
        path: { author_id: authorId, title_path: titlePath },
        ...(mediaType === null ? {} : { query: { media_type: mediaType } })
      },
      redirect: "manual"
    }
  )
  let result: Awaited<ReturnType<typeof request>>
  try {
    result = await request()
  } catch {
    return sourceInfoHttpError(502)
  }
  if (
    !result.response.ok
    || result.error !== undefined
    || result.data === undefined
  ) {
    return sourceInfoHttpError(result.response.status === 404 ? 404 : 502)
  }
  try {
    return validateReaderSourceInfoResponse(result.data, authorId, titlePath, mediaType)
  } catch {
    return sourceInfoHttpError(502)
  }
}

async function resolveAttributionAuthors(
  client: ServerLbApiClient,
  ids: string[]
): Promise<unknown> {
  const request = () => client.POST("/authors/resolve", {
    body: { author_ids: ids }
  })
  let result: Awaited<ReturnType<typeof request>>
  try {
    result = await request()
  } catch {
    return []
  }
  if (!result.response.ok || result.error !== undefined) return []
  if (result.data === undefined || !isReaderSourceRecord(result.data)) {
    return sourceInfoHttpError(502)
  }
  if (!exactKeys(result.data, new Set(["items"]))) return sourceInfoHttpError(502)
  return result.data.items
}

export async function loadReaderSourceInfo(
  event: H3Event,
  authorId: string,
  titlePath: string,
  mediaType: ReaderMediaQuery | null
): Promise<ReaderSourceInfo> {
  const config = useRuntimeConfig(event)
  const client = createServerLbApiClient(event)
  const source = await fetchWorkSourceInfo(client, authorId, titlePath, mediaType)
  let definitions: ReaderSourceInfoStaticDefinitions
  try {
    definitions = await loadCachedReaderSourceInfoStaticDefinitions(config.contentBase)
  } catch {
    return sourceInfoHttpError(502)
  }
  try {
    return await buildReaderSourceInfo(
      source,
      definitions,
      ids => resolveAttributionAuthors(client, ids)
    )
  } catch {
    return sourceInfoHttpError(502)
  }
}
