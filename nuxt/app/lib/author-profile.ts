import { hasC0OrC1Control } from "#shared/utils/text-safety"
import type { SanitizedHtml } from "#shared/types/renderable-html"
import {
  emptyRenderableHtml,
  issueAuthorProfileHtml
} from "#shared/utils/renderable-html"
import { parseHtmlDocument } from "./html-document"
import {
  canonicalNuxtHref,
  encodeRfc3986Segment,
  isNuxtInternalHref,
  safeNativeHref
} from "./internal-navigation"
import type { components } from "./api/generated/lbapi"

type AuthorProfile = components["schemas"]["AuthorProfile"]
type AuthorProfileVariant = "ordinary" | "dramawebben"

export type AuthorProfileView = {
  authorId: string
  fullName: string
  lifespan: string
  introductionHtml: SanitizedHtml<"author-profile">
  introductionBy: string
  sourceHtml: SanitizedHtml<"author-profile">[]
  pseudonymNames: string[]
  otherNames: string[]
  portrait: { url: string, captionHtml: SanitizedHtml<"author-profile"> } | null
  searchUrl: string
  audioUrl: string
  mapUrl: string
  hasMore: boolean
  relatedLinks: Array<{ label: string, url: string }>
  encyclopediaLinks: Array<{ label: string, url: string }>
  hasOrdinaryIntroduction: boolean
  hasDramawebben: boolean
}

const maxAuthorIdLength = 100
const maxDecodePasses = 16
const sanitizerBase = new URL("https://author-profile.invalid/")

const allowedElements = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "cite",
  "code",
  "div",
  "em",
  "h2",
  "h3",
  "h4",
  "i",
  "li",
  "ol",
  "p",
  "q",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "ul"
])

const removedSubtreeElements = new Set([
  "applet",
  "audio",
  "base",
  "button",
  "canvas",
  "embed",
  "form",
  "frame",
  "frameset",
  "iframe",
  "input",
  "link",
  "math",
  "meta",
  "noscript",
  "object",
  "option",
  "picture",
  "script",
  "select",
  "source",
  "style",
  "svg",
  "template",
  "textarea",
  "video"
])

const allowedGlobalAttributes = new Set(["class", "id", "lang", "title"])
const allowedAnchorAttributes = new Set(["href", "rel", "target"])
const allowedUrlProtocols = new Set(["http:", "https:", "mailto:", "tel:"])
const absoluteScheme = /^[a-z][a-z\d+.-]*:/iu

export { encodeRfc3986Segment }

export function authorProfilePath(authorId: string, ...segments: string[]): string {
  return `/f%C3%B6rfattare/${[authorId, ...segments].map(encodeRfc3986Segment).join("/")}`
}

function repeatedlyDecode(value: string, maximumLength?: number): string | null {
  let decoded = value
  try {
    for (let pass = 0; pass < maxDecodePasses; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (maximumLength !== undefined && next.length > maximumLength) return null
      if (next === decoded) return decoded
      decoded = next
    }
  } catch {
    return null
  }
  return null
}

export function validateAuthorRouteParam(value: unknown): boolean {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maxAuthorIdLength
    || value !== value.trim()
    || value.includes("/")
  ) return false

  const decoded = repeatedlyDecode(value, maxAuthorIdLength)
  return decoded === value
    && !value.includes("\\")
    && !hasC0OrC1Control(value)
    && !value.includes("%")
    && value !== "."
    && value !== ".."
}

export function formatAuthorYears(
  birthYear: string | null | undefined,
  deathYear: string | null | undefined
): string {
  const birth = birthYear && birthYear !== "0000" ? birthYear : ""
  const death = deathYear && deathYear !== "0000" ? deathYear : ""
  if (birth && death) return `${birth}-${death}`
  if (birth) return `f. ${birth}`
  if (death) return `d. ${death}`
  return ""
}

