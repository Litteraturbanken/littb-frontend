import type { RouteLocationRaw } from "vue-router"

import {
  libraryAuthorTooltipText,
  usefulLibraryTooltipText
} from "../library-tooltip"
import {
  assertNever,
  type LibraryAuthor,
  type LibrarySearchResponse
} from "."
import type { components } from "../api/generated/lbapi"

type AllItem = components["schemas"]["LibraryAllSearchResponse"]["items"][number]
type BrowseItem = components["schemas"]["LibraryBrowseItem"]
type DownloadItem = components["schemas"]["LibraryDownloadItem"]
type LatestItem = components["schemas"]["LibraryLatestItem"]
type LibraryAuthorIds = NonNullable<
  components["schemas"]["LibraryBrowseCountResponse"]["author_ids"]
>

export type LibraryResult = {
  index: "etext" | "faksimil" | "pdf" | "etext-part" | "faksimil-part" | "author" | "presentations" | "sol" | "litteraturkartan" | "wordpress"
  sourceLabel: string
  primaryLabel: string
  primaryHref: string
  download: boolean
  yearLabel: string
  secondaryAuthor: string
  authorHref: string
  authorSurname: string
  authorGivenNames: string
  mobileYearLabel: string
  authorId: string
  authorPopularity: number
  authorBirth: number
  fullTitle: string
  authorContribution: "" | "(red.)" | "(ill.)"
}

export type DownloadResult = {
  title: string
  titleTooltip: string
  year: string
  surname: string
  authorTooltip: string
  roleSuffix: string
  titleHref: string
  titleTo: RouteLocationRaw
  authorHref: string
  downloadHref: string
  downloadFilename: string
}

export type BrowseAction = {
  kind: components["schemas"]["LibraryAction"]["kind"]
  label: string
  href: string
  downloadFilename: string
}

export type SourceExport = {
  lbworkid: string
  mediatype: components["schemas"]["LibrarySourceExport"]["media_type"]
  type: components["schemas"]["LibrarySourceExport"]["format"]
  size: number
}

export type BrowseResult = {
  key: string
  titlePath: string
  title: string
  titleTooltip: string
  year: string
  surname: string
  authorTooltip: string
  roleSuffix: string
  titleHref: string
  authorHref: string
  actions: BrowseAction[]
  sourceExports: SourceExport[]
}

export type LatestResult = {
  title: string
  titleTooltip: string
  titleId: string
  year: string
  surname: string
  authorTooltip: string
  roleSuffix: string
  titleHref: string
  authorHref: string
  imported: string
}

export type LibraryPageData =
  | { mode: "all", response: { data: LibraryResult[], hits: number, suggest: never[], failed: false } }
  | { mode: "authors", response: { data: LibraryResult[], hits: number, workCount: number, partCount: number, workAuthorIds: LibraryAuthorIds, partAuthorIds: LibraryAuthorIds, suggest: never[], failed: false } }
  | { mode: "works" | "parts", response: { data: BrowseResult[], hits: number, distinctHits: number, authorIds: LibraryAuthorIds, suggest: never[], failed: false } }
  | { mode: "latest", response: { groups: { imported: string, label: string, results: LatestResult[] }[], hits: number, distinctHits: number, suggest: never[], failed: false } }
  | { mode: "epub" | "pdf", response: { data: DownloadResult[], hits: number, distinctHits: number, suggest: never[], failed: false } }

function contribution(role: LibraryAuthor["role"]): "" | "(red.)" | "(ill.)" {
  return role === "editor" ? "(red.)" : role === "illustrator" ? "(ill.)" : ""
}

function roleSuffix(role: LibraryAuthor["role"]): string {
  const label = contribution(role)
  return label ? ` ${label}` : ""
}

