import type {
  ManifestContributionRole,
  WorkManifestPartAuthor
} from "../types/work-manifest"

export type ReaderAuthorContribution = ManifestContributionRole

export type LegacyEditorContributionRole =
  | ReaderAuthorContribution
  | "fotograf"
  | "illustratör"
  | "redaktör"
  | "översättare"

const legacyEditorContributions: ReadonlyMap<
  string,
  LegacyEditorContributionRole
> = new Map([
  ["editor", "editor"],
  ["fotograf", "fotograf"],
  ["illustrator", "illustrator"],
  ["illustratör", "illustratör"],
  ["photographer", "photographer"],
  ["redaktör", "redaktör"],
  ["translator", "translator"],
  ["översättare", "översättare"]
])

export function normalizeLegacyEditorContributionRole(
  value: unknown
): LegacyEditorContributionRole | null {
  if (typeof value !== "string" || value.trim() !== value) return null
  return legacyEditorContributions.get(value.toLowerCase()) ?? null
}

function contributionSuffix(
  contribution: LegacyEditorContributionRole | null
): string | null {
  switch (contribution) {
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

export function readerAuthorContributionSuffix(
  authorType: ReaderAuthorContribution | null,
  role: ReaderAuthorContribution | null
): string | null {
  return contributionSuffix(authorType ?? role)
}

export function legacyEditorContributionSuffix(
  authorType: LegacyEditorContributionRole | null,
  role: LegacyEditorContributionRole | null
): string | null {
  return contributionSuffix(authorType ?? role)
}

export function readerManifestPartAuthorLabel(
  author: WorkManifestPartAuthor,
  preferSurname: boolean
): string {
  return preferSurname
    ? author.surname ?? author.full_name ?? author.author_id
    : author.full_name ?? author.author_id
}
