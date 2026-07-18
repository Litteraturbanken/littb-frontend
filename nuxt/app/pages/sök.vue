<script setup lang="ts">
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/vue"
import type { LocationQueryRaw } from "vue-router"

import type { SearchMultiSelectOption } from "~/components/search/SearchMultiSelect.vue"
import SearchMultiSelect from "~/components/search/SearchMultiSelect.vue"
import { createLbApiClient } from "~/lib/api/client"
import {
  acceptTextSearchCountResponse,
  acceptTextSearchOptionsResponse,
  acceptTextSearchResultsResponse,
  buildTextSearchCountRequest,
  buildTextSearchOptionsRequest,
  buildTextSearchReaderHref,
  buildTextSearchResultsRequest,
  isTextSearchPunctuation,
  parseTextSearchRouteQuery,
  prepareTextSearchHighlight,
  resetTextSearchQuery,
  textSearchCountRequestIdentity,
  textSearchFilterQuery,
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

type SearchWordView = Readonly<{ text: string, punct: boolean }>
type SearchHitView = Readonly<{
  href: string
  left: readonly SearchWordView[]
  match: readonly SearchWordView[]
  right: readonly SearchWordView[]
}>
type SearchWorkView = Readonly<{
  key: string
  authorName: string
  title: string
  facsimile: boolean
  hasMore: boolean
  hits: readonly SearchHitView[]
}>
type SearchFacetView = Readonly<{ key: string, name: string, count: number }>
type SearchResultsView = Readonly<{
  totalWorks: number
  works: readonly SearchWorkView[]
  facets: readonly SearchFacetView[]
}>
type PrimaryEnvelope = Readonly<{
  identity: string
  status: 200 | 204 | 502
  results: SearchResultsView | null
}>
type CountView = Readonly<{ documents: number, hits: number }>
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

const languageOptions = [
  ["modernized:true", "Moderniserat språk"],
  ["modernized:false", "Ej moderniserat språk"],
  ["translation:true", "Översättning"],
  ["original:true", "På originalspråk"],
  ["language:swe", "Svenska"],
  ["foreign:true", "Främmande språk"],
  ["language:eng", "Engelska"],
  ["language:deu", "Tyska"],
  ["language:fra", "Franska"],
  ["language:lat", "Latin"],
  ["language:smi", "Samiska språk"],
  ["proofread:true", "Korrekturläst"],
  ["proofread:false", "Ej korrekturläst"]
] as const satisfies readonly (readonly [string, string])[]

const categoryOptions = [
  ["texttype:brev;brevsamling", "Brev"],
  ["texttype:drama;dramasamling", "Dramatik"],
  ["texttype:essä;essäsamling", "Essäer"],
  ["texttype:novellsamling;novell", "Noveller"],
  ["texttype:diktsamling;dikt", "Poesi"],
  ["texttype:roman", "Romaner"],
  ["texttype:sakprosa;kringtexter;avhandling;referensverk", "Sakprosa"],
  ["keyword:Barnlitteratur", "Barn- och ungdomslitteratur"],
  ["keyword:Biografika|texttype:brev;brevsamling", "Biografisk litteratur"],
  ["keyword:Finlandssvenskt", "Finlandssvensk litteratur"],
  ["keyword:Flickböcker", "Flickböcker"],
  ["texttype:herdaminne", "Herdaminnen"],
  ["keyword:Humor", "Humoristiska verk"],
  ["texttype:kistebrev", "Kistebrev"],
  ["texttype:kringtext", "Kringtexter"],
  ["texttype:kåseri;kåserisamling", "Kåserier"],
  ["texttype:reseskildring", "Reseskildringar"],
  ["keyword:Rösträtt", "Rösträtt"],
  ["keyword:Sapmi", "Sápmi"],
  ["keyword:Folktryck", "Skillingtryck och folktryck"],
  ["keyword:sentpajorden", "Gunnar Ekelöf. Sent på jorden"],
  ["keyword:OrdenPrövas", "Harry Martinson. Orden prövas"],
  ["keyword:LB-antologi", "Litteraturbankens antologier"],
  ["keyword:1800", "Nya vägar till det förflutna"],
  ["source:bibliotekariesidor", "Bibliotekariesidorna"],
  ["source:diktensmuseum", "Diktens museum"],
  ["keyword:Dramawebben", "Dramawebben"],
  ["source:skolan", "Litteraturbankens skola"],
  ["source:litteraturkartan", "Litteraturkartan"],
  ["source:ljudochbild", "Ljud & Bild"],
  ["source:sol", "Översättarlexikon"],
  ["keyword:SLS-FI", "SLS Finland"],
  ["provenance.library:SVELITT", "SLS Sverige"],
  ["provenance.library:SA", "Svenska Akademien"],
  ["provenance.library:SFS", "Svenska fornskriftssällskapet"],
  ["provenance.library:SVA", "Svenskt visarkiv"],
  ["author_ids:KunglSamfundet", "Kungl. Samfundet för utgivande av handskrifter"],
  ["provenance.library:SVS", "Svenska Vitterhetssamfundet"]
] as const satisfies readonly (readonly [string, string])[]

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const requestFetch = useRequestFetch()
const contextualFetch = requestFetch as unknown as {
  (input: RequestInfo | URL, init?: RequestInit & { ignoreResponseError?: boolean }): Promise<unknown>
  raw?: (
    input: RequestInfo | URL,
    init?: RequestInit & { ignoreResponseError?: boolean }
  ) => Promise<Response & { _data?: unknown }>
}
const generatedClientFetch: typeof globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init)
  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.clone().text()
  const requestOptions = {
    method: request.method,
    headers: request.headers,
    body,
    signal: request.signal
  } satisfies RequestInit
  if (contextualFetch.raw) {
    const raw = await contextualFetch.raw(request.url, {
      ...requestOptions,
      ignoreResponseError: true
    })
    return new Response(JSON.stringify(raw._data), {
      status: raw.status,
      statusText: raw.statusText,
      headers: raw.headers
    })
  }
  try {
    const data = await contextualFetch(request.url, requestOptions)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" }
    })
  } catch (error) {
    const response = (error as {
      response?: Response & { _data?: unknown }
    }).response
    if (!response) throw error
    return new Response(JSON.stringify(response._data), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  }
}
const client = createLbApiClient(
  import.meta.server ? config.apiBase : config.public.apiBase,
  generatedClientFetch
)

