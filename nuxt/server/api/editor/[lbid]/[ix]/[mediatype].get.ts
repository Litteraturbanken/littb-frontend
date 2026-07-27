import type { EditorFacsimileSource, EditorReaderPage } from "#shared/types/editor-reader"
import type { ReaderPart, ReaderPartAuthor, ReaderWorkContributor } from "#shared/types/reader"
import { normalizeReaderAuthorContribution } from "#shared/utils/reader-author"
import { hasC0OrC1Control } from "#shared/utils/text-safety"
import { fetchReaderOcrOverlay } from "#server/utils/reader-ocr"
import {
  fetchBoundedEditorJson,
  fetchBoundedEditorText,
  fetchTimedEditorHead,
  maximumEditorHtmlLength,
  parseEditorPageIndexes,
  sanitizeEditorEtextHtml
} from "#server/utils/editor-reader-html"

const workIdPattern = /^[A-Za-z0-9_-]{1,100}$/
const indexPattern = /^(?:0|[1-9]\d{0,6})$/
const maxMetadataLength = 2 * 1024 * 1024
const maxPageCountLength = 64 * 1024

function requiredParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name)
  if (!value) throw createError({ statusCode: 404, statusMessage: "Editor page not found" })
  return value
}

function sourceError(): never { throw createError({ statusCode: 502, statusMessage: "Editor source unavailable" }) }

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function safeOptionalText(value: unknown, maximumLength = 2_000): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximumLength &&
    value.trim() === value && !hasC0OrC1Control(value)
    ? value
    : null
}

function safeInternalHref(value: unknown): string | null {
  const href = safeOptionalText(value)
  if (!href || !href.startsWith("/") || href.startsWith("//") || href.includes("\\")) {
    return null
  }
  return href.replace(/^\/författare(?=\/)/u, "/f%C3%B6rfattare")
}

function safeRouteSegment(value: unknown): string | null {
  const segment = safeOptionalText(value, 100)
  return segment && !/[\\/?#]/u.test(segment) ? segment : null
}

function safePageCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 100_000
    ? value
    : null
}

function safeNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < 100_000
}

interface EditorMetadataPage {
  pageName: string
  pageIndex: number
}

function editorMetadataPages(value: unknown): EditorMetadataPage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100_000) return null
  const names = new Set<string>()
  const indexes = new Set<number>()
  const pages: EditorMetadataPage[] = []
  for (const raw of value) {
    const item = record(raw)
    const pageName = safeOptionalText(item?.pagename, 100)
    const pageIndex = item?.pageindex
    if (
      !pageName || !safeNonnegativeInteger(pageIndex) || names.has(pageName) ||
      indexes.has(pageIndex)
    ) return null
    names.add(pageName)
    indexes.add(pageIndex)
    pages.push({ pageName, pageIndex })
  }
  return pages.sort((left, right) => left.pageIndex - right.pageIndex)
}

function editorContributors(value: unknown): ReaderWorkContributor[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null
  const contributors: ReaderWorkContributor[] = []
  const ids = new Set<string>()
  for (const raw of value) {
    const contributor = record(raw)
    const id = safeRouteSegment(contributor?.authorid)
    const name = safeOptionalText(contributor?.full_name)
    if (!id || !name || ids.has(id)) return null
    ids.add(id)
    contributors.push({
      authorType: normalizeReaderAuthorContribution(contributor?.type),
      id,
      name,
      role: normalizeReaderAuthorContribution(contributor?.role)
    })
  }
  return contributors
}

function editorParts(
  value: unknown,
  pages: readonly EditorMetadataPage[],
  contributors: readonly ReaderWorkContributor[]
): ReaderPart[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 10_000) return null
  const pageIndexes = new Map(pages.map(page => [page.pageName, page.pageIndex]))
  const contributorNames = new Map(contributors.map(contributor => [contributor.id, contributor.name]))
  const parts: ReaderPart[] = []
  for (const [sourceIndex, raw] of value.entries()) {
    const item = record(raw)
    const startPageName = safeOptionalText(item?.startpagename, 100)
    const endPageName = safeOptionalText(item?.endpagename, 100)
    const title = safeOptionalText(item?.title)
    const startPageIndex = startPageName ? pageIndexes.get(startPageName) : undefined
    const endPageIndex = endPageName ? pageIndexes.get(endPageName) : undefined
    if (
      !startPageName || !endPageName || !title || startPageIndex === undefined ||
      endPageIndex === undefined || startPageIndex > endPageIndex
    ) return null
    if (
      item?.authors !== undefined && item.authors !== null &&
      (!Array.isArray(item.authors) || item.authors.length > 100)
    ) return null
    const rawAuthors = Array.isArray(item?.authors) ? item.authors : []
    const authors: ReaderPartAuthor[] = []
    for (const rawAuthor of rawAuthors) {
      const author = record(rawAuthor)
      const id = safeRouteSegment(author?.authorid)
      if (!id) return null
      const name = contributorNames.get(id) ?? null
      authors.push({ id, name, surname: name?.split(/\s+/u).at(-1) ?? null })
    }
    parts.push({
      authors,
      endPageIndex,
      endPageName,
      navTitle: safeOptionalText(item?.navtitle),
      shortTitle: safeOptionalText(item?.shorttitle),
      sourceIndex,
      startPageIndex,
      startPageName,
      title,
      titleId: safeRouteSegment(item?.titleid)
    })
  }
  return parts
}

