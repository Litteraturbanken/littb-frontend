<script setup lang="ts">
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/vue"
import type { LocationQueryRaw } from "vue-router"

import searchBackground from "~/assets/img/sok_bkg.jpg"
import type {
  SearchMultiSelectOption,
  SearchMultiSelectOptionGroup
} from "~/components/search/SearchMultiSelect.vue"
import SearchMultiSelect from "~/components/search/SearchMultiSelect.vue"
import { useLbApiClient } from "~/composables/useLbApiClient"
import {
  createTextSearchRequestOwner,
  type TextSearchOwnedRequest,
  type TextSearchRequestOwner
} from "~/lib/text-search-request-owner"
import {
  acceptTextSearchOptionsResponse,
  acceptTextSearchResultsResponse,
  attachTextSearchReturnHref,
  buildTextSearchOptionsRequest,
  buildTextSearchReaderHref,
  buildTextSearchResultsRequest,
  isTextSearchPunctuation,
  isTextSearchSnapshot,
  parseTextSearchRouteQuery,
  prepareTextSearchHighlight,
  resetTextSearchQuery,
  textSearchFilterQuery,
  textSearchCategoryOptions,
  textSearchLanguageOptions,
  textSearchOptionsRequestIdentity,
  textSearchPageQuery,
  textSearchResultsRequestIdentity,
  textSearchRouteIdentity,
  textSearchSubmitQuery,
  type TextSearchOptionsResponse,
  type TextSearchResultsResponse,
  type TextSearchRouteQuery,
  type TextSearchRouteState
} from "~/lib/text-search"
import { readerTargetUnavailableMessage } from "~/lib/reader-target"

type SearchWordView = Readonly<{ text: string, punct: boolean }>
type SearchHitView = Readonly<{
  href: string | null
  left: readonly SearchWordView[]
  match: readonly SearchWordView[]
  right: readonly SearchWordView[]
}>
type SearchWorkView = Readonly<{
  key: string
  workId: string
  mediaType: "etext" | "faksimil"
  authorName: string | null
  title: string
  facsimile: boolean
  occurrenceCount: number
  hasMore: boolean
  hits: readonly SearchHitView[]
}>
type SearchFacetView = Readonly<{ key: string, name: string, count: number }>
type SearchResultsView = Readonly<{
  snapshot: string
  totalOccurrences: number
  totalDocuments: number
  totalWorks: number
  works: readonly SearchWorkView[]
  facets: readonly SearchFacetView[]
}>
type PrimaryEnvelope = Readonly<{
  identity: string
  status: 200 | 204 | 409 | 422 | 503 | 502
  results: SearchResultsView | null
}>
type ChronologyBounds = Readonly<{ yearFrom: number, yearTo: number }>
const DEFAULT_CHRONOLOGY_FLOOR = 1800
const DEFAULT_CHRONOLOGY_CEILING = 1950
type ChronologyEnvelope = Readonly<{ bounds: ChronologyBounds | null }>
type AuthorChoice = Readonly<{ value: string, label: string, selectionLabel: string }>
type OptionsView = Readonly<{
  titles: readonly SearchMultiSelectOption[]
  authors: readonly AuthorChoice[]
  aboutAuthors: readonly AuthorChoice[]
  titleTotal: number
  yearFrom: number | null
  yearTo: number | null
  staticComplete: boolean
}>
type OptionsLoadState = Readonly<{
  identity: string
  status: "idle" | "pending" | "failed" | "accepted"
}>
type TitleOptionsOverride = Readonly<{
  identity: string
  titleFilter: string
  titles: readonly SearchMultiSelectOption[]
  titleTotal: number
}>

const route = useRoute()
const router = useRouter()
const nuxtApp = useNuxtApp()
const requestUrl = useRequestURL()
const client = useLbApiClient()
const rawQuery = computed(() => route.query as unknown as TextSearchRouteQuery)
const state = computed(() => parseTextSearchRouteQuery(rawQuery.value))
const invalidSnapshot = computed(() => Object.hasOwn(rawQuery.value, "snapshot")
  && !isTextSearchSnapshot(rawQuery.value.snapshot))
const initialSearchFullPath = useState(
  `text-search-initial-full-path:${route.path}`,
  () => `${requestUrl.pathname}${requestUrl.search}`
)
const searchOriginFullPath = ref(import.meta.client && !nuxtApp.isHydrating
  ? `${window.location.pathname}${window.location.search}`
  : initialSearchFullPath.value)
const { rememberTextSearchHref } = useTextSearchNavigation()
rememberTextSearchHref(searchOriginFullPath.value)

function currentSearchFullPath(): string {
  return searchOriginFullPath.value
}

function readerHrefWithReturn(href: string): string {
  return attachTextSearchReturnHref(href, currentSearchFullPath())
}

watch(() => route.fullPath, () => {
  if (import.meta.client) {
    searchOriginFullPath.value = `${window.location.pathname}${window.location.search}`
    rememberTextSearchHref(searchOriginFullPath.value)
  }
}, { flush: "sync" })

const routeIdentity = computed(() => textSearchRouteIdentity(state.value))
const primaryIdentity = computed(() => {
  const identity = state.value.phrase
    ? textSearchResultsRequestIdentity(buildTextSearchResultsRequest(state.value))
    : "empty"
  // A present invalid pin is never the same owner as the unpinned request.
  return invalidSnapshot.value ? `invalid-snapshot:${identity}` : identity
})
function primaryDataKey(identity: string): string {
  return `text-search-primary:${identity}`
}
const primaryKey = computed(() => primaryDataKey(primaryIdentity.value))

function isChronologyEndpoint(value: unknown): value is number | null {
  return value === null || (Number.isSafeInteger(value) && (value as number) >= 1000
    && (value as number) <= 2200)
}

function isChronologyRecord(value: unknown): value is Record<"year_from" | "year_to", unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === "year_from,year_to"
}

function chronologyBounds(value: unknown): ChronologyBounds | null {
  if (!isChronologyRecord(value)) return null
  const { year_from: yearFrom, year_to: yearTo } = value
  if (!isChronologyEndpoint(yearFrom) || !isChronologyEndpoint(yearTo)
    || (yearFrom === null && yearTo === null)) return null
  return {
    yearFrom: Math.min(yearFrom ?? DEFAULT_CHRONOLOGY_FLOOR,
      yearTo ?? DEFAULT_CHRONOLOGY_CEILING),
    yearTo: Math.max(yearFrom ?? DEFAULT_CHRONOLOGY_FLOOR,
      yearTo ?? DEFAULT_CHRONOLOGY_CEILING)
  }
}

const chronologyAsyncData = useAsyncData<ChronologyEnvelope>(
  "text-search-chronology",
  async () => {
    if (state.value.advanced) return { bounds: null }
    try {
      const result = await client.GET("/text-search/chronology")
      return {
        bounds: result.response.status === 200 ? chronologyBounds(result.data) : null
      }
    } catch {
      return { bounds: null }
    }
  },
  {
    default: () => ({ bounds: null }),
    immediate: import.meta.server && !state.value.advanced,
    lazy: true
  }
)
const chronologyRequested = ref(!state.value.advanced)
watch(() => state.value.advanced, advanced => {
  if (advanced || chronologyRequested.value) return
  chronologyRequested.value = true
  void chronologyAsyncData.execute()
}, { flush: "sync" })

const primaryRequestOwner = createTextSearchRequestOwner()
const primaryExecutionIdentity = shallowRef<string | null>(null)
const primaryInFlightIdentity = shallowRef<string | null>(null)
const freshPrimaryIdentity = shallowRef<string | null>(null)
const primaryClientMounted = ref(false)
watch(primaryIdentity, (_identity, previousIdentity) => {
  primaryRequestOwner.cancel()
  primaryExecutionIdentity.value = null
  if (primaryInFlightIdentity.value === previousIdentity) {
    clearNuxtData(primaryDataKey(previousIdentity))
    primaryInFlightIdentity.value = null
  }
}, { flush: "sync" })
const queryInput = ref(state.value.phrase ?? "")
const searchInputElement = ref<HTMLInputElement | null>(null)
watch(() => state.value.phrase, phrase => { queryInput.value = phrase ?? "" })
const searchIsPristine = computed(() => Object.keys(rawQuery.value).every(
  key => key === "avancerad"
))

function wordView(word: { word: string }): SearchWordView {
  return { text: word.word, punct: isTextSearchPunctuation(word.word) }
}

