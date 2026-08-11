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

export type LibraryDownloadMode = "epub" | "pdf"

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
