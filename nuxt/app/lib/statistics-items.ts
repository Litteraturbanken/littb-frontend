import type { components } from "./api/generated/lbapi"
import { validRouteSegment } from "./internal-navigation"
import { hasC0OrC1Control, hasLoneSurrogate } from "#shared/utils/text-safety"

type PopularWork = components["schemas"]["PopularWork"]
type PopularEpub = components["schemas"]["PopularEpub"]

const maximumStatisticsTitleLength = 20_000
const maximumStatisticsAuthorNameLength = 2_000
const maximumDownloadIdentityDecodeLayers = 5

function isSafeRouteIdentity(value: unknown, maximum: number): value is string {
  return typeof value === "string" && validRouteSegment(value, maximum)
}

function decodeDownloadPathCharacters(value: string): string {
  return value.replace(/%(?:25|2e|2f|5c)/giu, encoded => {
    switch (encoded.toLowerCase()) {
      case "%25": return "%"
      case "%2e": return "."
      case "%2f": return "/"
      default: return "\\"
    }
  })
}

function isUnsafeDownloadPathIdentity(value: string): boolean {
  return value === "." || value === ".." || /[\\/]/u.test(value)
}

function hasUnsafeDownloadPathIdentity(value: string): boolean {
  let decoded = value
  for (let layer = 0; layer < maximumDownloadIdentityDecodeLayers; layer += 1) {
    if (isUnsafeDownloadPathIdentity(decoded)) return true
    const next = decodeDownloadPathCharacters(decoded)
    if (next === decoded) return false
    decoded = next
  }
  return isUnsafeDownloadPathIdentity(decoded)
    || /%(?:25|2e|2f|5c)/iu.test(decoded)
}

function isSafeDownloadFileIdentity(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximum
    && value === value.trim()
    && !hasUnsafeDownloadPathIdentity(value)
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSafeDisplayText(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximum
    && value === value.trim()
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

function isSafeNullableDisplayText(
  value: unknown,
  maximum: number
): value is string | null {
  return value === null || isSafeDisplayText(value, maximum)
}

function hasSafeStatisticsDisplayFields(
  item: Record<string, unknown>,
  author: Record<string, unknown>
): boolean {
  return isSafeDisplayText(item.title, maximumStatisticsTitleLength)
    && isSafeNullableDisplayText(item.short_title, maximumStatisticsTitleLength)
    && isSafeDisplayText(author.full_name, maximumStatisticsAuthorNameLength)
    && isSafeNullableDisplayText(author.surname, maximumStatisticsAuthorNameLength)
}

function hasSafePopularWorkIdentity(
  item: Record<string, unknown>,
  author: Record<string, unknown>,
  representation: Record<string, unknown>
): boolean {
  return isSafeRouteIdentity(author.author_id, 100)
    && isSafeDownloadFileIdentity(representation.work_id, 100)
    && isSafeDownloadFileIdentity(item.title_id, 200)
    && isSafeRouteIdentity(item.title_path, 200)
    && typeof representation.media_type === "string"
    && ["etext", "faksimil", "pdf"].includes(representation.media_type)
    && (representation.start_page_name === null
      || isSafeRouteIdentity(representation.start_page_name, 512))
}

export function isSafePopularWork(item: unknown): item is PopularWork {
  if (!isRecord(item) || !isRecord(item.author) || !isRecord(item.representation)) return false
  const author = item.author
  const representation = item.representation
  return hasSafePopularWorkIdentity(item, author, representation)
    && hasSafeStatisticsDisplayFields(item, author)
}

export function isSafePopularEpub(item: unknown): item is PopularEpub {
  if (!isRecord(item) || !isRecord(item.author)) return false
  const author = item.author
  return isSafeRouteIdentity(author.author_id, 100)
    && isSafeDownloadFileIdentity(item.title_id, 200)
    && hasSafeStatisticsDisplayFields(item, author)
}
