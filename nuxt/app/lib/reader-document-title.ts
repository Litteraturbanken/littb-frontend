import type { ReaderPage } from "#shared/types/reader"
import { readerAuthorContributionSuffix } from "#shared/utils/reader-author"

export function readerDocumentTitle(
  reader: Pick<ReaderPage, "contributors" | "title" | "imprintYear" | "pageName" | "mediaType"> | null,
  sourceInfoOpen: boolean
): string {
  if (!reader) return "Litteraturbanken"
  if (!sourceInfoOpen) {
    return `${reader.title} sida ${reader.pageName} ${reader.mediaType} | Litteraturbanken`
  }
  const names = reader.contributors.map(author => {
    const suffix = readerAuthorContributionSuffix(author.author_type, author.role)
    return suffix ? `${author.full_name} (${suffix})` : author.full_name
  })
  const authors = names.length > 1
    ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`
    : names[0]
  const year = reader.imprintYear ? ` (${reader.imprintYear})` : ""
  return `${authors ? `${authors} – ` : ""}${reader.title}${year}. Om boken | Litteraturbanken`
}
