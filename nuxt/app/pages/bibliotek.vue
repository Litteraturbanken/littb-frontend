<script setup lang="ts">
import type { LocationQuery, RouteLocationRaw } from "vue-router"
import { useLbApiClient } from "~/composables/useLbApiClient"
import { legacyPaginationItems, type LegacyPaginationItem } from "~/lib/legacy-pagination"
import type {
    LibraryAboutAuthorOption,
    LibraryAdvancedChange,
    LibraryAdvancedControlsModel,
    LibraryImprintYearTarget,
    LibraryBrowseMode,
    LibraryModeTab,
    LibraryNativeSortOption,
    LibraryPaginationEntry,
    LibraryPaginationModel,
    LibrarySortOption,
    LibrarySourceDownloadWorkspaceApi
} from "~/lib/library/component-models"
import {
    buildLibraryCountRequest,
    buildLibrarySearchRequest,
    type LibraryCountMode,
    type LibraryCountResponse,
    type LibraryFilterState,
    type LibraryOptionsResponse,
    type LibrarySearchState
} from "~/lib/library"
import {
    createLibraryFilterOptions,
    type LibraryCategory,
    type LibraryLanguage,
    type LibraryMedia
} from "~/lib/library/filter-options"
import {
    authorSortKey,
    epubSortKey,
    libraryPageMaximum,
    partSortKey,
    relevanceSortKey,
    type AuthorSortKey,
    type BrowseSortKey,
    type EpubSortKey,
    type LatestSortKey,
    type LibraryMode,
    type PartSortKey,
    type RelevanceSortKey
} from "~/lib/library/navigation"
import { canonicalLibraryResultPage } from "~/lib/library/result-pagination"
import {
    libraryQueryValue as queryValue,
    libraryRequestState as requestState,
    libraryStateKey as stateKey,
    orderedLibraryValues,
    parseLibraryPageRouteState,
    parseLibraryYearRange,
    type ImprintBounds,
    type LibraryAdvancedFilters,
    type LibraryRequestState as QueryState,
    type LibraryRouteState
} from "~/lib/library/route-state"
import {
    assignLibraryPageResult,
    type AuthorBrowseResponse,
    type BrowseResponse,
    type EpubResponse,
    type LatestResponse,
    type LibraryPageResultHandlers,
    type LibraryPageState,
    type LibraryResponse,
    type PdfResponse
} from "~/lib/library/page-results"
import { toLibrarySearchView, type BrowseResult } from "~/lib/library/view-model"

definePageMeta({ alias: ["/epub"] })

type LibraryGender = LibraryAdvancedFilters["gender"]

const {
    collectionSelectGroups,
    collectionSelectOptions,
    collectionValues,
    languageSelectOptions,
    languageValues,
    mediaSelectOptions,
    mediaValues
} = createLibraryFilterOptions()

type LibrarySummary = {
    identity: string
    authors: number | null
    works: number | null
    parts: number | null
    epub: number | null
    pdf: number | null
}

type LibraryInitialData = {
    page: LibraryPageState
    summary: LibrarySummary | null
}

function emptyLibraryResponse(failed = false): LibraryResponse {
    return { data: [], hits: 0, suggest: [], failed }
}

function emptyEpubResponse(failed = false): EpubResponse {
    return { data: [], hits: 0, distinctHits: 0, suggest: [], failed }
}

function emptyBrowseResponse(failed = false): BrowseResponse {
    return { data: [], hits: 0, distinctHits: 0, suggest: [], failed, authorIds: [] }
}

function emptyLatestResponse(failed = false): LatestResponse {
    return { groups: [], hits: 0, distinctHits: 0, suggest: [], failed }
}

function emptyPdfResponse(failed = false): PdfResponse {
    return { data: [], hits: 0, distinctHits: 0, suggest: [], failed }
}

const backgroundPath = "/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg"
const description = "Blädda bland Litteraturbankens författare och titlar."

const sorts: Array<{ key: RelevanceSortKey; label: string }> = [
    { key: "relevans", label: "Relevans" },
    { key: "forfattare", label: "Författare" },
    { key: "titlar", label: "Titel" },
    { key: "kronologi", label: "Tryckår" }
]

const epubSorts: Array<{ key: EpubSortKey; label: string }> = [
    { key: "forfattare", label: "Författare" },
    { key: "titlar", label: "Titel" },
    { key: "popularitet", label: "Populärt" },
    { key: "kronologi", label: "Tryckår" }
]
const authorSorts: Array<{ key: AuthorSortKey; label: string }> = [
    { key: "namn", label: "Namn" },
    { key: "popularitet", label: "Populärt" },
    { key: "kronologi", label: "Årtal" }
]
const partSorts: Array<{ key: PartSortKey; label: string }> = [
    { key: "forfattare", label: "Författare" },
    { key: "titlar", label: "Titel" }
]

const route = useRoute()
const router = useRouter()
const { rememberLibraryHref } = useLibraryNavigation()

watch(
    () => route.fullPath,
    () => {
        if (!import.meta.client) return
        rememberLibraryHref(route.fullPath)
    },
    { immediate: true }
)

function queryYearRange(value: unknown): [number, number] | null {
    return parseLibraryYearRange(value, chronologyBounds.value)
}

function routeState(path: string, query: LocationQuery): LibraryRouteState {
    return parseLibraryPageRouteState(path, query, {
        chronologyBounds: chronologyBounds.value,
        collectionValues,
        aboutAuthorIds: aboutAuthorIdSet.value,
        mediaValues,
        languageValues
    })
}

function emptyAuthorBrowseResponse(failed = false): AuthorBrowseResponse {
    return {
        ...emptyLibraryResponse(failed),
        workCount: 0,
        partCount: 0,
        workAuthorIds: [],
        partAuthorIds: []
    }
}

function libraryFilterState(query: string, advanced: LibraryAdvancedFilters): LibraryFilterState {
    return {
        query,
        gender: advanced.gender || null,
        categories: [...advanced.keywords],
        narrowingCategories: [...advanced.narrowingKeywords],
        aboutAuthorIds: [...advanced.aboutAuthorIds],
        media: [...advanced.media],
        languages: [...advanced.languages],
        yearRange: advanced.yearRange
    }
}

type LibraryPrimaryState = Pick<
    LibraryRouteState,
    "mode" | "filter" | "sort" | "page" | "hide1800" | "downloadMode" | "advancedFilters"
>

function librarySearchState(
    state: LibraryPrimaryState,
    reverse: boolean,
    authorLimit = 150
): LibrarySearchState {
    const common = {
        filters: libraryFilterState(state.filter, state.advancedFilters),
        reverse
    }
    switch (state.mode) {
        case "all":
            return {
                ...common,
                mode: state.mode,
                sort: relevanceSortKey(state.sort),
                page: state.page
            }
        case "authors":
            return {
                ...common,
                mode: state.mode,
                sort: authorSortKey(state.sort),
                limit: authorLimit
            }
        case "works":
            return {
                ...common,
                mode: state.mode,
                sort: epubSortKey(state.sort),
                page: state.page,
                sourceOnly: state.downloadMode
            }
        case "parts":
            return {
                ...common,
                mode: state.mode,
                sort: partSortKey(state.sort),
                page: state.page
            }
        case "latest":
            return {
                ...common,
                mode: state.mode,
                page: state.page,
                hide1800: state.hide1800
            }
        case "epub":
        case "pdf":
            return {
                ...common,
                mode: state.mode,
                sort: epubSortKey(state.sort),
                page: state.page
            }
    }
}

function emptyPageData(mode: LibraryMode, failed = false): LibraryPageState {
    switch (mode) {
        case "all":
            return { mode, response: emptyLibraryResponse(failed) }
        case "authors":
            return { mode, response: emptyAuthorBrowseResponse(failed) }
        case "works":
            return { mode, response: emptyBrowseResponse(failed) }
        case "parts":
            return { mode, response: emptyBrowseResponse(failed) }
        case "latest":
            return { mode, response: emptyLatestResponse(failed) }
        case "epub":
            return { mode, response: emptyEpubResponse(failed) }
        case "pdf":
            return { mode, response: emptyPdfResponse(failed) }
    }
}

const libraryClient = useLbApiClient()

