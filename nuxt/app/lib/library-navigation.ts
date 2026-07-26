export const DEFAULT_LIBRARY_HREF = "/bibliotek"

const MAX_LIBRARY_HREF_LENGTH = 8192
const canonicalPastedWorkId = /^lb[A-Za-z0-9_]{1,97}$/u

export function libraryWorkIdFilterHref(workIds: readonly string[]): string | null {
  if (workIds.length === 0 || workIds.length > 100
    || workIds.some(workId => !canonicalPastedWorkId.test(workId))) return null

  const filter = workIds.map(workId => `lbworkid:${workId}`).join(" OR ")
  const encodedFilter = encodeURIComponent(filter).replaceAll("%3A", ":")
  return `${DEFAULT_LIBRARY_HREF}?filter=${encodedFilter}&visa=works&sort=popularitet`
}

export function rememberedLibraryHref(value: string): string | null {
  if (value.length > MAX_LIBRARY_HREF_LENGTH || !value.startsWith("/") || value.startsWith("//")) {
    return null
  }

  const href = value.split("#", 1)[0] ?? ""
  const path = href.split("?", 1)[0] ?? ""
  if (path !== DEFAULT_LIBRARY_HREF) return null

  try {
    if (/[\\\u0000-\u001F\u007F]/.test(decodeURIComponent(href))) return null
  }
  catch {
    return null
  }

  return href
}
