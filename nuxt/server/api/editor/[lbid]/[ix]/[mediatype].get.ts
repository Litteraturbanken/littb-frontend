import type { EditorFacsimileSource, EditorReaderPage } from "#shared/types/editor-reader"
import { isEditorRouteIdentity } from "#shared/utils/editor-route-identity"
import type {
  EditorPageBounds,
  EditorManifestResponse,
  FacsimileSize,
  WorkManifestPart
} from "#shared/types/work-manifest"
import { fetchReaderOcrOverlay } from "#server/utils/reader-ocr"
import {
  fetchBoundedEditorText,
  fetchTimedEditorHead,
  maximumEditorHtmlLength,
  sanitizeEditorEtextHtml
} from "#server/utils/editor-reader-html"
import {
  editorCloseHref,
  fetchEditorManifest
} from "#server/utils/work-manifest-client"

type EditorEvent = Parameters<typeof getRouterParam>[0]
type EditorMediaType = EditorReaderPage["mediaType"]
type CompleteEditorManifest = Extract<EditorManifestResponse, { status: "complete" }>

type EditorRequest = {
  mediaType: EditorMediaType
  pageIndex: number
  workId: string
}

type EditorPagePosition = {
  pageCount: number
  pageIndexes: number[] | null
  sparsePosition: number
}

type EditorReadableContext = {
  complete: CompleteEditorManifest | null
  currentPart: WorkManifestPart | null
  firstReadableIndex: number
  lastReadableIndex: number
  nextPartIndex: number | null
  previousPartIndex: number | null
  readablePages: CompleteEditorManifest["pages"]
}

type EditorAssets = Pick<
  EditorReaderPage,
  | "facsimileSources"
  | "html"
  | "imageUrl"
  | "imageWidth"
  | "overlayHeight"
  | "overlayHtml"
  | "overlayWidth"
>

function requiredParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name)
  if (!value) throw createError({ statusCode: 404, statusMessage: "Editor page not found" })
  return value
}

function pageNotFound(): never {
  throw createError({ statusCode: 404, statusMessage: "Editor page not found" })
}

function sourceError(): never {
  throw createError({ statusCode: 502, statusMessage: "Editor source unavailable" })
}

function editorPageCount(bounds: EditorPageBounds): number {
  if (bounds.kind === "dense") return bounds.page_count
  const lastPageIndex = bounds.page_indexes.at(-1)
  if (lastPageIndex === undefined) sourceError()
  return lastPageIndex + 1
}

function editorPartContext(parts: readonly WorkManifestPart[], pageIndex: number): {
  currentPart: WorkManifestPart | null
  nextPartIndex: number | null
  previousPartIndex: number | null
} {
  const ordered = [...parts].sort((left, right) => (
    left.start_page_index - right.start_page_index || left.source_index - right.source_index
  ))
  if (ordered.length === 0) {
    return { currentPart: null, nextPartIndex: null, previousPartIndex: null }
  }
  const currentPosition = ordered.findLastIndex(part => (
    part.start_page_index <= pageIndex && pageIndex <= part.end_page_index
  ))
  if (currentPosition < 0) {
    return {
      currentPart: null,
      nextPartIndex: ordered.find(part => part.start_page_index > pageIndex)?.start_page_index
        ?? null,
      previousPartIndex: ordered.findLast(part => part.end_page_index < pageIndex)
        ?.start_page_index ?? null
    }
  }
  return {
    currentPart: ordered[currentPosition] ?? null,
    nextPartIndex: ordered[currentPosition + 1]?.start_page_index ?? null,
    previousPartIndex: ordered[currentPosition - 1]?.start_page_index ?? null
  }
}

function editorFacsimileUrl(workId: string, size: number, pageIndex: number): string {
  const encodedWorkId = encodeURIComponent(workId)
  const imageNumber = String(pageIndex + 1).padStart(4, "0")
  return `/txt/${encodedWorkId}/${encodedWorkId}_${size}/${encodedWorkId}_${size}_${imageNumber}.jpeg`
}

function editorFacsimileSources(
  manifestSizes: readonly FacsimileSize[],
  workId: string,
  pageIndex: number
): EditorFacsimileSource[] {
  const widths = new Map<number, number>()
  for (const source of manifestSizes) {
    if (Number.isFinite(source.width) && source.width > 0 && !widths.has(source.size)) {
      widths.set(source.size, source.width)
    }
  }

  const sources: EditorFacsimileSource[] = [...widths].map(([size, width]) => ({
    size,
    url: editorFacsimileUrl(workId, size, pageIndex),
    width
  }))
  if (!widths.has(3)) {
    sources.push({ size: 3, url: editorFacsimileUrl(workId, 3, pageIndex), width: null })
  }
  return sources.sort((left, right) => left.size - right.size)
}

function readEditorRequest(event: EditorEvent): EditorRequest {
  const workId = requiredParam(event, "lbid")
  const rawIndex = requiredParam(event, "ix")
  const alias = requiredParam(event, "mediatype")
  if (!isEditorRouteIdentity(workId, rawIndex, alias)) pageNotFound()
  return {
    mediaType: alias === "e" ? "etext" : "faksimil",
    pageIndex: Number(rawIndex),
    workId
  }
}

function editorPagePosition(
  bounds: EditorPageBounds,
  pageIndex: number
): EditorPagePosition {
  const pageIndexes = bounds.kind === "sparse" ? bounds.page_indexes : null
  const pageCount = editorPageCount(bounds)
  const sparsePosition = pageIndexes?.indexOf(pageIndex) ?? -1
  if (pageIndex >= pageCount || (pageIndexes !== null && sparsePosition < 0)) pageNotFound()
  return { pageCount, pageIndexes, sparsePosition }
}

