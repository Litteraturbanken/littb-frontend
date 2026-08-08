import type { components } from "./api/generated/lbapi"

export type TextSearchResultsRequest = components["schemas"]["TextSearchResultsRequest"]
export type TextSearchCountRequest = components["schemas"]["TextSearchCountRequest"]
export type TextSearchOptionsRequest = components["schemas"]["TextSearchOptionsRequest"]
export type TextSearchResultsResponse = components["schemas"]["TextSearchResponse"]
export type TextSearchCountResponse = components["schemas"]["TextSearchCountResponse"]
export type TextSearchOptionsResponse = components["schemas"]["TextSearchOptionsResponse"]
type TextSearchWord = components["schemas"]["TextSearchWord"]
type TextSearchHighlight = components["schemas"]["TextSearchHighlight"]
type TextSearchWork = components["schemas"]["TextSearchWork"]
type TextSearchAuthorFacet = components["schemas"]["TextSearchAuthorFacet"]
type TextSearchTitleOption = components["schemas"]["TextSearchTitleOption"]
type TextSearchAuthorOption = components["schemas"]["TextSearchAuthorOption"]
type SearchLanguage = NonNullable<TextSearchResultsRequest["languages"]>[number]
type SearchCategory = NonNullable<TextSearchResultsRequest["categories"]>[number]
type SearchLegacyFilter = NonNullable<TextSearchResultsRequest["legacy_filters"]>[number]

const languageValueMap = {
  "modernized:true": true,
  "modernized:false": true,
  "translation:true": true,
  "original:true": true,
  "language:swe": true,
  "foreign:true": true,
  "language:eng": true,
  "language:deu": true,
  "language:fra": true,
  "language:lat": true,
  "language:smi": true,
  "proofread:true": true,
  "proofread:false": true
} satisfies Record<SearchLanguage, true>
const languageValues = new Set<SearchLanguage>(
  Object.keys(languageValueMap) as SearchLanguage[]
)
const categoryValueMap = {
  "texttype:brev;brevsamling": true,
  "texttype:drama;dramasamling": true,
  "texttype:essä;essäsamling": true,
  "texttype:novellsamling;novell": true,
  "texttype:diktsamling;dikt": true,
  "texttype:roman": true,
  "texttype:sakprosa;kringtexter;avhandling;referensverk": true,
  "keyword:Barnlitteratur": true,
  "keyword:Biografika|texttype:brev;brevsamling": true,
  "keyword:Finlandssvenskt": true,
  "keyword:Flickböcker": true,
  "texttype:herdaminne": true,
  "keyword:Humor": true,
  "texttype:kistebrev": true,
  "texttype:kringtext": true,
  "texttype:kåseri;kåserisamling": true,
  "texttype:reseskildring": true,
  "keyword:Rösträtt": true,
  "keyword:Sapmi": true,
  "keyword:Folktryck": true,
  "keyword:sentpajorden": true,
  "keyword:OrdenPrövas": true,
  "keyword:LB-antologi": true,
  "keyword:1800": true,
  "source:bibliotekariesidor": true,
  "source:diktensmuseum": true,
  "keyword:Dramawebben": true,
  "source:skolan": true,
  "source:litteraturkartan": true,
  "source:ljudochbild": true,
  "source:sol": true,
  "keyword:SLS-FI": true,
  "provenance.library:SVELITT": true,
  "provenance.library:SA": true,
  "provenance.library:SFS": true,
  "provenance.library:SVA": true,
  "author_ids:KunglSamfundet": true,
  "provenance.library:SVS": true
} satisfies Record<SearchCategory, true>
const categoryValues = new Set<SearchCategory>(
  Object.keys(categoryValueMap) as SearchCategory[]
)
const legacyFilterFieldMap = {
  author_ids: true,
  keyword: true,
  language: true,
  "main_author.gender": true,
  mediatype: true,
  modernized: true,
  proofread: true,
  "provenance.library": true,
  source: true,
  texttype: true
} satisfies Record<SearchLegacyFilter["field"], true>
const legacyFilterFields = new Set<SearchLegacyFilter["field"]>(
  Object.keys(legacyFilterFieldMap) as SearchLegacyFilter["field"][]
)
const textSearchRouteKeys = [
  "fras", "traffsida", "avancerad", "forfattare", "titlar", "kön",
  "languages", "keywords", "authorkeyword", "intervall", "sok_filter",
  "prefix", "suffix", "infix", "lemma", "ej_modern", "fuzzy", "keyword"
] as const
const textSearchRouteKeySet = new Set<string>(textSearchRouteKeys)

