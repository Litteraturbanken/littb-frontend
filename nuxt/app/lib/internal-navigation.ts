import { validatePresentationSegments } from "./presentation-routes"

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
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return false
  }
  if (exactNuxtRoutes.has(decoded)) return true

  const segments = decoded.split("/").slice(1)
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
  if (segments[0] !== "forfattare" && segments[0] !== "författare") return false
  if (segments.length === 2) return true
  if (segments[2] !== "titlar") return segments.length === 3 || segments.length === 4
  if (segments.length >= 3 && segments.length <= 5) return true
  if (segments.length === 6) return segments[4] === "info"
  return segments.length === 7 && segments[4] === "sida"
}
