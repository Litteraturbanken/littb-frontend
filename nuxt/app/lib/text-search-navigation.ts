import { canonicalNuxtHref } from "./internal-navigation"

export const DEFAULT_TEXT_SEARCH_HREF = "/s%C3%B6k"

export type TextSearchRouteQuery = Readonly<Record<
  string,
  string | readonly string[] | null | undefined
>>

const textSearchReturnMaximumLength = 8_192

function decodeSafeHref(value: string): string | null {
  if (value.length > textSearchReturnMaximumLength ||
    /[\\\p{Cc}\p{Cs}]/u.test(value) || value.includes("#")) return null
  try {
    const decoded = decodeURIComponent(value)
    return /[\\\p{Cc}\p{Cs}]/u.test(decoded) ? null : decoded
  } catch {
    return null
  }
}

function validateTextSearchReturnOrigin(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null
  }
  if (decodeSafeHref(value) === null) return null
  const queryIndex = value.indexOf("?")
  const path = queryIndex < 0 ? value : value.slice(0, queryIndex)
  if (decodeSafeHref(path) !== "/sök") return null

  const query = new URLSearchParams(queryIndex < 0 ? "" : value.slice(queryIndex + 1))
  const phrases = query.getAll("fras")
  if (phrases.length !== 1 || query.has("s_return")) return null
  const phrase = phrases[0]!.trim()
  return phrase.length >= 1 && phrase.length <= 200 ? value : null
}

export function parseTextSearchReturnHref(query: TextSearchRouteQuery): string | null {
  return validateTextSearchReturnOrigin(query.s_return)
}

export function rememberedTextSearchHref(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null
  const withoutHash = value.split("#", 1)[0] ?? ""
  const canonical = canonicalNuxtHref(withoutHash)
  if (canonical === DEFAULT_TEXT_SEARCH_HREF || canonical.startsWith(`${DEFAULT_TEXT_SEARCH_HREF}?`)) {
    return canonical
  }
  return null
}
