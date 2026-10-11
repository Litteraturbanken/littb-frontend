import { defineEventHandler, getQuery, setResponseHeader } from "h3"
import { lookupEditorialRedirect } from "../utils/editorial-redirect-lookup"

export default defineEventHandler(async event => {
  setResponseHeader(event, "Cache-Control", "no-store")
  const path = getQuery(event).path
  if (typeof path !== "string" || path.length > 4096) return { target: null }
  try {
    return { target: await lookupEditorialRedirect(useRuntimeConfig(event).apiBase, path) }
  } catch (error) {
    console.error("Editorial redirect lookup unavailable", error)
    return { target: null }
  }
})
