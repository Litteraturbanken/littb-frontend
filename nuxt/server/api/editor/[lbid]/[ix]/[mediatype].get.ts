import type { EditorFacsimileSource, EditorReaderPage } from "#shared/types/editor-reader"
import type {
  EditorManifestResponse,
  EditorPageBounds,
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
import { fetchEditorManifest } from "#server/utils/work-manifest-client"

const workIdPattern = /^[A-Za-z0-9_-]{1,100}$/
const indexPattern = /^(?:0|[1-9]\d{0,6})$/

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

function editorCloseHref(
  target: Extract<EditorManifestResponse, { status: "complete" }>["public_reader_target"]
): string | null {
  if (target === null) return null
  return [
    "/f%C3%B6rfattare",
    target.author_id,
    "titlar",
    target.title_path,
    "sida",
    target.start_page_name,
    target.media_type
  ].join("/")
}

export default defineEventHandler(async (event): Promise<EditorReaderPage> => {
  setHeader(event, "cache-control", "no-store")
  const workId = requiredParam(event, "lbid")
  const rawIndex = requiredParam(event, "ix")
  const alias = requiredParam(event, "mediatype")
  if (
    !workIdPattern.test(workId)
    || !indexPattern.test(rawIndex)
    || (alias !== "e" && alias !== "f")
  ) pageNotFound()

  const pageIndex = Number(rawIndex)
  const mediaType = alias === "e" ? "etext" : "faksimil"
  const manifest = await fetchEditorManifest(event, workId, mediaType)
  const pageIndexes = manifest.bounds.kind === "sparse"
    ? manifest.bounds.page_indexes
    : null
  const pageCount = editorPageCount(manifest.bounds)
  const sparsePosition = pageIndexes?.indexOf(pageIndex) ?? -1
  if (pageIndex >= pageCount || (pageIndexes !== null && sparsePosition < 0)) pageNotFound()

  const complete = manifest.status === "complete" ? manifest : null
  const metadataAvailable = complete !== null
  const contributors = complete?.contributors ?? []
  const parts = complete?.parts ?? []
  const readablePages = complete?.pages.every(page => page.page_index < pageCount)
    ? complete.pages
    : []
  const { currentPart, nextPartIndex, previousPartIndex } = editorPartContext(
    parts,
    pageIndex
  )
  const namedStartIndex = readablePages.find(
    page => page.page_name === complete?.start_page_name
  )?.page_index
  const namedEndIndex = readablePages.find(
    page => page.page_name === complete?.end_page_name
  )?.page_index
  const firstReadableIndex = complete
    ? namedStartIndex ?? readablePages[0]?.page_index ?? pageIndexes?.[0] ?? 0
    : pageIndexes?.[0] ?? 0
  const lastReadableIndex = complete
    ? namedEndIndex ?? readablePages.at(-1)?.page_index ?? pageIndexes?.at(-1) ?? pageCount - 1
    : pageIndexes?.at(-1) ?? pageCount - 1

  const config = useRuntimeConfig(event)
  const base = config.readerSourceBase.replace(/\/$/u, "")
  let html: string | null = null
  if (mediaType === "etext") {
    try {
      const filename = String(pageIndex).padStart(5, "0")
      const url = new URL(`${base}/txt/${encodeURIComponent(workId)}/res_${filename}.html`)
      url.searchParams.set("username", "app")
      html = await fetchBoundedEditorText(url, maximumEditorHtmlLength)
    } catch {
      sourceError()
    }
  }

  const facsimileSources = mediaType === "faksimil"
    ? editorFacsimileSources(complete?.sizes ?? [], workId, pageIndex)
    : []
  const initialFacsimileSource = facsimileSources.find(source => source.size === 3) ?? null
  const imageWidth = initialFacsimileSource?.width ?? null
  const imageUrl = initialFacsimileSource?.url ?? null
  if (imageUrl) {
    try {
      await fetchTimedEditorHead(`${base}${imageUrl}`)
    } catch {
      sourceError()
    }
  }

  let overlayHtml: EditorReaderPage["overlayHtml"] = null
  let overlayWidth: number | null = null
  let overlayHeight: number | null = null
  if (mediaType === "faksimil") {
    const overlay = await fetchReaderOcrOverlay(
      config.contentBase.replace(/\/$/u, ""),
      workId,
      pageIndex
    )
    if (overlay) {
      overlayHtml = overlay.html
      overlayWidth = overlay.width
      overlayHeight = overlay.height
    }
  }

  const sanitizedHtml = html === null ? null : sanitizeEditorEtextHtml(html)
  if (html !== null && sanitizedHtml === null) sourceError()
  return {
    authorId: contributors[0]?.author_id ?? null,
    authorName: contributors[0]?.full_name ?? null,
    closeHref: complete ? editorCloseHref(complete.public_reader_target) : null,
    contributors,
    currentPart,
    endPageName: complete?.end_page_name ?? null,
    facsimileSources,
    firstReadableIndex,
    html: sanitizedHtml,
    imageWidth,
    imageUrl,
    imprintYear: complete?.imprint_year ?? null,
    lastReadableIndex,
    mediaType,
    metadataAvailable,
    nextIndex: pageIndexes
      ? pageIndexes[sparsePosition + 1] ?? null
      : pageIndex + 1 < pageCount ? pageIndex + 1 : null,
    nextPartIndex,
    overlayHeight,
    overlayHtml,
    overlayWidth,
    pageCount,
    pageIndex,
    pageIndexes,
    pageName: readablePages.find(page => page.page_index === pageIndex)?.page_name ?? null,
    parts,
    previousIndex: pageIndexes
      ? pageIndexes[sparsePosition - 1] ?? null
      : pageIndex > 0 ? pageIndex - 1 : null,
    previousPartIndex,
    searchable: complete?.searchable ?? false,
    title: complete?.display_title ?? null,
    titlePath: complete?.title_path ?? null,
    workId
  } satisfies EditorReaderPage
})
