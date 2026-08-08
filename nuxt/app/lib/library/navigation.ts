import type { LocationQuery } from "vue-router"

export type LibraryMode = "all" | "latest" | "authors" | "works" | "parts" | "epub" | "pdf"
export type RelevanceSortKey = "relevans" | "forfattare" | "titlar" | "kronologi"
export type EpubSortKey = "forfattare" | "titlar" | "popularitet" | "kronologi"
export type LatestSortKey = "nytillkommet"
export type AuthorSortKey = "namn" | "popularitet" | "kronologi"
export type PartSortKey = "forfattare" | "titlar"
export type BrowseSortKey = EpubSortKey | AuthorSortKey | PartSortKey
type LibrarySortKey = RelevanceSortKey | BrowseSortKey | LatestSortKey

export type LibraryRouteState<AdvancedFilters> = {
  standalone: boolean
  mode: LibraryMode
  filter: string
  sort: LibrarySortKey
  page: number
  hide1800: boolean
  downloadMode: boolean
  advanced: boolean
  advancedFilters: AdvancedFilters
}

export const libraryPageMaximum = 100
const relevanceSorts = new Set<RelevanceSortKey>([
  "relevans", "forfattare", "titlar", "kronologi"
])
const epubSorts = new Set<EpubSortKey>([
  "forfattare", "titlar", "popularitet", "kronologi"
])
const authorSorts = new Set<AuthorSortKey>(["namn", "popularitet", "kronologi"])
const partSorts = new Set<PartSortKey>(["forfattare", "titlar"])

function queryValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function queryAdvanced(value: unknown): boolean {
  return value === null || value === "" || value === "1" || value === "true"
}

function libraryMode(
  standalone: boolean,
  requestedMode: string,
  downloadMode: boolean
): LibraryMode {
  if (downloadMode) return "works"
  if (requestedMode === "pdf") return "pdf"
  if (standalone) return "epub"
  if (requestedMode === "latest") return "latest"
  if (requestedMode === "authors") return "authors"
  if (requestedMode === "works") return "works"
  if (requestedMode === "parts") return "parts"
  if (requestedMode === "epub") return "epub"
  return "all"
}

export function relevanceSortKey(value: unknown): RelevanceSortKey {
  return relevanceSorts.has(value as RelevanceSortKey) ? value as RelevanceSortKey : "relevans"
}

export function epubSortKey(value: unknown): EpubSortKey {
  return epubSorts.has(value as EpubSortKey) ? value as EpubSortKey : "popularitet"
}

export function authorSortKey(value: unknown): AuthorSortKey {
  return authorSorts.has(value as AuthorSortKey) ? value as AuthorSortKey : "popularitet"
}

export function partSortKey(value: unknown): PartSortKey {
  return partSorts.has(value as PartSortKey) ? value as PartSortKey : "titlar"
}

function librarySort(mode: LibraryMode, value: unknown): LibrarySortKey {
  if (mode === "all") return relevanceSortKey(value)
  if (mode === "latest") return "nytillkommet"
  if (mode === "authors") return authorSortKey(value)
  if (mode === "parts") return partSortKey(value)
  return epubSortKey(value)
}

function libraryPage(mode: LibraryMode, value: unknown): number {
  if (mode === "authors") return 1
  const parsed = Number(queryValue(value))
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= libraryPageMaximum
    ? parsed
    : 1
}

export function parseLibraryRouteState<AdvancedFilters>(
  path: string,
  query: LocationQuery,
  advancedFilters: AdvancedFilters
): LibraryRouteState<AdvancedFilters> {
  const standalone = path === "/epub"
  const downloadMode = !standalone
    && query.nedladdning !== undefined
    && queryAdvanced(query.nedladdning)
  const mode = libraryMode(standalone, queryValue(query.visa), downloadMode)
  return {
    standalone,
    mode,
    filter: queryValue(query.filter),
    sort: librarySort(mode, query.sort),
    page: libraryPage(mode, query.sida),
    hide1800: mode === "latest" && query.hide1800 !== undefined,
    downloadMode,
    advanced: query.avancerat !== undefined && queryAdvanced(query.avancerat),
    advancedFilters
  }
}