function resultsView(
  response: TextSearchResultsResponse,
  requestedState: TextSearchRouteState
): SearchResultsView {
  const facetNames = new Map(response.author_facets.map(facet => [
    facet.author_id,
    facet.name_for_index
  ]))
  return {
    snapshot: response.snapshot,
    totalOccurrences: response.totals.occurrences,
    totalDocuments: response.totals.documents,
    totalWorks: response.totals.works,
    facets: response.author_facets.map(facet => ({
      key: facet.author_id,
      name: facet.name_for_index,
      count: facet.count
    })),
    works: response.works.map(work => {
      let hitIndex = 0
      return {
        key: `${encodeURIComponent(work.lbworkid)}:${work.mediatype}`,
        workId: work.lbworkid,
        mediaType: work.mediatype,
        authorName: work.author_id === null ? null : (facetNames.get(work.author_id) ?? work.author_name),
        title: work.title,
        facsimile: work.mediatype === "faksimil",
        occurrenceCount: work.occurrence_count,
        hasMore: work.has_more_highlights,
        hits: work.highlights.map(rawHighlight => {
          const highlight = prepareTextSearchHighlight(rawHighlight)
          const href = buildTextSearchReaderHref(work, highlight, hitIndex, {
            ...requestedState, snapshot: response.snapshot
          })
          hitIndex += 1
          return {
            href,
            left: highlight.left_context.map(wordView),
            match: highlight.match.map(wordView),
            right: highlight.right_context.map(wordView)
          }
        })
      }
    })
  }
}

function primaryFailureStatus(status: number): PrimaryEnvelope["status"] {
  return status === 409 || status === 422 || status === 503 ? status : 502
}

const primaryAsyncData = useAsyncData<PrimaryEnvelope>(
  primaryKey,
  async (_nuxtApp, { signal }) => {
    const requestedState = state.value
    const identity = primaryIdentity.value
    if (invalidSnapshot.value) return { identity, status: 422, results: null }
    if (!requestedState.phrase) return { identity, status: 204, results: null }
    const body = buildTextSearchResultsRequest(requestedState)
    const requestIdentity = textSearchResultsRequestIdentity(body)
    const request = primaryRequestOwner.start(identity)
    const requestSignal = AbortSignal.any([signal, request.signal])
    try {
      const result = await client.POST("/text-search/results", { body, signal: requestSignal })
      if (
        requestSignal.aborted
        || !primaryRequestOwner.isCurrent(request, primaryIdentity.value)
      ) {
        throw requestSignal.reason
          ?? new DOMException("Search request aborted", "AbortError")
      }
      const accepted = result.response.status === 200
        ? acceptTextSearchResultsResponse(result.data, body, requestIdentity)
        : null
      return accepted
        ? { identity, status: 200, results: resultsView(accepted, requestedState) }
        : {
            identity,
            status: primaryFailureStatus(result.response.status),
            results: null
          }
    } catch {
      if (requestSignal.aborted) {
        throw requestSignal.reason ?? new DOMException("Search request aborted", "AbortError")
      }
      return { identity, status: 502, results: null }
    } finally {
      primaryRequestOwner.finish(request)
    }
  },
  {
    server: false,
    immediate: false,
    lazy: true,
    // Nuxt's reactive-key default may execute before route prerequisites are accepted.
    ...{ _keyTriggersExecute: false },
    getCachedData: (key, nuxtApp) => {
      if (invalidSnapshot.value) return undefined
      if (freshPrimaryIdentity.value === primaryIdentity.value) return undefined
      const cached = nuxtApp.payload.data[key] as PrimaryEnvelope | undefined
      return cached?.identity === primaryIdentity.value
        && (cached.status === 200 || cached.status === 204)
        ? cached
        : undefined
    }
  }
)

if (import.meta.server) await chronologyAsyncData
else if (!state.value.advanced) void chronologyAsyncData.execute()
const { data: chronologyData, pending: chronologyPending } = chronologyAsyncData
const { data: primaryData, pending: primaryPending } = primaryAsyncData

const acceptedPrimary = shallowRef<PrimaryEnvelope | null>(null)
const displayPrimary = shallowRef<PrimaryEnvelope | null>(null)
watch(primaryIdentity, () => {
  acceptedPrimary.value = null
  if (!state.value.phrase) displayPrimary.value = null
}, { flush: "sync" })
watch([primaryData, primaryIdentity], ([candidate, identity]) => {
  if (candidate?.identity !== identity) return
  acceptedPrimary.value = candidate
  if (candidate.status === 200) displayPrimary.value = candidate
  else displayPrimary.value = null
}, { immediate: true, flush: "sync" })

const results = computed(() => displayPrimary.value?.status === 200
  ? displayPrimary.value.results
  : null)
function navigatorIdentityFor(snapshot: string): string {
  const request = buildTextSearchResultsRequest({
    ...state.value,
    page: 1,
    facetAuthorId: null,
    snapshot
  })
  return textSearchResultsRequestIdentity(request)
}
const navigatorIdentity = computed(() => results.value?.snapshot
  ? navigatorIdentityFor(results.value.snapshot)
  : "empty")
const navigatorSnapshot = shallowRef<Readonly<{
  identity: string
  snapshot: string
  facets: readonly SearchFacetView[]
}> | null>(null)
const navigatorSnapshotRequestOwner = createTextSearchRequestOwner()
let navigatorSnapshotInFlight: TextSearchOwnedRequest | null = null

function cancelNavigatorSnapshot() {
  navigatorSnapshotRequestOwner.cancel()
  navigatorSnapshotInFlight = null
}

watch([primaryIdentity, () => state.value.facetAuthorId], cancelNavigatorSnapshot, { flush: "sync" })

function ownsNavigatorSnapshot(request: TextSearchOwnedRequest, primary: string, snapshot: string): boolean {
  return primaryIdentity.value === primary
    && acceptedPrimary.value?.identity === primary
    && acceptedPrimary.value.results?.snapshot === snapshot
    && navigatorSnapshotRequestOwner.isCurrent(request, navigatorIdentityFor(snapshot))
}

async function loadNavigatorSnapshot(snapshot: string) {
  const primary = primaryIdentity.value
  const requestedState = {
    ...state.value,
    page: 1,
    facetAuthorId: null,
    snapshot
  }
  if (!requestedState.phrase || state.value.facetAuthorId === null) return
  const identity = navigatorIdentityFor(snapshot)
  if (
    navigatorSnapshot.value?.identity === identity
    || (
      navigatorSnapshotInFlight !== null
      && navigatorSnapshotRequestOwner.isCurrent(navigatorSnapshotInFlight, identity)
    )
  ) return
  const request = navigatorSnapshotRequestOwner.start(identity)
  navigatorSnapshotInFlight = request
  const body = buildTextSearchResultsRequest(requestedState)
  const requestIdentity = textSearchResultsRequestIdentity(body)
  try {
    const result = await client.POST("/text-search/results", { body, signal: request.signal })
    if (!ownsNavigatorSnapshot(request, primary, snapshot)) return
    if (result.response.status === 409 && result.error?.error.code === "text_search_snapshot_expired") {
      expirePrimarySnapshot(primary, snapshot)
      return
    }
    const accepted = result.response.status === 200
      ? acceptTextSearchResultsResponse(result.data, body, requestIdentity)
      : null
    if (accepted) {
      const view = resultsView(accepted, requestedState)
      navigatorSnapshot.value = {
        identity,
        snapshot,
        facets: view.facets
      }
    }
  } catch {
    // Failed and aborted requests remain retryable after route re-entry.
  } finally {
    if (navigatorSnapshotInFlight === request) navigatorSnapshotInFlight = null
    navigatorSnapshotRequestOwner.finish(request)
  }
}

watch(
  [displayPrimary, primaryIdentity, () => state.value.facetAuthorId],
  ([candidate, identity, facetAuthorId]) => {
    if (
      candidate?.identity !== identity
      || candidate.status !== 200
      || candidate.results === null
    ) return
    const stableIdentity = navigatorIdentityFor(candidate.results.snapshot)
    if (facetAuthorId !== null) {
      // Let the primary page reconcile before acquiring auxiliary ownership.
      if (state.value.page > Math.max(1, Math.ceil(candidate.results.totalWorks / 30))) return
      if (import.meta.client && navigatorSnapshot.value?.identity !== stableIdentity) {
        void loadNavigatorSnapshot(candidate.results.snapshot)
      }
      return
    }
    navigatorSnapshot.value = {
      identity: stableIdentity,
      snapshot: candidate.results.snapshot,
      facets: candidate.results.facets
    }
  },
  { immediate: true, flush: "sync" }
)
const navigatorFacets = computed(() => (
  navigatorSnapshot.value?.identity === navigatorIdentity.value
    ? navigatorSnapshot.value.facets
    : results.value?.facets ?? []
))
const currentPrimaryFacets = computed(() => (
  displayPrimary.value?.identity === primaryIdentity.value
    ? displayPrimary.value.results?.facets ?? []
    : []
))
const primaryExpired = computed(() => acceptedPrimary.value?.status === 409)
function expirePrimarySnapshot(identity: string, snapshot: string): void {
  if (primaryIdentity.value !== identity || acceptedPrimary.value?.identity !== identity
    || acceptedPrimary.value.results?.snapshot !== snapshot) return
  acceptedPrimary.value = { identity, status: 409, results: null }
  displayPrimary.value = null
  cancelNavigatorSnapshot()
  cancelAllMore()
}
const primaryFailed = computed(() => acceptedPrimary.value !== null
  && acceptedPrimary.value.status !== 200 && acceptedPrimary.value.status !== 204)
