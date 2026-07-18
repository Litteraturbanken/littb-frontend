import { createError, defineEventHandler, getRouterParam, setHeader } from "h3"

import type { AuthorDocumentKind } from "../../../../shared/types/author-document"
import {
  documentError,
  loadAuthorDocument,
  validManagedSegment
} from "../../../utils/author-document"

function requiredParam(
  event: Parameters<typeof getRouterParam>[0],
  name: string
): string {
  const value = getRouterParam(event, name, { decode: true })
  if (!value) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" })
  }
  return value
}

function documentKind(value: string): AuthorDocumentKind | null {
  return value === "presentation" || value === "bibliografi" || value === "semer"
    ? value
    : null
}

export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  const author = requiredParam(event, "author")
  if (!validManagedSegment(author)) {
    return documentError(404, "author_document_author_not_found")
  }

  const kind = documentKind(requiredParam(event, "document"))
  if (!kind) return documentError(404, "author_document_not_found")
  return await loadAuthorDocument(event, author, kind)
})
