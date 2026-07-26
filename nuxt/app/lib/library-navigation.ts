export const DEFAULT_LIBRARY_HREF = "/bibliotek"

const MAX_LIBRARY_HREF_LENGTH = 8192

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
