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

function validateTextSearchReaderHref(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null
  const decoded = decodeSafeHref(value)
  if (decoded === null) return null
  const queryIndex = value.indexOf("?")
  const rawPath = queryIndex < 0 ? value : value.slice(0, queryIndex)
  const path = decodeURIComponent(rawPath)
  if (!/^\/författare\/[^/]+\/titlar\/[^/]+\/sida\/[^/]+\/(?:etext|faksimil)$/u.test(path)) {
    return null
  }
  const query = new URLSearchParams(queryIndex < 0 ? "" : value.slice(queryIndex + 1))
  return query.has("s_return") ? null : value
}

export function attachTextSearchReturnHref(readerHref: string, searchFullPath: string): string {
  const origin = validateTextSearchReturnOrigin(searchFullPath)
  const reader = validateTextSearchReaderHref(readerHref)
  if (!origin || !reader) return readerHref

  const queryIndex = reader.indexOf("?")
  const path = queryIndex < 0 ? reader : reader.slice(0, queryIndex)
  const params = new URLSearchParams(queryIndex < 0 ? "" : reader.slice(queryIndex + 1))
  params.append("s_return", origin)
  return `${path}?${params.toString()}`
}

function decodeRawQueryComponent(value: string): string | null {
  try {
    return decodeURIComponent(value.replaceAll("+", " "))
  } catch {
    return null
  }
}

export function rawTextSearchReturnQuery(fullPath: string): TextSearchRouteQuery {
  const beforeHash = fullPath.split("#", 1)[0] ?? ""
  const queryIndex = beforeHash.indexOf("?")
  if (queryIndex < 0) return {}

  const values: string[] = []
  for (const segment of beforeHash.slice(queryIndex + 1).split("&")) {
    const separator = segment.indexOf("=")
    const rawKey = separator < 0 ? segment : segment.slice(0, separator)
    if (decodeRawQueryComponent(rawKey) !== "s_return") continue
    const rawValue = separator < 0 ? "" : segment.slice(separator + 1)
    const value = decodeRawQueryComponent(rawValue)
    if (value === null) return { s_return: null }
    values.push(value)
  }
  if (values.length === 0) return {}
  return { s_return: values.length === 1 ? values[0]! : values }
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
