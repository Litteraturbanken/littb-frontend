import type { RouteLocationRaw } from "vue-router"

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