async function fetchLibraryCount(
    mode: LibraryCountMode,
    filterValue: string,
    advanced: LibraryAdvancedFilters,
    signal?: AbortSignal
): Promise<LibraryCountResponse | null> {
    try {
        const body = buildLibraryCountRequest(mode, libraryFilterState(filterValue, advanced))
        const { data } = await libraryClient.POST("/library/counts", { body, signal })
        return data?.mode === mode ? data : null
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error
        return null
    }
}

async function fetchLibraryPageData(
    state: LibraryPrimaryState,
    signal?: AbortSignal,
    reverse = false,
    authorLimit = 150
): Promise<LibraryPageState> {
    try {
        const body = buildLibrarySearchRequest(librarySearchState(state, reverse, authorLimit))
        const { data } = await libraryClient.POST("/library/search", { body, signal })
        if (!data || data.mode !== state.mode) return emptyPageData(state.mode, true)
        return toLibrarySearchView(data)
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error
        return emptyPageData(state.mode, true)
    }
}

function librarySummaryIdentity(filterValue: string, advanced: LibraryAdvancedFilters): string {
    return JSON.stringify([filterValue, advanced])
}

function emptyLibrarySummary(
    filterValue: string,
    advanced: LibraryAdvancedFilters
): LibrarySummary {
    return {
        identity: librarySummaryIdentity(filterValue, advanced),
        authors: null,
        works: null,
        parts: null,
        epub: null,
        pdf: null
    }
}

async function fetchLibrarySummary(
    filterValue: string,
    advanced: LibraryAdvancedFilters,
    signal?: AbortSignal
): Promise<LibrarySummary> {
    const authorState: LibraryPrimaryState = {
        mode: "authors",
        filter: filterValue,
        sort: "popularitet",
        page: 1,
        hide1800: false,
        downloadMode: false,
        advancedFilters: advanced
    }
    const [authors, works, parts, epub, pdf] = await Promise.all([
        fetchLibraryPageData(authorState, signal).catch(() => null),
        fetchLibraryCount("works", filterValue, advanced, signal).catch(() => null),
        fetchLibraryCount("parts", filterValue, advanced, signal).catch(() => null),
        fetchLibraryCount("epub", filterValue, advanced, signal).catch(() => null),
        fetchLibraryCount("pdf", filterValue, advanced, signal).catch(() => null)
    ])
    return {
        identity: librarySummaryIdentity(filterValue, advanced),
        authors:
            authors?.mode === "authors" && !authors.response.failed ? authors.response.hits : null,
        works: works?.mode === "works" ? works.total : null,
        parts: parts?.mode === "parts" ? parts.total : null,
        epub: epub?.mode === "epub" ? epub.total : null,
        pdf: pdf?.mode === "pdf" ? pdf.total : null
    }
}

async function fetchLibraryOptions(signal?: AbortSignal): Promise<LibraryOptionsResponse> {
    try {
        const { data } = await libraryClient.GET("/library/options", { signal })
        return data ?? { chronology: null, about_authors: null }
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error
        return { chronology: null, about_authors: null }
    }
}

const optionsAsyncData = useAsyncData<LibraryOptionsResponse>(
    `library:options:${route.path}`,
    (_nuxtApp, { signal }) => fetchLibraryOptions(signal),
    {
        default: () => ({ chronology: null, about_authors: null }),
        immediate: import.meta.server,
        getCachedData: (key, app) => app.isHydrating
            ? app.payload.data[key] as LibraryOptionsResponse | undefined
            : undefined
    }
)
if (import.meta.server) await optionsAsyncData
const { data: libraryOptionsData } = optionsAsyncData
const chronologyBounds = computed<ImprintBounds | null>(() => {
    const chronology = libraryOptionsData.value?.chronology
    return chronology ? { from: chronology.year_from, to: chronology.year_to } : null
})
const aboutAuthorOptionsAvailable = computed(
    () => Array.isArray(libraryOptionsData.value?.about_authors)
)
const aboutAuthorOptions = computed<LibraryAboutAuthorOption[]>(() =>
    (libraryOptionsData.value?.about_authors ?? [])
        .map(author => ({ id: author.author_id, label: author.label }))
        .sort((left, right) => left.label.localeCompare(right.label, "sv"))
)
const aboutAuthorIdSet = computed<ReadonlySet<string>>(
    () => new Set(aboutAuthorOptions.value.map(option => option.id))
)

function browseSortForState(state: LibraryRouteState): BrowseSortKey {
    if (state.mode === "authors") return authorSortKey(state.sort)
    if (state.mode === "parts") return partSortKey(state.sort)
    if (state.mode === "works") return epubSortKey(state.sort)
    return "popularitet"
}

const initialState = Object.freeze(routeState(route.path, route.query))
const standalone = initialState.standalone
const mode = initialState.mode
const initialFilter = initialState.filter
const initialSort =
    initialState.mode === "all" ? (initialState.sort as RelevanceSortKey) : "relevans"
const initialEpubSort =
    initialState.mode === "epub" || initialState.mode === "pdf"
        ? (initialState.sort as EpubSortKey)
        : "popularitet"
const initialBrowseSort = browseSortForState(initialState)
async function fetchInitialData(signal?: AbortSignal): Promise<LibraryInitialData> {
    const pagePromise = fetchLibraryPageData(initialState, signal)
    const summaryPromise =
        initialState.standalone || initialState.downloadMode
            ? Promise.resolve(null)
            : fetchLibrarySummary(initialState.filter, initialState.advancedFilters, signal)
    const [page, summary] = await Promise.all([pagePromise, summaryPromise])
    return { page, summary }
}

function emptyInitialData(): LibraryInitialData {
    return { page: emptyPageData(initialState.mode), summary: null }
}

const initialAsyncData = useAsyncData<LibraryInitialData>(
    `library:${route.path}:${mode}:${initialFilter}:${initialState.sort}:${initialState.page}:${initialState.hide1800}:${initialState.downloadMode}:${JSON.stringify(initialState.advancedFilters)}`,
    (_nuxtApp, { signal }) => fetchInitialData(signal),
    {
        default: emptyInitialData,
        immediate: import.meta.server,
        getCachedData: (key, app) => app.isHydrating
            ? app.payload.data[key] as LibraryInitialData | undefined
            : undefined
    }
)
if (import.meta.server) await initialAsyncData
const { data: initialData } = initialAsyncData
const initialDataWasLoaded = initialAsyncData.status.value === "success"
const initialPageData = initialData.value?.page ?? emptyPageData(initialState.mode)

function canonicalAllResultPage(
    state: QueryState,
    pageData: LibraryPageState
): number | null {
    if (pageData.mode !== "all" || pageData.response.failed) return null
    return canonicalLibraryResultPage(state.page, pageData.response.hits)
}

function hasCanonicalPageQuery(page: number): boolean {
    return page > 1
        ? route.query.sida === String(page)
        : route.query.sida === undefined
}

const initialCanonicalPage = canonicalAllResultPage(requestState(initialState), initialPageData)
if (
    import.meta.server
    && initialCanonicalPage !== null
    && (
        initialCanonicalPage !== initialState.page
        || !hasCanonicalPageQuery(initialCanonicalPage)
    )
) {
    await navigateTo({
        path: route.path,
        query: queryFor({ ...requestState(initialState), page: initialCanonicalPage })
    }, { redirectCode: 307, replace: true })
}

const filter = ref(initialFilter)
const selectedSort = ref(initialSort)
const selectedEpubSort = ref(initialEpubSort)
const selectedBrowseSort = ref<BrowseSortKey>(initialBrowseSort)
const reversedSorts = ref<Record<string, boolean>>({})
const currentMode = ref(initialState.mode)
const currentPage = ref(initialState.page)
const hide1800 = ref(initialState.hide1800)
const downloadMode = ref(initialState.downloadMode)
const sourceDownloadWorkspace = ref<LibrarySourceDownloadWorkspaceApi | null>(null)
const allVisibleSourceWorksSelected = computed(
    () => sourceDownloadWorkspace.value?.allVisibleSourceWorksSelected ?? false
)

function selectVisibleSourceWorks() {
    sourceDownloadWorkspace.value?.selectVisibleSourceWorks()
}