const primaryLoading = computed(() => Boolean(state.value.phrase)
  && !optionsFailed.value
  && (primaryPending.value || acceptedPrimary.value === null))

function authorLabel(author: TextSearchOptionsResponse["authors"][number]): string {
  const years = author.birth_year || author.death_year
    ? ` (${author.birth_year ?? ""}-${author.death_year ?? ""})`
    : ""
  return `${author.name_for_index}${years}`
}

function optionsView(
  response: TextSearchOptionsResponse,
  staticComplete = true
): OptionsView {
  return {
    titles: response.title_options.map(option => ({
      value: option.work_id,
      label: option.title
    })),
    authors: response.authors.map(author => ({
      value: author.author_id,
      label: authorLabel(author),
      selectionLabel: authorLabel(author)
    })),
    aboutAuthors: response.about_authors.map(author => ({
      value: author.author_id,
      label: authorLabel(author),
      selectionLabel: authorLabel(author)
    })),
    titleTotal: response.title_total,
    yearFrom: response.year_from ?? null,
    yearTo: response.year_to ?? null,
    staticComplete
  }
}

const optionsCache = useState<Record<string, OptionsView>>(
  "text-search-options-cache",
  () => ({})
)
const titleOptionsOverride = shallowRef<TitleOptionsOverride | null>(null)
const optionsInFlight = new Map<string, TextSearchOwnedRequest>()
const optionsRequestOwner = createTextSearchRequestOwner()
const optionsIdentity = computed(() => textSearchOptionsRequestIdentity(
  buildTextSearchOptionsRequest(state.value)
))
const optionsLoadState = shallowRef<OptionsLoadState>({
  identity: optionsIdentity.value,
  status: optionsCache.value[optionsIdentity.value]?.staticComplete
    ? "accepted"
    : "idle"
})

function setOptionsLoadState(
  identity: string,
  status: OptionsLoadState["status"]
): void {
  if (identity === optionsIdentity.value) optionsLoadState.value = { identity, status }
}

async function loadOptions() {
  const requestedState = state.value
  const body = buildTextSearchOptionsRequest(requestedState)
  const identity = textSearchOptionsRequestIdentity(body)
  if (optionsCache.value[identity]?.staticComplete) {
    setOptionsLoadState(identity, "accepted")
    return
  }
  if (optionsInFlight.has(identity)) return
  const request = optionsRequestOwner.start(identity)
  optionsInFlight.set(identity, request)
  setOptionsLoadState(identity, "pending")
  try {
    const result = await client.POST("/text-search/options", {
      body,
      signal: request.signal
    })
    const accepted = result.response.status === 200
      ? acceptTextSearchOptionsResponse(result.data, body, identity)
      : null
    if (optionsRequestOwner.isCurrent(request, optionsIdentity.value) && accepted) {
      optionsCache.value[identity] = optionsView(accepted)
      setOptionsLoadState(identity, "accepted")
    } else if (optionsRequestOwner.isCurrent(request, optionsIdentity.value)) {
      setOptionsLoadState(identity, "failed")
    }
  } catch {
    if (optionsRequestOwner.isCurrent(request, optionsIdentity.value)) {
      setOptionsLoadState(identity, "failed")
    }
  } finally {
    if (optionsInFlight.get(identity) === request) optionsInFlight.delete(identity)
    optionsRequestOwner.finish(request)
  }
}

async function loadInitialOptions(): Promise<void> {
  if (!state.value.advanced) return
  await loadOptions()
}
if (import.meta.server) await loadInitialOptions()
else void loadInitialOptions()
const options = computed(() => {
  const cached = optionsCache.value[optionsIdentity.value] ?? null
  const override = titleOptionsOverride.value
  if (!cached || override?.identity !== optionsIdentity.value) return cached
  return {
    ...cached,
    titles: override.titles,
    titleTotal: override.titleTotal
  }
})
const optionsFailed = computed(() => (
  state.value.advanced
  && optionsLoadState.value.identity === optionsIdentity.value
  && optionsLoadState.value.status === "failed"
  && options.value?.staticComplete !== true
))
const primaryPrerequisitesReady = computed(() => (
  state.value.advanced
    ? optionsLoadState.value.identity === optionsIdentity.value
      && optionsLoadState.value.status === "accepted"
      && options.value?.staticComplete === true
    : !chronologyPending.value
))
function retryOptions(): void {
  if (!optionsFailed.value) return
  void loadOptions()
}
watch(
  [primaryIdentity, primaryPrerequisitesReady, primaryClientMounted],
  ([identity, prerequisitesReady, mounted]) => {
    if (
      !mounted
      || !prerequisitesReady
      || !state.value.phrase
      || primaryExecutionIdentity.value === identity
      || acceptedPrimary.value?.identity === identity
    ) return
    executePrimary(identity, "initial")
  },
  { immediate: true, flush: "post" }
)

function executePrimary(identity: string, cause: "initial" | "refresh:manual"): void {
  primaryExecutionIdentity.value = identity
  primaryInFlightIdentity.value = identity
  void primaryAsyncData.execute({ cause }).finally(() => {
    if (primaryInFlightIdentity.value === identity) {
      primaryInFlightIdentity.value = null
    }
    if (freshPrimaryIdentity.value === identity) freshPrimaryIdentity.value = null
  })
}
const lastAcceptedAdvancedChronologyBounds = shallowRef({
  yearFrom: options.value?.yearFrom ?? DEFAULT_CHRONOLOGY_FLOOR,
  yearTo: options.value?.yearTo ?? DEFAULT_CHRONOLOGY_CEILING
})
watch(options, candidate => {
  if (candidate?.yearFrom == null || candidate.yearTo == null) return
  lastAcceptedAdvancedChronologyBounds.value = {
    yearFrom: candidate.yearFrom,
    yearTo: candidate.yearTo
  }
}, { flush: "sync" })
const advancedChronologyBounds = computed(() => {
  const yearFrom = options.value?.yearFrom
    ?? lastAcceptedAdvancedChronologyBounds.value.yearFrom
  const yearTo = options.value?.yearTo
    ?? lastAcceptedAdvancedChronologyBounds.value.yearTo
  return [Math.min(yearFrom, yearTo), Math.max(yearFrom, yearTo)] as const
})
const baseChronologyFloor = computed(() => (
  state.value.advanced
    ? advancedChronologyBounds.value[0]
    : chronologyData.value?.bounds?.yearFrom ?? DEFAULT_CHRONOLOGY_FLOOR
))
const baseChronologyCeiling = computed(() => (
  state.value.advanced
    ? advancedChronologyBounds.value[1]
    : chronologyData.value?.bounds?.yearTo ?? DEFAULT_CHRONOLOGY_CEILING
))
const chronologyFloor = computed(() => Math.min(
  baseChronologyFloor.value,
  state.value.yearRange?.[0] ?? baseChronologyFloor.value
))
const chronologyCeiling = computed(() => Math.max(
  baseChronologyCeiling.value,
  state.value.yearRange?.[1] ?? baseChronologyCeiling.value
))
const chronologyFromDraft = ref("")
const chronologyToDraft = ref("")
const chronologyDraftDirty = ref(false)
let chronologyDraftRevision = 0
const pendingChronologyNavigations = new Map<number, readonly [number, number]>()

function syncChronologyDraft() {
  if (chronologyDraftDirty.value) return
  const selected = state.value.yearRange
  const from = selected?.[0] ?? chronologyFloor.value
  const to = selected?.[1] ?? chronologyCeiling.value
  chronologyFromDraft.value = String(from)
  chronologyToDraft.value = String(to)
}

watch(routeIdentity, () => {
  const selected = state.value.yearRange
  const matchingNavigation = selected && [...pendingChronologyNavigations].findLast(
    ([, range]) => range[0] === selected[0] && range[1] === selected[1]
  )
  if (matchingNavigation && chronologyDraftRevision > matchingNavigation[0]) return
  chronologyDraftRevision += 1
  chronologyDraftDirty.value = false
  syncChronologyDraft()
}, {
  immediate: true,
  flush: "sync"
})
watch([chronologyFloor, chronologyCeiling], syncChronologyDraft, { flush: "sync" })

