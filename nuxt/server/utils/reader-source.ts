import { createError, type H3Event } from "h3"
import { Parser } from "htmlparser2"

import type {
  ReaderFacsimileSize,
  ReaderFacsimileSource,
  ReaderMediaType
} from "../../shared/types/reader"
import type { ManagedStyleText } from "../../shared/types/renderable-html"
import type {
  ReaderManifestResponse,
  WorkManifestContributor,
  WorkManifestFacsimilePage,
  WorkManifestPage,
  WorkManifestPart
} from "../../shared/types/work-manifest"
import { fetchManagedText } from "../../shared/utils/managed-text"
import { issueManagedReaderStyle } from "../../shared/utils/renderable-html"
import { fetchReaderManifest } from "./work-manifest-client"

export const maximumReaderEtextBytes = 2 * 1024 * 1024
export const maximumReaderStylesheetBytes = 256 * 1024

function rebaseStylesheetReference(reference: string, stylesheetUrl: string): string {
  if (
    !reference
    || reference.startsWith("/")
    || reference.startsWith("#")
    || /^[a-z][a-z\d+.-]*:/iu.test(reference)
  ) return reference

  const resolved = new URL(reference, new URL(stylesheetUrl, "https://reader.invalid"))
  return resolved.href.slice(resolved.origin.length)
}

function cssStringEnd(stylesheet: string, start: number): number {
  const quote = stylesheet[start]
  let index = start + 1
  while (index < stylesheet.length) {
    if (stylesheet[index] === "\\") {
      index += 2
    } else if (stylesheet[index] === quote) {
      return index + 1
    } else {
      index += 1
    }
  }
  return stylesheet.length
}

function rebaseQuotedImport(
  stylesheet: string,
  start: number,
  stylesheetUrl: string
): { end: number, value: string } | null {
  const prefix = stylesheet.slice(start).match(/^@import\s+/iu)?.[0]
  if (!prefix) return null
  const quoteStart = start + prefix.length
  const quote = stylesheet[quoteStart]
  if (quote !== "\"" && quote !== "'") return null
  const end = cssStringEnd(stylesheet, quoteStart)
  if (end > stylesheet.length || stylesheet[end - 1] !== quote) return null
  const reference = stylesheet.slice(quoteStart + 1, end - 1)
  const rebased = rebaseStylesheetReference(reference, stylesheetUrl)
  return {
    end,
    value: `${prefix}${quote}${rebased}${quote}`
  }
}

