import { createError, type H3Event } from "h3"
import { parseHTML } from "linkedom"

import { createLbApiClient } from "../../app/lib/api/client"
import type { components } from "../../app/lib/api/generated/lbapi"
import type {
  AuthorDocumentErrorCode,
  AuthorDocumentKind,
  AuthorSupplementalPage
} from "../../shared/types/author-document"

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

const allowedElements = new Set([
  "a", "abbr", "b", "blockquote", "br", "caption", "cite", "code",
  "col", "colgroup", "dd", "del", "div", "dl", "dt", "em",
  "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "i", "img", "ins", "li", "ol", "p", "pre", "q", "s", "small",
  "span", "strong", "sub", "sup", "table", "tbody", "td", "tfoot",
  "th", "thead", "tr", "u", "ul"
])

const removedSubtrees = new Set([
  "applet", "audio", "base", "button", "canvas", "embed", "form",
  "frame", "frameset", "iframe", "input", "link", "math", "meta",
  "noscript", "object", "option", "picture", "script", "select", "source",
  "style", "svg", "template", "textarea", "video"
])

const globalAttributes = new Set(["class", "id", "lang", "title"])
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

const unsafeCharacters = /[\\/%\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u
const unsafeUrlCharacters = /[\\\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u

function isRecord(value: unknown): value is UnknownRecord {
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
    && !unsafeCharacters.test(value)
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

function isAuthorDocumentDescriptor(value: unknown): value is AuthorDocumentDescriptor {
  if (!isRecord(value)) return false
  return Object.keys(value).length === descriptorKeys.size
    && Object.keys(value).every(key => descriptorKeys.has(key))
    && typeof value.author_id === "string"
    && typeof value.normalized_author_id === "string"
    && typeof value.full_name === "string" && value.full_name.length > 0
    && (value.birth_year === null || typeof value.birth_year === "string")
    && (value.death_year === null || typeof value.death_year === "string")
    && typeof value.has_introduction === "boolean"
    && typeof value.has_dramawebben === "boolean"
    && (value.search_url === null || typeof value.search_url === "string")
    && (value.audio_url === null || typeof value.audio_url === "string")
    && (value.document_kind === "presentation" || value.document_kind === "bibliografi")
    && typeof value.source_path === "string"
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

function safeUrl(value: string, kind: "href" | "src"): boolean {
  if (value !== value.trim() || unsafeUrlCharacters.test(value)) return false
  const decoded = fullyDecode(value)
  if (decoded === null || unsafeUrlCharacters.test(decoded)) return false
  if (decoded.startsWith("//") || hasTraversalSegment(decoded)) return false

  if (decoded.startsWith("#")) return kind === "href"
  const scheme = /^([a-z][a-z0-9+.-]*):/iu.exec(decoded)?.[1]?.toLowerCase()
  if (!scheme) return true
  if (kind === "src") return scheme === "https"
  return ["http", "https", "mailto", "tel"].includes(scheme)
}

function sanitizeElement(element: SanitizableElement): void {
  const name = element.localName.toLowerCase()
  if (removedSubtrees.has(name)) {
    element.remove()
    return
  }

  for (const child of [...element.childNodes]) sanitizeNode(child)

  if (!allowedElements.has(name)) {
    element.replaceWith(...element.childNodes)
    return
  }

  const specificAttributes = elementAttributes[name]
  for (const attribute of [...element.attributes]) {
    const attributeName = attribute.name.toLowerCase()
    if (!globalAttributes.has(attributeName) && !specificAttributes?.has(attributeName)) {
      element.removeAttribute(attribute.name)
    }
  }

  if (name === "a" && element.hasAttribute("href")) {
    const href = element.getAttribute("href") ?? ""
    if (!safeUrl(href, "href")) element.removeAttribute("href")
  }
  if (name === "img" && element.hasAttribute("src")) {
    const src = element.getAttribute("src") ?? ""
    if (!safeUrl(src, "src")) element.removeAttribute("src")
  }
  if (name === "a" && element.getAttribute("target") === "_blank") {
    const rel = new Set((element.getAttribute("rel") ?? "").split(/\s+/u).filter(Boolean))
    rel.add("noopener")
    rel.add("noreferrer")
    element.setAttribute("rel", [...rel].join(" "))
  }
}

function sanitizeNode(node: SanitizableNode): void {
  if (node.nodeType === 8) {
    node.parentNode?.removeChild(node)
    return
  }
  if (node.nodeType === 1) sanitizeElement(node as SanitizableElement)
}

export class InvalidAuthorDocumentSource extends Error {
  constructor() {
    super("Invalid author document source")
    this.name = "InvalidAuthorDocumentSource"
  }
}

export function parseAuthorDocumentBody(source: string): string {
  let document: ParsedAuthorDocument
  try {
    ({ document } = parseHTML(source) as unknown as { document: ParsedAuthorDocument })
  } catch {
    throw new InvalidAuthorDocumentSource()
  }
  const bodies = [...document.querySelectorAll("body")]
  if (bodies.length !== 1) throw new InvalidAuthorDocumentSource()
  const body = bodies[0]!
  for (const child of [...body.childNodes]) sanitizeNode(child)
  return body.innerHTML
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

function fetchStatus(error: unknown): number | null {
  if (!isRecord(error)) return null
  if (isRecord(error.response) && typeof error.response.status === "number") {
    return error.response.status
  }
  if (typeof error.statusCode === "number") return error.statusCode
  if (typeof error.status === "number") return error.status
  return null
}

function formatYears(birth: string | null, death: string | null): string {
  const left = birth && birth !== "0000" ? birth : ""
  const right = death && death !== "0000" ? death : ""
  if (left && right) return `${left}-${right}`
  if (left) return `f. ${left}`
  if (right) return `d. ${right}`
  return ""
}

export async function loadAuthorDocument(
  event: H3Event,
  requestedAuthor: string,
  requestedKind: AuthorDocumentKind
): Promise<AuthorSupplementalPage> {
  const config = useRuntimeConfig(event)
  const client = createLbApiClient(config.apiBase)
  let result
  try {
    result = await client.GET("/authors/{author_id}/documents/{document_kind}", {
      redirect: "manual",
      params: {
        path: {
          author_id: requestedAuthor,
          document_kind: requestedKind
        }
      }
    })
  } catch {
    return documentError(502, "author_document_unavailable")
  }

  if (result.response.status === 404) {
    return documentError(404, "author_document_author_not_found")
  }
  if (result.response.status !== 200) {
    return documentError(502, "author_document_unavailable")
  }

  let expected: string
  try {
    expected = expectedAuthorDocumentSource(result.data, requestedAuthor, requestedKind)
  } catch {
    return documentError(502, "author_document_unavailable")
  }
  const descriptor = result.data as AuthorDocumentDescriptor

  let source: string
  try {
    source = await $fetch<string>(
      `${config.contentBase.replace(/\/$/u, "")}${expected}`,
      { redirect: "manual", responseType: "text", retry: 0 }
    )
  } catch (error) {
    if (fetchStatus(error) === 404) {
      return documentError(404, "author_document_not_found")
    }
    return documentError(502, "author_document_unavailable")
  }

  let bodyHtml: string
  try {
    bodyHtml = parseAuthorDocumentBody(source)
  } catch {
    return documentError(502, "author_document_unavailable")
  }

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