function setChronologyDraft(endpoint: "from" | "to", value: string) {
  chronologyDraftRevision += 1
  chronologyDraftDirty.value = true
  if (endpoint === "from") chronologyFromDraft.value = value
  else chronologyToDraft.value = value
}

function cancelChronologyDraft() {
  chronologyDraftRevision += 1
  chronologyDraftDirty.value = false
  syncChronologyDraft()
}

async function commitChronologyDraft(endpoint: "from" | "to", value: string) {
  setChronologyDraft(endpoint, value)
  const floor = chronologyFloor.value
  const ceiling = chronologyCeiling.value
  const from = /^\d{4}$/.test(chronologyFromDraft.value)
    ? Number(chronologyFromDraft.value)
    : Number.NaN
  const to = /^\d{4}$/.test(chronologyToDraft.value)
    ? Number(chronologyToDraft.value)
    : Number.NaN
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)
    || from < floor || to > ceiling || from > to) {
    chronologyDraftDirty.value = false
    syncChronologyDraft()
    return
  }
  if (state.value.yearRange?.[0] === from && state.value.yearRange[1] === to) {
    chronologyDraftDirty.value = false
    return
  }
  const revision = chronologyDraftRevision
  const yearRange = [from, to] as const
  pendingChronologyNavigations.set(revision, yearRange)
  try {
    await navigate(textSearchFilterQuery(rawQuery.value, { yearRange }))
  } finally {
    pendingChronologyNavigations.delete(revision)
  }
  if (chronologyDraftRevision !== revision) return
  chronologyDraftDirty.value = false
  syncChronologyDraft()
}

const titleRequestOwner = createTextSearchRequestOwner()
let titleTimer: ReturnType<typeof setTimeout> | null = null
const titleLoading = ref(false)
const titleOptionsFailed = ref(false)
const titleOptionsExpanded = ref(false)
const titleFilterText = ref("")
let failedTitleOptionsRequest: Readonly<{
  titleFilter: string
  titleLimit: 30 | 500
}> | null = null
watch(optionsIdentity, () => {
  titleOptionsExpanded.value = false
  titleOptionsFailed.value = false
  failedTitleOptionsRequest = null
})
async function loadTitleOptions(titleFilter: string, titleLimit: 30 | 500 = 30) {
  const requestedState = state.value
  const identity = textSearchOptionsRequestIdentity(buildTextSearchOptionsRequest(requestedState))
  const request = titleRequestOwner.start(identity)
  titleLoading.value = true
  titleOptionsFailed.value = false
  failedTitleOptionsRequest = null
  try {
    const body = buildTextSearchOptionsRequest(requestedState, {
      titleFilter,
      selectedWorkIds: requestedState.workIds,
      titleLimit,
      includeStaticOptions: false
    })
    const requestIdentity = textSearchOptionsRequestIdentity(body)
    const result = await client.POST("/text-search/options", {
      body,
      signal: request.signal
    })
    const accepted = result.response.status === 200
      ? acceptTextSearchOptionsResponse(result.data, body, requestIdentity)
      : null
    if (titleRequestOwner.isCurrent(request, optionsIdentity.value) && accepted) {
      titleOptionsOverride.value = {
        identity,
        titleFilter,
        titles: optionsView(accepted).titles,
        titleTotal: accepted.title_total
      }
      titleOptionsExpanded.value = titleLimit === 500
      failedTitleOptionsRequest = null
    } else if (titleRequestOwner.isCurrent(request, optionsIdentity.value)) {
      titleOptionsFailed.value = true
      failedTitleOptionsRequest = { titleFilter, titleLimit }
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      if (titleRequestOwner.isCurrent(request, optionsIdentity.value)) {
        titleOptionsFailed.value = true
        failedTitleOptionsRequest = { titleFilter, titleLimit }
      }
    }
  } finally {
    if (titleRequestOwner.finish(request)) titleLoading.value = false
  }
}

function queueTitleOptions(titleFilter: string) {
  if (titleFilterText.value !== titleFilter) {
    titleRequestOwner.cancel()
    titleLoading.value = false
    titleOptionsExpanded.value = false
    titleOptionsFailed.value = false
    failedTitleOptionsRequest = null
  }
  titleFilterText.value = titleFilter
  if (titleTimer) clearTimeout(titleTimer)
  titleTimer = setTimeout(() => {
    titleTimer = null
    void loadTitleOptions(titleFilter)
  }, 250)
}

function showAllTitleOptions() {
  if (titleTimer) clearTimeout(titleTimer)
  titleTimer = null
  void loadTitleOptions(titleFilterText.value, 500)
}

function retryTitleOptions() {
  if (!failedTitleOptionsRequest) return
  const { titleFilter, titleLimit } = failedTitleOptionsRequest
  void loadTitleOptions(titleFilter, titleLimit)
}

function cancelTitleOptions() {
  titleRequestOwner.cancel()
  if (titleTimer) clearTimeout(titleTimer)
  titleTimer = null
  titleLoading.value = false
  titleOptionsFailed.value = false
  titleOptionsExpanded.value = false
  titleFilterText.value = ""
  titleOptionsOverride.value = null
  failedTitleOptionsRequest = null
}

const authorChoices = computed<SearchMultiSelectOption[]>(() => {
  const choices = new Map<string, SearchMultiSelectOption>()
  for (const choice of options.value?.authors ?? []) {
    choices.set(choice.value, choice)
  }
  for (const facet of currentPrimaryFacets.value) {
    if (!choices.has(facet.key)) {
      choices.set(facet.key, {
        value: facet.key,
        label: facet.name,
        selectionLabel: facet.name.split(",", 1)[0]!
      })
    }
  }
  for (const value of state.value.authorIds) {
    if (!choices.has(value)) choices.set(value, { value, label: value })
  }
  return [...choices.values()]
})
const aboutAuthorChoices = computed<SearchMultiSelectOption[]>(() => {
  const choices = new Map<string, SearchMultiSelectOption>()
  for (const choice of options.value?.aboutAuthors ?? []) choices.set(choice.value, choice)
  for (const value of state.value.aboutAuthorIds) {
    if (choices.has(value)) continue
    const facet = results.value?.facets.find(candidate => candidate.key === value)
    choices.set(value, facet
      ? {
          value,
          label: facet.name,
          selectionLabel: facet.name.split(",", 1)[0]!
        }
      : { value, label: value })
  }
  return [...choices.values()]
})
const titleChoices = computed<SearchMultiSelectOption[]>(() => {
  const choices = new Map((options.value?.titles ?? []).map(option => [option.value, option]))
  for (const value of state.value.workIds) {
    if (!choices.has(value)) choices.set(value, { value, label: value })
  }
  return [...choices.values()]
})
const languageChoices = textSearchLanguageOptions.map(([value, label]) => ({ value, label }))
const categoryChoices = textSearchCategoryOptions.map(([value, label]) => ({
  value,
  label,
  disabled: value === "texttype:drama;dramasamling"
    || value === "texttype:essä;essäsamling"
}))
const categoryChoiceGroups: readonly SearchMultiSelectOptionGroup[] = [
  { label: "Kategorier", options: categoryChoices.slice(0, 20) },
  { label: "Projekt", options: categoryChoices.slice(20, 24) },
  { label: "Avdelningar", options: categoryChoices.slice(24, 31) },
  { label: "Utgivare", options: categoryChoices.slice(31) }
]

function navigate(query: Record<string, string | readonly string[] | null | undefined>) {
  const mutableQuery: LocationQueryRaw = {}
  for (const [key, value] of Object.entries(query)) {
    mutableQuery[key] = typeof value === "string" || value == null ? value : [...value]
  }
  return router.push({ name: route.name as string, query: mutableQuery })
}

function submitSearch() {
  const query = textSearchSubmitQuery(rawQuery.value, queryInput.value)
  const submittedState = parseTextSearchRouteQuery(query)
  const submittedIdentity = submittedState.phrase
    ? textSearchResultsRequestIdentity(buildTextSearchResultsRequest(submittedState))
    : "empty"
  if (
    primaryFailed.value
    && primaryPrerequisitesReady.value
    && submittedIdentity === primaryIdentity.value
  ) {
    acceptedPrimary.value = null
    executePrimary(submittedIdentity, "refresh:manual")
    return
  }
  void navigate(query)
}

