import type { components } from "./api/generated/lbapi"
import { isReaderTargetStatus } from "./reader-target"

export {
  attachTextSearchReturnHref,
  parseTextSearchReturnHref
} from "./text-search-navigation"

export type TextSearchResultsRequest = components["schemas"]["TextSearchResultsRequest"]
export type TextSearchOptionsRequest = components["schemas"]["TextSearchOptionsRequest"]
export type TextSearchResultsResponse = components["schemas"]["TextSearchResponse"]
export type TextSearchOptionsResponse = components["schemas"]["TextSearchOptionsResponse"]
type TextSearchWord = components["schemas"]["TextSearchWord"]
type TextSearchHighlight = components["schemas"]["TextSearchHighlight"]
type TextSearchWork = components["schemas"]["TextSearchWork"]
type TextSearchTotals = components["schemas"]["TextSearchTotals"]
type TextSearchAuthorFacet = components["schemas"]["TextSearchAuthorFacet"]
type TextSearchTitleOption = components["schemas"]["TextSearchTitleOption"]
type TextSearchAuthorOption = components["schemas"]["TextSearchAuthorOption"]
type SearchLanguage = NonNullable<TextSearchResultsRequest["languages"]>[number]
type SearchCategory = NonNullable<TextSearchResultsRequest["categories"]>[number]
type SearchLegacyFilter = NonNullable<TextSearchResultsRequest["legacy_filters"]>[number]

const languageLabels = {
  "modernized:true": "Moderniserat språk",
  "modernized:false": "Ej moderniserat språk",
  "translation:true": "Översättning",
  "original:true": "På originalspråk",
  "language:swe": "Svenska",
  "foreign:true": "Främmande språk",
  "language:eng": "Engelska",
  "language:deu": "Tyska",
  "language:fra": "Franska",
  "language:lat": "Latin",
  "language:smi": "Samiska språk",
  "proofread:true": "Korrekturläst",
  "proofread:false": "Ej korrekturläst"
} satisfies Record<SearchLanguage, string>
export const textSearchLanguageOptions = Object.entries(languageLabels) as readonly (
  readonly [SearchLanguage, string]
)[]
const languageValues = new Set<SearchLanguage>(
  textSearchLanguageOptions.map(([value]) => value)
)
const categoryLabels = {
  "texttype:brev;brevsamling": "Brev",
  "texttype:drama;dramasamling": "Dramatik",
  "texttype:essä;essäsamling": "Essäer",
  "texttype:novellsamling;novell": "Noveller",
  "texttype:diktsamling;dikt": "Poesi",
  "texttype:roman": "Romaner",
  "texttype:sakprosa;kringtexter;avhandling;referensverk": "Sakprosa",
  "keyword:Barnlitteratur": "Barn- och ungdomslitteratur",
  "keyword:Biografika|texttype:brev;brevsamling": "Biografisk litteratur",
  "keyword:Finlandssvenskt": "Finlandssvensk litteratur",
  "keyword:Flickböcker": "Flickböcker",
  "texttype:herdaminne": "Herdaminnen",
  "keyword:Humor": "Humoristiska verk",
  "texttype:kistebrev": "Kistebrev",
  "texttype:kringtext": "Kringtexter",
  "texttype:kåseri;kåserisamling": "Kåserier",
  "texttype:reseskildring": "Reseskildringar",
  "keyword:Rösträtt": "Rösträtt",
  "keyword:Sapmi": "Sápmi",
  "keyword:Folktryck": "Skillingtryck och folktryck",
  "keyword:sentpajorden": "Gunnar Ekelöf. Sent på jorden",
  "keyword:OrdenPrövas": "Harry Martinson. Orden prövas",
  "keyword:LB-antologi": "Litteraturbankens antologier",
  "keyword:1800": "Nya vägar till det förflutna",
  "source:bibliotekariesidor": "Bibliotekariesidorna",
  "source:diktensmuseum": "Diktens museum",
  "keyword:Dramawebben": "Dramawebben",
  "source:skolan": "Litteraturbankens skola",
  "source:litteraturkartan": "Litteraturkartan",
  "source:ljudochbild": "Ljud & Bild",
  "source:sol": "Översättarlexikon",
  "keyword:SLS-FI": "SLS Finland",
  "provenance.library:SVELITT": "SLS Sverige",
  "provenance.library:SA": "Svenska Akademien",
  "provenance.library:SFS": "Svenska fornskriftssällskapet",
  "provenance.library:SVA": "Svenskt visarkiv",
  "author_ids:KunglSamfundet": "Kungl. Samfundet för utgivande av handskrifter",
  "provenance.library:SVS": "Svenska Vitterhetssamfundet"
} satisfies Record<SearchCategory, string>
export const textSearchCategoryOptions = Object.entries(categoryLabels) as readonly (
  readonly [SearchCategory, string]
)[]
const categoryValues = new Set<SearchCategory>(
  textSearchCategoryOptions.map(([value]) => value)
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
  "prefix", "suffix", "infix", "lemma", "ej_modern", "fuzzy", "keyword", "snapshot"
] as const
const textSearchRouteKeySet = new Set<string>(textSearchRouteKeys)

