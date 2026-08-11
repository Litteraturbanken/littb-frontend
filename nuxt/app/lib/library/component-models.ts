import type { RouteLocationRaw } from "vue-router"
import type { LibraryMode } from "./navigation"

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
