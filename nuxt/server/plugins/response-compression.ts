import { brotliCompress, constants } from "node:zlib"

import {
  getRequestHeader,
  getResponseHeader,
  getResponseStatus,
  removeResponseHeader,
  setResponseHeader
} from "h3"
import { acceptsBrotliEncoding } from "#server/utils/response-compression"

const minimumCompressibleCharacters = 1_024
const brotliOptions = {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 4
  }
}

function compressHtml(body: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    brotliCompress(Buffer.from(body), brotliOptions, (error, result) => {
      if (error) reject(error)
      else resolve(result)
    })
  })
}

function isEligibleHtmlResponse(
  event: Parameters<typeof getResponseStatus>[0],
  body: unknown
): body is string {
  if (typeof body !== "string" || body.length < minimumCompressibleCharacters) return false
  if (event.method !== "GET" && event.method !== "HEAD") return false
  if (getResponseStatus(event) !== 200 || event.path.startsWith("/__nuxt_error")) return false
  if (getResponseHeader(event, "content-encoding")) return false
  const contentType = getResponseHeader(event, "content-type")
  return typeof contentType === "string" && contentType.startsWith("text/html")
}

function appendAcceptEncodingVary(event: Parameters<typeof getResponseStatus>[0]): void {
  const vary = getResponseHeader(event, "vary")
  const value = Array.isArray(vary) ? vary.join(", ") : vary === undefined ? "" : String(vary)
  const seen = new Set<string>()
  const tokens = value.split(",").map(token => token.trim()).filter((token) => {
    if (!token) return false
    const normalized = token.toLowerCase()
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
  if (seen.has("*")) {
    setResponseHeader(event, "vary", "*")
    return
  }
  if (!seen.has("accept-encoding")) tokens.push("Accept-Encoding")
  setResponseHeader(event, "vary", tokens.join(", "))
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("beforeResponse", async (event, response) => {
    if (!isEligibleHtmlResponse(event, response.body)) return
    appendAcceptEncodingVary(event)
    if (!acceptsBrotliEncoding(getRequestHeader(event, "accept-encoding"))) return

    response.body = await compressHtml(response.body)
    removeResponseHeader(event, "content-length")
    setResponseHeader(event, "content-encoding", "br")
  })
})
