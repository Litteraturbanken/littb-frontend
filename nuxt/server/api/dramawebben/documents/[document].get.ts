import {
  createError,
  defineEventHandler,
  getRouterParam,
  setHeader,
  setResponseStatus
} from "h3"

import type { DramawebbenDocumentKind } from "../../../../shared/types/dramawebben-document"
import {
  dramawebbenDocumentError,
  loadDramawebbenDocument
} from "../../../utils/dramawebben-document"

function requiredDocument(
  event: Parameters<typeof getRouterParam>[0]
): DramawebbenDocumentKind {
  const value = getRouterParam(event, "document", { decode: true })
  if (!value) throw createError({ statusCode: 404, statusMessage: "Not Found" })
  if (value !== "om" && value !== "kringtexter") {
    return dramawebbenDocumentError(404, "dramawebben_document_not_found")
  }
  return value
}

type DramawebbenDocumentFailure = {
  statusCode: 404 | 502
  code: "dramawebben_document_not_found" | "dramawebben_document_unavailable"
}

function dramawebbenDocumentFailure(error: unknown): DramawebbenDocumentFailure | null {
  if (typeof error !== "object" || error === null
    || !("statusCode" in error) || !("data" in error)
    || (error.statusCode !== 404 && error.statusCode !== 502)
    || typeof error.data !== "object" || error.data === null
    || !("code" in error.data)) return null
  const code = error.data.code
  if (code !== "dramawebben_document_not_found"
    && code !== "dramawebben_document_unavailable") return null
  return { statusCode: error.statusCode, code }
}

export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  try {
    return await loadDramawebbenDocument(event, requiredDocument(event))
  } catch (error) {
    const failure = dramawebbenDocumentFailure(error)
    if (!failure) throw error
    const statusMessage = failure.statusCode === 404 ? "Not Found" : "Bad Gateway"
    setResponseStatus(event, failure.statusCode, statusMessage)
    setHeader(event, "cache-control", "no-store")
    return {
      statusCode: failure.statusCode,
      statusMessage,
      data: { code: failure.code }
    }
  }
})
