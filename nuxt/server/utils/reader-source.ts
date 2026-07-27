import { createError, type H3Event } from "h3"

import type {
  ReaderFacsimileSize,
  ReaderFacsimileSizeSource,
  ReaderFacsimileSource,
  ReaderMediaType,
  ReaderPart,
  ReaderPartAuthor,
  ReaderWorkContributor
} from "../../shared/types/reader"
import { normalizeReaderAuthorContribution } from "../../shared/utils/reader-author"
import { hasC0OrC1Control } from "../../shared/utils/text-safety"

type UnknownRecord = Record<string, unknown>

const MAX_READER_PAGES = 100_000
const MAX_READER_PARTS = 10_000
const MAX_READER_PART_AUTHORS = 100
const MAX_READER_WORK_CONTRIBUTORS = 100
const MAX_READER_ID_LENGTH = 100
const MAX_READER_PAGE_NAME_LENGTH = 100
const MAX_READER_TITLE_LENGTH = 2_000

export interface ReaderSourcePage {
  pageIndex: number
  pageName: string
}

export interface ReaderFacsimileSourcePage extends ReaderSourcePage {
  imageNumber: number
}

interface ReaderWorkMetadataBase {
  alternateMedia: {
    mediaType: ReaderMediaType
    pages: ReaderSourcePage[]
  } | null
  author: ReaderWorkContributor
  base: string
  contributors: ReaderWorkContributor[]
  displayTitle: string
  editorWorkId: string | null
  fullTitle: string
  explicitPageCount: number | null
  hasDramawebben: boolean
  hasNyaVagar: boolean
  imprintYear: string | null
  isDrama: boolean
  endPageName: string | null
  parts: ReaderPart[]
  pageStep: number
  searchable: boolean
  startPageName: string | null
  titlePath: string
  urn: string | null
  workId: string
}

export interface ReaderEtextWorkMetadata extends ReaderWorkMetadataBase {
  mediaType: "etext"
  pages: ReaderSourcePage[]
}

export interface ReaderFacsimileWorkMetadata extends ReaderWorkMetadataBase {
  mediaType: "faksimil"
  pages: ReaderFacsimileSourcePage[]
  preferredSize: ReaderFacsimileSize
  sizes: ReaderFacsimileSizeSource[]
}

