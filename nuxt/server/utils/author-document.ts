import { createError, type H3Event } from "h3"
import { parseHTML } from "linkedom"

import type { components } from "../../app/lib/api/generated/lbapi"
import type {
  AuthorDocumentErrorCode,
  AuthorDocumentKind,
  AuthorSupplementalPage
} from "../../shared/types/author-document"
import type { SanitizedHtml } from "../../shared/types/renderable-html"
import { issueAuthorDocumentHtml } from "../../shared/utils/renderable-html"
import { hasC0OrC1Control, hasLoneSurrogate } from "../../shared/utils/text-safety"
import { createServerLbApiClient } from "./server-lb-api-client"

export type AuthorDocumentDescriptor = components["schemas"]["AuthorDocumentDescriptor"]
type UnknownRecord = Record<string, unknown>

type SanitizableAttribute = { name: string }
type SanitizableParent = { removeChild: (node: SanitizableNode) => unknown }
type SanitizableNode = {
  nodeType: number
  parentNode: SanitizableParent | null
  childNodes: Iterable<SanitizableNode>
}
type SanitizableElement = SanitizableNode & {
  localName: string
  attributes: Iterable<SanitizableAttribute>
  innerHTML: string
  remove: () => void
  replaceWith: (...nodes: SanitizableNode[]) => void
  hasAttribute: (name: string) => boolean
  getAttribute: (name: string) => string | null
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
}
type ParsedAuthorDocument = {
  querySelectorAll: (selector: string) => Iterable<SanitizableElement>
}

const genericAllowedElements = new Set([
  "a", "abbr", "b", "blockquote", "br", "caption", "cite", "code",
  "col", "colgroup", "dd", "del", "div", "dl", "dt", "em",
  "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "i", "img", "ins", "li", "ol", "p", "pre", "q", "s", "small",
  "span", "strong", "sub", "sup", "table", "tbody", "td", "tfoot",
  "th", "thead", "tr", "u", "ul"
])
const slaAllowedElements = new Set([
  "a", "div", "h1", "h2", "hr", "li", "p", "span", "ul"
])

const removedSubtrees = new Set([
  "applet", "audio", "base", "button", "canvas", "embed", "form",
  "frame", "frameset", "iframe", "input", "link", "math", "meta",
  "noscript", "object", "option", "picture", "script", "select", "source",
  "style", "svg", "template", "textarea", "video"
])

const genericGlobalAttributes = new Set(["class", "id", "lang", "title"])
const slaGlobalAttributes = new Set(["class", "id", "lang"])
const slaAnchorAttributes = new Set(["href", "target", "rel"])
const slaStyleElements = new Set(["h1", "h2", "ul"])
const descriptorKeys = new Set([
  "audio_url",
  "author_id",
  "birth_year",
  "death_year",
  "document_kind",
  "full_name",
  "has_dramawebben",
  "has_introduction",
  "normalized_author_id",
  "search_url",
  "source_path"
])
const elementAttributes: Record<string, ReadonlySet<string>> = {
  a: new Set(["href", "target", "rel", "name", "download"]),
  img: new Set(["src", "alt", "width", "height"]),
  td: new Set(["colspan", "rowspan", "headers"]),
  th: new Set(["colspan", "rowspan", "headers", "scope"]),
  col: new Set(["span"]),
  colgroup: new Set(["span"]),
  ol: new Set(["start", "reversed", "type"]),
  li: new Set(["value"])
}

const maxGenericAuthorDocumentBytes = 1_048_576
const maxSlaAuthorDocumentBytes = 262_144
const slaAuthorId = "LagerlöfS"
const slaNormalizedAuthorId = "LagerlofS"
const slaSourcePath = "/red/sla/omtexterna.html"
const slaHrefPrefix = "/författare/LagerlöfS/"

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function invalidDescriptor(): never {
  throw new Error("Invalid author document descriptor")
}

export function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

