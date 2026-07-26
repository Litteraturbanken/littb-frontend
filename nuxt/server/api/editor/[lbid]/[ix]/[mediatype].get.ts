import type { EditorFacsimileSource, EditorReaderPage } from "#shared/types/editor-reader"
import { sanitizeEditorEtextHtml } from "#server/utils/editor-reader-html"
import { fetchReaderPageHtml } from "#server/utils/reader-source"
import { parseHTML } from "linkedom"

const workIdPattern = /^[A-Za-z0-9_-]{1,100}$/
const indexPattern = /^(?:0|[1-9]\d{0,6})$/
const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/u
const maxOverlayLength = 512 * 1024
const allowedOverlayTags = new Set(["BR", "DIV", "SPAN"])
const allowedOverlayClasses = new Set(["parent", "w"])
const allowedStyleProperties = new Set([
  "bottom", "display", "font-size", "height", "left", "letter-spacing",
  "line-height", "position", "right", "top", "white-space", "width"
])

interface OverlayElement {
  attributes: ArrayLike<{ name: string, value: string }>
  getAttribute: (name: string) => string | null
  outerHTML: string
  querySelectorAll: (selector: string) => ArrayLike<OverlayElement>
  remove: () => void
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
  tagName: string
}

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
    value.trim() === value && !controlCharacters.test(value)
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

function safePagesLength(value: unknown): number | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100_000) return null
  const indexes = new Set<number>()
  for (const rawPage of value) {
    const sourcePage = record(rawPage)
    const pageIndex = sourcePage?.pageindex
    const pageName = safeOptionalText(sourcePage?.pagename, 100)
    if (
      !pageName || typeof pageIndex !== "number" || !Number.isSafeInteger(pageIndex) ||
      pageIndex < 0 || pageIndex > 1_000_000 || indexes.has(pageIndex)
    ) return null
    indexes.add(pageIndex)
  }
  return value.length
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

function sanitizeStyle(value: string): string {
  const declarations: string[] = []
  for (const declaration of value.split(";")) {
    const separator = declaration.indexOf(":")
    if (separator < 1) continue
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const candidate = declaration.slice(separator + 1).trim().toLowerCase()
    if (!allowedStyleProperties.has(property)) continue
    const keywords: Record<string, ReadonlySet<string>> = {
      display: new Set(["block", "inline", "inline-block"]),
      position: new Set(["absolute", "relative"]),
      "white-space": new Set(["normal", "nowrap"])
    }
    if (keywords[property]?.has(candidate)) {
      declarations.push(`${property}: ${candidate}`)
      continue
    }
    const numeric = candidate.match(/^(-?\d+(?:\.\d+)?)(px|pt|em|rem|%)?$/u)
    if (!numeric) continue
    const amount = Number(numeric[1])
    if (!Number.isFinite(amount) || Math.abs(amount) > 10_000) continue
    if (["font-size", "height", "line-height", "width"].includes(property) && amount < 0) continue
    declarations.push(`${property}: ${candidate}`)
  }
  return declarations.join("; ")
}

function sanitizeOverlayElement(element: OverlayElement, root: boolean): void {
  if (!allowedOverlayTags.has(element.tagName)) {
    element.remove()
    return
  }
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase()
    const value = attribute.value
    if (name === "class") {
      const classes = value.split(/\s+/u).filter(token => allowedOverlayClasses.has(token))
      if (classes.length > 0) element.setAttribute(name, [...new Set(classes)].join(" "))
      else element.removeAttribute(name)
      continue
    }
    if (name === "id") {
      element.removeAttribute(name)
      continue
    }
    if (name === "title") {
      if (value.length > 2_000 || controlCharacters.test(value)) element.removeAttribute(name)
      continue
    }
    if (name === "style") {
      const style = sanitizeStyle(value)
      if (style) element.setAttribute(name, style)
      else element.removeAttribute(name)
      continue
    }
    if (root && name === "data-size") continue
    element.removeAttribute(name)
  }
}