export type ReaderWorkMetadata =
  | ReaderEtextWorkMetadata
  | ReaderFacsimileWorkMetadata

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requiredString(record: UnknownRecord, key: string): string | null {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function safeNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function readerPageStep(value: unknown): number {
  const numeric = typeof value === "string" && /^[1-9]\d*$/.test(value)
    ? Number(value)
    : value
  return typeof numeric === "number"
    && Number.isSafeInteger(numeric)
    && numeric > 0
    && numeric <= MAX_READER_PAGES
    ? numeric
    : 1
}

function strictReaderString(value: unknown, maximumLength: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximumLength
    && value.trim() === value
    && !hasC0OrC1Control(value)
}

function hasNyaVagarKeyword(value: unknown): boolean {
  return Array.isArray(value)
    && value.length <= 1_000
    && value.every(keyword => (
      typeof keyword === "string"
      && keyword.length > 0
      && keyword.length <= 200
      && !hasC0OrC1Control(keyword)
    ))
    && value.includes("1800")
}

function readerPages(value: unknown): ReaderSourcePage[] | null {
  if (!Array.isArray(value) || value.length > MAX_READER_PAGES) return null

  const pages: ReaderSourcePage[] = []
  const pageNames = new Set<string>()
  const pageIndexes = new Set<number>()
  for (const page of value) {
    if (!isRecord(page)) return null
    const pageName = requiredString(page, "pagename")
    const pageIndex = page.pageindex
    if (
      !pageName ||
      pageName.length > MAX_READER_PAGE_NAME_LENGTH ||
      !safeNonnegativeInteger(pageIndex) ||
      pageNames.has(pageName) ||
      pageIndexes.has(pageIndex)
    ) return null
    pageNames.add(pageName)
    pageIndexes.add(pageIndex)
    pages.push({ pageName, pageIndex })
  }
  return pages.sort((left, right) => left.pageIndex - right.pageIndex)
}

function facsimilePages(value: unknown): ReaderFacsimileSourcePage[] | null {
  if (!Array.isArray(value) || value.length > MAX_READER_PAGES) return null

  const pages: ReaderFacsimileSourcePage[] = []
  const pageNames = new Set<string>()
  const pageIndexes = new Set<number>()
  for (const page of value) {
    if (!isRecord(page)) return null
    const pageName = requiredString(page, "pagename")
    const pageIndex = page.pageindex
    const imageNumber = page.imagenumber
    if (
      !pageName ||
      pageName.length > MAX_READER_PAGE_NAME_LENGTH ||
      !safeNonnegativeInteger(pageIndex) ||
      !safeNonnegativeInteger(imageNumber) ||
      pageNames.has(pageName) ||
      pageIndexes.has(pageIndex)
    ) return null
    pageNames.add(pageName)
    pageIndexes.add(pageIndex)
    pages.push({ pageName, pageIndex, imageNumber })
  }
  return pages.sort((left, right) => left.pageIndex - right.pageIndex)
}

export function isReaderMediaType(value: unknown): value is ReaderMediaType {
  return value === "etext" || value === "faksimil"
}

function isFacsimileSize(value: number): value is ReaderFacsimileSize {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

function facsimileSizes(representation: UnknownRecord): ReaderFacsimileSizeSource[] | null {
  if (!Array.isArray(representation.faksimil_sizes) || representation.faksimil_sizes.length === 0) {
    return null
  }
  if (!isRecord(representation.width)) return null

  const seen = new Set<number>()
  const sources: ReaderFacsimileSizeSource[] = []
  for (const index of representation.faksimil_sizes) {
    if (!safeNonnegativeInteger(index) || index > 4 || seen.has(index)) return null
    seen.add(index)

    const size = index + 1
    if (!isFacsimileSize(size)) return null
    const width = representation.width[`size_${size}`]
    if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) return null
    sources.push({ size, width })
  }
  return sources.sort((left, right) => left.size - right.size)
}

export function preferredFacsimileSize(
  sources: readonly ReaderFacsimileSizeSource[]
): ReaderFacsimileSize {
  if (sources.length === 0) throw new RangeError("At least one faksimil source is required")
  const sizes = sources.map(source => source.size).sort((left, right) => left - right)
  if (sizes.includes(3)) return 3
  return sizes.filter(size => size < 3).at(-1) ?? sizes[0]!
}

function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

export function facsimileImageUrl(
  workId: string,
  size: ReaderFacsimileSize,
  imageNumber: number
): string {
  if (!isFacsimileSize(size) || !safeNonnegativeInteger(imageNumber)) {
    throw new RangeError("Invalid faksimil source identity")
  }
  const encodedWorkId = encodeRfc3986Segment(workId)
  const encodedImageNumber = encodeRfc3986Segment(String(imageNumber).padStart(4, "0"))
  return [
    "",
    "txt",
    encodedWorkId,
    `${encodedWorkId}_${size}`,
    `${encodedWorkId}_${size}_${encodedImageNumber}.jpeg`
  ].join("/")
}

export function buildFacsimileSources(
  workId: string,
  imageNumber: number,
  sizes: readonly ReaderFacsimileSizeSource[]
): ReaderFacsimileSource[] {
  return sizes
    .map(({ size, width }) => ({
      size,
      url: facsimileImageUrl(workId, size, imageNumber),
      width
    }))
    .sort((left, right) => left.size - right.size)
}

export function facsimileSourcePair(
  sources: readonly ReaderFacsimileSource[],
  size: ReaderFacsimileSize
): { oneX: ReaderFacsimileSource, twoX: ReaderFacsimileSource | null } {
  const oneX = sources.find(source => source.size === size)
  if (!oneX) throw new RangeError("Selected faksimil source is unavailable")
  return {
    oneX,
    twoX: sources.find(source => source.size === size + 2) ?? null
  }
}

async function fetchReaderMetadata(
  base: string,
  path: "/api/get_work_info" | "/get_work_info",
  author: string,
  titlePath: string
): Promise<unknown> {
  try {
    return await $fetch(`${base}${path}`, {
      query: {
        authorid: author,
        exclude: "content_vector",
        titlepath: titlePath
      },
      retry: 0
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" })
  }
}

function invalidReaderSource(): never {
  throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
}

function readerPageNotFound(): never {
  throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
}

function boundedRequiredString(
  record: UnknownRecord,
  key: string,
  maximumLength: number
): string {
  const value = record[key]
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) {
    invalidReaderSource()
  }
  return value
}

function boundedOptionalString(
  record: UnknownRecord,
  key: string,
  maximumLength: number
): string | null {
  if (!Object.hasOwn(record, key)) return null
  const value = record[key]
  if (typeof value !== "string" || value.length > maximumLength) invalidReaderSource()
  return value.length > 0 ? value : null
}

function boundedNullableStrictString(
  record: UnknownRecord,
  key: string,
  maximumLength: number
): string | null {
  if (!Object.hasOwn(record, key) || record[key] === null || record[key] === "") return null
  const value = record[key]
  if (!strictReaderString(value, maximumLength)) invalidReaderSource()
  return value
}

function localPartAuthorSummaries(representation: UnknownRecord): Map<string, ReaderPartAuthor> {
  const summaries = new Map<string, ReaderPartAuthor>()
  if (!Array.isArray(representation.authors)) return summaries

  for (const value of representation.authors) {
    if (!isRecord(value)) continue
    const id = value.authorid
    const name = value.full_name
    if (
      !strictReaderString(id, MAX_READER_ID_LENGTH)
      || !strictReaderString(name, MAX_READER_TITLE_LENGTH)
    ) continue
    const surname = value.surname
    if (
      surname !== undefined
      && surname !== null
      && surname !== ""
      && !strictReaderString(surname, MAX_READER_TITLE_LENGTH)
    ) continue
    summaries.set(id, {
      id,
      name,
      surname: strictReaderString(surname, MAX_READER_TITLE_LENGTH)
        ? surname
        : null
    })
  }
  return summaries
}

function readerWorkContributors(value: unknown): ReaderWorkContributor[] {
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.length > MAX_READER_WORK_CONTRIBUTORS
  ) invalidReaderSource()

  return value.map(contributor => {
    if (!isRecord(contributor)) invalidReaderSource()
    const id = contributor.authorid
    const name = contributor.full_name
    if (
      !strictReaderString(id, MAX_READER_ID_LENGTH)
      || !strictReaderString(name, MAX_READER_TITLE_LENGTH)
    ) invalidReaderSource()
    return {
      authorType: normalizeReaderAuthorContribution(contributor.type),
      id,
      name,
      role: normalizeReaderAuthorContribution(contributor.role)
    }
  })
}

function readerPartAuthors(
  value: unknown,
  localAuthors: ReadonlyMap<string, ReaderPartAuthor>
): ReaderPartAuthor[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > MAX_READER_PART_AUTHORS) invalidReaderSource()

  return value.map(author => {
    if (!isRecord(author)) invalidReaderSource()
    const id = author.authorid
    if (!strictReaderString(id, MAX_READER_ID_LENGTH)) invalidReaderSource()
    return localAuthors.get(id) ?? { id, name: null, surname: null }
  })
}

