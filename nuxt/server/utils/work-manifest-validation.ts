import type {
  EditorManifestResponse,
  ReaderManifestResponse
} from "../../shared/types/work-manifest"
import type { ReaderMediaType } from "../../shared/types/reader"
import {
  hasC0OrC1Control,
  hasLoneSurrogate
} from "../../shared/utils/text-safety"
import {
  exactKeys,
  isReaderSourceRecord,
  safeNonnegativeInteger
} from "./reader-source-info-validation"

type UnknownRecord = Record<string, unknown>

const maximumManifestItems = 100_000
const contributionRoles = new Set<unknown>([
  null, "editor", "translator", "illustrator", "photographer"
])
const facsimileSizes = new Set<unknown>([1, 2, 3, 4, 5])

const alternateMediaKeys = new Set(["media_type", "pages"])
const contributorKeys = new Set(["author_id", "author_type", "full_name", "role"])
const pageKeys = new Set(["page_index", "page_name"])
const facsimilePageKeys = new Set(["image_number", "page_index", "page_name"])
const partAuthorKeys = new Set(["author_id", "full_name", "surname"])
const partKeys = new Set([
  "authors", "end_page_index", "end_page_name", "nav_title", "short_title",
  "source_index", "start_page_index", "start_page_name", "title", "title_id"
])
const sizeKeys = new Set(["size", "width"])
const publicReaderTargetKeys = new Set([
  "author_id", "media_type", "start_page_name", "title_path"
])
const denseBoundsKeys = new Set(["kind", "page_count"])
const sparseBoundsKeys = new Set(["kind", "page_indexes"])
const readerEtextKeys = new Set([
  "alternate_media", "author_id", "contributors", "declared_page_count",
  "display_title", "editor_work_id", "end_page_name", "full_title",
  "has_dramawebben", "has_nya_vagar", "imprint_year", "is_drama",
  "media_type", "page_step", "pages", "parts", "searchable",
  "start_page_name", "title_path", "urn", "work_id"
])
const readerFacsimileKeys = new Set([
  ...readerEtextKeys,
  "preferred_size",
  "sizes"
])
const editorCompleteKeys = new Set([
  "bounds", "contributors", "display_title", "end_page_name", "imprint_year",
  "media_type", "pages", "parts", "public_reader_target", "searchable",
  "sizes", "start_page_name", "status", "title_path", "work_id"
])
const editorBoundsOnlyKeys = new Set(["bounds", "media_type", "status", "work_id"])

function passes(...checks: boolean[]): boolean {
  return checks.every(Boolean)
}

function boundedArray(
  value: unknown,
  minimum = 0,
  maximum = maximumManifestItems
): value is unknown[] {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum
}

function stringWithin(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && [...value].length >= 1
    && [...value].length <= maximum
}

