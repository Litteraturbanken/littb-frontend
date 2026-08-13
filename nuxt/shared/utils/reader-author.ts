import type {
  ManifestContributionRole,
  WorkManifestPartAuthor
} from "../types/work-manifest"

export type ReaderAuthorContribution = ManifestContributionRole

export function readerAuthorContributionSuffix(
  authorType: ReaderAuthorContribution | null,
  role: ReaderAuthorContribution | null
): string | null {
  switch (authorType ?? role) {
    case "editor":
      return "red."
    case "translator":
      return "övers."
    case "illustrator":
      return "ill."
    case "photographer":
      return "fotogr."
    default:
      return null
  }
}

export function readerManifestPartAuthorLabel(
  author: WorkManifestPartAuthor,
  preferSurname: boolean
): string {
  return preferSurname
    ? author.surname ?? author.full_name ?? author.author_id
    : author.full_name ?? author.surname ?? author.author_id
}
