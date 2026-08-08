import { parseHTML } from "linkedom"

import type { SanitizedHtml } from "../../shared/types/renderable-html"
import { issueEditorEtextHtml } from "../../shared/utils/renderable-html"
import { hasC0OrC1Control } from "../../shared/utils/text-safety"

export const maximumEditorHtmlLength = 2 * 1024 * 1024
const activeTags = new Set([
  "APPLET", "BASE", "EMBED", "FORM", "IFRAME", "LINK", "META", "NOSCRIPT",
  "OBJECT", "SCRIPT", "STYLE", "TEMPLATE"
])
const allowedTags = new Set([
  "A", "ABBR", "ADDRESS", "ARTICLE", "ASIDE", "B", "BDI", "BDO", "BLOCKQUOTE",
  "BR", "CAPTION", "CITE", "CODE", "COL", "COLGROUP", "DD", "DEL", "DETAILS",
  "DFN", "DIV", "DL", "DT", "EM", "FIGCAPTION", "FIGURE", "H1", "H2", "H3",
  "H4", "H5", "H6", "HR", "I", "IMG", "INS", "KBD", "LI", "MARK", "OL", "P",
  "PRE", "Q", "S", "SAMP", "SECTION", "SMALL", "SPAN", "STRONG", "SUB", "SUMMARY",
  "SUP", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TIME", "TR", "U", "UL",
  "VAR", "WBR"
])
const globalAttributes = new Set([
  "aria-hidden", "class", "dir", "hidden", "id", "lang", "pname", "role", "title"
])
const tagAttributes: Readonly<Record<string, ReadonlySet<string>>> = {
  A: new Set(["href", "name", "rel", "target"]),
  BLOCKQUOTE: new Set(["cite"]),
  COL: new Set(["span"]),
  COLGROUP: new Set(["span"]),
  DEL: new Set(["cite", "datetime"]),
  IMG: new Set(["alt", "height", "src", "width"]),
  INS: new Set(["cite", "datetime"]),
  Q: new Set(["cite"]),
  TD: new Set(["colspan", "rowspan"]),
  TH: new Set(["colspan", "rowspan", "scope"]),
  TIME: new Set(["datetime"])
}

interface SanitizedElement {
  attributes: ArrayLike<{ name: string, value: string }>
  childNodes: ArrayLike<unknown>
  getAttribute: (name: string) => string | null
  remove: () => void
  removeAttribute: (name: string) => void
  replaceWith: (...nodes: unknown[]) => void
  setAttribute: (name: string, value: string) => void
  tagName: string
}

type EditorTextFetcher = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>

type EditorSourceOptions = {
  fetcher?: EditorTextFetcher
  timeoutMs?: number
}

function concatenateEditorBytes(chunks: Uint8Array[], total: number): Uint8Array {
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function readBoundedEditorBody(
  response: Response,
  maximumBytes: number
): Promise<Uint8Array> {
  if (!response.body) throw new Error("Missing bounded source body")
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maximumBytes) {
      await reader.cancel("Editor source exceeds bound")
      throw new Error("Invalid bounded source length")
    }
    chunks.push(value)
  }
  return concatenateEditorBytes(chunks, total)
}

export async function fetchBoundedEditorText(
  url: string | URL,
  maximumBytes: number,
  options: EditorSourceOptions = {}
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error("Editor source timeout")),
    options.timeoutMs ?? 10_000)
  try {
    const response = await (options.fetcher ?? globalThis.fetch)(url, {
      redirect: "error",
      signal: controller.signal
    })
    if (!response.ok) throw new Error("Invalid bounded source response")
    const declaredLength = response.headers.get("content-length")
    if (declaredLength !== null) {
      const declaredBytes = Number(declaredLength)
      if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0 || declaredBytes > maximumBytes) {
        throw new Error("Invalid bounded source length")
      }
    }
    const bytes = await readBoundedEditorBody(response, maximumBytes)
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchBoundedEditorJson(
  url: string | URL,
  maximumBytes: number,
  options: EditorSourceOptions = {}
): Promise<unknown> {
  const source = await fetchBoundedEditorText(url, maximumBytes, options)
  return JSON.parse(source) as unknown
}

