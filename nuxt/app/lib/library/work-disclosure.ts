import type { LocationQuery } from "vue-router"
import { libraryQueryValue } from "./route-state"

export type WorkDisclosure = {
  key?: string | null
  titlePath?: string | null
  mainAuthorId?: string | null
}

// Old title-only bookmarks remain useful, but may never select another author's work.
export function expandedLibraryWork(results: readonly WorkDisclosure[], query: LocationQuery): string {
  const title = libraryQueryValue(query.title)
  if (!title) return ""
  const author = libraryQueryValue(query.title_author)
  const matches = results.filter(item => item.titlePath === title && (!author || item.mainAuthorId === author))
  return matches.length === 1 ? matches[0]?.key ?? "" : ""
}

export function libraryWorkDisclosureQuery(query: LocationQuery, item: WorkDisclosure, opening: boolean): LocationQuery {
  const next = { ...query }
  delete next.title
  delete next.title_author
  if (opening && item.titlePath && item.mainAuthorId) {
    next.title = item.titlePath
    next.title_author = item.mainAuthorId
  }
  return next
}