function restartExpiredSearch() {
  if (!primaryExpired.value) return
  const query = { ...rawQuery.value }
  delete query.snapshot
  delete query.traffsida
  const restartedState = parseTextSearchRouteQuery(query)
  const identity = restartedState.phrase
    ? textSearchResultsRequestIdentity(buildTextSearchResultsRequest(restartedState))
    : "empty"
  freshPrimaryIdentity.value = identity
  clearNuxtData(primaryDataKey(identity))
  if (identity === primaryIdentity.value) {
    acceptedPrimary.value = null
    executePrimary(identity, "refresh:manual")
    return
  }
  void router.replace({ name: route.name as string, query: query as LocationQueryRaw })
}

async function resetSearch() {
  await navigate(resetTextSearchQuery(rawQuery.value))
  await nextTick()
  searchInputElement.value?.focus()
}

function patchFilters(patch: Parameters<typeof textSearchFilterQuery>[1]) {
  void navigate(textSearchFilterQuery(rawQuery.value, patch))
}

function toggleAdvanced() {
  patchFilters({ advanced: !state.value.advanced })
}

type SearchMode = "default" | "lemma" | "modernize" | "prefix" | "suffix" | "infix"

function searchModePatch(mode: SearchMode): Parameters<typeof textSearchFilterQuery>[1] {
  switch (mode) {
    case "default":
      return {
      prefix: false,
      suffix: false,
      infix: false,
      wordFormOnly: true,
      includeModernized: false
      }
    case "lemma":
      return {
      prefix: false,
      suffix: false,
      infix: false,
      wordFormOnly: false,
      includeModernized: false
      }
    case "modernize":
      return state.value.includeModernized ? { includeModernized: false } : {
          prefix: false,
          suffix: false,
          infix: false,
          wordFormOnly: true,
          includeModernized: true
        }
    case "infix":
      return state.value.infix
        ? { prefix: false, suffix: false, infix: false, wordFormOnly: true }
        : {
          prefix: true,
          suffix: true,
          infix: true,
          wordFormOnly: true,
          includeModernized: false
        }
    case "prefix":
      return {
      prefix: state.value.infix ? false : !state.value.prefix,
      suffix: state.value.suffix,
      infix: false,
      wordFormOnly: true,
      includeModernized: false
      }
    case "suffix":
      return {
      prefix: state.value.prefix,
      suffix: state.value.infix ? false : !state.value.suffix,
      infix: false,
      wordFormOnly: true,
      includeModernized: false
      }
  }
}

function setSearchMode(mode: SearchMode) {
  patchFilters(searchModePatch(mode))
}

function selectedMode(mode: string): boolean {
  if (mode === "default") {
    return !state.value.prefix && !state.value.suffix && state.value.wordFormOnly
  }
  if (mode === "lemma") return !state.value.wordFormOnly
  if (mode === "modernize") return state.value.includeModernized
  if (mode === "prefix") return state.value.prefix && !state.value.infix
  if (mode === "suffix") return state.value.suffix && !state.value.infix
  return state.value.infix
}

watch(
  [optionsIdentity, () => state.value.advanced],
  ([identity, advanced], [previousIdentity]) => {
    if (identity !== previousIdentity || !advanced) cancelTitleOptions()
  },
  { flush: "sync" }
)
watch([optionsIdentity, () => state.value.advanced], ([identity, advanced], [previousIdentity]) => {
  if (identity !== previousIdentity || !advanced) {
    optionsRequestOwner.cancel()
    optionsInFlight.clear()
    optionsLoadState.value = {
      identity,
      status: advanced && optionsCache.value[identity]?.staticComplete
        ? "accepted"
        : "idle"
    }
  }
  if (advanced) void loadOptions()
}, { flush: "post" })

type ExpandedSearchWork = Readonly<Pick<SearchWorkView, "hits" | "hasMore" | "occurrenceCount"> & {
  highlightLimit: number
}>
const moreWorks = shallowRef<Record<string, ExpandedSearchWork>>({})
const moreRequestOwners = new Map<string, TextSearchRequestOwner>()
const moreLoadingKeys = shallowRef<ReadonlySet<string>>(new Set())
function setMoreLoading(workKey: string, loading: boolean) {
  const next = new Set(moreLoadingKeys.value)
  if (loading) next.add(workKey)
  else next.delete(workKey)
  moreLoadingKeys.value = next
}
function cancelAllMore() {
  for (const owner of moreRequestOwners.values()) owner.cancel()
  moreRequestOwners.clear()
  moreWorks.value = {}
  moreLoadingKeys.value = new Set()
}
function finishMoreRequest(
  workKey: string,
  owner: TextSearchRequestOwner,
  request: TextSearchOwnedRequest
) {
  if (!owner.finish(request) || moreRequestOwners.get(workKey) !== owner) return
  moreRequestOwners.delete(workKey)
  setMoreLoading(workKey, false)
}
watch(routeIdentity, cancelAllMore, { flush: "sync" })

type SearchExpansion = Readonly<{
  target: SearchWorkView
  primaryIdentity: string
  snapshot: string
  highlightLimit: number
}>

function searchExpansion(workKey: string): SearchExpansion | null {
  const primary = displayPrimary.value
  if (primary?.identity !== primaryIdentity.value || primary.status !== 200
    || !primary.results) return null
  const target = primary.results.works.find(work => work.key === workKey)
  if (!target) return null
  const previous = moreWorks.value[workKey]
  const previousLimit = previous?.highlightLimit ?? 0
  if (!(previous?.hasMore ?? target.hasMore) || previousLimit >= 500) return null
  return {
    target, primaryIdentity: primary.identity, snapshot: primary.results.snapshot,
    highlightLimit: Math.min(previousLimit + 100, 500)
  }
}

function acceptSearchExpansion(
  expansion: SearchExpansion,
  accepted: TextSearchResultsResponse,
  requestedState: TextSearchRouteState
): void {
  if (displayPrimary.value?.identity !== expansion.primaryIdentity
    || displayPrimary.value.results?.snapshot !== expansion.snapshot) return
  const { target, highlightLimit } = expansion
  const expanded = resultsView(accepted, requestedState).works.find(work => (
    work.workId === target.workId && work.mediaType === target.mediaType
  ))
  if (expanded?.occurrenceCount !== target.occurrenceCount) return
  moreWorks.value = {
    ...moreWorks.value,
    [target.key]: {
      hits: expanded.hits, hasMore: expanded.hasMore,
      occurrenceCount: expanded.occurrenceCount, highlightLimit
    }
  }
}

async function showMore(workKey: string) {
  if (moreRequestOwners.has(workKey)) return
  const requestedState = state.value
  const expansion = searchExpansion(workKey)
  if (!requestedState.phrase || !expansion) return
  const identity = textSearchRouteIdentity(requestedState)
  const owner = createTextSearchRequestOwner()
  moreRequestOwners.set(workKey, owner)
  const request = owner.start(identity)
  setMoreLoading(workKey, true)
  const requestState: TextSearchRouteState = {
    ...requestedState,
    page: 1,
    snapshot: expansion.snapshot,
    workIds: [expansion.target.workId]
  }
  const body = buildTextSearchResultsRequest(requestState, expansion.highlightLimit)
  const requestIdentity = textSearchResultsRequestIdentity(body)
  try {
    const result = await client.POST("/text-search/results", {
      body,
      signal: request.signal
    })
    if (!owner.isCurrent(request, routeIdentity.value)) return
    if (result.response.status === 409 && result.error?.error.code === "text_search_snapshot_expired") {
      expirePrimarySnapshot(expansion.primaryIdentity, expansion.snapshot)
      return
    }
    const accepted = result.response.status === 200
      ? acceptTextSearchResultsResponse(result.data, body, requestIdentity)
      : null
    if (owner.isCurrent(request, routeIdentity.value) && accepted) {
      acceptSearchExpansion(expansion, accepted, requestedState)
    }
  } catch {
    // Keep the accepted primary rows when expansion fails or is aborted.
  } finally {
    finishMoreRequest(workKey, owner, request)
  }
}

type ResultRowView = Readonly<
  | { key: string, kind: "header", work: SearchWorkView, titleHref: string | null }
  | { key: string, kind: "hit", work: SearchWorkView, hit: SearchHitView }
  | { key: string, kind: "overflow", work: SearchWorkView,
    canExpand: boolean, shownHits: number, continuationHref: string | null }
>
const resultRows = computed<readonly ResultRowView[]>(() => {
  const rows: ResultRowView[] = []
  for (const primaryWork of results.value?.works ?? []) {
    const expanded = moreWorks.value[primaryWork.key]
    const work = expanded ? { ...primaryWork, ...expanded } : primaryWork
    const hits = work.hits
    rows.push({
      key: `${work.key}:header`,
      kind: "header",
      work,
      titleHref: hits[0]?.href ?? null
    })
    hits.forEach((hit, index) => {
      rows.push({ key: `${work.key}:hit:${index}`, kind: "hit", work, hit })
    })
    if (work.hasMore) {
      rows.push({
        key: `${work.key}:overflow`, kind: "overflow", work,
        canExpand: (expanded?.highlightLimit ?? 0) < 500,
        shownHits: hits.length,
        continuationHref: hits.at(-1)?.href ?? null
      })
    }
  }
  return rows
})