function readerParts(
  representation: UnknownRecord,
  pages: readonly ReaderSourcePage[]
): ReaderPart[] {
  const value = representation.parts
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > MAX_READER_PARTS) invalidReaderSource()

  const pageIndexes = new Map(pages.map(page => [page.pageName, page.pageIndex]))
  const localAuthors = localPartAuthorSummaries(representation)
  return value.map((rawPart, sourceIndex) => {
    if (!isRecord(rawPart)) invalidReaderSource()
    const startPageName = boundedRequiredString(
      rawPart,
      "startpagename",
      MAX_READER_PAGE_NAME_LENGTH
    )
    const endPageName = boundedRequiredString(
      rawPart,
      "endpagename",
      MAX_READER_PAGE_NAME_LENGTH
    )
    const startPageIndex = pageIndexes.get(startPageName)
    const endPageIndex = pageIndexes.get(endPageName)
    if (
      startPageIndex === undefined ||
      endPageIndex === undefined ||
      startPageIndex > endPageIndex
    ) invalidReaderSource()

    return {
      authors: readerPartAuthors(rawPart.authors, localAuthors),
      endPageIndex,
      endPageName,
      navTitle: boundedOptionalString(rawPart, "navtitle", MAX_READER_TITLE_LENGTH),
      shortTitle: boundedOptionalString(rawPart, "shorttitle", MAX_READER_TITLE_LENGTH),
      sourceIndex,
      startPageIndex,
      startPageName,
      title: boundedRequiredString(rawPart, "title", MAX_READER_TITLE_LENGTH),
      titleId: boundedOptionalString(rawPart, "titleid", MAX_READER_ID_LENGTH)
    }
  })
}