function editorPartContext(parts: readonly ReaderPart[], pageIndex: number): {
  currentPart: ReaderPart | null
  nextPartIndex: number | null
  previousPartIndex: number | null
} {
  const ordered = [...parts].sort((left, right) => (
    left.startPageIndex - right.startPageIndex || left.sourceIndex - right.sourceIndex
  ))
  if (ordered.length === 0) {
    return { currentPart: null, nextPartIndex: null, previousPartIndex: null }
  }
  const currentPosition = ordered.findLastIndex(part => (
    part.startPageIndex <= pageIndex && pageIndex <= part.endPageIndex
  ))
  if (currentPosition < 0) {
    return {
      currentPart: null,
      nextPartIndex: ordered.find(part => part.startPageIndex > pageIndex)?.startPageIndex ?? null,
      previousPartIndex: ordered.findLast(part => part.endPageIndex < pageIndex)?.startPageIndex
        ?? null
    }
  }
  return {
    currentPart: ordered[currentPosition] ?? null,
    nextPartIndex: ordered[currentPosition + 1]?.startPageIndex ?? null,
    previousPartIndex: ordered[currentPosition - 1]?.startPageIndex ?? null
  }
}

function editorFacsimileUrl(workId: string, size: number, pageIndex: number): string {
  const encodedWorkId = encodeURIComponent(workId)
  const imageNumber = String(pageIndex + 1).padStart(4, "0")
  return `/txt/${encodedWorkId}/${encodedWorkId}_${size}/${encodedWorkId}_${size}_${imageNumber}.jpeg`
}

function editorFacsimileSources(
  representation: Record<string, unknown> | null,
  workId: string,
  pageIndex: number
): EditorFacsimileSource[] {
  const widths = record(representation?.width)
  const sources: EditorFacsimileSource[] = []
  for (let size = 1; size <= 5; size += 1) {
    const width = widths?.[`size_${size}`]
    if (
      typeof width === "number" && Number.isFinite(width) && width > 0 && width <= 10_000
    ) {
      sources.push({ size, url: editorFacsimileUrl(workId, size, pageIndex), width })
    }
  }
  if (!sources.some(source => source.size === 3)) {
    sources.push({ size: 3, url: editorFacsimileUrl(workId, 3, pageIndex), width: null })
  }
  return sources.sort((left, right) => left.size - right.size)
}

function editorCloseHref(
  representations: readonly Record<string, unknown>[]
): string | null {
  const ordered = [...representations].sort((left, right) => {
    const order = (value: unknown) => value === "etext" ? 0 : value === "faksimil" ? 1 : 2
    return order(left.mediatype) - order(right.mediatype)
  })
  for (const item of ordered) {
    if (item.mediatype !== "etext" && item.mediatype !== "faksimil") continue
    const authors = Array.isArray(item.work_authors)
      ? item.work_authors
      : Array.isArray(item.authors)
        ? item.authors
        : item.main_author ? [item.main_author] : []
    const author = record(authors[0])
    const authorId = safeRouteSegment(author?.authorid)
    const titleId = safeRouteSegment(item.work_titleid ?? item.titleid ?? item.titlepath)
    const startPage = safeRouteSegment(item.startpagename)
    if (authorId && titleId && startPage) {
      return [
        "/f%C3%B6rfattare",
        encodeURIComponent(authorId),
        "titlar",
        encodeURIComponent(titleId),
        "sida",
        encodeURIComponent(startPage),
        item.mediatype
      ].join("/")
    }
  }
  return null
}

