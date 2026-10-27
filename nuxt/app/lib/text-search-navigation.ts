import { canonicalNuxtHref } from "./internal-navigation"

export const DEFAULT_TEXT_SEARCH_HREF = "/s%C3%B6k"

export type TextSearchRouteQuery = Readonly<Record<
  string,
  string | readonly (string | null)[] | null | undefined
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
  if (Object.hasOwn(query, "s_return")) return validateTextSearchReturnOrigin(query.s_return)
  // Production bookmarks encode the search context directly rather than an
  // extra return URL. Reconstruct a local search link from known fields only.
  if (typeof query.s_query !== "string" || !query.s_query.trim() || query.s_query.length > 200
    || typeof query.s_lbworkid !== "string" || typeof query.hit_index !== "string") return null
  const params = new URLSearchParams({ fras: query.s_query })
  const add = (key: string, value: unknown) => {
    if (typeof value === "string" && value) params.set(key, value)
    else if (Array.isArray(value) && value.every(item => typeof item === "string")) params.set(key, value.join(","))
  }
  if (typeof query.s_from === "string" && /^\d+$/.test(query.s_from)) {
    const page = Math.floor(Number(query.s_from) / 30) + 1
    if (Number.isSafeInteger(page) && page > 1) params.set("traffsida", String(page))
  }
  add("titlar", query.s_work_ids)
  add("sok_filter", query.s_authors)
  if (query.s_word_form_only !== "true") params.set("lemma", "1")
  if (query.s_include_modernized === "false") params.set("ej_modern", "1")
  if (query.s_prefix === "true") params.set("prefix", "1")
  if (query.s_suffix === "true") params.set("suffix", "1")
  if (query.s_fuzzy === "true") params.set("fuzzy", "1")
  const translation = '(keyword:"language-source" OR keyword:"translated" OR authors>type:translator)'
  const languageFlags: string[] = []
  if (typeof query.s_keyword_aux === "string") {
    for (const expression of query.s_keyword_aux.split(",")) {
      if (expression === `RAW:${translation}`) languageFlags.push("translation:true")
      if (expression === `RAW:NOT ${translation}`) languageFlags.push("original:true")
      if (expression === "RAW:-language:swe") languageFlags.push("foreign:true")
    }
  }
  if (languageFlags.length) params.set("languages", languageFlags.join(","))
  if (typeof query.s_text_filter === "string" && query.s_text_filter.length <= textSearchReturnMaximumLength) {
    try {
      const filters: unknown = JSON.parse(query.s_text_filter)
      if (filters && typeof filters === "object" && !Array.isArray(filters)) {
        const fields = filters as Record<string, unknown>
        add("forfattare", fields["authors>authorid"])
        add("authorkeyword", fields["authorkeyword>authorid"])
        add("kön", fields["main_author.gender"])
        add("intervall", fields["sort_date_imprint.date:range"])
        const legacy: string[] = []
        for (const key of ["author_ids", "keyword", "language", "mediatype", "modernized", "proofread", "provenance.library", "source", "texttype"]) {
          const value = fields[key]
          const values = Array.isArray(value) ? value : [value]
          for (const item of values) if (typeof item === "string") legacy.push(`${key}:${item}`)
        }
        if (legacy.length) params.set("keyword", legacy.join(","))
      }
    } catch { /* Malformed legacy filters must not prevent opening the selected hit. */ }
  }
  return `${DEFAULT_TEXT_SEARCH_HREF}?${params.toString()}`
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
