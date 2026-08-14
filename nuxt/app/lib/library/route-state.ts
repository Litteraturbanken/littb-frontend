import type { LocationQuery } from "vue-router"
import type { LibraryAdvancedControlsModel } from "./component-models"
import type { LibraryCategory, LibraryLanguage, LibraryMedia } from "./filter-options"
import {
  parseLibraryRouteState,
  type BrowseSortKey,
  type LatestSortKey,
  type LibraryMode,
  type LibraryRouteState as ParsedLibraryRouteState,
  type RelevanceSortKey
} from "./navigation"

export type LibraryAdvancedFilters = {
  gender: LibraryAdvancedControlsModel["gender"]
  keywords: LibraryCategory[]
  narrowingKeywords: LibraryCategory[]
  aboutAuthorIds: string[]
  media: LibraryMedia[]
  languages: LibraryLanguage[]
  yearRange: [number, number] | null
}

export type ImprintBounds = { from: number, to: number }
export type LibraryRouteState = ParsedLibraryRouteState<LibraryAdvancedFilters>

export type LibraryRequestState = {
  standalone: boolean
  mode: LibraryMode
  filter: string
  sort: RelevanceSortKey | BrowseSortKey | LatestSortKey
  page: number
  hide1800: boolean
  downloadMode: boolean
  advancedFilters: LibraryAdvancedFilters
}

type LibraryRouteAuthority = {
  chronologyBounds: ImprintBounds | null
  collectionValues: ReadonlySet<LibraryCategory>
  aboutAuthorIds: ReadonlySet<string>
  mediaValues: ReadonlySet<LibraryMedia>
  languageValues: ReadonlySet<LibraryLanguage>
}

export function orderedLibraryValues<T extends string>(
  values: readonly string[],
  options: readonly { value: T }[]
): T[] {
  const selected = new Set(values)
  return options.filter(option => selected.has(option.value)).map(option => option.value)
}

export function canonicalLibraryNarrowingKeywords(
  keywords: readonly LibraryCategory[],
  narrowingKeywords: readonly LibraryCategory[]
): LibraryCategory[] {
  const primary = new Set(keywords)
  return narrowingKeywords.filter(value => !primary.has(value))
}

export function libraryQueryValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function queryList<T extends string>(value: unknown, allowed: ReadonlySet<T>): T[] {
  if (typeof value !== "string" || !value) return []
  const items = value.split(",")
  if (items.some(item => !allowed.has(item as T)) || new Set(items).size !== items.length) {
    return []
  }
  return items as T[]
}

export function parseLibraryYearRange(
  value: unknown,
  bounds: ImprintBounds | null
): [number, number] | null {
  if (!bounds || typeof value !== "string" || !/^\d{4},\d{4}$/.test(value)) return null
  const [from, to] = value.split(",").map(Number)
  if (
    !Number.isSafeInteger(from)
    || !Number.isSafeInteger(to)
    || from! < bounds.from
    || to! > bounds.to
    || from! > to!
  ) return null
  if (from === bounds.from && to === bounds.to) return null
  return [from!, to!]
}

export function parseLibraryPageRouteState(
  path: string,
  query: LocationQuery,
  authority: LibraryRouteAuthority
): LibraryRouteState {
  const gender = libraryQueryValue(query.kön)
  const keywords = queryList(query.keywords, authority.collectionValues)
  const narrowingKeywords = canonicalLibraryNarrowingKeywords(
    keywords,
    queryList(query.keywords_aux, authority.collectionValues)
  )
  return parseLibraryRouteState(path, query, {
    gender: gender === "female" || gender === "male" ? gender : "",
    keywords,
    narrowingKeywords,
    aboutAuthorIds: queryList(query.about_authors, authority.aboutAuthorIds),
    media: queryList(query.mediatypes, authority.mediaValues),
    languages: queryList(query.languages, authority.languageValues),
    yearRange: parseLibraryYearRange(query.intervall, authority.chronologyBounds)
  })
}

export function libraryRequestState(state: LibraryRouteState): LibraryRequestState {
  return {
    standalone: state.standalone,
    mode: state.mode,
    filter: state.filter,
    sort: state.sort,
    page: state.mode === "authors" ? 1 : state.page,
    hide1800: state.hide1800,
    downloadMode: state.downloadMode,
    advancedFilters: state.advancedFilters
  }
}

export function libraryStateKey(state: LibraryRequestState): string {
  return JSON.stringify([
    state.standalone,
    state.mode,
    state.filter,
    state.sort,
    state.page,
    state.hide1800,
    state.downloadMode,
    state.advancedFilters
  ])
}