export type TextSearchRouteState = Readonly<{
  phrase: string | null
  page: number
  advanced: boolean
  authorIds: readonly string[]
  workIds: readonly string[]
  gender: TextSearchResultsRequest["gender"]
  languages: readonly SearchLanguage[]
  categories: readonly SearchCategory[]
  aboutAuthorIds: readonly string[]
  yearRange: readonly [number, number] | null
  facetAuthorId: string | null
  prefix: boolean
  suffix: boolean
  infix: boolean
  wordFormOnly: boolean
  includeModernized: boolean
  fuzzy: boolean
  legacyFilters: readonly SearchLegacyFilter[]
}>

export type TextSearchRouteQuery = Readonly<Record<
  string,
  string | readonly string[] | null | undefined
>>

function values(query: TextSearchRouteQuery, key: string): readonly (string | null)[] {
  const value = query[key]
  if (value === undefined) return []
  return typeof value === "string" || value === null ? [value] : value
}

function first(query: TextSearchRouteQuery, key: string): string | null | undefined {
  return values(query, key)[0]
}

function present(query: TextSearchRouteQuery, key: string): boolean {
  if (!(key in query) || query[key] === undefined) return false
  const raw = values(query, key)
  return raw.length === 0 || raw.some(value => {
    const normalized = value?.trim().toLowerCase()
    return normalized !== "0" && normalized !== "false"
  })
}

function commaValues(query: TextSearchRouteQuery, key: string): string[] {
  return values(query, key)
    .flatMap(value => (value ?? "").split(","))
    .map(value => value.trim())
    .filter(Boolean)
}

function distinctBounded<T>(items: readonly T[], maximum: number): T[] {
  return [...new Set(items)].slice(0, maximum)
}

function isSafeIdentifier(value: string): boolean {
  return value.length >= 1 && value.length <= 100 && value !== "." && value !== ".." &&
    value === value.trim() && !/[\s%/\\,]/u.test(value) &&
    ![...value].some(character => /[\p{Cc}\p{Cs}]/u.test(character))
}

function identifierList(query: TextSearchRouteQuery, key: string): string[] {
  return distinctBounded(commaValues(query, key).filter(isSafeIdentifier), 50)
}

function enumList<T extends string>(
  query: TextSearchRouteQuery,
  key: string,
  allowed: ReadonlySet<T>,
  maximum: number
): T[] {
  return distinctBounded(
    commaValues(query, key).filter((value): value is T => allowed.has(value as T)),
    maximum
  )
}

function parseLegacyFilters(query: TextSearchRouteQuery): SearchLegacyFilter[] {
  const filters: SearchLegacyFilter[] = []
  const seen = new Set<string>()
  for (const entry of commaValues(query, "keyword")) {
    const colon = entry.indexOf(":")
    if (colon < 1) continue
    const field = entry.slice(0, colon).trim() as SearchLegacyFilter["field"]
    const value = entry.slice(colon + 1).trim()
    if (!legacyFilterFields.has(field) || value.length < 1 || value.length > 100) continue
    if (field === "author_ids" && !isSafeIdentifier(value)) continue
    const marker = `${field}\0${value}`
    if (!seen.has(marker)) {
      seen.add(marker)
      filters.push({ field, value })
    }
    if (filters.length === 20) break
  }
  return filters
}

function routePage(query: TextSearchRouteQuery): number {
  const raw = first(query, "traffsida")
  return typeof raw === "string" && /^(?:[1-9]\d{0,3}|10000)$/.test(raw) ? Number(raw) : 1
}

function routeGender(query: TextSearchRouteQuery): TextSearchRouteState["gender"] {
  const raw = first(query, "kön")
  return raw === "female" || raw === "male" ? raw : null
}

function routeYearRange(query: TextSearchRouteQuery): TextSearchRouteState["yearRange"] {
  const range = commaValues(query, "intervall")
  if (range.length !== 2 || !/^\d{4}$/.test(range[0]!) || !/^\d{4}$/.test(range[1]!)) {
    return null
  }
  const from = Number(range[0])
  const to = Number(range[1])
  return from >= 1000 && to <= 2200 && from <= to ? [from, to] : null
}

