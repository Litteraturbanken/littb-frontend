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
  const source = await fetchManagedText(
    `${base}${aboutPages[page].contentPath}`,
    managedAboutTextRules(base)
  )
  setResponseHeader(event, "content-type", "text/plain; charset=utf-8")
  setResponseHeader(event, "x-content-type-options", "nosniff")
  return extractAboutBody(source)
})