function deselectVisibleSourceWorks() {
    sourceDownloadWorkspace.value?.deselectVisibleSourceWorks()
}
const advancedOpen = ref(initialState.advanced)
const selectedGender = ref<LibraryGender>(initialState.advancedFilters.gender)
const selectedKeywords = ref<LibraryCategory[]>([...initialState.advancedFilters.keywords])
const selectedNarrowingKeywords = ref<LibraryCategory[]>([
    ...initialState.advancedFilters.narrowingKeywords
])
const selectedAboutAuthorIds = ref<string[]>([...initialState.advancedFilters.aboutAuthorIds])
const selectedMedia = ref<LibraryMedia[]>([...initialState.advancedFilters.media])
const selectedLanguages = ref<LibraryLanguage[]>([...initialState.advancedFilters.languages])
const chronologyFromDraft = ref(
    String(initialState.advancedFilters.yearRange?.[0] ?? chronologyBounds.value?.from ?? "")
)
const chronologyToDraft = ref(
    String(initialState.advancedFilters.yearRange?.[1] ?? chronologyBounds.value?.to ?? "")
)
const chronologyDraftDirty = ref(false)
const mounted = ref(false)
const hasActiveFilters = computed(() =>
    Boolean(
        filter.value ||
        selectedGender.value ||
        selectedMedia.value.length ||
        selectedLanguages.value.length ||
        selectedKeywords.value.length ||
        selectedNarrowingKeywords.value.length ||
        selectedAboutAuthorIds.value.length ||
        (currentMode.value === "latest" && hide1800.value) ||
        queryYearRange(`${chronologyFromDraft.value},${chronologyToDraft.value}`)
    )
)
const advancedControls = computed<LibraryAdvancedControlsModel>(() => ({
    advancedOpen: advancedOpen.value,
    gender: selectedGender.value,
    keywords: selectedKeywords.value,
    narrowingKeywords: selectedNarrowingKeywords.value,
    aboutAuthorIds: selectedAboutAuthorIds.value,
    media: selectedMedia.value,
    languages: selectedLanguages.value,
    collectionSelectOptions,
    collectionSelectGroups,
    aboutAuthorOptions: aboutAuthorOptions.value,
    mediaSelectOptions,
    languageSelectOptions,
    chronology: chronologyBounds.value
        ? {
            min: chronologyBounds.value.from,
            max: chronologyBounds.value.to,
            from: chronologyFromDraft.value,
            to: chronologyToDraft.value
        }
        : null,
    standalone,
    downloadMode: downloadMode.value,
    allVisibleSourceWorksSelected: allVisibleSourceWorksSelected.value
}))
const results = ref(
    initialPageData.mode === "all" ? initialPageData.response : emptyLibraryResponse()
)
const epubResults = ref(
    initialPageData.mode === "epub" ? initialPageData.response : emptyEpubResponse()
)
const pdfResults = ref(
    initialPageData.mode === "pdf" ? initialPageData.response : emptyPdfResponse()
)
type DownloadCounts = {
    identity: string
    epub: number | null
    pdf: number | null
}
const initialDownloadCountIdentity = JSON.stringify([initialFilter, initialState.advancedFilters])
const downloadCounts = ref<DownloadCounts>({
    identity: initialDownloadCountIdentity,
    epub:
        initialPageData.mode === "epub" && !initialPageData.response.failed
            ? initialPageData.response.distinctHits
            : null,
    pdf:
        initialPageData.mode === "pdf" && !initialPageData.response.failed
            ? initialPageData.response.distinctHits
            : null
})
const latestResults = ref(
    initialPageData.mode === "latest" ? initialPageData.response : emptyLatestResponse()
)
const authorResults = ref(
    initialPageData.mode === "authors" ? initialPageData.response : emptyAuthorBrowseResponse()
)
const workResults = ref(
    initialPageData.mode === "works" ? initialPageData.response : emptyBrowseResponse()
)
const partResults = ref(
    initialPageData.mode === "parts" ? initialPageData.response : emptyBrowseResponse()
)
const pageResultHandlers = {
    all: response => {
        results.value = response
    },
    authors: response => {
        authorResults.value = response
    },
    works: response => {
        workResults.value = response
    },
    parts: response => {
        partResults.value = response
    },
    latest: response => {
        latestResults.value = response
    },
    epub: response => {
        epubResults.value = response
    },
    pdf: response => {
        pdfResults.value = response
    }
} satisfies LibraryPageResultHandlers

function initialLibrarySummaryValue(): LibrarySummary {
    const summary =
        initialData.value?.summary ??
        emptyLibrarySummary(initialFilter, initialState.advancedFilters)
    if (initialState.standalone || initialState.downloadMode || initialPageData.response.failed) {
        return summary
    }
    switch (initialPageData.mode) {
        case "all":
        case "latest":
            return summary
        case "authors":
            return {
                ...summary,
                authors: initialPageData.response.hits,
                works: initialPageData.response.workCount,
                parts: initialPageData.response.partCount
            }
        case "works":
            return { ...summary, works: initialPageData.response.distinctHits }
        case "parts":
            return { ...summary, parts: initialPageData.response.hits }
        case "epub":
            return { ...summary, epub: initialPageData.response.distinctHits }
        case "pdf":
            return { ...summary, pdf: initialPageData.response.distinctHits }
    }
}

const librarySummary = ref<LibrarySummary>(initialLibrarySummaryValue())
const browseResults = computed(() =>
    currentMode.value === "parts" ? partResults.value : workResults.value
)
const expandedWorkKey = ref(
    initialState.mode === "works"
        ? (workResults.value.data.find(item => item.titlePath === queryValue(route.query.title))
              ?.key ?? "")
        : ""
)
const libraryOptionsReady = ref(initialDataWasLoaded)
const loading = ref(import.meta.client && !initialDataWasLoaded)
let timer: ReturnType<typeof setTimeout> | null = null
let controller: AbortController | null = null
let requestVersion = 0
let summaryVersion = 0
let summaryController: AbortController | null = null
let downloadCountVersion = 0
let downloadCountController: AbortController | null = null
let ownedNavigation: { key: string; version: number } | null = null

function selectedSortForCurrentMode(): QueryState["sort"] {
    if (currentMode.value === "all") return selectedSort.value
    if (currentMode.value === "latest") return "nytillkommet"
    if (currentMode.value === "epub" || currentMode.value === "pdf") {
        return selectedEpubSort.value
    }
    return selectedBrowseSort.value
}

function currentState(): QueryState {
    return {
        standalone: route.path === "/epub",
        mode: currentMode.value,
        filter: filter.value,
        sort: selectedSortForCurrentMode(),
        page: currentPage.value,
        hide1800: currentMode.value === "latest" && hide1800.value,
        downloadMode: !standalone && downloadMode.value,
        advancedFilters: {
            gender: selectedGender.value,
            keywords: [...selectedKeywords.value],
            narrowingKeywords: [...selectedNarrowingKeywords.value],
            aboutAuthorIds: [...selectedAboutAuthorIds.value],
            media: [...selectedMedia.value],
            languages: [...selectedLanguages.value],
            yearRange: queryYearRange(`${chronologyFromDraft.value},${chronologyToDraft.value}`)
        }
    }
}

function sortDirectionKey(mode: LibraryMode, sort: QueryState["sort"]): string {
    return `${mode}:${sort}`
}

function isSortReversed(mode: LibraryMode, sort: QueryState["sort"]): boolean {
    return reversedSorts.value[sortDirectionKey(mode, sort)] === true
}

function toggleSortDirection(mode: LibraryMode, sort: QueryState["sort"]) {
    const key = sortDirectionKey(mode, sort)
    reversedSorts.value = {
        ...reversedSorts.value,
        [key]: !reversedSorts.value[key]
    }
}

function cancelPending() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    controller?.abort()
    controller = null
}

function invalidateIntent(): number {
    cancelPending()
    loading.value = !libraryOptionsReady.value
    return ++requestVersion
}

function downloadCountIdentity(filterValue: string, advanced: LibraryAdvancedFilters): string {
    return JSON.stringify([filterValue, advanced])
}

function invalidateDownloadCounts(filterValue: string, advanced: LibraryAdvancedFilters) {
    if (!standalone) return
    const identity = downloadCountIdentity(filterValue, advanced)
    if (downloadCounts.value.identity === identity) return
    downloadCountVersion += 1
    downloadCountController?.abort()
    downloadCountController = null
    downloadCounts.value = { identity, epub: null, pdf: null }
}

