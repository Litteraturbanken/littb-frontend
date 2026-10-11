import { defineEventHandler, getQuery, setResponseHeader } from "h3"
import { editorialRedirectTable } from "../utils/editorial-redirect-cache"
import { resolveEditorialPath } from "../utils/editorial-redirects"

export default defineEventHandler(async event => {
  setResponseHeader(event, "Cache-Control", "no-store")
  const path = getQuery(event).path
  if (typeof path !== "string" || path.length > 4096) return { target: null }
  try {
    const table = await editorialRedirectTable(useRuntimeConfig(event).apiBase)
    return { target: resolveEditorialPath(path, table) }
  } catch (error) {
    console.error("Editorial redirect lookup unavailable", error)
    return { target: null }
  }
})
