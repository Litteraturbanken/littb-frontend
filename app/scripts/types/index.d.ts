// Ambient type definitions for Litteraturbanken AngularJS application
// These types support the gradual migration to TypeScript

// Domain Interfaces

interface WorkInfo {
    authorid: string
    title: string
    titleid: string
    titlepath: string
    lbworkid: string
    mediatype: string
    authors?: string
    sort_year_from?: number
    sort_year_to?: number
}

interface Author {
    authorid: string
    name_for_index: string
    lastname: string
    firstname: string
    gender?: string
    birth_year?: number
    death_year?: number
    presentation?: string
}

interface SearchResult {
    work: WorkInfo
    highlights: SearchHighlight[]
    total_hits?: number
}

interface SearchHighlight {
    text: string
    lbworkid: string
    pagename?: string
    order?: number
}

interface SearchFilters {
    gender?: string[]
    keywords?: string[]
    keywords_aux?: string[]
    languages?: string[]
    authors?: string[]
    titles?: string[]
    dateRange?: [number, number]
    mediatype?: string[]
}

interface LibraryFilters extends SearchFilters {
    hide1800?: boolean
}

interface TitleModel {
    works: any[]
    epub: any[]
    pdf: any[]
    latest: any[]
    parts: any[]
    relevance: any[]
    works_hits: number
    epub_hits: number
    pdf_hits: number
    latest_hits: number
    parts_hits: number
    relevance_hits: number
    works_currentpage: number
    parts_currentpage: number
    relevance_currentpage: number
}

// State Service Interfaces

interface SearchState {
    queryparams: string | null
    filters: SearchFilters
    results: SearchResult[]
    current: number | null
}

interface LibraryState {
    queryparams: string | null
    filters: LibraryFilters
    titleModel: TitleModel | null
    listType: "all" | "works" | "authors" | "parts" | "epub" | "pdf" | "latest"
    selectedTitle: any
    downloads: any[]
    dl_mode: boolean
}

interface ReaderState {
    focusMode: boolean
    nightMode: boolean
    fontSizeFactor: number
    currentPage: number | null
    workInfo: WorkInfo | null
}

interface UIState {
    isSla: boolean
    dramasubpage: boolean
    lastPageViews: string[]
    currentRoute: any
}

// State Service Type Definitions

interface StateService<T> {
    getState(): T
    setState(newState: Partial<T>): void
    on(event: string, handler: (data: any) => void): () => void
    emit(event: string, data: any): void
}

interface SearchStateService extends StateService<SearchState> {
    updateFilters(filters: Partial<SearchFilters>): void
}

interface LibraryStateService extends StateService<LibraryState> {
    updateFilters(filters: Partial<LibraryFilters>): void
}

interface ReaderStateService extends StateService<ReaderState> {
    setFocusMode(enabled: boolean): void
    setNightMode(enabled: boolean): void
}

interface UIStateService extends StateService<UIState> {
    addPageView(path: string): void
}

// AngularJS Component Binding Types

type BindingType = "<" | "@" | "&" | "="

interface ComponentBindings {
    [key: string]: BindingType
}

// Utility Types

interface RouteParams {
    author?: string
    title?: string
    mediatype?: string
    pagename?: string
    lbid?: string
    ix?: string
}

// Global Window Extensions

interface Window {
    angular: any
    _: any
    console: Console
    lbDebug: any
    $s: any
    $iso: any
    $ctrl: any
    $inj: any
    $get: any
}
