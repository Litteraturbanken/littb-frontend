export type ReaderAuthorContribution =
  | "editor"
  | "illustrator"
  | "photographer"
  | "translator"
  | "fotograf"
  | "illustratör"
  | "redaktör"
  | "översättare"

const contributions = new Set<ReaderAuthorContribution>([
  "editor",
  "illustrator",
  "photographer",
  "translator",
  "fotograf",
  "illustratör",
  "redaktör",
  "översättare"
])

export function normalizeReaderAuthorContribution(
  value: unknown
): ReaderAuthorContribution | null {
  if (typeof value !== "string" || value.trim() !== value) return null
  const normalized = value.toLowerCase() as ReaderAuthorContribution
  return contributions.has(normalized) ? normalized : null
}

export function readerAuthorContributionSuffix(
  authorType: ReaderAuthorContribution | null,
  role: ReaderAuthorContribution | null
): string | null {
  switch (authorType ?? role) {
    case "editor":
    case "redaktör":
      return "red."
    case "translator":
    case "översättare":
      return "övers."
    case "illustrator":
    case "illustratör":
      return "ill."
    case "photographer":
    case "fotograf":
      return "fotogr."
    default:
      return null
  }
}
