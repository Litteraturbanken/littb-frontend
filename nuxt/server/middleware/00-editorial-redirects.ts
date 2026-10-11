import { defineEventHandler, sendRedirect, setResponseHeader } from "h3"
import { lookupEditorialRedirect } from "../utils/editorial-redirect-lookup"

export default defineEventHandler(async event => {
  if (event.method !== "GET" && event.method !== "HEAD") return
  const url = event.node.req.url ?? ""
  const queryAt = url.indexOf("?")
  const pathname = queryAt < 0 ? url : url.slice(0, queryAt)
  if (!/^\/(?:forfattare|författare|f%C3%B6rfattare)\//iu.test(pathname)) return
  let target
  try { target = await lookupEditorialRedirect(useRuntimeConfig(event).apiBase, pathname) } catch (error) {
    // Preserve ordinary page availability and the existing legacy resolver
    // during a backend outage.
    console.error("Editorial redirects unavailable", error)
    return
  }
  if (!target) return
  setResponseHeader(event, "Cache-Control", "no-store")
  setResponseHeader(event, "X-LB-Redirect", "editorial")
  return sendRedirect(event, target + (queryAt < 0 ? "" : url.slice(queryAt)), 307)
})