function routeFacetAuthorId(query: TextSearchRouteQuery): string | null {
  const raw = first(query, "sok_filter")
  return typeof raw === "string" && isSafeIdentifier(raw) ? raw : null
}

export function parseTextSearchRouteQuery(
  query: TextSearchRouteQuery
): TextSearchRouteState {
  const rawPhrase = first(query, "fras")
  const phrase = typeof rawPhrase === "string" ? rawPhrase.trim() : ""
  const infix = present(query, "infix")

  return Object.freeze({
    phrase: phrase.length >= 1 && phrase.length <= 200 ? phrase : null,
    page: routePage(query),
    advanced: present(query, "avancerad"),
    authorIds: identifierList(query, "forfattare"),
    workIds: identifierList(query, "titlar"),
    gender: routeGender(query),
    languages: enumList(query, "languages", languageValues, 13),
    categories: enumList(query, "keywords", categoryValues, 38),
    aboutAuthorIds: identifierList(query, "authorkeyword"),
    yearRange: routeYearRange(query),
    facetAuthorId: routeFacetAuthorId(query),
    prefix: infix || present(query, "prefix"),
    suffix: infix || present(query, "suffix"),
    infix,
    wordFormOnly: !present(query, "lemma"),
    includeModernized: !present(query, "ej_modern"),
    fuzzy: present(query, "fuzzy"),
    legacyFilters: parseLegacyFilters(query)
  })
}

function legacyFilterValue(filter: SearchLegacyFilter): string {
  return `${filter.field}:${filter.value}`
}

type SerializedTextSearchQuery = Record<string, string | readonly string[] | null | undefined>
type SetSerializedValue = (key: string, value: string | null) => void

function serializeTextSearchSelections(
  state: TextSearchRouteState,
  set: SetSerializedValue
): void {
  if (state.authorIds.length) set("forfattare", state.authorIds.join(","))
  if (state.workIds.length) set("titlar", state.workIds.join(","))
  set("kön", state.gender ?? null)
  if (state.languages.length) set("languages", state.languages.join(","))
  if (state.categories.length) set("keywords", state.categories.join(","))
  if (state.aboutAuthorIds.length) set("authorkeyword", state.aboutAuthorIds.join(","))
  if (state.yearRange) set("intervall", state.yearRange.join(","))
  set("sok_filter", state.facetAuthorId)
}

function serializeTextSearchMatching(
  state: TextSearchRouteState,
  set: SetSerializedValue
): void {
  if (state.infix) set("infix", "1")
  else {
    if (state.prefix) set("prefix", "1")
    if (state.suffix) set("suffix", "1")
  }
  if (!state.wordFormOnly) set("lemma", "1")
  if (!state.includeModernized) set("ej_modern", "1")
  if (state.fuzzy) set("fuzzy", "1")
  if (state.legacyFilters.length) {
    set("keyword", state.legacyFilters.map(legacyFilterValue).join(","))
  }
}

export function serializeTextSearchRouteState(
  state: TextSearchRouteState,
  raw: TextSearchRouteQuery = {}
): SerializedTextSearchQuery {
  const serialized = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !textSearchRouteKeySet.has(key))
  ) as SerializedTextSearchQuery
  const set = (key: string, value: string | null): void => {
    if (value !== null) serialized[key] = value
  }
  set("fras", state.phrase)
  if (state.page !== 1) set("traffsida", String(state.page))
  if (state.advanced) set("avancerad", "1")
  serializeTextSearchSelections(state, set)
  serializeTextSearchMatching(state, set)
  return serialized
}

export function textSearchSubmitQuery(
  raw: TextSearchRouteQuery,
  phrase: string
): Record<string, string | readonly string[] | null | undefined> {
  const normalizedPhrase = phrase.trim()
  const next: Record<string, string | readonly string[] | null | undefined> = {
    ...raw
  }
  if (normalizedPhrase.length >= 1 && normalizedPhrase.length <= 200) {
    next.fras = normalizedPhrase
  } else {
    delete next.fras
  }
  delete next.traffsida
  delete next.sok_filter
  return next
}

export type TextSearchFilterPatch = Readonly<Partial<Pick<
  TextSearchRouteState,
  "advanced" | "authorIds" | "workIds" | "gender" | "languages" |
  "categories" | "aboutAuthorIds" | "yearRange" | "facetAuthorId" |
  "prefix" | "suffix" | "infix" | "wordFormOnly" | "includeModernized" |
  "fuzzy" | "legacyFilters"
