import { defineEventHandler, sendRedirect, setResponseHeader } from "h3"
import { resolveEditorialPath } from "../utils/editorial-redirects"
import { editorialRedirectTable } from "../utils/editorial-redirect-cache"

export default defineEventHandler(async event => {
  if (event.method !== "GET" && event.method !== "HEAD") return
  const url = event.node.req.url ?? ""
  const queryAt = url.indexOf("?")
  const pathname = queryAt < 0 ? url : url.slice(0, queryAt)
  if (!/^\/(?:forfattare|författare|f%C3%B6rfattare)\//iu.test(pathname)) return
  let table
  try { table = await editorialRedirectTable(useRuntimeConfig(event).apiBase) } catch (error) {
    // Preserve ordinary page availability and the existing legacy resolver
    // during a cold-start backend outage.
    console.error("Editorial redirects unavailable", error)
    return
  }
  const target = resolveEditorialPath(pathname, table)
  if (!target) return
  setResponseHeader(event, "Cache-Control", "no-store")
  setResponseHeader(event, "X-LB-Redirect", "editorial")
  return sendRedirect(event, target + (queryAt < 0 ? "" : url.slice(queryAt)), 307)
})