const totalPages = computed(() => Math.max(1, Math.ceil((results.value?.totalWorks ?? 0) / 30)))
const pagerBasisReady = computed(() => results.value !== null)
const paginationReady = computed(() => {
  const primary = acceptedPrimary.value
  return primary?.identity === primaryIdentity.value && primary.status === 200
    && primary.results !== null
})
const displayedPage = computed(() => Math.min(state.value.page, totalPages.value))
const visibleWorkCount = computed(() => results.value?.works.length ?? 0)
const firstVisibleWork = computed(() => visibleWorkCount.value > 0
  ? (displayedPage.value - 1) * 30 + 1
  : 0)
const lastVisibleWork = computed(() => visibleWorkCount.value > 0
  ? firstVisibleWork.value + visibleWorkCount.value - 1
  : 0)

function pageQuery(page: number) {
  const primary = acceptedPrimary.value
  if (primary?.identity !== primaryIdentity.value || primary.status !== 200
    || !primary.results) return null
  return textSearchPageQuery({ ...rawQuery.value, snapshot: primary.results.snapshot }, page)
}

function replacePage(page: number) {
  const query = pageQuery(page)
  if (!query) return
  const mutableQuery: LocationQueryRaw = {}
  for (const [key, value] of Object.entries(query)) {
    mutableQuery[key] = typeof value === "string" || value == null ? value : [...value]
  }
  void router.replace({ name: route.name as string, query: mutableQuery })
}

watch(
  [displayPrimary, primaryIdentity, totalPages, pagerBasisReady],
  ([candidate, identity, pageCount, basisReady]) => {
    if (import.meta.client && candidate?.identity === identity && candidate.status === 200
      && basisReady && state.value.page > pageCount) {
      replacePage(pageCount)
    }
  },
  { flush: "post" }
)

function goToPage(page: number) {
  const query = pageQuery(page)
  if (query) void navigate(query)
}

const paginationShortcutRoles = new Set([
  "application", "button", "checkbox", "combobox", "grid", "gridcell", "link", "listbox",
  "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio",
  "radiogroup", "scrollbar", "searchbox", "slider", "spinbutton", "switch", "tab", "tablist",
  "textbox", "toolbar", "tree", "treegrid", "treeitem"
])

function paginationShortcutTargetGuarded(target: HTMLElement | null): boolean {
  for (let element = target; element; element = element.parentElement) {
    if (element.matches(
      "a[href], button, summary, input, select, textarea, audio[controls], video[controls], " +
      "[contenteditable]:not([contenteditable='false'])"
    )) return true
    const roles = element.getAttribute("role")?.trim().split(/\s+/u) ?? []
    if (roles.some(role => paginationShortcutRoles.has(role))) return true
    if (element.hasAttribute("tabindex") && element.tabIndex >= 0) return true
  }
  return false
}

function paginationShortcutGuarded(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return true
  }
  const target = event.target instanceof HTMLElement
    ? event.target
    : document.activeElement as HTMLElement | null
  return paginationShortcutTargetGuarded(target)
}

function atHorizontalEnd(root: HTMLElement): boolean {
  return navigator.userAgent.includes("Firefox")
    || root.scrollWidth - root.scrollLeft <= window.innerWidth
}

function handlePaginationKeydown(event: KeyboardEvent) {
  if (paginationShortcutGuarded(event)) return
  const root = document.documentElement
  if (event.key === "ArrowLeft" && root.scrollLeft === 0 && state.value.page > 1) {
    event.preventDefault()
    goToPage(state.value.page - 1)
  } else if (event.key === "ArrowRight" && atHorizontalEnd(root)
    && state.value.page < totalPages.value) {
    event.preventDefault()
    goToPage(state.value.page + 1)
  }
}

const showGotoPageInput = ref(false)
const gotoPageInput = ref("")
const gotoPageElement = ref<HTMLInputElement | null>(null)
function toggleGotoPageInput() {
  if (totalPages.value <= 1) return
  showGotoPageInput.value = !showGotoPageInput.value
  if (!showGotoPageInput.value) return
  gotoPageInput.value = String(state.value.page)
  void nextTick(() => gotoPageElement.value?.focus())
}

function submitGotoPage() {
  const value = gotoPageInput.value.trim()
  if (!/^[1-9]\d*$/.test(value)) return
  const page = Number(value)
  if (!Number.isSafeInteger(page) || page < 1 || page > totalPages.value) return
  showGotoPageInput.value = false
  goToPage(page)
}

watch(routeIdentity, () => {
  showGotoPageInput.value = false
  gotoPageInput.value = ""
}, { flush: "sync" })

const rawGenderSelection = computed(() => {
  const rawGender = rawQuery.value["kön"]
  return typeof rawGender === "string" ? rawGender : rawGender?.[0]
})
const genderSelection = computed(() => (
  rawGenderSelection.value === "all" ? "all" : (state.value.gender ?? "all")
))
const genderChoices = [
  { value: "all", label: "Alla författare" },
  { value: "female", label: "Kvinnliga författare" },
  { value: "male", label: "Manliga författare" }
] as const
const genderLabel = computed(() => (
  genderSelection.value === "all" && rawGenderSelection.value !== "all"
    ? "Filtrera: kvinnliga / manliga / alla"
    : genderChoices.find(option => option.value === genderSelection.value)?.label
      ?? genderChoices[0].label
))
function setGender(value: string) {
  patchFilters({ gender: value === "female" || value === "male" ? value : null })
}

function setFacet(authorId: string | null) {
  patchFilters({ facetAuthorId: authorId })
}

const toolkitMounted = ref(false)
onMounted(() => {
  primaryClientMounted.value = true
  toolkitMounted.value = true
  document.addEventListener("keydown", handlePaginationKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener("keydown", handlePaginationKeydown)
  primaryRequestOwner.cancel()
  primaryAsyncData.clear()
  primaryExecutionIdentity.value = null
  primaryInFlightIdentity.value = null
  cancelNavigatorSnapshot()
  optionsRequestOwner.cancel()
  optionsInFlight.clear()
  cancelTitleOptions()
  cancelAllMore()
})

useSeoMeta({
  title: () => state.value.phrase
    ? `Sök: "${state.value.phrase}" | Litteraturbanken`
    : "Sök | Litteraturbanken",
  description: "Sök i Litteraturbankens verk"
})
useHead({
  htmlAttrs: {
    style: `background: url('${searchBackground}') no-repeat;`
  },
  bodyAttrs: { class: "focus page-search ready" }
})
</script>

<template>
  <div
    data-search-root
    :data-search-mounted="toolkitMounted"
    :class="{
      searching: primaryLoading,
      advanced: state.advanced,
      simple: !state.advanced
    }"
  >
    <h1 class="mt-[0.67em] text-6xl">Sök i texterna</h1>

    <form class="submit_form" @submit.prevent="submitSearch">
      <div class="top_row -mt-2 flex max-w-xl">
        <div class="flex w-full items-stretch">
          <svg
            class="w-6 h-6 relative left-4 self-center top-0 -mt-px"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="#7A1400"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            ref="searchInputElement"
            v-model="queryInput"
            class="-ml-6 mr-2 flex-grow py-3 text-lg pl-12 pr-4 border border-gray-500"
            autofocus
            autocomplete="off"
            autocorrect="off"
            autocapitalize="none"
            spellcheck="false"
            aria-label="Sökfras"
          >
          <button
            v-if="!searchIsPristine"
            type="button"
            class="reset self-center text-gray-700 transition duration-200 w-6 h-6 relative -left-14 top-0 cursor-pointer -mr-6"
            aria-label="Rensa sökningen"
            @click="resetSearch"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="#616161"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <button class="mr-2 bg-white border border-gray-500 w-14 uppercase sc">Sök</button>
          <button
            type="button"
            data-search-advanced
            class="bg-white border border-gray-500 self-stretch w-14 focus:ring-1 focus:ring-inset focus:ring-primary"
            :title="state.advanced ? 'Enkel sökning' : 'Utökad sökning'"
            :aria-expanded="state.advanced"
            aria-controls="text-search-advanced-panel"
            @click="toggleAdvanced"
          >
            <svg
              v-if="!state.advanced"
              class="filter w-6 h-6 relative top-0 inline-block text-gray-700"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25"
              />
            </svg>
            <svg
              v-else
              class="filter w-6 h-6 relative top-0 inline-block text-gray-700"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12"
              />
            </svg>
          </button>
        </div>
        <div class="w-4">
          <i
            v-show="primaryLoading && !optionsFailed"
            class="spinner fa fa-spinner fa-pulse mt-2"
            aria-hidden="true"
          />
        </div>
      </div>

      <ul class="search_opts_widget sc my-[1em] inline-block text-[17px] leading-[1.2]">
        <li
