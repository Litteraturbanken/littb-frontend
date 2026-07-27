import type { components, operations } from "../api/generated/lbapi"

export type LibraryFilters = components["schemas"]["LibraryFilters"]
export type LibrarySearchRequest = operations["v2_post_library_search"]["requestBody"]["content"]["application/json"]
export type LibrarySearchResponse = operations["v2_post_library_search"]["responses"][200]["content"]["application/json"]
export type LibraryCountRequest = operations["v2_post_library_counts"]["requestBody"]["content"]["application/json"]
export type LibraryCountResponse = operations["v2_post_library_counts"]["responses"][200]["content"]["application/json"]
export type LibraryOptionsResponse = operations["v2_get_library_options"]["responses"][200]["content"]["application/json"]
export type LibraryAuthor = components["schemas"]["LibraryAuthor"]

export interface LibraryFilterState {
  query: string
  gender: LibraryFilters["gender"]
  categories: NonNullable<LibraryFilters["categories"]>
  narrowingCategories: NonNullable<LibraryFilters["narrowing_categories"]>
  aboutAuthorIds: NonNullable<LibraryFilters["about_author_ids"]>
  media: NonNullable<LibraryFilters["media"]>
  languages: NonNullable<LibraryFilters["languages"]>
  yearRange: readonly [number, number] | null
}

interface CommonSearchState {
  filters: LibraryFilterState
  reverse: boolean
}

export type LibrarySearchState =
  | (CommonSearchState & { mode: "all", sort: "relevans" | "forfattare" | "titlar" | "kronologi" })
  | (CommonSearchState & { mode: "authors", sort: "namn" | "popularitet" | "kronologi", limit: number })
  | (CommonSearchState & { mode: "works", sort: "forfattare" | "titlar" | "popularitet" | "kronologi", page: number, sourceOnly: boolean })
  | (CommonSearchState & { mode: "parts", sort: "forfattare" | "titlar", page: number })
  | (CommonSearchState & { mode: "latest", page: number, hide1800: boolean })
  | (CommonSearchState & { mode: "epub" | "pdf", sort: "forfattare" | "titlar" | "popularitet" | "kronologi", page: number })

export type LibraryCountMode = LibraryCountRequest["mode"]

const commonSort = {
  forfattare: "author",
  titlar: "title",
  popularitet: "popularity",
  kronologi: "chronology"
} as const

export function assertNever(value: never): never {
  throw new Error(`Unhandled Library mode: ${String(value)}`)
}

export function buildLibraryFilters(state: LibraryFilterState): LibraryFilters {
  return {
    query: state.query,
    gender: state.gender ?? null,
    categories: [...state.categories],
    narrowing_categories: [...state.narrowingCategories],
    about_author_ids: [...state.aboutAuthorIds],
    media: [...state.media],
    languages: [...state.languages],
    year_from: state.yearRange?.[0] ?? null,
    year_to: state.yearRange?.[1] ?? null
  }
}

export function buildLibrarySearchRequest(state: LibrarySearchState): LibrarySearchRequest {
  const filters = buildLibraryFilters(state.filters)
  switch (state.mode) {
    case "all":
      return {
        mode: state.mode,
        filters,
        reverse: state.reverse,
        sort: state.sort === "relevans" ? "relevance" : commonSort[state.sort]
      }
    case "authors":
      return {
        mode: state.mode,
        filters,
        reverse: state.reverse,
        sort: state.sort === "namn" ? "name" : commonSort[state.sort],
        limit: state.limit
      }
    case "works":
      return {
        mode: state.mode,
        filters,
        reverse: state.reverse,
        sort: commonSort[state.sort],
        page: state.page,
        source_only: state.sourceOnly
      }
    case "parts":
      return {
        mode: state.mode,
        filters,
        reverse: state.reverse,
        sort: commonSort[state.sort],
        page: state.page
      }
    case "latest":
      return {
        mode: state.mode,
        filters,
        reverse: state.reverse,
        page: state.page,
        hide_1800: state.hide1800
      }
    case "epub":
    case "pdf":
      return {
        mode: state.mode,
        filters,
        reverse: state.reverse,
        sort: commonSort[state.sort],
        page: state.page
      }
    default:
      return assertNever(state)
  }
}

export function buildLibraryCountRequest(
  mode: LibraryCountMode,
  filterState: LibraryFilterState
): LibraryCountRequest {
  const filters = buildLibraryFilters(filterState)
  switch (mode) {
    case "epub": return { mode, filters }
    case "pdf": return { mode, filters }
    case "works": return { mode, filters }
    case "parts": return { mode, filters }
    default: return assertNever(mode)
  }
}
