import {
  defineEventHandler,
  sendRedirect,
  type H3Event
} from "h3"

import {
  decodeLegacyDramawebbenSegment,
  resolveLegacyDramawebbenRoutePrivately
} from "../utils/legacy-dramawebben-route"

const FALLBACK = "/dramawebben/pj%C3%A4ser/"

function rawRequestPathname(event: H3Event): string {
  return (event.node.req.url ?? "").split("?", 1)[0] ?? ""
}

export default defineEventHandler(async event => {
  if (event.method !== "GET" && event.method !== "HEAD") return
  const match = /^\/dramawebben\/(pjas|forfattare)\/([^/]+)$/u.exec(
    rawRequestPathname(event)
  )
  if (!match) return

  const kind = match[1] === "pjas" ? "play" : "author"
  const legacyUrl = decodeLegacyDramawebbenSegment(match[2]!)
  const resolution = await resolveLegacyDramawebbenRoutePrivately(event, {
    kind,
    legacy_url: legacyUrl
  })
  return sendRedirect(event, resolution?.location ?? FALLBACK, 307)
})
