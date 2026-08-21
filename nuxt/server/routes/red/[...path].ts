import {
  createError,
  getRequestHeader,
  removeResponseHeader,
  sendProxy,
  type H3Event
} from "h3"

import { hasC0OrC1Control, hasLoneSurrogate } from "../../../shared/utils/text-safety"
import { rawUrlParts } from "../../../shared/utils/url-safety"
import { assertProxyMethod } from "../../utils/backend-proxy"
import { contentResourceOrigin } from "../../utils/reader-source-proxy"

const MAX_DECODE_PASSES = 16

const contentRequestHeaderNames = [
  "accept",
  "cache-control",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "if-unmodified-since",
  "pragma",
  "range"
] as const

const contentResponseHeaderNames = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-language",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "vary"
] as const

const contentResponseHeaders = new Set<string>(contentResponseHeaderNames)

function contentRequestHeaders(event: H3Event): Headers {
  const headers = new Headers()
  for (const name of contentRequestHeaderNames) {
    const value = getRequestHeader(event, name)
    if (value !== undefined) headers.set(name, value)
  }
  return headers
}

function allowAssetResponseHeaders(event: H3Event, response: Response): void {
  for (const name of response.headers.keys()) {
    if (!contentResponseHeaders.has(name.toLowerCase())) {
      removeResponseHeader(event, name)
    }
  }
}

function hasUnsafePathSegment(value: string): boolean {
  return !value
    || value === "."
    || value === ".."
    || value.includes("/")
    || value.includes("\\")
    || hasC0OrC1Control(value)
    || hasLoneSurrogate(value)
}

function safeProxySegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value)
    let safetyValue = decoded
    for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
      if (hasUnsafePathSegment(safetyValue)) return null
      const next = decodeURIComponent(safetyValue)
      if (next === safetyValue) return encodeURIComponent(decoded)
      safetyValue = next
    }
  } catch {
    return null
  }
  return null
}

function safeProxyTarget(event: H3Event): { path: string, search: string } {
  const rawTarget = event.node.req.url ?? ""
  const { rawPath, rawQuery, hasFragment, hasQuery } = rawUrlParts(rawTarget)
  const rawPrefix = "/red/"
  if (hasFragment || !rawPath.startsWith(rawPrefix)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid red asset path" })
  }
  const segments = rawPath.slice(rawPrefix.length).split("/")
  const path = segments.map(safeProxySegment)
  if (path.some(segment => segment === null)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid red asset path" })
  }
  return {
    path: path.join("/"),
    search: hasQuery ? `?${rawQuery}` : ""
  }
}

function abortOnDisconnect(event: H3Event, controller: AbortController): () => void {
  const abort = () => controller.abort()
  const abortUnfinishedResponse = () => {
    if (!event.node.res.writableEnded) abort()
  }
  event.node.req.once("aborted", abort)
  event.node.res.once("close", abortUnfinishedResponse)
  return () => {
    event.node.req.off("aborted", abort)
    event.node.res.off("close", abortUnfinishedResponse)
  }
}

export default defineEventHandler(async (event) => {
  assertProxyMethod(event, ["GET", "HEAD"])
  const { path, search } = safeProxyTarget(event)
  const config = useRuntimeConfig(event)
  const contentBase = contentResourceOrigin(
    config.contentBase,
    config.deploymentEnvironment
  )
  const target = `${contentBase.origin}/red/${path}${search}`
  const controller = new AbortController()
  const removeAbortListeners = abortOnDisconnect(event, controller)
  try {
    return await sendProxy(event, target, {
      headers: contentRequestHeaders(event),
      fetchOptions: {
        method: event.method,
        redirect: "manual",
        signal: controller.signal
      },
      onResponse: allowAssetResponseHeaders
    })
  } catch (error) {
    if (controller.signal.aborted) return
    throw error
  } finally {
    removeAbortListeners()
  }
})