export function validManagedSegment(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1 && value.length <= 100
    && value === value.trim()
    && value !== "." && value !== ".."
    && !value.includes("\\")
    && !value.includes("/")
    && !value.includes("%")
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

function expectedSourcePath(normalized: string, kind: AuthorDocumentKind): string {
  if (!validManagedSegment(normalized)) invalidDescriptor()
  try {
    return `/red/forfattare/${encodeRfc3986Segment(normalized)}/${kind}/index.html`
  } catch {
    return invalidDescriptor()
  }
}

function descriptorLinksAreExact(value: AuthorDocumentDescriptor): boolean {
  try {
    const expectedSearch =
      `/sok?forfattare=${encodeRfc3986Segment(value.author_id)}&avancerad`
    const expectedAudio =
      "https://litteraturbanken.se/ljudochbild/författare/"
      + encodeRfc3986Segment(value.normalized_author_id.toLowerCase())
    return (value.search_url === null || value.search_url === expectedSearch)
      && (value.audio_url === null || value.audio_url === expectedAudio)
  } catch {
    return false
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isAuthorDocumentKind(value: unknown): value is AuthorDocumentKind {
  return value === "presentation"
    || value === "bibliografi"
    || value === "semer"
    || value === "omtexterna"
}

function hasExactDescriptorKeys(value: UnknownRecord): boolean {
  const keys = Object.keys(value)
  return keys.length === descriptorKeys.size && keys.every(key => descriptorKeys.has(key))
}

function hasAuthorDescriptorIdentity(value: UnknownRecord): boolean {
  return typeof value.author_id === "string"
    && typeof value.normalized_author_id === "string"
    && typeof value.full_name === "string"
    && value.full_name.length > 0
}

function hasAuthorDescriptorFeatures(value: UnknownRecord): boolean {
  return typeof value.has_introduction === "boolean"
    && typeof value.has_dramawebben === "boolean"
    && isAuthorDocumentKind(value.document_kind)
    && typeof value.source_path === "string"
}

function isAuthorDocumentDescriptor(value: unknown): value is AuthorDocumentDescriptor {
  if (!isRecord(value) || !hasExactDescriptorKeys(value)) return false
  return hasAuthorDescriptorIdentity(value)
    && hasAuthorDescriptorFeatures(value)
    && isNullableString(value.birth_year)
    && isNullableString(value.death_year)
    && isNullableString(value.search_url)
    && isNullableString(value.audio_url)
}

export function expectedAuthorDocumentSource(
  value: unknown,
  requestedAuthor: string,
  requestedKind: AuthorDocumentKind
): string {
  if (!isAuthorDocumentDescriptor(value)
    || value.author_id !== requestedAuthor
    || value.document_kind !== requestedKind
    || !descriptorLinksAreExact(value)) invalidDescriptor()

  if (requestedKind === "omtexterna") {
    if (requestedAuthor !== slaAuthorId
      || value.normalized_author_id !== slaNormalizedAuthorId
      || value.source_path !== slaSourcePath) invalidDescriptor()
    return slaSourcePath
  }

  const expected = expectedSourcePath(value.normalized_author_id, requestedKind)
  if (value.source_path !== expected) invalidDescriptor()
  return expected
}

function fullyDecode(value: string): string | null {
  let decoded = value
  try {
    for (let pass = 0; pass < 16; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) return decoded
      decoded = next
    }
  } catch {
    return null
  }
  return null
}

function hasTraversalSegment(value: string): boolean {
  const withoutFragment = value.split("#", 1)[0] ?? ""
  const path = withoutFragment.split("?", 1)[0] ?? ""
  return path.split("/").some(segment => segment === "." || segment === "..")
}

function hasUnsafeUrlCodeUnit(value: string): boolean {
  return value.includes("\\") || hasC0OrC1Control(value) || hasLoneSurrogate(value)
}

function safeUrl(value: string, kind: "href" | "src"): boolean {
  if (value !== value.trim() || hasUnsafeUrlCodeUnit(value)) return false
  const decoded = fullyDecode(value)
  if (decoded === null || hasUnsafeUrlCodeUnit(decoded)) return false
  if (decoded.startsWith("//") || hasTraversalSegment(decoded)) return false

  if (decoded.startsWith("#")) return kind === "href"
  const scheme = /^([a-z][a-z0-9+.-]*):/iu.exec(decoded)?.[1]?.toLowerCase()
  if (!scheme) return true
  if (kind === "src") return scheme === "https"
  return ["http", "https", "mailto", "tel"].includes(scheme)
}

function safeSlaHref(value: string): boolean {
  if (value !== value.trim() || hasUnsafeUrlCodeUnit(value)) return false
  if (!value.startsWith(slaHrefPrefix)) return false
  const decoded = fullyDecode(value)
  return decoded !== null
    && !hasUnsafeUrlCodeUnit(decoded)
    && decoded.startsWith(slaHrefPrefix)
    && !decoded.startsWith("//")
    && !hasTraversalSegment(decoded)
}

function hasClass(element: SanitizableElement, className: string): boolean {
  return (element.getAttribute("class") ?? "").split(/\s+/u).includes(className)
}

function canonicalSlaStyle(
  element: SanitizableElement,
  name: string,
  value: string
): string | null {
  if ((name === "h1" || name === "h2") && hasClass(element, "title")) {
    return /^[ \t]*clear[ \t]*:[ \t]*both[ \t]*;?[ \t]*$/iu.test(value)
      ? "clear: both"
      : null
  }
  if (name === "ul" && hasClass(element, "itemizedlist")) {
    return /^[ \t]*list-style-type[ \t]*:[ \t]*disc[ \t]*;?[ \t]*$/iu.test(value)
      ? "list-style-type: disc"
      : null
  }
  return null
}

function removeDisallowedAttributes(
  element: SanitizableElement,
  kind: AuthorDocumentKind,
  name: string
): void {
  const globalAttributes = kind === "omtexterna"
    ? slaGlobalAttributes
    : genericGlobalAttributes
  const specificAttributes = kind === "omtexterna"
    ? (name === "a" ? slaAnchorAttributes : undefined)
    : elementAttributes[name]
  for (const attribute of [...element.attributes]) {
    const attributeName = attribute.name.toLowerCase()
    const allowedStyle = kind === "omtexterna" && attributeName === "style"
      && slaStyleElements.has(name)
    if (!globalAttributes.has(attributeName)
      && !specificAttributes?.has(attributeName)
      && !allowedStyle) element.removeAttribute(attribute.name)
  }
}

function sanitizeSlaStyle(element: SanitizableElement, name: string): void {
  if (!element.hasAttribute("style")) return
  const canonical = canonicalSlaStyle(element, name, element.getAttribute("style") ?? "")
  if (canonical === null) element.removeAttribute("style")
  else element.setAttribute("style", canonical)
}

function sanitizeSlaAnchor(element: SanitizableElement): void {
  if (element.hasAttribute("href") && !safeSlaHref(element.getAttribute("href") ?? "")) {
    element.removeAttribute("href")
  }
  if (!element.hasAttribute("href")) {
    element.removeAttribute("target")
    element.removeAttribute("rel")
  } else if (element.hasAttribute("target") && element.getAttribute("target") !== "_top") {
    element.removeAttribute("target")
  }
}

function hardenNavigatingTarget(element: SanitizableElement): void {
  const target = element.getAttribute("target")
  if (!target || ["_self", "_parent", "_top"].includes(target.toLowerCase())) return

  const tokens = (element.getAttribute("rel") ?? "")
    .split(/\s+/u)
    .filter(Boolean)
  const lowerTokens = new Set(tokens.map(token => token.toLowerCase()))
  for (const token of ["noopener", "noreferrer"]) {
    if (!lowerTokens.has(token)) tokens.push(token)
  }
  element.setAttribute("rel", tokens.join(" "))
}

function sanitizeGenericElement(element: SanitizableElement, name: string): void {
  if (name === "a" && element.hasAttribute("href")) {
    const href = element.getAttribute("href") ?? ""
    if (!safeUrl(href, "href")) element.removeAttribute("href")
  }
  if (name === "img" && element.hasAttribute("src")) {
    const src = element.getAttribute("src") ?? ""
    if (!safeUrl(src, "src")) element.removeAttribute("src")
  }
  if (name === "a") hardenNavigatingTarget(element)
}

function sanitizeElement(
  element: SanitizableElement,
  kind: AuthorDocumentKind
): void {
  const name = element.localName.toLowerCase()
  if (removedSubtrees.has(name)) {
    element.remove()
    return
  }

  for (const child of [...element.childNodes]) sanitizeNode(child, kind)

  const allowedElements = kind === "omtexterna" ? slaAllowedElements : genericAllowedElements
  if (!allowedElements.has(name)) {
    element.replaceWith(...element.childNodes)
    return
  }
  removeDisallowedAttributes(element, kind, name)
  if (kind === "omtexterna") {
    sanitizeSlaStyle(element, name)
    if (name === "a") sanitizeSlaAnchor(element)
  } else {
    sanitizeGenericElement(element, name)
  }
}

function sanitizeNode(node: SanitizableNode, kind: AuthorDocumentKind): void {
  if (node.nodeType === 7 || node.nodeType === 8) {
    node.parentNode?.removeChild(node)
    return
  }
  if (node.nodeType === 1) sanitizeElement(node as SanitizableElement, kind)
}

export class InvalidAuthorDocumentSource extends Error {
  constructor() {
    super("Invalid author document source")
    this.name = "InvalidAuthorDocumentSource"
  }
}

export function parseAuthorDocumentBody(
  source: string,
  kind: AuthorDocumentKind = "presentation"
): SanitizedHtml<"author-document"> {
  let document: ParsedAuthorDocument
  try {
    ({ document } = parseHTML(source) as unknown as { document: ParsedAuthorDocument })
  } catch {
    throw new InvalidAuthorDocumentSource()
  }
  const bodies = [...document.querySelectorAll("body")]
  if (bodies.length !== 1) throw new InvalidAuthorDocumentSource()
  const body = bodies[0]!
  for (const child of [...body.childNodes]) sanitizeNode(child, kind)
  return issueAuthorDocumentHtml(body.innerHTML)
}

export function documentError(
  statusCode: 404 | 502,
  code: AuthorDocumentErrorCode
): never {
  throw createError({
    statusCode,
    statusMessage: statusCode === 404 ? "Not Found" : "Bad Gateway",
    data: { code }
  })
}

export function fetchStatus(error: unknown): number | null {
  if (!isRecord(error)) return null
  if (isRecord(error.response) && typeof error.response.status === "number") {
    return error.response.status
  }
  if (typeof error.statusCode === "number") return error.statusCode
  if (typeof error.status === "number") return error.status
  return null
}

export async function cancelResponseBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined)
}

