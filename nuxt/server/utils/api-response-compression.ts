import {
  getHeader,
  getResponseHeader,
  setResponseHeader,
  type H3Event
} from "h3"

import { acceptsGzipEncoding } from "./response-compression"

function allowsTransformation(cacheControl: string | null | undefined): boolean {
  return !cacheControl?.split(",").some(value => value.trim().toLowerCase() === "no-transform")
}

function eligibleJsonResponse(event: H3Event, response: Response): boolean {
  if (event.method === "HEAD" || response.status !== 200) return false
  if (getHeader(event, "range") || response.headers.has("content-range")) return false
  if (!allowsTransformation(getHeader(event, "cache-control"))) return false
  if (!allowsTransformation(response.headers.get("cache-control"))) return false
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (contentType !== "application/json" && !contentType?.endsWith("+json")) return false
  const length = response.headers.has("content-encoding") ? null : response.headers.get("content-length")
  return length === null || Number(length) >= 1024
}

export function compressApiResponse(event: H3Event, response: Response): ReadableStream<Uint8Array> | null {
  if (!response.body || !eligibleJsonResponse(event, response)) return response.body
  const vary = String(getResponseHeader(event, "vary") ?? "")
  const tokens = vary.split(",").map(value => value.trim().toLowerCase())
  if (!tokens.includes("*") && !tokens.includes("accept-encoding")) {
    setResponseHeader(event, "vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding")
  }
  if (!acceptsGzipEncoding(getHeader(event, "accept-encoding"))) return response.body

  setResponseHeader(event, "content-encoding", "gzip")
  const etag = response.headers.get("etag")
  if (etag && !etag.startsWith("W/")) setResponseHeader(event, "etag", `W/${etag}`)
  return response.body.pipeThrough(new CompressionStream("gzip"))
}
