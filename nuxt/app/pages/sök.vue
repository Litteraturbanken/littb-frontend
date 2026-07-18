<script setup lang="ts">
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
const primaryKey = computed(() => `text-search-primary:${routeIdentity.value}`)
const queryInput = ref(state.value.phrase ?? "")
watch(() => state.value.phrase, phrase => { queryInput.value = phrase ?? "" })

function wordView(word: { word: string }): SearchWordView {
  return { text: word.word, punct: isTextSearchPunctuation(word.word) }
}

function resultsView(
  response: TextSearchResultsResponse,
  requestedState: TextSearchRouteState
): SearchResultsView {
  let hitIndex = (requestedState.page - 1) * 30
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
    works: response.works.map(work => ({
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
    }))
  }
}

const { data: primaryData, pending: primaryPending } = await useAsyncData<PrimaryEnvelope>(
  primaryKey,
  async () => {
    const requestedState = state.value
    const identity = textSearchRouteIdentity(requestedState)
    if (!requestedState.phrase) return { identity, status: 204, results: null }
    const body = buildTextSearchResultsRequest(requestedState)
    const requestIdentity = textSearchResultsRequestIdentity(body)
    try {
      const result = await client.POST("/text-search/results", { body })
      const accepted = result.response.status === 200
        ? acceptTextSearchResultsResponse(result.data, body, requestIdentity)
        : null
      return accepted
        ? { identity, status: 200, results: resultsView(accepted, requestedState) }
        : { identity, status: 502, results: null }
    } catch {
      return { identity, status: 502, results: null }
    }
  },
  {
    getCachedData: (key, nuxtApp) => {
      const cached = nuxtApp.payload.data[key] as PrimaryEnvelope | undefined
      return cached?.identity === routeIdentity.value ? cached : undefined
    }
  }
)

const acceptedPrimary = shallowRef<PrimaryEnvelope | null>(null)
watch(routeIdentity, () => { acceptedPrimary.value = null }, { flush: "sync" })
watch([primaryData, routeIdentity], ([candidate, identity]) => {
  if (candidate?.identity === identity) acceptedPrimary.value = candidate
}, { immediate: true, flush: "sync" })

if (import.meta.server && acceptedPrimary.value?.status === 502) setResponseStatus(502)

const results = computed(() => acceptedPrimary.value?.status === 200
  ? acceptedPrimary.value.results
  : null)
const primaryFailed = computed(() => acceptedPrimary.value?.status === 502)

const countCache = useState<Record<string, CountView | null>>(
  "text-search-count-cache",
  () => ({})
)
const countStarted = useState<Record<string, boolean>>(
  "text-search-count-started",
  () => ({})
)
let countVersion = 0
let countController: AbortController | null = null

async function loadCount() {
  const requestedState = state.value
  if (!requestedState.phrase) return
  const identity = textSearchRouteIdentity(requestedState)
  if (countStarted.value[identity]) return
  countStarted.value[identity] = true
  const version = ++countVersion
  countController?.abort()
  const controller = new AbortController()
  countController = controller
  const body = buildTextSearchCountRequest(requestedState)
  const requestIdentity = textSearchCountRequestIdentity(body)
  try {
    const result = await client.POST("/text-search/count", { body, signal: controller.signal })
    const accepted = result.response.status === 200
      ? acceptTextSearchCountResponse(result.data, body, requestIdentity)
      : null
    if (version === countVersion && identity === routeIdentity.value && accepted) {
      countCache.value[identity] = {
        documents: accepted.total_documents,
        hits: accepted.total_highlights
      }
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      countCache.value[identity] = null
    }
  }
}

const count = computed(() => countCache.value[routeIdentity.value] ?? null)
void loadCount()

function authorLabel(author: TextSearchOptionsResponse["authors"][number]): string {
  const years = author.birth_year || author.death_year
    ? ` (${author.birth_year ?? ""}-${author.death_year ?? ""})`
    : ""
  return `${author.name_for_index}${years}`
}