function baseResult(index: LibraryResult["index"]): LibraryResult {
  return {
    index,
    sourceLabel: "",
    primaryLabel: "",
    primaryHref: "",
    download: false,
    yearLabel: "",
    secondaryAuthor: "",
    authorHref: "",
    authorSurname: "",
    authorGivenNames: "",
    mobileYearLabel: "",
    authorId: "",
    authorPopularity: 0,
    authorBirth: 0,
    fullTitle: "",
    authorContribution: ""
  }
}

function authorHref(authorId: string): string {
  return `/f%C3%B6rfattare/${encodeURIComponent(authorId)}`
}

function mapAllItem(item: AllItem): LibraryResult {
  switch (item.kind) {
    case "text": {
      const primaryLabel = item.short_title ?? item.title
      return {
        ...baseResult(item.index),
        sourceLabel: item.source_label,
        primaryLabel,
        primaryHref: `${authorHref(item.reader_author_id)}/titlar/${encodeURIComponent(item.title_id)}/sida/${encodeURIComponent(item.page_name)}/${encodeURIComponent(item.media_type)}`,
        yearLabel: item.imprint_year ?? "",
        secondaryAuthor: item.main_author.full_name ?? "",
        authorHref: authorHref(item.main_author.author_id),
        fullTitle: item.title,
        authorContribution: contribution(item.main_author.role)
      }
    }
    case "pdf": {
      const primaryLabel = item.short_title ?? item.title
      const encodedWorkId = encodeURIComponent(item.work_id)
      return {
        ...baseResult("pdf"),
        sourceLabel: item.source_label,
        primaryLabel,
        primaryHref: `/txt/${encodedWorkId}/${encodedWorkId}.pdf`,
        download: true,
        yearLabel: item.imprint_year ?? "",
        secondaryAuthor: item.main_author.full_name ?? "",
        authorHref: authorHref(item.main_author.author_id),
        fullTitle: item.title,
        authorContribution: contribution(item.main_author.role)
      }
    }
    case "author": {
      const [surname = "", ...givenNames] = item.name_for_index.split(",")
      const birth = item.birth_year === null ? "" : String(item.birth_year)
      const death = item.death_year === null ? "" : String(item.death_year)
      const years = birth || death ? `${birth}–${death}` : ""
      return {
        ...baseResult("author"),
        sourceLabel: "Författare",
        primaryLabel: item.name_for_index,
        primaryHref: `${authorHref(item.author_id)}/`,
        yearLabel: years,
        authorSurname: surname.trim(),
        authorGivenNames: givenNames.join(",").trim(),
        mobileYearLabel: years ? `(${years})` : "",
        authorId: item.author_id,
        authorPopularity: item.popularity,
        authorBirth: item.birth_year ?? 0
      }
    }
    case "presentation":
      return { ...baseResult("presentations"), sourceLabel: item.source_label, primaryLabel: item.title, primaryHref: item.url, secondaryAuthor: item.byline ?? "" }
    case "translator_lexicon":
      return { ...baseResult("sol"), sourceLabel: item.source_label, primaryLabel: item.title, primaryHref: item.url, secondaryAuthor: item.byline ?? "" }
    case "literature_map":
      return { ...baseResult("litteraturkartan"), sourceLabel: item.source_label, primaryLabel: item.title, primaryHref: item.url, secondaryAuthor: item.byline ?? "" }
    case "wordpress":
      return { ...baseResult("wordpress"), sourceLabel: item.source_label, primaryLabel: item.title, primaryHref: item.url, secondaryAuthor: item.byline ?? "" }
    default:
      return assertNever(item)
  }
}

function mapDownloadItem(item: DownloadItem): DownloadResult {
  const surname = item.author.surname ?? item.author.full_name ?? ""
  return {
    title: item.title,
    titleTooltip: usefulLibraryTooltipText(item.full_title, item.title),
    year: item.year ?? "",
    surname,
    authorTooltip: libraryAuthorTooltipText(item.author, surname),
    roleSuffix: roleSuffix(item.author.role),
    titleHref: item.title_url,
    titleTo: {
      name: "författare-author-titlar-title-mediatype",
      params: {
        author: item.route_author_id,
        title: item.route_title_id,
        mediatype: item.route_media_type
      },
      query: { "om-boken": null }
    },
    authorHref: item.author_url,
    downloadHref: item.download_url,
    downloadFilename: item.download_filename
  }
}