export function resolveReaderPartNavigation(
  parts: readonly ReaderPart[],
  pageIndex: number
): {
  currentPartIndex: number | null
  previousPartPageName: string | null
  nextPartPageName: string | null
} {
  for (const [sourceIndex, part] of parts.entries()) {
    if (part.sourceIndex !== sourceIndex) {
      throw new RangeError("Reader part source indexes must match source order")
    }
  }

  const ordered = [...parts].sort((left, right) => (
    left.startPageIndex - right.startPageIndex || left.sourceIndex - right.sourceIndex
  ))
  const starting = ordered.find(part => part.startPageIndex === pageIndex)
  const active = ordered.filter(part => (
    part.startPageIndex <= pageIndex && pageIndex <= part.endPageIndex
  ))
  const previous = ordered.filter(part => part.startPageIndex <= pageIndex - 1).at(-1)
  const next = ordered.find(part => part.startPageIndex >= pageIndex + 1)
  return {
    currentPartIndex: (starting ?? active.at(-1))?.sourceIndex ?? null,
    previousPartPageName: previous?.startPageName ?? null,
    nextPartPageName: next?.startPageName ?? null
  }
}

function commonMetadata(
  representation: UnknownRecord,
  base: string,
  author: string,
  titlePath: string
): ReaderWorkMetadataBase {
  const contributors = readerWorkContributors(representation.authors)
  const primaryAuthor = contributors[0]!
  const workId = requiredString(representation, "lbworkid")
  const fullTitle = requiredString(representation, "title")
  const displayTitle = requiredString(representation, "shorttitle") ?? fullTitle
  if (!workId || !fullTitle || !displayTitle) invalidReaderSource()
  if (primaryAuthor.id !== author || representation.titlepath !== titlePath) readerPageNotFound()

  let startPageName: string | null = null
  if (Object.hasOwn(representation, "startpagename")) {
    startPageName = boundedRequiredString(
      representation,
      "startpagename",
      MAX_READER_PAGE_NAME_LENGTH
    )
  }

  let endPageName: string | null = null
  if (Object.hasOwn(representation, "endpagename")) {
    endPageName = boundedRequiredString(
      representation,
      "endpagename",
      MAX_READER_PAGE_NAME_LENGTH
    )
  }

  const imprint = isRecord(representation.sort_date_imprint)
    ? requiredString(representation.sort_date_imprint, "plain")
    : null
  const explicitPageCount = representation.page_count

  return {
    alternateMedia: null,
    author: primaryAuthor,
    base,
    contributors,
    displayTitle,
    editorWorkId: boundedNullableStrictString(
      representation,
      "editor_lbworkid",
      MAX_READER_ID_LENGTH
    ),
    endPageName,
    explicitPageCount: safeNonnegativeInteger(explicitPageCount) && explicitPageCount > 0
      ? explicitPageCount
      : null,
    fullTitle,
    hasDramawebben: isRecord(representation.dramawebben),
    hasNyaVagar: hasNyaVagarKeyword(representation.keyword),
    imprintYear: imprint ?? requiredString(representation, "imprintyear"),
    isDrama: representation.texttype === "drama",
    pageStep: readerPageStep(representation.pagestep),
    parts: [],
    searchable: representation.searchable === true,
    startPageName,
    titlePath,
    urn: boundedNullableStrictString(representation, "urn", MAX_READER_ID_LENGTH),
    workId
  }
}

