import {
  assertMethod,
  createError,
  getHeader,
  getRequestURL,
  readRawBody,
  sendStream,
  setResponseHeader,
  setResponseStatus,
  type H3Event
} from "h3"

import { correlationHeaders } from "./observability"

type ProxyMethod = "GET" | "HEAD" | "POST"

const conditionalRequestHeaders = [
  "cache-control",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-unmodified-since",
  "pragma"
] as const

const rangeRequestHeaders = ["range", "if-range"] as const

const requestHeadersByMethod = {
  GET: ["accept", ...conditionalRequestHeaders, ...rangeRequestHeaders],
  HEAD: ["accept", ...conditionalRequestHeaders, ...rangeRequestHeaders],
  POST: ["accept", ...conditionalRequestHeaders, "content-type"]
} as const satisfies Record<ProxyMethod, readonly string[]>

const responseHeaders = [
  "accept-ranges",
  "allow",
  "cache-control",
  "content-disposition",
  "content-language",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "location",
  "retry-after",
  "vary",
  "www-authenticate"
] as const

export function assertProxyMethod(
  event: H3Event,
  methods: readonly ProxyMethod[]
): void {
  try {
    assertMethod(event, [...methods])
  } catch (error) {
    setResponseHeader(event, "Allow", methods.join(", "))
    throw error
  }
}

function invalidBackendPath(): never {
  throw createError({
    statusCode: 400,
    statusMessage: "Invalid backend path"
  })
}

export function safeBackendPath(value: string | undefined): string {
  if (!value) invalidBackendPath()

  const segments = value.split("/")
  if (
    segments.some(segment => !segment || segment === "." || segment === "..")
    || value.includes("\\")
    || [...value].some(character => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 31 || codePoint === 127
    })
  ) {
    invalidBackendPath()
  }

  return segments.map(encodeURIComponent).join("/")
}

function outboundHeaders(event: H3Event, method: ProxyMethod): Headers {
  const headers = new Headers(correlationHeaders(event))
  for (const name of requestHeadersByMethod[method]) {
    const value = getHeader(event, name)
    if (value) headers.set(name, value)
  }
  return headers
}

function forwardResponseMetadata(event: H3Event, response: Response): void {
  setResponseStatus(event, response.status, response.statusText)
  for (const name of responseHeaders) {
    const value = response.headers.get(name)
    if (value !== null) setResponseHeader(event, name, value)
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

async function proxyBackendTarget(
  event: H3Event,
  target: string
): Promise<void> {
  const method = event.method as ProxyMethod
  const controller = new AbortController()
  const removeAbortListeners = abortOnDisconnect(event, controller)
  try {
    const rawBody = method === "POST" ? await readRawBody(event, false) : undefined
    const body = rawBody === undefined ? undefined : Uint8Array.from(rawBody)
    const response = await fetch(target, {
      method,
      headers: outboundHeaders(event, method),
      body,
      redirect: "manual",
      signal: controller.signal
    })
    forwardResponseMetadata(event, response)
    if (!response.body) {
      event.node.res.end()
      return
    }
    await sendStream(event, response.body)
  } catch (error) {
    if (controller.signal.aborted) return
    throw createError({
      statusCode: 502,
      statusMessage: "Bad Gateway",
      cause: error
    })
  } finally {
    removeAbortListeners()
  }
}

export async function proxyBackendRequest(
  event: H3Event,
  base: string,
  path: string | undefined
): Promise<void> {
  assertProxyMethod(event, ["GET", "HEAD", "POST"])
  const safePath = safeBackendPath(path)
  const target = `${base.replace(/\/$/u, "")}/${safePath}${getRequestURL(event).search}`
  await proxyBackendTarget(event, target)
}

export async function proxyBackendRootRequest(
  event: H3Event,
  base: string
): Promise<void> {
  assertProxyMethod(event, ["GET", "HEAD", "POST"])
  const target = `${base.replace(/\/$/u, "")}/${getRequestURL(event).search}`
  await proxyBackendTarget(event, target)
}
