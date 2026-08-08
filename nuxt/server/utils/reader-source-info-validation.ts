import { createError } from "h3"

import type { components } from "../../app/lib/api/generated/lbapi"
import {
  hasC0OrC1Control,
  hasHtmlUnsafeCodeUnit,
  hasLoneSurrogate
} from "../../shared/utils/text-safety"

export type WorkSourceInfoResponse = components["schemas"]["WorkSourceInfoResponse"]
type UnknownRecord = Record<string, unknown>
export type ReaderMediaQuery = "etext" | "faksimil"

const SAFE_STATIC_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/u

const workKeys = new Set([
  "author_id", "authors", "cover", "download_actions", "dramawebben",
  "errata", "imprint", "is_printed", "libris_id", "license_key",
  "media_type", "provenance", "read_actions", "short_title",
  "source_description_author_id", "source_description_html", "start_page",
  "text_type", "title", "title_path", "urn", "work_id",
  "work_introduction_author_id", "work_introduction_html"
])
const authorKeys = new Set([
  "author_id", "author_type", "full_name", "role", "surname", "url"
])
const coverKeys = new Set(["large_url", "small_url"])
const readActionKeys = new Set(["label", "media_type", "url"])
const downloadActionKeys = new Set([
  "filename", "label", "media_type", "size_bytes", "url"
])
const provenanceKeys = new Set(["library", "signum", "use_alternate_text"])
const errataKeys = new Set(["cells_html"])
const dramaKeys = new Set(["facts", "has_introduction", "history_html", "roles"])
const dramaFactKeys = new Set(["key", "value"])
const validDramaFacts = new Set([
  "first_staged", "first_staged_in_sweden", "number_of_pages",
  "number_of_acts", "number_of_roles", "male_roles", "female_roles",
  "other_roles"
])

export function isReaderSourceRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function exactKeys(value: UnknownRecord, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.size && keys.every(key => expected.has(key))
}

export function invalidSourceInfo(): never {
  throw new Error("Invalid Reader source information")
}

export function sourceInfoHttpError(statusCode: 404 | 422 | 502): never {
  throw createError({
    statusCode,
    statusMessage: statusCode === 404
      ? "Not Found"
      : statusCode === 422
        ? "Unprocessable Entity"
        : "Bad Gateway",
    data: {
      code: statusCode === 404
        ? "reader_source_info_not_found"
        : statusCode === 422
          ? "reader_source_info_invalid_request"
          : "reader_source_info_unavailable"
    }
  })
}

export function boundedString(
  value: unknown,
  maximum: number,
  allowEmpty = false
): value is string {
  return typeof value === "string"
    && value.length <= maximum
    && (allowEmpty || value.length > 0)
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

export function optionalString(value: unknown, maximum: number): value is string | null {
  return value === null || boundedString(value, maximum)
}

export function boundedHtmlString(
  value: unknown,
  maximum: number,
  allowEmpty = false
): value is string {
  return typeof value === "string"
    && value.length <= maximum
    && (allowEmpty || value.length > 0)
    && !hasHtmlUnsafeCodeUnit(value)
}

function optionalHtmlString(value: unknown, maximum: number): value is string | null {
  return value === null || boundedHtmlString(value, maximum)
}

export function validSegment(value: unknown, maximum = 200): value is string {
  return boundedString(value, maximum)
    && value === value.trim()
    && value !== "."
    && value !== ".."
    && !value.includes("%")
    && !value.includes("/")
    && !value.includes("\\")
}

function fullyDecode(value: string): string | null {
  let decoded = value
  try {
    for (let pass = 0; pass < 16; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) return decoded
      decoded = next
    }
  } catch {
    return null
  }
  return null
}

function hasTraversal(value: string): boolean {
  const path = (value.split("#", 1)[0] ?? "").split("?", 1)[0] ?? ""
  return path.split("/").some(segment => segment === "." || segment === "..")
}

function hasUnsafeUrlCodeUnit(value: string): boolean {
  return value.includes("\\") || hasC0OrC1Control(value) || hasLoneSurrogate(value)
}

export function safeRootUrl(value: unknown): value is string {
  if (!boundedString(value, 2_000) || value !== value.trim()) return false
  if (!value.startsWith("/") || value.startsWith("//") || hasUnsafeUrlCodeUnit(value)) {
    return false
  }
  const decoded = fullyDecode(value)
  return decoded !== null
    && decoded.startsWith("/")
    && !decoded.startsWith("//")
    && !hasUnsafeUrlCodeUnit(decoded)
    && !hasTraversal(decoded)
}

export function safeHttpUrl(value: unknown): value is string {
  if (!boundedString(value, 2_000) || value !== value.trim()) return false
  const decoded = fullyDecode(value)
  if (decoded === null || hasUnsafeUrlCodeUnit(decoded)) return false
  try {
    const parsed = new URL(decoded)
    return (parsed.protocol === "http:" || parsed.protocol === "https:")
      && parsed.username === ""
      && parsed.password === ""
  } catch {
    return false
  }
}