function updateDownloadCount(
    filterValue: string,
    advanced: LibraryAdvancedFilters,
    mode: "epub" | "pdf",
    count: number
) {
    const identity = downloadCountIdentity(filterValue, advanced)
    if (identity !== downloadCountIdentity(filter.value, currentState().advancedFilters)) return
    const current =
        downloadCounts.value.identity === identity
            ? downloadCounts.value
            : { identity, epub: null, pdf: null }
    downloadCounts.value = { ...current, identity, [mode]: count }
}

function inactiveDownloadCountIsCurrent(
    result: Awaited<ReturnType<typeof fetchLibraryCount>> | null,
    inactiveMode: "epub" | "pdf",
    identity: string
): result is NonNullable<typeof result> & { total: number } {
    return result?.mode === inactiveMode
        && result.total !== null
        && identity === downloadCountIdentity(filter.value, currentState().advancedFilters)
}

async function refreshInactiveDownloadCount(
    filterValue: string,
    advanced: LibraryAdvancedFilters,
    activeMode: "epub" | "pdf"
) {
    if (!standalone) return
    const identity = downloadCountIdentity(filterValue, advanced)
    if (identity !== downloadCountIdentity(filter.value, currentState().advancedFilters)) return
    if (downloadCounts.value.identity !== identity) invalidateDownloadCounts(filterValue, advanced)
    const inactiveMode = activeMode === "epub" ? "pdf" : "epub"
    if (downloadCounts.value[inactiveMode] !== null) return

    const version = ++downloadCountVersion
    downloadCountController?.abort()
    const activeController = new AbortController()
    downloadCountController = activeController
    const result = await fetchLibraryCount(
        inactiveMode,
        filterValue,
        advanced,
        activeController.signal
    ).catch(() => null)
    const ownsController = downloadCountController === activeController
    if (ownsController) downloadCountController = null
    if (!ownsController) return
    if (version !== downloadCountVersion || activeController.signal.aborted) return
    if (!inactiveDownloadCountIsCurrent(result, inactiveMode, identity)) return
    updateDownloadCount(filterValue, advanced, inactiveMode, result.total)
}

function invalidateLibrarySummary(filterValue: string, advanced: LibraryAdvancedFilters) {
    const identity = librarySummaryIdentity(filterValue, advanced)
    if (librarySummary.value.identity === identity) return
    summaryVersion += 1
    summaryController?.abort()
    summaryController = null
    librarySummary.value = emptyLibrarySummary(filterValue, advanced)
}

function canUpdateLibrarySummary(state: QueryState, pageData: LibraryPageState): boolean {
    if (standalone || state.downloadMode || pageData.response.failed) return false
    const identity = librarySummaryIdentity(state.filter, state.advancedFilters)
    return librarySummary.value.identity === identity
        && identity === librarySummaryIdentity(filter.value, currentState().advancedFilters)
}

function updateLibrarySummaryFromPage(state: QueryState, pageData: LibraryPageState) {
    if (!canUpdateLibrarySummary(state, pageData)) return
    switch (pageData.mode) {
        case "all":
        case "latest":
            return
        case "authors":
            librarySummary.value = {
                ...librarySummary.value,
                authors: pageData.response.hits,
                works: pageData.response.workCount,
                parts: pageData.response.partCount
            }
            return
        case "works":
            librarySummary.value = {
                ...librarySummary.value,
                works: pageData.response.distinctHits
            }
            return
        case "parts":
            librarySummary.value = {
                ...librarySummary.value,
                parts: pageData.response.hits
            }
            return
        case "epub":
            librarySummary.value = {
                ...librarySummary.value,
                epub: pageData.response.distinctHits
            }
            return
        case "pdf":
            librarySummary.value = {
                ...librarySummary.value,
                pdf: pageData.response.distinctHits
            }
    }
}

function isActiveLibrarySummaryIdentity(identity: string): boolean {
    return identity === librarySummaryIdentity(filter.value, currentState().advancedFilters)
}

function hasCompleteLibrarySummary(): boolean {
    return [
        librarySummary.value.authors,
        librarySummary.value.works,
        librarySummary.value.parts,
        librarySummary.value.epub,
        librarySummary.value.pdf
    ].every(value => value !== null)
}

function canCommitLibrarySummary(
    summary: LibrarySummary | null,
    identity: string,
    version: number,
    controller: AbortController,
    ownsController: boolean
): summary is LibrarySummary {
    return ownsController
        && version === summaryVersion
        && !controller.signal.aborted
        && summary !== null
        && summary.identity === identity
        && isActiveLibrarySummaryIdentity(identity)
        && !currentState().downloadMode
}

function mergedLibrarySummary(
    summary: LibrarySummary,
    identity: string,
    filterValue: string,
    advanced: LibraryAdvancedFilters
): LibrarySummary {
    const current = librarySummary.value.identity === identity
        ? librarySummary.value
        : emptyLibrarySummary(filterValue, advanced)
    return {
        identity,
        authors: summary.authors ?? current.authors,
        works: summary.works ?? current.works,
        parts: summary.parts ?? current.parts,
        epub: summary.epub ?? current.epub,
        pdf: summary.pdf ?? current.pdf
    }
}

async function refreshLibrarySummary(
    filterValue: string,
    advanced: LibraryAdvancedFilters,
    sourceDownloadMode = false
) {
    const identity = librarySummaryIdentity(filterValue, advanced)
    if (standalone || sourceDownloadMode || !isActiveLibrarySummaryIdentity(identity)) return
    if (librarySummary.value.identity !== identity) {
        invalidateLibrarySummary(filterValue, advanced)
    }
    if (hasCompleteLibrarySummary()) return

    const version = ++summaryVersion
    summaryController?.abort()
    const activeController = new AbortController()
    summaryController = activeController
    const summary = await fetchLibrarySummary(filterValue, advanced, activeController.signal).catch(
        () => null
    )
    const ownsController = summaryController === activeController
    if (ownsController) summaryController = null
    if (!canCommitLibrarySummary(summary, identity, version, activeController, ownsController)) return
    librarySummary.value = mergedLibrarySummary(summary, identity, filterValue, advanced)
}

function clearLibraryQuery(query: LocationQuery): void {
    delete query.visa
    delete query.filter
    delete query.sort
    delete query.sida
    delete query.hide1800
    delete query.nedladdning
    delete query.title
}

function queryIncludesLibraryMode(state: QueryState): boolean {
    return state.mode !== "all" && (!state.standalone || state.mode === "pdf")
}

function queryFor(state: QueryState): LocationQuery {
    const query: LocationQuery = { ...route.query }
    clearLibraryQuery(query)
    if (queryIncludesLibraryMode(state)) query.visa = state.mode
    if (state.filter) query.filter = state.filter
    if (state.mode !== "all" || state.sort !== "relevans") query.sort = state.sort
    if (state.mode !== "authors" && state.page > 1) {
        query.sida = String(state.page)
    }
    if (state.mode === "latest" && state.hide1800) query.hide1800 = null
    if (state.downloadMode) query.nedladdning = "1"
    return query
}

function isCurrentLibraryPageRequest(
    state: QueryState,
    version: number,
    activeController: AbortController,
    pageData: LibraryPageState | null
): pageData is LibraryPageState {
    return version === requestVersion && !activeController.signal.aborted
        && pageData !== null && pageData.mode === state.mode
}

function updatePageModeState(state: QueryState, pageData: LibraryPageState): void {
    if (pageData.mode === "epub" || pageData.mode === "pdf") {
        if (standalone && !pageData.response.failed) {
            updateDownloadCount(
                state.filter,
                state.advancedFilters,
                pageData.mode,
                pageData.response.distinctHits
            )
        }
        return
    }
    if (pageData.mode === "works") {
        expandedWorkKey.value =
            pageData.response.data.find(item => item.titlePath === queryValue(route.query.title))
                ?.key ?? ""
    }
}

function refreshAfterPageRequest(state: QueryState, pageData: LibraryPageState): void {
    if (!pageData.response.failed) {
        void refreshLibrarySummary(state.filter, state.advancedFilters, state.downloadMode)
    }
    if (state.mode === "epub" || state.mode === "pdf") {
        void refreshInactiveDownloadCount(state.filter, state.advancedFilters, state.mode)
    }
}

async function reconcileAllResultPage(
    state: QueryState,
    pageData: LibraryPageState,
    version: number,
    activeController: AbortController
): Promise<boolean> {
    const canonicalPage = canonicalAllResultPage(state, pageData)
    if (canonicalPage === null) return true
    const canonicalState = { ...state, page: canonicalPage }
    if (canonicalPage !== state.page) {
        if (controller === activeController) controller = null
        await persistAndRequest(canonicalState, version)
        return false
    }
    if (hasCanonicalPageQuery(canonicalPage)) return true
    return await replaceBrowserRoute(canonicalState, version)
}

