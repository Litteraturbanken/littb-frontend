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

export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  try {
    return await loadDramawebbenDocument(event, requiredDocument(event))
  } catch (error) {
    if (typeof error !== "object" || error === null
      || !("statusCode" in error) || !("data" in error)
      || (error.statusCode !== 404 && error.statusCode !== 502)
      || typeof error.data !== "object" || error.data === null
      || !("code" in error.data)
      || (error.data.code !== "dramawebben_document_not_found"
        && error.data.code !== "dramawebben_document_unavailable")) throw error

    const statusMessage = error.statusCode === 404 ? "Not Found" : "Bad Gateway"
    setResponseStatus(event, error.statusCode, statusMessage)
    setHeader(event, "cache-control", "no-store")
    return {
      statusCode: error.statusCode,
      statusMessage,
      data: { code: error.data.code }
    }
  }
})