export function safeStaticFilename(value: unknown): value is string {
  if (typeof value !== "string" || !SAFE_STATIC_FILENAME.test(value)) return false
  const decoded = fullyDecode(value)
  return decoded !== null
    && decoded !== "."
    && decoded !== ".."
    && !decoded.includes("/")
    && !decoded.includes("\\")
    && !hasC0OrC1Control(decoded)
    && !hasLoneSurrogate(decoded)
}

export function validPublicHref(value: string): boolean {
  if (value.startsWith("#")) return !hasUnsafeUrlCodeUnit(value)
  return safeRootUrl(value) || safeHttpUrl(value)
}

export function safeNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
}

export function encodeReaderSourceSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function strictArray(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) invalidSourceInfo()
  return value
}

function validateWorkIdentity(
  value: UnknownRecord,
  requestedTitlePath: string
): { authorId: string, workId: string } {
  if (
    !validSegment(value.work_id)
    || !validSegment(value.author_id)
    || value.title_path !== requestedTitlePath
    || !validSegment(value.title_path)
    || !["etext", "faksimil", "pdf", "infopost"].includes(String(value.media_type))
    || !optionalString(value.start_page, 200)
    || (value.start_page !== null && !validSegment(value.start_page))
  ) invalidSourceInfo()
  return { authorId: value.author_id, workId: value.work_id }
}

function sourceDescriptionIsValid(value: UnknownRecord): boolean {
  return optionalHtmlString(value.source_description_html, 200_000)
    && optionalString(value.source_description_author_id, 200)
    && (value.source_description_author_id === null
      || validSegment(value.source_description_author_id))
}

function introductionIsValid(value: UnknownRecord): boolean {
  return optionalHtmlString(value.work_introduction_html, 200_000)
    && optionalString(value.work_introduction_author_id, 200)
    && (value.work_introduction_author_id === null
      || validSegment(value.work_introduction_author_id))
}

function publicationMetadataIsValid(value: UnknownRecord): boolean {
  return optionalString(value.imprint, 20_000)
    && optionalString(value.urn, 2_000)
    && optionalString(value.libris_id, 200)
    && optionalString(value.license_key, 200)
    && (value.is_printed === null || typeof value.is_printed === "boolean")
}

function validateWorkMetadata(value: UnknownRecord): void {
  if (!boundedString(value.title, 20_000)
    || !optionalString(value.short_title, 20_000)
    || !optionalString(value.text_type, 200)
    || !sourceDescriptionIsValid(value)
    || !introductionIsValid(value)
    || !publicationMetadataIsValid(value)
  ) invalidSourceInfo()
}

function validSourceAuthor(
  item: UnknownRecord,
  authorIds: ReadonlySet<string>
): item is UnknownRecord & { author_id: string } {
  return validSegment(item.author_id)
    && !authorIds.has(item.author_id)
    && boundedString(item.full_name, 20_000)
    && optionalString(item.surname, 20_000)
    && optionalString(item.role, 200)
    && optionalString(item.author_type, 200)
    && safeRootUrl(item.url)
    && item.url === `/författare/${encodeReaderSourceSegment(item.author_id)}`
}

function validateAuthors(value: unknown, canonicalAuthorId: string): void {
  const authors = strictArray(value, 100)
  const authorIds = new Set<string>()
  for (const item of authors) {
    if (!isReaderSourceRecord(item) || !exactKeys(item, authorKeys)) invalidSourceInfo()
    if (!validSourceAuthor(item, authorIds)) invalidSourceInfo()
    authorIds.add(item.author_id)
  }
  if (authors.length > 0 && !authorIds.has(canonicalAuthorId)) invalidSourceInfo()
}

function validateCover(value: unknown, workId: string): void {
  if (!isReaderSourceRecord(value) || !exactKeys(value, coverKeys)) invalidSourceInfo()
  const encodedWorkId = encodeReaderSourceSegment(workId)
  if (
    !safeRootUrl(value.small_url)
    || !safeRootUrl(value.large_url)
    || value.small_url !== `/txt/${encodedWorkId}/${encodedWorkId}_small.jpeg`
    || value.large_url !== `/txt/${encodedWorkId}/${encodedWorkId}_large.jpeg`
  ) invalidSourceInfo()
}

function validateReadActions(value: unknown): void {
  const actions = strictArray(value, 2)
  const media = new Set<string>()
  for (const item of actions) {
    if (!isReaderSourceRecord(item) || !exactKeys(item, readActionKeys)) invalidSourceInfo()
    if (
      (item.media_type !== "etext" && item.media_type !== "faksimil")
      || item.label !== item.media_type
      || media.has(item.media_type)
      || !safeRootUrl(item.url)
      || !item.url.startsWith("/författare/")
      || !item.url.endsWith(`/${item.media_type}`)
    ) invalidSourceInfo()
    media.add(item.media_type)
  }
}