async function requestStateAfterOptions(
    state: QueryState,
    version: number
): Promise<QueryState | null> {
    if (libraryOptionsReady.value) return state
    await optionsAsyncData.execute({ dedupe: "defer" }).catch(() => null)
    if (version !== requestVersion || optionsAsyncData.status.value !== "success") return null
    libraryOptionsReady.value = true
    return syncRouteState(routeState(route.path, route.query))
}

async function runBrowserRequest(state: QueryState, version: number) {
    if (version !== requestVersion) return
    loading.value = true
    const acceptedState = await requestStateAfterOptions(state, version)
    if (!acceptedState) return
    state = acceptedState
    const activeController = new AbortController()
    controller = activeController
    const reversed = isSortReversed(state.mode, state.sort)
    const pageData = await fetchLibraryPageData(state, activeController.signal, reversed).catch(
        () => null
    )
    if (!isCurrentLibraryPageRequest(state, version, activeController, pageData)) return
    if (!await reconcileAllResultPage(state, pageData, version, activeController)) return
    assignLibraryPageResult(pageData, pageResultHandlers)
    updatePageModeState(state, pageData)
    updateLibrarySummaryFromPage(state, pageData)
    loading.value = false
    if (controller === activeController) controller = null
    refreshAfterPageRequest(state, pageData)
}

async function replaceBrowserRoute(state: QueryState, version: number): Promise<boolean> {
    if (version !== requestVersion) return false
    const navigation = { key: stateKey(state), version }
    ownedNavigation = navigation
    try {
        await router.replace({
            path: state.standalone ? "/epub" : "/bibliotek",
            query: queryFor(state)
        })
    } finally {
        if (ownedNavigation === navigation) ownedNavigation = null
    }
    return version === requestVersion
}

async function persistAndRequest(state: QueryState, version: number) {
    if (!await replaceBrowserRoute(state, version)) return
    if (version === requestVersion) await runBrowserRequest(state, version)
}

function beginIntent(state: QueryState, delay = 0) {
    const captured = Object.freeze({ ...state })
    const version = invalidateIntent()
    currentMode.value = captured.mode
    invalidateLibrarySummary(captured.filter, captured.advancedFilters)
    invalidateDownloadCounts(captured.filter, captured.advancedFilters)
    filter.value = captured.filter
    currentPage.value = captured.page
    hide1800.value = captured.hide1800
    downloadMode.value = captured.downloadMode
    if (captured.mode === "epub" || captured.mode === "pdf") {
        selectedEpubSort.value = captured.sort as EpubSortKey
    } else if (captured.mode === "all") selectedSort.value = captured.sort as RelevanceSortKey
    else if (
        captured.mode === "authors" ||
        captured.mode === "works" ||
        captured.mode === "parts"
    ) {
        selectedBrowseSort.value = captured.sort as BrowseSortKey
    }
    if (delay > 0) {
        timer = setTimeout(() => {
            timer = null
            void persistAndRequest(captured, version)
        }, delay)
        return
    }
    void persistAndRequest(captured, version)
}

function scheduleSearch() {
    beginIntent({ ...currentState(), filter: filter.value, page: 1 }, 300)
}

function updateFilter(value: string) {
    filter.value = value
    scheduleSearch()
}

function submitSearch() {
    beginIntent({ ...currentState(), filter: filter.value, page: 1 })
}

function resetSearch() {
    const parsed = routeState(route.path, route.query).advancedFilters
    const query: LocationQuery = { ...route.query }
    delete query.filter
    delete query.sida
    if (currentMode.value === "latest") delete query.hide1800
    if (parsed.gender) delete query.kön
    if (parsed.keywords.length) delete query.keywords
    if (parsed.narrowingKeywords.length) delete query.keywords_aux
    if (parsed.aboutAuthorIds.length) delete query.about_authors
    if (parsed.media.length) delete query.mediatypes
    if (parsed.languages.length) delete query.languages
    if (parsed.yearRange) delete query.intervall
    chronologyDraftDirty.value = false
    chronologyFromDraft.value = String(chronologyBounds.value?.from ?? "")
    chronologyToDraft.value = String(chronologyBounds.value?.to ?? "")
    invalidateIntent()
    void router.push({ path: route.path, query })
}

function selectSort(key: QueryState["sort"]) {
    const state = currentState()
    if (state.sort === key) toggleSortDirection(state.mode, key)
    beginIntent({ ...state, sort: key, page: 1 })
}

function selectPage(page: number) {
    const boundedPage = Math.max(1, Math.min(page, Math.max(1, pageCount.value)))
    beginIntent({ ...currentState(), page: boundedPage })
}

async function loadAllAuthors() {
    const state = currentState()
    if (
        state.mode !== "authors" ||
        authorResults.value.failed ||
        authorResults.value.data.length >= authorResults.value.hits
    )
        return
    const version = invalidateIntent()
    const activeController = new AbortController()
    controller = activeController
    loading.value = true
    const pageData = await fetchLibraryPageData(
        state,
        activeController.signal,
        isSortReversed(state.mode, state.sort),
        Math.min(10_000, Math.max(150, authorResults.value.hits))
    ).catch(() => null)
    if (version !== requestVersion || activeController.signal.aborted) return
    if (pageData?.mode === "authors" && !pageData.response.failed) {
        authorResults.value = pageData.response
    }
    loading.value = false
    if (controller === activeController) controller = null
}

function toggle1800() {
    beginIntent({ ...currentState(), hide1800: !hide1800.value, page: 1 })
}

async function toggleDownloadMode() {
    invalidateIntent()
    const query: LocationQuery = { ...route.query }
    delete query.sida
    delete query.hide1800
    delete query.title
    query.visa = "works"
    query.sort = "popularitet"
    if (downloadMode.value) delete query.nedladdning
    else query.nedladdning = "1"
    await router.push({ path: "/bibliotek", query })
}

function syncAdvancedControls(state: LibraryRouteState) {
    advancedOpen.value = state.advanced
    selectedGender.value = state.advancedFilters.gender
    selectedKeywords.value = [...state.advancedFilters.keywords]
    selectedNarrowingKeywords.value = [...state.advancedFilters.narrowingKeywords]
    selectedAboutAuthorIds.value = [...state.advancedFilters.aboutAuthorIds]
    selectedMedia.value = [...state.advancedFilters.media]
    selectedLanguages.value = [...state.advancedFilters.languages]
    if (!chronologyDraftDirty.value) {
        chronologyFromDraft.value = String(
            state.advancedFilters.yearRange?.[0] ?? chronologyBounds.value?.from ?? ""
        )
        chronologyToDraft.value = String(
            state.advancedFilters.yearRange?.[1] ?? chronologyBounds.value?.to ?? ""
        )
    }
}

function syncRouteState(parsedRoute: LibraryRouteState): QueryState {
    const state = requestState(parsedRoute)
    syncAdvancedControls(parsedRoute)
    currentMode.value = state.mode
    invalidateLibrarySummary(state.filter, state.advancedFilters)
    invalidateDownloadCounts(state.filter, state.advancedFilters)
    filter.value = state.filter
    currentPage.value = state.page
    hide1800.value = state.hide1800
    downloadMode.value = state.downloadMode
    if (state.mode === "epub" || state.mode === "pdf") {
        selectedEpubSort.value = state.sort as EpubSortKey
    } else if (state.mode === "all") {
        selectedSort.value = state.sort as RelevanceSortKey
    } else if (state.mode === "authors" || state.mode === "works" || state.mode === "parts") {
        selectedBrowseSort.value = state.sort as BrowseSortKey
    }
    return state
}

type AdvancedQueryKey =
    | "kön"
    | "keywords"
    | "keywords_aux"
    | "about_authors"
    | "mediatypes"
    | "languages"
    | "intervall"

function replaceQueryValue(query: LocationQuery, key: string, value: string): void {
    Reflect.deleteProperty(query, key)
    if (value) query[key] = value
}