const rawQuery = computed(() => route.query as unknown as TextSearchRouteQuery)
const state = computed(() => parseTextSearchRouteQuery(rawQuery.value))
const routeIdentity = computed(() => textSearchRouteIdentity(state.value))
const primaryIdentity = computed(() => state.value.phrase
  ? textSearchResultsRequestIdentity(buildTextSearchResultsRequest(state.value))
  : "empty")
const primaryKey = computed(() => `text-search-primary:${primaryIdentity.value}`)
let primaryController: AbortController | null = null
watch(primaryIdentity, () => { primaryController?.abort() }, { flush: "sync" })
const queryInput = ref(state.value.phrase ?? "")
watch(() => state.value.phrase, phrase => { queryInput.value = phrase ?? "" })

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
    totalWorks: response.total_work_hits,
    facets: response.author_facets.map(facet => ({
      key: facet.author_id,
      name: facet.name_for_index,
      count: facet.count
    })),
    works: response.works.map(work => {
      let hitIndex = 0
      return {
        key: work.lbworkid,
        authorName: facetNames.get(work.author_id) ?? work.author_name,
        title: work.title,
        facsimile: work.mediatype === "faksimil",
        hasMore: work.has_more_highlights,
        hits: work.highlights.map(rawHighlight => {
          const highlight = prepareTextSearchHighlight(rawHighlight)
          const href = buildTextSearchReaderHref(work, highlight, hitIndex, requestedState)
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

const { data: primaryData, pending: primaryPending } = await useAsyncData<PrimaryEnvelope>(
  primaryKey,
  async (_nuxtApp, { signal }) => {
    const requestedState = state.value
    const identity = primaryIdentity.value
    if (!requestedState.phrase) return { identity, status: 204, results: null }
    const body = buildTextSearchResultsRequest(requestedState)
    const requestIdentity = textSearchResultsRequestIdentity(body)
    primaryController?.abort()
    const controller = new AbortController()
    primaryController = controller
    const requestSignal = AbortSignal.any([signal, controller.signal])
    try {
      const result = await client.POST("/text-search/results", { body, signal: requestSignal })
      const accepted = result.response.status === 200
        ? acceptTextSearchResultsResponse(result.data, body, requestIdentity)
        : null
      return accepted
        ? { identity, status: 200, results: resultsView(accepted, requestedState) }
        : { identity, status: 502, results: null }
    } catch {
      if (requestSignal.aborted) {
        throw requestSignal.reason ?? new DOMException("Search request aborted", "AbortError")
      }
      return { identity, status: 502, results: null }
    } finally {
      if (primaryController === controller) primaryController = null
    }
  },
  {
    getCachedData: (key, nuxtApp) => {
      const cached = nuxtApp.payload.data[key] as PrimaryEnvelope | undefined
      return cached?.identity === primaryIdentity.value ? cached : undefined
    }
  }
)

const acceptedPrimary = shallowRef<PrimaryEnvelope | null>(null)
const displayPrimary = shallowRef<PrimaryEnvelope | null>(null)
watch(primaryIdentity, () => { acceptedPrimary.value = null }, { flush: "sync" })
watch([primaryData, primaryIdentity], ([candidate, identity]) => {
  if (candidate?.identity !== identity) return
  acceptedPrimary.value = candidate
  if (candidate.status === 200) displayPrimary.value = candidate
  else displayPrimary.value = null
}, { immediate: true, flush: "sync" })

if (import.meta.server && acceptedPrimary.value?.status === 502) setResponseStatus(502)

const results = computed(() => displayPrimary.value?.status === 200
  ? displayPrimary.value.results
  : null)
const currentPrimaryFacets = computed(() => (
  displayPrimary.value?.identity === primaryIdentity.value
    ? displayPrimary.value.results?.facets ?? []
    : []
))
const primaryFailed = computed(() => acceptedPrimary.value?.status === 502)

const countCache = useState<Record<string, CountView>>(
  "text-search-count-cache",
  () => ({})
)
const countIdentity = computed(() => state.value.phrase
  ? textSearchCountRequestIdentity(buildTextSearchCountRequest(state.value))
  : "empty")
const countInFlight = new Map<string, AbortController>()
let countVersion = 0
let countController: AbortController | null = null

async function loadCount() {
  const requestedState = state.value
  if (!requestedState.phrase) return
  const identity = countIdentity.value
  if (Object.hasOwn(countCache.value, identity) || countInFlight.has(identity)) return
  const version = ++countVersion
  countController?.abort()
  const controller = new AbortController()
  countController = controller
  countInFlight.set(identity, controller)
  const body = buildTextSearchCountRequest(requestedState)
  const requestIdentity = textSearchCountRequestIdentity(body)
  try {
    const result = await client.POST("/text-search/count", { body, signal: controller.signal })
    const accepted = result.response.status === 200
      ? acceptTextSearchCountResponse(result.data, body, requestIdentity)
      : null
    if (version === countVersion && identity === countIdentity.value && accepted) {
      countCache.value[identity] = {
        documents: accepted.total_documents,
        hits: accepted.total_highlights
      }
    }
  } catch {
    // Failed and aborted requests remain retryable on identity re-entry.
  } finally {
    if (countInFlight.get(identity) === controller) countInFlight.delete(identity)
  }
}

const count = computed(() => countCache.value[countIdentity.value] ?? null)
void loadCount()

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
const optionsInFlight = new Map<string, AbortController>()
let optionsVersion = 0
let optionsController: AbortController | null = null

async function loadOptions() {
  const requestedState = state.value
  const identity = textSearchRouteIdentity(requestedState)
  if (optionsCache.value[identity]?.staticComplete || optionsInFlight.has(identity)) return
  const version = ++optionsVersion
  optionsController?.abort()
  const controller = new AbortController()
  optionsController = controller
  optionsInFlight.set(identity, controller)
  const body = buildTextSearchOptionsRequest(requestedState)
  const requestIdentity = textSearchOptionsRequestIdentity(body)
  try {
    const result = await client.POST("/text-search/options", {
      body,
      signal: controller.signal
    })
    const accepted = result.response.status === 200
      ? acceptTextSearchOptionsResponse(result.data, body, requestIdentity)
      : null
    if (version === optionsVersion && identity === routeIdentity.value && accepted) {
      optionsCache.value[identity] = optionsView(accepted)
    }
  } catch {
    // Failed and aborted requests remain retryable on identity re-entry.
  } finally {
    if (optionsInFlight.get(identity) === controller) optionsInFlight.delete(identity)
  }
}

const initialOptions = state.value.advanced ? loadOptions() : Promise.resolve()
await initialOptions
const options = computed(() => optionsCache.value[routeIdentity.value] ?? null)
const lastAcceptedChronologyBounds = shallowRef({
  yearFrom: options.value?.yearFrom ?? 1800,
  yearTo: options.value?.yearTo ?? 1950
})
watch(options, candidate => {
  if (candidate?.yearFrom == null || candidate.yearTo == null) return
  lastAcceptedChronologyBounds.value = {
    yearFrom: candidate.yearFrom,
    yearTo: candidate.yearTo
  }
}, { flush: "sync" })
const chronologyFloor = computed(() => (
  options.value?.yearFrom ?? lastAcceptedChronologyBounds.value.yearFrom
))
const chronologyCeiling = computed(() => (
  options.value?.yearTo ?? lastAcceptedChronologyBounds.value.yearTo
))
const chronologyFromDraft = ref("")
const chronologyToDraft = ref("")
const chronologyDraftDirty = ref(false)
const chronologyRangeStyle = computed(() => {
  const span = chronologyCeiling.value - chronologyFloor.value
  const from = Number(chronologyFromDraft.value)
  const to = Number(chronologyToDraft.value)
  const fromPercent = span > 0 && Number.isFinite(from)
    ? Math.max(0, Math.min(100, (from - chronologyFloor.value) / span * 100))
    : 0
  const toPercent = span > 0 && Number.isFinite(to)
    ? Math.max(0, Math.min(100, (to - chronologyFloor.value) / span * 100))
    : 100
  return {
    "--chronology-from": `${fromPercent}%`,
    "--chronology-to": `${toPercent}%`
  }
})

function syncChronologyDraft() {
  if (chronologyDraftDirty.value) return
  const floor = chronologyFloor.value
  const ceiling = chronologyCeiling.value
  const selected = state.value.yearRange
  const from = selected && selected[0] >= floor && selected[1] <= ceiling
    ? selected[0]
    : floor
  const to = selected && selected[0] >= floor && selected[1] <= ceiling
    ? selected[1]
    : ceiling
  chronologyFromDraft.value = String(from)
  chronologyToDraft.value = String(to)
}

watch([routeIdentity, chronologyFloor, chronologyCeiling], syncChronologyDraft, {
  immediate: true,
  flush: "sync"
})

function setChronologyDraft(endpoint: "from" | "to", value: string) {
  chronologyDraftDirty.value = true
  if (endpoint === "from") chronologyFromDraft.value = value
  else chronologyToDraft.value = value
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
  await navigate(textSearchFilterQuery(rawQuery.value, { yearRange: [from, to] }))
  chronologyDraftDirty.value = false
  syncChronologyDraft()
}

let titleVersion = 0
let titleController: AbortController | null = null
let titleTimer: ReturnType<typeof setTimeout> | null = null
const titleLoading = ref(false)
const titleFilterText = ref("")
async function loadTitleOptions(titleFilter: string, titleLimit: 30 | 500 = 30) {
  const requestedState = state.value
  const identity = textSearchRouteIdentity(requestedState)
  const version = ++titleVersion
  titleController?.abort()
  const controller = new AbortController()
  titleController = controller
  titleLoading.value = true
  const body = buildTextSearchOptionsRequest(requestedState, {
    titleFilter,
    selectedWorkIds: requestedState.workIds,
    titleLimit,
    includeStaticOptions: false
  })
  const requestIdentity = textSearchOptionsRequestIdentity(body)
  try {
    const result = await client.POST("/text-search/options", {
      body,
      signal: controller.signal
    })
    const accepted = result.response.status === 200
      ? acceptTextSearchOptionsResponse(result.data, body, requestIdentity)
      : null
    if (version === titleVersion && identity === routeIdentity.value && accepted) {
      const current = optionsCache.value[identity]
      optionsCache.value[identity] = {
        ...(current ?? optionsView(accepted, false)),
        titles: optionsView(accepted).titles,
        titleTotal: accepted.title_total
      }
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      // A failed typeahead leaves the last accepted choices in place.
    }
  } finally {
    if (version === titleVersion) titleLoading.value = false
  }
}

function queueTitleOptions(titleFilter: string) {
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

function cancelTitleOptions() {
  titleVersion += 1
  if (titleTimer) clearTimeout(titleTimer)
  titleTimer = null
  titleController?.abort()
  titleController = null
  titleLoading.value = false
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
const languageChoices = languageOptions.map(([value, label]) => ({ value, label }))
const categoryChoices = categoryOptions.map(([value, label]) => ({
  value,
  label,
  disabled: value === "texttype:drama;dramasamling"
    || value === "texttype:essä;essäsamling"
}))

function navigate(query: Record<string, string | readonly string[] | null | undefined>) {
  const mutableQuery: LocationQueryRaw = {}
  for (const [key, value] of Object.entries(query)) {
    mutableQuery[key] = typeof value === "string" || value == null ? value : [...value]
  }
  return router.push({ name: route.name as string, query: mutableQuery })
}

function submitSearch() {
  void navigate(textSearchSubmitQuery(rawQuery.value, queryInput.value))
}

function resetSearch() {
  void navigate(resetTextSearchQuery(rawQuery.value))
}

function patchFilters(patch: Parameters<typeof textSearchFilterQuery>[1]) {
  void navigate(textSearchFilterQuery(rawQuery.value, patch))
}

function toggleAdvanced() {
  patchFilters({ advanced: !state.value.advanced })
}

function setSearchMode(mode: "default" | "lemma" | "modernize" | "prefix" | "suffix" | "infix") {
  if (mode === "default") {
    patchFilters({
      prefix: false,
      suffix: false,
      infix: false,
      wordFormOnly: true,
      includeModernized: false
    })
  } else if (mode === "lemma") {
    patchFilters({
      prefix: false,
      suffix: false,
      infix: false,
      wordFormOnly: false,
      includeModernized: false
    })
  } else if (mode === "modernize") {
    patchFilters(state.value.includeModernized
      ? { includeModernized: false }
      : {
          prefix: false,
          suffix: false,
          infix: false,
          wordFormOnly: true,
          includeModernized: true
        })
  } else if (mode === "infix") {
    patchFilters(state.value.infix
      ? { prefix: false, suffix: false, infix: false, wordFormOnly: true }
      : {
          prefix: true,
          suffix: true,
          infix: true,
          wordFormOnly: true,
          includeModernized: false
        })
  } else if (mode === "prefix") {
    patchFilters({
      prefix: state.value.infix ? false : !state.value.prefix,
      suffix: state.value.suffix,
      infix: false,
      wordFormOnly: true,
      includeModernized: false
    })
  } else {
    patchFilters({
      prefix: state.value.prefix,
      suffix: state.value.infix ? false : !state.value.suffix,
      infix: false,
      wordFormOnly: true,
      includeModernized: false
    })
  }
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

watch(routeIdentity, cancelTitleOptions, { flush: "sync" })
watch(countIdentity, () => {
  countVersion += 1
  countController?.abort()
  countInFlight.clear()
  void loadCount()
}, { flush: "post" })
watch(routeIdentity, () => {
  optionsVersion += 1
  optionsController?.abort()
  optionsInFlight.clear()
  if (state.value.advanced) void loadOptions()
}, { flush: "post" })

const moreHits = shallowRef<Record<string, readonly SearchHitView[]>>({})
let moreVersion = 0
let moreController: AbortController | null = null
const moreLoadingKey = ref<string | null>(null)
watch(routeIdentity, () => {
  moreVersion += 1
  moreController?.abort()
  moreController = null
  moreHits.value = {}
  moreLoadingKey.value = null
}, { flush: "sync" })
async function showMore(workKey: string) {
  if (moreLoadingKey.value === workKey) return
  const requestedState = state.value
  if (!requestedState.phrase) return
  const identity = textSearchRouteIdentity(requestedState)
  const version = ++moreVersion
  moreController?.abort()
  const controller = new AbortController()
  moreController = controller
  moreLoadingKey.value = workKey
  const requestState: TextSearchRouteState = {
    ...requestedState,
    page: 1,
    workIds: [workKey]
  }
  const body = buildTextSearchResultsRequest(requestState, 100)
  const requestIdentity = textSearchResultsRequestIdentity(body)
  try {
    const result = await client.POST("/text-search/results", {
      body,
      signal: controller.signal
    })
    const accepted = result.response.status === 200
      ? acceptTextSearchResultsResponse(result.data, body, requestIdentity)
      : null
    if (version === moreVersion && identity === routeIdentity.value && accepted
      && accepted.works.length === 1 && accepted.works[0]?.lbworkid === workKey) {
      const expanded = resultsView(accepted, requestedState).works.find(work => work.key === workKey)
      if (expanded) moreHits.value = { ...moreHits.value, [workKey]: expanded.hits }
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      // Keep the accepted primary rows when expansion fails.
    }
  } finally {
    if (version === moreVersion) moreLoadingKey.value = null
  }
}

function visibleHits(work: SearchWorkView): readonly SearchHitView[] {
  return moreHits.value[work.key] ?? work.hits
}

type ResultRowView = Readonly<
  | { key: string, kind: "header", work: SearchWorkView }
  | { key: string, kind: "hit", work: SearchWorkView, hit: SearchHitView }
  | { key: string, kind: "overflow", work: SearchWorkView }
>
const resultRows = computed<readonly ResultRowView[]>(() => {
  const rows: ResultRowView[] = []
  for (const work of results.value?.works ?? []) {
    rows.push({ key: `${work.key}:header`, kind: "header", work })
    visibleHits(work).forEach((hit, index) => {
      rows.push({ key: `${work.key}:hit:${index}`, kind: "hit", work, hit })
    })
    if (work.hasMore && !moreHits.value[work.key]) {
      rows.push({ key: `${work.key}:overflow`, kind: "overflow", work })
    }
  }
  return rows
})

const totalPages = computed(() => Math.max(1, Math.ceil((results.value?.totalWorks ?? 0) / 30)))
const displayedTotalPages = computed(() => Math.ceil((results.value?.totalWorks ?? 0) / 30))
const firstVisibleWork = computed(() => (state.value.page - 1) * 30 + 1)
const lastVisibleWork = computed(() => results.value?.totalWorks
  ? Math.min(state.value.page * 30, results.value.totalWorks)
  : "")

function goToPage(page: number) {
  void navigate(textSearchPageQuery(rawQuery.value, page))
}

function handlePaginationKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return
  }
  const target = event.target instanceof HTMLElement
    ? event.target
    : document.activeElement as HTMLElement | null
  if (target?.closest("input, select, textarea, [contenteditable]:not([contenteditable='false'])")) {
    return
  }
  const root = document.documentElement
  if (event.key === "ArrowLeft" && root.scrollLeft === 0 && state.value.page > 1) {
    event.preventDefault()
    goToPage(state.value.page - 1)
  } else if (event.key === "ArrowRight"
    && (navigator.userAgent.includes("Firefox")
      || root.scrollWidth - root.scrollLeft <= window.innerWidth)
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

const genderSelection = computed(() => {
  const rawGender = rawQuery.value["kön"]
  const firstGender = typeof rawGender === "string" ? rawGender : rawGender?.[0]
  return firstGender === "all" ? "all" : (state.value.gender ?? "")
})
const genderChoices = [
  { value: "", label: "Filtrera: kvinnliga / manliga / alla" },
  { value: "all", label: "Alla författare" },
  { value: "female", label: "Kvinnliga författare" },
  { value: "male", label: "Manliga författare" }
] as const
const genderLabel = computed(() => genderChoices.find(
  option => option.value === genderSelection.value
)?.label ?? genderChoices[0].label)
function setGender(value: string) {
  patchFilters({ gender: value === "female" || value === "male" ? value : null })
}

function setFacet(authorId: string | null) {
  patchFilters({ facetAuthorId: authorId })
}

const toolkitMounted = ref(false)
onMounted(() => {
  toolkitMounted.value = true
  document.addEventListener("keydown", handlePaginationKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener("keydown", handlePaginationKeydown)
  primaryController?.abort()
  countVersion += 1
  countController?.abort()
  countInFlight.clear()
  optionsVersion += 1
  optionsController?.abort()
  optionsInFlight.clear()
  cancelTitleOptions()
  moreVersion += 1
  moreController?.abort()
})

useSeoMeta({
  title: () => state.value.phrase
    ? `Sök: "${state.value.phrase}" | Litteraturbanken`
    : "Sök | Litteraturbanken",
  description: "Sök i Litteraturbankens verk"
})
useHead({
  htmlAttrs: {
    style: "background: url('/red/bilder/bakgrundsbilder/sok_bkg.jpg') no-repeat;"
  },
  bodyAttrs: { class: "focus page-search ready" }
})
</script>

<template>
  <div
    data-search-root
    :data-search-mounted="toolkitMounted"
    :class="{
      searching: primaryPending,
      advanced: state.advanced,
      simple: !state.advanced
    }"
  >
    <h1 class="text-6xl">Sök i texterna</h1>

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
          <i class="spinner fa fa-spinner fa-pulse mt-2" />
        </div>
      </div>

      <ul class="search_opts_widget inline-block">
        <li v-for="item in [
          ['default', 'SÖK EFTER ORD ELLER FRAS'],
          ['lemma', 'INKLUDERA BÖJNINGSFORMER'],
          ['modernize', 'INKLUDERA ÄLDRE STAVNINGSFORMER'],
          ['prefix', 'SÖK EFTER ORDBÖRJAN'],
          ['suffix', 'SÖK EFTER ORDSLUT'],
          ['infix', 'SÖK EFTER DEL AV ORD']
        ]" :key="item[0]" class="hover:text-primary">
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
      <div class="flex block max-w-3xl pr-2">
        <div
          class="rzslider mt-3 slider-large chronology_ranges"
          :style="chronologyRangeStyle"
        >
          <input
            type="range"
            :min="chronologyFloor"
            :max="chronologyCeiling"
            step="1"
            :value="chronologyFromDraft"
            aria-label="Från år reglage"
            @input="setChronologyDraft('from', ($event.target as HTMLInputElement).value)"
            @change="commitChronologyDraft('from', ($event.target as HTMLInputElement).value)"
          >
          <input
            type="range"
            :min="chronologyFloor"
            :max="chronologyCeiling"
            step="1"
            :value="chronologyToDraft"
            aria-label="Till år reglage"
            @input="setChronologyDraft('to', ($event.target as HTMLInputElement).value)"
            @change="commitChronologyDraft('to', ($event.target as HTMLInputElement).value)"
          >
        </div>
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

      <div v-if="state.advanced" class="bottom_row">
        <div class="left">
          <div class="auth_select_container">
            <SearchMultiSelect
              class="author_select"
              :model-value="state.authorIds"
              :options="authorChoices"
              placeholder="Författarskap"
              @update:model-value="patchFilters({ authorIds: $event })"
            />
          </div>
          <div class="title_select_container">
            <div v-if="(options?.titleTotal ?? 0) > 30" class="title_limit_notice">
              {{ titleFilterText
                ? "Visar de första 30 matchande titlarna"
                : "Visar de första 30 titlarna" }}
              <button type="button" @click="showAllTitleOptions">
                {{ titleFilterText
                  ? `Visa alla ${options?.titleTotal} matchande titlar`
                  : `Visa alla ${options?.titleTotal} titlar` }}
              </button>
            </div>
            <SearchMultiSelect
              class="title_select"
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
              :model-value="state.aboutAuthorIds"
              :options="aboutAuthorChoices"
              placeholder="Om ett författarskap"
              @update:model-value="patchFilters({ aboutAuthorIds: $event })"
            />
          </div>
          <div class="title_select_container">
            <SearchMultiSelect
              class="keyword_select"
              :model-value="state.categories"
              :options="categoryChoices"
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
                    <span
                      class="gender_selection_label"
                      :class="{ 'select2-selection__placeholder': !genderSelection }"
                    >{{ genderLabel }}</span>
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

    <div
      id="results"
      class="row results_container"
      :class="{ searching: primaryPending }"
    >
      <div v-if="displayPrimary?.status === 200" class="table_viewport">
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
                    <span class="author">{{ row.work.authorName }}</span>{{ " " }}
                    <span class="title">
                      <a :href="visibleHits(row.work)[0]?.href">{{ row.work.title }}</a>
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
                  <span v-for="(word, wordIndex) in row.hit.match" :key="wordIndex">
                    <a :href="row.hit.href" class="word" :class="{ punct: word.punct }">{{ word.text }}</a>
                  </span>
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
                    <a
                      role="button"
                      tabindex="0"
                      class="more"
                      :aria-disabled="moreLoadingKey === row.work.key"
                      @click="showMore(row.work.key)"
                      @keydown.enter.prevent="showMore(row.work.key)"
                      @keydown.space.prevent="showMore(row.work.key)"
                    >Visa fler</a>{{ " " }}
                    <hr>
                  </div>
                </td>
              </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else-if="primaryFailed" data-search-error class="error">
        Sökresultatet kan inte visas just nu.
      </div>
    </div>

    <Teleport to="#toolkit" :disabled="!toolkitMounted">
      <div
        v-if="displayPrimary?.status === 200"
        class="littb_pager"
      >
        <div>
          <div class="hits_info">
            <div>
              <div v-show="(count?.hits ?? 0) > 0" class="hits">{{ count?.hits ?? 0 }}</div>{{ " " }}
              <div class="hits_sub">
                <span v-show="(count?.hits ?? 0) > 1">sökträffar</span>
                <span v-show="count?.hits === 1">sökträff</span>
              </div>
            </div>
          </div>

          Visar verk {{ firstVisibleWork }}-{{ lastVisibleWork }} av
          {{ count?.documents ?? results?.totalWorks ?? 0 }}, sida {{ state.page }} av
          {{ displayedTotalPages }}.

          <ul v-if="(results?.totalWorks ?? 0) > 1" class="ctrl">
            <li class="arrows">
              <button
                type="button"
                rel="next"
                class="submit btn navicon left"
                aria-label="Föregående träffsida"
                :disabled="state.page === 1"
                @click="goToPage(state.page - 1)"
              >
                <i class="fa fa-angle-left" />
              </button>{{ " " }}
              <button
                type="button"
                rel="prev"
                class="submit btn navicon"
                aria-label="Nästa träffsida"
                :disabled="state.page === totalPages"
                @click="goToPage(state.page + 1)"
              >
                <i class="fa fa-angle-right" />
              </button>
            </li>
            <li>
              <a role="button" tabindex="0" @click="goToPage(1)" @keydown.enter.prevent="goToPage(1)" @keydown.space.prevent="goToPage(1)">Gå till första träffen</a>
            </li>
            <li>
              <a role="button" tabindex="0" @click="goToPage(totalPages)" @keydown.enter.prevent="goToPage(totalPages)" @keydown.space.prevent="goToPage(totalPages)">Gå till sista träffen</a>
            </li>
            <li
              :class="{ open: showGotoPageInput }"
              :aria-disabled="totalPages === 1"
            >
              <a
                role="button"
                tabindex="0"
                :aria-disabled="totalPages === 1"
                @click="toggleGotoPageInput"
                @keydown.enter.prevent="toggleGotoPageInput"
                @keydown.space.prevent="toggleGotoPageInput"
              >Gå till träffsida . . .</a>
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
      <ul v-if="results?.works.length" class="hidden md:block navigator">
        <li>
          <a
            role="button"
            tabindex="0"
            :class="{ selected: !state.facetAuthorId }"
            @click="setFacet(null)"
            @keydown.enter.prevent="setFacet(null)"
            @keydown.space.prevent="setFacet(null)"
          >Visa alla</a>
        </li>
        <li v-for="facet in results.facets" :key="facet.key">
          <a
            role="button"
            tabindex="0"
            :class="{ selected: state.facetAuthorId === facet.key }"
            @click="setFacet(facet.key)"
            @keydown.enter.prevent="setFacet(facet.key)"
            @keydown.space.prevent="setFacet(facet.key)"
          >{{ facet.name }}</a>
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

.chronology_ranges input[type="range"] {
  appearance: none;
  position: absolute;
  top: -2px;
  left: 0;
  width: 100%;
  height: 20px;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  pointer-events: none;
}

.reset {
  color: #616161;
}

.chronology_ranges input[type="range"]::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 4px;
  background: transparent;
}

.chronology_ranges input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: -6px;
  border: 1px solid darkgrey;
  border-radius: 50%;
  background: white;
  box-shadow: 1px 1px 3px grey;
  pointer-events: auto;
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
  border: 0;
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

.gender_select .select2-selection__placeholder {
  color: #999;
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

.littb_pager .ctrl a[aria-disabled="true"] {
  color: grey !important;
  cursor: default;
}

.navigator button {
  display: inline;
  color: #333;
  white-space: nowrap;
}

.navigator button.selected {
  color: #7a1400;
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
