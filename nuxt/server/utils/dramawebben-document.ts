import { createError, type H3Event } from "h3"
import { parseHTML } from "linkedom"

import type {
  DramawebbenDocumentErrorCode,
  DramawebbenDocumentKind,
  DramawebbenManagedDocument
} from "../../shared/types/dramawebben-document"

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
type ParsedDramawebbenDocument = {
  querySelectorAll: (selector: string) => Iterable<SanitizableElement>
}

const sources = Object.freeze({
  om: "/red/dramawebben/om.html",
  kringtexter: "/red/dramawebben/kringtexter/kringtexter.html"
} as const)

const maxBytes = 262_144
const allowedElements = new Set([
  "a", "br", "div", "em", "h2", "h3", "i", "p", "strong", "table",
  "tbody", "td", "tr"
])
const removedSubtrees = new Set([
  "applet", "audio", "base", "button", "canvas", "embed", "form", "frame",
  "frameset", "iframe", "input", "link", "math", "meta", "noscript", "object",
  "option", "picture", "script", "select", "source", "style", "svg", "template",
  "textarea", "video"
])
const unsafeUrlCharacters = /[\\\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u

function isDocumentKind(value: unknown): value is DramawebbenDocumentKind {
  return value === "om" || value === "kringtexter"
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

function safeHref(value: string): boolean {
  if (value !== value.trim() || unsafeUrlCharacters.test(value)) return false
  const decoded = fullyDecode(value)
  if (decoded === null || unsafeUrlCharacters.test(decoded) || hasTraversalSegment(decoded)) {
    return false
  }
  if (decoded.startsWith("#")) return true
  if (decoded.startsWith("/")) return !decoded.startsWith("//")
  if (!/^https:\/\//iu.test(decoded)) return false
  try {
    return new URL(decoded).protocol === "https:"
  } catch {
    return false
  }
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

  for (const attribute of [...element.attributes]) {
    const attributeName = attribute.name.toLowerCase()
    const allowed = attributeName === "class"
      || (name === "a" && ["href", "target", "rel"].includes(attributeName))
    if (!allowed) element.removeAttribute(attribute.name)
  }

  if (name !== "a") return
  if (element.hasAttribute("href") && !safeHref(element.getAttribute("href") ?? "")) {
    element.removeAttribute("href")
  }
  if (element.hasAttribute("target") && element.getAttribute("target") !== "_blank") {
    element.removeAttribute("target")
  }
  if (element.getAttribute("target") === "_blank") {
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

export class InvalidDramawebbenDocumentSource extends Error {
  constructor() {
    super("Invalid Dramawebben document source")
    this.name = "InvalidDramawebbenDocumentSource"
  }
}

export function parseDramawebbenDocumentBody(source: string): string {
  let document: ParsedDramawebbenDocument
  try {
    ({ document } = parseHTML(source) as unknown as {
      document: ParsedDramawebbenDocument
    })
  } catch {
    throw new InvalidDramawebbenDocumentSource()
  }
  const bodies = [...document.querySelectorAll("body")]
  if (bodies.length !== 1) throw new InvalidDramawebbenDocumentSource()
  const body = bodies[0]!
  for (const child of [...body.childNodes]) sanitizeNode(child)
  return body.innerHTML
}

export function dramawebbenDocumentError(
  statusCode: 404 | 502,
  code: DramawebbenDocumentErrorCode
): never {
  throw createError({
    statusCode,
    statusMessage: statusCode === 404 ? "Not Found" : "Bad Gateway",
    data: { code }
  })
}

async function readBoundedResponse(response: Response): Promise<string> {
  const declaredLength = response.headers.get("content-length")
  if (declaredLength !== null
    && /^\d+$/u.test(declaredLength)
    && Number(declaredLength) > maxBytes) {
    await response.body?.cancel().catch(() => undefined)
    throw new InvalidDramawebbenDocumentSource()
  }

  if (response.body === null) return ""
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined) continue
    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new InvalidDramawebbenDocumentSource()
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

function isHtmlResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type")
  return contentType !== null
    && contentType.split(";", 1)[0]?.trim().toLowerCase() === "text/html"
}

export async function loadDramawebbenDocument(
  event: H3Event,
  kind: DramawebbenDocumentKind
): Promise<DramawebbenManagedDocument> {
  if (!isDocumentKind(kind)) {
    return dramawebbenDocumentError(404, "dramawebben_document_not_found")
  }

  const config = useRuntimeConfig(event)
  const sourceUrl = `${config.contentBase.replace(/\/$/u, "")}${sources[kind]}`
  let response: Response
  try {
    response = await fetch(sourceUrl, { method: "GET", redirect: "manual" })
  } catch {
    return dramawebbenDocumentError(502, "dramawebben_document_unavailable")
  }

  if (response.status === 404) {
    await response.body?.cancel().catch(() => undefined)
    return dramawebbenDocumentError(404, "dramawebben_document_not_found")
  }
  if (response.status !== 200 || !isHtmlResponse(response)) {
    await response.body?.cancel().catch(() => undefined)
    return dramawebbenDocumentError(502, "dramawebben_document_unavailable")
  }

  let source: string
  try {
    source = await readBoundedResponse(response)
  } catch {
    return dramawebbenDocumentError(502, "dramawebben_document_unavailable")
  }

  let bodyHtml: string
  try {
    bodyHtml = parseDramawebbenDocumentBody(source)
  } catch {
    return dramawebbenDocumentError(502, "dramawebben_document_unavailable")
  }
  return { documentKind: kind, bodyHtml }
}
