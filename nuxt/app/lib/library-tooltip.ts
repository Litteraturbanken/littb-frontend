import { hasC0OrC1Control, hasLoneSurrogate } from "#shared/utils/text-safety"

type UnknownRecord = Record<string, unknown>

export interface NormalizedLibraryTooltipAuthor {
  full_name: string | null
  birth_year: string | null
  death_year: string | null
}

/** Temporary compatibility for legacy Library records until the page migration. */
interface LegacyLibraryTooltipAuthor {
  full_name?: unknown
  birth?: unknown
  death?: unknown
}

export const MAX_LIBRARY_TOOLTIP_LENGTH = 500

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

export function safeLibraryTooltipText(value: unknown): string {
  if (typeof value !== "string" || value !== value.trim()
    || value.length > MAX_LIBRARY_TOOLTIP_LENGTH
    || hasC0OrC1Control(value)
    || hasLoneSurrogate(value)) return ""
  return value
}

export function usefulLibraryTooltipText(fullText: unknown, displayText: string): string {
  const safe = safeLibraryTooltipText(fullText)
  return safe && safe !== displayText ? safe : ""
}

export function libraryAuthorTooltipText(
  authorValue: NormalizedLibraryTooltipAuthor | LegacyLibraryTooltipAuthor | null,
  displayText: string
): string {
  const author = asRecord(authorValue)
  const fullName = safeLibraryTooltipText(author?.full_name)
  if (!fullName) return ""
  const validYear = (normalizedKey: "birth_year" | "death_year", legacyKey: "birth" | "death") => {
    const year = safeLibraryTooltipText(
      author?.[normalizedKey] ?? asRecord(author?.[legacyKey])?.plain
    )
    return year && year !== "0000" && /^\d{1,4}$/.test(year) ? year : ""
  }
  const birth = validYear("birth_year", "birth")
  const death = validYear("death_year", "death")
  let lifespan = ""
  if (birth && death) lifespan = `${birth}-${death}`
  else if (birth) lifespan = `f. ${birth}`
  else if (death) lifespan = `d. ${death}`
  return usefulLibraryTooltipText(`${fullName}${lifespan ? ` (${lifespan})` : ""}`, displayText)
}
