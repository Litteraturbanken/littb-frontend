import { createError, proxyRequest, type H3Event } from "h3"

import { hasC0OrC1Control, hasLoneSurrogate } from "../../shared/utils/text-safety"
import { rawUrlParts } from "../../shared/utils/url-safety"

const MAX_DECODE_PASSES = 16
const PRODUCTION_PUBLIC_HOST = "litteraturbanken.se"

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

export async function proxyReaderSourceRequest(
  event: H3Event,
  prefix: "/txt" | "/bilder" | "/export/faksimil"
): Promise<unknown> {
  const config = useRuntimeConfig(event)
  const base = readerSourceOrigin(
    config.readerSourceBase,
    config.deploymentEnvironment
  )
  const target = readerRequestTarget(event, prefix, base)
  return await proxyRequest(event, target, {
    headers: { "x-forwarded-host": base.host },
    fetchOptions: { redirect: "manual" }
  })
}
