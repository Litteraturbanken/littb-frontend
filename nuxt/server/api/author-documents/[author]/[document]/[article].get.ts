import { createError, defineEventHandler, getRouterParam, setHeader } from "h3"

import { isSlaArticleId } from "../../../../../shared/types/sla-article"
import {
  encodeRfc3986Segment,
  validManagedSegment
} from "../../../../utils/author-document"
import { loadSlaArticle, slaArticleError } from "../../../../utils/sla-article"

function requiredParam(
  event: Parameters<typeof getRouterParam>[0],
  name: string
): string {
  const value = getRouterParam(event, name, { decode: false })
  if (!value) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" })
  }
  return value
}

function requireCanonicalRequestPath(
  event: Parameters<typeof getRouterParam>[0],
  author: string,
  document: string,
  article: string
): void {
  const rawPath = (event.node.req.url ?? "").split("?", 1)[0]
  let expected: string
  try {
    expected = "/nuxt-api/author-documents/"
      + [author, document, article].map(encodeRfc3986Segment).join("/")
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Not Found" })
  }
  if (rawPath !== expected) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" })
  }
}

export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  const author = requiredParam(event, "author")
  if (!validManagedSegment(author) || author !== "LagerlöfS") {
    return slaArticleError(404, "sla_article_not_found")
  }

  const document = requiredParam(event, "document")
  if (document !== "omtexterna") {
    return slaArticleError(404, "sla_article_not_found")
  }

  const article = requiredParam(event, "article")
  requireCanonicalRequestPath(event, author, document, article)
  if (!isSlaArticleId(article)) {
    return slaArticleError(404, "sla_article_not_found")
  }
  return await loadSlaArticle(event, author, article)
})
