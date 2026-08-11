import { validatePresentationSegments } from "./presentation-routes"
import { isSlaArticleId } from "#shared/types/sla-article"
import { hasC0OrC1Control, hasLoneSurrogate } from "#shared/utils/text-safety"

const authorPrefixes = ["/forfattare", "/författare", "/f%C3%B6rfattare"] as const
const searchPrefixes = ["/sok", "/sök", "/s%C3%B6k"] as const
const exactNuxtRoutes = new Set([
  "/",
  "/bibliotek",
  "/dramawebben",
  "/epub",
  "/historik",
  "/sok",
  "/sök"
])
const aboutPages = new Set([
  "ide",
  "organisation",
  "rattigheter",
  "tack",
  "hjalp",
  "mål",
  "english.html",
  "deutsch.html",
  "francais.html",
  "kontakt",
  "statistik"
])
const dramawebbenPages = new Set(["pjäser", "om", "kringtexter"])
const authorPages = new Set(["titlar", "dramawebben", "biblinfo", "mer"])
const authorDocuments = new Set(["presentation", "bibliografi", "semer"])
const readerMedia = new Set(["etext", "faksimil"])
export function validRouteSegment(value: string, maximumLength: number): boolean {
  return value.length > 0
    && value.length <= maximumLength
    && value === value.trim()
    && value !== "."
    && value !== ".."
    && !value.includes("\\")
    && !value.includes("/")
    && !value.includes("%")
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

export function encodeRfc3986Segment(value: string): string {
  const scalar = hasLoneSurrogate(value) ? value.toWellFormed() : value
  return encodeURIComponent(scalar).replace(
    /[!'()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function isAuthorTitleRoute(segments: string[]): boolean {
  const title = segments[3]
  if (!title || !validRouteSegment(title, 200)) return false
  if (segments.length === 4) return true
  const routeKind = segments[4]
  if (segments.length === 5) return routeKind === "info" || readerMedia.has(routeKind!)
  if (routeKind === "info") return segments.length === 6 && readerMedia.has(segments[5]!)
  return routeKind === "sida" && segments.length === 7
    && validRouteSegment(segments[5]!, 512) && readerMedia.has(segments[6]!)
}

function isAuthorSectionRoute(segments: string[], author: string, section: string): boolean {
  if (segments.length === 3) {
    return authorPages.has(section) || authorDocuments.has(section)
      || (author === "LagerlöfS" && section === "omtexterna")
  }
  if (section === "omtexterna") {
    return segments.length === 4 && author === "LagerlöfS" && isSlaArticleId(segments[3])
  }
  return section === "titlar" && isAuthorTitleRoute(segments)
}

function isAuthorRoute(segments: string[]): boolean {
  if (segments[0] !== "författare") return false

  const author = segments[1]
  if (!author || !validRouteSegment(author, 100)) return false
  if (segments.length === 2) return true

  const section = segments[2]
  return section ? isAuthorSectionRoute(segments, author, section) : false
}

function replaceStaticPrefix(
  value: string,
  prefixes: readonly string[],
  canonical: string
): string | null {
  for (const prefix of prefixes) {
    if (value === prefix) return canonical
    if (value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`) || value.startsWith(`${prefix}#`)) {
      return `${canonical}${value.slice(prefix.length)}`
    }
  }
  return null
}

export function canonicalNuxtHref(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return value
  return replaceStaticPrefix(value, authorPrefixes, "/f%C3%B6rfattare")
    ?? replaceStaticPrefix(value, searchPrefixes, "/s%C3%B6k")
    ?? value
}

function decodedSafeHref(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value)
    return hasC0OrC1Control(decoded) || hasLoneSurrogate(decoded) || decoded.includes("\\")
      ? null
      : decoded
  } catch {
    return null
  }
}

export function safeNativeHref(value: string): string | null {
  if (!value || value !== value.trim() || decodedSafeHref(value) === null) return null
  if (value.startsWith("/")) return value.startsWith("//") ? null : value

  try {
    const url = new URL(value)
    return (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username && !url.password
      ? value
      : null
  } catch {
    return null
  }
}

function decodedNuxtPath(value: string): { decoded: string; segments: string[] } | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null
  const rawPathname = value.split(/[?#]/u, 1)[0] ?? ""
  const pathname = rawPathname.length > 1 && rawPathname.endsWith("/")
    ? rawPathname.slice(0, -1)
    : rawPathname
  try {
    return {
      decoded: decodeURIComponent(pathname),
      segments: pathname.split("/").slice(1).map(segment => decodeURIComponent(segment))
    }
  } catch {
    return null
  }
}

function isEditorRoute(segments: string[]): boolean {
  return segments.length === 5 && segments[2] === "ix"
    && /^(?:0|[1-9]\d*)$/u.test(segments[3]!)
    && (segments[4] === "e" || segments[4] === "f")
}

function isPresentationRoute(segments: string[]): boolean {
  return segments.length === 1 || validatePresentationSegments(segments.slice(1))
}

function isKnownRootRoute(segments: string[]): boolean | null {
  const root = segments[0]
  if (root === "id") return segments.length <= 2
  if (root === "om") return segments.length === 2 && aboutPages.has(segments[1]!)
  if (root === "dramawebben") {
    return segments.length === 2 && dramawebbenPages.has(segments[1]!)
  }
  if (root === "editor") return isEditorRoute(segments)
  if (root === "presentationer") return isPresentationRoute(segments)
  return null
}

export function isNuxtInternalHref(value: string): boolean {
  const path = decodedNuxtPath(value)
  if (!path) return false
  if (exactNuxtRoutes.has(path.decoded)) return true
  const { segments } = path
  if (segments.some(segment => !segment)) return false
  const rootResult = isKnownRootRoute(segments)
  return rootResult ?? isAuthorRoute(segments)
}
