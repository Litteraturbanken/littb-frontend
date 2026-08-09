<script setup lang="ts">
import type { CSSProperties } from "vue"
import type { LocationQuery, RouteLocationRaw } from "vue-router"
import { libraryTooltipDirective } from "~/directives/library-tooltip"
import { createLbApiClient } from "~/lib/api/client"
import { canonicalNuxtHref, isNuxtInternalHref } from "~/lib/internal-navigation"
import { legacyPaginationItems } from "~/lib/legacy-pagination"
import {
    buildLibraryCountRequest,
    buildLibrarySearchRequest,
    type LibraryCountMode,
    type LibraryCountResponse,
    type LibraryFilterState,
    type LibraryFilters,
    type LibraryOptionsResponse,
    type LibrarySearchState
} from "~/lib/library"
import {
    authorSortKey,
    epubSortKey,
    libraryPageMaximum,
    parseLibraryRouteState,
    partSortKey,
    relevanceSortKey,
    type AuthorSortKey,
    type BrowseSortKey,
    type EpubSortKey,
    type LatestSortKey,
    type LibraryMode,
    type LibraryRouteState as ParsedLibraryRouteState,
    type PartSortKey,
    type RelevanceSortKey
} from "~/lib/library/navigation"
import { canonicalLibraryResultPage } from "~/lib/library/result-pagination"
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
import {
    toLibrarySearchView,
    type BrowseResult
} from "~/lib/library/view-model"

definePageMeta({ alias: ["/epub"] })

type LibraryGender = "" | "female" | "male"
type LibraryCategory = NonNullable<LibraryFilters["categories"]>[number]
type LibraryMedia = NonNullable<LibraryFilters["media"]>[number]
type LibraryLanguage = NonNullable<LibraryFilters["languages"]>[number]

type LibraryAdvancedFilters = {
    gender: LibraryGender
    keywords: LibraryCategory[]
    narrowingKeywords: LibraryCategory[]
    aboutAuthorIds: string[]
    media: LibraryMedia[]
    languages: LibraryLanguage[]
    yearRange: [number, number] | null
}

type ImprintBounds = { from: number; to: number }
type AboutAuthorOption = { id: string; label: string }

type LibraryRouteState = ParsedLibraryRouteState<LibraryAdvancedFilters>

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

const vLibraryTooltip = libraryTooltipDirective

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
const config = useRuntimeConfig()
const { rememberLibraryHref } = useLibraryNavigation()

watch(
    () => route.fullPath,
    () => {
        if (!import.meta.client) return
        rememberLibraryHref(route.fullPath)
    },
    { immediate: true }
)

const collectionOptionGroups = [
    {
        label: "Kategorier",
        options: [
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
            ["keyword:Folktryck", "Skillingtryck och folktryck"]
        ]
    },
    {
        label: "Projekt",
        options: [
            ["keyword:sentpajorden", "Gunnar Ekelöf. Sent på jorden"],
            ["keyword:OrdenPrövas", "Harry Martinson. Orden prövas"],
            ["keyword:LB-antologi", "Litteraturbankens antologier"],
            ["keyword:1800", "Nya vägar till det förflutna"]
        ]
    },
    {
        label: "Avdelningar",
        options: [
            ["source:bibliotekariesidor", "Bibliotekariesidorna"],
            ["source:diktensmuseum", "Diktens museum"],
            ["keyword:Dramawebben", "Dramawebben"],
            ["source:skolan", "Litteraturbankens skola"],
            ["source:litteraturkartan", "Litteraturkartan"],
            ["source:ljudochbild", "Ljud & Bild"],
            ["source:sol", "Översättarlexikon"]
        ]
    },
    {
        label: "Utgivare",
        options: [
            ["keyword:SLS-FI", "SLS Finland"],
            ["provenance.library:SVELITT", "SLS Sverige"],
            ["provenance.library:SA", "Svenska Akademien"],
            ["provenance.library:SFS", "Svenska fornskriftssällskapet"],
            ["provenance.library:SVA", "Svenskt visarkiv"],
            ["author_ids:KunglSamfundet", "Kungl. Samfundet för utgivande av handskrifter"],
            ["provenance.library:SVS", "Svenska Vitterhetssamfundet"]
        ]
    }
] as const
const collectionValues = new Set<LibraryCategory>(
    collectionOptionGroups.flatMap(group => group.options.map(option => option[0]))
)
const collectionSelectGroups = collectionOptionGroups.map(group => ({
    label: group.label,
    options: group.options.map(([value, label]) => ({ value, label }))
}))
const collectionSelectOptions = collectionSelectGroups.flatMap(group => group.options)
const mediaOptions: ReadonlyArray<{ value: LibraryMedia; label: string; title: string }> = [
    {
        value: "mediatype:etext",
        label: "Etext",
        title: "Etext är korrekturläst text som du kan läsa direkt på skärmen; den är sökbar."
    },
    {
        value: "mediatype:faksimil",
        label: "Faksimil",
        title: "Faksimil är fotografier av bokens sidor; den är ibland sökbar."
    },
    {
        value: "has_epub:true",
        label: "Epub",
        title: "Epub kan du med fördel ladda ner till din mobila läsare; den är sökbar."
    },
    {
        value: "mediatype:pdf",
        label: "PDF",
        title: "PDF är en fil som du kan ladda ner; den är sökbar."
    }
]
const languageOptions: ReadonlyArray<{ value: LibraryLanguage; label: string }> = [
    { value: "modernized:true", label: "Moderniserat språk" },
    { value: "modernized:false", label: "Ej moderniserat språk" },
    { value: "translation:true", label: "Översättning" },
    { value: "original:true", label: "På originalspråk" },
    { value: "language:swe", label: "Svenska" },
    { value: "foreign:true", label: "Främmande språk" },
    { value: "language:eng", label: "Engelska" },
    { value: "language:deu", label: "Tyska" },
    { value: "language:fra", label: "Franska" },
    { value: "language:lat", label: "Latin" },
    { value: "language:smi", label: "Samiska språk" },
    { value: "proofread:true", label: "Korrekturläst" },
    { value: "proofread:false", label: "Ej korrekturläst" }
]
const mediaValues = new Set<LibraryMedia>(mediaOptions.map(option => option.value))
const languageValues = new Set<LibraryLanguage>(languageOptions.map(option => option.value))
const mediaSelectOptions = mediaOptions.map(({ value, label }) => ({ value, label }))
const languageSelectOptions = languageOptions.map(({ value, label }) => ({ value, label }))

function orderedLibraryValues<T extends string>(
    values: readonly string[],
    options: readonly { value: T }[]
): T[] {
    const selected = new Set(values)
    return options.filter(option => selected.has(option.value)).map(option => option.value)
}

function queryValue(value: unknown): string {
    return typeof value === "string" ? value : ""
}

function queryList<T extends string>(value: unknown, allowed: ReadonlySet<T>): T[] {
    if (typeof value !== "string" || !value) return []
    const items = value.split(",")
    if (items.some(item => !allowed.has(item as T)) || new Set(items).size !== items.length)
        return []
    const output: T[] = []
    for (const item of items) {
        output.push(item as T)
    }
    return output
}

function queryYearRange(value: unknown): [number, number] | null {
    const bounds = chronologyBounds.value
    if (!bounds) return null
    if (typeof value !== "string" || !/^\d{4},\d{4}$/.test(value)) return null
    const [from, to] = value.split(",").map(Number)
    if (
        !Number.isSafeInteger(from) ||
        !Number.isSafeInteger(to) ||
        from! < bounds.from ||
        to! > bounds.to ||
        from! > to!
    )
        return null
    if (from === bounds.from && to === bounds.to) return null
    return [from!, to!]
}

function advancedFilters(query: LocationQuery): LibraryAdvancedFilters {
    const gender = queryValue(query.kön)
    return {
        gender: gender === "female" || gender === "male" ? gender : "",
        keywords: queryList(query.keywords, collectionValues),
        narrowingKeywords: queryList(query.keywords_aux, collectionValues),
        aboutAuthorIds: queryList(query.about_authors, aboutAuthorIdSet.value),
        media: queryList(query.mediatypes, mediaValues),
        languages: queryList(query.languages, languageValues),
        yearRange: queryYearRange(query.intervall)
    }
}

