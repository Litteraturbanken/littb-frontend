import { createError, defineEventHandler, readBody, setResponseHeader } from "h3"
import { editorialRedirectTable } from "../utils/editorial-redirect-lookup"
import { resolveEditorialPath } from "../utils/editorial-redirects"

export default defineEventHandler(async event => {
  setResponseHeader(event, "Cache-Control", "no-store")
  const body: unknown = await readBody(event)
  if (!body || typeof body !== "object" || !("paths" in body)
    || !Array.isArray(body.paths) || body.paths.length > 1000
    || !body.paths.every((path: unknown) => typeof path === "string" && path.length <= 4096)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid redirect paths" })
  }
  const table = await editorialRedirectTable(useRuntimeConfig(event).apiBase)
  const redirects: Record<string, string> = {}
  for (const path of body.paths as string[]) {
    const target = resolveEditorialPath(path, table)
    if (target) redirects[path] = target
  }
  return redirects
})
