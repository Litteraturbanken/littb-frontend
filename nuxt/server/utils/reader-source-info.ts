import { createError, type H3Event } from "h3"
import { parseHTML } from "linkedom"

import { createLbApiClient } from "../../app/lib/api/client"
import type { components } from "../../app/lib/api/generated/lbapi"
import type {
  ReaderSourceInfo,
  ReaderSourceInfoAttribution,
  ReaderSourceInfoMediaType,
  ReaderSourceInfoProvenance
} from "../../shared/types/reader-source-info"
import {
  hasC0OrC1Control,
  hasHtmlUnsafeCodeUnit,
  hasLoneSurrogate
} from "../../shared/utils/text-safety"

type WorkSourceInfoResponse = components["schemas"]["WorkSourceInfoResponse"]
type UnknownRecord = Record<string, unknown>
type ReaderMediaQuery = "etext" | "faksimil"
type LbApiClient = ReturnType<typeof createLbApiClient>

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
  outerHTML: string
  textContent: string | null
  remove: () => void
  replaceWith: (...nodes: SanitizableNode[]) => void
  hasAttribute: (name: string) => boolean
  getAttribute: (name: string) => string | null
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
}

interface ParsedDocument {
  querySelectorAll: (selector: string) => Iterable<SanitizableElement>
}

interface ProvenanceTextDefinition {
  etext?: string
  faksimilprint?: string
  faksimilnoprint?: string
  pdf?: string
}

interface ProvenanceDefinition {
  fullname: string
  image: string | null
  link: string | null
  text: ProvenanceTextDefinition
  text2?: ProvenanceTextDefinition
}

export interface ReaderSourceInfoStaticDefinitions {
  provenance: Record<string, ProvenanceDefinition>
  licenses: Record<string, string>
}

const MAX_STATIC_BYTES = 1_048_576
const STATIC_MAX_AGE_MS = 300_000
const SAFE_STATIC_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/u
const allowedClassesByContext = {
  editorial: new Set(["role", "sc"]),
  inline: new Set(["role", "sc"]),
  license: new Set<string>()
} as const

