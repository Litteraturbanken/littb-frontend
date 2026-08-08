import { constants, brotliCompressSync } from "node:zlib"

import {
  getRequestHeader,
  getResponseHeader,
  getResponseStatus,
  removeResponseHeader,
  setResponseHeader
} from "h3"
import { acceptsBrotliEncoding } from "#server/utils/response-compression"

const minimumCompressibleCharacters = 1_024

function isCompressibleHtmlResponse(
  event: Parameters<typeof getResponseStatus>[0],
  body: unknown
): body is string {
  if (typeof body !== "string" || body.length < minimumCompressibleCharacters) return false
  if (getResponseStatus(event) !== 200 || event.path.startsWith("/__nuxt_error")) return false
  if (getResponseHeader(event, "content-encoding")) return false
  if (!acceptsBrotliEncoding(getRequestHeader(event, "accept-encoding"))) return false
  const contentType = getResponseHeader(event, "content-type")
  return typeof contentType === "string" && contentType.startsWith("text/html")
}

function appendAcceptEncodingVary(event: Parameters<typeof getResponseStatus>[0]): void {
  const vary = getResponseHeader(event, "vary")
  const value = Array.isArray(vary) ? vary.join(", ") : vary === undefined ? "" : String(vary)
  if (value.split(",").some(entry => entry.trim().toLowerCase() === "accept-encoding")) return
  setResponseHeader(event, "vary", value ? `${value}, Accept-Encoding` : "Accept-Encoding")
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("beforeResponse", (event, response) => {
    if (!isCompressibleHtmlResponse(event, response.body)) return

    response.body = brotliCompressSync(Buffer.from(response.body), {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 4
      }
    })
    removeResponseHeader(event, "content-length")
    setResponseHeader(event, "content-encoding", "br")
    appendAcceptEncodingVary(event)
  })
})