function readableEditorContext(
  manifest: EditorManifestResponse,
  position: EditorPagePosition,
  pageIndex: number
): EditorReadableContext {
  const complete = manifest.status === "complete" ? manifest : null
  const parts = complete?.parts ?? []
  const readablePages = complete?.pages.every(page => page.page_index < position.pageCount)
    ? complete.pages
    : []
  const namedStartIndex = readablePages.find(
    page => page.page_name === complete?.start_page_name
  )?.page_index
  const namedEndIndex = readablePages.find(
    page => page.page_name === complete?.end_page_name
  )?.page_index
  const sparseFirst = position.pageIndexes?.[0] ?? 0
  const sparseLast = position.pageIndexes?.at(-1) ?? position.pageCount - 1
  const firstReadableIndex = complete
    ? namedStartIndex ?? readablePages[0]?.page_index ?? sparseFirst
    : sparseFirst
  const lastReadableIndex = complete
    ? namedEndIndex ?? readablePages.at(-1)?.page_index ?? sparseLast
    : sparseLast
  return {
    complete,
    ...editorPartContext(parts, pageIndex),
    firstReadableIndex,
    lastReadableIndex,
    readablePages
  }
}

async function fetchEditorEtext(
  base: string,
  request: EditorRequest
): Promise<EditorReaderPage["html"]> {
  if (request.mediaType !== "etext") return null
  try {
    const filename = String(request.pageIndex).padStart(5, "0")
    const url = new URL(`${base}/txt/${encodeURIComponent(request.workId)}/res_${filename}.html`)
    url.searchParams.set("username", "app")
    const html = await fetchBoundedEditorText(url, maximumEditorHtmlLength)
    const sanitized = sanitizeEditorEtextHtml(html)
    if (sanitized === null) sourceError()
    return sanitized
  } catch {
    sourceError()
  }
}

async function fetchEditorAssets(
  event: EditorEvent,
  base: string,
  request: EditorRequest,
  sizes: readonly FacsimileSize[]
): Promise<EditorAssets> {
  const html = await fetchEditorEtext(base, request)
  if (request.mediaType === "etext") {
    return {
      facsimileSources: [], html, imageUrl: null, imageWidth: null,
      overlayHeight: null, overlayHtml: null, overlayWidth: null
    }
  }
  const facsimileSources = editorFacsimileSources(sizes, request.workId, request.pageIndex)
  const initialSource = facsimileSources.find(source => source.size === 3) ?? null
  if (initialSource) {
    try {
      await fetchTimedEditorHead(`${base}${initialSource.url}`)
    } catch {
      sourceError()
    }
  }
  const contentBase = useRuntimeConfig(event).contentBase.replace(/\/$/u, "")
  const overlay = await fetchReaderOcrOverlay(contentBase, request.workId, request.pageIndex)
  return {
    facsimileSources,
    html,
    imageUrl: initialSource?.url ?? null,
    imageWidth: initialSource?.width ?? null,
    overlayHeight: overlay?.height ?? null,
    overlayHtml: overlay?.html ?? null,
    overlayWidth: overlay?.width ?? null
  }
}

function adjacentEditorIndex(
  position: EditorPagePosition,
  pageIndex: number,
  offset: -1 | 1
): number | null {
  if (position.pageIndexes) {
    return position.pageIndexes[position.sparsePosition + offset] ?? null
  }
  const candidate = pageIndex + offset
  return candidate >= 0 && candidate < position.pageCount ? candidate : null
}

function editorReaderPage(
  request: EditorRequest,
  position: EditorPagePosition,
  readable: EditorReadableContext,
  assets: EditorAssets
): EditorReaderPage {
  const complete = readable.complete
  const contributors = complete?.contributors ?? []
  const parts = complete?.parts ?? []
  return {
    authorId: contributors[0]?.author_id ?? null,
    authorName: contributors[0]?.full_name ?? null,
    closeHref: complete ? editorCloseHref(complete.public_reader_target) : null,
    contributors,
    currentPart: readable.currentPart,
    endPageName: complete?.end_page_name ?? null,
    ...assets,
    firstReadableIndex: readable.firstReadableIndex,
    imprintYear: complete?.imprint_year ?? null,
    lastReadableIndex: readable.lastReadableIndex,
    mediaType: request.mediaType,
    metadataAvailable: complete !== null,
    nextIndex: adjacentEditorIndex(position, request.pageIndex, 1),
    nextPartIndex: readable.nextPartIndex,
    pageCount: position.pageCount,
    pageIndex: request.pageIndex,
    pageIndexes: position.pageIndexes,
    pageName: readable.readablePages.find(
      page => page.page_index === request.pageIndex
    )?.page_name ?? null,
    parts,
    previousIndex: adjacentEditorIndex(position, request.pageIndex, -1),
    previousPartIndex: readable.previousPartIndex,
    searchable: complete?.searchable ?? false,
    title: complete?.display_title ?? null,
    titlePath: complete?.title_path ?? null,
    workId: request.workId
  }
}

export default defineEventHandler(async (event): Promise<EditorReaderPage> => {
  setHeader(event, "cache-control", "no-store")
  const request = readEditorRequest(event)
  const manifest = await fetchEditorManifest(event, request.workId, request.mediaType)
  const position = editorPagePosition(manifest.bounds, request.pageIndex)
  const readable = readableEditorContext(manifest, position, request.pageIndex)
  const config = useRuntimeConfig(event)
  const base = config.readerSourceBase.replace(/\/$/u, "")
  const assets = await fetchEditorAssets(
    event,
    base,
    request,
    readable.complete?.sizes ?? []
  )
  return editorReaderPage(request, position, readable, assets)
})
