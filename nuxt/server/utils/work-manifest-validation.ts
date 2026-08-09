import type {
  EditorManifestResponse,
  ReaderManifestResponse
} from "../../shared/types/work-manifest"
import type { ReaderMediaType } from "../../shared/types/reader"
import {
  boundedString,
  isReaderSourceRecord,
  safeNonnegativeInteger
} from "./reader-source-info-validation"

type UnknownRecord = Record<string, unknown>

const maximumManifestItems = 100_000
const contributionRoles = new Set<unknown>([
  null, "editor", "translator", "illustrator", "photographer"
])
const facsimileSizes = new Set<unknown>([1, 2, 3, 4, 5])

function passes(...checks: boolean[]): boolean {
  return checks.every(Boolean)
}

function boundedArray(value: unknown, minimum = 0, maximum = maximumManifestItems): value is unknown[] {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum
}

function manifestText(value: unknown, maximum = 2_000): value is string {
  return boundedString(value, maximum)
}

function optionalManifestText(value: unknown, maximum = 2_000): value is string | null {
  return value === null || boundedString(value, maximum, true)
}

function manifestIndex(value: unknown): value is number {
  return safeNonnegativeInteger(value) && value < maximumManifestItems
}

function positiveManifestInteger(value: unknown): value is number {
  return manifestIndex(value) && value > 0
}

function strictlyIncreasing(values: readonly number[]): boolean {
  return values.slice(1).every((value, index) => values[index]! < value)
}

function validPage(value: unknown, facsimile: boolean): boolean {
  if (!isReaderSourceRecord(value)) return false
  return passes(
    manifestIndex(value.page_index),
    manifestText(value.page_name, 100),
    !facsimile || manifestIndex(value.image_number)
  )
}

function validPages(value: unknown, facsimile: boolean, minimum = 0): value is unknown[] {
  if (!boundedArray(value, minimum)) return false
  if (!value.every(page => validPage(page, facsimile))) return false
  const indexes = value.flatMap(page => (
    isReaderSourceRecord(page) && typeof page.page_index === "number"
      ? [page.page_index]
      : []
  ))
  const names = value.flatMap(page => (
    isReaderSourceRecord(page) && typeof page.page_name === "string"
      ? [page.page_name]
      : []
  ))
  return strictlyIncreasing(indexes) && new Set(names).size === names.length
}

function pageIdentityExists(pages: unknown, pageIndex: unknown, pageName: unknown): boolean {
  return Array.isArray(pages) && pages.some(page => (
    isReaderSourceRecord(page)
    && page.page_index === pageIndex
    && page.page_name === pageName
  ))
}

function validContributionRole(value: unknown): boolean {
  return contributionRoles.has(value)
}

function validContributor(value: unknown): boolean {
  if (!isReaderSourceRecord(value)) return false
  return passes(
    manifestText(value.author_id, 200),
    manifestText(value.full_name),
    validContributionRole(value.author_type),
    validContributionRole(value.role)
  )
}

function validContributors(value: unknown, minimum: number): value is unknown[] {
  if (!boundedArray(value, minimum, 1_000) || !value.every(validContributor)) return false
  const authorIds = value.flatMap(contributor => (
    isReaderSourceRecord(contributor) ? [contributor.author_id] : []
  ))
  return new Set(authorIds).size === authorIds.length
}

function firstContributorMatches(value: unknown, authorId: unknown): boolean {
  return Array.isArray(value)
    && isReaderSourceRecord(value[0])
    && value[0].author_id === authorId
}

function validPartAuthor(value: unknown): boolean {
  if (!isReaderSourceRecord(value)) return false
  return passes(
    manifestText(value.author_id, 200),
    optionalManifestText(value.full_name),
    optionalManifestText(value.surname)
  )
}

function orderedPartIndexes(start: unknown, end: unknown): boolean {
  return manifestIndex(start) && manifestIndex(end) && start <= end
}

function validPartAuthors(value: unknown): boolean {
  return boundedArray(value, 0, 1_000) && value.every(validPartAuthor)
}

function validPart(value: unknown, sourceIndex: number, pages: unknown): boolean {
  if (!isReaderSourceRecord(value)) return false
  return passes(
    value.source_index === sourceIndex,
    orderedPartIndexes(value.start_page_index, value.end_page_index),
    manifestText(value.start_page_name, 100),
    manifestText(value.end_page_name, 100),
    pageIdentityExists(pages, value.start_page_index, value.start_page_name),
    pageIdentityExists(pages, value.end_page_index, value.end_page_name),
    manifestText(value.title),
    optionalManifestText(value.nav_title),
    optionalManifestText(value.short_title),
    optionalManifestText(value.title_id),
    validPartAuthors(value.authors)
  )
}

function validParts(value: unknown, pages: unknown): boolean {
  return boundedArray(value, 0, 10_000)
    && value.every((part, index) => validPart(part, index, pages))
}

function validNavigationName(value: unknown): boolean {
  return value === null || manifestText(value, 100)
}

function validSize(value: unknown): boolean {
  if (!isReaderSourceRecord(value)) return false
  return facsimileSizes.has(value.size)
    && typeof value.width === "number"
    && Number.isFinite(value.width)
    && value.width > 0
}