function mapBrowseItem(item: BrowseItem): BrowseResult {
  const surname = item.author.surname ?? item.author.full_name ?? ""
  return {
    key: item.key,
    titlePath: item.title_path,
    title: item.title,
    titleTooltip: usefulLibraryTooltipText(item.full_title, item.title),
    year: item.year ?? "",
    surname,
    authorTooltip: libraryAuthorTooltipText(item.author, surname),
    roleSuffix: roleSuffix(item.author.role),
    titleHref: item.title_url,
    authorHref: item.author_url,
    actions: item.actions.map(action => ({
      kind: action.kind,
      label: action.label,
      href: action.url,
      downloadFilename: action.download_filename ?? ""
    })),
    sourceExports: item.source_exports.map(source => ({
      lbworkid: source.work_id,
      mediatype: source.media_type,
      type: source.format,
      size: source.size
    }))
  }
}

function mapLatestItem(item: LatestItem): LatestResult {
  const surname = item.author.surname ?? item.author.full_name ?? ""
  return {
    title: item.title,
    titleTooltip: usefulLibraryTooltipText(item.full_title, item.title),
    titleId: item.route_title_id,
    year: item.year ?? "",
    surname,
    authorTooltip: libraryAuthorTooltipText(item.author, surname),
    roleSuffix: roleSuffix(item.author.role),
    titleHref: item.title_url,
    authorHref: item.author_url,
    imported: item.imported_on
  }
}

const swedishMonths = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december"
] as const

export function formatLibraryImportedDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const month = Number(match[2])
  const monthLabel = swedishMonths[month - 1]
  return monthLabel ? `${Number(match[3])} ${monthLabel} ${match[1]}` : value
}

export function formatLibrarySourceExportSize(size: number): string {
  if (size <= 0) return ""
  return size < 1_050_000
    ? `${Math.round(size / 1024)} KB`
    : `${(size / (1024 * 1024)).toFixed(2)}MB`
}

export function toLibrarySearchView(response: LibrarySearchResponse): LibraryPageData {
  switch (response.mode) {
    case "all":
      return { mode: response.mode, response: { data: response.items.map(mapAllItem), hits: response.total_hits, suggest: [], failed: false } }
    case "authors":
      return {
        mode: response.mode,
        response: {
          data: response.items.map(mapAllItem),
          hits: response.total_authors,
          workCount: response.total_works,
          partCount: response.total_parts,
          workAuthorIds: [],
          partAuthorIds: [],
          suggest: [],
          failed: false
        }
      }
    case "works":
      return { mode: response.mode, response: { data: response.items.map(mapBrowseItem), hits: response.total_hits, distinctHits: response.total_works, authorIds: [], suggest: [], failed: false } }
    case "parts":
      return { mode: response.mode, response: { data: response.items.map(mapBrowseItem), hits: response.total_parts, distinctHits: response.total_parts, authorIds: [], suggest: [], failed: false } }
    case "latest":
      return {
        mode: response.mode,
        response: {
          groups: response.groups.map(group => ({
            imported: group.imported_on,
            label: `${formatLibraryImportedDate(group.imported_on)}${group.source_count === null ? "" : ` (${group.source_count} verk)`}`,
            results: group.items.map(mapLatestItem)
          })),
          hits: response.total_hits,
          distinctHits: response.total_works,
          suggest: [],
          failed: false
        }
      }
    case "epub":
    case "pdf":
      return { mode: response.mode, response: { data: response.items.map(mapDownloadItem), hits: response.total_hits, distinctHits: response.total_works, suggest: [], failed: false } }
    default:
      return assertNever(response)
  }
}
