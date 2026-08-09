import { libraryPageMaximum } from "./navigation"

const libraryPageSize = 100

export function canonicalLibraryResultPage(requestedPage: number, totalHits: number): number {
  const pageCount = Math.max(
    1,
    Math.min(libraryPageMaximum, Math.ceil(Math.max(0, totalHits) / libraryPageSize))
  )
  return Math.max(1, Math.min(requestedPage, pageCount))
}
