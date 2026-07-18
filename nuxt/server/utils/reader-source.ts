import { createError, type H3Event } from "h3"

import type {
  ReaderFacsimileSize,
  ReaderFacsimileSizeSource,
  ReaderFacsimileSource,
  ReaderMediaType
} from "../../shared/types/reader"

type UnknownRecord = Record<string, unknown>

export interface ReaderSourcePage {
  pageIndex: number
  pageName: string
}

export interface ReaderFacsimileSourcePage extends ReaderSourcePage {
  imageNumber: number
}

interface ReaderWorkMetadataBase {
  author: { id: string, name: string }
  base: string
  displayTitle: string
  fullTitle: string
  imprintYear: string | null
  startPageName: string | null
  titlePath: string
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

function readerPages(value: unknown): ReaderSourcePage[] | null {
  if (!Array.isArray(value)) return null

  const pages: ReaderSourcePage[] = []
  for (const page of value) {
    if (!isRecord(page)) return null
    const pageName = requiredString(page, "pagename")
    const pageIndex = page.pageindex
    if (!pageName || !safeNonnegativeInteger(pageIndex)) return null
    pages.push({ pageName, pageIndex })
  }
  return pages.sort((left, right) => left.pageIndex - right.pageIndex)
}

function facsimilePages(value: unknown): ReaderFacsimileSourcePage[] | null {
  if (!Array.isArray(value)) return null

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
  base: string,
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
    base.replace(/\/$/, ""),
    "txt",
    encodedWorkId,
    `${encodedWorkId}_${size}`,
    `${encodedWorkId}_${size}_${encodedImageNumber}.jpeg`
  ].join("/")
}

export function buildFacsimileSources(
  base: string,
  workId: string,
  imageNumber: number,
  sizes: readonly ReaderFacsimileSizeSource[]
): ReaderFacsimileSource[] {
  return sizes
    .map(({ size, width }) => ({
      size,
      url: facsimileImageUrl(base, workId, size, imageNumber),
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
  author: string,
  titlePath: string
): Promise<unknown> {
  try {
    return await $fetch(`${base}/api/get_work_info`, {
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

function commonMetadata(
  representation: UnknownRecord,
  base: string,
  author: string,
  titlePath: string
): ReaderWorkMetadataBase {
  const authors = representation.authors
  const firstAuthor = Array.isArray(authors) ? authors[0] : null
  const workId = requiredString(representation, "lbworkid")
  const fullTitle = requiredString(representation, "title")
  const displayTitle = requiredString(representation, "shorttitle") ?? fullTitle
  if (!isRecord(firstAuthor) || !workId || !fullTitle || !displayTitle) invalidReaderSource()

  const authorId = requiredString(firstAuthor, "authorid")
  const authorName = requiredString(firstAuthor, "full_name")
  if (!authorId || !authorName) invalidReaderSource()
  if (authorId !== author || representation.titlepath !== titlePath) readerPageNotFound()

  let startPageName: string | null = null
  if (Object.hasOwn(representation, "startpagename")) {
    startPageName = requiredString(representation, "startpagename")
    if (!startPageName) invalidReaderSource()
  }

  const imprint = isRecord(representation.sort_date_imprint)
    ? requiredString(representation.sort_date_imprint, "plain")
    : null

  return {
    author: { id: authorId, name: authorName },
    base,
    displayTitle,
    fullTitle,
    imprintYear: imprint ?? requiredString(representation, "imprintyear"),
    startPageName,
    titlePath,
    workId
  }
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
  if (mediaType === "faksimil") {
    const pages = facsimilePages(representation.pages)
    const sizes = facsimileSizes(representation)
    if (!pages || !sizes) invalidReaderSource()
    return {
      ...common,
      mediaType,
      pages,
      preferredSize: preferredFacsimileSize(sizes),
      sizes
    }
  }

  let pages = readerPages(representation.pages)
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
  return { ...common, mediaType, pages }
}

export async function loadReaderMetadata(
  event: H3Event,
  author: string,
  titlePath: string,
  mediaType: string
): Promise<ReaderWorkMetadata> {
  if (!isReaderMediaType(mediaType)) readerPageNotFound()

  const base = useRuntimeConfig(event).readerSourceBase.replace(/\/$/, "")
  const raw = await fetchReaderMetadata(base, author, titlePath)
  return normalizeReaderMetadata(raw, base, author, titlePath, mediaType)
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
