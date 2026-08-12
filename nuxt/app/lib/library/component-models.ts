import type { RouteLocationRaw } from "vue-router"
import type { LibraryFilters } from "./index"
import type { LibraryCategory, LibraryLanguage, LibraryMedia } from "./filter-options"
import type { LibraryMode } from "./navigation"

type LibraryAdvancedControlOption<Value extends string> = Readonly<{
    value: Value
    label: string
    disabled?: boolean
}>

type LibraryAdvancedControlGroup<Value extends string> = Readonly<{
    label: string
    options: readonly LibraryAdvancedControlOption<Value>[]
}>

export type LibraryAboutAuthorOption = Readonly<{
    id: string
    label: string
}>

type LibraryChronologyControlsModel = Readonly<{
    min: number
    max: number
    from: string
    to: string
}>

export type LibraryAdvancedControlsModel = Readonly<{
    advancedOpen: boolean
    gender: NonNullable<LibraryFilters["gender"]> | ""
    keywords: readonly LibraryCategory[]
    narrowingKeywords: readonly LibraryCategory[]
    aboutAuthorIds: readonly string[]
    media: readonly LibraryMedia[]
    languages: readonly LibraryLanguage[]
    collectionSelectOptions: readonly LibraryAdvancedControlOption<LibraryCategory>[]
    collectionSelectGroups: readonly LibraryAdvancedControlGroup<LibraryCategory>[]
    aboutAuthorOptions: readonly LibraryAboutAuthorOption[]
    mediaSelectOptions: readonly LibraryAdvancedControlOption<LibraryMedia>[]
    languageSelectOptions: readonly LibraryAdvancedControlOption<LibraryLanguage>[]
    chronology: LibraryChronologyControlsModel | null
    standalone: boolean
    downloadMode: boolean
    allVisibleSourceWorksSelected: boolean
}>

export type LibraryAdvancedChange =
    | Readonly<{
        field: "gender"
        value: NonNullable<LibraryFilters["gender"]> | ""
    }>
    | Readonly<{ field: "keywords"; value: readonly LibraryCategory[] }>
    | Readonly<{ field: "narrowingKeywords"; value: readonly LibraryCategory[] }>
    | Readonly<{ field: "aboutAuthorIds"; value: readonly string[] }>
    | Readonly<{ field: "media"; value: readonly LibraryMedia[] }>
    | Readonly<{ field: "languages"; value: readonly LibraryLanguage[] }>
    | Readonly<{ field: "chronologyDraft"; from: string; to: string }>
    | Readonly<{ field: "chronologyRange"; value: readonly [number, number] }>

export type LibraryModeTab = Readonly<{
    mode: LibraryMode
    label: string
    count: number | null
    to: RouteLocationRaw
    active: boolean
    disabledLook: boolean
    disabled: boolean
    separatorBefore: boolean
}>

export type LibrarySortOption<Key extends string> = Readonly<{
    key: Key
    label: string
    to: RouteLocationRaw
    active: boolean
}>

export type LibraryNativeSortOption<Key extends string> = Readonly<{
    key: Key
    label: string
    to: string
    active: boolean
}>

export function librarySortDirection(
    key: string,
    reversed: boolean
): "stigande" | "fallande" {
    const descendingByDefault = key === "popularitet" || key === "kronologi"
    return descendingByDefault !== reversed ? "fallande" : "stigande"
}

export type LibraryDownloadMode = "epub" | "pdf"
export type LibraryBrowseMode = "works" | "parts"

type LibraryEtextSourceFormat =
    | Readonly<{ key: "etext:txt"; type: "txt"; label: string }>
    | Readonly<{ key: "etext:xml"; type: "xml"; label: string }>
    | Readonly<{ key: "etext:workdb"; type: "workdb"; label: string }>

type LibraryFacsimileSourceFormat =
    | Readonly<{ key: "faksimil:txt"; type: "txt"; label: string }>
    | Readonly<{ key: "faksimil:xml"; type: "xml"; label: string }>
    | Readonly<{ key: "faksimil:workdb"; type: "workdb"; label: string }>
    | Readonly<{ key: "faksimil:pdf"; type: "pdf"; label: string }>

export type LibrarySourceFormatKey =
    | LibraryEtextSourceFormat["key"]
    | LibraryFacsimileSourceFormat["key"]

export type LibrarySourceFormatGroup =
    | Readonly<{
        mediatype: "etext"
        label: string
        formats: readonly LibraryEtextSourceFormat[]
    }>
    | Readonly<{
        mediatype: "faksimil"
        label: string
        formats: readonly LibraryFacsimileSourceFormat[]
    }>

export type LibrarySourceDownloadWorkspaceApi = Readonly<{
    allVisibleSourceWorksSelected: boolean
    selectVisibleSourceWorks: () => void
    deselectVisibleSourceWorks: () => void
}>

export type LibraryImprintYearTarget = Readonly<{
    year: string
    to: RouteLocationRaw
}>

export type LibraryPaginationEntry = Readonly<{
    key: string
    page: number
    label: string
    to: RouteLocationRaw
    ellipsis: boolean
}>

export type LibraryPaginationModel = Readonly<{
    currentPage: number
    pageCount: number
    previous: RouteLocationRaw | null
    next: RouteLocationRaw | null
    entries: readonly LibraryPaginationEntry[]
}>