async function readAuthorDocumentChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<ReadableStreamReadResult<Uint8Array>> {
  try {
    return await reader.read()
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  }
}

export async function readAuthorDocumentResponse(
  response: Response,
  maxBytes: number
): Promise<string> {
  const declaredLength = response.headers.get("content-length")
  if (declaredLength !== null
    && /^\d+$/u.test(declaredLength)
    && Number(declaredLength) > maxBytes) {
    await cancelResponseBody(response)
    throw new InvalidAuthorDocumentSource()
  }

  if (response.body === null) return ""
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  while (true) {
    const result = await readAuthorDocumentChunk(reader)
    const { done, value } = result
    if (done) break
    if (value === undefined) continue
    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new InvalidAuthorDocumentSource()
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

export function isExactSlaHtmlResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type")
  return contentType !== null && /^[ \t]*text\/html[ \t]*(?:;[ \t]*charset[ \t]*=[ \t]*(?:"[^"]+"|[!#$%&'*+.^_`|~0-9A-Za-z-]+)[ \t]*)?$/iu
    .test(contentType)
}

export function formatYears(birth: string | null, death: string | null): string {
  const left = birth && birth !== "0000" ? birth : ""
  const right = death && death !== "0000" ? death : ""
  if (left && right) return `${left}-${right}`
  if (left) return `f. ${left}`
  if (right) return `d. ${right}`
  return ""
}

function authorSupplementalPage(
  descriptor: AuthorDocumentDescriptor,
  bodyHtml: SanitizedHtml<"author-document">
): AuthorSupplementalPage {
  return {
    author: {
      authorId: descriptor.author_id,
      fullName: descriptor.full_name,
      lifespan: formatYears(descriptor.birth_year, descriptor.death_year),
      hasIntroduction: descriptor.has_introduction,
      hasDramawebben: descriptor.has_dramawebben,
      searchUrl: descriptor.search_url,
      audioUrl: descriptor.audio_url
    },
    documentKind: descriptor.document_kind,
    bodyHtml
  }
}

export async function loadAuthorDocument(
  event: H3Event,
  requestedAuthor: string,
  requestedKind: AuthorDocumentKind
): Promise<AuthorSupplementalPage> {
  const config = useRuntimeConfig(event)
  const client = createServerLbApiClient(event)
  const result = await client.GET("/authors/{author_id}/documents/{document_kind}", {
    redirect: "manual",
    params: {
      path: {
        author_id: requestedAuthor,
        document_kind: requestedKind
      }
    }
  }).catch(() => null)
  if (result === null) {
    return documentError(502, "author_document_unavailable")
  }

  if (result.response.status === 404) {
    await cancelResponseBody(result.response)
    return documentError(404, "author_document_author_not_found")
  }
  if (result.response.status !== 200) {
    await cancelResponseBody(result.response)
    return documentError(502, "author_document_unavailable")
  }

  let expected: string
  try {
    expected = expectedAuthorDocumentSource(result.data, requestedAuthor, requestedKind)
  } catch {
    await cancelResponseBody(result.response)
    return documentError(502, "author_document_unavailable")
  }
  const descriptor = result.data as AuthorDocumentDescriptor

  let source: string
  try {
    const response = await fetch(
      `${config.contentBase.replace(/\/$/u, "")}${expected}`,
      { method: "GET", redirect: "manual" }
    )
    if (response.status === 404) {
      await cancelResponseBody(response)
      return documentError(404, "author_document_not_found")
    }
    if (response.status !== 200
      || (requestedKind === "omtexterna" && !isExactSlaHtmlResponse(response))) {
      await cancelResponseBody(response)
      return documentError(502, "author_document_unavailable")
    }
    source = await readAuthorDocumentResponse(
      response,
      requestedKind === "omtexterna"
        ? maxSlaAuthorDocumentBytes
        : maxGenericAuthorDocumentBytes
    )
  } catch (error) {
    if (fetchStatus(error) === 404) {
      return documentError(404, "author_document_not_found")
    }
    return documentError(502, "author_document_unavailable")
  }

  let bodyHtml: SanitizedHtml<"author-document">
  try {
    bodyHtml = parseAuthorDocumentBody(source, requestedKind)
  } catch {
    return documentError(502, "author_document_unavailable")
  }

  return authorSupplementalPage(descriptor, bodyHtml)
}
