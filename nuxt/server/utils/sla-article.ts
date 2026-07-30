import { createError, type H3Event } from "h3"
import { parseHTML } from "linkedom"

import { createLbApiClient } from "../../app/lib/api/client"
import type { components } from "../../app/lib/api/generated/lbapi"
import {
  SLA_ARTICLE_REGISTRY_BY_ID,
  type SlaArticleErrorCode,
  type SlaArticleId,
  type SlaArticlePage,
  type SlaArticleSourcePath
} from "../../shared/types/sla-article"
import type { SanitizedHtml } from "../../shared/types/renderable-html"
import { issueSlaArticleHtml } from "../../shared/utils/renderable-html"
import {
  hasC0OrC1Control,
  hasHtmlUnsafeCodeUnit,
  hasLoneSurrogate
} from "../../shared/utils/text-safety"
import {
  cancelResponseBody,
  encodeRfc3986Segment,
  fetchStatus,
  formatYears,
  isExactSlaHtmlResponse,
  isRecord,
  readAuthorDocumentResponse,
  validManagedSegment
} from "./author-document"

export type SlaArticleDescriptor = components["schemas"]["SlaArticleDescriptor"]

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
  querySelectorAll: (selector: string) => Iterable<SanitizableElement>
  remove: () => void
  replaceWith: (...nodes: SanitizableNode[]) => void
  hasAttribute: (name: string) => boolean
  getAttribute: (name: string) => string | null
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
}
type ParsedSlaArticle = {
  querySelectorAll: (selector: string) => Iterable<SanitizableElement>
}

const SLA_AUTHOR_ID = "LagerlöfS"
const SLA_NORMALIZED_AUTHOR_ID = "LagerlofS"
const SLA_FULL_NAME = "Selma Lagerlöf"
const SLA_BIRTH_YEAR = "1858"
const SLA_DEATH_YEAR = "1940"
const SLA_SEARCH_URL = "/sok?forfattare=Lagerl%C3%B6fS&avancerad"
const SLA_AUDIO_URL = "https://litteraturbanken.se/ljudochbild/författare/lagerlofs"
const MAX_SLA_ARTICLE_BYTES = 262_144

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
  "article_id",
  "source_path"
])

const allowedElements = new Set([
  "a", "blockquote", "br", "col", "colgroup", "div", "em", "h1", "h2", "h3",
  "hr", "li", "ol", "p", "span", "strong", "sup", "table", "tbody", "td", "th",
  "thead", "tr", "ul"
])

const removedSubtrees = new Set([
  "applet", "audio", "base", "button", "canvas", "embed", "form",
  "frame", "frameset", "iframe", "input", "link", "math", "meta",
  "noscript", "object", "option", "picture", "script", "select", "source",
  "style", "svg", "template", "textarea", "video"
])

const globalAttributes = new Set(["class", "id", "lang"])
const elementAttributes: Record<string, ReadonlySet<string>> = {
  a: new Set(["href", "target", "rel"]),
  ol: new Set(["type"]),
  table: new Set(["border", "summary"]),
  th: new Set(["colspan"])
}

const exactSlaRoots = new Set([
  "/författare/LagerlöfS/titlar",
  "/författare/LagerlöfS/jamfor",
  "/författare/LagerlöfS/jamfor.html",
  "/författare/LagerlöfS/SelmaLagerlofEnglish",
  "/författare/LagerlöfS/omtexterna"
])

const exactPdfPaths = new Set([
  "/red/sla/VisualiseringGBSms.pdf",
  "/red/sla/ManuskriptforteckningOL.pdf",
  "/red/sla/TrycktabellOL.pdf",
  "/red/sla/IntVarianterKorkarlen.pdf",
  "/red/om/omtexerna/ManuskriptforteckningOL.pdf"
])

const safeClassToken = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u
const safeId = /^[A-Za-z][A-Za-z0-9._:-]{0,99}$/u
const safeRelToken = /^[a-z][a-z0-9-]{0,31}$/u