function queryFromLiveAdvancedControls(): LocationQuery {
    const query: LocationQuery = { ...route.query }
    const state = currentState()
    replaceQueryValue(query, "filter", state.filter)
    replaceQueryValue(query, "kön", state.advancedFilters.gender)
    replaceQueryValue(query, "keywords", state.advancedFilters.keywords.join(","))
    replaceQueryValue(
        query,
        "keywords_aux",
        state.advancedFilters.narrowingKeywords.join(",")
    )
    if (aboutAuthorOptionsAvailable.value) {
        replaceQueryValue(query, "about_authors", state.advancedFilters.aboutAuthorIds.join(","))
    }
    replaceQueryValue(query, "mediatypes", state.advancedFilters.media.join(","))
    replaceQueryValue(query, "languages", state.advancedFilters.languages.join(","))
    const bounds = chronologyBounds.value
    const range = bounds ? chronologyDraftRange(bounds) : null
    if (bounds && range) {
        const isFullRange = range[0] === bounds.from && range[1] === bounds.to
        replaceQueryValue(query, "intervall", isFullRange ? "" : range.join(","))
    }
    return query
}

async function pushAdvancedQuery(key: AdvancedQueryKey, value: string) {
    const query = queryFromLiveAdvancedControls()
    invalidateIntent()
    delete query.sida
    replaceQueryValue(query, key, value)
    await router.push({ path: route.path, query })
}

async function toggleAdvanced() {
    const query: LocationQuery = { ...route.query }
    if (advancedOpen.value) delete query.avancerat
    else query.avancerat = "1"
    await router.push({ path: route.path, query })
}

function commitGender(value: LibraryGender) {
    selectedGender.value = value
    void pushAdvancedQuery("kön", value)
}

function commitMedia(values: readonly string[]) {
    selectedMedia.value = orderedLibraryValues(values, mediaSelectOptions)
    void pushAdvancedQuery("mediatypes", selectedMedia.value.join(","))
}

function commitKeywords(values: readonly string[]) {
    selectedKeywords.value = orderedLibraryValues(values, collectionSelectOptions)
    void pushAdvancedQuery("keywords", selectedKeywords.value.join(","))
}

function commitNarrowingKeywords(values: readonly string[]) {
    selectedNarrowingKeywords.value = orderedLibraryValues(values, collectionSelectOptions)
    void pushAdvancedQuery("keywords_aux", selectedNarrowingKeywords.value.join(","))
}

function commitAboutAuthors(values: readonly string[]) {
    selectedAboutAuthorIds.value = orderedLibraryValues(
        values,
        aboutAuthorOptions.value.map(option => ({ value: option.id }))
    )
    void pushAdvancedQuery("about_authors", selectedAboutAuthorIds.value.join(","))
}

function commitLanguages(values: readonly string[]) {
    selectedLanguages.value = orderedLibraryValues(values, languageSelectOptions)
    void pushAdvancedQuery("languages", selectedLanguages.value.join(","))
}

function setChronologyDraft(from: string, to: string) {
    chronologyDraftDirty.value = true
    chronologyFromDraft.value = from
    chronologyToDraft.value = to
}

function resetChronologyDraft() {
    chronologyDraftDirty.value = false
    const range = routeState(route.path, route.query).advancedFilters.yearRange
    chronologyFromDraft.value = String(range?.[0] ?? chronologyBounds.value?.from ?? "")
    chronologyToDraft.value = String(range?.[1] ?? chronologyBounds.value?.to ?? "")
}

function chronologyDraftRange(bounds: ImprintBounds): [number, number] | null {
    if (!/^\d{4}$/.test(chronologyFromDraft.value)) return null
    if (!/^\d{4}$/.test(chronologyToDraft.value)) return null
    const from = Number(chronologyFromDraft.value)
    const to = Number(chronologyToDraft.value)
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return null
    return from >= bounds.from && to <= bounds.to && from <= to ? [from, to] : null
}

async function commitChronologyRange(value: readonly [number, number]) {
    setChronologyDraft(String(value[0]), String(value[1]))
    const bounds = chronologyBounds.value
    if (!bounds) {
        resetChronologyDraft()
        return
    }
    const range = chronologyDraftRange(bounds)
    if (!range) {
        resetChronologyDraft()
        return
    }
    const [from, to] = range
    const current = routeState(route.path, route.query).advancedFilters.yearRange
    if ((current?.[0] ?? bounds.from) === from && (current?.[1] ?? bounds.to) === to) {
        chronologyDraftDirty.value = false
        return
    }
    const valueToPersist = from === bounds.from && to === bounds.to ? "" : `${from},${to}`
    await pushAdvancedQuery("intervall", valueToPersist)
    chronologyDraftDirty.value = false
}

function commitAdvancedChange(change: LibraryAdvancedChange) {
    switch (change.field) {
        case "gender":
            commitGender(change.value)
            return
        case "keywords":
            commitKeywords(change.value)
            return
        case "narrowingKeywords":
            commitNarrowingKeywords(change.value)
            return
        case "aboutAuthorIds":
            commitAboutAuthors(change.value)
            return
        case "media":
            commitMedia(change.value)
            return
        case "languages":
            commitLanguages(change.value)
            return
        case "chronologyDraft":
            setChronologyDraft(change.from, change.to)
            return
        case "chronologyRange":
            void commitChronologyRange(change.value)
            return
    }
}

watch(
    () => {
        const state = requestState(routeState(route.path, route.query))
        return JSON.stringify([
            stateKey(state),
            state.mode === "all" && Object.hasOwn(route.query, "sida"),
            state.mode === "all" ? route.query.sida : null
        ])
    },
    () => {
        const previousStateKey = stateKey(currentState())
        const state = syncRouteState(routeState(route.path, route.query))
        if (ownedNavigation?.key === stateKey(state)) return
        if (
            state.mode === "all"
            && previousStateKey === stateKey(state)
            && !hasCanonicalPageQuery(state.page)
        ) {
            void replaceBrowserRoute(state, requestVersion)
            return
        }
        const version = invalidateIntent()
        void runBrowserRequest(state, version)
    },
    { flush: "sync" }
)

watch(
    () => `${String(route.query.avancerat)}:${route.path}`,
    () => syncAdvancedControls(routeState(route.path, route.query)),
    { flush: "sync" }
)

watch(
    () => queryValue(route.query.title),
    titlePath => {
        if (currentMode.value !== "works") {
            expandedWorkKey.value = ""
            return
        }
        expandedWorkKey.value =
            workResults.value.data.find(item => item.titlePath === titlePath)?.key ?? ""
    },
    { flush: "sync" }
)

const ownedQueryKeys = new Set([
    "visa",
    "filter",
    "sort",
    "sida",
    "hide1800",
    "nedladdning",
    "title"
])

function appendPreservedQueryValue(
    params: URLSearchParams,
    key: string,
    value: string | null | (string | null)[]
): void {
    if (Array.isArray(value)) {
        for (const item of value) params.append(key, item ?? "")
        return
    }
    params.append(key, value ?? "")
}

function preservedQuery(): URLSearchParams {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(route.query)) {
        if (ownedQueryKeys.has(key)) continue
        appendPreservedQueryValue(params, key, value)
    }
    return params
}

type LibraryHrefState = {
    mode: LibraryMode
    filter: string
    sort: RelevanceSortKey | BrowseSortKey | LatestSortKey
    page?: number
    hide1800?: boolean
    downloadMode?: boolean
}

function applyStateModeParams(params: URLSearchParams, state: LibraryHrefState): void {
    if (state.mode !== "all" && (route.path !== "/epub" || state.mode === "pdf")) {
        params.set("visa", state.mode)
    }
    if (state.filter) params.set("filter", state.filter)
    if (state.mode !== "all") params.set("sort", state.sort as EpubSortKey)
    else if (state.sort !== "relevans") params.set("sort", state.sort)
}

function applyStatePagingParams(params: URLSearchParams, state: LibraryHrefState): void {
    if (state.page !== undefined && state.mode !== "authors") {
        params.set("sida", String(state.page))
    }
    if (state.mode === "latest" && state.hide1800) params.set("hide1800", "")
    if ((state.downloadMode ?? downloadMode.value) && state.mode === "works") {
        params.set("nedladdning", "1")
    }
}

function stateHref(state: LibraryHrefState): string {
    const params = preservedQuery()
    applyStateModeParams(params, state)
    applyStatePagingParams(params, state)
    const query = params.toString()
    return `${route.path}${query ? `?${query}` : ""}`
}

