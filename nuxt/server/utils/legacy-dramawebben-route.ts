import { createError, type H3Event } from "h3"

import type { components } from "../../app/lib/api/generated/lbapi"
import {
  encodeValidatedRouteSegment,
  validRouteSegment
} from "../../shared/utils/route-segment"
import { hasC0OrC1Control, hasLoneSurrogate } from "../../shared/utils/text-safety"
import { createServerLbApiClient } from "./server-lb-api-client"

export type LegacyDramawebbenRouteRequest =
  components["schemas"]["LegacyDramawebbenRouteRequest"]
type LegacyDramawebbenRouteResolution =
  components["schemas"]["LegacyDramawebbenRouteResolution"]

type UnknownRecord = Record<string, unknown>
const resolutionKeys = new Set(["location"])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function legacyDramawebbenRouteError(
  statusCode: 404 | 502,
  code: "legacy_dramawebben_route_not_found" | "legacy_dramawebben_route_unavailable"
): never {
  throw createError({
    statusCode,
    statusMessage: statusCode === 404 ? "Not Found" : "Bad Gateway",
    data: { code }
  })
}

function decodeStable(raw: string, maximum: number): string {
  if (raw.length > maximum * 6) {
    return legacyDramawebbenRouteError(404, "legacy_dramawebben_route_not_found")
  }
  let value = raw
  for (let pass = 0; pass < 16; pass += 1) {
    let next: string
    try {
      next = decodeURIComponent(value)
    } catch {
      return legacyDramawebbenRouteError(404, "legacy_dramawebben_route_not_found")
    }
    if (next.length > maximum) {
      return legacyDramawebbenRouteError(404, "legacy_dramawebben_route_not_found")
    }
    if (next === value) return value
    value = next
  }
  return legacyDramawebbenRouteError(404, "legacy_dramawebben_route_not_found")
}

export function decodeLegacyDramawebbenSegment(raw: string): string {
  const decoded = decodeStable(raw, 200)
  if (!validRouteSegment(decoded, 200)) {
    return legacyDramawebbenRouteError(404, "legacy_dramawebben_route_not_found")
  }
  return decoded
}

type ParsedLocalLocation = { rawPathname: string; segments: string[]; url: URL }

function decodedLocationSegments(url: URL): string[] | null {
  const segments: string[] = []
  for (const segment of url.pathname.slice(1).split("/")) {
    try {
      segments.push(decodeURIComponent(segment))
    } catch {
      return null
    }
  }
  return segments
}

function isLocalLocationText(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 2048
    && value.startsWith("/")
    && !value.startsWith("//")
    && !value.includes("\\")
    && !value.includes("#")
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

function parseLocalLocation(value: unknown): ParsedLocalLocation | null {
  if (!isLocalLocationText(value)) return null
  try {
    const url = new URL(value, "http://littb.invalid")
    if (url.origin !== "http://littb.invalid") return null
    const segments = decodedLocationSegments(url)
    const queryStart = value.indexOf("?")
    const rawPathname = queryStart === -1 ? value : value.slice(0, queryStart)
    return segments ? { rawPathname, segments, url } : null
  } catch {
    return null
  }
}

function isAuthorLocation({ segments, url }: ParsedLocalLocation): boolean {
  return segments.length === 3
    && segments[0] === "författare"
    && validRouteSegment(segments[1]!, 100)
    && segments[2] === "dramawebben"
    && url.search === ""
}

function isReaderLocation({ segments, url }: ParsedLocalLocation): boolean {
  return segments.length === 7
    && segments[0] === "författare"
    && validRouteSegment(segments[1]!, 100)
    && segments[2] === "titlar"
    && validRouteSegment(segments[3]!, 200)
    && segments[4] === "sida"
    && validRouteSegment(segments[5]!, 100)
    && ["etext", "faksimil"].includes(segments[6]!)
    && url.search === ""
}

function isPdfLocation({ segments, url }: ParsedLocalLocation): boolean {
  return segments.length === 3
    && segments[0] === "txt"
    && validRouteSegment(segments[1]!, 100)
    && segments[2] === `${segments[1]}.pdf`
    && url.search === ""
}

function decodedQueryPair(pair: string): readonly [string, string] | null {
  const separator = pair.indexOf("=")
  const rawKey = separator === -1 ? pair : pair.slice(0, separator)
  const rawValue = separator === -1 ? "" : pair.slice(separator + 1)
  try {
    return [
      decodeURIComponent(rawKey.replace(/\+/gu, " ")),
      decodeURIComponent(rawValue.replace(/\+/gu, " "))
    ]
  } catch {
    return null
  }
}

function hasExactInformationPath(rawPathname: string): boolean {
  const canonicalRawPathname = rawPathname.replace(
    /%[0-9a-f]{2}/giu,
    escape => escape.toUpperCase()
  )
  return rawPathname === "/dramawebben/pjäser"
    || canonicalRawPathname === "/dramawebben/pj%C3%A4ser"
}

function exactInformationQuery(url: URL): Map<string, string> | null {
  const rawPairs = url.search.slice(1).split("&")
  if (rawPairs.length !== 3) return null
  const values = new Map<string, string>()
  for (const rawPair of rawPairs) {
    const pair = decodedQueryPair(rawPair)
    if (pair === null || values.has(pair[0])) return null
    values.set(...pair)
  }
  if (
    values.size !== 3
    || values.get("om-boken") !== ""
    || !values.has("authorid")
    || !values.has("titlepath")
  ) return null
  return values
}

function normalizedInformationLocation({
  rawPathname,
  segments,
  url
}: ParsedLocalLocation): string | null {
  if (
    !hasExactInformationPath(rawPathname)
    || segments.length !== 2
    || segments[0] !== "dramawebben"
    || segments[1] !== "pjäser"
  ) return null

  const values = exactInformationQuery(url)
  if (values === null) return null
  const authorId = values.get("authorid")!
  const titlePath = values.get("titlepath")!
  if (!validRouteSegment(authorId, 100) || !validRouteSegment(titlePath, 200)) return null

  return "/dramawebben/pj%C3%A4ser?om-boken"
    + `&authorid=${encodeValidatedRouteSegment(authorId)}`
    + `&titlepath=${encodeValidatedRouteSegment(titlePath)}`
}

function normalizedSafeLocalLocation(value: unknown, kind: "play" | "author"): string | null {
  const location = parseLocalLocation(value)
  if (!location) return null
  if (kind === "author") {
    return isAuthorLocation(location) ? `${location.url.pathname}${location.url.search}` : null
  }
  if (isReaderLocation(location) || isPdfLocation(location)) {
    return `${location.url.pathname}${location.url.search}`
  }
  return normalizedInformationLocation(location)
}

export async function resolveLegacyDramawebbenRoutePrivately(
  event: H3Event,
  request: LegacyDramawebbenRouteRequest
): Promise<LegacyDramawebbenRouteResolution | null> {
  const client = createServerLbApiClient(event)
  let result
  try {
    result = await client.POST("/dramawebben/legacy-routes/resolve", {
      body: request,
      redirect: "manual"
    })
  } catch {
    return legacyDramawebbenRouteError(502, "legacy_dramawebben_route_unavailable")
  }

  if (result.response.status === 404) return null
  const value: unknown = result.data
  const location = result.response.status === 200
    && isRecord(value)
    && Object.keys(value).length === resolutionKeys.size
    && Object.keys(value).every(key => resolutionKeys.has(key))
    ? normalizedSafeLocalLocation(value.location, request.kind)
    : null
  if (location === null) {
    return legacyDramawebbenRouteError(502, "legacy_dramawebben_route_unavailable")
  }
  return { location }
}