function invalidDescriptor(): never {
  throw new Error("Invalid SLA article descriptor")
}

function descriptorLinksAreExact(value: SlaArticleDescriptor): boolean {
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

function isSlaArticleDescriptor(value: unknown): value is SlaArticleDescriptor {
  if (!isRecord(value)) return false
  return Object.keys(value).length === descriptorKeys.size
    && Object.keys(value).every(key => descriptorKeys.has(key))
    && value.author_id === SLA_AUTHOR_ID
    && value.normalized_author_id === SLA_NORMALIZED_AUTHOR_ID
    && value.full_name === SLA_FULL_NAME
    && value.birth_year === SLA_BIRTH_YEAR
    && value.death_year === SLA_DEATH_YEAR
    && value.has_introduction === true
    && value.has_dramawebben === true
    && value.search_url === SLA_SEARCH_URL
    && (value.audio_url === null || value.audio_url === SLA_AUDIO_URL)
    && value.document_kind === "omtexterna"
    && typeof value.article_id === "string"
    && typeof value.source_path === "string"
}

export function expectedSlaArticleSource(
  value: unknown,
  requestedAuthor: string,
  requestedArticle: SlaArticleId
): SlaArticleSourcePath {
  if (!isSlaArticleDescriptor(value)
    || value.author_id !== requestedAuthor
    || value.author_id !== SLA_AUTHOR_ID
    || value.normalized_author_id !== SLA_NORMALIZED_AUTHOR_ID
    || value.article_id !== requestedArticle
    || !descriptorLinksAreExact(value)) invalidDescriptor()

  const expected = SLA_ARTICLE_REGISTRY_BY_ID[requestedArticle].sourcePath
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

function safePathSegment(value: string): boolean {
  return validManagedSegment(value) && !value.includes("#") && !value.includes("?")
}

function matchesProfileReaderOrWork(value: string): boolean {
  const profile = /^\/(författare|forfattare)\/([^/?#]+)$/u.exec(value)
  if (profile) return safePathSegment(profile[2]!)

  const reader = /^\/(författare|forfattare)\/([^/?#]+)\/titlar\/([^/?#]+)\/sida\/([^/?#]+)\/(etext|faksimil)\/?$/u.exec(value)
  if (reader) {
    return safePathSegment(reader[2]!)
      && safePathSegment(reader[3]!)
      && safePathSegment(reader[4]!)
  }

  const work = /^\/(författare|forfattare)\/([^/?#]+)\/titlar\/([^/?#]+)\/info$/u.exec(value)
  return Boolean(work
    && safePathSegment(work[2]!)
    && safePathSegment(work[3]!))
}

function matchesRegisteredArticle(value: string): boolean {
  const canonical = "/författare/LagerlöfS/omtexterna/"
  const legacy = "/forfattare/LagerlofS/omtexterna/"
  const prefix = value.startsWith(canonical)
    ? canonical
    : value.startsWith(legacy)
      ? legacy
      : null
  if (prefix === null) return false
  const candidate = value.slice(prefix.length)
  return Object.hasOwn(SLA_ARTICLE_REGISTRY_BY_ID, candidate)
}

function safeExternalHref(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === "http:" || parsed.protocol === "https:")
      && parsed.username === ""
      && parsed.password === ""
  } catch {
    return false
  }
}

function safeSlaArticleHref(value: string): boolean {
  if (
    value !== value.trim()
    || value.includes("\\")
    || hasC0OrC1Control(value)
    || hasLoneSurrogate(value)
  ) return false
  const decoded = fullyDecode(value)
  if (decoded === null
    || decoded.includes("\\")
    || hasC0OrC1Control(decoded)
    || hasLoneSurrogate(decoded)
    || decoded.startsWith("//")
    || hasTraversalSegment(decoded)) return false

  if (value.startsWith("#")) return safeId.test(value.slice(1))
  if (value === "/bibliotek?sort=titlar&filter=selma%20lagerlöf") return true
  if (exactSlaRoots.has(value) || exactPdfPaths.has(value)) return true
  if (matchesRegisteredArticle(value) || matchesProfileReaderOrWork(value)) return true
  return safeExternalHref(value)
}

function safeClassValue(value: string): boolean {
  return value === value.trim()
    && value.length <= 512
    && value.split(/\s+/u).every(token => safeClassToken.test(token))
}

function safeSummary(value: string): boolean {
  return value.length <= 512
    && !hasHtmlUnsafeCodeUnit(value)
}

function safeRelValue(value: string): boolean {
  return value === value.trim()
    && value.length <= 128
    && value.split(/\s+/u).every(token => safeRelToken.test(token))
}

function hasClass(element: SanitizableElement, className: string): boolean {
  return (element.getAttribute("class") ?? "").split(/\s+/u).includes(className)
}

function canonicalStyle(element: SanitizableElement, name: string, value: string): string | null {
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
  if (name === "hr") {
    return /^[ \t]*width[ \t]*:[ \t]*100[ \t]*;[ \t]*text-align[ \t]*:[ \t]*left[ \t]*;[ \t]*margin-left[ \t]*:[ \t]*0[ \t]*;?[ \t]*$/iu.test(value)
      ? "width: 100; text-align: left; margin-left: 0"
      : null
  }
  return null
}

function sanitizeAttributeValues(element: SanitizableElement, name: string): void {
  if (element.hasAttribute("class")
    && !safeClassValue(element.getAttribute("class") ?? "")) {
    element.removeAttribute("class")
  }
  if (element.hasAttribute("id") && !safeId.test(element.getAttribute("id") ?? "")) {
    element.removeAttribute("id")
  }
  if (element.hasAttribute("lang")
    && !new Set(["sv", "en"]).has(element.getAttribute("lang") ?? "")) {
    element.removeAttribute("lang")
  }

  if (name === "a") {
    if (element.hasAttribute("href")
      && !safeSlaArticleHref(element.getAttribute("href") ?? "")) {
      element.removeAttribute("href")
    }
    if (!element.hasAttribute("href")) {
      element.removeAttribute("target")
      element.removeAttribute("rel")
    } else {
      if (element.hasAttribute("target") && element.getAttribute("target") !== "_top") {
        element.removeAttribute("target")
      }
      if (element.hasAttribute("rel")
        && !safeRelValue(element.getAttribute("rel") ?? "")) {
        element.removeAttribute("rel")
      }
    }
  }
  if (name === "ol" && element.getAttribute("type") !== "I") {
    element.removeAttribute("type")
  }
  if (name === "table") {
    if (element.getAttribute("border") !== "1") element.removeAttribute("border")
    if (element.hasAttribute("summary")
      && !safeSummary(element.getAttribute("summary") ?? "")) {
      element.removeAttribute("summary")
    }
  }
  if (name === "th" && element.getAttribute("colspan") !== "2") {
    element.removeAttribute("colspan")
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

  const specificAttributes = elementAttributes[name]
  for (const attribute of [...element.attributes]) {
    const attributeName = attribute.name.toLowerCase()
    const isStyle = attributeName === "style"
      && (name === "h1" || name === "h2" || name === "ul" || name === "hr")
    if (!globalAttributes.has(attributeName)
      && !specificAttributes?.has(attributeName)
      && !isStyle) {
      element.removeAttribute(attribute.name)
    }
  }

  sanitizeAttributeValues(element, name)
  if (element.hasAttribute("style")) {
    const canonical = canonicalStyle(element, name, element.getAttribute("style") ?? "")
    if (canonical === null) element.removeAttribute("style")
    else element.setAttribute("style", canonical)
  }
}

function sanitizeNode(node: SanitizableNode): void {
  if (node.nodeType === 7 || node.nodeType === 8) {
    node.parentNode?.removeChild(node)
    return
  }
  if (node.nodeType === 1) sanitizeElement(node as SanitizableElement)
}

function removeUnpairedFragments(body: SanitizableElement): void {
  const ids = new Set(
    [...body.querySelectorAll("[id]")]
      .map(element => element.getAttribute("id"))
      .filter((value): value is string => value !== null)
  )
  for (const anchor of [...body.querySelectorAll("a[href^='#']")]) {
    const href = anchor.getAttribute("href") ?? ""
    if (!ids.has(href.slice(1))) {
      anchor.removeAttribute("href")
      anchor.removeAttribute("target")
      anchor.removeAttribute("rel")
    }
  }
}

export class InvalidSlaArticleSource extends Error {
  constructor() {
    super("Invalid SLA article source")
    this.name = "InvalidSlaArticleSource"
  }
}

export function parseSlaArticleBody(source: string): SanitizedHtml<"sla-article"> {
  let document: ParsedSlaArticle
  try {
    ({ document } = parseHTML(source) as unknown as { document: ParsedSlaArticle })
  } catch {
    throw new InvalidSlaArticleSource()
  }
  const bodies = [...document.querySelectorAll("body")]
  if (bodies.length !== 1) throw new InvalidSlaArticleSource()
  const body = bodies[0]!
  for (const child of [...body.childNodes]) sanitizeNode(child)
  removeUnpairedFragments(body)
  return issueSlaArticleHtml(body.innerHTML)
}

export function slaArticleError(
  statusCode: 404 | 502,
  code: SlaArticleErrorCode
): never {
  throw createError({
    statusCode,
    statusMessage: statusCode === 404 ? "Not Found" : "Bad Gateway",
    data: { code }
  })
}

export async function loadSlaArticle(
  event: H3Event,
  requestedAuthor: string,
  requestedArticle: SlaArticleId
): Promise<SlaArticlePage> {
  const config = useRuntimeConfig(event)
  const client = createLbApiClient(config.apiBase)
  let result
  try {
    result = await client.GET(
      "/authors/{author_id}/documents/omtexterna/articles/{article_id}",
      {
        redirect: "manual",
        params: {
          path: {
            author_id: requestedAuthor,
            article_id: requestedArticle
          }
        }
      }
    )
  } catch {
    return slaArticleError(502, "sla_article_unavailable")
  }

  if (result.response.status === 404) {
    await cancelResponseBody(result.response)
    return slaArticleError(404, "sla_article_not_found")
  }
  if (result.response.status !== 200) {
    await cancelResponseBody(result.response)
    return slaArticleError(502, "sla_article_unavailable")
  }

  let expected: SlaArticleSourcePath
  try {
    expected = expectedSlaArticleSource(result.data, requestedAuthor, requestedArticle)
  } catch {
    await cancelResponseBody(result.response)
    return slaArticleError(502, "sla_article_unavailable")
  }
  const descriptor = result.data as SlaArticleDescriptor

  let source: string
  try {
    const response = await fetch(
      `${config.contentBase.replace(/\/$/u, "")}${expected}`,
      { method: "GET", redirect: "manual" }
    )
    if (response.status === 404) {
      await cancelResponseBody(response)
      return slaArticleError(404, "sla_article_not_found")
    }
    if (response.status !== 200 || !isExactSlaHtmlResponse(response)) {
      await cancelResponseBody(response)
      return slaArticleError(502, "sla_article_unavailable")
    }
    source = await readAuthorDocumentResponse(response, MAX_SLA_ARTICLE_BYTES)
  } catch (error) {
    if (fetchStatus(error) === 404) {
      return slaArticleError(404, "sla_article_not_found")
    }
    return slaArticleError(502, "sla_article_unavailable")
  }

  let bodyHtml: SanitizedHtml<"sla-article">
  try {
    bodyHtml = parseSlaArticleBody(source)
  } catch {
    return slaArticleError(502, "sla_article_unavailable")
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
    articleId: descriptor.article_id,
    sourcePath: expected,
    bodyHtml
  }
}