function isImprintYear(year: string): boolean {
    return /^\d{4}$/.test(year)
}

function imprintYearTo(year: string): RouteLocationRaw {
    const query = queryFromLiveAdvancedControls()
    delete query.sida
    delete query.title
    replaceQueryValue(query, "intervall", `${year},${year}`)
    return { path: route.path, query }
}

function libraryModeTab(
    mode: LibraryMode,
    label: string,
    count: number | null,
    to: RouteLocationRaw,
    disabledLook: boolean,
    disabled: boolean,
    separatorBefore: boolean
): LibraryModeTab {
    return {
        mode,
        label,
        count,
        to,
        active: currentMode.value === mode,
        disabledLook,
        disabled,
        separatorBefore
    }
}

function ordinaryWorksTabHref(): string {
    return stateHref({
        mode: "works",
        filter: filter.value,
        sort: "popularitet",
        downloadMode: false
    })
}

function ordinaryLibraryModeTabs(
    separatorBefore: boolean,
    epubHref: RouteLocationRaw,
    pdfHref: RouteLocationRaw
): LibraryModeTab[] {
    const tabs: LibraryModeTab[] = [
        libraryModeTab(
            "all",
            "Alla träffar",
            null,
            stateHref({ mode: "all", filter: filter.value, sort: "relevans" }),
            false,
            false,
            false
        ),
        libraryModeTab(
            "latest",
            "Nytt",
            null,
            stateHref({ mode: "latest", filter: filter.value, sort: "nytillkommet" }),
            false,
            false,
            separatorBefore
        ),
        libraryModeTab(
            "authors",
            "Författare",
            librarySummary.value.authors,
            stateHref({ mode: "authors", filter: filter.value, sort: "popularitet" }),
            downloadMode.value || librarySummary.value.authors === 0,
            downloadMode.value,
            separatorBefore
        ),
        libraryModeTab(
            "works",
            "Verk",
            librarySummary.value.works,
            ordinaryWorksTabHref(),
            false,
            false,
            separatorBefore
        )
    ]

    if (!downloadMode.value) {
        tabs.push(
            libraryModeTab(
                "parts",
                "Dikt, novell, etc.",
                librarySummary.value.parts,
                stateHref({ mode: "parts", filter: filter.value, sort: "titlar" }),
                librarySummary.value.parts === 0,
                false,
                separatorBefore
            ),
            libraryModeTab(
                "epub",
                "Epub",
                epubTabCount.value,
                epubHref,
                currentMode.value === "all" && !epubTabCount.value,
                false,
                separatorBefore
            ),
            libraryModeTab(
                "pdf",
                "PDF",
                pdfTabCount.value,
                pdfHref,
                currentMode.value !== "pdf" && !pdfTabCount.value,
                false,
                separatorBefore
            )
        )
    }

    return tabs
}

const libraryModeTabs = computed<readonly LibraryModeTab[]>(() => {
    const separatorBefore = currentMode.value !== "all"
    const epubHref = stateHref({
        mode: "epub",
        filter: filter.value,
        sort: "popularitet"
    })
    const pdfHref = stateHref({
        mode: "pdf",
        filter: filter.value,
        sort: "popularitet"
    })

    if (standalone) {
        return [
            libraryModeTab("epub", "Epub", epubTabCount.value || null, epubHref, false, false, false),
            libraryModeTab(
                "pdf",
                "PDF",
                pdfTabCount.value || null,
                pdfHref,
                currentMode.value !== "pdf" && !pdfTabCount.value,
                false,
                separatorBefore
            )
        ]
    }

    return ordinaryLibraryModeTabs(separatorBefore, epubHref, pdfHref)
})

function relevanceSortHref(sort: RelevanceSortKey): string {
    return stateHref({ mode: "all", filter: filter.value, sort })
}

const latestSortHref = computed(() =>
    stateHref({
        mode: "latest",
        filter: filter.value,
        sort: "nytillkommet",
        hide1800: hide1800.value
    })
)

const allSortOptions = computed<readonly LibrarySortOption<RelevanceSortKey>[]>(() =>
    sorts.map(item => ({
        ...item,
        to: relevanceSortHref(item.key),
        active: selectedSort.value === item.key
    }))
)
const latestSortOptions = computed<readonly LibrarySortOption<LatestSortKey>[]>(() => [
    {
        key: "nytillkommet",
        label: "Nytt",
        to: latestSortHref.value,
        active: true
    }
])
const allSortReversed = computed(() => isSortReversed("all", selectedSort.value))
const latestSortReversed = computed(() => isSortReversed("latest", "nytillkommet"))
const authorSortOptions = computed<readonly LibraryNativeSortOption<AuthorSortKey>[]>(() =>
    authorSorts.map(item => ({
        ...item,
        to: browseSortHref(item.key),
        active: selectedBrowseSort.value === item.key
    }))
)
const authorSortReversed = computed(() =>
    isSortReversed("authors", selectedBrowseSort.value)
)

const allImprintYearTargets = computed<readonly LibraryImprintYearTarget[]>(() =>
    results.value.data.flatMap(item =>
        item.index !== "author" && isImprintYear(item.yearLabel)
            ? [{ year: item.yearLabel, to: imprintYearTo(item.yearLabel) }]
            : []
    )
)
const latestImprintYearTargets = computed<readonly LibraryImprintYearTarget[]>(() =>
    latestResults.value.groups.flatMap(group =>
        group.results.flatMap(item =>
            isImprintYear(item.year)
                ? [{ year: item.year, to: imprintYearTo(item.year) }]
                : []
        )
    )
)

function epubSortHref(sort: EpubSortKey): string {
    return stateHref({
        mode: currentMode.value === "pdf" ? "pdf" : "epub",
        filter: filter.value,
        sort,
        page: 1
    })
}

function browseSortHref(sort: BrowseSortKey): string {
    return stateHref({ mode: currentMode.value, filter: filter.value, sort, page: 1 })
}

const activeBrowseSorts = computed(() =>
    currentMode.value === "authors"
        ? authorSorts
        : currentMode.value === "parts"
          ? partSorts
          : epubSorts
)
const browseResultMode = computed<LibraryBrowseMode>(() =>
    currentMode.value === "parts" ? "parts" : "works"
)
const browseSortOptions = computed<readonly LibraryNativeSortOption<BrowseSortKey>[]>(() =>
    activeBrowseSorts.value.map(item => ({
        ...item,
        to: browseSortHref(item.key),
        active: selectedBrowseSort.value === item.key
    }))
)
const browseSortReversed = computed(() =>
    isSortReversed(browseResultMode.value, selectedBrowseSort.value)
)
const browseImprintYearTargets = computed<readonly LibraryImprintYearTarget[]>(() =>
    browseResults.value.data.flatMap(item =>
        isImprintYear(item.year) ? [{ year: item.year, to: imprintYearTo(item.year) }] : []
    )
)

const authorShowAll = computed(() => authorResults.value.data.length < authorResults.value.hits)
const downloadResultMode = computed<"epub" | "pdf">(() =>
    currentMode.value === "pdf" ? "pdf" : "epub"
)
const downloadResponse = computed<EpubResponse>(() =>
    downloadResultMode.value === "pdf" ? pdfResults.value : epubResults.value
)
const downloadSortOptions = computed<readonly LibraryNativeSortOption<EpubSortKey>[]>(() =>
    epubSorts.map(item => ({
        ...item,
        to: epubSortHref(item.key),
        active: selectedEpubSort.value === item.key
    }))
)
const downloadSortReversed = computed(() =>
    isSortReversed(downloadResultMode.value, selectedEpubSort.value)
)
const downloadImprintYearTargets = computed<readonly LibraryImprintYearTarget[]>(() =>
    downloadResponse.value.data.flatMap(item =>
        isImprintYear(item.year) ? [{ year: item.year, to: imprintYearTo(item.year) }] : []
    )
)
const downloadDistinctHits = computed(() =>
    currentMode.value === "pdf" ? pdfResults.value.distinctHits : epubResults.value.distinctHits
)
const epubTabCount = computed(() =>
    standalone ? downloadCounts.value.epub : librarySummary.value.epub
)
const pdfTabCount = computed(() =>
    standalone ? downloadCounts.value.pdf : librarySummary.value.pdf
)