function validSizes(value: unknown, minimum: number): value is unknown[] {
  if (!boundedArray(value, minimum, 5) || !value.every(validSize)) return false
  const sizes = value.flatMap(size => (
    isReaderSourceRecord(size) ? [size.size] : []
  ))
  return new Set(sizes).size === sizes.length
}

function includesSize(value: unknown, preferredSize: unknown): boolean {
  return Array.isArray(value) && value.some(size => (
    isReaderSourceRecord(size) && size.size === preferredSize
  ))
}

function validAlternateMedia(value: unknown, requestedMedia: ReaderMediaType): boolean {
  if (value === null) return true
  if (!isReaderSourceRecord(value)) return false
  const alternateMedia = requestedMedia === "etext" ? "faksimil" : "etext"
  return value.media_type === alternateMedia && validPages(value.pages, false)
}

function validDeclaredPageCount(value: unknown): boolean {
  return value === null || positiveManifestInteger(value)
}

function validReaderScalarFields(value: UnknownRecord): boolean {
  return passes(
    validDeclaredPageCount(value.declared_page_count),
    manifestText(value.display_title),
    optionalManifestText(value.editor_work_id, 200),
    manifestText(value.full_title),
    typeof value.has_dramawebben === "boolean",
    typeof value.has_nya_vagar === "boolean",
    optionalManifestText(value.imprint_year, 200),
    typeof value.is_drama === "boolean",
    positiveManifestInteger(value.page_step),
    typeof value.searchable === "boolean",
    optionalManifestText(value.urn)
  )
}

function validReaderIdentity(
  value: UnknownRecord,
  requestedAuthorId: string,
  requestedTitlePath: string
): boolean {
  return passes(
    value.author_id === requestedAuthorId,
    manifestText(value.author_id, 200),
    value.title_path === requestedTitlePath,
    manifestText(value.title_path, 500),
    manifestText(value.work_id, 200),
    validContributors(value.contributors, 1),
    firstContributorMatches(value.contributors, value.author_id)
  )
}

function validReaderArm(value: UnknownRecord, requestedMedia: ReaderMediaType): boolean {
  if (value.media_type !== requestedMedia) return false
  if (!validPages(value.pages, requestedMedia === "faksimil", 1)) return false
  if (requestedMedia === "etext") return true
  return passes(
    facsimileSizes.has(value.preferred_size),
    validSizes(value.sizes, 1),
    includesSize(value.sizes, value.preferred_size)
  )
}

export function isReaderManifestResponse(
  value: unknown,
  requestedAuthorId: string,
  requestedTitlePath: string,
  requestedMedia: ReaderMediaType
): value is ReaderManifestResponse {
  if (!isReaderSourceRecord(value)) return false
  return passes(
    validReaderIdentity(value, requestedAuthorId, requestedTitlePath),
    validReaderScalarFields(value),
    validReaderArm(value, requestedMedia),
    validAlternateMedia(value.alternate_media, requestedMedia),
    validNavigationName(value.start_page_name),
    validNavigationName(value.end_page_name),
    validParts(value.parts, value.pages)
  )
}

function validDenseBounds(value: UnknownRecord): boolean {
  return value.kind === "dense" && positiveManifestInteger(value.page_count)
}

function validSparseBounds(value: UnknownRecord): boolean {
  if (value.kind !== "sparse" || !boundedArray(value.page_indexes, 1)) return false
  if (!value.page_indexes.every(manifestIndex)) return false
  return strictlyIncreasing(value.page_indexes)
}

function validBounds(value: unknown): boolean {
  return isReaderSourceRecord(value)
    && (validDenseBounds(value) || validSparseBounds(value))
}

function validPublicReaderTarget(value: unknown): boolean {
  if (value === null) return true
  if (!isReaderSourceRecord(value)) return false
  return passes(
    manifestText(value.author_id, 200),
    manifestText(value.title_path, 500),
    manifestText(value.start_page_name, 100),
    value.media_type === "etext" || value.media_type === "faksimil"
  )
}

function validEditorComplete(value: UnknownRecord): boolean {
  return passes(
    manifestText(value.display_title),
    manifestText(value.title_path, 500),
    validContributors(value.contributors, 0),
    validPages(value.pages, false),
    validParts(value.parts, value.pages),
    validNavigationName(value.start_page_name),
    validNavigationName(value.end_page_name),
    typeof value.searchable === "boolean",
    optionalManifestText(value.imprint_year, 200),
    validSizes(value.sizes, 0),
    validPublicReaderTarget(value.public_reader_target)
  )
}

export function isEditorManifestResponse(
  value: unknown,
  requestedWorkId: string,
  requestedMedia: ReaderMediaType
): value is EditorManifestResponse {
  if (!isReaderSourceRecord(value)) return false
  if (!passes(
    value.work_id === requestedWorkId,
    manifestText(value.work_id, 200),
    value.media_type === requestedMedia,
    validBounds(value.bounds)
  )) return false
  if (value.status === "page_bounds_only") return true
  return value.status === "complete" && validEditorComplete(value)
}