function manifestText(value: unknown, maximum = 2_000): value is string {
  return stringWithin(value, maximum)
    && value === value.trim()
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

function manifestIdentifier(value: unknown): value is string {
  return manifestText(value, 100)
    && value !== "."
    && value !== ".."
    && !value.includes("/")
    && !value.includes("\\")
    && !value.includes("?")
    && !value.includes("#")
}

function manifestPageName(value: unknown): value is string {
  return manifestText(value, 100)
}

function optionalManifestTitle(value: unknown): value is string | null {
  return value === null || manifestText(value)
}

function optionalPageName(value: unknown): value is string | null {
  return value === null || manifestPageName(value)
}

function optionalIdentifier(value: unknown): value is string | null {
  return value === null || manifestIdentifier(value)
}

function optionalUrn(value: unknown): value is string | null {
  return value === null || stringWithin(value, 100)
}

function manifestIndex(value: unknown): value is number {
  return safeNonnegativeInteger(value) && value < maximumManifestItems
}

function partSourceIndex(value: unknown): value is number {
  return safeNonnegativeInteger(value) && value < 10_000
}

function positiveBoundedInteger(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= maximumManifestItems
}

function strictlyIncreasing(values: readonly number[]): boolean {
  return values.slice(1).every((value, index) => values[index]! < value)
}

function validPage(value: unknown, facsimile: boolean): boolean {
  if (!isReaderSourceRecord(value)) return false
  return passes(
    exactKeys(value, facsimile ? facsimilePageKeys : pageKeys),
    manifestIndex(value.page_index),
    manifestPageName(value.page_name),
    !facsimile || manifestIndex(value.image_number)
  )
}

function validPages(value: unknown, facsimile: boolean, minimum = 0): value is unknown[] {
  if (!boundedArray(value, minimum) || !value.every(page => validPage(page, facsimile))) {
    return false
  }
  const indexes = value.map(page => (page as UnknownRecord).page_index as number)
  const names = value.map(page => (page as UnknownRecord).page_name as string)
  return strictlyIncreasing(indexes) && new Set(names).size === names.length
}

function pageIdentityExists(pages: unknown, pageIndex: unknown, pageName: unknown): boolean {
  return Array.isArray(pages) && pages.some(page => (
    isReaderSourceRecord(page)
    && page.page_index === pageIndex
    && page.page_name === pageName
  ))
}

function pageNameExists(pages: unknown, pageName: unknown): boolean {
  return Array.isArray(pages) && pages.some(page => (
    isReaderSourceRecord(page) && page.page_name === pageName
  ))
}

function validContributionRole(value: unknown): boolean {
  return contributionRoles.has(value)
}

function validContributor(value: unknown): boolean {
  if (!isReaderSourceRecord(value)) return false
  return passes(
    exactKeys(value, contributorKeys),
    manifestIdentifier(value.author_id),
    manifestText(value.full_name),
    validContributionRole(value.author_type),
    validContributionRole(value.role)
  )
}

function validContributors(value: unknown, minimum: number): value is unknown[] {
  if (!boundedArray(value, minimum, 100) || !value.every(validContributor)) return false
  const identities = value.map(contributor => {
    const record = contributor as UnknownRecord
    return JSON.stringify([record.author_id, record.author_type, record.role])
  })
  return new Set(identities).size === identities.length
}

function includesContributor(value: unknown, authorId: unknown): boolean {
  return Array.isArray(value) && value.some(contributor => (
    isReaderSourceRecord(contributor) && contributor.author_id === authorId
  ))
}

function validPartAuthor(value: unknown): boolean {
  if (!isReaderSourceRecord(value)) return false
  return passes(
    exactKeys(value, partAuthorKeys),
    manifestIdentifier(value.author_id),
    optionalManifestTitle(value.full_name),
    optionalManifestTitle(value.surname)
  )
}

function orderedPartIndexes(start: unknown, end: unknown): boolean {
  return manifestIndex(start) && manifestIndex(end) && start <= end
}

function validPartAuthors(value: unknown): boolean {
  return boundedArray(value, 0, 100) && value.every(validPartAuthor)
}

function validPart(value: unknown, pages: unknown, sourceIndex: number): boolean {
  if (!isReaderSourceRecord(value)) return false
  return passes(
    exactKeys(value, partKeys),
    partSourceIndex(value.source_index) && value.source_index === sourceIndex,
    orderedPartIndexes(value.start_page_index, value.end_page_index),
    manifestPageName(value.start_page_name),
    manifestPageName(value.end_page_name),
    pageIdentityExists(pages, value.start_page_index, value.start_page_name),
    pageIdentityExists(pages, value.end_page_index, value.end_page_name),
    manifestText(value.title),
    optionalManifestTitle(value.nav_title),
    optionalManifestTitle(value.short_title),
    optionalIdentifier(value.title_id),
    validPartAuthors(value.authors)
  )
}

function validParts(value: unknown, pages: unknown): boolean {
  return boundedArray(value, 0, 10_000)
    && value.every((part, sourceIndex) => validPart(part, pages, sourceIndex))
}

function validNavigationName(value: unknown, pages: unknown): boolean {
  return value === null || (manifestPageName(value) && pageNameExists(pages, value))
}

function validSize(value: unknown): boolean {
  if (!isReaderSourceRecord(value)) return false
  return exactKeys(value, sizeKeys)
    && facsimileSizes.has(value.size)
    && typeof value.width === "number"
    && Number.isFinite(value.width)
    && value.width > 0
    && value.width <= 10_000
}

function validSizes(value: unknown, minimum: number): value is unknown[] {
  if (!boundedArray(value, minimum, 5) || !value.every(validSize)) return false
  const sizes = value.map(size => (size as UnknownRecord).size)
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
  return exactKeys(value, alternateMediaKeys)
    && value.media_type === alternateMedia
    && validPages(value.pages, false, 1)
}

function validDeclaredPageCount(value: unknown): boolean {
  return value === null || positiveBoundedInteger(value)
}

function validReaderScalarFields(value: UnknownRecord): boolean {
  return passes(
    validDeclaredPageCount(value.declared_page_count),
    manifestText(value.display_title),
    optionalIdentifier(value.editor_work_id),
    manifestText(value.full_title),
    typeof value.has_dramawebben === "boolean",
    typeof value.has_nya_vagar === "boolean",
    optionalPageName(value.imprint_year),
    typeof value.is_drama === "boolean",
    positiveBoundedInteger(value.page_step),
    typeof value.searchable === "boolean",
    optionalUrn(value.urn)
  )
}

function validReaderIdentity(
  value: UnknownRecord,
  requestedAuthorId: string,
  requestedTitlePath: string
): boolean {
  return passes(
    value.author_id === requestedAuthorId,
    manifestIdentifier(value.author_id),
    value.title_path === requestedTitlePath,
    manifestIdentifier(value.title_path),
    manifestIdentifier(value.work_id),
    validContributors(value.contributors, 1),
    includesContributor(value.contributors, value.author_id)
  )
}

function validReaderArm(value: UnknownRecord, requestedMedia: ReaderMediaType): boolean {
  if (value.media_type !== requestedMedia) return false
  if (!exactKeys(value, requestedMedia === "etext" ? readerEtextKeys : readerFacsimileKeys)) {
    return false
  }
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
    validReaderArm(value, requestedMedia),
    validReaderIdentity(value, requestedAuthorId, requestedTitlePath),
    validReaderScalarFields(value),
    validAlternateMedia(value.alternate_media, requestedMedia),
    validNavigationName(value.start_page_name, value.pages),
    validNavigationName(value.end_page_name, value.pages),
    validParts(value.parts, value.pages)
  )
}

