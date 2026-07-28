import { createError, type H3Event } from "h3"

import type {
  ReaderFacsimileSize,
  ReaderFacsimileSizeSource,
  ReaderFacsimileSource,
  ReaderMediaType
} from "../../shared/types/reader"
import type {
  ReaderManifestResponse,
  WorkManifestContributor,
  WorkManifestFacsimilePage,
  WorkManifestPage,
  WorkManifestPart
} from "../../shared/types/work-manifest"
import { fetchManagedText } from "../../shared/utils/managed-text"
import { fetchReaderManifest } from "./work-manifest-client"

export const maximumReaderEtextBytes = 2 * 1024 * 1024

export type ReaderSourcePage = WorkManifestPage
export type ReaderFacsimileSourcePage = WorkManifestFacsimilePage

interface ReaderWorkMetadataBase {
  alternateMedia: ReaderManifestResponse["alternate_media"]
  author: WorkManifestContributor
  base: string
  contributors: WorkManifestContributor[]
  declaredPageCount: number | null | undefined
  displayTitle: string
  editorWorkId: string | null
  endPageName: string | null
  fullTitle: string
  hasDramawebben: boolean
  hasNyaVagar: boolean
  imprintYear: string | null
  isDrama: boolean
  pageStep: number
  parts: WorkManifestPart[]
  searchable: boolean
  startPageName: string | null
  titlePath: string
  urn: string | null
  workId: string
}

export interface ReaderEtextWorkMetadata extends ReaderWorkMetadataBase {
  mediaType: "etext"
  pages: WorkManifestPage[]
}

export interface ReaderFacsimileWorkMetadata extends ReaderWorkMetadataBase {
  mediaType: "faksimil"
  pages: WorkManifestFacsimilePage[]
  preferredSize: ReaderFacsimileSize
  sizes: ReaderFacsimileSizeSource[]
}

export type ReaderWorkMetadata = ReaderEtextWorkMetadata | ReaderFacsimileWorkMetadata

export function isReaderMediaType(value: unknown): value is ReaderMediaType {
  return value === "etext" || value === "faksimil"
}

function isFacsimileSize(value: number): value is ReaderFacsimileSize {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

function safeNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
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

export function resolveReaderPartNavigation(
  parts: readonly WorkManifestPart[],
  pageIndex: number
): {
  currentPartIndex: number | null
  previousPartPageName: string | null
  nextPartPageName: string | null
} {
  for (const [sourceIndex, part] of parts.entries()) {
    if (part.source_index !== sourceIndex) {
      throw new RangeError("Reader part source indexes must match source order")
    }
  }

  const ordered = [...parts].sort((left, right) => (
    left.start_page_index - right.start_page_index || left.source_index - right.source_index
  ))
  const starting = ordered.find(part => part.start_page_index === pageIndex)
  const active = ordered.filter(part => (
    part.start_page_index <= pageIndex && pageIndex <= part.end_page_index
  ))
  const previous = ordered.filter(part => part.start_page_index <= pageIndex - 1).at(-1)
  const next = ordered.find(part => part.start_page_index >= pageIndex + 1)
  return {
    currentPartIndex: (starting ?? active.at(-1))?.source_index ?? null,
    previousPartPageName: previous?.start_page_name ?? null,
    nextPartPageName: next?.start_page_name ?? null
  }
}

export function readerCommonMetadata(
  manifest: ReaderManifestResponse,
  base: string
): ReaderWorkMetadataBase {
  return {
    alternateMedia: manifest.alternate_media,
    author: manifest.contributors[0]!,
    base,
    contributors: manifest.contributors,
    declaredPageCount: manifest.declared_page_count,
    displayTitle: manifest.display_title,
    editorWorkId: manifest.editor_work_id,
    endPageName: manifest.end_page_name,
    fullTitle: manifest.full_title,
    hasDramawebben: manifest.has_dramawebben,
    hasNyaVagar: manifest.has_nya_vagar,
    imprintYear: manifest.imprint_year,
    isDrama: manifest.is_drama,
    pageStep: manifest.page_step,
    parts: manifest.parts,
    searchable: manifest.searchable,
    startPageName: manifest.start_page_name,
    titlePath: manifest.title_path,
    urn: manifest.urn,
    workId: manifest.work_id
  }
}

function readerPageNotFound(): never {
  throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
}

function invalidReaderSource(): never {
  throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
}

function readerFacsimileSize(value: number): ReaderFacsimileSize {
  if (!isFacsimileSize(value)) invalidReaderSource()
  return value
}

export function readerFacsimileMetadata(
  manifest: Extract<ReaderManifestResponse, { media_type: "faksimil" }>,
  base: string
): ReaderFacsimileWorkMetadata {
  return {
    ...readerCommonMetadata(manifest, base),
    mediaType: "faksimil",
    pages: manifest.pages,
    sizes: manifest.sizes,
    preferredSize: readerFacsimileSize(manifest.preferred_size)
  }
}

export async function loadReaderMetadata(
  event: H3Event,
  authorId: string,
  titlePath: string,
  mediaType: string
): Promise<ReaderWorkMetadata> {
  if (!isReaderMediaType(mediaType)) readerPageNotFound()
  const manifest = await fetchReaderManifest(event, authorId, titlePath, mediaType)
  const base = useRuntimeConfig(event).readerSourceBase.replace(/\/$/u, "")
  if (manifest.media_type === "faksimil") {
    return readerFacsimileMetadata(manifest, base)
  }
  return {
    ...readerCommonMetadata(manifest, base),
    mediaType: "etext",
    pages: manifest.pages
  }
}

export async function fetchReaderPageHtml(
  base: string,
  workId: string,
  pageIndex: number
): Promise<string> {
  const filename = String(pageIndex).padStart(5, "0")
  const url = `${base}/txt/${encodeURIComponent(workId)}/res_${filename}.html?username=app`
  try {
    return await fetchManagedText(url, {
      authorityOrigin: new URL(base).origin,
      allowedPathPrefixes: ["/txt/"],
      allowedContentTypes: ["text/html"],
      maximumBytes: maximumReaderEtextBytes
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" })
  }
}
