import {
  defineEventHandler,
  sendRedirect,
  type H3Event
} from "h3"

import { encodeRfc3986Segment } from "../utils/author-document"
import {
  decodeAndValidatePathSegments,
  legacyRouteError,
  matchLegacyReaderSegments,
  normalizeLegacyRouteIdentity,
  resolveLegacyAuthorRoutePrivately
} from "../utils/legacy-author-route"

function rawRequestUrl(event: H3Event): string {
  return event.node.req.url ?? ""
}

function rawRequestPathname(event: H3Event): string {
  return rawRequestUrl(event).split("?", 1)[0] ?? ""
}

function rawRequestSearch(event: H3Event): string {
  const raw = rawRequestUrl(event)
  const queryAt = raw.indexOf("?")
  return queryAt < 0 ? "" : raw.slice(queryAt)
}

export default defineEventHandler(async event => {
  if (event.method !== "GET" && event.method !== "HEAD") return
  const pathname = rawRequestPathname(event)
  if (!pathname.startsWith("/forfattare/")) return

  const segments = decodeAndValidatePathSegments(pathname)
  const reader = matchLegacyReaderSegments(segments)
  const resolution = await resolveLegacyAuthorRoutePrivately(event, {
    normalized_author_id: normalizeLegacyRouteIdentity(segments[1]!),
    normalized_title_id: reader
      ? normalizeLegacyRouteIdentity(reader.title)
      : null,
    media_type: reader?.mediaType ?? null
  })

  segments[0] = "författare"
  segments[1] = resolution.author_id
  if (reader && resolution.title_id) segments[3] = resolution.title_id

  let canonical: string
  try {
    canonical = `/${segments.map(encodeRfc3986Segment).join("/")}${rawRequestSearch(event)}`
  } catch {
    return legacyRouteError(502, "legacy_author_route_unavailable")
  }
  return sendRedirect(event, canonical, 307)
})
