import {
  createError,
  getRequestHeader,
  getRequestURL,
  getRouterParam,
  removeResponseHeader,
  sendProxy,
  type H3Event
} from "h3"

import { assertProxyMethod } from "../../utils/backend-proxy"

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

const hopByHopResponseHeaderNames = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
] as const

function contentRequestHeaders(event: H3Event): Headers {
  const headers = new Headers()
  for (const name of contentRequestHeaderNames) {
    const value = getRequestHeader(event, name)
    if (value !== undefined) headers.set(name, value)
  }
  return headers
}

function stripUnsafeResponseHeaders(event: H3Event, response: Response): void {
  const connectionHeaderNames = response.headers.get("connection")
    ?.split(",")
    .map(name => name.trim())
    .filter(Boolean) ?? []
  for (const name of [
    "set-cookie",
    ...hopByHopResponseHeaderNames,
    ...connectionHeaderNames
  ]) {
    removeResponseHeader(event, name)
  }
}

function safeProxyPath(value: string | undefined): string {
  if (
    !value
    || value.includes("\\")
    || value.split("/").some(segment => !segment || segment === "." || segment === "..")
    || [...value].some(character => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 31 || codePoint === 127
    })
  ) {
    throw createError({ statusCode: 400, statusMessage: "Invalid red asset path" })
  }
  return value.split("/").map(encodeURIComponent).join("/")
}

export default defineEventHandler((event) => {
  assertProxyMethod(event, ["GET", "HEAD"])
  const path = safeProxyPath(getRouterParam(event, "path"))
  const contentBase = useRuntimeConfig(event).contentBase.replace(/\/$/u, "")
  const target = `${contentBase}/red/${path}${getRequestURL(event).search}`
  return sendProxy(event, target, {
    headers: contentRequestHeaders(event),
    fetchOptions: { method: event.method, redirect: "manual" },
    onResponse: stripUnsafeResponseHeaders
  })
})