function validDenseBounds(value: UnknownRecord): boolean {
  return exactKeys(value, denseBoundsKeys)
    && value.kind === "dense"
    && positiveBoundedInteger(value.page_count)
}

function validSparseBounds(value: UnknownRecord): boolean {
  if (!exactKeys(value, sparseBoundsKeys)
    || value.kind !== "sparse"
    || !boundedArray(value.page_indexes, 1)
    || !value.page_indexes.every(manifestIndex)
  ) return false
  return strictlyIncreasing(value.page_indexes)
}

function validBounds(value: unknown): value is UnknownRecord {
  return isReaderSourceRecord(value)
    && (validDenseBounds(value) || validSparseBounds(value))
}

function validPublicReaderTarget(value: unknown): boolean {
  if (value === null) return true
  if (!isReaderSourceRecord(value)) return false
  return passes(
    exactKeys(value, publicReaderTargetKeys),
    manifestIdentifier(value.author_id),
    manifestIdentifier(value.title_path),
    manifestPageName(value.start_page_name),
    value.media_type === "etext" || value.media_type === "faksimil"
  )
}

function pagesMatchBounds(pages: unknown[], bounds: UnknownRecord): boolean {
  const indexes = pages.map(page => (page as UnknownRecord).page_index as number)
  if (bounds.kind === "dense") {
    const pageCount = bounds.page_count
    return typeof pageCount === "number"
      && indexes.every(index => index < pageCount)
  }
  const pageIndexes = bounds.page_indexes
  return Array.isArray(pageIndexes)
    && indexes.length === pageIndexes.length
    && indexes.every((index, position) => index === pageIndexes[position])
}

function validEditorComplete(value: UnknownRecord, bounds: UnknownRecord): boolean {
  if (!exactKeys(value, editorCompleteKeys)
    || !validPages(value.pages, false)
    || !pagesMatchBounds(value.pages, bounds)
  ) return false
  return passes(
    manifestText(value.display_title),
    manifestIdentifier(value.title_path),
    validContributors(value.contributors, 1),
    validParts(value.parts, value.pages),
    validNavigationName(value.start_page_name, value.pages),
    validNavigationName(value.end_page_name, value.pages),
    typeof value.searchable === "boolean",
    optionalPageName(value.imprint_year),
    validSizes(value.sizes, 0),
    validPublicReaderTarget(value.public_reader_target)
  )
}

export function isEditorManifestResponse(
  value: unknown,
  requestedWorkId: string,
  requestedMedia: ReaderMediaType
): value is EditorManifestResponse {
  if (!isReaderSourceRecord(value)
    || value.work_id !== requestedWorkId
    || !manifestIdentifier(value.work_id)
    || value.media_type !== requestedMedia
    || !validBounds(value.bounds)
  ) return false
  if (value.status === "page_bounds_only") {
    return exactKeys(value, editorBoundsOnlyKeys)
  }
  return value.status === "complete" && validEditorComplete(value, value.bounds)
}
