const authorPrefixes = ["/forfattare", "/författare", "/f%C3%B6rfattare"] as const
const searchPrefixes = ["/sok", "/sök", "/s%C3%B6k"] as const

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
  return value.startsWith("/") && !value.startsWith("//")
}