export async function fetchTimedEditorHead(
  url: string | URL,
  options: EditorSourceOptions = {}
): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error("Editor source timeout")),
    options.timeoutMs ?? 10_000)
  try {
    const response = await (options.fetcher ?? globalThis.fetch)(url, {
      method: "HEAD",
      redirect: "error",
      signal: controller.signal
    })
    if (!response.ok) throw new Error("Invalid Editor source response")
    const contentType = response.headers.get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase()
    if (contentType !== "image/jpeg") {
      throw new Error("Invalid Editor image response")
    }
  } finally {
    clearTimeout(timer)
  }
}

function validEditorPageName(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 100
    && value.trim() === value
    && !hasC0OrC1Control(value)
}

function validEditorPageIndex(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    && value < 100_000
}

function editorPageIndex(value: unknown, indexes: ReadonlySet<number>): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null
  const sourcePage = value as Record<string, unknown>
  const pageIndex = sourcePage.pageindex
  if (!validEditorPageName(sourcePage.pagename) || !validEditorPageIndex(pageIndex)) return null
  return indexes.has(pageIndex) ? null : pageIndex
}

export function parseEditorPageIndexes(value: unknown): {
  indexes: number[]
  pageCount: number
} | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100_000) return null
  const indexes = new Set<number>()
  for (const rawPage of value) {
    const pageIndex = editorPageIndex(rawPage, indexes)
    if (pageIndex === null) return null
    indexes.add(pageIndex)
  }
  const sorted = [...indexes].sort((left, right) => left - right)
  return { indexes: sorted, pageCount: sorted[sorted.length - 1]! + 1 }
}

function safeIdentifier(value: string): boolean {
  return value.length > 0 && value.length <= 500 && !hasC0OrC1Control(value)
}

function safeUrl(value: string, image: boolean): boolean {
  if (
    value.length === 0 || value.length > 2_000 || hasC0OrC1Control(value) ||
    value.startsWith("//") || value.includes("\\")
  ) return false
  if (/^(?:https?:)?$/u.test(value)) return false
  if (/^https?:\/\//iu.test(value)) return true
  if (!image && /^mailto:/iu.test(value)) return true
  return /^(?:#|\/|\.\.?\/|[^:/?#]+(?:[/?#]|$))/u.test(value)
}

const identifierAttributes = new Set(["class", "id", "name", "pname"])
const linkAttributes = new Set(["href", "cite"])

function editorAttributeIsAllowed(tagName: string, name: string): boolean {
  return !name.startsWith("on")
    && (globalAttributes.has(name) || Boolean(tagAttributes[tagName]?.has(name)))
}

function editorAttributeValueIsSafe(name: string, value: string): boolean {
  if (identifierAttributes.has(name)) return safeIdentifier(value)
  if (linkAttributes.has(name)) return safeUrl(value, false)
  if (name === "src") return safeUrl(value, true)
  return value.length <= 2_000 && !hasC0OrC1Control(value)
}

function sanitizeTargetAttribute(element: SanitizedElement, value: string): void {
  if (value !== "_blank") element.removeAttribute("target")
  else element.setAttribute("rel", "noopener noreferrer")
}

function sanitizeElementAttribute(
  element: SanitizedElement,
  attribute: { name: string, value: string }
): void {
  const name = attribute.name.toLowerCase()
  const value = attribute.value
  if (!editorAttributeIsAllowed(element.tagName, name)) {
    element.removeAttribute(name)
    return
  }
  if (name === "target") {
    sanitizeTargetAttribute(element, value)
    return
  }
  if (!editorAttributeValueIsSafe(name, value)) element.removeAttribute(name)
}

function sanitizeElement(element: SanitizedElement): void {
  if (activeTags.has(element.tagName)) {
    element.remove()
    return
  }
  if (!allowedTags.has(element.tagName)) {
    element.replaceWith(...Array.from(element.childNodes))
    return
  }
  for (const attribute of Array.from(element.attributes)) {
    sanitizeElementAttribute(element, attribute)
  }
}

export function sanitizeEditorEtextHtml(source: string): SanitizedHtml<"editor-etext"> | null {
  if (source.length === 0 || source.length > maximumEditorHtmlLength) return null
  try {
    const { document } = parseHTML(
      `<!doctype html><html><head></head><body>${source}</body></html>`
    ) as unknown as { document: {
      body: { innerHTML: string, querySelectorAll: (selector: string) => ArrayLike<SanitizedElement> }
    } }
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      sanitizeElement(element)
    }
    const html = document.body.innerHTML
    return html.length > 0 && html.length <= maximumEditorHtmlLength
      ? issueEditorEtextHtml(html)
      : null
  } catch {
    return null
  }
}