export type TextSearchRouteState = Readonly<{
  phrase: string | null
  snapshot: string | null
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

export function isSafeTextSearchIdentifier(value: unknown): value is string {
  if (typeof value !== "string") return false
  return value.length >= 1 && value.length <= 100 && value !== "." && value !== ".." &&
    value === value.trim() && !/[\s%/\\,]/u.test(value) &&
    ![...value].some(character => /[\p{Cc}\p{Cs}]/u.test(character))
}

function isSafeIdentifier(value: string): boolean {
  return isSafeTextSearchIdentifier(value)
}

export function isTextSearchSnapshot(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 1 && value.length <= 128 &&
    value !== "." && value !== ".." &&
    !value.endsWith(".tmp") &&
    /^[A-Za-z0-9._-]+$/u.test(value)
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

function routeSnapshot(query: TextSearchRouteQuery): string | null {
  const raw = query.snapshot
  return isTextSearchSnapshot(raw) ? raw : null
}

export function parseTextSearchRouteQuery(
  query: TextSearchRouteQuery
): TextSearchRouteState {
  const rawPhrase = first(query, "fras")
  const phrase = typeof rawPhrase === "string" ? rawPhrase.trim() : ""
  const infix = present(query, "infix")

  return Object.freeze({
    phrase: phrase.length >= 1 && phrase.length <= 200 ? phrase : null,
    snapshot: routeSnapshot(query),
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
  set("snapshot", state.snapshot)
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
  delete next.snapshot
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
  return serializeTextSearchRouteState({ ...current, ...patch, page: 1, snapshot: null }, raw)
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

type TextSearchFilters = Omit<TextSearchResultsRequest,
  "query" | "page" | "page_size" | "highlight_limit" | "snapshot"
>

function commonRequest(state: TextSearchRouteState): TextSearchFilters {
  const request: TextSearchFilters = {
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
    ...commonRequest(state),
    ...(state.snapshot ? { snapshot: state.snapshot } : {})
  }
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
  const filters = commonRequest(state)
  delete filters.work_ids
  return {
    ...(state.phrase ? { query: state.phrase } : {}),
    title_filter: titleFilter,
    title_limit: titleLimit,
    include_static_options: input.includeStaticOptions ?? true,
    ...(selectedWorkIds.length ? { selected_work_ids: selectedWorkIds } : {}),
    ...filters
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

function hasRequiredAndOptionalKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[]
): boolean {
  return required.every(key => Object.hasOwn(value, key)) &&
    Object.keys(value).every(key => required.includes(key) || optional.includes(key))
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
  if (value.length < 1 || value.length > 100) return null
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

function isTextSearchWord(value: unknown): value is TextSearchWord {
  return isRecord(value) && hasExactKeys(value, ["word", "page_name", "word_id"]) &&
    isBoundedString(value.word, 1, 10_000) &&
    (value.page_name === null || (typeof value.page_name === "string" && value.page_name.length > 0)) &&
    typeof value.word_id === "string" && value.word_id.length > 0
}

function isWordList(value: unknown): value is TextSearchWord[] {
  return Array.isArray(value) && value.length <= 1_000 &&
    value.every(isTextSearchWord)
}

function isTextSearchHighlight(
  value: unknown,
  workId: string,
  mediaType: "etext" | "faksimil"
): value is TextSearchHighlight {
  if (!isRecord(value) || !hasExactKeys(value, [
    "left_context", "match", "right_context", "source_identity", "source_start",
    "source_end", "page_index", "reader_target_status"
  ])) {
    return false
  }
  const { left_context: leftContext, match, right_context: rightContext } = value
  if (!isWordList(leftContext) || !isWordList(match) ||
    !isWordList(rightContext) || leftContext.length > 5 ||
    rightContext.length > 5 || match.length === 0) return false
  if (typeof value.source_identity !== "string" || value.source_identity.length === 0 ||
    !isSafeInteger(value.source_start, 0) || !isSafeInteger(value.source_end, 1) ||
    value.source_end - value.source_start !== match.length ||
    !isSafeInteger(value.page_index, 0) || !isReaderTargetStatus(value.reader_target_status)) return false
  const sourceWords = [...leftContext, ...match, ...rightContext]
  if (new Set(sourceWords.map(word => word.page_name)).size !== 1 ||
    (sourceWords[0]!.page_name === null) !==
      (value.reader_target_status === "unmapped_page")) return false
  if (value.reader_target_status !== "exact") return true
  if (!match.every(word => isSafePageName(word.page_name))) return false
  const positions = match.map(word => wordPosition(word.word_id, workId))
  if (positions.some(position => position === null)) return false
  return positions.every((position, index) => {
    if (mediaType === "etext" && position![0].startsWith("page:") &&
      position![0] !== `page:${value.page_index}`) return false
    if (index === 0) return true
    const previous = positions[index - 1]!
    const previousWord = match[index - 1]!
    const word = match[index]!
    return position![0] === previous[0] && (
      position![1] > previous[1] ||
      (position![1] === previous[1] && word.word_id === previousWord.word_id &&
        word.page_name === previousWord.page_name)
    )
  })
}

function hasTextSearchWorkIdentity(value: Record<string, unknown>): boolean {
  return typeof value.lbworkid === "string"
    && value.lbworkid.length > 0
    && (value.author_id === null || (typeof value.author_id === "string" && value.author_id.length > 0))
    && typeof value.title_id === "string"
    && value.title_id.length > 0
}

function hasTextSearchWorkLabels(value: Record<string, unknown>): boolean {
  return (value.author_name === null || isBoundedString(value.author_name, 1, 1_000))
    && isBoundedString(value.title, 1, 10_000)
    && (value.mediatype === "etext" || value.mediatype === "faksimil")
    && typeof value.has_more_highlights === "boolean"
}

function isTextSearchWork(value: unknown): value is TextSearchWork {
  if (!isRecord(value) || !hasExactKeys(value, [
    "lbworkid", "author_id", "author_name", "title", "title_id", "mediatype",
    "occurrence_count", "highlights", "has_more_highlights"
  ])) return false
  if (typeof value.lbworkid !== "string" ||
    !hasTextSearchWorkIdentity(value) || !hasTextSearchWorkLabels(value) ||
    (value.author_id === null) !== (value.author_name === null)) return false
  const workId = value.lbworkid
  const mediaType = value.mediatype as "etext" | "faksimil"
  return isSafeInteger(value.occurrence_count, 1) &&
    Array.isArray(value.highlights)
    && value.highlights.length <= 500
    && value.highlights.every(highlight => isTextSearchHighlight(highlight, workId, mediaType)) &&
    value.occurrence_count >= value.highlights.length &&
    value.has_more_highlights === (value.occurrence_count > value.highlights.length)
}

function isAuthorFacet(value: unknown): value is TextSearchAuthorFacet {
  return isRecord(value) && hasExactKeys(value, ["author_id", "name_for_index", "count"]) &&
    typeof value.author_id === "string" && value.author_id.length > 0 &&
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

function isTextSearchTotals(value: unknown): value is TextSearchTotals {
  return isRecord(value) && hasExactKeys(value, ["occurrences", "documents", "works"]) &&
    isSafeInteger(value.occurrences) && isSafeInteger(value.documents) &&
    isSafeInteger(value.works)
}

function isTextSearchResultsResponse(value: unknown): value is TextSearchResultsResponse {
  if (!isRecord(value) || !hasExactKeys(value, [
    "query", "page", "page_size", "snapshot", "totals", "works", "author_facets"
  ]) || !isBoundedString(value.query, 1, 200) ||
    !isSafeInteger(value.page, 1, 10_000) || value.page_size !== 30 ||
    !isTextSearchSnapshot(value.snapshot) || !isTextSearchTotals(value.totals) ||
    !isBoundedArray(value.works, 30, isTextSearchWork) ||
    !isBoundedArray(value.author_facets, 10_000, isAuthorFacet)) return false
  const totals = value.totals
  const zeroTotals = totals.occurrences === 0 && totals.documents === 0 && totals.works === 0
  const positiveTotals = totals.occurrences > 0 && totals.documents > 0 && totals.works > 0
  return (zeroTotals || positiveTotals) &&
    totals.occurrences >= totals.documents && totals.documents >= totals.works &&
    totals.works >= value.works.length &&
    hasDistinctIds(value.works, work => `${work.lbworkid}\0${work.mediatype}`) &&
    hasDistinctIds(value.author_facets, facet => facet.author_id) &&
    value.author_facets.every(facet => facet.count <= totals.works)
}

export function acceptTextSearchResultsResponse(
  value: unknown,
  request: TextSearchResultsRequest,
  responseRequestIdentity: string
): TextSearchResultsResponse | null {
  if (responseRequestIdentity !== textSearchResultsRequestIdentity(request) ||
    !isTextSearchResultsResponse(value) || value.query !== request.query ||
    value.page !== request.page ||
    (request.snapshot !== null && request.snapshot !== undefined && value.snapshot !== request.snapshot) ||
    value.works.some(work => work.highlights.length > request.highlight_limit)) return null
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

function isOptionalYear(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || isSafeInteger(value, 1000, 2200)
}

function isYearPair(from: unknown, to: unknown): boolean {
  return isOptionalYear(from) && isOptionalYear(to) &&
    (typeof from !== "number" || typeof to !== "number" || from <= to)
}

function isTextSearchOptionsResponse(value: unknown): value is TextSearchOptionsResponse {
  if (!isRecord(value) || !hasRequiredAndOptionalKeys(value, [
    "title_options", "title_total", "title_author_facets", "authors",
    "about_authors"
  ], [
    "year_from", "year_to"
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
  const compacted = context.filter(token => token.word.length < 30)
  let start = 0
  const characters = compacted.reduce((total, token) => total + token.word.length, 0)
  if (characters > 40) {
    const difference = characters - 40
    let dropped = 0
    for (let index = 0; index < compacted.length; index += 1) {
      if (dropped >= difference) {
        start = index
        break
      }
      dropped += compacted[index]!.word.length
    }
  }
  return compacted.slice(start)
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
    ...highlight,
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

function textSearchReaderPath(work: TextSearchWork, highlight: TextSearchHighlight): string | null {
  const firstMatch = highlight.match[0]
  if (typeof work.author_id !== "string" || !isSafeIdentifier(work.author_id) || !isSafeIdentifier(work.title_id) ||
    !isSafeIdentifier(work.lbworkid) ||
    (work.mediatype !== "etext" && work.mediatype !== "faksimil") ||
    !firstMatch || !isSafePageName(firstMatch.page_name)) {
    return null
  }
  const authorId = work.author_id
  const pageName = firstMatch.page_name
  if (authorId === null || pageName === null) return null
  return [
    "", "författare", authorId, "titlar", work.title_id, "sida",
    pageName, work.mediatype
  ].map(rfc3986Segment).join("/")
}

function appendCanonicalReaderSearch(
  params: URLSearchParams,
  state: TextSearchRouteState,
  hitIndex: number
): void {
  appendSearchParam(params, "q", state.phrase)
  appendSearchParam(params, "hit", hitIndex)
  appendSearchParam(params, "snapshot", state.snapshot)
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
): string | null {
  if (!state.phrase) throw new TypeError("Reader search links require a phrase")
  if (!Number.isSafeInteger(hitIndex) || hitIndex < 0 || hitIndex > 1_000_001) {
    throw new RangeError("Reader hit index is out of range")
  }
  if (highlight.reader_target_status !== "exact") return null
  const firstMatch = highlight.match[0]!
  const lastMatch = highlight.match.at(-1)!
  if (wordPosition(firstMatch.word_id, work.lbworkid) === null ||
    wordPosition(lastMatch.word_id, work.lbworkid) === null) return null
  const path = textSearchReaderPath(work, highlight)
  if (path === null) return null
  const params = new URLSearchParams()
  appendCanonicalReaderSearch(params, state, hitIndex)
  appendSearchParam(params, "traff", firstMatch.word_id)
  appendSearchParam(params, "traffslut", lastMatch.word_id)
  appendLegacyReaderSearch(params, work, state, hitIndex)
  return `${path}?${params.toString()}`
}