function parseOverlay(source: string): {
  html: string
  width: number
  height: number
} | null {
  if (source.length === 0 || source.length > maxOverlayLength) return null
  try {
    const { document } = parseHTML(source) as unknown as { document: {
      querySelector: (selector: string) => OverlayElement | null
    } }
    const overlay = document.querySelector("body > div")
    const size = overlay?.getAttribute("data-size")?.match(/^(\d{1,5})x(\d{1,5})$/)
    if (!overlay || !size) return null
    const width = Number(size[1])
    const height = Number(size[2])
    if (width < 1 || height < 1 || width > 10_000 || height > 10_000) return null
    sanitizeOverlayElement(overlay, true)
    for (const element of Array.from(overlay.querySelectorAll("*"))) {
      sanitizeOverlayElement(element, false)
    }
    return { html: overlay.outerHTML, width, height }
  } catch {
    return null
  }
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
    const raw = await $fetch<unknown>(`${base}/api/get_work_info`, {
      query: { lbworkid: workId, exclude: "content_vector" }, retry: 0
    })
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
    ?? safePagesLength(representation?.pages)
  if (pageCount === null) {
    try {
      const rawCount: unknown = await $fetch(`${base}/count_pages/${encodeURIComponent(workId)}/${mediaType}`, { retry: 0 })
      const count: unknown = rawCount && typeof rawCount === "object" ? (rawCount as { count?: unknown }).count : null
      pageCount = safePageCount(count)
    } catch { sourceError() }
    if (pageCount === null) sourceError()
  }
  if (pageCount !== null && pageIndex >= pageCount) {
    throw createError({ statusCode: 404, statusMessage: "Editor page not found" })
  }
  const title = safeOptionalText(representation?.shorttitle)
  const imprint = record(representation?.sort_date_imprint)
  const imprintYear = safeOptionalText(imprint?.plain, 100)
    ?? safeOptionalText(representation?.imprintyear, 100)
  const pageName = safeOptionalText(representation?.pagename, 100)
  const endPageName = safeOptionalText(representation?.endpagename, 100)
  const authors = Array.isArray(representation?.authors) ? representation.authors : []
  const author = record(authors[0])
  const authorId = safeRouteSegment(author?.authorid)
  const authorName = author
    ? safeOptionalText(author.full_name)
    : null
  const closeHref = (
    Array.isArray(representation?.mediatypes) &&
    representation.mediatypes[0] && typeof representation.mediatypes[0] === "object"
      ? safeInternalHref((representation.mediatypes[0] as { url?: unknown }).url)
      : null
  ) ?? editorCloseHref(representations)
  const html = mediaType === "etext"
    ? await fetchReaderPageHtml(base, workId, pageIndex)
    : null
  const facsimileSources = mediaType === "faksimil"
    ? editorFacsimileSources(representation, workId, pageIndex)
    : []
  const initialFacsimileSource = facsimileSources.find(source => source.size === 3) ?? null
  const imageWidth = initialFacsimileSource?.width ?? null
  const imageUrl = initialFacsimileSource?.url ?? null
  if (imageUrl) {
    try {
      await $fetch(`${base}${imageUrl}`, { method: "HEAD", retry: 0 })
    } catch {
      sourceError()
    }
  }
  let overlayHtml: string | null = null
  let overlayWidth: number | null = null
  let overlayHeight: number | null = null
  if (mediaType === "faksimil") {
    try {
      const filename = String(pageIndex).padStart(5, "0")
      const rawOverlay = await $fetch<string>(`${base}/txt/${encodeURIComponent(workId)}/ocr_${filename}.html`, {
        query: { username: "app" }, responseType: "text", retry: 0
      })
      const overlay = parseOverlay(rawOverlay)
      if (overlay) {
        overlayHtml = overlay.html
        overlayWidth = overlay.width
        overlayHeight = overlay.height
      }
    } catch {
      // OCR is an enhancement. The facsimile remains useful when it is absent.
    }
  }
  const sanitizedHtml = html === null ? null : sanitizeEditorEtextHtml(html)
  if (html !== null && sanitizedHtml === null) sourceError()
  return {
    authorId, authorName, closeHref, endPageName, facsimileSources, html: sanitizedHtml, imageWidth,
    imageUrl, imprintYear,
    mediaType, metadataAvailable: representation !== null,
    nextIndex: pageCount !== null && pageIndex + 1 < pageCount ? pageIndex + 1 : null,
    overlayHeight, overlayHtml, overlayWidth,
    pageCount, pageIndex, pageName,
    previousIndex: pageIndex > 0 ? pageIndex - 1 : null,
    title, workId
  } satisfies EditorReaderPage
})