function hasTraversal(value: string): boolean {
  const path = value.split(/[?#]/u, 1)[0] ?? ""
  return path.split("/").some(segment => segment === "." || segment === "..")
}

function hasUnsafeHrefCodeUnits(value: string): boolean {
  return value.includes("\\") || hasC0OrC1Control(value)
}

function parsedSafeHref(value: string): URL | null {
  try {
    const parsed = new URL(value, sanitizerBase)
    if (!allowedUrlProtocols.has(parsed.protocol.toLowerCase())) return null
    if (absoluteScheme.test(value) && !/^(?:https?|mailto|tel):/iu.test(value)) return null
    return parsed
  } catch {
    return null
  }
}

function safeHref(value: string): string | null {
  if (!value || value !== value.trim() || hasUnsafeHrefCodeUnits(value)) return null

  const decoded = repeatedlyDecode(value)
  if (decoded === null || hasUnsafeHrefCodeUnits(decoded)) return null
  if (value.startsWith("//") || decoded.startsWith("//") || hasTraversal(decoded)) return null

  if (!parsedSafeHref(value)) return null

  return value.startsWith("/forfattare/")
    ? `/författare/${value.slice("/forfattare/".length)}`
    : value
}

function safeHttpUrl(value: string | null | undefined): string {
  if (!value || !/^https?:\/\//iu.test(value)) return ""
  const href = safeHref(value)
  return href && /^https?:\/\//iu.test(href) ? href : ""
}

function hardenBlankTarget(element: Element): void {
  if (element.getAttribute("target")?.toLowerCase() !== "_blank") return

  const tokens = (element.getAttribute("rel") ?? "")
    .split(/\s+/u)
    .filter(Boolean)
  const lowerTokens = new Set(tokens.map(token => token.toLowerCase()))
  for (const token of ["noopener", "noreferrer"]) {
    if (!lowerTokens.has(token)) tokens.push(token)
  }
  element.setAttribute("rel", tokens.join(" "))
}

function sanitizeAttributes(element: Element): void {
  const isAnchor = element.localName.toLowerCase() === "a"
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase()
    const allowed = allowedGlobalAttributes.has(name)
      || (isAnchor && allowedAnchorAttributes.has(name))
    if (!allowed) {
      element.removeAttribute(attribute.name)
      continue
    }
    if (name === "href") {
      const href = safeHref(attribute.value)
      if (href === null) element.removeAttribute(attribute.name)
      else element.setAttribute(attribute.name, href)
    }
  }
  if (isAnchor) hardenBlankTarget(element)
}

function sanitizeNode(node: Node): void {
  if (node.nodeType === 8) {
    node.parentNode?.removeChild(node)
    return
  }
  if (node.nodeType !== 1) return

  const element = node as Element
  const name = element.localName.toLowerCase()
  if (removedSubtreeElements.has(name)) {
    element.remove()
    return
  }

  for (const child of [...element.childNodes]) sanitizeNode(child)
  if (!allowedElements.has(name)) {
    element.replaceWith(...element.childNodes)
    return
  }
  sanitizeAttributes(element)
}

export function sanitizeAuthorHtml(
  value: string | null | undefined
): SanitizedHtml<"author-profile"> {
  if (!value) return emptyRenderableHtml()

  const document = parseHtmlDocument("<!doctype html><html><body></body></html>")
  const container = document.createElement("div")
  container.innerHTML = value
  for (const child of [...container.childNodes]) sanitizeNode(child)
  return issueAuthorProfileHtml(container.innerHTML)
}

function profileLinks(links: AuthorProfile["related_links"]): Array<{ label: string, url: string }> {
  return links.flatMap(link => {
    const url = safeNativeHref(link.url)
    return url === null ? [] : [{ label: link.label, url }]
  })
}

function safeAuthorSearchHref(value: string | null | undefined): string {
  if (!value) return ""
  const href = safeNativeHref(value)
  if (href === null) return ""
  const canonical = canonicalNuxtHref(href)
  const pathname = canonical.split(/[?#]/u, 1)[0]
  return pathname === "/s%C3%B6k" && isNuxtInternalHref(canonical) ? canonical : ""
}

function isAuthorPortraitAssetSegment(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0
    && value === value.trim() && value !== "." && value !== ".."
}

function isAuthorPortraitAssetPath(value: string): boolean {
  const segments = value.split("/")
  const authorDirectory = segments[3]
  const filename = segments[4]
  return segments.length === 5
    && isAuthorPortraitAssetSegment(authorDirectory)
    && isAuthorPortraitAssetSegment(filename)
    && /\.(?:jpe?g)$/iu.test(filename)
}

function safeAuthorPortraitAssetUrl(value: string): string | null {
  const href = safeNativeHref(value)
  if (href === null || !href.startsWith("/red/forfattare/")) return null

  const decoded = repeatedlyDecode(href)
  if (decoded === null || hasC0OrC1Control(decoded) || decoded.includes("\\")) return null
  if (!isAuthorPortraitAssetPath(decoded)) return null

  return href
}

export function createAuthorProfileView(
  profile: AuthorProfile,
  variant: AuthorProfileVariant
): AuthorProfileView {
  const dramawebben = profile.dramawebben
  const useDramaIntroduction = variant === "dramawebben"
    && Boolean(dramawebben?.introduction_html)
  const introductionHtml = useDramaIntroduction
    ? dramawebben?.introduction_html
    : profile.introduction_html
  const introductionBy = useDramaIntroduction
    ? dramawebben?.introduction_by
    : profile.introduction_by
  const sources = variant === "dramawebben"
    ? dramawebben?.source_html ?? []
    : profile.source_html
  const selectedPortrait = variant === "dramawebben"
    ? dramawebben?.portrait ?? null
    : profile.portrait
  const portraitUrl = selectedPortrait ? safeAuthorPortraitAssetUrl(selectedPortrait.url) : null

  return {
    authorId: profile.author_id,
    fullName: profile.full_name,
    lifespan: formatAuthorYears(profile.birth_year, profile.death_year),
    introductionHtml: sanitizeAuthorHtml(introductionHtml),
    introductionBy: introductionBy?.full_name ?? "",
    sourceHtml: sources.map(source => sanitizeAuthorHtml(source)),
    pseudonymNames: profile.pseudonyms.map(pseudonym => pseudonym.full_name),
    otherNames: [...profile.other_names],
    portrait: selectedPortrait && portraitUrl
      ? {
          url: portraitUrl,
          captionHtml: sanitizeAuthorHtml(selectedPortrait.caption_html)
        }
      : null,
    searchUrl: safeAuthorSearchHref(profile.search_url),
    audioUrl: safeHttpUrl(profile.audio_url),
    mapUrl: safeHttpUrl(profile.map_url),
    hasMore: profile.has_more === true,
    relatedLinks: profileLinks(profile.related_links),
    encyclopediaLinks: profileLinks(profile.encyclopedia_links),
    hasOrdinaryIntroduction: Boolean(profile.introduction_html),
    hasDramawebben: Boolean(dramawebben)
  }
}