>>>

export function textSearchFilterQuery(
  raw: TextSearchRouteQuery,
  patch: TextSearchFilterPatch
): Record<string, string | readonly string[] | null | undefined> {
  const current = parseTextSearchRouteQuery(raw)
  return serializeTextSearchRouteState({ ...current, ...patch, page: 1 }, raw)
}

export function textSearchPageQuery(
  raw: TextSearchRouteQuery,
  page: number
): Record<string, string | readonly string[] | null | undefined> {
  const next = { ...raw }
  if (Number.isSafeInteger(page) && page >= 2 && page <= 10_000) {
    next.traffsida = String(page)
  } else {
    delete next.traffsida
  }
  return next
}

export function resetTextSearchQuery(
  _raw: TextSearchRouteQuery
): Record<string, string | readonly string[] | null | undefined> {
  return {}
}

function commonRequest(state: TextSearchRouteState): Omit<
  TextSearchCountRequest,
  "query"
> {
  const request: Omit<TextSearchCountRequest, "query"> = {
    prefix: state.prefix,
    suffix: state.suffix,
    word_form_only: state.wordFormOnly,
    include_modernized: state.includeModernized
  }
  if (state.authorIds.length) request.author_ids = [...state.authorIds]
  if (state.aboutAuthorIds.length) request.about_author_ids = [...state.aboutAuthorIds]
  if (state.workIds.length) request.work_ids = [...state.workIds]
  if (state.gender) request.gender = state.gender
  if (state.yearRange) {
    request.year_from = state.yearRange[0]
    request.year_to = state.yearRange[1]
  }
  if (state.languages.length) request.languages = [...state.languages]
  if (state.categories.length) request.categories = [...state.categories]
  if (state.legacyFilters.length) {
    request.legacy_filters = state.legacyFilters.map(filter => ({ ...filter }))
  }
  if (state.facetAuthorId) request.facet_author_id = state.facetAuthorId
  return request
}

function requiredPhrase(state: TextSearchRouteState): string {
  if (!state.phrase) throw new TypeError("Text search requires a valid phrase")
  return state.phrase
}

export function buildTextSearchResultsRequest(
  state: TextSearchRouteState,
  highlightLimit = 5
): TextSearchResultsRequest {
  if (!Number.isSafeInteger(highlightLimit) || highlightLimit < 5 || highlightLimit > 500) {
    throw new RangeError("Highlight limit must be between 5 and 500")
  }
  return {
    query: requiredPhrase(state),
    page: state.page,
    page_size: 30,
    highlight_limit: highlightLimit,
    ...commonRequest(state)
  }
}

export function buildTextSearchCountRequest(
  state: TextSearchRouteState
): TextSearchCountRequest {
  return { query: requiredPhrase(state), ...commonRequest(state) }
}

export type TextSearchOptionsInput = Readonly<{
  titleFilter?: string
  selectedWorkIds?: readonly string[]
  titleLimit?: 0 | 30 | 500
  includeStaticOptions?: boolean
}>

