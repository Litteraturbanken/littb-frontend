import { parseHTML } from "linkedom"

import type { components } from "./api/generated/lbapi"

type AuthorProfile = components["schemas"]["AuthorProfile"]
type AuthorProfileVariant = "ordinary" | "dramawebben"

export type AuthorProfileView = {
  authorId: string
  fullName: string
  lifespan: string
  introductionHtml: string
  introductionBy: string
  sourceHtml: string[]
  pseudonymNames: string[]
  otherNames: string[]
  portrait: { url: string, captionHtml: string } | null
  searchUrl: string
  audioUrl: string
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
const unsafeCharacters = /[\\\u0000-\u001f\u007f-\u009f]/u
const absoluteScheme = /^[a-z][a-z\d+.-]*:/iu

export function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

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
    && !unsafeCharacters.test(value)
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

function safeHref(value: string): string | null {
  if (!value || value !== value.trim() || unsafeCharacters.test(value)) return null

  const decoded = repeatedlyDecode(value)
  if (
    decoded === null
    || unsafeCharacters.test(decoded)
    || value.startsWith("//")
    || decoded.startsWith("//")
    || hasTraversal(decoded)
  ) return null

  let parsed: URL
  try {
    parsed = new URL(value, sanitizerBase)
  } catch {
    return null
  }

  const protocol = parsed.protocol.toLowerCase()
  if (!allowedUrlProtocols.has(protocol)) return null
  if (absoluteScheme.test(value) && !/^(?:https?|mailto|tel):/iu.test(value)) return null

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

export function sanitizeAuthorHtml(value: string | null | undefined): string {
  if (!value) return ""

  const { document } = parseHTML("<!doctype html><html><body></body></html>")
  const container = document.createElement("div")
  container.innerHTML = value
  for (const child of [...container.childNodes]) sanitizeNode(child)
  return container.innerHTML
}

function profileLinks(links: AuthorProfile["related_links"]): Array<{ label: string, url: string }> {
  return links.map(link => ({ label: link.label, url: link.url }))
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

  return {
    authorId: profile.author_id,
    fullName: profile.full_name,
    lifespan: formatAuthorYears(profile.birth_year, profile.death_year),
    introductionHtml: sanitizeAuthorHtml(introductionHtml),
    introductionBy: introductionBy?.full_name ?? "",
    sourceHtml: sources.map(source => sanitizeAuthorHtml(source)),
    pseudonymNames: profile.pseudonyms.map(pseudonym => pseudonym.full_name),
    otherNames: [...profile.other_names],
    portrait: selectedPortrait
      ? {
          url: selectedPortrait.url,
          captionHtml: sanitizeAuthorHtml(selectedPortrait.caption_html)
        }
      : null,
    searchUrl: profile.search_url ?? "",
    audioUrl: safeHttpUrl(profile.audio_url),
    relatedLinks: profileLinks(profile.related_links),
    encyclopediaLinks: profileLinks(profile.encyclopedia_links),
    hasOrdinaryIntroduction: Boolean(profile.introduction_html),
    hasDramawebben: Boolean(dramawebben)
  }
}
