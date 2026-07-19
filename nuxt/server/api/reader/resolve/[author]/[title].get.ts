import type { ReaderRouteResolution } from "#shared/types/reader"

import { createLbApiClient } from "../../../../../app/lib/api/client"
import {
  fetchWorkSourceInfo,
  parseReaderSourceInfoRequest
} from "../../../../utils/reader-source-info"

function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  const request = parseReaderSourceInfoRequest(
    getRouterParam(event, "author", { decode: true }),
    getRouterParam(event, "title", { decode: true }),
    getQuery(event)
  )
  const client = createLbApiClient(useRuntimeConfig(event).apiBase)
  const source = await fetchWorkSourceInfo(
    client,
    request.authorId,
    request.titlePath,
    request.mediaType
  )
  if (
    (source.media_type !== "etext" && source.media_type !== "faksimil")
    || source.start_page === null
  ) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }

  const canonicalPath = [
    "/författare",
    encodeRfc3986Segment(source.author_id),
    "titlar",
    encodeRfc3986Segment(source.title_path),
    "sida",
    encodeRfc3986Segment(source.start_page),
    source.media_type
  ].join("/")

  return {
    authorId: source.author_id,
    canonicalPath,
    mediaType: source.media_type,
    startPageName: source.start_page,
    titlePath: source.title_path
  } satisfies ReaderRouteResolution
})
