import type { ManagedAssetHtml, SanitizedHtml } from "#shared/types/renderable-html"
import {
  issueEditorEtextHtml,
  issueManagedReaderHtml,
  issueReaderOcrHtml
} from "#shared/utils/renderable-html"
import { parseHtmlDocument } from "./html-document"

function markSimpleContiguousWords(
  html: string,
  fromWordId: string,
  toWordId: string
): string | null {
  const document = parseHtmlDocument(`<div data-editor-highlight-root>${html}</div>`)
  const root = document.querySelector("[data-editor-highlight-root]")
  if (!root) return null
  const spans = Array.from(root.querySelectorAll("span[id]"))
  const start = spans.findIndex(span => span.getAttribute("id") === fromWordId)
  const end = spans.findLastIndex(span => span.getAttribute("id") === toWordId)
  if (start < 0 || end < start) return null
  for (let position = start; position <= end; position += 1) {
    spans[position]!.classList.add("markee")
    if ((position - start) % 2 === 1) spans[position]!.classList.add("flip")
  }
  return root.innerHTML
}

export function markEditorEtextHtml(
  html: SanitizedHtml<"editor-etext">,
  fromWordId: string,
  toWordId: string
): SanitizedHtml<"editor-etext"> {
  const marked = markSimpleContiguousWords(html, fromWordId, toWordId)
  return marked === null ? html : issueEditorEtextHtml(marked)
}

export function markReaderOcrHtml(
  html: SanitizedHtml<"reader-ocr">,
  fromWordId: string,
  toWordId: string
): SanitizedHtml<"reader-ocr"> {
  const marked = markSimpleContiguousWords(html, fromWordId, toWordId)
  return marked === null ? html : issueReaderOcrHtml(marked)
}

type ReaderSearchMarker = Readonly<{
  fromWordId: string
  hitPageIndex: number
  hitPageName: string
  pageIndex: number
  pageName: string
  toWordId: string
}>

function markReaderSearchHtml(html: string, marker: ReaderSearchMarker): string | null {
  if (marker.hitPageName !== marker.pageName || marker.hitPageIndex !== marker.pageIndex) {
    return null
  }

  const document = parseHtmlDocument(`<div data-reader-highlight-root>${html}</div>`)
  const root = document.querySelector("[data-reader-highlight-root]")
  if (!root) return null

  const spans = Array.from(root.querySelectorAll("span[id]"))
  const startMatches = spans.filter(span => span.getAttribute("id") === marker.fromWordId)
  const endMatches = spans.filter(span => span.getAttribute("id") === marker.toWordId)
  if (startMatches.length === 0 || endMatches.length === 0) return null

  const isValidDuplicateGroup = (matches: typeof spans): boolean => {
    if (matches.length === 1) return true

    const indexes = matches.map(match => spans.indexOf(match))
    return matches.every((match, index) =>
      indexes[index] === indexes[0]! + index
      && !match.hasAttribute("hidden")
      && match.getAttribute("aria-hidden") !== "true"
      && Boolean(match.textContent?.trim())
    )
  }
  if (!isValidDuplicateGroup(startMatches) || !isValidDuplicateGroup(endMatches)) return null

  const start = spans.indexOf(startMatches[0]!)
  const end = spans.indexOf(endMatches.at(-1)!)
  if (start < 0 || end < start) return null

  for (let index = start; index <= end; index += 1) {
    spans[index]!.classList.add("markee")
    if ((index - start) % 2 === 1) spans[index]!.classList.add("flip")
  }
  return root.innerHTML
}

export function markReaderSearchEtextHtml(
  html: ManagedAssetHtml<"reader-etext">,
  marker: ReaderSearchMarker
): ManagedAssetHtml<"reader-etext"> {
  const marked = markReaderSearchHtml(html, marker)
  return marked === null ? html : issueManagedReaderHtml(marked)
}

export function markReaderSearchOcrHtml(
  html: SanitizedHtml<"reader-ocr">,
  marker: ReaderSearchMarker
): SanitizedHtml<"reader-ocr"> {
  const marked = markReaderSearchHtml(html, marker)
  return marked === null ? html : issueReaderOcrHtml(marked)
}