export function buildTextSearchOptionsRequest(
  state: TextSearchRouteState,
  input: TextSearchOptionsInput = {}
): TextSearchOptionsRequest {
  const titleFilter = (input.titleFilter ?? "").trim()
  if (titleFilter.length > 200) throw new RangeError("Title filter is too long")
  const titleLimit = input.titleLimit ?? 30
  if (titleLimit !== 0 && titleLimit !== 30 && titleLimit !== 500) {
    throw new RangeError("Title limit must be 0, 30, or 500")
  }
  const selectedWorkIds = distinctBounded(
    (input.selectedWorkIds ?? state.workIds).filter(isSafeIdentifier),
    50
  )
  return {
    ...(state.phrase ? { query: state.phrase } : {}),
    title_filter: titleFilter,
    title_limit: titleLimit,
    include_static_options: input.includeStaticOptions ?? true,
    ...(selectedWorkIds.length ? { selected_work_ids: selectedWorkIds } : {}),
    ...commonRequest(state)
  }
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableValue(item)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

export function textSearchRouteIdentity(state: TextSearchRouteState): string {
  return `route:${stableValue(state)}`
}

export function textSearchResultsRequestIdentity(request: TextSearchResultsRequest): string {
  return `results:${stableValue(request)}`
}

export function textSearchCountRequestIdentity(request: TextSearchCountRequest): string {
  return `count:${stableValue(request)}`
}

export function textSearchOptionsRequestIdentity(request: TextSearchOptionsRequest): string {
  return `options:${stableValue(request)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum &&
    (minimum === 0 || value.trim().length > 0)
}

function isSafeInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= minimum && value <= maximum
}

type WordPosition = readonly [scope: string, ordinal: number]

function wordPosition(value: string, workId: string): WordPosition | null {
  const match = /^w(\d+)_(\d+)$/.exec(value)
  let scope: string
  let rawOrdinal: string
  if (match) {
    scope = `page:${match[1]}`
    rawOrdinal = match[2]!
  } else {
    const prefix = `${workId}_`
    if (!isSafeIdentifier(workId) || !value.startsWith(prefix)) return null
    scope = `work:${workId}`
    rawOrdinal = value.slice(prefix.length)
    if (!/^\d+$/u.test(rawOrdinal)) return null
  }
  const ordinal = Number(rawOrdinal)
  return Number.isSafeInteger(ordinal) ? [scope, ordinal] : null
}

function isSafePageName(value: unknown): value is string {
  return isBoundedString(value, 1, 100) && value === value.trim() &&
    value !== "." && value !== ".." && !/[%/\\]/u.test(value) &&
    ![...value].some(character => /[\p{Cc}\p{Cs}]/u.test(character))
}

function isTextSearchWord(value: unknown, workId: string): value is TextSearchWord {
  return isRecord(value) && hasExactKeys(value, ["word", "page_name", "word_id"]) &&
    isBoundedString(value.word, 1, 10_000) &&
    isSafePageName(value.page_name) &&
    typeof value.word_id === "string" && value.word_id.length <= 100 &&
    wordPosition(value.word_id, workId) !== null
}

function isWordList(value: unknown, workId: string): value is TextSearchWord[] {
  return Array.isArray(value) && value.length <= 1_000 &&
    value.every(word => isTextSearchWord(word, workId))
}

function isTextSearchHighlight(value: unknown, workId: string): value is TextSearchHighlight {
  if (!isRecord(value) ||
    !hasExactKeys(value, ["left_context", "match", "right_context"]) ||
    !isWordList(value.left_context, workId) || !isWordList(value.match, workId) ||
    !isWordList(value.right_context, workId) || value.match.length === 0) return false
  if (new Set(value.match.map(word => word.page_name)).size !== 1) return false
  const positions = value.match.map(word => wordPosition(word.word_id, workId)!)
  return positions.every((position, index) => index === 0 ||
    position[1] > positions[index - 1]![1]) &&
    positions.every(position => position[0] === positions[0]![0])
}

function hasTextSearchWorkIdentity(value: Record<string, unknown>): boolean {
  return typeof value.lbworkid === "string"
    && isSafeIdentifier(value.lbworkid)
    && typeof value.author_id === "string"
    && isSafeIdentifier(value.author_id)
    && typeof value.title_id === "string"
    && isSafeIdentifier(value.title_id)
}

function hasTextSearchWorkLabels(value: Record<string, unknown>): boolean {
  return isBoundedString(value.author_name, 1, 1_000)
    && isBoundedString(value.title, 1, 10_000)
    && (value.mediatype === "etext" || value.mediatype === "faksimil")
    && typeof value.has_more_highlights === "boolean"
}

function isTextSearchWork(value: unknown): value is TextSearchWork {
  if (!isRecord(value) || !hasExactKeys(value, [
    "lbworkid", "author_id", "author_name", "title", "title_id", "mediatype",
    "highlights", "has_more_highlights"
  ])) return false
  if (typeof value.lbworkid !== "string" ||
    !hasTextSearchWorkIdentity(value) || !hasTextSearchWorkLabels(value)) return false
  const workId = value.lbworkid
  return Array.isArray(value.highlights)
    && value.highlights.length <= 500
    && value.highlights.every(highlight => isTextSearchHighlight(highlight, workId))
}

function isAuthorFacet(value: unknown): value is TextSearchAuthorFacet {
  return isRecord(value) && hasExactKeys(value, ["author_id", "name_for_index", "count"]) &&
    typeof value.author_id === "string" && isSafeIdentifier(value.author_id) &&
    isBoundedString(value.name_for_index, 1, 1_000) && isSafeInteger(value.count)
}

function hasDistinctIds<T>(items: readonly T[], identifier: (item: T) => string): boolean {
  return new Set(items.map(identifier)).size === items.length
}

function isBoundedArray<T>(
  value: unknown,
  maximum: number,
  itemGuard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.length <= maximum && value.every(itemGuard)
}

function isTextSearchResultsResponse(value: unknown): value is TextSearchResultsResponse {
  if (!isRecord(value) || !hasExactKeys(value, [
    "query", "page", "page_size", "total_work_hits", "works", "author_facets"
  ]) || !isBoundedString(value.query, 1, 200) ||
    !isSafeInteger(value.page, 1, 10_000) || value.page_size !== 30 ||
    !isSafeInteger(value.total_work_hits) || !isBoundedArray(value.works, 30, isTextSearchWork) ||
    !isBoundedArray(value.author_facets, 10_000, isAuthorFacet)) return false
  const totalWorkHits = value.total_work_hits
  return totalWorkHits >= value.works.length &&
    hasDistinctIds(value.works, work => work.lbworkid) &&
    hasDistinctIds(value.author_facets, facet => facet.author_id) &&
    value.author_facets.every(facet => facet.count <= totalWorkHits)
}

export function acceptTextSearchResultsResponse(
  value: unknown,
  request: TextSearchResultsRequest,
  responseRequestIdentity: string
): TextSearchResultsResponse | null {
  if (responseRequestIdentity !== textSearchResultsRequestIdentity(request) ||
    !isTextSearchResultsResponse(value) || value.query !== request.query ||
    value.page !== request.page ||
    value.works.some(work => work.highlights.length > request.highlight_limit)) return null
  return value
}

function isTextSearchCountResponse(value: unknown): value is TextSearchCountResponse {
  return isRecord(value) && hasExactKeys(value, [
    "query", "total_documents", "total_highlights"
  ]) && isBoundedString(value.query, 1, 200) &&
    isSafeInteger(value.total_documents) && isSafeInteger(value.total_highlights)
}

export function acceptTextSearchCountResponse(
  value: unknown,
  request: TextSearchCountRequest,
  responseRequestIdentity: string
): TextSearchCountResponse | null {
  if (responseRequestIdentity !== textSearchCountRequestIdentity(request) ||
    !isTextSearchCountResponse(value) || value.query !== request.query) return null
  return value
}

function isTitleOption(value: unknown): value is TextSearchTitleOption {
  return isRecord(value) && hasExactKeys(value, ["work_id", "title", "author_name"]) &&
    typeof value.work_id === "string" && isSafeIdentifier(value.work_id) &&
    isBoundedString(value.title, 1, 10_000) && isBoundedString(value.author_name, 1, 1_000)
}

function isAuthorOption(value: unknown): value is TextSearchAuthorOption {
  return isRecord(value) && hasExactKeys(value, [
    "author_id", "name_for_index", "birth_year", "death_year"
  ]) && typeof value.author_id === "string" && isSafeIdentifier(value.author_id) &&
    isBoundedString(value.name_for_index, 1, 1_000) &&
    (value.birth_year === null || isBoundedString(value.birth_year, 1, 100)) &&
    (value.death_year === null || isBoundedString(value.death_year, 1, 100))
}

function isYearPair(from: unknown, to: unknown): boolean {
  if (from === null && to === null) return true
  return isSafeInteger(from, 1000, 2200) && isSafeInteger(to, 1000, 2200) && from <= to
}

function isTextSearchOptionsResponse(value: unknown): value is TextSearchOptionsResponse {
  if (!isRecord(value) || !hasExactKeys(value, [
    "title_options", "title_total", "title_author_facets", "authors",
    "about_authors", "year_from", "year_to"
  ]) || !isBoundedArray(value.title_options, 550, isTitleOption) ||
    !isSafeInteger(value.title_total) ||
    !isBoundedArray(value.title_author_facets, 10_000, isAuthorFacet) ||
    !isBoundedArray(value.authors, 10_000, isAuthorOption) ||
    !isBoundedArray(value.about_authors, 10_000, isAuthorOption) ||
    !isYearPair(value.year_from, value.year_to)) return false
  return hasDistinctIds(value.title_options, option => option.work_id) &&
    hasDistinctIds(value.title_author_facets, facet => facet.author_id) &&
    hasDistinctIds(value.authors, author => author.author_id) &&
    hasDistinctIds(value.about_authors, author => author.author_id)
}

export function acceptTextSearchOptionsResponse(
  value: unknown,
  request: TextSearchOptionsRequest,
  responseRequestIdentity: string
): TextSearchOptionsResponse | null {
  const selectedWorkIds = request.selected_work_ids ?? []
  if (responseRequestIdentity !== textSearchOptionsRequestIdentity(request) ||
    !isTextSearchOptionsResponse(value)) {
    return null
  }
  const optionIds = value.title_options.map(option => option.work_id)
  const ordinaryCount = optionIds.length - selectedWorkIds.length
  if (!selectedWorkIds.every((workId, index) => optionIds[index] === workId) ||
    ordinaryCount < 0 || ordinaryCount > request.title_limit ||
    ordinaryCount > value.title_total ||
    value.title_author_facets.some(facet =>
      facet.count < 1 || facet.count > value.title_total)) return null
  return value
}

const punctuation = new Set([",", ".", ";", ":", "!", "?", "..."])

export function isTextSearchPunctuation(word: string): boolean {
  return punctuation.has(word)
}

export function compactTextSearchLeftContext(
  context: readonly TextSearchWord[]
): TextSearchWord[] {
  let start = 0
  const characters = context.reduce((total, token) => total + token.word.length, 0)
  if (characters > 40) {
    const difference = characters - 40
    let dropped = 0
    for (let index = 0; index < context.length; index += 1) {
      if (dropped >= difference) {
        start = index
        break
      }
      dropped += context[index]!.word.length
    }
  }
  return context.slice(start).filter(token => token.word.length < 30)
}

export function compactTextSearchRightContext(
  context: readonly TextSearchWord[]
): TextSearchWord[] {
  return context.filter(token => token.word.length < 30)
}

export function prepareTextSearchHighlight(
  highlight: TextSearchHighlight
): TextSearchHighlight {
  return {
    left_context: compactTextSearchLeftContext(highlight.left_context),
    match: [...highlight.match],
    right_context: compactTextSearchRightContext(highlight.right_context)
  }
}

function rfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, character =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
}

function appendSearchParam(params: URLSearchParams, key: string, value: unknown): void {
  if (value !== null && value !== undefined && value !== "") {
    params.append(key, String(value))
  }
}

const textSearchReturnMaximumLength = 8_192

function decodeSafeHref(value: string): string | null {
  if (value.length > textSearchReturnMaximumLength ||
    /[\\\p{Cc}\p{Cs}]/u.test(value) || value.includes("#")) return null
  try {
    const decoded = decodeURIComponent(value)
    return /[\\\p{Cc}\p{Cs}]/u.test(decoded) ? null : decoded
  } catch {
    return null
  }
}

function validateTextSearchReturnOrigin(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null
  }
  if (decodeSafeHref(value) === null) return null
  const queryIndex = value.indexOf("?")
  const path = queryIndex < 0 ? value : value.slice(0, queryIndex)
  if (decodeSafeHref(path) !== "/sök") return null

  const query = new URLSearchParams(queryIndex < 0 ? "" : value.slice(queryIndex + 1))
  const phrases = query.getAll("fras")
  if (phrases.length !== 1 || query.has("s_return")) return null
  const phrase = phrases[0]!.trim()
  return phrase.length >= 1 && phrase.length <= 200 ? value : null
}

function validateTextSearchReaderHref(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null
  const decoded = decodeSafeHref(value)
  if (decoded === null) return null
  const queryIndex = value.indexOf("?")
  const rawPath = queryIndex < 0 ? value : value.slice(0, queryIndex)
  const path = decodeURIComponent(rawPath)
  if (!/^\/författare\/[^/]+\/titlar\/[^/]+\/sida\/[^/]+\/(?:etext|faksimil)$/u.test(path)) {
    return null
  }
  const query = new URLSearchParams(queryIndex < 0 ? "" : value.slice(queryIndex + 1))
  return query.has("s_return") ? null : value
}

export function attachTextSearchReturnHref(readerHref: string, searchFullPath: string): string {
  const origin = validateTextSearchReturnOrigin(searchFullPath)
  const reader = validateTextSearchReaderHref(readerHref)
  if (!origin || !reader) return readerHref

  const queryIndex = reader.indexOf("?")
  const path = queryIndex < 0 ? reader : reader.slice(0, queryIndex)
  const params = new URLSearchParams(queryIndex < 0 ? "" : reader.slice(queryIndex + 1))
  params.append("s_return", origin)
  return `${path}?${params.toString()}`
}

export function parseTextSearchReturnHref(query: TextSearchRouteQuery): string | null {
  return validateTextSearchReturnOrigin(query.s_return)
}

function textSearchReaderPath(work: TextSearchWork, highlight: TextSearchHighlight): string {
  if (!isSafeIdentifier(work.author_id) || !isSafeIdentifier(work.title_id) ||
    !isSafeIdentifier(work.lbworkid) ||
    (work.mediatype !== "etext" && work.mediatype !== "faksimil") ||
    !isTextSearchHighlight(highlight, work.lbworkid)) {
    throw new TypeError("Cannot build a Reader link from malformed search data")
  }
  return [
    "", "författare", work.author_id, "titlar", work.title_id, "sida",
    highlight.match[0]!.page_name, work.mediatype
  ].map(rfc3986Segment).join("/")
}

function appendCanonicalReaderSearch(
  params: URLSearchParams,
  state: TextSearchRouteState,
  hitIndex: number
): void {
  appendSearchParam(params, "q", state.phrase)
  appendSearchParam(params, "hit", hitIndex)
  if (!state.wordFormOnly) appendSearchParam(params, "lemma", 1)
  if (!state.includeModernized) appendSearchParam(params, "ej_modern", 1)
  if (state.prefix) appendSearchParam(params, "prefix", 1)
  if (state.suffix) appendSearchParam(params, "suffix", 1)
}

function appendLegacyReaderSearch(
  params: URLSearchParams,
  work: TextSearchWork,
  state: TextSearchRouteState,
  hitIndex: number
): void {
  appendSearchParam(params, "s_query", state.phrase)
  appendSearchParam(params, "s_lbworkid", work.lbworkid)
  appendSearchParam(params, "s_mediatype", work.mediatype)
  appendSearchParam(params, "s_word_form_only", state.wordFormOnly)
  appendSearchParam(params, "s_include_modernized", state.includeModernized)
  appendSearchParam(params, "hit_index", hitIndex)
  appendSearchParam(params, "s_from", (state.page - 1) * 30)
  appendSearchParam(params, "s_to", state.page * 30 - 1)
  if (state.prefix) appendSearchParam(params, "s_prefix", true)
  if (state.suffix) appendSearchParam(params, "s_suffix", true)
  appendSearchParam(params, "s_page", state.page)
  appendSearchParam(params, "s_page_size", 30)
  appendSearchParam(params, "s_author_ids", state.authorIds.join(","))
  appendSearchParam(params, "s_about_author_ids", state.aboutAuthorIds.join(","))
  appendSearchParam(params, "s_work_ids", state.workIds.join(","))
  appendSearchParam(params, "s_gender", state.gender)
  if (state.yearRange) {
    appendSearchParam(params, "s_year_from", state.yearRange[0])
    appendSearchParam(params, "s_year_to", state.yearRange[1])
  }
  appendSearchParam(params, "s_languages", state.languages.join(","))
  appendSearchParam(params, "s_categories", state.categories.join(","))
  if (state.legacyFilters.length) {
    appendSearchParam(
      params,
      "s_legacy_filters",
      JSON.stringify(state.legacyFilters.map(filter => ({ ...filter })))
    )
  }
  appendSearchParam(params, "s_facet_author_id", state.facetAuthorId)
}

export function buildTextSearchReaderHref(
  work: TextSearchWork,
  highlight: TextSearchHighlight,
  hitIndex: number,
  state: TextSearchRouteState
): string {
  if (!state.phrase) throw new TypeError("Reader search links require a phrase")
  if (!Number.isSafeInteger(hitIndex) || hitIndex < 0 || hitIndex > 1_000_001) {
    throw new RangeError("Reader hit index is out of range")
  }
  const firstMatch = highlight.match[0]!
  const lastMatch = highlight.match.at(-1)!
  const path = textSearchReaderPath(work, highlight)
  const params = new URLSearchParams()
  appendCanonicalReaderSearch(params, state, hitIndex)
  appendSearchParam(params, "traff", firstMatch.word_id)
  appendSearchParam(params, "traffslut", lastMatch.word_id)
  appendLegacyReaderSearch(params, work, state, hitIndex)
  return `${path}?${params.toString()}`
}