function optionsView(response: TextSearchOptionsResponse): OptionsView {
  return {
    titles: response.title_options.map(option => ({
      value: option.work_id,
      label: option.title
    })),
    authors: response.authors.map(author => ({
      value: author.author_id,
      label: authorLabel(author),
      selectionLabel: author.name_for_index.split(",", 1)[0]!
    })),
    aboutAuthors: response.about_authors.map(author => ({
      value: author.author_id,
      label: authorLabel(author),
      selectionLabel: author.name_for_index.split(",", 1)[0]!
    })),
    titleTotal: response.title_total,
    yearFrom: response.year_from ?? null,
    yearTo: response.year_to ?? null
  }
}

const optionsCache = useState<Record<string, OptionsView | null>>(
  "text-search-options-cache",
  () => ({})
)
const optionsStarted = useState<Record<string, boolean>>(
  "text-search-options-started",
  () => ({})
)
let optionsVersion = 0
let optionsController: AbortController | null = null

async function loadOptions() {
  const requestedState = state.value
  const identity = textSearchRouteIdentity(requestedState)
  if (optionsStarted.value[identity]) return
  optionsStarted.value[identity] = true
  const version = ++optionsVersion
  optionsController?.abort()
  const controller = new AbortController()
  optionsController = controller
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
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      optionsCache.value[identity] = null
    }
  }
}

const initialOptions = state.value.advanced ? loadOptions() : Promise.resolve()
await initialOptions
const options = computed(() => optionsCache.value[routeIdentity.value] ?? null)

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
        ...(current ?? optionsView(accepted)),
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