function routeState(path: string, query: LocationQuery): LibraryRouteState {
    return parseLibraryRouteState(path, query, advancedFilters(query))
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

const libraryClient = createLbApiClient(import.meta.server ? config.apiBase : config.public.apiBase)

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

async function fetchLibraryOptions(): Promise<LibraryOptionsResponse> {
    try {
        const { data } = await libraryClient.GET("/library/options")
        return data ?? { chronology: null, about_authors: null }
    } catch {
        return { chronology: null, about_authors: null }
    }
}

const { data: libraryOptionsData } = await useAsyncData<LibraryOptionsResponse>(
    `library:options:${route.path}`,
    fetchLibraryOptions,
    { default: () => ({ chronology: null, about_authors: null }) }
)
const chronologyBounds = computed<ImprintBounds | null>(() => {
    const chronology = libraryOptionsData.value?.chronology
    return chronology ? { from: chronology.year_from, to: chronology.year_to } : null
})
const aboutAuthorOptionsAvailable = computed(
    () => Array.isArray(libraryOptionsData.value?.about_authors)
)
const chronologyFloor = computed(() => chronologyBounds.value?.from ?? 0)
const chronologyCeiling = computed(() => chronologyBounds.value?.to ?? 0)
const aboutAuthorOptions = computed<AboutAuthorOption[]>(() =>
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
async function fetchInitialData(): Promise<LibraryInitialData> {
    const pagePromise = fetchLibraryPageData(initialState)
    const summaryPromise =
        initialState.standalone || initialState.downloadMode
            ? Promise.resolve(null)
            : fetchLibrarySummary(initialState.filter, initialState.advancedFilters)
    const [page, summary] = await Promise.all([pagePromise, summaryPromise])
    return { page, summary }
}

function emptyInitialData(): LibraryInitialData {
    return { page: emptyPageData(initialState.mode), summary: null }
}

const { data: initialData } = await useAsyncData<LibraryInitialData>(
    `library:${route.path}:${mode}:${initialFilter}:${initialState.sort}:${initialState.page}:${initialState.hide1800}:${initialState.downloadMode}:${JSON.stringify(initialState.advancedFilters)}`,
    fetchInitialData,
    { default: emptyInitialData }
)
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
const advancedOpen = ref(initialState.advanced)
const selectedGender = ref<LibraryGender>(initialState.advancedFilters.gender)
const selectedKeywords = ref<LibraryCategory[]>([...initialState.advancedFilters.keywords])
const selectedNarrowingKeywords = ref<LibraryCategory[]>([
    ...initialState.advancedFilters.narrowingKeywords
])
const selectedAboutAuthorIds = ref<string[]>([...initialState.advancedFilters.aboutAuthorIds])
const selectedMedia = ref<LibraryMedia[]>([...initialState.advancedFilters.media])
const selectedLanguages = ref<LibraryLanguage[]>([...initialState.advancedFilters.languages])
const narrowingSelectGroups = computed(() =>
    collectionSelectGroups.map(group => ({
        ...group,
        options: group.options.map(option => ({
            ...option,
            disabled: selectedKeywords.value.includes(option.value)
        }))
    }))
)
const chronologyFromDraft = ref(
    String(initialState.advancedFilters.yearRange?.[0] ?? chronologyBounds.value?.from ?? "")
)
const chronologyToDraft = ref(
    String(initialState.advancedFilters.yearRange?.[1] ?? chronologyBounds.value?.to ?? "")
)
const chronologyDraftDirty = ref(false)
const mounted = ref(false)
const selectedSourceWorks = ref<Map<string, BrowseResult>>(new Map())
const selectedSourceFormats = ref<Set<string>>(new Set())
const formatPopoverOpen = ref(false)
const formatButtonElement = ref<HTMLButtonElement | null>(null)
const formatPopoverElement = ref<HTMLDivElement | null>(null)
const formatPopoverScrollportElement = ref<HTMLDivElement | null>(null)
const formatPopoverPlacement = ref<"top" | "bottom">("top")
const formatPopoverStyle = ref<CSSProperties>({
    top: "0px",
    left: "0px",
    visibility: "hidden"
})
const formatPopoverScrollportStyle = ref<CSSProperties>({})
const sourceFormatGroups = [
    {
        mediatype: "etext" as const,
        label: "Etext",
        formats: [
            { type: "txt" as const, label: "ren text" },
            { type: "xml" as const, label: "xml" },
            { type: "workdb" as const, label: "Metadata" }
        ]
    },
    {
        mediatype: "faksimil" as const,
        label: "Faksimil",
        formats: [
            { type: "txt" as const, label: "ren text" },
            { type: "xml" as const, label: "xml" },
            { type: "workdb" as const, label: "Metadata" },
            { type: "pdf" as const, label: "PDF" }
        ]
    }
]
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
const visibleSourceWorks = computed(() =>
    workResults.value.data.filter(item => item.sourceExports.length > 0)
)
const selectedSourceWorkList = computed(() => [...selectedSourceWorks.value.values()])
const allVisibleSourceWorksSelected = computed(
    () =>
        visibleSourceWorks.value.length > 0 &&
        visibleSourceWorks.value.every(item => selectedSourceWorks.value.has(item.key))
)
const selectedSourceExports = computed(() =>
    selectedSourceWorkList.value.flatMap(item => item.sourceExports)
)
const sourceFormatAvailability = computed(() => {
    const counts = new Map<string, number>()
    for (const item of selectedSourceExports.value) {
        const key = `${item.mediatype}:${item.type}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
})
const selectedDownloadExports = computed(() =>
    selectedSourceExports.value.filter(item =>
        selectedSourceFormats.value.has(`${item.mediatype}:${item.type}`)
    )
)
const selectedDownloadFiles = computed(() =>
    selectedDownloadExports.value
        .map(item => `${item.lbworkid}-${item.mediatype}-${item.type}`)
        .filter((token, index, all) => all.indexOf(token) === index)
)
const downloadSizeLabel = computed(() => {
    const size = selectedDownloadExports.value.reduce((sum, item) => sum + item.size, 0)
    if (!size) return ""
    return size < 1_050_000
        ? `${Math.round(size / 1024)} KB`
        : `${(size / (1024 * 1024)).toFixed(2)}MB`
})
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let controller: AbortController | null = null
let requestVersion = 0
let summaryVersion = 0
let summaryController: AbortController | null = null
let downloadCountVersion = 0
let downloadCountController: AbortController | null = null
let ownedNavigation: { key: string; version: number } | null = null

type QueryState = {
    standalone: boolean
    mode: LibraryMode
    filter: string
    sort: RelevanceSortKey | BrowseSortKey | LatestSortKey
    page: number
    hide1800: boolean
    downloadMode: boolean
    advancedFilters: LibraryAdvancedFilters
}

function stateKey(state: QueryState): string {
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

function requestState(state: LibraryRouteState): QueryState {
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
    loading.value = false
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

async function runBrowserRequest(state: QueryState, version: number) {
    if (version !== requestVersion) return
    const activeController = new AbortController()
    controller = activeController
    loading.value = true
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

function defaultSortForMode(nextMode: LibraryMode): QueryState["sort"] {
    if (nextMode === "all") return "relevans"
    if (nextMode === "latest") return "nytillkommet"
    if (nextMode === "parts") return "titlar"
    return "popularitet"
}

function selectMode(nextMode: LibraryMode) {
    beginIntent({
        standalone: route.path === "/epub",
        mode: nextMode,
        filter: filter.value,
        sort: defaultSortForMode(nextMode),
        page: 1,
        hide1800: false,
        downloadMode: false,
        advancedFilters: currentState().advancedFilters
    })
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

function clearSourceSelection() {
    selectedSourceWorks.value = new Map()
    selectedSourceFormats.value = new Set()
    formatPopoverOpen.value = false
}

function positionFormatPopover() {
    if (!formatPopoverOpen.value) return
    const button = formatButtonElement.value
    const popover = formatPopoverElement.value
    const scrollport = formatPopoverScrollportElement.value
    if (!button || !popover || !scrollport) return
    const buttonBox = button.getBoundingClientRect()
    const popoverBox = popover.getBoundingClientRect()
    const viewportPadding = 8
    const triggerGap = 10
    const popoverChromeHeight = popoverBox.height - scrollport.clientHeight
    const naturalHeight = scrollport.scrollHeight + popoverChromeHeight
    const availableAbove = Math.max(0, buttonBox.top - triggerGap - viewportPadding)
    const availableBelow = Math.max(
        0,
        window.innerHeight - buttonBox.bottom - triggerGap - viewportPadding
    )
    const placement = naturalHeight <= availableAbove || availableAbove >= availableBelow
        ? "top"
        : "bottom"
    const availableHeight = placement === "top" ? availableAbove : availableBelow
    const boundedScrollportHeight = Math.max(0, availableHeight - popoverChromeHeight)
    const renderedHeight = Math.min(naturalHeight, availableHeight)
    const viewportTop = placement === "top"
        ? buttonBox.top - triggerGap - renderedHeight
        : buttonBox.bottom + triggerGap
    const buttonWidth = Math.round(buttonBox.width)
    const centeredLeft = buttonBox.left + buttonWidth / 2 - popoverBox.width / 2
    const maximumLeft = Math.max(
        viewportPadding,
        window.innerWidth - popoverBox.width - viewportPadding
    )
    const viewportLeft = Math.min(Math.max(centeredLeft, viewportPadding), maximumLeft)
    formatPopoverPlacement.value = placement
    formatPopoverStyle.value = {
        top: `${Math.round(window.scrollY + viewportTop)}px`,
        left: `${Math.round(window.scrollX + viewportLeft)}px`,
        visibility: "visible",
        marginTop: "0px"
    }
    formatPopoverScrollportStyle.value = {
        maxHeight: `${Math.floor(boundedScrollportHeight)}px`,
        overflowY: naturalHeight > availableHeight ? "auto" : "visible"
    }
}

async function toggleFormatPopover() {
    if (formatPopoverOpen.value) {
        formatPopoverOpen.value = false
        return
    }
    formatPopoverStyle.value = {
        top: "0px",
        left: "0px",
        visibility: "hidden",
        marginTop: "0px"
    }
    formatPopoverScrollportStyle.value = {}
    formatPopoverOpen.value = true
    await nextTick()
    positionFormatPopover()
    await nextTick()
    const popover = formatPopoverElement.value
    const focusTarget = popover?.querySelector<HTMLElement>(
        "[data-library-source-format]:not(:disabled)"
    ) ?? popover?.querySelector<HTMLElement>("[data-library-download-submit]:not(:disabled)") ?? popover
    focusTarget?.focus()
}

function handleFormatPopoverKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !formatPopoverOpen.value) return
    event.preventDefault()
    formatPopoverOpen.value = false
    void nextTick(() => formatButtonElement.value?.focus())
}

function toggleSourceWork(item: BrowseResult) {
    if (!downloadMode.value || item.sourceExports.length === 0) return
    const selected = new Map(selectedSourceWorks.value)
    if (selected.has(item.key)) selected.delete(item.key)
    else selected.set(item.key, item)
    selectedSourceWorks.value = selected
}

function selectVisibleSourceWorks() {
    const selected = new Map(selectedSourceWorks.value)
    for (const item of visibleSourceWorks.value) selected.set(item.key, item)
    selectedSourceWorks.value = selected
}

function deselectVisibleSourceWorks() {
    const selected = new Map(selectedSourceWorks.value)
    for (const item of visibleSourceWorks.value) selected.delete(item.key)
    selectedSourceWorks.value = selected
}

function toggleSourceFormat(key: string) {
    if (!sourceFormatAvailability.value.get(key)) return
    const selected = new Set(selectedSourceFormats.value)
    if (selected.has(key)) selected.delete(key)
    else selected.add(key)
    selectedSourceFormats.value = selected
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

function commitGender(event: Event) {
    const value = (event.target as HTMLSelectElement).value
    if (value !== "" && value !== "female" && value !== "male") return
    selectedGender.value = value
    void pushAdvancedQuery("kön", value)
}

function commitMedia(values: string[]) {
    selectedMedia.value = orderedLibraryValues(values, mediaSelectOptions)
    void pushAdvancedQuery("mediatypes", selectedMedia.value.join(","))
}

function commitKeywords(values: string[]) {
    selectedKeywords.value = orderedLibraryValues(values, collectionSelectOptions)
    void pushAdvancedQuery("keywords", selectedKeywords.value.join(","))
}

function commitNarrowingKeywords(values: string[]) {
    selectedNarrowingKeywords.value = orderedLibraryValues(values, collectionSelectOptions)
    void pushAdvancedQuery("keywords_aux", selectedNarrowingKeywords.value.join(","))
}

function commitAboutAuthors(values: string[]) {
    selectedAboutAuthorIds.value = orderedLibraryValues(
        values,
        aboutAuthorOptions.value.map(option => ({ value: option.id }))
    )
    void pushAdvancedQuery("about_authors", selectedAboutAuthorIds.value.join(","))
}

function commitLanguages(values: string[]) {
    selectedLanguages.value = orderedLibraryValues(values, languageSelectOptions)
    void pushAdvancedQuery("languages", selectedLanguages.value.join(","))
}

function setChronologyDraft(endpoint: "from" | "to", value: string) {
    chronologyDraftDirty.value = true
    const numeric = Number(value)
    if (endpoint === "from") {
        const to = Number(chronologyToDraft.value)
        chronologyFromDraft.value = String(Number.isFinite(to) ? Math.min(numeric, to) : numeric)
    } else {
        const from = Number(chronologyFromDraft.value)
        chronologyToDraft.value = String(Number.isFinite(from) ? Math.max(numeric, from) : numeric)
    }
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

async function commitChronologyDraft(endpoint: "from" | "to", value: string) {
    setChronologyDraft(endpoint, value)
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
        const parsedRoute = routeState(route.path, route.query)
        const state = requestState(parsedRoute)
        syncAdvancedControls(parsedRoute)
        currentMode.value = state.mode
        invalidateLibrarySummary(state.filter, state.advancedFilters)
        invalidateDownloadCounts(state.filter, state.advancedFilters)
        filter.value = state.filter
        currentPage.value = state.page
        hide1800.value = state.hide1800
        const sourceModeChanged = downloadMode.value !== state.downloadMode
        downloadMode.value = state.downloadMode
        if (sourceModeChanged) clearSourceSelection()
        if (state.mode === "epub" || state.mode === "pdf") {
            selectedEpubSort.value = state.sort as EpubSortKey
        } else if (state.mode === "all") selectedSort.value = state.sort as RelevanceSortKey
        else if (state.mode === "authors" || state.mode === "works" || state.mode === "parts") {
            selectedBrowseSort.value = state.sort as BrowseSortKey
        }
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
    if (downloadMode.value && state.mode === "works") params.set("nedladdning", "1")
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

const allTabHref = computed(() =>
    stateHref({
        mode: "all",
        filter: filter.value,
        sort: "relevans"
    })
)
const latestTabHref = computed(() =>
    stateHref({
        mode: "latest",
        filter: filter.value,
        sort: "nytillkommet"
    })
)
const authorsTabHref = computed(() =>
    stateHref({
        mode: "authors",
        filter: filter.value,
        sort: "popularitet"
    })
)
const worksTabHref = computed(() =>
    stateHref({
        mode: "works",
        filter: filter.value,
        sort: "popularitet"
    })
)
const partsTabHref = computed(() =>
    stateHref({
        mode: "parts",
        filter: filter.value,
        sort: "titlar"
    })
)
const epubTabHref = computed(() =>
    stateHref({
        mode: "epub",
        filter: filter.value,
        sort: "popularitet"
    })
)
const pdfTabHref = computed(() =>
    stateHref({
        mode: "pdf",
        filter: filter.value,
        sort: "popularitet"
    })
)

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

const downloadResults = computed(() =>
    currentMode.value === "pdf" ? pdfResults.value.data : epubResults.value.data
)
const downloadFailed = computed(() =>
    currentMode.value === "pdf" ? pdfResults.value.failed : epubResults.value.failed
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

function workActionsId(item: BrowseResult): string {
    return `library-work-actions-${encodeURIComponent(item.key)}`
}

function toggleWorkActions(item: BrowseResult) {
    const opening = expandedWorkKey.value !== item.key
    expandedWorkKey.value = opening ? item.key : ""
    const query: LocationQuery = { ...route.query }
    if (opening) query.title = item.titlePath
    else delete query.title
    void router.push({ path: route.path, query })
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

onMounted(() => {
    mounted.value = true
    document.addEventListener("keydown", handleFormatPopoverKeydown)
    window.addEventListener("resize", positionFormatPopover)
    window.addEventListener("scroll", positionFormatPopover, true)
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
    document.removeEventListener("keydown", handleFormatPopoverKeydown)
    window.removeEventListener("resize", positionFormatPopover)
    window.removeEventListener("scroll", positionFormatPopover, true)
})
</script>

<template>
    <div :data-library-mounted="mounted ? 'true' : undefined">
        <h1 class="text-6xl lg:ml-12">
            {{ standalone ? "Hämta e-böcker" : "Botanisera i biblioteket" }}
        </h1>
        <div class="lg:ml-12" :class="{ searching: loading, dl_mode: downloadMode }">
            <div id="controls">
                <form
                    class="lg:p-5 p-2 lg:border border-gray-900 w-full lg:max-w-5xl"
                    @submit.prevent="submitSearch"
                >
                    <div class="main_input flex flex-wrap -ml-6 relative mb-8 items-center">
                        <svg
                            class="w-6 h-6 relative left-10 top-0 -mt-px"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#7A1400"
                            stroke-width="1.5"
                            aria-hidden="true"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                            />
                        </svg>
                        <input
                            v-model="filter"
                            data-library-filter
                            class="filter_input border border-gray-500 mr-4 flex-grow py-3 pl-12 pr-4 text-base"
                            autofocus
                            placeholder="Skriv författarnamn eller titel"
                            autocomplete="off"
                            autocorrect="off"
                            autocapitalize="none"
                            spellcheck="false"
                            @input="scheduleSearch"
                        >
                        <button type="submit" class="sr-only" tabindex="-1">Sök</button>
                        <button
                            v-show="hasActiveFilters"
                            type="button"
                            data-library-reset
                            class="reset text-gray-700 transition duration-200 w-6 h-6 relative -left-14 top-0 -mr-8 cursor-pointer bg-transparent border-0 p-0"
                            aria-label="Rensa sökning"
                            @click="resetSearch"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.5"
                                aria-hidden="true"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M6 18 18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                        <button
                            type="button"
                            data-library-advanced
                            :title="advancedOpen ? 'Enkel sökning' : 'Utökad sökning'"
                            :aria-expanded="advancedOpen"
                            aria-controls="library-advanced-panel"
                            class="bg-white border border-gray-500 self-stretch px-4 focus:ring-1 focus:ring-inset focus:ring-primary"
                            @click="toggleAdvanced"
                        >
                            <span class="uppercase text-xs"
                                >{{ advancedOpen ? "Dölj" : "Visa" }} utökad sökning</span
                            >{{ " " }}
                            <svg
                                v-if="!advancedOpen"
                                data-library-filter-icon
                                class="filter w-6 h-6 relative top-1 inline-block text-gray-700"
                                viewBox="0 0 24 24"
                                fill="none"
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
                                data-library-filter-icon
                                class="filter w-6 h-6 relative top-1 inline-block text-gray-700"
                                viewBox="0 0 24 24"
                                fill="none"
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
                    <div
                        v-if="advancedOpen"
                        id="library-advanced-panel"
                        data-library-advanced-panel
                        class="more_container show_more mt-2 mb-4"
                    >
                        <div class="title_select_container">
                            <label
                                class="library-gender-control select2-container select2-container--default"
                            >
                                <span class="sr-only">Författarkön</span>
                                <select
                                    :value="selectedGender"
                                    data-library-gender
                                    class="gender_select"
                                    :class="{ 'library-select-placeholder': !selectedGender }"
                                    aria-label="Författarkön"
                                    @change="commitGender"
                                >
                                    <option value="" :selected="selectedGender === ''">
                                        Filtrera: kvinnliga / manliga / alla
                                    </option>
                                    <option value="female" :selected="selectedGender === 'female'">
                                        Kvinnliga författare
                                    </option>
                                    <option value="male" :selected="selectedGender === 'male'">
                                        Manliga författare
                                    </option>
                                </select>
                                <span class="selection" aria-hidden="true">
                                    <span
                                        data-library-gender-visual
                                        class="select2-selection select2-selection--single"
                                    >
                                        <span
                                            class="select2-selection__rendered"
                                            :title="
                                                selectedGender === ''
                                                    ? 'Alla författare'
                                                    : undefined
                                            "
                                            >{{
                                                selectedGender === "female"
                                                    ? "Kvinnliga författare"
                                                    : selectedGender === "male"
                                                      ? "Manliga författare"
                                                      : "Filtrera: kvinnliga / manliga / alla"
                                            }}</span
                                        >
                                        <span class="select2-selection__arrow"><b /></span>
                                    </span>
                                </span>
                            </label>
                        </div>
                        <div class="title_select_container">
                            <label>
                                <span class="sr-only">Kategorier och utgivare</span>
                                <SearchMultiSelect
                                    data-library-keywords
                                    class="keyword_select"
                                    persistent-input-row
                                    accessible-name="Filtrera: Kategorier / Utgivare"
                                    :model-value="selectedKeywords"
                                    :options="collectionSelectOptions"
                                    :option-groups="collectionSelectGroups"
                                    :space-after-remove="false"
                                    placeholder="Filtrera: Kategorier / Utgivare"
                                    @update:model-value="commitKeywords"
                                />
                            </label>
                        </div>
                        <div
                            v-if="!standalone && aboutAuthorOptions.length"
                            class="title_select_container about_container"
                        >
                            <label>
                                <span class="sr-only">Om ett författarskap</span>
                                <SearchMultiSelect
                                    data-library-about-authors
                                    class="about_select"
                                    accessible-name="Om ett författarskap"
                                    :model-value="selectedAboutAuthorIds"
                                    :options="
                                        aboutAuthorOptions.map(author => ({
                                            value: author.id,
                                            label: author.label
                                        }))
                                    "
                                    placeholder="Om ett författarskap"
                                    searchable
                                    internal-search
                                    persistent-input-row
                                    @update:model-value="commitAboutAuthors"
                                />
                            </label>
                        </div>
                        <div v-if="!standalone">
                            <div class="text-sm mb-4 max-w-sm">
                                Får du för många träffar? Välj ytterligare samlingar (en eller
                                flera) i menyn
                                <span class="sc">AVGRÄNSA SÖKNINGEN</span> här nedanför. Ju fler
                                samlingar du väljer, desto färre sökträffar får du.
                            </div>
                            <label>
                                <span class="sr-only">Avgränsa sökningen</span>
                                <SearchMultiSelect
                                    data-library-narrowing
                                    class="keyword_select block"
                                    persistent-input-row
                                    accessible-name="Avgränsa sökningen"
                                    :model-value="selectedNarrowingKeywords"
                                    :options="collectionSelectOptions"
                                    :option-groups="narrowingSelectGroups"
                                    :space-after-remove="false"
                                    placeholder="Avgränsa sökningen"
                                    @update:model-value="commitNarrowingKeywords"
                                />
                            </label>
                        </div>
                        <div class="title_select_container">
                            <label>
                                <span class="sr-only">Utgivningsformat</span>
                                <SearchMultiSelect
                                    data-library-media
                                    class="keyword_select"
                                    persistent-input-row
                                    accessible-name="Utgivningsformat"
                                    :model-value="selectedMedia"
                                    :options="mediaSelectOptions"
                                    :space-after-remove="false"
                                    placeholder="Utgivningsformat"
                                    @update:model-value="commitMedia"
                                />
                            </label>
                        </div>
                        <div class="title_select_container">
                            <label>
                                <span class="sr-only">Språk och status</span>
                                <SearchMultiSelect
                                    data-library-languages
                                    class="keyword_select"
                                    persistent-input-row
                                    accessible-name="Språk …"
                                    :model-value="selectedLanguages"
                                    :options="languageSelectOptions"
                                    :space-after-remove="false"
                                    placeholder="Språk …"
                                    @update:model-value="commitLanguages"
                                />
                            </label>
                        </div>
                        <div
                            v-if="!standalone"
                            class="more ml-[2px] relative"
                            :class="{ show_more: downloadMode }"
                        >
                            <a
                                data-library-download-mode
                                role="button"
                                tabindex="0"
                                @click.prevent="toggleDownloadMode"
                                @keydown.enter.prevent="toggleDownloadMode"
                                @keydown.space.prevent="toggleDownloadMode"
                            >
                                <i class="fa fa-download color-black mr-1 text-xs" />{{ " "
                                }}<span>{{
                                    downloadMode ? "Stäng källmaterial" : "Ladda ner källmaterial"
                                }}</span>
                            </a>
                        </div>
                        <div v-if="downloadMode" class="more_container h-8 relative mb-4 show_more">
                            <button
                                v-if="!allVisibleSourceWorksSelected"
                                type="button"
                                data-library-select-visible
                                class="sc btn btn-small absolute left"
                                @click="selectVisibleSourceWorks"
                            >
                                Välj alla verk i listan
                            </button>
                            <button
                                v-else
                                type="button"
                                data-library-deselect-visible
                                class="sc btn btn-small absolute left"
                                @click="deselectVisibleSourceWorks"
                            >
                                Avmarkera alla verk i listan
                            </button>
                        </div>
                    </div>
                    <div class="chronology primarycolor ml-px pl-px">
                        <i class="fa fa-clock-o mr-1 ml-px" />{{ " " }}
                        <span class="sc mt-8">Tidslinje: kronologisk sökning</span>
                    </div>
                    <div v-if="chronologyBounds" data-library-chronology-range class="flex">
                        <ChronologyRangeSlider
                            class="mt-3 slider-large chronology_ranges"
                            :min="chronologyFloor"
                            :max="chronologyCeiling"
                            :from="chronologyFromDraft"
                            :to="chronologyToDraft"
                            from-label="Från tryckår reglage"
                            to-label="Till tryckår reglage"
                            @draft="setChronologyDraft"
                            @commit="commitChronologyDraft"
                            @cancel="resetChronologyDraft"
                        />
                        <div class="whitespace-nowrap self-center chronology_inputs">
                            <span class="text-sm sc">Tryckår: </span>
                            <input
                                class="text-sm text-center py-1"
                                type="text"
                                :value="chronologyFromDraft"
                                aria-label="Från tryckår"
                                @input="
                                    setChronologyDraft(
                                        'from',
                                        ($event.target as HTMLInputElement).value
                                    )
                                "
                                @change="
                                    commitChronologyDraft(
                                        'from',
                                        ($event.target as HTMLInputElement).value
                                    )
                                "
                            >{{ " " }}
                            <span class="text-sm sc">till </span>
                            <input
                                class="text-sm text-center py-1"
                                type="text"
                                :value="chronologyToDraft"
                                aria-label="Till tryckår"
                                @input="
                                    setChronologyDraft(
                                        'to',
                                        ($event.target as HTMLInputElement).value
                                    )
                                "
                                @change="
                                    commitChronologyDraft(
                                        'to',
                                        ($event.target as HTMLInputElement).value
                                    )
                                "
                            >
                        </div>
                    </div>
                    <div v-else data-library-chronology-unavailable class="text-sm py-1">
                        Tidslinjen kunde inte hämtas.
                    </div>
                    <div class="btn-group p-0 mt-4 lg:mt-6">
                        <template v-if="standalone">
                            <a
                                data-library-tab="epub"
                                :href="epubTabHref"
                                :aria-current="currentMode === 'epub' ? 'page' : undefined"
                                class="sc btn btn-small text-base"
                                :class="{ active: currentMode === 'epub' }"
                                @click.prevent="selectMode('epub')"
                                >Epub<span v-if="epubTabCount" class="num_hits"
                                    >: {{ epubTabCount }}</span
                                ></a
                            >
                            <template v-if="currentMode !== 'all'">{{ " " }}</template>
                            <a
                                data-library-tab="pdf"
                                :href="pdfTabHref"
                                :aria-current="currentMode === 'pdf' ? 'page' : undefined"
                                class="sc btn btn-small text-base"
                                :class="{
                                    active: currentMode === 'pdf',
                                    'relevance-unavailable': currentMode !== 'pdf' && !pdfTabCount
                                }"
                                @click.prevent="selectMode('pdf')"
                                >PDF<span v-if="pdfTabCount" class="num_hits"
                                    >: {{ pdfTabCount }}</span
                                ></a
                            >
                        </template>
                        <template v-else>
                            <a
                                data-library-tab="all"
                                :href="allTabHref"
                                :aria-current="currentMode === 'all' ? 'page' : undefined"
                                class="sc btn btn-small text-base"
                                :class="{ active: currentMode === 'all' }"
                                @click.prevent="selectMode('all')"
                                >Alla träffar</a
                            >
                            <template v-if="currentMode !== 'all'">{{ " " }}</template>
                            <a
                                data-library-tab="latest"
                                :href="latestTabHref"
                                :aria-current="currentMode === 'latest' ? 'page' : undefined"
                                class="sc btn btn-small text-base"
                                :class="{ active: currentMode === 'latest' }"
                                @click.prevent="selectMode('latest')"
                                >Nytt</a
                            >
                            <template v-if="currentMode !== 'all'">{{ " " }}</template>
                            <a
                                data-library-tab="authors"
                                :href="authorsTabHref"
                                :aria-current="currentMode === 'authors' ? 'page' : undefined"
                                class="sc btn btn-small text-base"
                                :class="{
                                    active: currentMode === 'authors',
                                    'library-tab-disabled-look':
                                        downloadMode || librarySummary.authors === 0
                                }"
                                :aria-disabled="downloadMode || undefined"
                                @click.prevent="!downloadMode && selectMode('authors')"
                                >Författare<span
                                    v-if="librarySummary.authors !== null"
                                    class="num_hits"
                                    >: {{ librarySummary.authors }}</span
                                ></a
                            >
                            <template v-if="currentMode !== 'all'">{{ " " }}</template>
                            <a
                                data-library-tab="works"
                                :href="worksTabHref"
                                :aria-current="currentMode === 'works' ? 'page' : undefined"
                                class="sc btn btn-small text-base"
                                :class="{ active: currentMode === 'works' }"
                                @click.prevent="selectMode('works')"
                                >Verk<span v-if="librarySummary.works !== null" class="num_hits"
                                    >: {{ librarySummary.works }}</span
                                ></a
                            >
                            <template v-if="currentMode !== 'all'">{{ " " }}</template>
                            <a
                                v-if="!downloadMode"
                                data-library-tab="parts"
                                :href="partsTabHref"
                                :aria-current="currentMode === 'parts' ? 'page' : undefined"
                                class="sc btn btn-small text-base"
                                :class="{
                                    active: currentMode === 'parts',
                                    'library-tab-disabled-look': librarySummary.parts === 0
                                }"
                                @click.prevent="selectMode('parts')"
                                >Dikt, novell, etc.<span
                                    v-if="librarySummary.parts !== null"
                                    class="parts num_hits"
                                    >: {{ librarySummary.parts }}</span
                                ></a
                            >
                            <template v-if="!downloadMode && currentMode !== 'all'">{{
                                " "
                            }}</template>
                            <a
                                v-if="!downloadMode"
                                data-library-tab="epub"
                                :href="epubTabHref"
                                :aria-current="currentMode === 'epub' ? 'page' : undefined"
                                class="sc btn btn-small text-base"
                                :class="{
                                    active: currentMode === 'epub',
                                    'relevance-unavailable': currentMode === 'all' && !epubTabCount
                                }"
                                @click.prevent="selectMode('epub')"
                                >Epub<span v-if="epubTabCount !== null" class="num_hits"
                                    >: {{ epubTabCount }}</span
                                ></a
                            >
                            <template v-if="!downloadMode && currentMode !== 'all'">{{
                                " "
                            }}</template>
                            <a
                                v-if="!downloadMode"
                                data-library-tab="pdf"
                                :href="pdfTabHref"
                                :aria-current="currentMode === 'pdf' ? 'page' : undefined"
                                class="sc btn btn-small text-base"
                                :class="{
                                    active: currentMode === 'pdf',
                                    'relevance-unavailable': currentMode !== 'pdf' && !pdfTabCount
                                }"
                                @click.prevent="selectMode('pdf')"
                                >PDF<span v-if="pdfTabCount !== null" class="num_hits"
                                    >: {{ pdfTabCount }}</span
                                ></a
                            >
                        </template>
                    </div>
                </form>
            </div>
            <div class="flex items-stretch w-full lg:max-w-5xl text-lg leading-tight">
                <div class="bg-white/65 lg:p-6 p-2 lg:border border-gray-900 flex-grow">
                    <div
                        v-if="currentMode === 'all'"
                        class="result relevance pl-0 lg:ml-3 w-full lg:w-auto"
                    >
                        <div class="text-base">
                            <div class="inline-block sc mr-2">Sortera:</div>
                            <ul class="part_header top_header mb-4 inline-block">
                                <li v-for="item in sorts" :key="item.key" class="inline-block sc">
                                    <a
                                        :href="relevanceSortHref(item.key)"
                                        class="sort_item"
                                        :class="{ active: selectedSort === item.key }"
                                        :data-library-sort="item.key"
                                        @click.prevent="selectSort(item.key)"
                                        >{{ item.label }}</a
                                    >
                                    <i
                                        v-if="selectedSort === item.key"
                                        class="fa"
                                        :class="
                                            isSortReversed(currentMode, item.key)
                                                ? 'fa-caret-up'
                                                : 'fa-caret-down'
                                        "
                                    />
                                </li>
                            </ul>
                        </div>
                        <div
                            v-if="loading"
                            class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0"
                        >
                            <i class="spinner fa fa-spinner fa-pulse" />
                        </div>
                        <div v-else>
                            <div v-if="results.failed" data-library-error>Ett fel uppstod.</div>
                            <div v-else-if="!results.data.length" data-library-empty class="pb-4">
                                Inga träffar.
                            </div>
                            <table v-else class="w-full -ml-4">
                                <tbody>
                                    <tr
                                        v-for="(item, index) in results.data"
                                        :key="`${item.index}:${item.primaryHref}:${index}`"
                                        data-library-result
                                        class="lg:table-row flex flex-col justify-between pb-2 lg:pb-0 -ml-2 hover:bg-gray-300 hover:bg-opacity-80 transition-colors duration-150"
                                    >
                                        <td class="lg:text-right lg:table-cell w-44">
                                            <span
                                                class="sc primarycolor whitespace-nowrap text-base"
                                                >{{ item.sourceLabel }}</span
                                            >
                                        </td>
                                        <td class="order-2 min-w-0">
                                            <a
                                                v-if="
                                                    item.download ||
                                                    !isNuxtInternalHref(item.primaryHref)
                                                "
                                                :href="item.primaryHref"
                                                :download="item.download || undefined"
                                                :data-library-author-name="
                                                    item.index === 'author' || undefined
                                                "
                                                :data-library-result-title="
                                                    item.fullTitle ? '' : undefined
                                                "
                                                :title="
                                                    item.fullTitle &&
                                                    item.fullTitle !== item.primaryLabel
                                                        ? item.fullTitle
                                                        : undefined
                                                "
                                                :class="
                                                    item.fullTitle
                                                        ? 'block max-w-[calc(100vw-2rem)] lg:max-w-[32rem] whitespace-nowrap overflow-hidden text-ellipsis'
                                                        : undefined
                                                "
                                            >
                                                <template v-if="item.index === 'author'">
                                                    <span class="surname">{{
                                                        item.authorSurname
                                                    }}</span
                                                    ><span v-if="item.authorGivenNames">,</span>
                                                    {{ item.authorGivenNames }}
                                                    <span
                                                        v-if="item.mobileYearLabel"
                                                        data-library-author-mobile-years
                                                        class="lg:hidden"
                                                        >{{ item.mobileYearLabel }}</span
                                                    >
                                                </template>
                                                <template v-else>{{ item.primaryLabel }}</template>
                                            </a>
                                            <NuxtLink
                                                v-else
                                                :to="canonicalNuxtHref(item.primaryHref)"
                                                :data-library-author-name="
                                                    item.index === 'author' || undefined
                                                "
                                                :data-library-result-title="
                                                    item.fullTitle ? '' : undefined
                                                "
                                                :title="
                                                    item.fullTitle &&
                                                    item.fullTitle !== item.primaryLabel
                                                        ? item.fullTitle
                                                        : undefined
                                                "
                                                :class="
                                                    item.fullTitle
                                                        ? 'block max-w-[calc(100vw-2rem)] lg:max-w-[32rem] whitespace-nowrap overflow-hidden text-ellipsis'
                                                        : undefined
                                                "
                                            >
                                                <template v-if="item.index === 'author'">
                                                    <span class="surname">{{
                                                        item.authorSurname
                                                    }}</span
                                                    ><span v-if="item.authorGivenNames">,</span>
                                                    {{ item.authorGivenNames }}
                                                    <span
                                                        v-if="item.mobileYearLabel"
                                                        data-library-author-mobile-years
                                                        class="lg:hidden"
                                                        >{{ item.mobileYearLabel }}</span
                                                    >
                                                </template>
                                                <template v-else>{{ item.primaryLabel }}</template>
                                            </NuxtLink>
                                            <ul
                                                v-if="item.highlights.length"
                                                class="highlight list-none p-0 m-0"
                                            >
                                                <li
                                                    v-for="(
                                                        fragment, fragmentIndex
                                                    ) in item.highlights"
                                                    :key="fragmentIndex"
                                                    data-library-highlight
                                                    class="text-xs relative z-10"
                                                >
                                                    {{ "”… "
                                                    }}<template
                                                        v-for="(
                                                            segment, segmentIndex
                                                        ) in fragment.segments"
                                                        :key="segmentIndex"
                                                        ><em
                                                            v-if="segment.hit"
                                                            data-library-highlight-hit
                                                            class="hit"
                                                            >{{ segment.text }}</em
                                                        ><template v-else>{{
                                                            segment.text
                                                        }}</template></template
                                                    >{{ " …”" }}
                                                </li>
                                            </ul>
                                        </td>
                                        <td
                                            class="lg:text-right hidden lg:table-cell text-base w-28 whitespace-nowrap"
                                        >
                                            <NuxtLink
                                                v-if="
                                                    item.index !== 'author' &&
                                                    isImprintYear(item.yearLabel)
                                                "
                                                data-library-imprint-year
                                                class="text-current"
                                                :to="imprintYearTo(item.yearLabel)"
                                                >{{ item.yearLabel }}</NuxtLink
                                            ><template v-else>{{ item.yearLabel }}</template>
                                        </td>
                                        <td
                                            class="lg:text-right lg:uppercase lg:text-sm lg:pl-4 order-1 lg:max-w-40"
                                        >
                                            <NuxtLink
                                                v-if="item.authorHref"
                                                :to="canonicalNuxtHref(item.authorHref)"
                                                >{{ item.secondaryAuthor }}</NuxtLink
                                            >
                                            <span v-else class="text-gray-800">{{
                                                item.secondaryAuthor
                                            }}</span>
                                            <span
                                                v-if="item.authorContribution"
                                                data-library-author-contribution
                                                class="text-gray-600 text-xs"
                                                >{{ item.authorContribution }}</span
                                            >
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <nav v-if="pageCount > 1" aria-label="Sidnavigation">
                            <ul class="pagination pagination-sm sc">
                                <li :class="{ disabled: currentPage <= 1 }">
                                    <span
                                        v-if="currentPage <= 1"
                                        data-library-pagination-previous
                                        aria-disabled="true"
                                        >Föregående</span
                                    >
                                    <a
                                        v-else
                                        data-library-pagination-previous
                                        :href="allPageHref(currentPage - 1)"
                                        @click.prevent="selectPage(currentPage - 1)"
                                        >Föregående</a
                                    >
                                </li>
                                <li
                                    v-for="item in pages"
                                    :key="item.key"
                                    :class="{ active: item.page === currentPage }"
                                >
                                    <a
                                        :data-library-page="
                                            item.label === '...' ? undefined : item.page
                                        "
                                        :data-library-pagination-ellipsis="
                                            item.label === '...' || undefined
                                        "
                                        :href="allPageHref(item.page)"
                                        :aria-current="
                                            item.page === currentPage ? 'page' : undefined
                                        "
                                        @click.prevent="selectPage(item.page)"
                                        >{{ item.label }}</a
                                    >
                                </li>
                                <li :class="{ disabled: currentPage >= pageCount }">
                                    <span
                                        v-if="currentPage >= pageCount"
                                        data-library-pagination-next
                                        aria-disabled="true"
                                        >Nästa</span
                                    >
                                    <a
                                        v-else
                                        data-library-pagination-next
                                        :href="allPageHref(currentPage + 1)"
                                        @click.prevent="selectPage(currentPage + 1)"
                                        >Nästa</a
                                    >
                                </li>
                            </ul>
                        </nav>
                    </div>
                    <div
                        v-else-if="currentMode === 'latest'"
                        class="result title pl-0 flex-column min-h-500"
                    >
                        <div class="flex items-baseline">
                            <div class="text-base">
                                <div class="inline-block sc mr-2">Sortera:</div>
                                {{ " " }}
                                <ul class="part_header top_header mb-4 inline-block">
                                    <li class="inline-block sc">
                                        <a
                                            data-library-sort="nytillkommet"
                                            class="sort_item active"
                                            :href="latestSortHref"
                                            @click.prevent="selectSort('nytillkommet')"
                                            >Nytt</a
                                        >{{ " "
                                        }}<i
                                            class="fa"
                                            :class="
                                                isSortReversed(currentMode, 'nytillkommet')
                                                    ? 'fa-caret-up'
                                                    : 'fa-caret-down'
                                            "
                                        />
                                    </li>
                                </ul>
                            </div>
                            <span class="sc ml-4">
                                <span>{{ hide1800 ? "Visa även från:" : "Dölj verk:" }}</span
                                >{{ " " }}
                                <button
                                    type="button"
                                    data-library-hide-1800
                                    class="text-primary sc ml-2 hover:text-gray-900 cursor-pointer bg-transparent border-0 p-0"
                                    @click="toggle1800"
                                >
                                    Nya vägar till det förflutna
                                </button>
                            </span>
                        </div>
                        <div
                            v-if="loading"
                            data-library-loading
                            class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0"
                        >
                            <i class="spinner fa fa-spinner fa-pulse" />
                        </div>
                        <div v-if="latestResults.failed" data-library-error>Ett fel uppstod.</div>
                        <div
                            v-else-if="!latestResults.groups.length"
                            data-library-empty
                            class="pb-4"
                        >
                            Inga träffar.
                        </div>
                        <table v-else id="table" class="table w-full flex-grow -ml-2">
                            <tbody class="block">
                                <template
                                    v-for="group in latestResults.groups"
                                    :key="group.imported"
                                >
                                    <tr class="header grid grid-cols-1 w-full items-baseline">
                                        <td class="type_header block">
                                            <h3
                                                data-library-latest-header
                                                class="row_title part_header"
                                            >
                                                {{ group.label }}
                                            </h3>
                                        </td>
                                    </tr>
                                    <tr
                                        v-for="item in group.results"
                                        :key="`${group.imported}:${item.titleId}:${item.titleHref}`"
                                        data-library-latest-row
                                        class="work_link grid w-full items-baseline transition-colors duration-150 hover:bg-gray-300 hover:bg-opacity-50 grid-cols-[minmax(0,1fr)_11rem] sm:grid-cols-[minmax(0,1fr)_7rem_11rem]"
                                    >
                                        <td class="block min-w-0">
                                            <div
                                                class="text-ellipsis whitespace-nowrap overflow-hidden min-w-0 items-center gap-2"
                                            >
                                                <div
                                                    class="header_container min-w-0 flex-1 align-middle"
                                                >
                                                    <div
                                                        class="header block overflow-hidden text-ellipsis whitespace-nowrap text-lg leading-tight"
                                                    >
                                                        <span class="title_inner">
                                                            <NuxtLink
                                                                v-library-tooltip="
                                                                    item.titleTooltip
                                                                "
                                                                :data-library-latest-title="
                                                                    item.titleId
                                                                "
                                                                data-library-tooltip-kind="title"
                                                                :to="
                                                                    canonicalNuxtHref(
                                                                        item.titleHref
                                                                    )
                                                                "
                                                                >{{ item.title }}</NuxtLink
                                                            >
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="text-left hidden sm:block w-28 text-base">
                                            <NuxtLink
                                                v-if="isImprintYear(item.year)"
                                                data-library-imprint-year
                                                class="text-current"
                                                :to="imprintYearTo(item.year)"
                                                >{{ item.year }}</NuxtLink
                                            ><template v-else>{{ item.year }}</template>
                                        </td>
                                        <td class="block w-44 text-right">
                                            <div
                                                class="text-ellipsis whitespace-nowrap overflow-hidden"
                                            >
                                                <span class="author uppercase text-sm">
                                                    <NuxtLink
                                                        v-library-tooltip="item.authorTooltip"
                                                        data-library-tooltip-kind="author"
                                                        :to="canonicalNuxtHref(item.authorHref)"
                                                        >{{ item.surname }}</NuxtLink
                                                    ><template v-if="item.roleSuffix"
                                                        >{{ " "
                                                        }}<span class="text-gray-700 sc">{{
                                                            item.roleSuffix.trim()
                                                        }}</span></template
                                                    >
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                        <nav v-if="pageCount > 1" aria-label="Sidnavigation">
                            <ul class="pagination pagination-sm sc">
                                <li :class="{ disabled: currentPage <= 1 }">
                                    <span
                                        v-if="currentPage <= 1"
                                        data-library-pagination-previous
                                        aria-disabled="true"
                                        >Föregående</span
                                    >
                                    <a
                                        v-else
                                        data-library-pagination-previous
                                        :href="latestPageHref(currentPage - 1)"
                                        @click.prevent="selectPage(currentPage - 1)"
                                        >Föregående</a
                                    >
                                </li>
                                <li
                                    v-for="item in pages"
                                    :key="item.key"
                                    :class="{ active: item.page === currentPage }"
                                >
                                    <a
                                        :data-library-page="
                                            item.label === '...' ? undefined : item.page
                                        "
                                        :data-library-pagination-ellipsis="
                                            item.label === '...' || undefined
                                        "
                                        :href="latestPageHref(item.page)"
                                        :aria-current="
                                            item.page === currentPage ? 'page' : undefined
                                        "
                                        @click.prevent="selectPage(item.page)"
                                        >{{ item.label }}</a
                                    >
                                </li>
                                <li :class="{ disabled: currentPage >= pageCount }">
                                    <span
                                        v-if="currentPage >= pageCount"
                                        data-library-pagination-next
                                        aria-disabled="true"
                                        >Nästa</span
                                    >
                                    <a
                                        v-else
                                        data-library-pagination-next
                                        :href="latestPageHref(currentPage + 1)"
                                        @click.prevent="selectPage(currentPage + 1)"
                                        >Nästa</a
                                    >
                                </li>
                            </ul>
                        </nav>
                    </div>
                    <div
                        v-else-if="currentMode === 'authors'"
                        class="result author pl-0 flex-column min-h-500"
                    >
                        <div class="text-base">
                            <div class="inline-block sc mr-2">Sortera:</div>
                            <ul class="part_header top_header mb-4 inline-block">
                                <li
                                    v-for="item in activeBrowseSorts"
                                    :key="item.key"
                                    class="inline-block sc"
                                >
                                    <a
                                        :href="browseSortHref(item.key)"
                                        class="sort_item"
                                        :class="{ active: selectedBrowseSort === item.key }"
                                        :data-library-sort="item.key"
                                        @click.prevent="selectSort(item.key)"
                                        >{{ item.label }}</a
                                    ><template v-if="selectedBrowseSort === item.key"
                                        >{{ " "
                                        }}<i
                                            class="fa"
                                            :class="
                                                isSortReversed(currentMode, item.key)
                                                    ? 'fa-caret-up'
                                                    : 'fa-caret-down'
                                            "
                                    /></template>
                                </li>
                            </ul>
                        </div>
                        <div
                            v-if="loading"
                            data-library-loading
                            class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0"
                        >
                            <i class="spinner fa fa-spinner fa-pulse" />
                        </div>
                        <div v-if="authorResults.failed" data-library-error>Ett fel uppstod.</div>
                        <div v-else-if="!authorResults.data.length" data-library-empty class="pb-4">
                            Inga träffar.
                        </div>
                        <table v-else class="table flex-grow w-full">
                            <tbody>
                                <tr
                                    v-for="(item, index) in authorResults.data"
                                    :key="`${item.primaryHref}:${index}`"
                                    data-library-author-row
                                    class="hover:bg-gray-300 hover:bg-opacity-80 transition-colors duration-150"
                                >
                                    <td class="author_row">
                                        <NuxtLink
                                            :to="canonicalNuxtHref(item.primaryHref)"
                                            data-library-author-name
                                        >
                                            <span class="surname uppercase">{{
                                                item.authorSurname
                                            }}</span
                                            ><span v-if="item.authorGivenNames">,</span>
                                            {{ item.authorGivenNames }}
                                        </NuxtLink>
                                    </td>
                                    <td>{{ item.yearLabel }}</td>
                                </tr>
                                <tr v-if="authorResults.data.length < authorResults.hits">
                                    <td>
                                        <button
                                            type="button"
                                            data-library-authors-show-all
                                            class="btn btn-sm show_all"
                                            :disabled="loading"
                                            @click="loadAllAuthors"
                                        >
                                            Visa alla
                                            <span class="num">{{ authorResults.hits }}</span>
                                            träffar
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div
                        v-else-if="currentMode === 'works' || currentMode === 'parts'"
                        class="result title pl-0 flex-column min-h-500"
                    >
                        <div class="text-base">
                            <div class="inline-block sc mr-2">Sortera:</div>
                            <ul class="part_header top_header mb-4 inline-block">
                                <li
                                    v-for="item in activeBrowseSorts"
                                    :key="item.key"
                                    class="inline-block sc"
                                >
                                    <a
                                        :href="browseSortHref(item.key)"
                                        class="sort_item"
                                        :class="{ active: selectedBrowseSort === item.key }"
                                        :data-library-sort="item.key"
                                        @click.prevent="selectSort(item.key)"
                                        >{{ item.label }}</a
                                    ><template v-if="selectedBrowseSort === item.key"
                                        >{{ " "
                                        }}<i
                                            class="fa"
                                            :class="
                                                isSortReversed(currentMode, item.key)
                                                    ? 'fa-caret-up'
                                                    : 'fa-caret-down'
                                            "
                                    /></template>
                                </li>
                            </ul>
                        </div>
                        <div
                            v-if="loading"
                            data-library-loading
                            class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0"
                        >
                            <i class="spinner fa fa-spinner fa-pulse" />
                        </div>
                        <div v-if="browseResults.failed" data-library-error>Ett fel uppstod.</div>
                        <div v-else-if="!browseResults.data.length" data-library-empty class="pb-4">
                            Inga träffar.
                        </div>
                        <table
                            v-else-if="currentMode === 'works'"
                            id="table"
                            class="table w-full flex-grow -ml-2"
                        >
                            <tbody class="block">
                                <tr
                                    v-for="item in browseResults.data"
                                    :key="item.key"
                                    data-library-work-row
                                    class="work_link grid w-full items-baseline transition-colors duration-150 hover:bg-gray-300 hover:bg-opacity-50 grid-cols-[minmax(0,1fr)_11rem] sm:grid-cols-[minmax(0,1fr)_7rem_11rem]"
                                    @click="downloadMode && toggleSourceWork(item)"
                                >
                                    <td class="block min-w-0">
                                        <div
                                            class="min-w-0 items-center gap-2"
                                            :class="{ flex: downloadMode }"
                                        >
                                            <input
                                                v-if="downloadMode"
                                                data-library-source-checkbox
                                                class="align-middle shrink-0 relative z-10"
                                                type="checkbox"
                                                :checked="selectedSourceWorks.has(item.key)"
                                                :disabled="item.sourceExports.length === 0"
                                                :aria-label="`Välj ${item.title}`"
                                                @click.stop
                                                @change="toggleSourceWork(item)"
                                            >
                                            <div
                                                class="header block text-lg leading-tight"
                                                :class="{ 'min-w-0 flex-1': downloadMode }"
                                            >
                                                <span class="title_inner">
                                                    <button
                                                        v-library-tooltip="item.titleTooltip"
                                                        type="button"
                                                        data-library-work-toggle
                                                        data-library-tooltip-kind="title"
                                                        class="library-work-toggle"
                                                        :aria-controls="
                                                            !downloadMode
                                                                ? workActionsId(item)
                                                                : undefined
                                                        "
                                                        :aria-expanded="
                                                            !downloadMode
                                                                ? expandedWorkKey === item.key
                                                                : undefined
                                                        "
                                                        :aria-pressed="
                                                            downloadMode
                                                                ? selectedSourceWorks.has(item.key)
                                                                : undefined
                                                        "
                                                        :disabled="
                                                            downloadMode &&
                                                            item.sourceExports.length === 0
                                                        "
                                                        @click.stop="
                                                            downloadMode
                                                                ? toggleSourceWork(item)
                                                                : toggleWorkActions(item)
                                                        "
                                                    >
                                                        {{ item.title }}
                                                    </button>
                                                </span>
                                            </div>
                                        </div>
                                        <div
                                            v-show="!downloadMode && expandedWorkKey === item.key"
                                            :id="workActionsId(item)"
                                            data-library-work-actions
                                            class="collapse-content"
                                        >
                                            <ul class="links">
                                                <li
                                                    v-for="action in item.actions"
                                                    :key="`${action.kind}:${action.href}`"
                                                >
                                                    <a
                                                        v-if="action.kind === 'download'"
                                                        :href="action.href"
                                                        target="_self"
                                                        :download="action.downloadFilename"
                                                        >{{ action.label }}</a
                                                    >
                                                    <NuxtLink
                                                        v-else
                                                        :to="canonicalNuxtHref(action.href)"
                                                        >{{ action.label }}</NuxtLink
                                                    >
                                                </li>
                                            </ul>
                                        </div>
                                    </td>
                                    <td class="text-left hidden sm:block w-28 text-base">
                                        <NuxtLink
                                            v-if="isImprintYear(item.year)"
                                            data-library-imprint-year
                                            class="text-current"
                                            :to="imprintYearTo(item.year)"
                                            >{{ item.year }}</NuxtLink
                                        ><template v-else>{{ item.year }}</template>
                                    </td>
                                    <td class="block w-44 text-right">
                                        <div
                                            class="min-w-0 whitespace-nowrap"
                                        >
                                            <span
                                                class="author uppercase text-sm flex min-w-0 justify-end"
                                            >
                                                <NuxtLink
                                                    v-library-tooltip="item.authorTooltip"
                                                    data-library-tooltip-kind="author"
                                                    class="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap align-bottom"
                                                    :to="canonicalNuxtHref(item.authorHref)"
                                                    >{{ item.surname }}</NuxtLink
                                                ><template v-if="item.roleSuffix"
                                                    ><span
                                                        class="shrink-0 text-gray-700 sc"
                                                    >&nbsp;{{
                                                        item.roleSuffix.trim()
                                                    }}</span></template
                                                >
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <table v-else class="table flex-grow w-full">
                            <tbody>
                                <tr
                                    v-for="item in browseResults.data"
                                    :key="item.key"
                                    data-library-part-row
                                    class="parts hover:bg-gray-300 hover:bg-opacity-80 transition-colors duration-150"
                                >
                                    <td class="title">
                                        <span class="title_inner"
                                            ><NuxtLink
                                                v-library-tooltip="item.titleTooltip"
                                                data-library-tooltip-kind="title"
                                                :to="canonicalNuxtHref(item.titleHref)"
                                                >{{ item.title }}</NuxtLink
                                            ></span
                                        >
                                    </td>
                                    <td class="hidden lg:table-cell w-28">
                                        <NuxtLink
                                            v-if="isImprintYear(item.year)"
                                            data-library-imprint-year
                                            class="text-current"
                                            :to="imprintYearTo(item.year)"
                                            >{{ item.year }}</NuxtLink
                                        ><template v-else>{{ item.year }}</template>
                                    </td>
                                    <td class="text-right uppercase text-sm w-40">
                                        <NuxtLink
                                            v-library-tooltip="item.authorTooltip"
                                            data-library-tooltip-kind="author"
                                            :to="canonicalNuxtHref(item.authorHref)"
                                            >{{ item.surname }}</NuxtLink
                                        ><template v-if="item.roleSuffix"
                                            >{{ " "
                                            }}<span class="text-xs text-gray-600">{{
                                                item.roleSuffix.trim()
                                            }}</span></template
                                        >
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <nav v-if="pageCount > 1" aria-label="Sidnavigation">
                            <ul class="pagination pagination-sm sc">
                                <li :class="{ disabled: currentPage <= 1 }">
                                    <span
                                        v-if="currentPage <= 1"
                                        data-library-pagination-previous
                                        aria-disabled="true"
                                        >Föregående</span
                                    >
                                    <a
                                        v-else
                                        data-library-pagination-previous
                                        :href="browsePageHref(currentPage - 1)"
                                        @click.prevent="selectPage(currentPage - 1)"
                                        >Föregående</a
                                    >
                                </li>
                                <li
                                    v-for="item in pages"
                                    :key="item.key"
                                    :class="{ active: item.page === currentPage }"
                                >
                                    <a
                                        :data-library-page="
                                            item.label === '...' ? undefined : item.page
                                        "
                                        :data-library-pagination-ellipsis="
                                            item.label === '...' || undefined
                                        "
                                        :href="browsePageHref(item.page)"
                                        :aria-current="
                                            item.page === currentPage ? 'page' : undefined
                                        "
                                        @click.prevent="selectPage(item.page)"
                                        >{{ item.label }}</a
                                    >
                                </li>
                                <li :class="{ disabled: currentPage >= pageCount }">
                                    <span
                                        v-if="currentPage >= pageCount"
                                        data-library-pagination-next
                                        aria-disabled="true"
                                        >Nästa</span
                                    >
                                    <a
                                        v-else
                                        data-library-pagination-next
                                        :href="browsePageHref(currentPage + 1)"
                                        @click.prevent="selectPage(currentPage + 1)"
                                        >Nästa</a
                                    >
                                </li>
                            </ul>
                        </nav>
                    </div>
                    <div
                        v-else-if="currentMode === 'epub' || currentMode === 'pdf'"
                        class="result title pl-0 flex-column min-h-500"
                    >
                        <div class="flex items-baseline">
                            <div class="text-base">
                                <div class="inline-block sc mr-2">Sortera:</div>
                                {{ " " }}
                                <ul class="part_header top_header mb-4 inline-block">
                                    <li
                                        v-for="item in epubSorts"
                                        :key="item.key"
                                        class="inline-block sc"
                                    >
                                        <a
                                            :href="epubSortHref(item.key)"
                                            class="sort_item"
                                            :class="{ active: selectedEpubSort === item.key }"
                                            :data-library-sort="item.key"
                                            @click.prevent="selectSort(item.key)"
                                            >{{ item.label }}</a
                                        ><template v-if="selectedEpubSort === item.key"
                                            >{{ " "
                                            }}<i
                                                class="fa"
                                                :class="
                                                    isSortReversed(currentMode, item.key)
                                                        ? 'fa-caret-up'
                                                        : 'fa-caret-down'
                                                "
                                        /></template>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div
                            v-if="loading"
                            data-library-loading
                            class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0"
                        >
                            <i class="spinner fa fa-spinner fa-pulse" />
                        </div>
                        <div v-if="downloadFailed" data-library-error>Ett fel uppstod.</div>
                        <div v-else-if="!downloadResults.length" data-library-empty class="pb-4">
                            Inga träffar.
                        </div>
                        <table v-else id="table" class="table w-full flex-grow -ml-2">
                            <tbody class="block">
                                <tr
                                    v-for="item in downloadResults"
                                    :key="`${item.downloadHref}:${item.titleHref}`"
                                    :data-library-epub-row="currentMode === 'epub' || undefined"
                                    :data-library-pdf-row="currentMode === 'pdf' || undefined"
                                    class="work_link grid w-full items-baseline transition-colors duration-150 hover:bg-gray-300 hover:bg-opacity-50 grid-cols-[minmax(0,1fr)_11rem_5rem] sm:grid-cols-[minmax(0,1fr)_7rem_11rem_5rem]"
                                >
                                    <td class="block min-w-0">
                                        <div
                                            class="text-ellipsis whitespace-nowrap overflow-hidden min-w-0 items-center gap-2"
                                        >
                                            <div
                                                class="header_container min-w-0 flex-1 align-middle"
                                            >
                                                <div
                                                    class="header block overflow-hidden text-ellipsis whitespace-nowrap text-lg leading-tight"
                                                >
                                                    <span class="title_inner">
                                                        <NuxtLink
                                                            v-slot="{ navigate }"
                                                            :to="item.titleTo"
                                                            custom
                                                        >
                                                            <a
                                                                v-library-tooltip="
                                                                    item.titleTooltip
                                                                "
                                                                :data-library-epub-title="
                                                                    currentMode === 'epub' ||
                                                                    undefined
                                                                "
                                                                :data-library-pdf-title="
                                                                    currentMode === 'pdf' ||
                                                                    undefined
                                                                "
                                                                data-library-tooltip-kind="title"
                                                                :href="
                                                                    canonicalNuxtHref(
                                                                        item.titleHref
                                                                    )
                                                                "
                                                                @click="navigate"
                                                                >{{ item.title }}</a
                                                            >
                                                        </NuxtLink>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-left hidden sm:block w-28 text-base">
                                        <span
                                            :data-library-epub-year="
                                                currentMode === 'epub' || undefined
                                            "
                                            :data-library-pdf-year="
                                                currentMode === 'pdf' || undefined
                                            "
                                            ><NuxtLink
                                                v-if="isImprintYear(item.year)"
                                                data-library-imprint-year
                                                class="text-current"
                                                :to="imprintYearTo(item.year)"
                                                >{{ item.year }}</NuxtLink
                                            ><template v-else>{{ item.year }}</template></span
                                        >
                                    </td>
                                    <td class="block w-44 text-left">
                                        <div
                                            class="text-ellipsis whitespace-nowrap overflow-hidden"
                                        >
                                            <span class="author uppercase text-sm">
                                                <NuxtLink
                                                    v-library-tooltip="item.authorTooltip"
                                                    :data-library-epub-author="
                                                        currentMode === 'epub' || undefined
                                                    "
                                                    :data-library-pdf-author="
                                                        currentMode === 'pdf' || undefined
                                                    "
                                                    data-library-tooltip-kind="author"
                                                    :to="canonicalNuxtHref(item.authorHref)"
                                                    >{{ item.surname }}</NuxtLink
                                                ><template v-if="item.roleSuffix"
                                                    >{{ " "
                                                    }}<span class="text-gray-700 sc">{{
                                                        item.roleSuffix.trim()
                                                    }}</span></template
                                                >
                                            </span>
                                        </div>
                                    </td>
                                    <td class="block whitespace-nowrap w-20 text-right">
                                        <a
                                            :data-library-epub-download="
                                                currentMode === 'epub' || undefined
                                            "
                                            :data-library-pdf-download="
                                                currentMode === 'pdf' || undefined
                                            "
                                            class="sc block"
                                            :href="item.downloadHref"
                                            :download="item.downloadFilename"
                                            target="_self"
                                            >Hämta</a
                                        >
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <nav v-if="pageCount > 1" aria-label="Sidnavigation">
                            <ul class="pagination pagination-sm sc">
                                <li :class="{ disabled: currentPage <= 1 }">
                                    <span
                                        v-if="currentPage <= 1"
                                        data-library-pagination-previous
                                        aria-disabled="true"
                                        >Föregående</span
                                    >
                                    <a
                                        v-else
                                        data-library-pagination-previous
                                        :href="epubPageHref(currentPage - 1)"
                                        @click.prevent="selectPage(currentPage - 1)"
                                        >Föregående</a
                                    >
                                </li>
                                <li
                                    v-for="item in pages"
                                    :key="item.key"
                                    :class="{ active: item.page === currentPage }"
                                >
                                    <a
                                        :data-library-page="
                                            item.label === '...' ? undefined : item.page
                                        "
                                        :data-library-pagination-ellipsis="
                                            item.label === '...' || undefined
                                        "
                                        :href="epubPageHref(item.page)"
                                        :aria-current="
                                            item.page === currentPage ? 'page' : undefined
                                        "
                                        @click.prevent="selectPage(item.page)"
                                        >{{ item.label }}</a
                                    >
                                </li>
                                <li :class="{ disabled: currentPage >= pageCount }">
                                    <span
                                        v-if="currentPage >= pageCount"
                                        data-library-pagination-next
                                        aria-disabled="true"
                                        >Nästa</span
                                    >
                                    <a
                                        v-else
                                        data-library-pagination-next
                                        :href="epubPageHref(currentPage + 1)"
                                        @click.prevent="selectPage(currentPage + 1)"
                                        >Nästa</a
                                    >
                                </li>
                            </ul>
                        </nav>
                    </div>
                </div>
                <div v-if="downloadMode">
                    <div class="dl ml-4 p-4 sticky flex flex-col overflow-auto">
                        <h3 class="uppercase text-xl mt-2 mb-2">Valda verk</h3>
                        <div class="footer">
                            <button
                                type="button"
                                data-library-clear-downloads
                                class="btn text-sm mb-4"
                                :disabled="selectedSourceWorkList.length === 0"
                                @click="clearSourceSelection"
                            >
                                Rensa
                            </button>
                            {{ " " }}
                            <button
                                ref="formatButtonElement"
                                type="button"
                                data-library-format-button
                                class="btn text-sm mb-4"
                                :disabled="selectedSourceWorkList.length === 0"
                                aria-haspopup="dialog"
                                aria-controls="library-format-popover"
                                :aria-expanded="formatPopoverOpen"
                                @click="toggleFormatPopover"
                            >
                                Välj format <i class="fa fa-download ml-2" />
                            </button>

                            <Teleport to="body">
                                <div
                                    v-if="formatPopoverOpen"
                                    id="library-format-popover"
                                    ref="formatPopoverElement"
                                    data-library-format-popover
                                    class="popover block bg-white border border-gray-700"
                                    :class="formatPopoverPlacement"
                                    role="dialog"
                                    tabindex="-1"
                                    aria-label="Välj format"
                                    :style="formatPopoverStyle"
                                >
                                    <div class="arrow" aria-hidden="true" />
                                    <div
                                        ref="formatPopoverScrollportElement"
                                        data-library-format-scrollport
                                        :style="formatPopoverScrollportStyle"
                                    >
                                        <div class="text-sm italic">
                                            {{ sourceFormatAvailability.get("etext:workdb") ?? 0 }}
                                            etext<span
                                                v-if="
                                                    (sourceFormatAvailability.get('etext:workdb') ??
                                                        0) !== 1
                                                "
                                                >er</span
                                            >
                                            vald<span
                                                v-if="
                                                    (sourceFormatAvailability.get('etext:workdb') ??
                                                        0) !== 1
                                                "
                                                >a</span
                                            >,
                                            {{ sourceFormatAvailability.get("faksimil:workdb") ?? 0 }}
                                            faksimil<span
                                                v-if="
                                                    (sourceFormatAvailability.get('faksimil:workdb') ??
                                                        0) !== 1
                                                "
                                                >er</span
                                            >
                                            vald<span
                                                v-if="
                                                    (sourceFormatAvailability.get('faksimil:workdb') ??
                                                        0) !== 1
                                                "
                                                >a</span
                                            >
                                        </div>
                                        <div class="flex justify-between w-64">
                                            <div
                                                v-for="group in sourceFormatGroups"
                                                :key="group.mediatype"
                                                :class="group.mediatype === 'etext' ? 'mr-4' : 'mx-2'"
                                            >
                                                <h3 class="uppercase text-base">{{ group.label }}</h3>
                                                <ul class="checks">
                                                    <li
                                                        v-for="format in group.formats"
                                                        :key="format.type"
                                                        class="whitespace-nowrap"
                                                    >
                                                        <input
                                                            :id="`source-${group.mediatype}-${format.type}`"
                                                            :data-library-source-format="`${group.mediatype}:${format.type}`"
                                                            type="checkbox"
                                                            class="mb-1 mr-1"
                                                            :checked="
                                                                selectedSourceFormats.has(
                                                                    `${group.mediatype}:${format.type}`
                                                                )
                                                            "
                                                            :disabled="
                                                                !(
                                                                    sourceFormatAvailability.get(
                                                                        `${group.mediatype}:${format.type}`
                                                                    ) ?? 0
                                                                )
                                                            "
                                                            @change="
                                                                toggleSourceFormat(
                                                                    `${group.mediatype}:${format.type}`
                                                                )
                                                            "
                                                        >
                                                        <label
                                                            class="capitalize"
                                                            :class="{
                                                                'text-gray-500': !(
                                                                    sourceFormatAvailability.get(
                                                                        `${group.mediatype}:${format.type}`
                                                                    ) ?? 0
                                                                )
                                                            }"
                                                            :for="`source-${group.mediatype}-${format.type}`"
                                                            >{{ format.label }}</label
                                                        >
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                        <form
                                            action="/api/download"
                                            method="POST"
                                            class="mt-8 mb-4 flex justify-between"
                                        >
                                            <input
                                                type="hidden"
                                                name="files"
                                                :value="selectedDownloadFiles.join(',')"
                                            >
                                            <span
                                                data-library-download-size
                                                class="text-sm self-center"
                                                >{{ downloadSizeLabel }}</span
                                            >
                                            <button
                                                type="submit"
                                                data-library-download-submit
                                                class="btn text-xs pull-right"
                                                :disabled="selectedDownloadFiles.length === 0"
                                            >
                                                Hämta <i class="fa fa-download ml-2" />
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </Teleport>

                            <ul class="mt-2 mb-2 flex-grow">
                                <li v-for="item in selectedSourceWorkList" :key="item.key">
                                    <button
                                        type="button"
                                        data-library-selected-work
                                        class="download_item hover:line-through bg-transparent border-0 p-0 text-left"
                                        @click="toggleSourceWork(item)"
                                    >
                                        <span class="sc">{{ item.surname }}</span> {{ item.title }}
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.relevance-unavailable {
    color: #333;
    opacity: 0.65;
}

.library-tab-disabled-look {
    opacity: 0.65;
    box-shadow: none;
}

.library-work-toggle {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    padding: 0;
    color: #333;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
    cursor: pointer;
    background: transparent;
    border: 0;
}

.library-work-toggle:hover,
.library-work-toggle:focus-visible {
    color: #7a1400;
}

[data-library-advanced-panel] select {
    display: block;
    width: 350px;
    max-width: 100%;
    height: 31px;
    padding: 3px 28px 3px 10px;
    margin-top: 5px;
    margin-bottom: 5px;
    font-family: "Requiem Text SC A", "Requiem Text SC B";
    font-size: 0.8em;
    line-height: 1.2;
    text-transform: lowercase;
    color: #444;
    background: white;
    border: 1px solid #999;
}

.library-gender-control {
    position: relative;
    display: block;
    width: 350px;
    max-width: 100%;
    height: 31px;
    margin: 5px 0;
}

[data-library-advanced-panel] .library-gender-control select[data-library-gender] {
    position: absolute;
    inset: 0;
    z-index: 2;
    width: 100%;
    height: 31px;
    padding: 0;
    margin: 0;
    cursor: pointer;
    opacity: 0;
}

.library-gender-control .selection {
    display: block;
    height: 31px;
}

.library-gender-control [data-library-gender-visual] {
    box-sizing: border-box;
    display: block;
    width: 100%;
    height: 31px;
}

.library-gender-control .select2-selection__rendered {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0;
    overflow: visible;
    line-height: 28px;
}

.library-gender-control .select2-selection__arrow {
    position: absolute;
    top: 1px;
    right: 1px;
    display: block;
    width: 20px;
    height: 26px;
}

.library-gender-control .select2-selection__arrow b {
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

[data-library-advanced-panel] select.library-select-placeholder {
    color: #999 !important;
    opacity: 1;
}

[data-library-advanced-panel] :deep(.multiselect__input::placeholder),
[data-library-advanced-panel] :deep(.search-multiselect__input-row) {
    color: #9e9e9e !important;
    opacity: 1;
}

[data-library-advanced-panel] .keyword_select.filter_select {
    margin-top: 0 !important;
}

[data-library-advanced-panel] :deep(.select2-selection__arrow.multiselect__select::before) {
    display: none;
}

[data-library-format-popover] {
    width: 288px;
    padding: 14px;
}

[data-library-tab] {
    margin-right: calc(0.2em + 4px);
}

[data-library-advanced-panel] option[data-library-placeholder] {
    color: #666;
}

[data-library-chronology-range] .rzslider {
    position: relative;
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    height: 20px;
    margin: 8px 1.85rem 3px 0 !important;
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

</style>