v-for="item in [
          ['default', 'SÖK EFTER ORD ELLER FRAS'],
          ['lemma', 'INKLUDERA BÖJNINGSFORMER'],
          ['modernize', 'INKLUDERA ÄLDRE STAVNINGSFORMER'],
          ['prefix', 'SÖK EFTER ORDBÖRJAN'],
          ['suffix', 'SÖK EFTER ORDSLUT'],
          ['infix', 'SÖK EFTER DEL AV ORD']
        ]" :key="item[0]" class="cursor-pointer hover:text-primary">
          <span
            v-if="selectedMode(item[0]!)"
            role="checkbox"
            aria-checked="true"
            aria-hidden="true"
          >✓</span>{{ " " }}
          <span
            role="button"
            tabindex="0"
            :aria-pressed="selectedMode(item[0]!)"
            @click="setSearchMode(item[0] as never)"
            @keydown.enter.prevent="setSearchMode(item[0] as never)"
            @keydown.space.prevent="setSearchMode(item[0] as never)"
          >
            {{ item[1] }}
          </span>
        </li>
      </ul>

      <div class="chronology text-white ml-px pl-px">
        <i class="fa fa-clock-o mr-1 ml-px" />{{ " " }}
        <span class="sc mt-8">Tidslinje: kronologisk sökning</span>
      </div>
      <div class="flex max-w-3xl pr-2">
        <ChronologyRangeSlider
          data-search-chronology-range
          class="mt-3 slider-large chronology_ranges"
          :min="chronologyFloor"
          :max="chronologyCeiling"
          :from="chronologyFromDraft"
          :to="chronologyToDraft"
          from-label="Från år reglage"
          to-label="Till år reglage"
          @draft="setChronologyDraft"
          @commit="commitChronologyDraft"
          @cancel="cancelChronologyDraft"
        />
        <div class="whitespace-nowrap self-center chronology_inputs">
          <span class="text-sm sc">Tryckår: </span>
          <input
            type="text"
            class="text-sm text-center py-1"
            :value="chronologyFromDraft"
            aria-label="Från år"
            @input="setChronologyDraft('from', ($event.target as HTMLInputElement).value)"
            @change="commitChronologyDraft('from', ($event.target as HTMLInputElement).value)"
          >{{ " " }}
          <span class="text-sm sc">till </span>
          <input
            type="text"
            class="text-sm text-center py-1"
            :value="chronologyToDraft"
            aria-label="Till år"
            @input="setChronologyDraft('to', ($event.target as HTMLInputElement).value)"
            @change="commitChronologyDraft('to', ($event.target as HTMLInputElement).value)"
          >
        </div>
      </div>

      <div v-if="state.advanced" id="text-search-advanced-panel" class="bottom_row">
        <div class="left">
          <div class="auth_select_container">
            <SearchMultiSelect
              class="author_select"
              persistent-input-row
              :model-value="state.authorIds"
              :options="authorChoices"
              placeholder="Författarskap"
              @update:model-value="patchFilters({ authorIds: $event })"
            />
          </div>
          <div class="title_select_container">
            <div
              v-if="titleFilterText
                && titleOptionsOverride?.identity === optionsIdentity
                && titleOptionsOverride.titleFilter === titleFilterText
                && (options?.titleTotal ?? 0) > (options?.titles.length ?? 0)"
              class="title_limit_notice"
            >
              {{ titleFilterText
                ? `Visar de första ${options?.titles.length} matchande titlarna`
                : `Visar de första ${options?.titles.length} titlarna` }}
              <button
                v-if="!titleOptionsExpanded && !titleOptionsFailed"
                type="button"
                @mousedown.prevent
                @click="showAllTitleOptions"
              >
                {{ titleFilterText
                  ? `Visa alla ${options?.titleTotal} matchande titlar`
                  : `Visa alla ${options?.titleTotal} titlar` }}
              </button>
            </div>
            <p v-if="titleOptionsFailed" class="title_options_error" role="alert">
              Fler titlar kunde inte hämtas.
              <button
                type="button"
                @mousedown.prevent
                @click="retryTitleOptions"
              >Försök igen</button>
            </p>
            <SearchMultiSelect
              class="title_select"
              persistent-input-row
              :model-value="state.workIds"
              :options="titleChoices"
              placeholder="Titlar"
              searchable
              :loading="titleLoading"
              @query="queueTitleOptions"
              @update:model-value="patchFilters({ workIds: $event })"
            />
          </div>
          <div class="lang_select_container">
            <SearchMultiSelect
              class="lang_select"
              persistent-input-row
              :model-value="state.languages"
              :options="languageChoices"
              placeholder="Språk …"
              :space-after-remove="false"
              @update:model-value="patchFilters({ languages: $event as TextSearchRouteState['languages'] })"
            />
          </div>
        </div>

        <div class="right">
          <div class="about_select_container">
            <SearchMultiSelect
              class="about_select"
              persistent-input-row
              :model-value="state.aboutAuthorIds"
              :options="aboutAuthorChoices"
              placeholder="Om ett författarskap"
              @update:model-value="patchFilters({ aboutAuthorIds: $event })"
            />
          </div>
          <div class="title_select_container">
            <SearchMultiSelect
              class="keyword_select"
              persistent-input-row
              :model-value="state.categories"
              :options="categoryChoices"
              :option-groups="categoryChoiceGroups"
              placeholder="Filtrera: Kategorier / Utgivare"
              :space-after-remove="false"
              @update:model-value="patchFilters({ categories: $event as TextSearchRouteState['categories'] })"
            />
          </div>
          <div class="mb-1">
            <Listbox :model-value="genderSelection" @update:model-value="setGender">
              <div
                class="gender_select select2 select2-container select2-container--default"
                :data-gender-value="genderSelection"
              >
                <ListboxButton class="select2-selection select2-selection--single">
                  <span class="select2-selection__rendered">
                    <span class="gender_selection_label">{{ genderLabel }}</span>
                  </span>
                  <span class="select2-selection__arrow" aria-hidden="true"><b /></span>
                </ListboxButton>
                <ListboxOptions class="gender_select_options select2-results__options">
                  <ListboxOption
                    v-for="option in genderChoices"
                    :key="option.value"
                    v-slot="{ active, selected }"
                    as="template"
                    :value="option.value"
                  >
                    <li
                      class="select2-results__option"
                      :class="{
                        'select2-results__option--highlighted': active,
                        'select2-results__option--selected': selected
                      }"
                    >{{ option.label }}</li>
                  </ListboxOption>
                </ListboxOptions>
              </div>
            </Listbox>
          </div>
        </div>
      </div>

      <p v-show="false" class="expl advanced_text">
        Avgränsa sökningen efter tryckår. Dra i reglagen nedan för att filtrera sökurvalet till
        ett specifikt tidsspann.
      </p>
    </form>

    <div v-if="optionsFailed" data-search-options-error class="error" role="alert">
      Sökfiltren kan inte hämtas just nu.
      <button type="button" @click="retryOptions">Försök igen</button>
    </div>

    <div
      v-if="displayPrimary?.status === 200"
      id="results"
      class="row results_container"
      :class="{ searching: primaryLoading }"
    >
      <div class="table_viewport">
        <div class="table_container">
          <div v-if="results?.totalWorks === 0">Din sökning gav inga träffar</div>
          <table cellspacing="0" class="results">
            <tbody>
              <tr
                v-for="(row, rowIndex) in resultRows"
                :key="row.key"
                :class="[
                  rowIndex % 2 ? 'odd' : 'even',
                  {
                    sentence: row.kind !== 'header',
                    is_faksimil: row.work.facsimile
                  }
                ]"
              >
              <template v-if="row.kind === 'header'">
                <td class="header" colspan="4">
                  <div class="header_content" :title="row.work.title">
                    <span v-if="row.work.authorName" class="author">{{ row.work.authorName }}</span>{{ " " }}
                    <span class="title">
                      <NuxtLink v-if="row.titleHref" :to="readerHrefWithReturn(row.titleHref)">{{ row.work.title }}</NuxtLink>
                      <template v-else>{{ row.work.title }}</template>
                    </span>
                  </div>
                </td>
              </template>
              <template v-else-if="row.kind === 'hit'">
                <td class="left_context">
                  <span
                    v-for="(word, wordIndex) in row.hit.left"
                    :key="wordIndex"
                    class="word"
                    :class="{ punct: word.punct }"
                  >{{ `${word.text} ` }}</span>
                </td>
                <td class="match w-px whitespace-nowrap">
                  <NuxtLink v-if="row.hit.href" :to="readerHrefWithReturn(row.hit.href)">
                    <span
                      v-for="(word, wordIndex) in row.hit.match"
                      :key="wordIndex"
                      class="word"
                      :class="{ punct: word.punct }"
                    >{{ word.text }}</span>
                  </NuxtLink>
                  <template v-else>
                    <span
                      v-for="(word, wordIndex) in row.hit.match"
                      :key="`match-${wordIndex}`"
                      class="search-hit-word"
                      :class="{ punct: word.punct }"
                    >{{ word.text }}</span>
                    <span class="sr-only">{{ readerTargetUnavailableMessage }}</span>
                  </template>
                </td>
                <td class="right_context">
                  <span
                    v-for="(word, wordIndex) in row.hit.right"
                    :key="wordIndex"
                    class="word"
                    :class="{ punct: word.punct }"
                  >{{ `${word.text} ` }}</span>
                </td>
              </template>
              <template v-else>
                <td />
                <td>
                  <div class="overflow sc">
                    <hr>{{ " " }}
                    <button
                      v-if="row.canExpand"
                      type="button"
                      class="more"
                      :disabled="moreLoadingKeys.has(row.work.key)"
                      @click="showMore(row.work.key)"
                    >Visa fler</button>
                    <template v-else>
                      <span>Visar {{ row.shownHits }} av {{ row.work.occurrenceCount }} träffar i verket.</span>{{ " " }}
                      <NuxtLink
                        v-if="row.continuationHref"
                        :to="readerHrefWithReturn(row.continuationHref)"
                      >Fortsätt i läsaren</NuxtLink>
                    </template>{{ " " }}
                    <hr>
                  </div>
                </td>
              </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div v-else-if="primaryExpired" data-search-error class="error" role="alert">
      Sökresultatet har gått ut. Starta om sökningen för att använda den aktuella textsamlingen.{{ " " }}
      <button class="link-control" type="button" @click="restartExpiredSearch">Starta om sökningen</button>
    </div>
    <div v-else-if="primaryFailed" data-search-error class="error" role="alert">
      Sökresultatet kan inte visas just nu.
    </div>

    <Teleport to="#toolkit" :disabled="!toolkitMounted">
      <div
        v-if="displayPrimary?.status === 200"
        class="littb_pager"
      >
        <div>
          <div class="hits_info">
            <div>
              <div v-show="(results?.totalOccurrences ?? 0) > 0" class="hits">{{ results?.totalOccurrences ?? 0 }}</div>{{ " " }}
              <div class="hits_sub">
                <span v-show="(results?.totalOccurrences ?? 0) > 1">sökträffar</span>
                <span v-show="results?.totalOccurrences === 1">sökträff</span>
              </div>
            </div>
          </div>

          Visar verk {{ firstVisibleWork }}-{{ lastVisibleWork }} av
          {{ results?.totalWorks ?? 0 }}, sida {{ displayedPage }} av
          {{ totalPages }}.

          <ul v-if="(results?.totalWorks ?? 0) > 1" class="ctrl">
            <li class="arrows">
              <button
                type="button"
                class="submit btn navicon left"
                aria-label="Föregående träffsida"
                :disabled="!paginationReady || state.page <= 1"
                @click="goToPage(state.page - 1)"
              >
                <i class="fa fa-angle-left" />
              </button>{{ " " }}
              <button
                type="button"
                class="submit btn navicon"
                aria-label="Nästa träffsida"
                :disabled="!paginationReady || state.page >= totalPages"
                @click="goToPage(state.page + 1)"
              >
                <i class="fa fa-angle-right" />
              </button>
            </li>
            <li>
              <button class="link-control" type="button" :disabled="!paginationReady" @click="goToPage(1)">Gå till första träffen</button>
            </li>
            <li>
              <button class="link-control" type="button" :disabled="!paginationReady" @click="goToPage(totalPages)">Gå till sista träffen</button>
            </li>
            <li
              :class="{ open: showGotoPageInput }"
              :aria-disabled="totalPages === 1"
            >
              <button
                class="link-control"
                type="button"
                :disabled="!paginationReady || totalPages === 1"
                @click="toggleGotoPageInput"
              >Gå till träffsida . . .</button>
              <form v-if="showGotoPageInput" @submit.prevent="submitGotoPage">
                <input
                  ref="gotoPageElement"
                  v-model="gotoPageInput"
                  class="input_page"
                  type="text"
                  inputmode="numeric"
                  aria-label="Träffsida"
                >
                <i class="fa fa-angle-double-right" aria-hidden="true" />
              </form>
            </li>
          </ul>
        </div>
      </div>
      <ul v-if="navigatorFacets.length || state.facetAuthorId" class="navigator">
        <li>
          <button
            class="link-control"
            type="button"
            :class="{ selected: !state.facetAuthorId }"
            :aria-pressed="!state.facetAuthorId"
            @click="setFacet(null)"
          >Visa alla</button>
        </li>
        <li v-for="facet in navigatorFacets" :key="facet.key">
          <button
            class="link-control"
            type="button"
            :class="{ selected: state.facetAuthorId === facet.key }"
            :aria-pressed="state.facetAuthorId === facet.key"
            @click="setFacet(facet.key)"
          >{{ facet.name }}</button>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.chronology_ranges {
  position: relative;
  flex: 1 1 400px;
  width: 400px;
  min-width: 0;
  height: 20px;
  margin-top: 8px !important;
  margin-right: 1.85rem;
  margin-bottom: 3px;
  background: linear-gradient(
    to right,
    rgba(122, 20, 0, 0.15) 0 var(--chronology-from),
    #7a1400 var(--chronology-from) var(--chronology-to),
    rgba(122, 20, 0, 0.15) var(--chronology-to) 100%
  );
  background-position: 10px calc(50% - 2px);
  background-size: calc(100% - 20px) 8px;
  background-repeat: no-repeat;
}