function rebaseUrlToken(
  stylesheet: string,
  start: number,
  stylesheetUrl: string
): { end: number, value: string } | null {
  const prefix = stylesheet.slice(start).match(/^url\(\s*/iu)?.[0]
  if (!prefix) return null
  const referenceStart = start + prefix.length
  const quote = stylesheet[referenceStart]
  if (quote === "\"" || quote === "'") {
    const stringEnd = cssStringEnd(stylesheet, referenceStart)
    if (stylesheet[stringEnd - 1] !== quote) return null
    const suffix = stylesheet.slice(stringEnd).match(/^\s*\)/u)?.[0]
    if (!suffix) return null
    const reference = stylesheet.slice(referenceStart + 1, stringEnd - 1)
    const rebased = rebaseStylesheetReference(reference, stylesheetUrl)
    return {
      end: stringEnd + suffix.length,
      value: `${prefix}${quote}${rebased}${quote}${suffix}`
    }
  }

  const close = stylesheet.indexOf(")", referenceStart)
  if (close < 0) return null
  const rawReference = stylesheet.slice(referenceStart, close)
  if (/["'()]/u.test(rawReference)) return null
  const leadingSpace = rawReference.match(/^\s*/u)?.[0] ?? ""
  const trailingSpace = rawReference.match(/\s*$/u)?.[0] ?? ""
  const reference = rawReference.slice(
    leadingSpace.length,
    rawReference.length - trailingSpace.length
  )
  const rebased = rebaseStylesheetReference(reference, stylesheetUrl)
  return {
    end: close + 1,
    value: `${prefix}${leadingSpace}${rebased}${trailingSpace})`
  }
}

function protectedStylesheetTokenEnd(stylesheet: string, start: number): number | null {
  if (stylesheet.startsWith("/*", start)) {
    const commentEnd = stylesheet.indexOf("*/", start + 2)
    return commentEnd < 0 ? stylesheet.length : commentEnd + 2
  }
  const character = stylesheet[start]
  return character === "\"" || character === "'"
    ? cssStringEnd(stylesheet, start)
    : null
}

function rebaseStylesheetToken(
  stylesheet: string,
  start: number,
  stylesheetUrl: string
): { end: number, value: string } | null {
  const previous = stylesheet[start - 1]
  const url = (!previous || !/[\w-]/u.test(previous))
    ? rebaseUrlToken(stylesheet, start, stylesheetUrl)
    : null
  return url ?? rebaseQuotedImport(stylesheet, start, stylesheetUrl)
}

export function rebaseRelativeStylesheetReferences(
  stylesheet: string,
  stylesheetUrl: string
): string {
  let rebased = ""
  let index = 0
  while (index < stylesheet.length) {
    const protectedEnd = protectedStylesheetTokenEnd(stylesheet, index)
    if (protectedEnd !== null) {
      rebased += stylesheet.slice(index, protectedEnd)
      index = protectedEnd
      continue
    }
    const token = rebaseStylesheetToken(stylesheet, index, stylesheetUrl)
    if (token) {
      rebased += token.value
      index = token.end
      continue
    }
    rebased += stylesheet[index]
    index += 1
  }
  return rebased
}

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

export function readerCommonMetadata(
  manifest: ReaderManifestResponse,
  base: string
): ReaderWorkMetadataBase {
  const author = manifest.contributors.find(
    contributor => contributor.author_id === manifest.author_id
  )
  if (!author) invalidReaderSource()

  return {
    alternateMedia: manifest.alternate_media,
    author,
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
  return readerMetadataFromManifest(event, manifest)
}

export function readerMetadataFromManifest(
  event: H3Event, manifest: ReaderManifestResponse
): ReaderWorkMetadata {
  const base = useRuntimeConfig(event).contentBase.replace(/\/$/u, "")
  if (manifest.media_type === "faksimil") {
    return readerFacsimileMetadata(manifest, base)
  }
  return {
    ...readerCommonMetadata(manifest, base),
    mediaType: "etext",
    pages: manifest.pages
  }
}

const readerHtmlVoidElements = new Set([
  "area", "base", "basefont", "br", "col", "command", "embed", "frame", "hr", "img", "input", "isindex", "keygen", "link", "meta", "param", "source", "track", "wbr"
])

class ReaderHtmlParser extends Parser {
  selfClosingToken = false
  override onselfclosingtag(endIndex: number): void {
    this.selfClosingToken = true
    super.onselfclosingtag(endIndex)
    this.selfClosingToken = false
  }
}

export function normalizeReaderPageHtml(source: string): string {
  // Published etext is XHTML-like. In HTML, <div/> stays open and can swallow
  // the enclosing Reader's SSR fragment markers. Edit only token boundaries;
  // do not reserialize text, attributes, comments, or foreign SVG/MathML.
  let copied = 0
  let output = ""
  let rawTextUntil = 0
  const rawTextElements = new Set(["script", "style", "title", "textarea", "xmp", "iframe", "noembed", "noframes", "noscript"])
  const foreign: boolean[] = []
  const parser: ReaderHtmlParser = new ReaderHtmlParser({
    onopentag(name, _attributes, implied) {
      const isForeign = foreign.at(-1) === true || name === "svg" || name === "math"
      foreign.push(isForeign)
      if (implied || isForeign || parser.startIndex < rawTextUntil) return
      // Preserve browser raw text even where htmlparser2 emits element tokens.
      // Plaintext has no closing-tag escape: its remaining bytes stay literal.
      if (name === "plaintext") { rawTextUntil = source.length; return }
      if (!parser.selfClosingToken && rawTextElements.has(name)) {
        const closing = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, "iu")
          .exec(source.slice(parser.endIndex + 1))
        rawTextUntil = closing ? parser.endIndex + 1 + closing.index : source.length
      }
      if (!parser.selfClosingToken || readerHtmlVoidElements.has(name)) return
      const token = source.slice(parser.startIndex, parser.endIndex + 1)
      const originalName = /^<([^\s/>]+)/u.exec(token)?.[1]
      if (!originalName) return
      output += source.slice(copied, parser.endIndex - 1) + `></${originalName}>`
      copied = parser.endIndex + 1
    },
    onclosetag() { foreign.pop() }
  }, { decodeEntities: false, recognizeSelfClosing: true })
  parser.end(source)
  return copied ? output + source.slice(copied) : source
}

export async function fetchReaderPageHtml(
  base: string,
  workId: string,
  pageIndex: number
): Promise<string> {
  const filename = String(pageIndex).padStart(5, "0")
  const url = `${base}/txt/${encodeURIComponent(workId)}/res_${filename}.html?username=app`
  try {
    return normalizeReaderPageHtml(await fetchManagedText(url, {
      authorityOrigin: new URL(base).origin,
      allowedPathPrefixes: ["/txt/"],
      allowedContentTypes: ["text/html"],
      maximumBytes: maximumReaderEtextBytes
    }))
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" })
  }
}

export async function fetchReaderWorkStylesheet(
  base: string,
  workId: string
): Promise<ManagedStyleText<"reader-etext"> | null> {
  const url = `${base}/txt/css/${encodeURIComponent(workId)}-etext.css`
  try {
    const stylesheet = await fetchManagedText(url, {
      authorityOrigin: new URL(base).origin,
      allowedPathPrefixes: ["/txt/css/"],
      allowedContentTypes: ["text/css"],
      maximumBytes: maximumReaderStylesheetBytes
    })
    return issueManagedReaderStyle(rebaseRelativeStylesheetReferences(
      stylesheet,
      `/txt/css/${encodeURIComponent(workId)}-etext.css`
    ))
  } catch {
    return null
  }
}

export async function fetchReaderSharedStylesheet(
  base: string
): Promise<ManagedStyleText<"reader-etext"> | null> {
  const url = `${base}/red/css/etext.css`
  try {
    const stylesheet = await fetchManagedText(url, {
      authorityOrigin: new URL(base).origin,
      allowedPathPrefixes: ["/red/css/"],
      allowedContentTypes: ["text/css"],
      maximumBytes: maximumReaderStylesheetBytes
    })
    return issueManagedReaderStyle(
      rebaseRelativeStylesheetReferences(stylesheet, "/red/css/etext.css")
    )
  } catch {
    return null
  }
}
