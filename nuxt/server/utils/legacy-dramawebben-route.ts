import { createError, type H3Event } from "h3"

import { createLbApiClient } from "../../app/lib/api/client"
import type { components } from "../../app/lib/api/generated/lbapi"
import { hasC0OrC1Control, hasLoneSurrogate } from "../../shared/utils/text-safety"

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

function isSafeSegment(value: string, maximum: number): boolean {
  return value.length >= 1 && value.length <= maximum
    && value === value.trim()
    && value !== "." && value !== ".."
    && !value.includes("\\")
    && !value.includes("/")
    && !value.includes("%")
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

export function decodeLegacyDramawebbenSegment(raw: string): string {
  const decoded = decodeStable(raw, 200)
  if (!isSafeSegment(decoded, 200)) {
    return legacyDramawebbenRouteError(404, "legacy_dramawebben_route_not_found")
  }
  return decoded
}

type ParsedLocalLocation = { segments: string[]; url: URL }

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

function parseLocalLocation(value: unknown): ParsedLocalLocation | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 2048
    || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")
    || value.includes("#") || hasC0OrC1Control(value) || hasLoneSurrogate(value)) return null
  try {
    const url = new URL(value, "http://littb.invalid")
    if (url.origin !== "http://littb.invalid") return null
    const segments = decodedLocationSegments(url)
    return segments ? { segments, url } : null
  } catch {
    return null
  }
}

function isAuthorLocation({ segments, url }: ParsedLocalLocation): boolean {
  return segments.length === 3
    && segments[0] === "författare"
    && isSafeSegment(segments[1]!, 100)
    && segments[2] === "dramawebben"
    && url.search === ""
}

function isReaderLocation({ segments, url }: ParsedLocalLocation): boolean {
  return segments.length === 7
    && segments[0] === "författare"
    && isSafeSegment(segments[1]!, 100)
    && segments[2] === "titlar"
    && isSafeSegment(segments[3]!, 200)
    && segments[4] === "sida"
    && isSafeSegment(segments[5]!, 100)
    && ["etext", "faksimil"].includes(segments[6]!)
    && url.search === ""
}

function isPdfLocation({ segments, url }: ParsedLocalLocation): boolean {
  return segments.length === 3
    && segments[0] === "txt"
    && isSafeSegment(segments[1]!, 100)
    && segments[2] === `${segments[1]}.pdf`
    && url.search === ""
}

function isInformationLocation({ segments, url }: ParsedLocalLocation): boolean {
  return segments.length === 2
    && segments[0] === "dramawebben"
    && segments[1] === "pjäser"
    && /^\?om-boken&authorid=[^&=]+&titlepath=[^&=]+$/u.test(url.search)
}

function isSafeLocalLocation(value: unknown, kind: "play" | "author"): value is string {
  const location = parseLocalLocation(value)
  if (!location) return false
  if (kind === "author") return isAuthorLocation(location)
  return isReaderLocation(location) || isPdfLocation(location) || isInformationLocation(location)
}

export async function resolveLegacyDramawebbenRoutePrivately(
  event: H3Event,
  request: LegacyDramawebbenRouteRequest
): Promise<LegacyDramawebbenRouteResolution | null> {
  const client = createLbApiClient(useRuntimeConfig(event).apiBase)
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
  if (
    result.response.status !== 200
    || !isRecord(value)
    || Object.keys(value).length !== resolutionKeys.size
    || Object.keys(value).some(key => !resolutionKeys.has(key))
    || !isSafeLocalLocation(value.location, request.kind)
  ) {
    return legacyDramawebbenRouteError(502, "legacy_dramawebben_route_unavailable")
  }
  const normalized = new URL(value.location, "http://littb.invalid")
  return { location: `${normalized.pathname}${normalized.search}` }
}