function currentResultHitCount(): number {
    if (currentMode.value === "all") return results.value.hits
    if (currentMode.value === "latest") return latestResults.value.distinctHits
    if (currentMode.value === "authors") return 0
    if (currentMode.value === "works") return workResults.value.distinctHits
    if (currentMode.value === "parts") return partResults.value.hits
    return downloadDistinctHits.value
}

const pageCount = computed(() =>
    Math.min(
        libraryPageMaximum,
        Math.ceil(currentResultHitCount() / 100)
    )
)
const pages = computed(() => legacyPaginationItems(pageCount.value, currentPage.value))

function paginationModel(
    pageHref: (page: number) => RouteLocationRaw
): LibraryPaginationModel {
    const entries = pages.value.map(
        (item: LegacyPaginationItem): LibraryPaginationEntry => ({
            ...item,
            to: pageHref(item.page),
            ellipsis: item.label === "..."
        })
    )
    return {
        currentPage: currentPage.value,
        pageCount: pageCount.value,
        previous: currentPage.value <= 1 ? null : pageHref(currentPage.value - 1),
        next: currentPage.value >= pageCount.value ? null : pageHref(currentPage.value + 1),
        entries
    }
}

function allPageHref(page: number): string {
    return stateHref({
        mode: "all",
        filter: filter.value,
        sort: selectedSort.value,
        page
    })
}

function epubPageHref(page: number): string {
    return stateHref({
        mode: currentMode.value === "pdf" ? "pdf" : "epub",
        filter: filter.value,
        sort: selectedEpubSort.value,
        page
    })
}

function latestPageHref(page: number): string {
    return stateHref({
        mode: "latest",
        filter: filter.value,
        sort: "nytillkommet",
        page,
        hide1800: hide1800.value
    })
}

function browsePageHref(page: number): string {
    return stateHref({
        mode: currentMode.value,
        filter: filter.value,
        sort: selectedBrowseSort.value,
        page
    })
}

const allPagination = computed(() => paginationModel(allPageHref))
const latestPagination = computed(() => paginationModel(latestPageHref))
const browsePagination = computed(() => paginationModel(browsePageHref))
const epubPagination = computed(() => paginationModel(epubPageHref))

function toggleWorkActions(item: BrowseResult) {
    const opening = expandedWorkKey.value !== item.key
    expandedWorkKey.value = opening ? item.key : ""
    const query: LocationQuery = { ...route.query }
    if (opening) query.title = item.titlePath
    else delete query.title
    void router.push({ path: route.path, query })
}

function toggleBrowseWork(key: string) {
    const item = browseResults.value.data.find(result => result.key === key)
    if (item) toggleWorkActions(item)
}

function disposeLibraryRequest() {
    requestVersion += 1
    summaryVersion += 1
    summaryController?.abort()
    summaryController = null
    downloadCountVersion += 1
    downloadCountController?.abort()
    downloadCountController = null
    cancelPending()
}

useSeoMeta({
    title: standalone
        ? "E-böcker för nedladdning | Litteraturbanken"
        : "Biblioteket – Titlar och författare | Litteraturbanken",
    description
})
useHead({
    htmlAttrs: {
        style: standalone
            ? "background-image: none; background-color: unset;"
            : `background: url('${backgroundPath}') no-repeat;`
    },
    bodyAttrs: { class: standalone ? "focus page-epub ready" : "focus page-library ready" }
})

async function loadInitialClientState(): Promise<void> {
    const version = ++requestVersion
    const state = requestState(routeState(route.path, route.query))
    await runBrowserRequest(state, version)
}

onMounted(() => {
    mounted.value = true
    if (!initialDataWasLoaded) {
        void loadInitialClientState()
        return
    }
    if (currentMode.value === "authors" && route.query.sida !== undefined) {
        void router.replace({ path: route.path, query: queryFor(currentState()) })
    }
    const initialFailed = initialPageData.response.failed
    const state = currentState()
    if (!initialFailed)
        void refreshLibrarySummary(filter.value, state.advancedFilters, state.downloadMode)
    if (!initialFailed && (state.mode === "epub" || state.mode === "pdf")) {
        void refreshInactiveDownloadCount(filter.value, state.advancedFilters, state.mode)
    }
})
onUnmounted(() => {
    disposeLibraryRequest()
    optionsAsyncData.clear()
    initialAsyncData.clear()
})
</script>

<template>
    <div :data-library-mounted="mounted ? 'true' : undefined">
        <h1 class="text-6xl lg:ml-12">
            {{ standalone ? "Hämta e-böcker" : "Botanisera i biblioteket" }}
        </h1>
        <div class="lg:ml-12" :class="{ searching: loading, dl_mode: downloadMode }">
            <div id="controls">
                <LibrarySearchControls
                    :filter="filter"
                    :has-active-filters="hasActiveFilters"
                    :advanced-open="advancedOpen"
                    @update-filter="updateFilter"
                    @submit="submitSearch"
                    @reset="resetSearch"
                    @toggle-advanced="toggleAdvanced"
                >
                    <LibraryAdvancedFilters
                        :model="advancedControls"
                        @change="commitAdvancedChange"
                        @reset-chronology="resetChronologyDraft"
                        @toggle-download-mode="toggleDownloadMode"
                        @select-visible-source-works="selectVisibleSourceWorks"
                        @deselect-visible-source-works="deselectVisibleSourceWorks"
                    />
                    <div class="btn-group p-0 mt-4 lg:mt-6">
                        <LibraryModeTabs :tabs="libraryModeTabs" />
                    </div>
                </LibrarySearchControls>
            </div>
            <div class="flex items-stretch w-full lg:max-w-5xl text-lg leading-tight">
                <LibrarySourceDownloadWorkspace
                    v-if="currentMode === 'works' && downloadMode"
                    ref="sourceDownloadWorkspace"
                    :response="workResults"
                    :loading="loading"
                    :sort-options="browseSortOptions"
                    :sort-reversed="browseSortReversed"
                    :pagination="browsePagination"
                    :imprint-year-targets="browseImprintYearTargets"
                    @select-sort="selectSort"
                    @select-page="selectPage"
                />
                <div v-else class="bg-white/65 lg:p-6 p-2 lg:border border-gray-900 flex-grow">
                    <LibraryAllResults
                        v-if="currentMode === 'all'"
                        :response="results"
                        :sort-options="allSortOptions"
                        :sort-reversed="allSortReversed"
                        :imprint-year-targets="allImprintYearTargets"
                        :loading="loading"
                        :pagination="allPagination"
                        @select-sort="selectSort"
                        @select-page="selectPage"
                    />
                    <LibraryLatestResults
                        v-else-if="currentMode === 'latest'"
                        :response="latestResults"
                        :sort-options="latestSortOptions"
                        :sort-reversed="latestSortReversed"
                        :hide1800="hide1800"
                        :imprint-year-targets="latestImprintYearTargets"
                        :loading="loading"
                        :pagination="latestPagination"
                        @select-sort="selectSort"
                        @toggle-hide-1800="toggle1800"
                        @select-page="selectPage"
                    />
                    <LibraryAuthorResults
                        v-else-if="currentMode === 'authors'"
                        :response="authorResults"
                        :sort-options="authorSortOptions"
                        :sort-reversed="authorSortReversed"
                        :loading="loading"
                        :show-all="authorShowAll"
                        @select-sort="selectSort"
                        @show-all="loadAllAuthors"
                    />
                    <LibraryBrowseResults
                        v-else-if="(currentMode === 'works' || currentMode === 'parts') && !downloadMode"
                        :mode="browseResultMode"
                        :response="browseResults"
                        :expanded-key="expandedWorkKey"
                        :loading="loading"
                        :sort-options="browseSortOptions"
                        :sort-reversed="browseSortReversed"
                        :pagination="browsePagination"
                        :imprint-year-targets="browseImprintYearTargets"
                        @select-sort="selectSort"
                        @select-page="selectPage"
                        @toggle-work="toggleBrowseWork"
                    />
                    <LibraryDownloadResults
                        v-else-if="currentMode === 'epub' || currentMode === 'pdf'"
                        :mode="downloadResultMode"
                        :response="downloadResponse"
                        :sort-options="downloadSortOptions"
                        :sort-reversed="downloadSortReversed"
                        :imprint-year-targets="downloadImprintYearTargets"
                        :loading="loading"
                        :pagination="epubPagination"
                        @select-sort="selectSort"
                        @select-page="selectPage"
                    />
                </div>
            </div>
        </div>
    </div>
</template>
