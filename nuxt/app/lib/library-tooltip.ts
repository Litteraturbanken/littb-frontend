type UnknownRecord = Record<string, unknown>

export const MAX_LIBRARY_TOOLTIP_LENGTH = 500

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

export function safeLibraryTooltipText(value: unknown): string {
  if (typeof value !== "string" || value !== value.trim()
    || value.length > MAX_LIBRARY_TOOLTIP_LENGTH
    || /[\u0000-\u001F\u007F]/.test(value)) return ""
  return value
}

export function usefulLibraryTooltipText(fullText: unknown, displayText: string): string {
  const safe = safeLibraryTooltipText(fullText)
  return safe && safe !== displayText ? safe : ""
}

export function libraryAuthorTooltipText(authorValue: unknown, displayText: string): string {
  const author = asRecord(authorValue)
  const fullName = safeLibraryTooltipText(author?.full_name)
  if (!fullName) return ""
  const validYear = (key: "birth" | "death") => {
    const year = safeLibraryTooltipText(asRecord(author?.[key])?.plain)
    return year && year !== "0000" && /^\d{1,4}$/.test(year) ? year : ""
  }
  const birth = validYear("birth")
  const death = validYear("death")
  const lifespan = birth && death
    ? `${birth}-${death}`
    : birth ? `f. ${birth}` : death ? `d. ${death}` : ""
  return usefulLibraryTooltipText(`${fullName}${lifespan ? ` (${lifespan})` : ""}`, displayText)
}
