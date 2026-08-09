import { createError, type H3Event } from "h3"

import type { components } from "../../app/lib/api/generated/lbapi"
import { hasC0OrC1Control, hasLoneSurrogate } from "../../shared/utils/text-safety"
import { createServerLbApiClient } from "./server-lb-api-client"

export type LegacyAuthorRouteRequest =
  components["schemas"]["LegacyAuthorRouteRequest"]
export type LegacyAuthorRouteResolution =
  components["schemas"]["LegacyAuthorRouteResolution"]

type LegacyReaderMatch = {
  title: string
  mediaType: "etext" | "faksimil"
}

type UnknownRecord = Record<string, unknown>
const resolutionKeys = new Set(["author_id", "title_id"])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function legacyRouteError(
  statusCode: 404 | 502,
  code: "legacy_author_route_not_found" | "legacy_author_route_unavailable"
): never {
  throw createError({
    statusCode,
    statusMessage: statusCode === 404 ? "Not Found" : "Bad Gateway",
    data: { code }
  })
}

function decodeStable(raw: string, maximum: number): string {
  let value = raw
  for (let pass = 0; pass < 16; pass += 1) {
    let next: string
    try {
      next = decodeURIComponent(value)
    } catch {
      return legacyRouteError(404, "legacy_author_route_not_found")
    }
    if (next.length > maximum) {
      return legacyRouteError(404, "legacy_author_route_not_found")
    }
    if (next === value) return value
    value = next
  }
  return legacyRouteError(404, "legacy_author_route_not_found")
}

function validDecodedSegment(value: string, maximum: number): boolean {
  return value.length >= 1 && value.length <= maximum
    && value === value.trim()
    && value !== "." && value !== ".."
    && !value.includes("\\")
    && !value.includes("/")
    && !value.includes("%")
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

export function normalizeLegacyRouteIdentity(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "")
}

function legacyReaderShape(segments: string[]): boolean {
  return segments.length === 7
    && segments[0] === "forfattare"
    && segments[2] === "titlar"
    && segments[4] === "sida"
    && ["etext", "faksimil"].includes(segments[6] ?? "")
}

export function decodeAndValidatePathSegments(pathname: string): string[] {
  if (!pathname.startsWith("/forfattare/")) return []
  const raw = pathname.slice(1).split("/")
  if (raw.length < 2 || raw.some(segment => segment.length === 0)) {
    return legacyRouteError(404, "legacy_author_route_not_found")
  }

  // Decode before structural classification so encoded fixed segments cannot
  // bypass the 200-character Reader title boundary.
  const decoded = raw.map(segment => decodeStable(segment, 512))
  const readerShape = legacyReaderShape(decoded)

  for (const [index, segment] of decoded.entries()) {
    const maximum = index === 1 ? 100 : readerShape && index === 3 ? 200 : 512
    if (!validDecodedSegment(segment, maximum)) {
      return legacyRouteError(404, "legacy_author_route_not_found")
    }
  }
  return decoded
}

export function matchLegacyReaderSegments(
  segments: string[]
): LegacyReaderMatch | null {
  if (segments.length !== 7
    || segments[0] !== "forfattare"
    || segments[2] !== "titlar"
    || segments[4] !== "sida"
    || !["etext", "faksimil"].includes(segments[6] ?? "")) return null
  return {
    title: segments[3]!,
    mediaType: segments[6] as "etext" | "faksimil"
  }
}

export function validCanonicalSegment(value: unknown, maximum: number): value is string {
  return typeof value === "string" && validDecodedSegment(value, maximum)
}

export async function resolveLegacyAuthorRoutePrivately(
  event: H3Event,
  request: LegacyAuthorRouteRequest
): Promise<LegacyAuthorRouteResolution> {
  const client = createServerLbApiClient(event)
  let result
  try {
    result = await client.POST("/legacy-author-routes/resolve", {
      body: request,
      redirect: "manual"
    })
  } catch {
    return legacyRouteError(502, "legacy_author_route_unavailable")
  }

  if (result.response.status === 404) {
    return legacyRouteError(404, "legacy_author_route_not_found")
  }
  const value: unknown = result.data
  if (result.response.status !== 200
    || !isRecord(value)
    || Object.keys(value).length !== resolutionKeys.size
    || Object.keys(value).some(key => !resolutionKeys.has(key))
    || !validCanonicalSegment(value.author_id, 100)
    || ((request.normalized_title_id === null) !== (value.title_id === null))
    || (value.title_id !== null && !validCanonicalSegment(value.title_id, 200))) {
    return legacyRouteError(502, "legacy_author_route_unavailable")
  }
  return {
    author_id: value.author_id,
    title_id: value.title_id as string | null
  }
}