const workKeys = new Set([
  "author_id", "authors", "cover", "download_actions", "dramawebben",
  "errata", "imprint", "is_printed", "libris_id", "license_key",
  "media_type", "provenance", "read_actions", "short_title",
  "source_description_author_id", "source_description_html", "start_page",
  "text_type", "title", "title_path", "urn", "work_id",
  "work_introduction_author_id", "work_introduction_html"
])
const authorKeys = new Set([
  "author_id", "author_type", "full_name", "role", "surname", "url"
])
const coverKeys = new Set(["large_url", "small_url"])
const readActionKeys = new Set(["label", "media_type", "url"])
const downloadActionKeys = new Set([
  "filename", "label", "media_type", "size_bytes", "url"
])
const provenanceKeys = new Set(["library", "signum", "use_alternate_text"])
const errataKeys = new Set(["cells_html"])
const dramaKeys = new Set(["facts", "has_introduction", "history_html", "roles"])
const dramaFactKeys = new Set(["key", "value"])
const validDramaFacts = new Set([
  "first_staged", "first_staged_in_sweden", "number_of_pages",
  "number_of_acts", "number_of_roles", "male_roles", "female_roles",
  "other_roles"
])
const allowedElements = new Set([
  "a", "abbr", "b", "blockquote", "br", "cite", "code", "div", "em",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li",
  "ol", "p", "pre", "q", "s", "small", "span", "strong", "sub",
  "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u",
  "ul"
])
const inlineAllowedElements = new Set([
  "a", "abbr", "b", "br", "cite", "code", "em", "i", "q", "s",
  "small", "span", "strong", "sub", "sup", "u"
])
const removedSubtrees = new Set([
  "applet", "audio", "base", "button", "canvas", "embed", "form", "frame",
  "frameset", "iframe", "input", "link", "math", "meta", "noscript",
  "object", "option", "picture", "script", "select", "source", "style",
  "svg", "template", "textarea", "video"
])
const globalAttributes = new Set(["class", "lang", "title"])
const elementAttributes: Record<string, ReadonlySet<string>> = {
  a: new Set(["href", "rel", "target"]),
  img: new Set(["alt", "height", "src", "width"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  ol: new Set(["start", "type"]),
  li: new Set(["value"])
}

const staticCache = new Map<
  string,
  { expiresAt: number, value: Promise<ReaderSourceInfoStaticDefinitions> }
>()

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function exactKeys(value: UnknownRecord, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.size && keys.every(key => expected.has(key))
}

function invalidSourceInfo(): never {
  throw new Error("Invalid Reader source information")
}

function sourceInfoHttpError(statusCode: 404 | 422 | 502): never {
  throw createError({
    statusCode,
    statusMessage: statusCode === 404
      ? "Not Found"
      : statusCode === 422
        ? "Unprocessable Entity"
        : "Bad Gateway",
    data: {
      code: statusCode === 404
        ? "reader_source_info_not_found"
        : statusCode === 422
          ? "reader_source_info_invalid_request"
          : "reader_source_info_unavailable"
    }
  })
}

function boundedString(
  value: unknown,
  maximum: number,
  allowEmpty = false
): value is string {
  return typeof value === "string"
    && value.length <= maximum
    && (allowEmpty || value.length > 0)
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

function optionalString(value: unknown, maximum: number): value is string | null {
  return value === null || boundedString(value, maximum)
}

function boundedHtmlString(
  value: unknown,
  maximum: number,
  allowEmpty = false
): value is string {
  return typeof value === "string"
    && value.length <= maximum
    && (allowEmpty || value.length > 0)
    && !hasHtmlUnsafeCodeUnit(value)
}

function optionalHtmlString(value: unknown, maximum: number): value is string | null {
  return value === null || boundedHtmlString(value, maximum)
}

function validSegment(value: unknown, maximum = 200): value is string {
  return boundedString(value, maximum)
    && value === value.trim()
    && value !== "."
    && value !== ".."
    && !value.includes("%")
    && !value.includes("/")
    && !value.includes("\\")
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

function hasTraversal(value: string): boolean {
  const path = (value.split("#", 1)[0] ?? "").split("?", 1)[0] ?? ""
  return path.split("/").some(segment => segment === "." || segment === "..")
}

function hasUnsafeUrlCodeUnit(value: string): boolean {
  return value.includes("\\") || hasC0OrC1Control(value) || hasLoneSurrogate(value)
}

function safeRootUrl(value: unknown): value is string {
  if (!boundedString(value, 2_000) || value !== value.trim()) return false
  if (!value.startsWith("/") || value.startsWith("//") || hasUnsafeUrlCodeUnit(value)) {
    return false
  }
  const decoded = fullyDecode(value)
  return decoded !== null
    && decoded.startsWith("/")
    && !decoded.startsWith("//")
    && !hasUnsafeUrlCodeUnit(decoded)
    && !hasTraversal(decoded)
}

function safeHttpUrl(value: unknown): value is string {
  if (!boundedString(value, 2_000) || value !== value.trim()) return false
  const decoded = fullyDecode(value)
  if (decoded === null || hasUnsafeUrlCodeUnit(decoded)) return false
  try {
    const parsed = new URL(decoded)
    return (parsed.protocol === "http:" || parsed.protocol === "https:")
      && parsed.username === ""
      && parsed.password === ""
  } catch {
    return false
  }
}

function safeStaticFilename(value: unknown): value is string {
  if (typeof value !== "string" || !SAFE_STATIC_FILENAME.test(value)) return false
  const decoded = fullyDecode(value)
  return decoded !== null
    && decoded !== "."
    && decoded !== ".."
    && !decoded.includes("/")
    && !decoded.includes("\\")
    && !hasC0OrC1Control(decoded)
    && !hasLoneSurrogate(decoded)
}

function validPublicHref(value: string): boolean {
  if (value.startsWith("#")) return !hasUnsafeUrlCodeUnit(value)
  return safeRootUrl(value) || safeHttpUrl(value)
}

function safeNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
}

function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function strictArray(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) invalidSourceInfo()
  return value
}

export function validateReaderSourceInfoResponse(
  value: unknown,
  requestedAuthorId: string,
  requestedTitlePath: string,
  _requestedMediaType: ReaderMediaQuery | null = null
): WorkSourceInfoResponse {
  if (!isRecord(value) || !exactKeys(value, workKeys)) invalidSourceInfo()
  if (!validSegment(requestedAuthorId, 100) || !validSegment(requestedTitlePath, 200)) {
    invalidSourceInfo()
  }
  if (
    !validSegment(value.work_id)
    || !validSegment(value.author_id)
    || value.title_path !== requestedTitlePath
    || !validSegment(value.title_path)
    || !["etext", "faksimil", "pdf", "infopost"].includes(String(value.media_type))
    || !optionalString(value.start_page, 200)
    || (value.start_page !== null && !validSegment(value.start_page))
    || !boundedString(value.title, 20_000)
    || !optionalString(value.short_title, 20_000)
    || !optionalString(value.text_type, 200)
    || !optionalHtmlString(value.source_description_html, 200_000)
    || !optionalString(value.source_description_author_id, 200)
    || (value.source_description_author_id !== null
      && !validSegment(value.source_description_author_id))
    || !optionalHtmlString(value.work_introduction_html, 200_000)
    || !optionalString(value.work_introduction_author_id, 200)
    || (value.work_introduction_author_id !== null
      && !validSegment(value.work_introduction_author_id))
    || !optionalString(value.imprint, 20_000)
    || !optionalString(value.urn, 2_000)
    || !optionalString(value.libris_id, 200)
    || !optionalString(value.license_key, 200)
    || (value.is_printed !== null && typeof value.is_printed !== "boolean")
  ) invalidSourceInfo()

  const authors = strictArray(value.authors, 100)
  const authorIds = new Set<string>()
  for (const item of authors) {
    if (!isRecord(item) || !exactKeys(item, authorKeys)) invalidSourceInfo()
    if (
      !validSegment(item.author_id)
      || authorIds.has(item.author_id)
      || !boundedString(item.full_name, 20_000)
      || !optionalString(item.surname, 20_000)
      || !optionalString(item.role, 200)
      || !optionalString(item.author_type, 200)
      || !safeRootUrl(item.url)
      || item.url !== `/författare/${encodeRfc3986Segment(item.author_id)}`
    ) invalidSourceInfo()
    authorIds.add(item.author_id)
  }
  if (authors.length > 0 && !authorIds.has(value.author_id)) invalidSourceInfo()

  if (!isRecord(value.cover) || !exactKeys(value.cover, coverKeys)) invalidSourceInfo()
  const encodedWorkId = encodeRfc3986Segment(value.work_id as string)
  if (
    !safeRootUrl(value.cover.small_url)
    || !safeRootUrl(value.cover.large_url)
    || value.cover.small_url !== `/txt/${encodedWorkId}/${encodedWorkId}_small.jpeg`
    || value.cover.large_url !== `/txt/${encodedWorkId}/${encodedWorkId}_large.jpeg`
  ) invalidSourceInfo()

  const readActions = strictArray(value.read_actions, 2)
  const readMedia = new Set<string>()
  for (const item of readActions) {
    if (!isRecord(item) || !exactKeys(item, readActionKeys)) invalidSourceInfo()
    if (
      (item.media_type !== "etext" && item.media_type !== "faksimil")
      || item.label !== item.media_type
      || readMedia.has(item.media_type)
      || !safeRootUrl(item.url)
      || !item.url.startsWith("/författare/")
      || !item.url.endsWith(`/${item.media_type}`)
    ) invalidSourceInfo()
    readMedia.add(item.media_type)
  }

  const downloadActions = strictArray(value.download_actions, 2)
  const downloadMedia = new Set<string>()
  for (const item of downloadActions) {
    if (!isRecord(item) || !exactKeys(item, downloadActionKeys)) invalidSourceInfo()
    const filename = String(item.filename)
    const filenameCodePointLength = [...filename].length
    if (
      (item.media_type !== "epub" && item.media_type !== "pdf")
      || item.label !== item.media_type
      || downloadMedia.has(item.media_type)
      || !safeRootUrl(item.url)
      || filenameCodePointLength < 1
      || filenameCodePointLength > 500
      || filename.includes("/")
      || filename.includes("\\")
      || hasC0OrC1Control(filename)
      || !filename.endsWith(`.${item.media_type}`)
      || (item.size_bytes !== null && !safeNonnegativeInteger(item.size_bytes))
    ) invalidSourceInfo()
    const allowedUrl = item.media_type === "epub"
      ? item.url.startsWith("/txt/epub/") && item.url.endsWith(".epub")
      : (item.url.startsWith("/txt/") || item.url.startsWith("/export/faksimil/"))
        && item.url.endsWith(".pdf")
    if (!allowedUrl) invalidSourceInfo()
    downloadMedia.add(item.media_type)
  }

  for (const item of strictArray(value.provenance, 100)) {
    if (!isRecord(item) || !exactKeys(item, provenanceKeys)) invalidSourceInfo()
    if (
      !boundedString(item.library, 200)
      || item.library !== item.library.trim()
      || !optionalString(item.signum, 20_000)
      || typeof item.use_alternate_text !== "boolean"
    ) invalidSourceInfo()
  }

  for (const row of strictArray(value.errata, 10_000)) {
    if (!isRecord(row) || !exactKeys(row, errataKeys)) invalidSourceInfo()
    for (const cell of strictArray(row.cells_html, 100)) {
      if (!boundedHtmlString(cell, 200_000, true)) invalidSourceInfo()
    }
  }

  if (value.dramawebben !== null) {
    if (!isRecord(value.dramawebben) || !exactKeys(value.dramawebben, dramaKeys)) {
      invalidSourceInfo()
    }
    if (
      typeof value.dramawebben.has_introduction !== "boolean"
      || !optionalHtmlString(value.dramawebben.history_html, 200_000)
    ) invalidSourceInfo()
    const seenFacts = new Set<string>()
    for (const fact of strictArray(value.dramawebben.facts, 8)) {
      if (!isRecord(fact) || !exactKeys(fact, dramaFactKeys)) invalidSourceInfo()
      if (
        typeof fact.key !== "string"
        || !validDramaFacts.has(fact.key)
        || seenFacts.has(fact.key)
        || !boundedString(fact.value, 20_000)
      ) invalidSourceInfo()
      seenFacts.add(fact.key)
    }
    for (const role of strictArray(value.dramawebben.roles, 1_000)) {
      if (!boundedHtmlString(role, 20_000)) invalidSourceInfo()
    }
  }

  return value as WorkSourceInfoResponse
}

export function parseReaderSourceInfoRequest(
  author: unknown,
  title: unknown,
  query: Record<string, unknown>
): { authorId: string, titlePath: string, mediaType: ReaderMediaQuery | null } {
  if (!validSegment(author, 100) || !validSegment(title, 200)) {
    return sourceInfoHttpError(404)
  }
  const queryKeys = Object.keys(query)
  if (queryKeys.some(key => key !== "media_type") || queryKeys.length > 1) {
    return sourceInfoHttpError(422)
  }
  const media = query.media_type
  if (media !== undefined && media !== "etext" && media !== "faksimil") {
    return sourceInfoHttpError(422)
  }
  return { authorId: author, titlePath: title, mediaType: media ?? null }
}

export async function fetchWorkSourceInfo(
  client: LbApiClient,
  authorId: string,
  titlePath: string,
  mediaType: ReaderMediaQuery | null
): Promise<WorkSourceInfoResponse> {
  const request = () => client.GET(
    "/works/{author_id}/{title_path}/source-info",
    {
      params: {
        path: { author_id: authorId, title_path: titlePath },
        ...(mediaType === null ? {} : { query: { media_type: mediaType } })
      },
      redirect: "manual"
    }
  )
  let result: Awaited<ReturnType<typeof request>>
  try {
    result = await request()
  } catch {
    return sourceInfoHttpError(502)
  }
  if (
    !result.response.ok
    || result.error !== undefined
    || result.data === undefined
  ) {
    return sourceInfoHttpError(result.response.status === 404 ? 404 : 502)
  }
  try {
    return validateReaderSourceInfoResponse(result.data, authorId, titlePath, mediaType)
  } catch {
    return sourceInfoHttpError(502)
  }
}

function sanitizeClasses(
  value: string,
  context: "editorial" | "inline" | "license"
): string | null {
  const classes = value.split(/\s+/u)
    .filter(className => allowedClassesByContext[context].has(className))
  return classes.length === 0 ? null : [...new Set(classes)].join(" ")
}

function sanitizeIntegerAttribute(value: string, minimum: number, maximum: number): string | null {
  if (!/^\d+$/u.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? String(parsed)
    : null
}

function sanitizeElement(
  element: SanitizableElement,
  context: "editorial" | "inline" | "license"
): void {
  const name = element.localName.toLowerCase()
  if (removedSubtrees.has(name)) {
    element.remove()
    return
  }
  for (const child of [...element.childNodes]) sanitizeNode(child, context)
  const contextElements = context === "inline" ? inlineAllowedElements : allowedElements
  if (!contextElements.has(name)) {
    element.replaceWith(...element.childNodes)
    return
  }

  for (const attribute of [...element.attributes]) {
    const attributeName = attribute.name.toLowerCase()
    if (!globalAttributes.has(attributeName)
      && !elementAttributes[name]?.has(attributeName)) {
      element.removeAttribute(attribute.name)
    }
  }
  if (element.hasAttribute("class")) {
    const value = sanitizeClasses(element.getAttribute("class") ?? "", context)
    if (value === null) element.removeAttribute("class")
    else element.setAttribute("class", value)
  }
  for (const attributeName of ["colspan", "rowspan"]) {
    if (!element.hasAttribute(attributeName)) continue
    const value = sanitizeIntegerAttribute(
      element.getAttribute(attributeName) ?? "",
      1,
      100
    )
    if (value === null) element.removeAttribute(attributeName)
    else element.setAttribute(attributeName, value)
  }

  if (name === "a") {
    const legacyHref = element.getAttribute("href")
    if (legacyHref?.startsWith("/forfattare/")) {
      element.setAttribute(
        "href",
        `/författare/${legacyHref.slice("/forfattare/".length)}`
      )
    }
    const href = element.getAttribute("href")
    if (href !== null && !validPublicHref(href)) element.removeAttribute("href")
    if (!element.hasAttribute("href")) {
      element.removeAttribute("target")
      element.removeAttribute("rel")
      return
    }
    const sanitizedHref = element.getAttribute("href") ?? ""
    if (safeHttpUrl(sanitizedHref)) {
      element.setAttribute("target", "_blank")
      element.setAttribute("rel", "noopener noreferrer")
    } else {
      element.removeAttribute("target")
      element.removeAttribute("rel")
    }
  }

  if (name === "img") {
    let src = element.getAttribute("src")
    if (src !== null && context === "license" && safeStaticFilename(src)) {
      src = `/red/bilder/gemensamt/${encodeURIComponent(src)}`
      element.setAttribute("src", src)
    }
    const imageIsSafe = src !== null && safeRootUrl(src)
      && src.startsWith("/red/bilder/gemensamt/")
    if (!imageIsSafe) element.remove()
  }
}

function sanitizeNode(
  node: SanitizableNode,
  context: "editorial" | "inline" | "license"
): void {
  if (node.nodeType === 7 || node.nodeType === 8) {
    node.parentNode?.removeChild(node)
    return
  }
  if (node.nodeType === 1) sanitizeElement(node as SanitizableElement, context)
}

export function sanitizeReaderSourceInfoHtml(
  source: string,
  context: "editorial" | "inline" | "license" = "editorial"
): string {
  if (!boundedHtmlString(source, 200_000, true)) invalidSourceInfo()
  let document: ParsedDocument
  try {
    ({ document } = parseHTML(
      `<!doctype html><html><body>${source}</body></html>`
    ) as unknown as { document: ParsedDocument })
  } catch {
    invalidSourceInfo()
  }
  const bodies = [...document.querySelectorAll("body")]
  if (bodies.length !== 1) invalidSourceInfo()
  const body = bodies[0]!
  for (const child of [...body.childNodes]) sanitizeNode(child, context)
  return body.innerHTML
}

function validateTextDefinition(value: unknown): ProvenanceTextDefinition {
  const allowed = new Set(["etext", "faksimilnoprint", "faksimilprint", "pdf"])
  if (!isRecord(value)
    || Object.keys(value).length === 0
    || Object.keys(value).some(key => !allowed.has(key))) {
    sourceInfoHttpError(502)
  }
  for (const raw of Object.values(value)) {
    if (!boundedHtmlString(raw, 20_000, true)) sourceInfoHttpError(502)
    validateTemplateTokens(raw, "{{signum}}")
  }
  return value as unknown as ProvenanceTextDefinition
}

function validateTemplateTokens(source: string, allowedToken: string): void {
  const tokens = source.match(/\{\{[^{}]*\}\}/gu) ?? []
  if (tokens.some(token => token !== allowedToken)) sourceInfoHttpError(502)
  const withoutTokens = source.replaceAll(allowedToken, "")
  if (withoutTokens.includes("{{") || withoutTokens.includes("}}")) {
    sourceInfoHttpError(502)
  }
}

function validateProvenanceDefinitions(value: unknown): Record<string, ProvenanceDefinition> {
  if (!isRecord(value) || Object.keys(value).length > 1_000) sourceInfoHttpError(502)
  const output: Record<string, ProvenanceDefinition> = Object.create(null)
  for (const [key, raw] of Object.entries(value)) {
    if (!boundedString(key, 200) || !isRecord(raw)) sourceInfoHttpError(502)
    const allowed = new Set(["fullname", "image", "link", "text", "text2"])
    if (Object.keys(raw).some(field => !allowed.has(field))) sourceInfoHttpError(502)
    if (!Object.hasOwn(raw, "fullname")
      || !Object.hasOwn(raw, "image")
      || !Object.hasOwn(raw, "link")
      || !Object.hasOwn(raw, "text")
      || !boundedString(raw.fullname, 20_000, true)
      || (raw.image !== null
        && !safeStaticFilename(raw.image))
      || (raw.link !== null
        && (typeof raw.link !== "string" || !safeHttpUrl(raw.link)))) {
      sourceInfoHttpError(502)
    }
    output[key] = {
      fullname: raw.fullname,
      image: raw.image as string | null,
      link: raw.link as string | null,
      text: validateTextDefinition(raw.text),
      ...(raw.text2 === undefined
        ? {}
        : { text2: validateTextDefinition(raw.text2) })
    }
  }
  return output
}

function validateLicenseDefinitions(value: unknown): Record<string, string> {
  if (!isRecord(value) || Object.keys(value).length > 1_000) sourceInfoHttpError(502)
  const output: Record<string, string> = Object.create(null)
  for (const [key, raw] of Object.entries(value)) {
    if (!boundedString(key, 200) || !boundedHtmlString(raw, 200_000, true)) {
      sourceInfoHttpError(502)
    }
    validateTemplateTokens(raw, "{{provenance}}")
    output[key] = raw
  }
  return output
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")
  if (
    response.status !== 200
    || contentType === null
    || contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
  ) {
    await response.body?.cancel().catch(() => undefined)
    return sourceInfoHttpError(502)
  }
  const declared = response.headers.get("content-length")
  if (declared !== null && /^\d+$/u.test(declared) && Number(declared) > MAX_STATIC_BYTES) {
    await response.body?.cancel().catch(() => undefined)
    return sourceInfoHttpError(502)
  }
  if (response.body === null) return sourceInfoHttpError(502)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined) continue
    total += value.byteLength
    if (total > MAX_STATIC_BYTES) {
      await reader.cancel().catch(() => undefined)
      return sourceInfoHttpError(502)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch {
    return sourceInfoHttpError(502)
  }
}

export async function fetchReaderSourceInfoStaticDefinitions(
  contentBase: string,
  fetchImplementation: typeof fetch = fetch
): Promise<ReaderSourceInfoStaticDefinitions> {
  const base = contentBase.replace(/\/$/u, "")
  const paths = [
    "/red/etc/provenance/provenance.json",
    "/red/etc/license/license.json"
  ] as const
  let responses: [Response, Response]
  try {
    responses = await Promise.all(paths.map(path => fetchImplementation(`${base}${path}`, {
      method: "GET",
      redirect: "manual",
      cache: "no-cache",
      headers: { accept: "application/json" }
    }))) as [Response, Response]
  } catch {
    return sourceInfoHttpError(502)
  }
  const [rawProvenance, rawLicenses] = await Promise.all(
    responses.map(response => readBoundedJson(response))
  )
  return {
    provenance: validateProvenanceDefinitions(rawProvenance),
    licenses: validateLicenseDefinitions(rawLicenses)
  }
}

export function clearReaderSourceInfoStaticCache(): void {
  staticCache.clear()
}

export async function loadCachedReaderSourceInfoStaticDefinitions(
  contentBase: string,
  fetchImplementation: typeof fetch = fetch,
  now: number = Date.now()
): Promise<ReaderSourceInfoStaticDefinitions> {
  const key = contentBase.replace(/\/$/u, "")
  const cached = staticCache.get(key)
  if (cached && cached.expiresAt > now) return await cached.value
  const value = fetchReaderSourceInfoStaticDefinitions(key, fetchImplementation)
  staticCache.set(key, { expiresAt: now + STATIC_MAX_AGE_MS, value })
  try {
    return await value
  } catch (error) {
    if (staticCache.get(key)?.value === value) staticCache.delete(key)
    throw error
  }
}

function provenanceTextKey(
  mediaType: ReaderSourceInfoMediaType,
  isPrinted: boolean | null
): keyof ProvenanceTextDefinition | null {
  if (mediaType === "faksimil") return isPrinted ? "faksimilprint" : "faksimilnoprint"
  if (mediaType === "etext" || mediaType === "pdf") return mediaType
  return null
}

export function projectReaderSourceInfoProvenance(
  definitions: Record<string, ProvenanceDefinition>,
  requested: WorkSourceInfoResponse["provenance"],
  mediaType: ReaderSourceInfoMediaType,
  isPrinted: boolean | null
): ReaderSourceInfoProvenance[] {
  const key = provenanceTextKey(mediaType, isPrinted)
  const result: ReaderSourceInfoProvenance[] = []
  requested.forEach(item => {
    const definition = definitions[item.library]
    if (!definition) return
    const textDefinition = item.use_alternate_text && definition.text2
      ? definition.text2
      : definition.text
    const template = key === null ? "" : textDefinition[key]
    if (template === undefined) return
    const signum = item.signum ? ` (${item.signum})` : ""
    result.push({
      fullName: definition.fullname,
      imageUrl: definition.image === null
        ? null
        : `/red/bilder/gemensamt/${encodeURIComponent(definition.image)}`,
      link: definition.link,
      text: template.replaceAll("{{signum}}", signum)
    })
  })
  return result
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function unwrapLicenseText(source: string): string {
  let document: ParsedDocument
  try {
    ({ document } = parseHTML(
      `<!doctype html><html><body>${source}</body></html>`
    ) as unknown as { document: ParsedDocument })
  } catch {
    return sourceInfoHttpError(502)
  }
  const texts = [...document.querySelectorAll("text")]
  if (texts.length !== 1) return sourceInfoHttpError(502)
  return texts[0]!.innerHTML
}

export function projectReaderSourceInfoLicense(
  definitions: Record<string, string>,
  licenseKey: string | null,
  provenance: ReaderSourceInfoProvenance[]
): string | null {
  if (licenseKey === null) return null
  const source = definitions[licenseKey]
  if (source === undefined) return null
  const provenanceHtml = provenance.map(item => item.link === null
    ? escapeHtml(item.fullName)
    : `<a href="${escapeHtml(item.link)}">${escapeHtml(item.fullName)}</a>`
  ).join(" – ")
  const interpolated = unwrapLicenseText(source).replaceAll(
    "{{provenance}}",
    provenanceHtml
  )
  return sanitizeReaderSourceInfoHtml(interpolated, "license")
}

function attributionFromAuthor(
  author: WorkSourceInfoResponse["authors"][number]
): ReaderSourceInfoAttribution {
  return {
    authorId: author.author_id,
    fullName: author.full_name,
    surname: author.surname
  }
}

function validateResolvedAttributions(
  value: unknown,
  requestedIds: readonly string[]
): ReaderSourceInfoAttribution[] {
  if (!Array.isArray(value) || value.length > requestedIds.length) {
    return sourceInfoHttpError(502)
  }
  const requested = new Set(requestedIds)
  const seen = new Set<string>()
  return value.map(item => {
    if (!isRecord(item) || !exactKeys(item, new Set(["author_id", "full_name", "surname"]))) {
      return sourceInfoHttpError(502)
    }
    if (
      !validSegment(item.author_id, 100)
      || !requested.has(item.author_id)
      || seen.has(item.author_id)
      || !boundedString(item.full_name, 2_000)
      || item.full_name !== item.full_name.trim()
      || !optionalString(item.surname, 2_000)
      || (item.surname !== null && item.surname !== item.surname.trim())
    ) return sourceInfoHttpError(502)
    seen.add(item.author_id)
    return {
      authorId: item.author_id,
      fullName: item.full_name,
      surname: item.surname
    }
  })
}

export async function resolveReaderSourceInfoAttributions(
  source: WorkSourceInfoResponse,
  resolver: (ids: string[]) => Promise<unknown>
): Promise<{
  sourceDescriptionAuthor: ReaderSourceInfoAttribution | null
  workIntroductionAuthor: ReaderSourceInfoAttribution | null
}> {
  const existing = new Map(source.authors.map(author => [
    author.author_id,
    attributionFromAuthor(author)
  ]))
  const requestedIds = [
    source.source_description_author_id,
    source.work_introduction_author_id
  ].filter((id): id is string => id !== null)
  const unresolved = [...new Set(requestedIds.filter(id => !existing.has(id)))]
  let resolved: ReaderSourceInfoAttribution[] = []
  if (unresolved.length > 0) {
    try {
      resolved = validateResolvedAttributions(await resolver(unresolved), unresolved)
    } catch (error) {
      if (typeof error === "object" && error !== null && "statusCode" in error) throw error
      resolved = []
    }
  }
  const byId = new Map([...existing, ...resolved.map(item => [item.authorId, item] as const)])
  const lookup = (id: string | null): ReaderSourceInfoAttribution | null => {
    if (id === null) return null
    return byId.get(id) ?? { authorId: id, fullName: id, surname: null }
  }
  return {
    sourceDescriptionAuthor: lookup(source.source_description_author_id),
    workIntroductionAuthor: lookup(source.work_introduction_author_id)
  }
}

async function resolveAttributionAuthors(
  client: LbApiClient,
  ids: string[]
): Promise<unknown> {
  const request = () => client.POST("/authors/resolve", {
    body: { author_ids: ids }
  })
  let result: Awaited<ReturnType<typeof request>>
  try {
    result = await request()
  } catch {
    return []
  }
  if (!result.response.ok || result.error !== undefined) return []
  if (result.data === undefined || !isRecord(result.data)) return sourceInfoHttpError(502)
  if (!exactKeys(result.data, new Set(["items"]))) return sourceInfoHttpError(502)
  return result.data.items
}

export async function buildReaderSourceInfo(
  source: WorkSourceInfoResponse,
  definitions: ReaderSourceInfoStaticDefinitions,
  resolver: (ids: string[]) => Promise<unknown>
): Promise<ReaderSourceInfo> {
  const provenance = projectReaderSourceInfoProvenance(
    definitions.provenance,
    source.provenance,
    source.media_type,
    source.is_printed
  )
  const attribution = await resolveReaderSourceInfoAttributions(source, resolver)
  return {
    workId: source.work_id,
    authorId: source.author_id,
    titlePath: source.title_path,
    mediaType: source.media_type,
    startPage: source.start_page,
    title: source.title,
    shortTitle: source.short_title,
    textType: source.text_type,
    authors: source.authors.map(author => ({
      authorId: author.author_id,
      fullName: author.full_name,
      surname: author.surname,
      role: author.role,
      authorType: author.author_type,
      url: author.url
    })),
    sourceDescriptionHtml: source.source_description_html === null
      ? null
      : sanitizeReaderSourceInfoHtml(source.source_description_html),
    sourceDescriptionAuthor: attribution.sourceDescriptionAuthor,
    workIntroductionHtml: source.work_introduction_html === null
      ? null
      : sanitizeReaderSourceInfoHtml(source.work_introduction_html),
    workIntroductionAuthor: attribution.workIntroductionAuthor,
    imprint: source.imprint,
    urn: source.urn,
    librisId: source.libris_id,
    licenseKey: source.license_key,
    isPrinted: source.is_printed,
    provenance,
    licenseHtml: projectReaderSourceInfoLicense(
      definitions.licenses,
      source.license_key,
      provenance
    ),
    cover: {
      smallUrl: source.cover.small_url,
      largeUrl: source.cover.large_url
    },
    readActions: source.read_actions.map(action => ({
      mediaType: action.media_type,
      label: action.label,
      url: action.url
    })),
    downloadActions: source.download_actions.map(action => ({
      mediaType: action.media_type,
      label: action.label,
      url: action.url,
      filename: action.filename,
      sizeBytes: action.size_bytes
    })),
    errata: source.errata.map(row => ({
      cellsHtml: row.cells_html.map(cell => sanitizeReaderSourceInfoHtml(cell, "inline"))
    })),
    dramawebben: source.dramawebben === null
      ? null
      : {
          hasIntroduction: source.dramawebben.has_introduction,
          facts: source.dramawebben.facts.map(fact => ({ ...fact })),
          rolesHtml: source.dramawebben.roles.map(
            role => sanitizeReaderSourceInfoHtml(role, "inline")
          ),
          historyHtml: source.dramawebben.history_html === null
            ? null
            : sanitizeReaderSourceInfoHtml(source.dramawebben.history_html)
        }
  }
}

export async function loadReaderSourceInfo(
  event: H3Event,
  authorId: string,
  titlePath: string,
  mediaType: ReaderMediaQuery | null
): Promise<ReaderSourceInfo> {
  const config = useRuntimeConfig(event)
  const client = createLbApiClient(config.apiBase)
  const source = await fetchWorkSourceInfo(client, authorId, titlePath, mediaType)
  let definitions: ReaderSourceInfoStaticDefinitions
  try {
    definitions = await loadCachedReaderSourceInfoStaticDefinitions(config.contentBase)
  } catch {
    return sourceInfoHttpError(502)
  }
  try {
    return await buildReaderSourceInfo(
      source,
      definitions,
      ids => resolveAttributionAuthors(client, ids)
    )
  } catch {
    return sourceInfoHttpError(502)
  }
}