const allAuthorChoices = computed<SearchMultiSelectOption[]>(() => {
  const choices = new Map<string, SearchMultiSelectOption>()
  for (const choice of [...options.value?.authors ?? [], ...options.value?.aboutAuthors ?? []]) {
    choices.set(choice.value, choice)
  }
  for (const facet of results.value?.facets ?? []) {
    if (!choices.has(facet.key)) {
      choices.set(facet.key, {
        value: facet.key,
        label: facet.name,
        selectionLabel: facet.name.split(",", 1)[0]!
      })
    }
  }
  for (const value of [...state.value.authorIds, ...state.value.aboutAuthorIds]) {
    if (!choices.has(value)) choices.set(value, { value, label: value })
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
  return router.push({ path: "/sök", query: mutableQuery })
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
    patchFilters({ prefix: false, suffix: false, infix: false, wordFormOnly: true })
  } else if (mode === "lemma") {
    patchFilters({ prefix: false, suffix: false, infix: false, wordFormOnly: false })
  } else if (mode === "modernize") {
    patchFilters({ includeModernized: !state.value.includeModernized })
  } else if (mode === "infix") {
    patchFilters({ prefix: true, suffix: true, infix: !state.value.infix })
  } else if (mode === "prefix") {
    patchFilters({ prefix: !state.value.prefix, infix: false })
  } else {
    patchFilters({ suffix: !state.value.suffix, infix: false })
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

watch(routeIdentity, () => {
  countController?.abort()
  optionsController?.abort()
  titleController?.abort()
  void loadCount()
  if (state.value.advanced) void loadOptions()
}, { flush: "post" })

const moreHits = shallowRef<Record<string, readonly SearchHitView[]>>({})
let moreVersion = 0
let moreController: AbortController | null = null
const moreLoadingKey = ref<string | null>(null)
async function showMore(workKey: string) {
  const requestedState = state.value
  if (!requestedState.phrase) return
  const identity = textSearchRouteIdentity(requestedState)
  const version = ++moreVersion
  moreController?.abort()
  const controller = new AbortController()
  moreController = controller
  moreLoadingKey.value = workKey
  const body = buildTextSearchResultsRequest(requestedState, 100)
  const requestIdentity = textSearchResultsRequestIdentity(body)
  try {
    const result = await client.POST("/text-search/results", {
      body,
      signal: controller.signal
    })
    const accepted = result.response.status === 200
      ? acceptTextSearchResultsResponse(result.data, body, requestIdentity)
      : null
    if (version === moreVersion && identity === routeIdentity.value && accepted) {
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

const totalPages = computed(() => Math.max(1, Math.ceil((results.value?.totalWorks ?? 0) / 30)))
const firstVisibleWork = computed(() => results.value?.totalWorks
  ? (state.value.page - 1) * 30 + 1
  : 0)
const lastVisibleWork = computed(() => Math.min(
  state.value.page * 30,
  results.value?.totalWorks ?? 0
))

function goToPage(page: number) {
  void navigate(textSearchPageQuery(rawQuery.value, page))
}

function setFacet(authorId: string | null) {
  patchFilters({ facetAuthorId: authorId })
}

const toolkitMounted = ref(false)
onMounted(() => { toolkitMounted.value = true })
onBeforeUnmount(() => {
  countController?.abort()
  optionsController?.abort()
  titleController?.abort()
  moreController?.abort()
  if (titleTimer) clearTimeout(titleTimer)
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
            v-if="state.phrase"
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
              stroke="currentColor"
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
          <i v-if="primaryPending" class="spinner fa fa-spinner fa-pulse mt-2" />
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
          <span v-if="selectedMode(item[0]!)" role="checkbox" aria-checked="true">✓</span>
          <button type="button" role="button" @click="setSearchMode(item[0] as never)">
            {{ item[1] }}
          </button>
        </li>
      </ul>

      <div class="chronology text-white ml-px pl-px">
        <i class="fa fa-clock-o mr-1 ml-px" />
        <span class="sc mt-8">Tidslinje: kronologisk sökning</span>
      </div>
      <div class="flex block max-w-3xl pr-2">
        <div class="rzslider mt-3 slider-large" aria-hidden="true" />
        <div class="whitespace-nowrap self-center chronology_inputs">
          <span class="text-sm sc">Tryckår: </span>
          <input
            type="text"
            class="text-sm text-center py-1"
            :value="state.yearRange?.[0] ?? 1800"
            aria-label="Från år"
            @change="patchFilters({ yearRange: [Number(($event.target as HTMLInputElement).value), state.yearRange?.[1] ?? 1950] })"
          >
          <span class="text-sm sc">till </span>
          <input
            type="text"
            class="text-sm text-center py-1"
            :value="state.yearRange?.[1] ?? 1950"
            aria-label="Till år"
            @change="patchFilters({ yearRange: [state.yearRange?.[0] ?? 1800, Number(($event.target as HTMLInputElement).value)] })"
          >
        </div>
      </div>

      <div v-if="state.advanced" class="bottom_row">
        <div class="left">
          <div class="auth_select_container">
            <SearchMultiSelect
              class="author_select"
              :model-value="state.authorIds"
              :options="allAuthorChoices"
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
              @update:model-value="patchFilters({ languages: $event as TextSearchRouteState['languages'] })"
            />
          </div>
        </div>

        <div class="right">
          <div class="about_select_container">
            <SearchMultiSelect
              class="about_select"
              :model-value="state.aboutAuthorIds"
              :options="allAuthorChoices"
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
              @update:model-value="patchFilters({ categories: $event as TextSearchRouteState['categories'] })"
            />
          </div>
          <div class="mb-1">
            <select
              class="gender_select"
              aria-label="Filtrera: kvinnliga / manliga / alla"
              @change="patchFilters({ gender: (($event.target as HTMLSelectElement).value || null) as TextSearchRouteState['gender'] })"
            >
              <option value="" :selected="state.gender === null" />
              <option value="all">Alla författare</option>
              <option value="female" :selected="state.gender === 'female'">Kvinnliga författare</option>
              <option value="male" :selected="state.gender === 'male'">Manliga författare</option>
            </select>
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
      <div v-if="acceptedPrimary?.status === 200" class="table_viewport">
        <div class="table_container">
          <div v-if="results?.totalWorks === 0">Din sökning gav inga träffar</div>
          <table cellspacing="0" class="results">
            <template v-for="work in results?.works ?? []" :key="work.key">
              <tr>
                <td class="header" colspan="4">
                  <div class="header_content" :title="work.title">
                    <span class="author">{{ work.authorName }}{{ " " }}</span>
                    <span class="title">
                      <a :href="visibleHits(work)[0]?.href">{{ work.title }}</a>
                    </span>
                  </div>
                </td>
              </tr>
              <tr
                v-for="(hit, index) in visibleHits(work)"
                :key="`${work.key}:${index}`"
                class="sentence"
                :class="[
                  index % 2 ? 'odd' : 'even',
                  { is_faksimil: work.facsimile }
                ]"
              >
                <td class="left_context">
                  <span
                    v-for="(word, wordIndex) in hit.left"
                    :key="wordIndex"
                    class="word"
                    :class="{ punct: word.punct }"
                  >{{ word.text }} </span>
                </td>
                <td class="match w-px whitespace-nowrap">
                  <span v-for="(word, wordIndex) in hit.match" :key="wordIndex">
                    <a :href="hit.href" class="word" :class="{ punct: word.punct }">{{ word.text }}</a>
                  </span>
                </td>
                <td class="right_context">
                  <span
                    v-for="(word, wordIndex) in hit.right"
                    :key="wordIndex"
                    class="word"
                    :class="{ punct: word.punct }"
                  > {{ word.text }}</span>
                </td>
              </tr>
              <tr v-if="work.hasMore && !moreHits[work.key]">
                <td />
                <td>
                  <div class="overflow sc">
                    <hr>
                    <button
                      type="button"
                      class="more"
                      :disabled="moreLoadingKey === work.key"
                      @click="showMore(work.key)"
                    >Visa fler</button>
                    <hr>
                  </div>
                </td>
              </tr>
            </template>
          </table>
        </div>
      </div>
      <div v-else-if="primaryFailed" data-search-error class="error">
        Sökresultatet kan inte visas just nu.
      </div>
    </div>

    <Teleport to="#toolkit" :disabled="!toolkitMounted">
      <div v-if="acceptedPrimary?.status === 200" class="littb_pager">
        <div>
          <div class="hits_info">
            <div>
              <div v-if="count" class="hits">{{ count.hits }}</div>
              <div v-if="count" class="hits_sub">
                <span v-if="count.hits !== 1">sökträffar</span>
                <span v-else>sökträff</span>
              </div>
            </div>
          </div>

          Visar verk {{ firstVisibleWork }}-{{ lastVisibleWork }} av
          {{ count?.documents ?? results?.totalWorks ?? 0 }}, sida {{ state.page }} av {{ totalPages }}.

          <ul v-if="(results?.totalWorks ?? 0) > 1" class="ctrl">
            <li class="arrows">
              <button
                type="button"
                rel="next"
                class="submit btn navicon left"
                :disabled="state.page === 1"
                @click="goToPage(state.page - 1)"
              >
                <i class="fa fa-angle-left" />
              </button>
              <button
                type="button"
                rel="prev"
                class="submit btn navicon"
                :disabled="state.page === totalPages"
                @click="goToPage(state.page + 1)"
              >
                <i class="fa fa-angle-right" />
              </button>
            </li>
            <li><button type="button" @click="goToPage(1)">Gå till första träffen</button></li>
            <li><button type="button" @click="goToPage(totalPages)">Gå till sista träffen</button></li>
            <li><span>Gå till träffsida . . .</span></li>
          </ul>
        </div>
      </div>
      <ul v-if="results?.works.length" class="hidden md:block navigator">
        <li>
          <button
            type="button"
            :class="{ selected: !state.facetAuthorId }"
            @click="setFacet(null)"
          >Visa alla</button>
        </li>
        <li v-for="facet in results.facets" :key="facet.key">
          <button
            type="button"
            :class="{ selected: state.facetAuthorId === facet.key }"
            @click="setFacet(facet.key)"
          >{{ facet.name }}</button>
        </li>
      </ul>
    </Teleport>
  </div>
</template>