.reset {
  color: #616161;
}

.overflow .more {
  appearance: none;
  padding: 0;
  border: 0;
  background: none;
  color: #333;
  font: inherit;
  text-transform: inherit;
  cursor: pointer;
}

.overflow .more:hover,
.overflow .more:focus {
  color: #7a1400;
}

.overflow .more:disabled {
  color: #333;
  cursor: default;
}

.gender_select {
  width: 350px;
  height: 28px;
  margin-bottom: 5px;
  position: relative;
  display: inline-block;
  vertical-align: middle;
}

.gender_select .select2-selection--single {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 28px;
  padding: 0 0 0 10px;
  border: 1px solid lightgrey;
  border-radius: 0;
  background: white;
  color: #444;
  font-family: "Requiem Text SC A", "Requiem Text SC B";
  font-size: 0.8em;
  text-align: left;
  text-transform: lowercase;
  user-select: none;
}

.gender_select .select2-selection__rendered {
  display: block;
  padding: 0;
  padding-right: 20px;
  overflow: hidden;
  color: #444;
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gender_select .select2-selection__arrow {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 20px;
  height: 26px;
}

.gender_select .select2-selection__arrow b {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  margin-top: -2px;
  margin-left: -4px;
  border-color: #888 transparent transparent;
  border-style: solid;
  border-width: 5px 4px 0;
}

.gender_select_options {
  position: absolute;
  z-index: 1051;
  top: 28px;
  left: 0;
  width: 350px;
  max-height: 350px;
  overflow-y: auto;
  background: white;
  color: #333;
  font-size: 0.8em;
}

.bottom_row {
  margin-top: 2em !important;
  margin-bottom: calc(2em - 34px) !important;
}

.bottom_row > .left {
  margin-right: 79.78125px !important;
}

.littb_pager .ctrl li:not(.arrows) > button {
  display: inline !important;
  width: auto !important;
  height: auto !important;
  margin: 0 !important;
  color: #7a1400;
  white-space: nowrap;
}

.littb_pager .ctrl li:not(.arrows) > button:disabled {
  color: #333;
}

@media (max-width: 767px) {
  .chronology_ranges {
    width: 396px;
    max-width: 396px;
    flex-basis: 396px;
  }

  .bottom_row {
    margin-top: 2em !important;
    margin-bottom: 2em !important;
  }

  .bottom_row > .left {
    margin-right: 57px !important;
  }

  .bottom_row > .left > div:first-child {
    margin-bottom: 20px;
  }

  .bottom_row > .left > div:nth-child(2) {
    margin-bottom: 21px;
  }

  .bottom_row .right > .mb-1 {
    height: 36.78125px;
    margin-bottom: 0;
  }
}
</style>