export default defineEventHandler(async (event): Promise<EditorReaderPage> => {
  const workId = requiredParam(event, "lbid")
  const rawIndex = requiredParam(event, "ix")
  const alias = requiredParam(event, "mediatype")
  if (!workIdPattern.test(workId) || !indexPattern.test(rawIndex) || (alias !== "e" && alias !== "f")) {
    throw createError({ statusCode: 404, statusMessage: "Editor page not found" })
  }
  const pageIndex = Number(rawIndex)
  const mediaType = alias === "e" ? "etext" : "faksimil"
  const config = useRuntimeConfig(event)
  const base = config.readerSourceBase.replace(/\/$/, "")
  let representation: Record<string, unknown> | null = null
  let representations: Record<string, unknown>[] = []
  try {
    const url = new URL(`${base}/api/get_work_info`)
    url.searchParams.set("lbworkid", workId)
    url.searchParams.set("exclude", "content_vector")
    const raw = await fetchBoundedEditorJson(url, maxMetadataLength)
    const response = record(raw)
    if (response && Array.isArray(response.data) && response.data.length <= 1_000) {
      representations = response.data.map(record).filter(
        (item): item is Record<string, unknown> => item?.lbworkid === workId
      )
      representation = representations.find(item => item.mediatype === mediaType) ?? representations[0] ?? null
    }
  } catch {
    // Assets remain useful to editors even when metadata is temporarily unavailable.
  }
  let pageCount = safePageCount(representation?.page_count)
  const metadataPages = editorMetadataPages(representation?.pages)
  const sparsePages = pageCount === null ? parseEditorPageIndexes(representation?.pages) : null
  pageCount ??= sparsePages?.pageCount ?? null
  if (pageCount === null) {
    try {
      const rawCount = await fetchBoundedEditorJson(
        `${base}/count_pages/${encodeURIComponent(workId)}/${mediaType}`,
        maxPageCountLength
      )
      const count: unknown = rawCount && typeof rawCount === "object" ? (rawCount as { count?: unknown }).count : null
      pageCount = safePageCount(count)
    } catch { sourceError() }
    if (pageCount === null) sourceError()
  }
  const readablePages = metadataPages?.every(page => page.pageIndex < pageCount)
    ? metadataPages
    : null
  if (pageCount !== null && pageIndex >= pageCount) {
    throw createError({ statusCode: 404, statusMessage: "Editor page not found" })
  }
  const sparsePosition = sparsePages?.indexes.indexOf(pageIndex) ?? -1
  if (sparsePages && sparsePosition < 0) {
    throw createError({ statusCode: 404, statusMessage: "Editor page not found" })
  }
  const title = safeOptionalText(representation?.shorttitle)
  const titlePath = safeRouteSegment(representation?.titlepath)
  const searchable = representation?.searchable === true
  const imprint = record(representation?.sort_date_imprint)
  const imprintYear = safeOptionalText(imprint?.plain, 100)
    ?? safeOptionalText(representation?.imprintyear, 100)
  const pageName = readablePages?.find(page => page.pageIndex === pageIndex)?.pageName
    ?? safeOptionalText(representation?.pagename, 100)
  const endPageName = safeOptionalText(representation?.endpagename, 100)
  const authors = Array.isArray(representation?.work_authors)
    ? representation.work_authors
    : representation?.authors
  const parsedContributors = editorContributors(authors)
  const parsedParts = parsedContributors === null
    ? null
    : editorParts(representation?.parts, readablePages ?? [], parsedContributors)
  const metadataAvailable = representation !== null && parsedContributors !== null && parsedParts !== null
  const contributors = metadataAvailable ? parsedContributors : []
  const authorId = contributors[0]?.id ?? null
  const authorName = contributors[0]?.name ?? null
  const parts = metadataAvailable ? parsedParts : []
  const { currentPart, nextPartIndex, previousPartIndex } = editorPartContext(parts, pageIndex)
  const namedStartIndex = readablePages?.find(
    page => page.pageName === safeOptionalText(representation?.startpagename, 100)
  )?.pageIndex
  const namedEndIndex = readablePages?.find(
    page => page.pageName === safeOptionalText(representation?.endpagename, 100)
  )?.pageIndex
  const firstReadableIndex = metadataAvailable
    ? namedStartIndex ?? readablePages?.[0]?.pageIndex ?? sparsePages?.indexes[0] ?? 0
    : sparsePages?.indexes[0] ?? 0
  const lastReadableIndex = metadataAvailable
    ? namedEndIndex ?? readablePages?.at(-1)?.pageIndex ?? sparsePages?.indexes.at(-1)
      ?? (pageCount !== null ? pageCount - 1 : pageIndex)
    : sparsePages?.indexes.at(-1) ?? pageCount - 1
  const closeHref = (
    Array.isArray(representation?.mediatypes) &&
    representation.mediatypes[0] && typeof representation.mediatypes[0] === "object"
      ? safeInternalHref((representation.mediatypes[0] as { url?: unknown }).url)
      : null
  ) ?? editorCloseHref(representations)
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
    ? editorFacsimileSources(representation, workId, pageIndex)
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
      config.contentBase.replace(/\/$/, ""),
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
    authorId, authorName, closeHref: metadataAvailable ? closeHref : null,
    contributors, currentPart,
    endPageName: metadataAvailable ? endPageName : null, facsimileSources,
    firstReadableIndex, html: sanitizedHtml, imageWidth,
    imageUrl, imprintYear: metadataAvailable ? imprintYear : null,
    lastReadableIndex,
    mediaType, metadataAvailable,
    nextIndex: sparsePages
      ? sparsePages.indexes[sparsePosition + 1] ?? null
      : pageCount !== null && pageIndex + 1 < pageCount ? pageIndex + 1 : null,
    nextPartIndex, overlayHeight, overlayHtml, overlayWidth,
    pageCount, pageIndex, pageIndexes: sparsePages?.indexes ?? null,
    pageName: metadataAvailable ? pageName : null, parts,
    previousPartIndex,
    previousIndex: sparsePages
      ? sparsePages.indexes[sparsePosition - 1] ?? null
      : pageIndex > 0 ? pageIndex - 1 : null,
    searchable: metadataAvailable && searchable,
    title: metadataAvailable ? title : null,
    titlePath: metadataAvailable ? titlePath : null,
    workId
  } satisfies EditorReaderPage
})
