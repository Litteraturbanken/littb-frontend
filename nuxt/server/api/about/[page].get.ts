import { createError, getRouterParam, setResponseHeader } from "h3"

import { aboutPages, isAboutPageKey } from "#shared/about-pages"
import { fetchManagedText, managedAboutTextRules } from "#shared/utils/managed-text"
import { extractAboutBody } from "#server/utils/about-content"

export default defineEventHandler(async event => {
  const page = getRouterParam(event, "page")
  if (!isAboutPageKey(page)) {
    throw createError({ statusCode: 404, statusMessage: "About page not found" })
  }

  const base = useRuntimeConfig(event).contentBase.replace(/\/$/u, "")
  try {
    const source = await fetchManagedText(
      `${base}${aboutPages[page].contentPath}`,
      managedAboutTextRules(base)
    )
    const body = extractAboutBody(source)
    setResponseHeader(event, "content-type", "text/plain; charset=utf-8")
    setResponseHeader(event, "x-content-type-options", "nosniff")
    return body
  } catch {
    setResponseHeader(event, "cache-control", "no-store")
    throw createError({
      statusCode: 502,
      statusMessage: "Bad Gateway",
      data: { code: "about_content_unavailable" }
    })
  }
})
