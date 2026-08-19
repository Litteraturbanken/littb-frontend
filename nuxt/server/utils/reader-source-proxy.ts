import {
  createError,
  getRequestHeader,
  removeResponseHeader,
  sendProxy,
  setResponseHeader,
  type H3Event
} from "h3"

import { hasC0OrC1Control, hasLoneSurrogate } from "../../shared/utils/text-safety"
import { rawUrlParts } from "../../shared/utils/url-safety"
import { assertProxyMethod } from "./backend-proxy"

const MAX_DECODE_PASSES = 16
const PRODUCTION_PUBLIC_HOST = "litteraturbanken.se"
const readerPrefixes = ["/txt", "/bilder", "/export/faksimil"] as const
type ReaderPrefix = typeof readerPrefixes[number]

const readerRequestHeaderNames = [
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

const readerResponseHeaderNames = [
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

const readerResponseHeaders = new Set<string>(readerResponseHeaderNames)
const redirectStatuses = new Set([300, 301, 302, 303, 307, 308])

function connectionHeaderNames(value: string | null | undefined): Set<string> {
  return new Set((value ?? "")
    .split(",")
    .map(name => name.trim().toLowerCase())
    .filter(Boolean))
}

function invalidReaderConfiguration(): never {
  throw createError({
    statusCode: 500,
    statusMessage: "Invalid Reader source configuration"
  })
}

function invalidReaderPath(): never {
  throw createError({
    statusCode: 400,
    statusMessage: "Invalid Reader source path"
  })
}

function normalizedHostname(value: string): string {
  return value.toLowerCase().replace(/\.$/u, "")
}

function assertReaderSourceText(value: unknown): asserts value is string {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || hasC0OrC1Control(value)
    || hasLoneSurrogate(value)
  ) {
    invalidReaderConfiguration()
  }
  if (
    !/^https?:\/\//u.test(value)
    || ["\\", "?", "#"].some(character => value.includes(character))
  ) {
    invalidReaderConfiguration()
  }
}

function parseReaderSourceUrl(value: string): URL {
  try {
    return new URL(value)
  } catch {
    invalidReaderConfiguration()
  }
}

function assertReaderSourceAuthority(value: string, base: URL): void {
  const authorityStart = value.indexOf("://") + 3
  const pathStart = value.indexOf("/", authorityStart)
  if (
    !["http:", "https:"].includes(base.protocol)
    || !base.hostname
    || base.username
    || base.password
    || (pathStart >= 0 && value.slice(pathStart) !== "/")
  ) {
    invalidReaderConfiguration()
  }
}

function assertNonLoopingProductionOrigin(base: URL, environment: unknown): void {
  if (
    environment === "production"
    && normalizedHostname(base.hostname) === PRODUCTION_PUBLIC_HOST
  ) {
    invalidReaderConfiguration()
  }
}

function readerSourceOrigin(value: unknown, environment: unknown): URL {
  assertReaderSourceText(value)
  const base = parseReaderSourceUrl(value)
  assertReaderSourceAuthority(value, base)
  assertNonLoopingProductionOrigin(base, environment)
  return base
}

function assertSafeRawSegment(rawSegment: string): void {
  let value = rawSegment
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    if (
      !value
      || value === "."
      || value === ".."
      || value.includes("/")
      || value.includes("\\")
      || hasC0OrC1Control(value)
      || hasLoneSurrogate(value)
    ) {
      invalidReaderPath()
    }
    let decoded: string
    try {
      decoded = decodeURIComponent(value)
    } catch {
      invalidReaderPath()
    }
    if (decoded === value) return
    value = decoded
  }
  invalidReaderPath()
}

function readerPrefixForPath(rawPath: string): ReaderPrefix | undefined {
  return readerPrefixes.find(prefix => rawPath.startsWith(`${prefix}/`))
}

function isSafeReaderPath(rawPath: string): boolean {
  const prefix = readerPrefixForPath(rawPath)
  if (!prefix) return false
  try {
    for (const segment of rawPath.slice(prefix.length + 1).split("/")) {
      assertSafeRawSegment(segment)
    }
    return true
  } catch {
    return false
  }
}

function readerRequestTarget(event: H3Event, prefix: string, base: URL): string {
  const { rawPath, rawQuery, hasFragment, hasQuery } = rawUrlParts(
    event.node.req.url ?? ""
  )
  const namespace = `${prefix}/`
  if (hasFragment || !rawPath.startsWith(namespace)) invalidReaderPath()
  for (const segment of rawPath.slice(namespace.length).split("/")) {
    assertSafeRawSegment(segment)
  }
  return `${base.origin}${rawPath}${hasQuery ? `?${rawQuery}` : ""}`
}

function readerRequestHeaders(event: H3Event): Headers {
  const headers = new Headers()
  const hopByHopHeaders = connectionHeaderNames(getRequestHeader(event, "connection"))
  for (const name of readerRequestHeaderNames) {
    if (hopByHopHeaders.has(name)) continue
    const value = getRequestHeader(event, name)
    if (value !== undefined) headers.set(name, value)
  }
  return headers
}

function localReaderRedirect(
  location: string | null,
  target: string,
  base: URL
): string | null {
  if (
    location === null
    || location === ""
    || location !== location.trim()
    || hasC0OrC1Control(location)
    || hasLoneSurrogate(location)
  ) return null

  let resolved: URL
  try {
    resolved = new URL(location, target)
  } catch {
    return null
  }
  if (
    resolved.origin !== base.origin
    || resolved.username
    || resolved.password
    || !isSafeReaderPath(resolved.pathname)
  ) return null
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}

function allowReaderResponseHeaders(
  event: H3Event,
  response: Response,
  target: string,
  base: URL
): void {
  const hopByHopHeaders = connectionHeaderNames(response.headers.get("connection"))
  for (const name of response.headers.keys()) {
    const normalizedName = name.toLowerCase()
    if (
      !readerResponseHeaders.has(normalizedName)
      || hopByHopHeaders.has(normalizedName)
    ) {
      removeResponseHeader(event, name)
    }
  }
  if (!redirectStatuses.has(response.status)) return
  const location = localReaderRedirect(response.headers.get("location"), target, base)
  if (location !== null) setResponseHeader(event, "location", location)
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

export async function proxyReaderSourceRequest(
  event: H3Event,
  prefix: ReaderPrefix
): Promise<unknown> {
  assertProxyMethod(event, ["GET", "HEAD"])
  const config = useRuntimeConfig(event)
  const base = readerSourceOrigin(
    config.readerSourceBase,
    config.deploymentEnvironment
  )
  const target = readerRequestTarget(event, prefix, base)
  const controller = new AbortController()
  const removeAbortListeners = abortOnDisconnect(event, controller)
  try {
    return await sendProxy(event, target, {
      headers: readerRequestHeaders(event),
      fetchOptions: {
        method: event.method,
        redirect: "manual",
        signal: controller.signal
      },
      onResponse: (proxyEvent, response) => {
        allowReaderResponseHeaders(proxyEvent, response, target, base)
      }
    })
  } catch (error) {
    if (controller.signal.aborted) return
    throw error
  } finally {
    removeAbortListeners()
  }
}