function validDownloadFilename(filename: string, mediaType: "epub" | "pdf"): boolean {
  const length = [...filename].length
  return length >= 1
    && length <= 500
    && !filename.includes("/")
    && !filename.includes("\\")
    && !hasC0OrC1Control(filename)
    && filename.endsWith(`.${mediaType}`)
}

function validDownloadUrl(url: string, mediaType: "epub" | "pdf"): boolean {
  if (mediaType === "epub") return url.startsWith("/txt/epub/") && url.endsWith(".epub")
  return (url.startsWith("/txt/") || url.startsWith("/export/faksimil/"))
    && url.endsWith(".pdf")
}

function validateDownloadAction(value: unknown, media: Set<string>): void {
  if (!isReaderSourceRecord(value) || !exactKeys(value, downloadActionKeys)) {
    invalidSourceInfo()
  }
  if (value.media_type !== "epub" && value.media_type !== "pdf") invalidSourceInfo()
  const filename = String(value.filename)
  if (
    value.label !== value.media_type
    || media.has(value.media_type)
    || !safeRootUrl(value.url)
    || !validDownloadFilename(filename, value.media_type)
    || !validDownloadUrl(value.url, value.media_type)
    || (value.size_bytes !== null && !safeNonnegativeInteger(value.size_bytes))
  ) invalidSourceInfo()
  media.add(value.media_type)
}

function validateDownloadActions(value: unknown): void {
  const media = new Set<string>()
  for (const action of strictArray(value, 2)) validateDownloadAction(action, media)
}

function validateProvenance(value: unknown): void {
  for (const item of strictArray(value, 100)) {
    if (!isReaderSourceRecord(item) || !exactKeys(item, provenanceKeys)) {
      invalidSourceInfo()
    }
    if (
      !boundedString(item.library, 200)
      || item.library !== item.library.trim()
      || !optionalString(item.signum, 20_000)
      || typeof item.use_alternate_text !== "boolean"
    ) invalidSourceInfo()
  }
}

function validateErrata(value: unknown): void {
  for (const row of strictArray(value, 10_000)) {
    if (!isReaderSourceRecord(row) || !exactKeys(row, errataKeys)) invalidSourceInfo()
    for (const cell of strictArray(row.cells_html, 100)) {
      if (!boundedHtmlString(cell, 200_000, true)) invalidSourceInfo()
    }
  }
}

function validateDramaFact(value: unknown, seenFacts: Set<string>): void {
  if (!isReaderSourceRecord(value) || !exactKeys(value, dramaFactKeys)) invalidSourceInfo()
  if (typeof value.key !== "string" || !validDramaFacts.has(value.key)) invalidSourceInfo()
  if (seenFacts.has(value.key) || !boundedString(value.value, 20_000)) invalidSourceInfo()
  seenFacts.add(value.key)
}

function validateDramaRoles(value: unknown): void {
  for (const role of strictArray(value, 1_000)) {
    if (!boundedHtmlString(role, 20_000)) invalidSourceInfo()
  }
}

function validateDramawebben(value: unknown): void {
  if (value === null) return
  if (!isReaderSourceRecord(value) || !exactKeys(value, dramaKeys)) invalidSourceInfo()
  if (
    typeof value.has_introduction !== "boolean"
    || !optionalHtmlString(value.history_html, 200_000)
  ) invalidSourceInfo()
  const seenFacts = new Set<string>()
  for (const fact of strictArray(value.facts, 8)) validateDramaFact(fact, seenFacts)
  validateDramaRoles(value.roles)
}

export function validateReaderSourceInfoResponse(
  value: unknown,
  requestedAuthorId: string,
  requestedTitlePath: string,
  _requestedMediaType: ReaderMediaQuery | null = null
): WorkSourceInfoResponse {
  if (!isReaderSourceRecord(value) || !exactKeys(value, workKeys)) invalidSourceInfo()
  if (!validSegment(requestedAuthorId, 100) || !validSegment(requestedTitlePath, 200)) {
    invalidSourceInfo()
  }
  const { authorId, workId } = validateWorkIdentity(value, requestedTitlePath)
  validateWorkMetadata(value)
  validateAuthors(value.authors, authorId)
  validateCover(value.cover, workId)
  validateReadActions(value.read_actions)
  validateDownloadActions(value.download_actions)
  validateProvenance(value.provenance)
  validateErrata(value.errata)
  validateDramawebben(value.dramawebben)
  return value as WorkSourceInfoResponse
}

export function parseReaderSourceInfoRequest(
  author: unknown,
  title: unknown,
  query: Record<string, unknown>
): { authorId: string, titlePath: string, mediaType: ReaderMediaQuery | null } {
  if (!validSegment(author, 100) || !validSegment(title, 200)) {
    return sourceInfoHttpError(404)
  }
  const queryKeys = Object.keys(query)
  if (queryKeys.some(key => key !== "media_type") || queryKeys.length > 1) {
    return sourceInfoHttpError(422)
  }
  const media = query.media_type
  if (media !== undefined && media !== "etext" && media !== "faksimil") {
    return sourceInfoHttpError(422)
  }
  return { authorId: author, titlePath: title, mediaType: media ?? null }
}
