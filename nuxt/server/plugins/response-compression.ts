import { constants, brotliCompressSync } from "node:zlib"

import {
  getRequestHeader,
  getResponseHeader,
  getResponseStatus,
  removeResponseHeader,
  setResponseHeader
} from "h3"

const minimumCompressibleCharacters = 1_024

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("beforeResponse", (event, response) => {
    if (
      typeof response.body !== "string"
      || getResponseStatus(event) !== 200
      || event.path.startsWith("/__nuxt_error")
      || response.body.length < minimumCompressibleCharacters
      || getResponseHeader(event, "content-encoding")
      || !getRequestHeader(event, "accept-encoding")?.split(",")
        .some(encoding => encoding.trim().split(";", 1)[0] === "br")
    ) return

    const contentType = getResponseHeader(event, "content-type")
    if (typeof contentType !== "string" || !contentType.startsWith("text/html")) return

    response.body = brotliCompressSync(Buffer.from(response.body), {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 4
      }
    })
    removeResponseHeader(event, "content-length")
    setResponseHeader(event, "content-encoding", "br")
    const vary = getResponseHeader(event, "vary")
    const varyValue = Array.isArray(vary) ? vary.join(", ") : vary === undefined ? "" : String(vary)
    if (!varyValue.split(",").some(value => value.trim().toLowerCase() === "accept-encoding")) {
      setResponseHeader(
        event,
        "vary",
        varyValue ? `${varyValue}, Accept-Encoding` : "Accept-Encoding"
      )
    }
  })
})
