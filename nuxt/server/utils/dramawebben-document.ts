import { createError, type H3Event } from "h3"
import { parseHTML } from "linkedom"

import type {
  DramawebbenDocumentErrorCode,
  DramawebbenDocumentKind,
  DramawebbenManagedDocument
} from "../../shared/types/dramawebben-document"
import type { SanitizedHtml } from "../../shared/types/renderable-html"
import { issueDramawebbenDocumentHtml } from "../../shared/utils/renderable-html"
import { hasC0OrC1Control, hasLoneSurrogate } from "../../shared/utils/text-safety"

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
const managedSourceTimeoutMs = 10_000
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
const safeClassToken = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u
const safeRelToken = /^[a-z][a-z0-9-]{0,31}$/u

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

function hasUnsafeUrlCodeUnit(value: string): boolean {
  return value.includes("\\") || hasC0OrC1Control(value) || hasLoneSurrogate(value)
}

function safeHref(value: string): boolean {
  if (value !== value.trim() || hasUnsafeUrlCodeUnit(value)) return false
  const decoded = fullyDecode(value)
  if (decoded === null || hasUnsafeUrlCodeUnit(decoded) || hasTraversalSegment(decoded)) {
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

function attributeAllowed(elementName: string, attributeName: string): boolean {
  return attributeName === "class"
    || (elementName === "a" && ["href", "target", "rel"].includes(attributeName))
}

function safeClassValue(value: string): boolean {
  return value === value.trim()
    && value.length <= 512
    && value.split(/\s+/u).every(token => safeClassToken.test(token))
}

function safeRelValue(value: string): boolean {
  return value === value.trim()
    && value.length <= 128
    && value.split(/\s+/u).every(token => safeRelToken.test(token))
}

function sanitizeAnchor(element: SanitizableElement): void {
  if (element.hasAttribute("href") && !safeHref(element.getAttribute("href") ?? "")) {
    element.removeAttribute("href")
  }
  if (element.hasAttribute("target") && element.getAttribute("target") !== "_blank") {
    element.removeAttribute("target")
  }
  if (element.hasAttribute("rel") && !safeRelValue(element.getAttribute("rel") ?? "")) {
    element.removeAttribute("rel")
  }
  if (element.getAttribute("target") !== "_blank") return
  const rel = new Set((element.getAttribute("rel") ?? "").split(/\s+/u).filter(Boolean))
  rel.add("noopener")
  rel.add("noreferrer")
  element.setAttribute("rel", [...rel].join(" "))
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
    if (!attributeAllowed(name, attributeName)) element.removeAttribute(attribute.name)
  }

  if (element.hasAttribute("class")
    && !safeClassValue(element.getAttribute("class") ?? "")) {
    element.removeAttribute("class")
  }

  if (name === "a") sanitizeAnchor(element)
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

export function parseDramawebbenDocumentBody(
  source: string
): SanitizedHtml<"dramawebben-document"> {
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
  return issueDramawebbenDocumentHtml(body.innerHTML)
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

async function readBoundedResponse(response: Response, signal: AbortSignal): Promise<string> {
  const declaredLength = response.headers.get("content-length")
  if (declaredLength !== null
    && /^\d+$/u.test(declaredLength)
    && Number(declaredLength) > maxBytes) {
    await response.body?.cancel().catch(() => undefined)
    throw new InvalidDramawebbenDocumentSource()
  }

  if (response.body === null) return ""
  const reader = response.body.getReader()
  let cancellation: Promise<void> | null = null
  const cancelReader = (): Promise<void> => {
    cancellation ??= reader.cancel().catch(() => undefined)
    return cancellation
  }
  const readChunk = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    if (signal.aborted) {
      await cancelReader()
      throw signal.reason
    }
    let rejectAbort!: (reason?: unknown) => void
    const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject })
    const onAbort = () => {
      void cancelReader()
      rejectAbort(signal.reason)
    }
    signal.addEventListener("abort", onAbort, { once: true })
    if (signal.aborted) onAbort()
    try {
      return await Promise.race([reader.read(), aborted])
    } finally {
      signal.removeEventListener("abort", onAbort)
    }
  }
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await readChunk()
      if (done) break
      if (value === undefined) continue
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await cancelReader()
        throw new InvalidDramawebbenDocumentSource()
      }
      chunks.push(value)
    }
  } catch (error) {
    await cancelReader()
    throw error
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
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new Error("Dramawebben managed source timeout"))
  }, managedSourceTimeoutMs)
  try {
    let response: Response
    try {
      response = await fetch(sourceUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal
      })
      if (controller.signal.aborted) throw controller.signal.reason
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
      source = await readBoundedResponse(response, controller.signal)
    } catch {
      return dramawebbenDocumentError(502, "dramawebben_document_unavailable")
    }

    let bodyHtml: SanitizedHtml<"dramawebben-document">
    try {
      bodyHtml = parseDramawebbenDocumentBody(source)
    } catch {
      return dramawebbenDocumentError(502, "dramawebben_document_unavailable")
    }
    return { documentKind: kind, bodyHtml }
  } finally {
    clearTimeout(timer)
  }
}