function alternateMediaMetadata(
  representations: unknown[],
  selected: UnknownRecord,
  titlePath: string,
  mediaType: ReaderMediaType
): ReaderWorkMetadataBase["alternateMedia"] {
  const alternateType: ReaderMediaType = mediaType === "etext" ? "faksimil" : "etext"
  const candidate = representations.find(item => (
    item !== selected
    && isRecord(item)
    && item.mediatype === alternateType
    && item.titlepath === titlePath
  ))
  if (candidate === undefined) return null
  if (!isRecord(candidate)) invalidReaderSource()
  const pages = readerPages(candidate.pages)
  if (!pages || pages.length === 0) invalidReaderSource()
  return { mediaType: alternateType, pages }
}

export function normalizeReaderMetadata(
  raw: unknown,
  base: string,
  author: string,
  titlePath: string,
  mediaType: ReaderMediaType
): ReaderWorkMetadata {
  if (!isRecord(raw) || !Array.isArray(raw.data)) invalidReaderSource()
  const representation = raw.data.find(item => (
    isRecord(item) &&
    item.mediatype === mediaType &&
    item.titlepath === titlePath
  ))
  if (!isRecord(representation)) readerPageNotFound()

  const common = commonMetadata(representation, base, author, titlePath)
  common.alternateMedia = alternateMediaMetadata(
    raw.data,
    representation,
    titlePath,
    mediaType
  )
  if (mediaType === "faksimil") {
    const pages = facsimilePages(representation.pages)
    const sizes = facsimileSizes(representation)
    if (!pages || !sizes) invalidReaderSource()
    return {
      ...common,
      mediaType,
      pages,
      parts: readerParts(representation, pages),
      preferredSize: preferredFacsimileSize(sizes),
      sizes
    }
  }

  const hasExactPages = representation.pages !== undefined && representation.pages !== null
  let pages = readerPages(representation.pages)
  if (hasExactPages && !pages) invalidReaderSource()
  if (!pages) {
    for (const sibling of raw.data) {
      if (
        sibling !== representation &&
        isRecord(sibling) &&
        sibling.lbworkid === common.workId
      ) {
        const siblingPages = readerPages(sibling.pages)
        if (siblingPages) {
          pages = siblingPages
          break
        }
      }
    }
  }
  if (!pages) invalidReaderSource()
  return { ...common, mediaType, pages, parts: readerParts(representation, pages) }
}

export async function loadReaderMetadata(
  event: H3Event,
  author: string,
  titlePath: string,
  mediaType: string
): Promise<ReaderWorkMetadata> {
  if (!isReaderMediaType(mediaType)) readerPageNotFound()

  const config = useRuntimeConfig(event)
  const assetBase = config.readerSourceBase.replace(/\/$/, "")
  const raw = await fetchReaderMetadata(
    assetBase,
    "/api/get_work_info",
    author,
    titlePath
  )
  try {
    return normalizeReaderMetadata(raw, assetBase, author, titlePath, mediaType)
  } catch (error) {
    if (!isRecord(error) || error.statusCode !== 404) throw error
  }

  const metadataBase = config.libraryApiBase.replace(/\/$/, "")
  const fallback = await fetchReaderMetadata(
    metadataBase,
    "/get_work_info",
    author,
    titlePath
  )
  return normalizeReaderMetadata(fallback, assetBase, author, titlePath, mediaType)
}

export async function fetchReaderPageHtml(
  base: string,
  workId: string,
  pageIndex: number
): Promise<string> {
  const filename = String(pageIndex).padStart(5, "0")
  try {
    return await $fetch<string>(
      `${base}/txt/${encodeURIComponent(workId)}/res_${filename}.html`,
      {
        query: { username: "app" },
        responseType: "text",
        retry: 0
      }
    )
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" })
  }
}
