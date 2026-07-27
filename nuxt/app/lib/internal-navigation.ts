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
function validRouteSegment(value: string, maximumLength: number): boolean {
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

function isAuthorRoute(segments: string[]): boolean {
  if (segments[0] !== "författare") return false

  const author = segments[1]
  if (!author || !validRouteSegment(author, 100)) return false
  if (segments.length === 2) return true

  const section = segments[2]
  if (segments.length === 3) {
    return authorPages.has(section!)
      || authorDocuments.has(section!)
      || (author === "LagerlöfS" && section === "omtexterna")
  }

  if (section === "omtexterna") {
    return segments.length === 4
      && author === "LagerlöfS"
      && isSlaArticleId(segments[3])
  }
  if (section !== "titlar") return false

  const title = segments[3]
  if (!title || !validRouteSegment(title, 200)) return false
  if (segments.length === 4) return true

  const routeKind = segments[4]
  if (segments.length === 5) {
    return routeKind === "info" || readerMedia.has(routeKind!)
  }
  if (routeKind === "info") {
    return segments.length === 6 && readerMedia.has(segments[5]!)
  }
  if (routeKind !== "sida" || segments.length !== 7) return false

  return validRouteSegment(segments[5]!, 512)
    && readerMedia.has(segments[6]!)
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

export function isNuxtInternalHref(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false
  const rawPathname = value.split(/[?#]/u, 1)[0] ?? ""
  const pathname = rawPathname.length > 1 && rawPathname.endsWith("/")
    ? rawPathname.slice(0, -1)
    : rawPathname
  let decoded: string
  let segments: string[]
  try {
    decoded = decodeURIComponent(pathname)
    segments = pathname.split("/").slice(1).map(segment => decodeURIComponent(segment))
  } catch {
    return false
  }
  if (exactNuxtRoutes.has(decoded)) return true

  if (segments.some(segment => !segment)) return false

  if (segments[0] === "id") return segments.length <= 2
  if (segments[0] === "om") {
    return segments.length === 2 && aboutPages.has(segments[1]!)
  }
  if (segments[0] === "dramawebben") {
    return segments.length === 2 && dramawebbenPages.has(segments[1]!)
  }
  if (segments[0] === "editor") {
    return segments.length === 5
      && segments[2] === "ix"
      && /^(?:0|[1-9]\d*)$/u.test(segments[3]!)
      && (segments[4] === "e" || segments[4] === "f")
  }
  if (segments[0] === "presentationer") {
    if (segments.length === 1) return true
    return validatePresentationSegments(segments.slice(1))
  }
  return isAuthorRoute(segments)
}
