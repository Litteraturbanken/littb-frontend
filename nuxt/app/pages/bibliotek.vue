<script setup lang="ts">
import type { LocationQuery, RouteLocationRaw } from "vue-router"
import { canonicalNuxtHref, isNuxtInternalHref } from "~/lib/internal-navigation"

definePageMeta({ alias: ["/epub"] })

type LibraryIndex =
  | "etext"
  | "faksimil"
  | "pdf"
  | "etext-part"
  | "faksimil-part"
  | "author"
  | "presentations"
  | "sol"
  | "litteraturkartan"
  | "wordpress"

type LibraryResult = {
  index: LibraryIndex
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

type LibraryResponse = {
  data: LibraryResult[]
  hits: number
  suggest: unknown[]
  failed: boolean
}

type AuthorBrowseResponse = LibraryResponse & {
  workCount: number
  partCount: number
  workAuthorIds: string[]
  partAuthorIds: string[]
}

type LibraryMode = "all" | "latest" | "authors" | "works" | "parts" | "epub" | "pdf"
type RelevanceSortKey = "relevans" | "forfattare" | "titlar" | "kronologi"
type EpubSortKey = "forfattare" | "titlar" | "popularitet" | "kronologi"
type LatestSortKey = "nytillkommet"
type AuthorSortKey = "namn" | "popularitet" | "kronologi"
type PartSortKey = "forfattare" | "titlar"
type BrowseSortKey = EpubSortKey | AuthorSortKey | PartSortKey

type LibraryGender = "" | "female" | "male"
type LibraryMedia = "mediatype:etext" | "mediatype:faksimil" | "has_epub:true" | "mediatype:pdf"
type LibraryLanguage =
  | "modernized:true" | "modernized:false"
  | "translation:true" | "original:true"
  | "language:swe" | "foreign:true" | "language:eng" | "language:deu"
  | "language:fra" | "language:lat" | "language:smi"
  | "proofread:true" | "proofread:false"

type LibraryAdvancedFilters = {
  gender: LibraryGender
  keywords: string[]
  narrowingKeywords: string[]
  aboutAuthorIds: string[]
  media: LibraryMedia[]
  languages: LibraryLanguage[]
  yearRange: [number, number] | null
}

type ImprintBounds = { from: number, to: number }
type AboutAuthorOption = { id: string, label: string }

type LibraryRouteState = {
  standalone: boolean
  mode: LibraryMode
  filter: string
  sort: RelevanceSortKey | BrowseSortKey | LatestSortKey
  page: number
  hide1800: boolean
  downloadMode: boolean
  advanced: boolean
  advancedFilters: LibraryAdvancedFilters
}

type EpubResult = {
  title: string
  year: string
  surname: string
  roleSuffix: string
  titleHref: string
  titleTo: RouteLocationRaw
  authorHref: string
  downloadHref: string
  downloadFilename: string
}

type EpubResponse = {
  data: EpubResult[]
  hits: number
  distinctHits: number
  suggest: unknown[]
  failed: boolean
}

type PdfResult = EpubResult & {
  downloadFilename: string
}

type PdfResponse = {
  data: PdfResult[]
  hits: number
  distinctHits: number
  suggest: unknown[]
  failed: boolean
}

type BrowseResult = {
  key: string
  titlePath: string
  title: string
  year: string
  surname: string
  roleSuffix: string
  titleHref: string
  authorHref: string
  actions: BrowseAction[]
  sourceExports: SourceExport[]
}

type SourceExport = {
  lbworkid: string
  mediatype: "etext" | "faksimil"
  type: "txt" | "xml" | "workdb" | "pdf"
  size: number
}

type BrowseAction = {
  kind: "read" | "download" | "search" | "about"
  label: string
  href: string
  downloadFilename: string
}

type BrowseCandidate = BrowseResult & {
  authorId: string
  downloadBase: string
  searchAuthorId: string
  titleId: string
  workId: string
  mediaType: string
  searchable: boolean
  exportTypes: string[]
}

type BrowseResponse = {
  data: BrowseResult[]
  hits: number
  distinctHits: number
  suggest: unknown[]
  failed: boolean
  authorIds: string[]
}

type LatestResult = {
  title: string
  titleId: string
  year: string
  surname: string
  roleSuffix: string
  titleHref: string
  authorHref: string
  imported: string
}

type LatestGroup = {
  imported: string
  label: string
  results: LatestResult[]
}

type LatestResponse = {
  groups: LatestGroup[]
  hits: number
  distinctHits: number
  suggest: unknown[]
  failed: boolean
}

type LibraryPageData =
  | { mode: "all", response: LibraryResponse }
  | { mode: "authors", response: AuthorBrowseResponse }
  | { mode: "works" | "parts", response: BrowseResponse }
  | { mode: "latest", response: LatestResponse }
  | { mode: "epub", response: EpubResponse }
  | { mode: "pdf", response: PdfResponse }

type UnknownRecord = Record<string, unknown>

const textIndexes = new Set<LibraryIndex>([
  "etext", "faksimil", "etext-part", "faksimil-part"
])

const wordpressLabels: Record<string, string> = {
  ljudochbild: "Ljud och bild",
  diktensmuseum: "Diktens museum",
  skolan: "Skolan",
  bibliotekariesidor: "Bibliotekariesidor"
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function stringAt(record: UnknownRecord | null, key: string): string {
  const value = record?.[key]
  if (typeof value === "string") return value.trim()
  return typeof value === "number" && Number.isFinite(value) ? String(value) : ""
}

function recordAt(record: UnknownRecord | null, key: string): UnknownRecord | null {
  return asRecord(record?.[key])
}

function recordsAt(record: UnknownRecord | null, key: string): UnknownRecord[] {
  const value = record?.[key]
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is UnknownRecord => item !== null)
    : []
}

function baseResult(index: LibraryIndex): LibraryResult {
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

function safeProvidedDestination(value: string): string {
  if (!value || /[\u0000-\u001F\u007F]/.test(value)) return ""
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    const url = new URL(value, "https://litteraturbanken.se")
    return url.origin === "https://litteraturbanken.se"
      ? `${url.pathname}${url.search}${url.hash}`
      : ""
  }
  try {
    const url = new URL(value)
    const expectedHost = url.hostname === "litteraturbanken.se"
      || url.hostname.endsWith(".litteraturbanken.se")
    return expectedHost && (url.protocol === "https:" || url.protocol === "http:")
      ? url.href
      : ""
  } catch {
    return ""
  }
}

function optionalYear(record: UnknownRecord, key: string): string {
  return stringAt(recordAt(record, key), "plain")
}

function imprintYear(record: UnknownRecord): string {
  return optionalYear(record, "sort_date_imprint")
}

function parseMainAuthor(record: UnknownRecord): {
  id: string
  name: string
  type: string
} | null {
  const mainAuthor = recordAt(record, "main_author")
  const id = stringAt(mainAuthor, "authorid")
  const name = stringAt(mainAuthor, "full_name")
  return id && name ? { id, name, type: stringAt(mainAuthor, "type") } : null
}

function contributionLabel(type: string): "" | "(red.)" | "(ill.)" {
  return type === "editor" ? "(red.)" : type === "illustrator" ? "(ill.)" : ""
}

function parseTextResult(record: UnknownRecord, index: LibraryIndex): LibraryResult | null {
  const fullTitle = stringAt(record, "title")
  const label = stringAt(record, "shorttitle") || fullTitle
  const texttype = stringAt(record, "texttype")
  const media = stringAt(record, "mediatype")
  const page = stringAt(record, "startpagename")
  const title = stringAt(record, "work_titleid") || stringAt(record, "titleid")
  const mainAuthor = parseMainAuthor(record)
  const workAuthor = stringAt(recordsAt(record, "work_authors")[0] ?? null, "authorid")
  const author = index.endsWith("-part") ? workAuthor : workAuthor || mainAuthor?.id || ""
  if (!label || !texttype || !media || !page || !title || !author || !mainAuthor) return null

  return {
    ...baseResult(index),
    sourceLabel: texttype,
    primaryLabel: label,
    primaryHref: `/f%C3%B6rfattare/${encodeURIComponent(author)}/titlar/${encodeURIComponent(title)}/sida/${encodeURIComponent(page)}/${encodeURIComponent(media)}`,
    fullTitle: fullTitle || label,
    yearLabel: imprintYear(record),
    secondaryAuthor: mainAuthor.name,
    authorHref: `/f%C3%B6rfattare/${encodeURIComponent(mainAuthor.id)}`,
    authorContribution: contributionLabel(mainAuthor.type)
  }
}

function parsePdfResult(record: UnknownRecord): LibraryResult | null {
  const fullTitle = stringAt(record, "title")
  const label = stringAt(record, "shorttitle") || fullTitle
  const texttype = stringAt(record, "texttype")
  const id = stringAt(record, "lbworkid")
  const mainAuthor = parseMainAuthor(record)
  if (!label || !texttype || !id || !mainAuthor) return null
  const encodedId = encodeURIComponent(id)
  return {
    ...baseResult("pdf"),
    sourceLabel: texttype,
    primaryLabel: label,
    primaryHref: `/txt/${encodedId}/${encodedId}.pdf`,
    fullTitle: fullTitle || label,
    download: true,
    yearLabel: imprintYear(record),
    secondaryAuthor: mainAuthor.name,
    authorHref: `/f%C3%B6rfattare/${encodeURIComponent(mainAuthor.id)}`,
    authorContribution: contributionLabel(mainAuthor.type)
  }
}

function parseAuthorResult(record: UnknownRecord): LibraryResult | null {
  const id = stringAt(record, "authorid")
  const label = stringAt(record, "name_for_index")
  if (!id || !label) return null
  const [surname, ...givenParts] = label.split(",")
  const authorSurname = surname?.trim() ?? ""
  const authorGivenNames = givenParts.join(",").trim()
  if (!authorSurname) return null
  const birth = optionalYear(record, "birth")
  const death = optionalYear(record, "death")
  const years = birth || death ? `${birth}–${death}` : ""
  return {
    ...baseResult("author"),
    sourceLabel: "Författare",
    primaryLabel: label,
    primaryHref: `/f%C3%B6rfattare/${encodeURIComponent(id)}/`,
    yearLabel: years,
    authorSurname,
    authorGivenNames,
    mobileYearLabel: years ? `(${years})` : "",
    authorId: id,
    authorPopularity: Number(stringAt(record, "popularity")) || 0,
    authorBirth: Number(birth) || 0
  }
}

function parsePresentationResult(record: UnknownRecord): LibraryResult | null {
  const label = stringAt(record, "title")
  const href = safeProvidedDestination(stringAt(record, "url"))
  const author = stringAt(record, "article_author")
  if (!label || !href) return null
  return {
    ...baseResult("presentations"),
    sourceLabel: "Kringtexter",
    primaryLabel: label,
    primaryHref: href,
    secondaryAuthor: author
  }
}

function parseSolResult(record: UnknownRecord): LibraryResult | null {
  const article = recordAt(record, "article")
  const contributor = recordAt(record, "contributors")
  const label = stringAt(article, "ArticleName")
  const name = stringAt(article, "URLName")
  const firstName = stringAt(contributor, "FirstName")
  const lastName = stringAt(contributor, "LastName")
  if (!label || !name || !firstName || !lastName) return null
  return {
    ...baseResult("sol"),
    sourceLabel: "Översättarlexikon",
    primaryLabel: label,
    primaryHref: `https://litteraturbanken.se/översättarlexikon/artiklar/${encodeURIComponent(name)}`,
    secondaryAuthor: `${firstName} ${lastName}`
  }
}

function parseMapResult(record: UnknownRecord): LibraryResult | null {
  const label = stringAt(record, "header")
  const place = stringAt(record, "placeid")
  const id = stringAt(record, "id")
  const author = stringAt(record, "article_author")
  if (!label || !place || !id || !author) return null
  return {
    ...baseResult("litteraturkartan"),
    sourceLabel: "Litteraturkartan",
    primaryLabel: label,
    primaryHref: `https://litteraturbanken.se/litteraturkartan/?id=${encodeURIComponent(place)}&article=${encodeURIComponent(id)}`,
    secondaryAuthor: author
  }
}

function parseWordpressResult(record: UnknownRecord): LibraryResult | null {
  const label = stringAt(record, "title")
  const href = safeProvidedDestination(stringAt(record, "link"))
  const sourceLabel = wordpressLabels[stringAt(record, "source")] ?? ""
  if (!label || !href || !sourceLabel) return null
  return {
    ...baseResult("wordpress"),
    sourceLabel,
    primaryLabel: label,
    primaryHref: href
  }
}

function parseResult(value: unknown): LibraryResult | null {
  const record = asRecord(value)
  if (!record) return null
  const index = stringAt(record, "_index") as LibraryIndex
  if (textIndexes.has(index)) return parseTextResult(record, index)
  if (index === "pdf") return parsePdfResult(record)
  if (index === "author") return parseAuthorResult(record)
  if (index === "presentations") return parsePresentationResult(record)
  if (index === "sol") return parseSolResult(record)
  if (index === "litteraturkartan") return parseMapResult(record)
  if (index === "wordpress") return parseWordpressResult(record)
  return null
}

function parseLibraryResponse(value: unknown): LibraryResponse {
  const record = asRecord(value)
  const suggest = record?.suggest
  if (!record || !Array.isArray(record.data) || typeof record.hits !== "number"
    || !Number.isFinite(record.hits)
    || (suggest !== null && suggest !== undefined && !Array.isArray(suggest))) {
    throw new Error("Invalid Library relevance response")
  }
  return {
    data: record.data.map(parseResult).filter((item): item is LibraryResult => item !== null),
    hits: record.hits,
    suggest: Array.isArray(suggest) ? suggest : [],
    failed: false
  }
}

function emptyLibraryResponse(failed = false): LibraryResponse {
  return { data: [], hits: 0, suggest: [], failed }
}

function safePathSegment(value: string): string {
  if (!value || value === "." || value === ".."
    || /[\/\\\u0000-\u001F\u007F]/.test(value)) return ""
  try {
    return encodeURIComponent(value)
  } catch {
    return ""
  }
}

function safeDownloadWorkId(value: string): boolean {
  return Boolean(safePathSegment(value)) && !value.includes(",")
}

function safeQueryComponent(value: string): string {
  if (!value || /[\\\u0000-\u001F\u007F]/.test(value)) return ""
  try {
    return encodeURIComponent(value)
  } catch {
    return ""
  }
}

function epubStringAt(record: UnknownRecord | null, key: string): string {
  const value = record?.[key]
  return typeof value === "string" ? value.trim() : ""
}

function parseEpubResult(value: unknown): EpubResult | null {
  const record = asRecord(value)
  if (!record || record.has_epub !== true) return null
  const title = epubStringAt(record, "shorttitle") || epubStringAt(record, "title")
  const titleId = epubStringAt(record, "work_titleid") || epubStringAt(record, "titleid")
  const mediaType = epubStringAt(record, "mediatype")
  const mainAuthor = recordAt(record, "main_author")
  const authorId = epubStringAt(mainAuthor, "authorid")
  const fullName = epubStringAt(mainAuthor, "full_name")
  const surname = epubStringAt(mainAuthor, "surname")
  const year = imprintYear(record)
  const hasEpubExport = recordsAt(record, "export")
    .some(item => epubStringAt(item, "type") === "epub")
  const encodedAuthor = safePathSegment(authorId)
  const encodedTitle = safePathSegment(titleId)
  const encodedMedia = safePathSegment(mediaType)
  if (!title || !encodedTitle || !encodedMedia || !encodedAuthor || !fullName || !surname
    || !year || !hasEpubExport) return null
  const role = epubStringAt(mainAuthor, "type")
  const roleSuffix = role === "editor" ? " (red.)" : role === "illustrator" ? " (ill.)" : ""
  return {
    title,
    year,
    surname,
    roleSuffix,
    titleHref: `/f%C3%B6rfattare/${encodedAuthor}/titlar/${encodedTitle}/${encodedMedia}?om-boken`,
    titleTo: {
      name: "författare-author-titlar-title-mediatype",
      params: { author: authorId, title: titleId, mediatype: mediaType },
      query: { "om-boken": null }
    },
    authorHref: `/f%C3%B6rfattare/${encodedAuthor}`,
    downloadHref: `/txt/epub/${encodedAuthor}_${encodedTitle}.epub`,
    downloadFilename: ""
  }
}

function parseEpubResponse(value: unknown): EpubResponse {
  const record = asRecord(value)
  const suggest = record?.suggest
  if (!record || !Array.isArray(record.data) || typeof record.hits !== "number"
    || !Number.isFinite(record.hits) || typeof record.distinct_hits !== "number"
    || !Number.isFinite(record.distinct_hits)
    || (suggest !== null && suggest !== undefined && !Array.isArray(suggest))) {
    throw new Error("Invalid Library EPUB response")
  }
  return {
    data: record.data.map(parseEpubResult).filter((item): item is EpubResult => item !== null),
    hits: record.hits,
    distinctHits: record.distinct_hits,
    suggest: Array.isArray(suggest) ? suggest : [],
    failed: false
  }
}

function emptyEpubResponse(failed = false): EpubResponse {
  return { data: [], hits: 0, distinctHits: 0, suggest: [], failed }
}

function parseBrowseResult(value: unknown, mode: "works" | "parts"): BrowseCandidate | null {
  const record = asRecord(value)
  if (!record) return null
  const title = epubStringAt(record, "shorttitle") || epubStringAt(record, "title")
  const mediaType = epubStringAt(record, "mediatype")
  const page = epubStringAt(record, "startpagename")
  const mainAuthor = recordAt(record, "main_author")
  const mainAuthorId = epubStringAt(mainAuthor, "authorid")
  const workAuthor = recordsAt(record, "work_authors")[0] ?? null
  const indexedAuthor = recordsAt(record, "authors")[0] ?? null
  const readerAuthor = workAuthor || indexedAuthor || mainAuthor
  const displayAuthor = mode === "parts" ? indexedAuthor || workAuthor : mainAuthor
  const authorId = epubStringAt(readerAuthor, "authorid")
  const fullName = epubStringAt(displayAuthor, "full_name")
  const surname = epubStringAt(displayAuthor, "surname") || fullName
  const titlePath = epubStringAt(record, "titlepath")
  const titleId = epubStringAt(record, "work_titleid") || epubStringAt(record, "titleid")
  const workId = epubStringAt(record, "lbworkid")
  const encodedAuthor = safePathSegment(authorId)
  const encodedTitle = safePathSegment(titleId)
  const encodedTitlePath = safeQueryComponent(titlePath)
  const encodedWork = safePathSegment(workId)
  const encodedPage = safePathSegment(page)
  const encodedMedia = safePathSegment(mediaType === "pdf" ? "faksimil" : mediaType)
  const displayAuthorId = safePathSegment(epubStringAt(displayAuthor, "authorid"))
  const indexedAuthorId = safePathSegment(epubStringAt(indexedAuthor, "authorid"))
  if (!title || !surname || !encodedAuthor || !encodedTitle || !encodedMedia
    || !encodedWork || !encodedTitlePath || !displayAuthorId
    || (["etext", "faksimil"].includes(mediaType) && !encodedPage)
    || (mediaType === "infopost" && !indexedAuthorId)) {
    return null
  }
  const role = epubStringAt(displayAuthor, "type")
  const sourceExports: SourceExport[] = []
  if ((mediaType === "etext" || mediaType === "faksimil")
    && safeDownloadWorkId(workId)) {
    const allowedTypes = new Set(["txt", "xml", "workdb", "pdf"])
    for (const exportRecord of recordsAt(record, "export")) {
      const type = epubStringAt(exportRecord, "type")
      const size = exportRecord.size
      if (!allowedTypes.has(type) || (type === "pdf" && mediaType !== "faksimil")
        || typeof size !== "number" || !Number.isFinite(size) || size < 0) continue
      sourceExports.push({
        lbworkid: workId,
        mediatype: mediaType,
        type: type as SourceExport["type"],
        size
      })
    }
  }
  const titleHref = mediaType === "infopost"
    ? `/dramawebben/pjäser?om-boken&authorid=${indexedAuthorId}&titlepath=${encodedTitlePath}`
    : mediaType === "pdf"
      ? `/txt/${encodedWork}/${encodedWork}.pdf`
    : `/f%C3%B6rfattare/${encodedAuthor}/titlar/${encodedTitle}/sida/${encodedPage}/${encodedMedia}`
  return {
    key: `${encodedTitlePath}:${encodedWork}`,
    titlePath,
    title,
    year: imprintYear(record),
    surname,
    roleSuffix: role === "editor" ? " (red.)" : role === "illustrator" ? " (ill.)" : "",
    titleHref,
    authorHref: `/f%C3%B6rfattare/${displayAuthorId}`,
    actions: [],
    sourceExports,
    authorId: encodedAuthor,
    downloadBase: `${authorId}_${titleId}`,
    searchAuthorId: safePathSegment(mainAuthorId || authorId),
    titleId: encodedTitle,
    workId: encodedWork,
    mediaType: mediaType === "pdf" ? "pdf" : encodedMedia,
    searchable: record.searchable === true,
    exportTypes: recordsAt(record, "export").map(item => epubStringAt(item, "type"))
      .filter(Boolean)
  }
}

const browseMediaOrder: Record<string, number> = { etext: 0, faksimil: 1, pdf: 2 }

function groupBrowseWork(candidates: BrowseCandidate[]): BrowseResult {
  const ordered = [...candidates].sort((left, right) => (
    (browseMediaOrder[left.mediaType] ?? 99) - (browseMediaOrder[right.mediaType] ?? 99)
  ))
  const primary = ordered[0]!
  const actions: BrowseAction[] = ordered
    .filter(item => item.mediaType !== "pdf")
    .map(item => ({
        kind: "read" as const,
        label: `Läs som ${item.mediaType}`,
        href: item.titleHref,
        downloadFilename: ""
      }))
  if (ordered.some(item => item.exportTypes.includes("epub"))) {
    actions.push({
      kind: "download",
      label: "Ladda ner epub",
      href: `/txt/epub/${primary.authorId}_${primary.titleId}.epub`,
        downloadFilename: `${primary.downloadBase}.epub`
    })
  }
  if (!ordered.some(item => item.mediaType === "pdf")
    && ordered.some(item => item.exportTypes.includes("pdf"))) {
    actions.push({
      kind: "download",
      label: "Ladda ner pdf",
      href: `/export/faksimil/${primary.workId}.pdf`,
      downloadFilename: `${primary.downloadBase}.pdf`
    })
  } else {
    const pdf = ordered.find(item => item.mediaType === "pdf")
    if (pdf) {
      actions.push({
        kind: "download",
        label: "Ladda ner pdf",
        href: `/txt/${pdf.workId}/${pdf.workId}.pdf`,
        downloadFilename: `${pdf.downloadBase}.pdf`
      })
    }
  }
  if (ordered.some(item => item.searchable)) {
    actions.push({
      kind: "search",
      label: "Gör en sökning i verket",
      href: `/sok?forfattare=${primary.searchAuthorId}&titlar=${primary.workId}&avancerad`,
      downloadFilename: ""
    })
  }
  const aboutRepresentation = ordered.find(item => (
    item.mediaType === "etext" || item.mediaType === "faksimil"
  ))
  if (aboutRepresentation) {
    actions.push({
      kind: "about",
      label: "Läs mer om verket",
      href: `${aboutRepresentation.titleHref}?om-boken`,
      downloadFilename: ""
    })
  }
  const sourceExports = ordered.flatMap(item => item.sourceExports).filter((item, index, all) => (
    all.findIndex(candidate => candidate.lbworkid === item.lbworkid
      && candidate.mediatype === item.mediatype && candidate.type === item.type) === index
  ))
  return { ...primary, actions, sourceExports }
}

function parseBrowseResponse(value: unknown, mode: "works" | "parts"): BrowseResponse {
  const record = asRecord(value)
  const suggest = record?.suggest
  if (!record || !Array.isArray(record.data) || !Array.isArray(record.author_aggregation)
    || typeof record.hits !== "number"
    || !Number.isFinite(record.hits) || typeof record.distinct_hits !== "number"
    || !Number.isFinite(record.distinct_hits)
    || (suggest !== null && suggest !== undefined && !Array.isArray(suggest))) {
    throw new Error(`Invalid Library ${mode} response`)
  }

  const parsed = record.data.map(item => parseBrowseResult(item, mode))
    .filter((item): item is BrowseCandidate => item !== null)
  const grouped = new Map<string, BrowseCandidate[]>()
  for (const item of parsed) grouped.set(item.key, [...(grouped.get(item.key) ?? []), item])
  const data: BrowseResult[] = [...grouped.values()].map(group => mode === "works"
    ? groupBrowseWork(group)
    : [...group].sort((left, right) => (
        (browseMediaOrder[left.mediaType] ?? 99) - (browseMediaOrder[right.mediaType] ?? 99)
      ))[0]!)
  const authorIds: string[] = []
  for (const value of record.author_aggregation) {
    const id = stringAt(asRecord(value), "authorid")
    if (!safePathSegment(id)) throw new Error(`Invalid Library ${mode} author aggregation`)
    if (authorIds.includes(id)) continue
    authorIds.push(id)
  }
  return {
    data,
    hits: record.hits,
    distinctHits: record.distinct_hits,
    suggest: Array.isArray(suggest) ? suggest : [],
    failed: false,
    authorIds
  }
}

function emptyBrowseResponse(failed = false): BrowseResponse {
  return { data: [], hits: 0, distinctHits: 0, suggest: [], failed, authorIds: [] }
}

const latestMediaOrder = { etext: 0, faksimil: 1, pdf: 2 } as const
const swedishMonths = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december"
]

function importedDate(value: unknown): string {
  if (typeof value === "string") {
    const date = value.split("T")[0] ?? ""
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ""
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return ""
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ""
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-")
}

function formatImportedDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  const monthLabel = month ? swedishMonths[month - 1] : undefined
  return year && monthLabel && day ? `${day} ${monthLabel} ${year}` : value
}

function parseLatestRepresentation(value: unknown): (LatestResult & {
  lbworkid: string
  titlepath: string
  mediaType: keyof typeof latestMediaOrder
}) | null {
  const record = asRecord(value)
  if (!record) return null
  const title = epubStringAt(record, "shorttitle") || epubStringAt(record, "title")
  const titlepath = pdfIdentityAt(record, "titlepath")
  const titleId = titlepath
  const lbworkid = pdfIdentityAt(record, "lbworkid")
  const mediaType = pdfIdentityAt(record, "mediatype") as keyof typeof latestMediaOrder
  const mainAuthor = recordAt(record, "main_author")
  const authorId = pdfIdentityAt(mainAuthor, "authorid")
  const surname = epubStringAt(mainAuthor, "surname")
  const year = imprintYear(record)
  const imported = importedDate(record.imported)
  const encodedAuthor = safePathSegment(authorId)
  const encodedTitle = safePathSegment(titleId)
  const encodedMedia = safePathSegment(mediaType)
  const encodedAboutMedia = safePathSegment(mediaType === "pdf" ? "faksimil" : mediaType)
  if (!isSafeDisplayText(title) || !isSafeDisplayText(year) || !isSafeDisplayText(surname)
    || !safePathSegment(titlepath) || !safePathSegment(lbworkid)
    || !(mediaType in latestMediaOrder) || !encodedAuthor || !encodedTitle || !encodedMedia
    || !encodedAboutMedia
    || !imported) return null
  const role = epubStringAt(mainAuthor, "type")
  return {
    title,
    titleId,
    year,
    surname,
    roleSuffix: role === "editor" ? " (red.)" : role === "illustrator" ? " (ill.)" : "",
    titleHref: `/f%C3%B6rfattare/${encodedAuthor}/titlar/${encodedTitle}/${encodedAboutMedia}?om-boken`,
    authorHref: `/f%C3%B6rfattare/${encodedAuthor}`,
    imported,
    lbworkid,
    titlepath,
    mediaType
  }
}

function parseLatestResponse(value: unknown): LatestResponse {
  const record = asRecord(value)
  const suggest = record?.suggest
  const aggregations = record?.imported_aggregation
  if (!record || !Array.isArray(record.data) || typeof record.hits !== "number"
    || !Number.isFinite(record.hits) || typeof record.distinct_hits !== "number"
    || !Number.isFinite(record.distinct_hits) || !Array.isArray(aggregations)
    || (suggest !== null && suggest !== undefined && !Array.isArray(suggest))) {
    throw new Error("Invalid Library latest response")
  }

  const counts = new Map<string, number>()
  for (const value of aggregations) {
    const aggregation = asRecord(value)
    const date = importedDate(aggregation?.imported)
    const count = aggregation?.doc_count
    if (date && typeof count === "number" && Number.isFinite(count)) counts.set(date, count)
  }

  const representations = new Map<string, ReturnType<typeof parseLatestRepresentation>[]>()
  for (const value of record.data) {
    const parsed = parseLatestRepresentation(value)
    if (!parsed) continue
    const key = JSON.stringify([parsed.titlepath, parsed.lbworkid])
    const group = representations.get(key)
    if (group) group.push(parsed)
    else representations.set(key, [parsed])
  }

  const grouped = new Map<string, LatestResult[]>()
  for (const representationGroup of representations.values()) {
    const selected = representationGroup
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => latestMediaOrder[left.mediaType] - latestMediaOrder[right.mediaType])[0]
    if (!selected) continue
    const newestImported = representationGroup.reduce(
      (newest, item) => item && item.imported > newest ? item.imported : newest,
      selected.imported
    )
    const {
      lbworkid: _lbworkid,
      titlepath: _titlepath,
      mediaType: _mediaType,
      ...preferredResult
    } = selected
    const result = { ...preferredResult, imported: newestImported }
    const dateGroup = grouped.get(result.imported)
    if (dateGroup) dateGroup.push(result)
    else grouped.set(result.imported, [result])
  }

  return {
    groups: [...grouped.entries()].map(([date, results]) => {
      const count = counts.get(date)
      return {
        imported: date,
        label: `${formatImportedDate(date)}${count === undefined ? "" : ` (${count} verk)`}`,
        results
      }
    }),
    hits: record.hits,
    distinctHits: record.distinct_hits,
    suggest: Array.isArray(suggest) ? suggest : [],
    failed: false
  }
}

function emptyLatestResponse(failed = false): LatestResponse {
  return { groups: [], hits: 0, distinctHits: 0, suggest: [], failed }
}

const pdfMediaTypes = new Set(["etext", "faksimil", "pdf"])

type PreferredAuthor =
  | { valid: true, id: string }
  | { valid: false }

type ParsedPdfRepresentation = PdfResult & {
  lbworkid: string
  mediaType: string
  publicPdfExport: boolean
}

function pdfIdentityAt(record: UnknownRecord | null, key: string): string {
  const value = record?.[key]
  return typeof value === "string" && value === value.trim() ? value : ""
}

function isSafeDisplayText(value: string): boolean {
  return Boolean(value) && !/[\u0000-\u001F\u007F]/.test(value)
}

function preferredFilenameAuthor(record: UnknownRecord, mainAuthorId: string): PreferredAuthor {
  for (const key of ["work_authors", "authors"] as const) {
    const value = record[key]
    if (value === undefined) continue
    if (!Array.isArray(value)) return { valid: false }
    if (value.length === 0) continue
    const author = asRecord(value[0])
    const authorId = pdfIdentityAt(author, "authorid")
    if (!author || !safePathSegment(authorId)) return { valid: false }
    return { valid: true, id: authorId }
  }
  return { valid: true, id: mainAuthorId }
}

function hasPublicPdfExport(record: UnknownRecord): boolean {
  if (epubStringAt(record, "license") !== "pd") return false
  const exports = record.export
  if (!Array.isArray(exports)) return false
  return exports.some((value) => {
    const descriptor = asRecord(value)
    return epubStringAt(descriptor, "type") === "pdf"
      && typeof descriptor?.size === "number"
      && Number.isFinite(descriptor.size)
      && descriptor.size > 0
  })
}

function parsePdfRepresentation(value: unknown): ParsedPdfRepresentation | null {
  const record = asRecord(value)
  if (!record) return null
  const title = epubStringAt(record, "shorttitle") || epubStringAt(record, "title")
  const titleId = pdfIdentityAt(record, "work_titleid") || pdfIdentityAt(record, "titleid")
  const mediaType = pdfIdentityAt(record, "mediatype")
  const lbworkid = pdfIdentityAt(record, "lbworkid")
  const titlepath = pdfIdentityAt(record, "titlepath")
  const year = imprintYear(record)
  const mainAuthor = recordAt(record, "main_author")
  const authorId = pdfIdentityAt(mainAuthor, "authorid")
  const fullName = epubStringAt(mainAuthor, "full_name")
  const surname = epubStringAt(mainAuthor, "surname")
  const encodedAuthor = safePathSegment(authorId)
  const encodedTitle = safePathSegment(titleId)
  const encodedMedia = safePathSegment(mediaType)
  const encodedWork = safePathSegment(lbworkid)
  if (!isSafeDisplayText(title) || !isSafeDisplayText(year)
    || !isSafeDisplayText(fullName) || !isSafeDisplayText(surname)
    || !pdfMediaTypes.has(mediaType)
    || !encodedAuthor || !encodedTitle || !encodedMedia || !encodedWork
    || !safePathSegment(titlepath)) return null

  const filenameAuthor = preferredFilenameAuthor(record, authorId)
  if (!filenameAuthor.valid) return null
  const encodedFilenameAuthor = safePathSegment(filenameAuthor.id)
  if (!encodedFilenameAuthor) return null
  const role = epubStringAt(mainAuthor, "type")
  const roleSuffix = role === "editor" ? " (red.)" : role === "illustrator" ? " (ill.)" : ""
  const direct = mediaType === "pdf"
  const aboutMedia = direct ? "faksimil" : mediaType
  const encodedAboutMedia = safePathSegment(aboutMedia)
  const titleHref = `/f%C3%B6rfattare/${encodedAuthor}/titlar/${encodedTitle}/${encodedAboutMedia}?om-boken`

  return {
    title,
    year,
    surname,
    roleSuffix,
    titleHref,
    titleTo: {
      name: "författare-author-titlar-title-mediatype",
      params: { author: authorId, title: titleId, mediatype: aboutMedia },
      query: { "om-boken": null }
    },
    authorHref: `/f%C3%B6rfattare/${encodedAuthor}`,
    downloadHref: direct
      ? `/txt/${encodedWork}/${encodedWork}.pdf`
      : `/export/faksimil/${encodedWork}.pdf`,
    downloadFilename: `${filenameAuthor.id}_${titleId}.pdf`,
    lbworkid,
    mediaType,
    publicPdfExport: hasPublicPdfExport(record)
  }
}

function parsePdfGroup(group: unknown[]): PdfResult | null {
  const parsed = group.map(parsePdfRepresentation)
    .filter((item): item is ParsedPdfRepresentation => item !== null)
  const mediaOrder = { etext: 0, faksimil: 1, pdf: 2 } as const
  const groupMain = [...parsed].sort((left, right) =>
    mediaOrder[left.mediaType as keyof typeof mediaOrder]
    - mediaOrder[right.mediaType as keyof typeof mediaOrder]
  )[0]
  const direct = parsed.find(item => item.mediaType === "pdf")
  const exportSource = parsed.find(item => item.publicPdfExport)
  if (!groupMain || (!direct && !exportSource)) return null
  const {
    lbworkid: _lbworkid,
    mediaType: _mediaType,
    publicPdfExport: _publicPdfExport,
    ...result
  } = groupMain
  return direct
    ? {
        ...result,
        downloadHref: direct.downloadHref,
        downloadFilename: direct.downloadFilename
      }
    : result
}

function parsePdfResponse(value: unknown): PdfResponse {
  const record = asRecord(value)
  const suggest = record?.suggest
  if (!record || !Array.isArray(record.data) || typeof record.hits !== "number"
    || !Number.isFinite(record.hits) || typeof record.distinct_hits !== "number"
    || !Number.isFinite(record.distinct_hits)
    || (suggest !== null && suggest !== undefined && !Array.isArray(suggest))) {
    throw new Error("Invalid Library PDF response")
  }

  const groups = new Map<string, unknown[]>()
  for (const value of record.data) {
    const representation = asRecord(value)
    const titlepath = pdfIdentityAt(representation, "titlepath")
    const lbworkid = pdfIdentityAt(representation, "lbworkid")
    if (!representation || !safePathSegment(titlepath) || !safePathSegment(lbworkid)) continue
    const key = JSON.stringify([titlepath, lbworkid])
    const group = groups.get(key)
    if (group) group.push(value)
    else groups.set(key, [value])
  }

  return {
    data: [...groups.values()].map(parsePdfGroup)
      .filter((item): item is PdfResult => item !== null),
    hits: record.hits,
    distinctHits: record.distinct_hits,
    suggest: Array.isArray(suggest) ? suggest : [],
    failed: false
  }
}

function emptyPdfResponse(failed = false): PdfResponse {
  return { data: [], hits: 0, distinctHits: 0, suggest: [], failed }
}

const resultTypes = "etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress"
const excludedFields = "text,parts,sourcedesc,pages,errata,intro,workintro,content,article.ArticleText,works,intro_text,bibliography_types,wikidata.wikipedia_text,content_vector"
const backgroundPath = "/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg"
const description = "Blädda bland Litteraturbankens författare och titlar."

const sorts: Array<{ key: RelevanceSortKey, label: string, expression: string }> = [
  { key: "relevans", label: "Relevans", expression: "_score|desc" },
  { key: "forfattare", label: "Författare", expression: "main_author.name_for_index|asc,sortkey|asc" },
  { key: "titlar", label: "Titel", expression: "sortkey|asc" },
  { key: "kronologi", label: "Tryckår", expression: "sort_date_imprint.date|desc" }
]

const epubResultTypes = "etext,faksimil,pdf"
const epubExcludedFields = "text,parts,sourcedesc,pages,errata"
const epubIncludedFields = "lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain,main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type,work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword"
const pdfIncludedFields = `${epubIncludedFields},license,authors.authorid,authors.surname`
const epubQueryPrefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
const epubSorts: Array<{ key: EpubSortKey, label: string, expression: string }> = [
  { key: "forfattare", label: "Författare", expression: "main_author.name_for_index|asc,sortkey|asc" },
  { key: "titlar", label: "Titel", expression: "sortkey|asc" },
  { key: "popularitet", label: "Populärt", expression: "popularity|desc" },
  { key: "kronologi", label: "Tryckår", expression: "sort_date_imprint.date|desc" }
]
const authorSorts: Array<{ key: AuthorSortKey, label: string, expression: string }> = [
  { key: "namn", label: "Namn", expression: "name_for_index|asc" },
  { key: "popularitet", label: "Populärt", expression: "popularity|desc" },
  { key: "kronologi", label: "Årtal", expression: "birth.date|asc" }
]
const partSorts: Array<{ key: PartSortKey, label: string, expression: string }> = [
  { key: "forfattare", label: "Författare", expression: "main_author.name_for_index|asc,sortkey|asc" },
  { key: "titlar", label: "Titel", expression: "sortkey|asc" }
]

function sortExpression(expression: string, reversed: boolean): string {
  if (!reversed) return expression
  return expression.replace(/\|(asc|desc)(?=,|$)/, (_match, direction: string) => (
    `|${direction === "asc" ? "desc" : "asc"}`
  ))
}

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
const collectionValues = new Set<string>(
  collectionOptionGroups.flatMap(group => group.options.map(option => option[0]))
)
const collectionSelectGroups = collectionOptionGroups.map(group => ({
  label: group.label,
  options: group.options.map(([value, label]) => ({ value, label }))
}))
const collectionSelectOptions = collectionSelectGroups.flatMap(group => group.options)
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"

const mediaOptions: ReadonlyArray<{ value: LibraryMedia, label: string, title: string }> = [
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
const languageOptions: ReadonlyArray<{ value: LibraryLanguage, label: string }> = [
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

function orderedLibraryValues<T extends string>(values: readonly string[], options: readonly { value: T }[]): T[] {
  const selected = new Set(values)
  return options.filter(option => selected.has(option.value)).map(option => option.value)
}

function safeLibraryIdentifier(value: string): boolean {
  return /^[\p{L}\p{N}_-]+$/u.test(value) && value.length <= 100
}

function parseAboutAuthorOptions(authorsValue: unknown, idsValue: unknown): AboutAuthorOption[] {
  const authorsRecord = asRecord(authorsValue)
  if (!authorsRecord || !Array.isArray(authorsRecord.data) || !Array.isArray(idsValue)) {
    throw new Error("Invalid Library about-author metadata")
  }
  const labels = new Map<string, string>()
  const rejectedAuthorIds = new Set<string>()
  for (const value of authorsRecord.data) {
    const record = asRecord(value)
    const id = stringAt(record, "authorid")
    const label = stringAt(record, "full_name")
    if (!safeLibraryIdentifier(id) || rejectedAuthorIds.has(id)) continue
    if (!label || labels.has(id)) {
      labels.delete(id)
      rejectedAuthorIds.add(id)
      continue
    }
    labels.set(id, label)
  }
  const idCounts = new Map<string, number>()
  for (const value of idsValue) {
    if (typeof value !== "string" || !safeLibraryIdentifier(value)) continue
    idCounts.set(value, (idCounts.get(value) ?? 0) + 1)
  }
  const output: AboutAuthorOption[] = []
  for (const [id, count] of idCounts) {
    if (count !== 1) continue
    const label = labels.get(id)
    if (!label) continue
    output.push({ id, label })
  }
  return output.sort((left, right) => left.label.localeCompare(right.label, "sv"))
}

async function fetchAboutAuthorOptions(base: string): Promise<AboutAuthorOption[]> {
  try {
    const root = base.replace(/\/$/, "")
    const [authors, ids] = await Promise.all([
      $fetch<unknown>(`${root}/get_authors`, {
        query: { exclude: authorExclude }, retry: 0
      }),
      $fetch<unknown>(`${root}/get_authorkeywords`, { retry: 0 })
    ])
    return parseAboutAuthorOptions(authors, ids)
  } catch {
    return []
  }
}

function parseImprintBounds(value: unknown): ImprintBounds {
  const record = asRecord(value)
  const fromValue = stringAt(recordAt(record, "start_year"), "value_as_string")
  const toValue = stringAt(recordAt(record, "end_year"), "value_as_string")
  if (!/^\d{4}$/.test(fromValue) || !/^\d{4}$/.test(toValue)) {
    throw new Error("Invalid Library imprint range")
  }
  const from = Number(fromValue)
  const to = Number(toValue)
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)
    || from < 1000 || to > 3000 || from > to) {
    throw new Error("Invalid Library imprint range")
  }
  return { from, to }
}

async function fetchImprintBounds(base: string): Promise<ImprintBounds | null> {
  try {
    const response = await $fetch<unknown>(
      `${base.replace(/\/$/, "")}/imprint_range`,
      { retry: 0 }
    )
    return parseImprintBounds(response)
  } catch {
    return null
  }
}

function queryValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function queryList<T extends string>(value: unknown, allowed: ReadonlySet<T>): T[] {
  if (typeof value !== "string" || !value) return []
  const items = value.split(",")
  if (items.some(item => !allowed.has(item as T)) || new Set(items).size !== items.length) return []
  const output: T[] = []
  for (const item of items) {
    if (output.includes(item as T)) continue
    output.push(item as T)
  }
  return output
}

function queryYearRange(value: unknown): [number, number] | null {
  const bounds = chronologyBounds.value
  if (!bounds) return null
  if (typeof value !== "string" || !/^\d{4},\d{4}$/.test(value)) return null
  const [from, to] = value.split(",").map(Number)
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)
    || from! < bounds.from || to! > bounds.to || from! > to!) return null
  if (from === bounds.from && to === bounds.to) return null
  return [from!, to!]
}

function queryAdvanced(value: unknown): boolean {
  return value === null || value === "" || value === "1" || value === "true"
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

function relevanceSortKey(value: unknown): RelevanceSortKey {
  return sorts.some(item => item.key === value) ? value as RelevanceSortKey : "relevans"
}

function epubSortKey(value: unknown): EpubSortKey {
  return epubSorts.some(item => item.key === value) ? value as EpubSortKey : "popularitet"
}

function authorSortKey(value: unknown): AuthorSortKey {
  return authorSorts.some(item => item.key === value) ? value as AuthorSortKey : "popularitet"
}

function partSortKey(value: unknown): PartSortKey {
  return partSorts.some(item => item.key === value) ? value as PartSortKey : "titlar"
}

function routeState(path: string, query: LocationQuery): LibraryRouteState {
  const standalone = path === "/epub"
  const downloadMode = !standalone && query.nedladdning !== undefined
    && queryAdvanced(query.nedladdning)
  const requestedMode = queryValue(query.visa)
  const mode: LibraryMode = downloadMode
    ? "works"
    : requestedMode === "pdf"
    ? "pdf"
    : !standalone && requestedMode === "latest"
      ? "latest"
    : !standalone && requestedMode === "authors"
      ? "authors"
    : !standalone && requestedMode === "works"
      ? "works"
    : !standalone && requestedMode === "parts"
      ? "parts"
    : standalone || requestedMode === "epub" ? "epub" : "all"
  const parsed = Number(queryValue(query.sida))
  return {
    standalone,
    mode,
    filter: queryValue(query.filter),
    sort: mode === "all" ? relevanceSortKey(query.sort)
      : mode === "latest" ? "nytillkommet"
      : mode === "authors" ? authorSortKey(query.sort)
      : mode === "parts" ? partSortKey(query.sort)
      : epubSortKey(query.sort),
    page: mode === "authors"
      ? 1
      : Number.isInteger(parsed) && parsed >= 1 ? parsed : 1,
    hide1800: mode === "latest" && query.hide1800 !== undefined,
    downloadMode,
    advanced: query.avancerat !== undefined && queryAdvanced(query.avancerat),
    advancedFilters: advancedFilters(query)
  }
}

function sanitizeFilter(value: string): string {
  return value
    .replace(/([A-Öa-ö])[-–—]([A-Öa-ö])/g, "$1 $2")
    .replace(/[.,!"“'”]/g, "")
    .trim()
}

function orClauses(clauses: string[]): string {
  if (clauses.length === 0) return ""
  if (clauses.length === 1) return clauses[0]!
  return `(${clauses.join(" OR ")})`
}

function wrapPredicate(clause: string): string {
  return clause.startsWith("(") && clause.endsWith(")") ? clause : `(${clause})`
}

function languagePredicate(values: LibraryLanguage[]): string {
  const fields = new Map<string, string[]>()
  let translation = false
  let original = false
  let foreign = false
  for (const value of values) {
    const [field, selected] = value.split(":") as [string, string]
    if (field === "translation") translation = true
    else if (field === "original") original = true
    else if (field === "foreign") foreign = true
    else fields.set(field, [...(fields.get(field) ?? []), selected])
  }
  const clauses = [...fields.entries()].map(([field, selected]) => (
    selected.length === 1
      ? `${field}:${selected[0]}`
      : `${field}:(${selected.join(" OR ")})`
  ))
  const translated = "(keyword:language-source OR keyword:translated OR (authors>(type:translator)))"
  if (translation) clauses.push(translated)
  if (original) clauses.push(`((NOT ${translated}) AND NOT language_source:unknown)`)
  if (foreign) {
    clauses.push("(_exists_:language AND NOT language:swe)")
    clauses.push("language_source:unknown")
  }
  return orClauses(clauses)
}

function mediaPredicate(values: LibraryMedia[]): string {
  const media = values
    .filter((value): value is Exclude<LibraryMedia, "has_epub:true"> => value !== "has_epub:true")
    .map(value => value.slice("mediatype:".length))
  const clauses: string[] = []
  if (media.length === 1) clauses.push(`mediatype:${media[0]}`)
  else if (media.length > 1) clauses.push(`mediatype:(${media.join(" OR ")})`)
  if (values.includes("has_epub:true")) clauses.push("has_epub:true")
  return orClauses(clauses)
}

function collectionFieldMap(values: string[]): Map<string, string[]> {
  const fields = new Map<string, string[]>()
  for (const value of values) {
    for (const expression of value.split("|")) {
      const separator = expression.indexOf(":")
      if (separator <= 0) continue
      const field = expression.slice(0, separator)
      const selected = expression.slice(separator + 1).split(";").filter(Boolean)
      fields.set(field, [...(fields.get(field) ?? []), ...selected])
    }
  }
  return fields
}

function ordinaryCollectionPredicate(values: string[]): string {
  return orClauses([...collectionFieldMap(values)].map(([field, selected]) => (
    selected.length === 1 ? `${field}:${selected[0]}` : `${field}:(${selected.join(" OR ")})`
  )))
}

function narrowingCollectionPredicate(values: string[]): string {
  const clauses = values.map(value => {
    const fields = [...collectionFieldMap([value])].map(([field, selected]) => (
      `${field}:(${selected.join(" OR ")})`
    ))
    return fields.length === 1 ? fields[0]! : `(${fields.join(" OR ")})`
  })
  if (!clauses.length) return ""
  return clauses.length === 1 ? `(${clauses[0]})` : `(${clauses.join(" AND ")})`
}

function aboutAuthorPredicate(values: string[]): string {
  if (values.length === 0) return ""
  const selected = values.length === 1 ? values[0] : `(${values.join(" OR ")})`
  return `authorkeyword>(authorid:${selected})`
}

function advancedPredicate(filters: LibraryAdvancedFilters): string {
  const clauses: string[] = []
  if (filters.gender) {
    clauses.push(`(gender:${filters.gender} OR authors>(gender:${filters.gender}))`)
  }
  if (filters.yearRange) {
    const [from, to] = filters.yearRange
    clauses.push(
      `(sort_date_imprint.date:[${from} TO ${to}] OR birth.date:[${from} TO ${to}] OR death.date:[${from} TO ${to}])`
    )
  }
  const aboutAuthors = aboutAuthorPredicate(filters.aboutAuthorIds)
  if (aboutAuthors) clauses.push(aboutAuthors)
  const language = languagePredicate(filters.languages)
  if (language) clauses.push(language)
  const collections = ordinaryCollectionPredicate(filters.keywords)
  if (collections) clauses.push(collections)
  const media = mediaPredicate(filters.media)
  if (media) clauses.push(media)
  const base = clauses.length === 1 ? clauses[0]! : clauses.map(wrapPredicate).join(" AND ")
  const narrowing = narrowingCollectionPredicate(filters.narrowingKeywords)
  return [narrowing, base].filter(Boolean).join(" AND ")
}

function appendAdvanced(base: string, filters: LibraryAdvancedFilters): string {
  const predicate = advancedPredicate(filters)
  return [base, predicate].filter(Boolean).join(" AND ")
}

function requestUrl(
  base: string,
  filter: string,
  selectedSort: RelevanceSortKey,
  advanced: LibraryAdvancedFilters,
  reversed = false
): string {
  const params = new URLSearchParams({
    exclude: excludedFields,
    show_all: "false",
    sort_field: sortExpression(
      sorts.find(item => item.key === selectedSort)?.expression ?? "_score|desc",
      reversed
    ),
    from: "0",
    to: "100",
    vectorize: "true",
    sid: "true"
  })
  const sanitized = sanitizeFilter(filter)
  const predicate = appendAdvanced(sanitized ? `(${sanitized})` : "", advanced)
  if (predicate) params.set("q", predicate)
  return `${base.replace(/\/$/, "")}/relevance/${resultTypes}?${params}`
}

async function fetchResults(
  base: string,
  filter: string,
  selectedSort: RelevanceSortKey,
  advanced: LibraryAdvancedFilters,
  signal?: AbortSignal,
  reversed = false
): Promise<LibraryResponse> {
  try {
    const response = await $fetch<unknown>(requestUrl(base, filter, selectedSort, advanced, reversed), {
      signal,
      retry: 0
    })
    return parseLibraryResponse(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyLibraryResponse(true)
  }
}

function authorRequestUrl(
  base: string,
  filter: string,
  selectedSort: AuthorSortKey,
  limit: number,
  reversed = false
): string {
  const params = new URLSearchParams({
    exclude: excludedFields,
    show_all: "false",
    sort_field: sortExpression(
      authorSorts.find(item => item.key === selectedSort)?.expression ?? "popularity|desc",
      reversed
    ),
    from: "0",
    to: String(limit),
    vectorize: "true",
    sid: "true"
  })
  const sanitized = sanitizeFilter(filter)
  if (sanitized) params.set("q", `(${sanitized})`)
  return `${base.replace(/\/$/, "")}/relevance/author?${params}`
}

async function fetchRawAuthorResults(
  base: string,
  filter: string,
  selectedSort: AuthorSortKey,
  limit: number,
  signal?: AbortSignal,
  reversed = false
): Promise<LibraryResponse> {
  try {
    const response = await $fetch<unknown>(
      authorRequestUrl(base, filter, selectedSort, limit, reversed),
      { signal, retry: 0 }
    )
    return parseLibraryResponse(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyLibraryResponse(true)
  }
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

function sortAuthorResults(
  data: LibraryResult[],
  selectedSort: AuthorSortKey,
  reversed: boolean
): LibraryResult[] {
  const direction = reversed ? -1 : 1
  return [...data].sort((left, right) => {
    const primary = selectedSort === "namn"
      ? left.primaryLabel.localeCompare(right.primaryLabel, "sv")
      : selectedSort === "kronologi"
        ? left.authorBirth - right.authorBirth
        : right.authorPopularity - left.authorPopularity
    return (primary || left.primaryLabel.localeCompare(right.primaryLabel, "sv")) * direction
  })
}

async function fetchAuthorResults(
  base: string,
  filter: string,
  selectedSort: AuthorSortKey,
  limit: number,
  advanced: LibraryAdvancedFilters,
  signal?: AbortSignal,
  reversed = false
): Promise<AuthorBrowseResponse> {
  const [works, parts, authors] = await Promise.all([
    fetchBrowseCountResponse(base, "works", filter, advanced, signal),
    fetchBrowseCountResponse(base, "parts", filter, advanced, signal),
    fetchRawAuthorResults(base, "", selectedSort, 10_000, signal, reversed)
  ])
  if (!works || !parts || works.failed || parts.failed || authors.failed) {
    return emptyAuthorBrowseResponse(true)
  }
  const authorIds = [...new Set([...works.authorIds, ...parts.authorIds])]
  const selected = authors.data.filter(author => authorIds.includes(author.authorId))
  if (selected.length !== authorIds.length) return emptyAuthorBrowseResponse(true)
  return {
    data: sortAuthorResults(selected, selectedSort, reversed).slice(0, limit),
    hits: authorIds.length,
    suggest: authors.suggest,
    failed: false,
    workCount: works.distinctHits,
    partCount: parts.hits,
    workAuthorIds: works.authorIds,
    partAuthorIds: parts.authorIds
  }
}

function epubRequestUrl(
  base: string,
  filter: string,
  selectedSort: EpubSortKey,
  page: number,
  advanced: LibraryAdvancedFilters,
  reversed = false
): string {
  const sanitized = sanitizeFilter(filter)
  const predicate = appendAdvanced(
    sanitized ? `has_epub:true AND (${sanitized})` : "has_epub:true",
    advanced
  )
  const params = new URLSearchParams({
    exclude: epubExcludedFields,
    include: epubIncludedFields,
    partial_string: "true",
    q: `${epubQueryPrefix} (${predicate})`,
    sort_field: sortExpression(
      epubSorts.find(item => item.key === selectedSort)?.expression ?? "popularity|desc",
      reversed
    ),
    from: String((page - 1) * 100),
    to: String(page * 100),
    suggest: "true"
  })
  return `${base.replace(/\/$/, "")}/query_string/${epubResultTypes}?${params}`
}

async function fetchEpubResults(
  base: string,
  filter: string,
  selectedSort: EpubSortKey,
  page: number,
  advanced: LibraryAdvancedFilters,
  signal?: AbortSignal,
  reversed = false
): Promise<EpubResponse> {
  try {
    const response = await $fetch<unknown>(
      epubRequestUrl(base, filter, selectedSort, page, advanced, reversed),
      { signal, retry: 0 }
    )
    return parseEpubResponse(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyEpubResponse(true)
  }
}

function browseRequestUrl(
  base: string,
  mode: "works" | "parts",
  filter: string,
  selectedSort: BrowseSortKey,
  page: number,
  advanced: LibraryAdvancedFilters,
  reversed = false,
  sourceOnly = false
): string {
  const types = mode === "parts" ? "etext-part,faksimil-part" : epubResultTypes
  const sortsForMode = mode === "parts" ? partSorts : epubSorts
  const sanitized = sanitizeFilter(filter)
  const basePredicate = [
    sanitized ? `(${sanitized})` : "",
    sourceOnly ? "export>type:(xml OR txt OR workdb)" : ""
  ].filter(Boolean).join(" AND ")
  const predicate = appendAdvanced(basePredicate, advanced)
  const params = new URLSearchParams({
    exclude: epubExcludedFields,
    include: mode === "parts" ? `${epubIncludedFields},authors` : epubIncludedFields,
    partial_string: "true",
    q: `${epubQueryPrefix} ${predicate || "*"}`,
    sort_field: sortExpression(
      sortsForMode.find(item => item.key === selectedSort)?.expression
        ?? (mode === "parts" ? "sortkey|asc" : "popularity|desc"),
      reversed
    ),
    author_aggregation: "true",
    from: String((page - 1) * 100),
    to: String(page * 100),
    suggest: "true"
  })
  return `${base.replace(/\/$/, "")}/query_string/${types}?${params}`
}

async function fetchBrowseResults(
  base: string,
  mode: "works" | "parts",
  filter: string,
  selectedSort: BrowseSortKey,
  page: number,
  advanced: LibraryAdvancedFilters,
  signal?: AbortSignal,
  reversed = false,
  sourceOnly = false
): Promise<BrowseResponse> {
  try {
    const response = await $fetch<unknown>(
      browseRequestUrl(base, mode, filter, selectedSort, page, advanced, reversed, sourceOnly),
      { signal, retry: 0 }
    )
    return parseBrowseResponse(response, mode)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyBrowseResponse(true)
  }
}

function countOnlyRequestUrl(url: string): string {
  const separator = url.indexOf("?")
  const path = separator === -1 ? url : url.slice(0, separator)
  const params = new URLSearchParams(separator === -1 ? "" : url.slice(separator + 1))
  params.set("from", "0")
  params.set("to", "0")
  return `${path}?${params}`
}

async function fetchBrowseCountResponse(
  base: string,
  mode: "works" | "parts",
  filter: string,
  advanced: LibraryAdvancedFilters,
  signal?: AbortSignal
): Promise<BrowseResponse | null> {
  try {
    const request = browseRequestUrl(
      base,
      mode,
      filter,
      mode === "parts" ? "titlar" : "popularitet",
      1,
      advanced
    )
    const response = await $fetch<unknown>(countOnlyRequestUrl(request), { signal, retry: 0 })
    return parseBrowseResponse(response, mode)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return null
  }
}

const latestSortExpression = "imported|desc,main_author.name_for_index|asc,sortkey|asc,sort_date_imprint.date|asc"

function latestRequestUrl(
  base: string,
  filter: string,
  page: number,
  hide1800: boolean,
  advanced: LibraryAdvancedFilters,
  reversed = false
): string {
  const sanitized = sanitizeFilter(filter)
  const clauses = [sanitized ? `(${sanitized})` : "", hide1800 ? "NOT keyword:1800" : ""]
    .filter(Boolean)
  const predicate = appendAdvanced(clauses.length ? clauses.join(" AND ") : "", advanced)
  const params = new URLSearchParams({
    exclude: epubExcludedFields,
    include: epubIncludedFields,
    partial_string: "true",
    q: `${epubQueryPrefix} ${predicate || "*"}`,
    sort_field: sortExpression(latestSortExpression, reversed),
    author_aggregation: "true",
    imported_aggregation: "true",
    from: String((page - 1) * 100),
    to: String(page * 100),
    suggest: "true"
  })
  return `${base.replace(/\/$/, "")}/query_string/${epubResultTypes}?${params}`
}

async function fetchLatestResults(
  base: string,
  filter: string,
  page: number,
  hide1800: boolean,
  advanced: LibraryAdvancedFilters,
  signal?: AbortSignal,
  reversed = false
): Promise<LatestResponse> {
  try {
    const response = await $fetch<unknown>(
      latestRequestUrl(base, filter, page, hide1800, advanced, reversed),
      { signal, retry: 0 }
    )
    return parseLatestResponse(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyLatestResponse(true)
  }
}

const pdfPredicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"

function pdfRequestUrl(
  base: string,
  filter: string,
  selectedSort: EpubSortKey,
  page: number,
  advanced: LibraryAdvancedFilters,
  reversed = false
): string {
  const sanitized = sanitizeFilter(filter)
  const predicate = appendAdvanced(
    sanitized ? `${pdfPredicate} AND (${sanitized})` : pdfPredicate,
    advanced
  )
  const params = new URLSearchParams({
    exclude: epubExcludedFields,
    include: pdfIncludedFields,
    partial_string: "true",
    q: `${epubQueryPrefix} (${predicate})`,
    sort_field: sortExpression(
      epubSorts.find(item => item.key === selectedSort)?.expression ?? "popularity|desc",
      reversed
    ),
    from: String((page - 1) * 100),
    to: String(page * 100),
    suggest: "true"
  })
  return `${base.replace(/\/$/, "")}/query_string/${epubResultTypes}?${params}`
}

async function fetchPdfResults(
  base: string,
  filter: string,
  selectedSort: EpubSortKey,
  page: number,
  advanced: LibraryAdvancedFilters,
  signal?: AbortSignal,
  reversed = false
): Promise<PdfResponse> {
  try {
    const response = await $fetch<unknown>(
      pdfRequestUrl(base, filter, selectedSort, page, advanced, reversed),
      { signal, retry: 0 }
    )
    return parsePdfResponse(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyPdfResponse(true)
  }
}

const initialApiBase = import.meta.server
  ? config.libraryApiBase
  : config.public.libraryApiBase
const { data: imprintBoundsData } = await useAsyncData<ImprintBounds | null>(
  `library:imprint-range:${route.path}`,
  () => fetchImprintBounds(initialApiBase),
  { default: () => null }
)
const chronologyBounds = computed(() => imprintBoundsData.value)
const chronologyFloor = computed(() => chronologyBounds.value?.from ?? 0)
const chronologyCeiling = computed(() => chronologyBounds.value?.to ?? 0)
const { data: aboutAuthorOptionsData } = await useAsyncData<AboutAuthorOption[]>(
  `library:about-authors:${route.path}`,
  () => route.path === "/epub" ? Promise.resolve([]) : fetchAboutAuthorOptions(initialApiBase),
  { default: () => [] }
)
const aboutAuthorOptions = computed(() => aboutAuthorOptionsData.value ?? [])
const aboutAuthorIdSet = computed<ReadonlySet<string>>(
  () => new Set(aboutAuthorOptions.value.map(option => option.id))
)

const initialState = Object.freeze(routeState(route.path, route.query))
const standalone = initialState.standalone
const mode = initialState.mode
const initialFilter = initialState.filter
const initialSort = initialState.mode === "all"
  ? initialState.sort as RelevanceSortKey
  : "relevans"
const initialEpubSort = initialState.mode === "epub" || initialState.mode === "pdf"
  ? initialState.sort as EpubSortKey
  : "popularitet"
const initialBrowseSort = initialState.mode === "authors"
  ? initialState.sort as AuthorSortKey
  : initialState.mode === "parts"
    ? initialState.sort as PartSortKey
    : initialState.mode === "works"
      ? initialState.sort as EpubSortKey
      : "popularitet"
async function fetchInitialData(): Promise<LibraryPageData> {
  if (initialState.mode === "epub") {
    return {
      mode: "epub",
      response: await fetchEpubResults(
        initialApiBase, initialFilter, initialEpubSort, initialState.page,
        initialState.advancedFilters
      )
    }
  }
  if (initialState.mode === "pdf") {
    return {
      mode: "pdf",
      response: await fetchPdfResults(
        initialApiBase, initialFilter, initialEpubSort, initialState.page,
        initialState.advancedFilters
      )
    }
  }
  if (initialState.mode === "latest") {
    return {
      mode: "latest",
      response: await fetchLatestResults(
        initialApiBase, initialFilter, initialState.page, initialState.hide1800,
        initialState.advancedFilters
      )
    }
  }
  if (initialState.mode === "authors") {
    return {
      mode: "authors",
      response: await fetchAuthorResults(
        initialApiBase, initialFilter, initialBrowseSort as AuthorSortKey, 150,
        initialState.advancedFilters
      )
    }
  }
  if (initialState.mode === "works" || initialState.mode === "parts") {
    return {
      mode: initialState.mode,
      response: await fetchBrowseResults(
        initialApiBase, initialState.mode, initialFilter, initialBrowseSort, initialState.page,
        initialState.advancedFilters, undefined, false, initialState.downloadMode
      )
    }
  }
  return {
    mode: "all",
    response: await fetchResults(
      initialApiBase, initialFilter, initialSort, initialState.advancedFilters
    )
  }
}

function emptyInitialData(): LibraryPageData {
  if (initialState.mode === "epub") return { mode: "epub", response: emptyEpubResponse() }
  if (initialState.mode === "pdf") return { mode: "pdf", response: emptyPdfResponse() }
  if (initialState.mode === "latest") return { mode: "latest", response: emptyLatestResponse() }
  if (initialState.mode === "authors") {
    return { mode: "authors", response: emptyAuthorBrowseResponse() }
  }
  if (initialState.mode === "works" || initialState.mode === "parts") {
    return { mode: initialState.mode, response: emptyBrowseResponse() }
  }
  return { mode: "all", response: emptyLibraryResponse() }
}

const { data: initialData } = await useAsyncData<LibraryPageData>(
  `library:${route.path}:${mode}:${initialFilter}:${initialState.sort}:${initialState.page}:${initialState.hide1800}:${initialState.downloadMode}:${JSON.stringify(initialState.advancedFilters)}`,
  fetchInitialData,
  { default: emptyInitialData }
)

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
const selectedKeywords = ref<string[]>([...initialState.advancedFilters.keywords])
const selectedNarrowingKeywords = ref<string[]>([
  ...initialState.advancedFilters.narrowingKeywords
])
const selectedAboutAuthorIds = ref<string[]>([...initialState.advancedFilters.aboutAuthorIds])
const selectedMedia = ref<LibraryMedia[]>([...initialState.advancedFilters.media])
const selectedLanguages = ref<LibraryLanguage[]>([...initialState.advancedFilters.languages])
const narrowingSelectGroups = computed(() => collectionSelectGroups.map(group => ({
  ...group,
  options: group.options.map(option => ({
    ...option,
    disabled: selectedKeywords.value.includes(option.value)
  }))
})))
const chronologyFromDraft = ref(String(
  initialState.advancedFilters.yearRange?.[0] ?? chronologyBounds.value?.from ?? ""
))
const chronologyToDraft = ref(String(
  initialState.advancedFilters.yearRange?.[1] ?? chronologyBounds.value?.to ?? ""
))
const chronologyDraftDirty = ref(false)
const mounted = ref(false)
const selectedSourceWorks = ref<Map<string, BrowseResult>>(new Map())
const selectedSourceFormats = ref<Set<string>>(new Set())
const formatPopoverOpen = ref(false)
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
const hasActiveFilters = computed(() => (
  Boolean(filter.value || selectedGender.value || selectedMedia.value.length
    || selectedLanguages.value.length || selectedKeywords.value.length
    || selectedNarrowingKeywords.value.length || selectedAboutAuthorIds.value.length
    || queryYearRange(`${chronologyFromDraft.value},${chronologyToDraft.value}`))
))
const results = ref(
  initialData.value?.mode === "all" ? initialData.value.response : emptyLibraryResponse()
)
const epubResults = ref(initialData.value?.mode === "epub"
  ? initialData.value.response
  : emptyEpubResponse())
const pdfResults = ref(initialData.value?.mode === "pdf"
  ? initialData.value.response
  : emptyPdfResponse())
const latestResults = ref(initialData.value?.mode === "latest"
  ? initialData.value.response
  : emptyLatestResponse())
const authorResults = ref(initialData.value?.mode === "authors"
  ? initialData.value.response
  : emptyAuthorBrowseResponse())
const workResults = ref(initialData.value?.mode === "works"
  ? initialData.value.response
  : emptyBrowseResponse())
const partResults = ref(initialData.value?.mode === "parts"
  ? initialData.value.response
  : emptyBrowseResponse())
type BrowseCounts = {
  identity: string
  authors: number | null
  works: number | null
  parts: number | null
  workAuthorIds: string[] | null
  partAuthorIds: string[] | null
}
const initialAuthorResponse = initialData.value?.mode === "authors"
  ? initialData.value.response
  : null
const browseCounts = ref<BrowseCounts>({
  identity: JSON.stringify([initialFilter, initialState.advancedFilters]),
  authors: initialAuthorResponse && !initialAuthorResponse.failed
    ? initialAuthorResponse.hits
    : null,
  works: initialAuthorResponse && !initialAuthorResponse.failed
    ? initialAuthorResponse.workCount
    : initialData.value?.mode === "works" && !initialData.value.response.failed
      ? initialData.value.response.distinctHits
      : null,
  parts: initialAuthorResponse && !initialAuthorResponse.failed
    ? initialAuthorResponse.partCount
    : initialData.value?.mode === "parts" && !initialData.value.response.failed
      ? initialData.value.response.hits
      : null,
  workAuthorIds: initialAuthorResponse && !initialAuthorResponse.failed
    ? initialAuthorResponse.workAuthorIds
    : initialData.value?.mode === "works" && !initialData.value.response.failed
      ? initialData.value.response.authorIds
      : null,
  partAuthorIds: initialAuthorResponse && !initialAuthorResponse.failed
    ? initialAuthorResponse.partAuthorIds
    : initialData.value?.mode === "parts" && !initialData.value.response.failed
      ? initialData.value.response.authorIds
    : null,
})
const browseResults = computed(() => currentMode.value === "parts"
  ? partResults.value
  : workResults.value)
const expandedWorkKey = ref(initialState.mode === "works"
  ? workResults.value.data.find(item => item.titlePath === queryValue(route.query.title))?.key ?? ""
  : "")
const visibleSourceWorks = computed(() => workResults.value.data.filter(
  item => item.sourceExports.length > 0
))
const selectedSourceWorkList = computed(() => [...selectedSourceWorks.value.values()])
const allVisibleSourceWorksSelected = computed(() => (
  visibleSourceWorks.value.length > 0
  && visibleSourceWorks.value.every(item => selectedSourceWorks.value.has(item.key))
))
const selectedSourceExports = computed(() => selectedSourceWorkList.value.flatMap(
  item => item.sourceExports
))
const sourceFormatAvailability = computed(() => {
  const counts = new Map<string, number>()
  for (const item of selectedSourceExports.value) {
    const key = `${item.mediatype}:${item.type}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
})
const selectedDownloadExports = computed(() => selectedSourceExports.value.filter(item => (
  selectedSourceFormats.value.has(`${item.mediatype}:${item.type}`)
)))
const selectedDownloadFiles = computed(() => selectedDownloadExports.value.map(item => (
  `${item.lbworkid}-${item.mediatype}-${item.type}`
)).filter((token, index, all) => all.indexOf(token) === index))
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
let countVersion = 0
let countController: AbortController | null = null
let ownedNavigation: { key: string, version: number } | null = null

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
    state.standalone, state.mode, state.filter, state.sort, state.page, state.hide1800,
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
    page: state.mode === "all" || state.mode === "authors" ? 1 : state.page,
    hide1800: state.hide1800,
    downloadMode: state.downloadMode,
    advancedFilters: state.advancedFilters
  }
}

function currentState(): QueryState {
  return {
    standalone: route.path === "/epub",
    mode: currentMode.value,
    filter: filter.value,
    sort: currentMode.value === "all"
      ? selectedSort.value
      : currentMode.value === "latest" ? "nytillkommet"
      : currentMode.value === "epub" || currentMode.value === "pdf"
        ? selectedEpubSort.value
        : selectedBrowseSort.value,
    page: currentMode.value === "all" ? 1 : currentPage.value,
    hide1800: currentMode.value === "latest" && hide1800.value,
    downloadMode: !standalone && downloadMode.value,
    advancedFilters: {
      gender: selectedGender.value,
      keywords: [...selectedKeywords.value],
      narrowingKeywords: [...selectedNarrowingKeywords.value],
      aboutAuthorIds: [...selectedAboutAuthorIds.value],
      media: [...selectedMedia.value],
      languages: [...selectedLanguages.value],
      yearRange: queryYearRange(
        `${chronologyFromDraft.value},${chronologyToDraft.value}`
      )
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

function browseCountIdentity(filterValue: string, advanced: LibraryAdvancedFilters): string {
  return JSON.stringify([filterValue, advanced])
}

function invalidateBrowseCounts(filterValue: string, advanced: LibraryAdvancedFilters) {
  const identity = browseCountIdentity(filterValue, advanced)
  if (browseCounts.value.identity === identity) return
  countVersion += 1
  countController?.abort()
  countController = null
  browseCounts.value = {
    identity,
    authors: null,
    works: null,
    parts: null,
    workAuthorIds: null,
    partAuthorIds: null
  }
}

function updateBrowseCount(
  filterValue: string,
  advanced: LibraryAdvancedFilters,
  mode: "authors" | "works" | "parts",
  count: number,
  authorIds?: string[]
) {
  const identity = browseCountIdentity(filterValue, advanced)
  if (identity !== browseCountIdentity(filter.value, currentState().advancedFilters)) return
  const current = browseCounts.value.identity === identity
    ? browseCounts.value
    : {
        identity,
        authors: null,
        works: null,
        parts: null,
        workAuthorIds: null,
        partAuthorIds: null
      }
  const next: BrowseCounts = {
    ...current,
    identity,
    [mode]: count,
    ...(mode === "works" && authorIds ? { workAuthorIds: [...authorIds] } : {}),
    ...(mode === "parts" && authorIds ? { partAuthorIds: [...authorIds] } : {})
  }
  if (next.workAuthorIds !== null && next.partAuthorIds !== null) {
    next.authors = new Set([...next.workAuthorIds, ...next.partAuthorIds]).size
  }
  browseCounts.value = next
}

async function refreshBrowseCounts(filterValue: string, advanced: LibraryAdvancedFilters) {
  const identity = browseCountIdentity(filterValue, advanced)
  if (standalone || identity !== browseCountIdentity(filter.value, currentState().advancedFilters)) {
    return
  }
  if (browseCounts.value.identity !== identity) invalidateBrowseCounts(filterValue, advanced)
  if (browseCounts.value.works !== null && browseCounts.value.parts !== null
    && browseCounts.value.workAuthorIds !== null
    && browseCounts.value.partAuthorIds !== null) return
  const version = ++countVersion
  countController?.abort()
  const activeController = new AbortController()
  countController = activeController
  const currentCounts = browseCounts.value.identity === identity
    ? browseCounts.value
    : {
        identity,
        authors: null,
        works: null,
        parts: null,
        workAuthorIds: null,
        partAuthorIds: null
      }
  const [works, parts] = await Promise.all([
    currentCounts.works === null || currentCounts.workAuthorIds === null
      ? fetchBrowseCountResponse(
          config.public.libraryApiBase, "works", filterValue, advanced, activeController.signal
        ).catch(() => null)
      : Promise.resolve(null),
    currentCounts.parts === null || currentCounts.partAuthorIds === null
      ? fetchBrowseCountResponse(
          config.public.libraryApiBase, "parts", filterValue, advanced, activeController.signal
        ).catch(() => null)
      : Promise.resolve(null)
  ])
  if (version !== countVersion || activeController.signal.aborted
    || identity !== browseCountIdentity(filter.value, currentState().advancedFilters)) return
  const current = browseCounts.value.identity === identity
    ? browseCounts.value
    : {
        identity,
        authors: null,
        works: null,
        parts: null,
        workAuthorIds: null,
        partAuthorIds: null
      }
  const workAuthorIds = works?.authorIds ?? current.workAuthorIds
  const partAuthorIds = parts?.authorIds ?? current.partAuthorIds
  browseCounts.value = {
    identity,
    authors: workAuthorIds !== null && partAuthorIds !== null
      ? new Set([...workAuthorIds, ...partAuthorIds]).size
      : current.authors,
    works: works?.distinctHits ?? current.works,
    parts: parts?.hits ?? current.parts,
    workAuthorIds,
    partAuthorIds
  }
  countController = null
}

function queryFor(state: QueryState): LocationQuery {
  const query: LocationQuery = { ...route.query }
  delete query.visa
  delete query.filter
  delete query.sort
  delete query.sida
  delete query.hide1800
  delete query.nedladdning
  delete query.title
  if (state.mode !== "all" && (!state.standalone || state.mode === "pdf")) {
    query.visa = state.mode
  }
  if (state.filter) query.filter = state.filter
  if (state.mode !== "all" || state.sort !== "relevans") query.sort = state.sort
  if (state.mode !== "all" && state.mode !== "authors" && state.page > 1) {
    query.sida = String(state.page)
  }
  if (state.mode === "latest" && state.hide1800) query.hide1800 = null
  if (state.downloadMode) query.nedladdning = "1"
  return query
}

async function runBrowserRequest(state: QueryState, version: number) {
  if (version !== requestVersion) return
  controller = new AbortController()
  loading.value = true
  const reversed = isSortReversed(state.mode, state.sort)
  const response = state.mode === "epub"
    ? await fetchEpubResults(
        config.public.libraryApiBase,
        state.filter,
        state.sort as EpubSortKey,
        state.page,
        state.advancedFilters,
        controller.signal,
        reversed
      ).catch(() => null)
    : state.mode === "pdf"
      ? await fetchPdfResults(
          config.public.libraryApiBase,
          state.filter,
          state.sort as EpubSortKey,
          state.page,
          state.advancedFilters,
          controller.signal,
          reversed
        ).catch(() => null)
      : state.mode === "latest"
        ? await fetchLatestResults(
            config.public.libraryApiBase,
            state.filter,
            state.page,
            state.hide1800,
            state.advancedFilters,
            controller.signal,
            reversed
          ).catch(() => null)
        : state.mode === "authors"
          ? await fetchAuthorResults(
              config.public.libraryApiBase,
              state.filter,
              state.sort as AuthorSortKey,
              150,
              state.advancedFilters,
              controller.signal,
              reversed
            ).catch(() => null)
          : state.mode === "works" || state.mode === "parts"
            ? await fetchBrowseResults(
                config.public.libraryApiBase,
                state.mode,
                state.filter,
                state.sort as BrowseSortKey,
                state.page,
                state.advancedFilters,
                controller.signal,
                reversed,
                state.downloadMode
              ).catch(() => null)
            : await fetchResults(
                config.public.libraryApiBase,
                state.filter,
                state.sort as RelevanceSortKey,
                state.advancedFilters,
                controller.signal,
                reversed
              ).catch(() => null)
  if (version !== requestVersion || response === null) return
  if (state.mode === "epub") epubResults.value = response as EpubResponse
  else if (state.mode === "pdf") pdfResults.value = response as PdfResponse
  else if (state.mode === "latest") latestResults.value = response as LatestResponse
  else if (state.mode === "authors") {
    authorResults.value = response as AuthorBrowseResponse
    if (!authorResults.value.failed) {
      updateBrowseCount(
        state.filter, state.advancedFilters, "works", authorResults.value.workCount,
        authorResults.value.workAuthorIds
      )
      updateBrowseCount(
        state.filter, state.advancedFilters, "parts", authorResults.value.partCount,
        authorResults.value.partAuthorIds
      )
    }
  }
  else if (state.mode === "works") {
    workResults.value = response as BrowseResponse
    if (!workResults.value.failed) {
      updateBrowseCount(
        state.filter, state.advancedFilters, "works", workResults.value.distinctHits,
        workResults.value.authorIds
      )
    }
    expandedWorkKey.value = workResults.value.data.find(
      item => item.titlePath === queryValue(route.query.title)
    )?.key ?? ""
  }
  else if (state.mode === "parts") {
    partResults.value = response as BrowseResponse
    if (!partResults.value.failed) {
      updateBrowseCount(
        state.filter, state.advancedFilters, "parts", partResults.value.hits,
        partResults.value.authorIds
      )
    }
  }
  else results.value = response as LibraryResponse
  loading.value = false
  controller = null
  if (!(response as { failed: boolean }).failed) {
    void refreshBrowseCounts(state.filter, state.advancedFilters)
  }
}

async function persistAndRequest(state: QueryState, version: number) {
  if (version !== requestVersion) return
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
  if (version === requestVersion) await runBrowserRequest(state, version)
}

function beginIntent(state: QueryState, delay = 0) {
  const captured = Object.freeze({ ...state })
  const version = invalidateIntent()
  currentMode.value = captured.mode
  invalidateBrowseCounts(captured.filter, captured.advancedFilters)
  filter.value = captured.filter
  currentPage.value = captured.page
  hide1800.value = captured.hide1800
  downloadMode.value = captured.downloadMode
  if (captured.mode === "epub" || captured.mode === "pdf") {
    selectedEpubSort.value = captured.sort as EpubSortKey
  }
  else if (captured.mode === "all") selectedSort.value = captured.sort as RelevanceSortKey
  else if (captured.mode === "authors" || captured.mode === "works" || captured.mode === "parts") {
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

function selectMode(nextMode: LibraryMode) {
  beginIntent({
    standalone: route.path === "/epub",
    mode: nextMode,
    filter: filter.value,
    sort: nextMode === "all"
      ? "relevans"
      : nextMode === "latest"
        ? "nytillkommet"
        : nextMode === "parts" ? "titlar" : "popularitet",
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
  if (state.mode !== "authors" || authorResults.value.failed
    || authorResults.value.data.length >= authorResults.value.hits) return
  const version = invalidateIntent()
  const activeController = new AbortController()
  controller = activeController
  loading.value = true
  const response = await fetchAuthorResults(
    config.public.libraryApiBase,
    state.filter,
    state.sort as AuthorSortKey,
    Math.max(150, authorResults.value.hits),
    state.advancedFilters,
    activeController.signal,
    isSortReversed(state.mode, state.sort)
  ).catch(() => null)
  if (version !== requestVersion || activeController.signal.aborted) return
  if (response !== null && !response.failed) {
    authorResults.value = response
    updateBrowseCount(state.filter, state.advancedFilters, "authors", response.hits)
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

async function pushAdvancedQuery(
  key: "kön" | "keywords" | "keywords_aux" | "about_authors" | "mediatypes" | "languages" | "intervall",
  value: string
) {
  invalidateIntent()
  const query: LocationQuery = { ...route.query }
  delete query.sida
  if (value) query[key] = value
  else delete query[key]
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
    values, aboutAuthorOptions.value.map(option => ({ value: option.id }))
  )
  void pushAdvancedQuery("about_authors", selectedAboutAuthorIds.value.join(","))
}

function commitLanguages(values: string[]) {
  selectedLanguages.value = orderedLibraryValues(values, languageSelectOptions)
  void pushAdvancedQuery("languages", selectedLanguages.value.join(","))
}

const chronologyRangeStyle = computed(() => {
  const bounds = chronologyBounds.value
  if (!bounds) return { "--chronology-from": "0%", "--chronology-to": "100%" }
  const span = bounds.to - bounds.from
  const from = Number(chronologyFromDraft.value)
  const to = Number(chronologyToDraft.value)
  const fromPercent = Number.isFinite(from) ? (from - bounds.from) / span * 100 : 0
  const toPercent = Number.isFinite(to) ? (to - bounds.from) / span * 100 : 100
  return {
    "--chronology-from": `${Math.max(0, Math.min(100, fromPercent))}%`,
    "--chronology-to": `${Math.max(0, Math.min(100, toPercent))}%`
  }
})

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

const chronologyPointerEndpoint = ref<"from" | "to" | null>(null)
const chronologyFromRange = ref<HTMLInputElement | null>(null)
const chronologyToRange = ref<HTMLInputElement | null>(null)
function chronologyPointerYear(event: PointerEvent): number | null {
  const bounds = chronologyBounds.value
  if (!bounds || !(event.currentTarget instanceof HTMLElement)) return null
  const box = event.currentTarget.getBoundingClientRect()
  const usableWidth = Math.max(1, box.width - 20)
  const fraction = Math.max(0, Math.min(1, (event.clientX - box.left - 10) / usableWidth))
  return Math.round(bounds.from + fraction * (bounds.to - bounds.from))
}

function beginChronologyPointer(event: PointerEvent) {
  const track = event.currentTarget
  if (
    event.button !== 0
    || !(track instanceof HTMLElement)
  ) return
  event.preventDefault()
  const year = chronologyPointerYear(event)
  if (year === null) return
  const from = Number(chronologyFromDraft.value)
  const to = Number(chronologyToDraft.value)
  const fromDistance = Math.abs(year - from)
  const toDistance = Math.abs(year - to)
  chronologyPointerEndpoint.value = fromDistance < toDistance
    ? "from"
    : fromDistance > toDistance
      ? "to"
      : year < from ? "from" : "to"
  const range = chronologyPointerEndpoint.value === "from"
    ? chronologyFromRange.value
    : chronologyToRange.value
  range?.focus({ preventScroll: true })
  track.setPointerCapture(event.pointerId)
  setChronologyDraft(chronologyPointerEndpoint.value, String(year))
}

function moveChronologyPointer(event: PointerEvent) {
  const endpoint = chronologyPointerEndpoint.value
  if (!endpoint) return
  const year = chronologyPointerYear(event)
  if (year !== null) setChronologyDraft(endpoint, String(year))
}

function finishChronologyPointer(event: PointerEvent) {
  const endpoint = chronologyPointerEndpoint.value
  if (!endpoint) return
  moveChronologyPointer(event)
  chronologyPointerEndpoint.value = null
  void commitChronologyDraft(endpoint, endpoint === "from"
    ? chronologyFromDraft.value
    : chronologyToDraft.value)
}

function cancelChronologyPointer() {
  chronologyPointerEndpoint.value = null
  resetChronologyDraft()
}

function resetChronologyDraft() {
  chronologyDraftDirty.value = false
  const range = routeState(route.path, route.query).advancedFilters.yearRange
  chronologyFromDraft.value = String(range?.[0] ?? chronologyBounds.value?.from ?? "")
  chronologyToDraft.value = String(range?.[1] ?? chronologyBounds.value?.to ?? "")
}

async function commitChronologyDraft(endpoint: "from" | "to", value: string) {
  setChronologyDraft(endpoint, value)
  const bounds = chronologyBounds.value
  if (!bounds) {
    resetChronologyDraft()
    return
  }
  const from = /^\d{4}$/.test(chronologyFromDraft.value)
    ? Number(chronologyFromDraft.value) : Number.NaN
  const to = /^\d{4}$/.test(chronologyToDraft.value)
    ? Number(chronologyToDraft.value) : Number.NaN
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)
    || from < bounds.from || to > bounds.to || from > to) {
    resetChronologyDraft()
    return
  }
  const current = routeState(route.path, route.query).advancedFilters.yearRange
  if ((current?.[0] ?? bounds.from) === from
    && (current?.[1] ?? bounds.to) === to) {
    chronologyDraftDirty.value = false
    return
  }
  const valueToPersist = from === bounds.from && to === bounds.to
    ? ""
    : `${from},${to}`
  await pushAdvancedQuery("intervall", valueToPersist)
  chronologyDraftDirty.value = false
}

watch(
  () => stateKey(requestState(routeState(route.path, route.query))),
  () => {
    const parsedRoute = routeState(route.path, route.query)
    const state = requestState(parsedRoute)
    syncAdvancedControls(parsedRoute)
    currentMode.value = state.mode
    invalidateBrowseCounts(state.filter, state.advancedFilters)
    filter.value = state.filter
    currentPage.value = state.page
    hide1800.value = state.hide1800
    const sourceModeChanged = downloadMode.value !== state.downloadMode
    downloadMode.value = state.downloadMode
    if (sourceModeChanged) clearSourceSelection()
    if (state.mode === "epub" || state.mode === "pdf") {
      selectedEpubSort.value = state.sort as EpubSortKey
    }
    else if (state.mode === "all") selectedSort.value = state.sort as RelevanceSortKey
    else if (state.mode === "authors" || state.mode === "works" || state.mode === "parts") {
      selectedBrowseSort.value = state.sort as BrowseSortKey
    }
    if (ownedNavigation?.key === stateKey(state)) return
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
    expandedWorkKey.value = workResults.value.data.find(
      item => item.titlePath === titlePath
    )?.key ?? ""
  },
  { flush: "sync" }
)

const ownedQueryKeys = new Set([
  "visa", "filter", "sort", "sida", "hide1800", "nedladdning", "title"
])

function preservedQuery(): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (ownedQueryKeys.has(key)) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === null) params.append(key, "")
        else if (typeof item === "string") params.append(key, item)
      }
    } else if (value === null) {
      params.append(key, "")
    } else if (typeof value === "string") {
      params.append(key, value)
    }
  }
  return params
}

function stateHref(state: {
  mode: LibraryMode
  filter: string
  sort: RelevanceSortKey | BrowseSortKey | LatestSortKey
  page?: number
  hide1800?: boolean
}): string {
  const params = preservedQuery()
  if (state.mode !== "all" && (route.path !== "/epub" || state.mode === "pdf")) {
    params.set("visa", state.mode)
  }
  if (state.filter) params.set("filter", state.filter)
  if (state.mode !== "all") {
    params.set("sort", state.sort as EpubSortKey)
  } else if (state.sort !== "relevans") {
    params.set("sort", state.sort)
  }
  if (state.page !== undefined && state.mode !== "authors") {
    params.set("sida", String(state.page))
  }
  if (state.mode === "latest" && state.hide1800) params.set("hide1800", "")
  if (downloadMode.value && state.mode === "works") params.set("nedladdning", "1")
  const query = params.toString()
  return `${route.path}${query ? `?${query}` : ""}`
}

const allTabHref = computed(() => stateHref({
  mode: "all",
  filter: filter.value,
  sort: "relevans"
}))
const latestTabHref = computed(() => stateHref({
  mode: "latest",
  filter: filter.value,
  sort: "nytillkommet"
}))
const authorsTabHref = computed(() => stateHref({
  mode: "authors",
  filter: filter.value,
  sort: "popularitet"
}))
const worksTabHref = computed(() => stateHref({
  mode: "works",
  filter: filter.value,
  sort: "popularitet"
}))
const partsTabHref = computed(() => stateHref({
  mode: "parts",
  filter: filter.value,
  sort: "titlar"
}))
const epubTabHref = computed(() => stateHref({
  mode: "epub",
  filter: filter.value,
  sort: "popularitet"
}))
const pdfTabHref = computed(() => stateHref({
  mode: "pdf",
  filter: filter.value,
  sort: "popularitet"
}))

function epubSortHref(sort: EpubSortKey): string {
  return stateHref({ mode: currentMode.value === "pdf" ? "pdf" : "epub", filter: filter.value, sort, page: 1 })
}

function browseSortHref(sort: BrowseSortKey): string {
  return stateHref({ mode: currentMode.value, filter: filter.value, sort, page: 1 })
}

const activeBrowseSorts = computed(() => currentMode.value === "authors"
  ? authorSorts
  : currentMode.value === "parts" ? partSorts : epubSorts)

const downloadResults = computed(() => currentMode.value === "pdf"
  ? pdfResults.value.data
  : epubResults.value.data)
const downloadFailed = computed(() => currentMode.value === "pdf"
  ? pdfResults.value.failed
  : epubResults.value.failed)
const downloadDistinctHits = computed(() => currentMode.value === "pdf"
  ? pdfResults.value.distinctHits
  : epubResults.value.distinctHits)
const pageCount = computed(() => Math.ceil(
  (currentMode.value === "latest"
    ? latestResults.value.distinctHits
    : currentMode.value === "authors"
      ? 0
      : currentMode.value === "works"
        ? workResults.value.distinctHits
        : currentMode.value === "parts"
          ? partResults.value.hits
        : downloadDistinctHits.value)
  / 100
))
type PaginationItem = { key: string, page: number | null }

function paginationItems(total: number, current: number): PaginationItem[] {
  if (total <= 10) {
    return Array.from({ length: total }, (_, index) => ({
      key: `page-${index + 1}`,
      page: index + 1
    }))
  }
  let start = Math.max(2, Math.min(current - 3, total - 8))
  let end = Math.min(total - 1, start + 7)
  start = Math.max(2, end - 7)
  const items: PaginationItem[] = [{ key: "page-1", page: 1 }]
  if (start > 2) items.push({ key: "ellipsis-start", page: null })
  for (let page = start; page <= end; page += 1) {
    items.push({ key: `page-${page}`, page })
  }
  if (end < total - 1) items.push({ key: "ellipsis-end", page: null })
  items.push({ key: `page-${total}`, page: total })
  return items
}

const pages = computed(() => paginationItems(pageCount.value, currentPage.value))

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
  countVersion += 1
  countController?.abort()
  countController = null
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
  if (currentMode.value === "authors" && route.query.sida !== undefined) {
    void router.replace({ path: route.path, query: queryFor(currentState()) })
  }
  const initialFailed = initialData.value?.response.failed ?? true
  if (!initialFailed) void refreshBrowseCounts(filter.value, currentState().advancedFilters)
})
onUnmounted(disposeLibraryRequest)
</script>

<template>
  <div :data-library-mounted="mounted ? 'true' : undefined">
    <h1 class="text-6xl lg:ml-12">{{ standalone ? "Hämta e-böcker" : "Botanisera i biblioteket" }}</h1>
    <div class="lg:ml-12" :class="{ searching: loading, dl_mode: downloadMode }">
      <div id="controls">
        <form
          class="lg:p-5 p-2 lg:border border-gray-900 w-full lg:max-w-5xl"
          @submit.prevent="submitSearch"
        >
          <div class="main_input flex flex-wrap -ml-6 relative mb-8 items-center">
            <svg class="w-6 h-6 relative left-10 top-0 -mt-px" viewBox="0 0 24 24" fill="none" stroke="#7A1400" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
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
              <span class="uppercase text-xs">{{ advancedOpen ? "Dölj" : "Visa" }} utökad sökning</span>{{ " " }}
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
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25" />
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
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
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
              <label>
                <span class="sr-only">Författarkön</span>
                <select
                  :value="selectedGender"
                  data-library-gender
                  class="gender_select"
                  aria-label="Författarkön"
                  @change="commitGender"
                >
                  <option value="" :selected="selectedGender === ''">Alla författare</option>
                  <option value="female" :selected="selectedGender === 'female'">Kvinnliga författare</option>
                  <option value="male" :selected="selectedGender === 'male'">Manliga författare</option>
                </select>
              </label>
            </div>
            <div class="title_select_container">
              <label>
                <span class="sr-only">Kategorier och utgivare</span>
                <SearchMultiSelect
                  data-library-keywords
                  class="keyword_select"
                  accessible-name="Filtrera: Kategorier / Utgivare"
                  :model-value="selectedKeywords"
                  :options="collectionSelectOptions"
                  :option-groups="collectionSelectGroups"
                  placeholder="Filtrera: Kategorier / Utgivare"
                  @update:model-value="commitKeywords"
                />
              </label>
            </div>
            <div v-if="!standalone && aboutAuthorOptions.length" class="title_select_container about_container">
              <label>
                <span class="sr-only">Om ett författarskap</span>
                <SearchMultiSelect
                  data-library-about-authors
                  class="about_select"
                  accessible-name="Om ett författarskap"
                  :model-value="selectedAboutAuthorIds"
                  :options="aboutAuthorOptions.map(author => ({ value: author.id, label: author.label }))"
                  placeholder="Om ett författarskap"
                  searchable
                  @update:model-value="commitAboutAuthors"
                />
              </label>
            </div>
            <div v-if="!standalone">
              <div class="text-sm mb-4 max-w-sm">
                Får du för många träffar? Välj ytterligare samlingar (en eller flera) i menyn
                <span class="sc">AVGRÄNSA SÖKNINGEN</span> här nedanför. Ju fler samlingar du väljer, desto färre sökträffar får du.
              </div>
              <label>
                <span class="sr-only">Avgränsa sökningen</span>
                <SearchMultiSelect
                  data-library-narrowing
                  class="keyword_select block"
                  accessible-name="Avgränsa sökningen"
                  :model-value="selectedNarrowingKeywords"
                  :options="collectionSelectOptions"
                  :option-groups="narrowingSelectGroups"
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
                  accessible-name="Utgivningsformat"
                  :model-value="selectedMedia"
                  :options="mediaSelectOptions"
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
                  accessible-name="Språk …"
                  :model-value="selectedLanguages"
                  :options="languageSelectOptions"
                  placeholder="Språk …"
                  @update:model-value="commitLanguages"
                />
              </label>
            </div>
            <div v-if="!standalone" class="more ml-[2px] relative" :class="{ show_more: downloadMode }">
              <button
                type="button"
                data-library-download-mode
                class="bg-transparent border-0 p-0 text-primary"
                @click="toggleDownloadMode"
              >
                <i class="fa fa-download color-black mr-1 text-xs" />
                {{ downloadMode ? "Stäng källmaterial" : "Ladda ner källmaterial" }}
              </button>
            </div>
            <div
              v-if="downloadMode"
              class="more_container h-8 relative mb-4 show_more"
            >
              <button
                v-if="!allVisibleSourceWorksSelected"
                type="button"
                data-library-select-visible
                class="sc btn btn-small absolute left"
                @click="selectVisibleSourceWorks"
              >Välj alla verk i listan</button>
              <button
                v-else
                type="button"
                data-library-deselect-visible
                class="sc btn btn-small absolute left"
                @click="deselectVisibleSourceWorks"
              >Avmarkera alla verk i listan</button>
            </div>
          </div>
          <div class="chronology primarycolor ml-px pl-px">
            <i class="fa fa-clock-o mr-1 ml-px" />{{ " " }}
            <span class="sc mt-8">Tidslinje: kronologisk sökning</span>
          </div>
          <div v-if="chronologyBounds" data-library-chronology-range class="flex">
            <div
              class="rzslider mt-3 slider-large chronology_ranges"
              :style="chronologyRangeStyle"
              @pointerdown="beginChronologyPointer"
              @pointermove="moveChronologyPointer"
              @pointerup="finishChronologyPointer"
              @pointercancel="cancelChronologyPointer"
            >
              <input
                ref="chronologyFromRange"
                type="range"
                :min="chronologyFloor"
                :max="chronologyCeiling"
                step="1"
                :value="chronologyFromDraft"
                aria-label="Från tryckår reglage"
                @input="setChronologyDraft('from', ($event.target as HTMLInputElement).value)"
                @change="commitChronologyDraft('from', ($event.target as HTMLInputElement).value)"
              >
              <input
                ref="chronologyToRange"
                type="range"
                :min="chronologyFloor"
                :max="chronologyCeiling"
                step="1"
                :value="chronologyToDraft"
                aria-label="Till tryckår reglage"
                @input="setChronologyDraft('to', ($event.target as HTMLInputElement).value)"
                @change="commitChronologyDraft('to', ($event.target as HTMLInputElement).value)"
              >
            </div>
            <div class="whitespace-nowrap self-center chronology_inputs">
              <span class="text-sm sc">Tryckår: </span>
              <input
                class="text-sm text-center py-1"
                type="text"
                :value="chronologyFromDraft"
                aria-label="Från tryckår"
                @input="setChronologyDraft('from', ($event.target as HTMLInputElement).value)"
                @change="commitChronologyDraft('from', ($event.target as HTMLInputElement).value)"
              >{{ " " }}
              <span class="text-sm sc">till </span>
              <input
                class="text-sm text-center py-1"
                type="text"
                :value="chronologyToDraft"
                aria-label="Till tryckår"
                @input="setChronologyDraft('to', ($event.target as HTMLInputElement).value)"
                @change="commitChronologyDraft('to', ($event.target as HTMLInputElement).value)"
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
              >Epub<span v-if="epubResults.distinctHits" class="num_hits">: {{ epubResults.distinctHits }}</span></a>
              <template v-if="currentMode !== 'all'">{{ " " }}</template>
              <a
                data-library-tab="pdf"
                :href="pdfTabHref"
                :aria-current="currentMode === 'pdf' ? 'page' : undefined"
                class="sc btn btn-small text-base"
                :class="{
                  active: currentMode === 'pdf',
                  'relevance-unavailable': currentMode !== 'pdf' && !pdfResults.distinctHits
                }"
                @click.prevent="selectMode('pdf')"
              >PDF<span v-if="pdfResults.distinctHits" class="num_hits">: {{ pdfResults.distinctHits }}</span></a>
            </template>
            <template v-else>
              <a
                data-library-tab="all"
                :href="allTabHref"
                :aria-current="currentMode === 'all' ? 'page' : undefined"
                class="sc btn btn-small text-base"
                :class="{ active: currentMode === 'all' }"
                @click.prevent="selectMode('all')"
              >Alla träffar</a>
              <template v-if="currentMode !== 'all'">{{ " " }}</template>
              <a
                data-library-tab="latest"
                :href="latestTabHref"
                :aria-current="currentMode === 'latest' ? 'page' : undefined"
                class="sc btn btn-small text-base"
                :class="{ active: currentMode === 'latest' }"
                @click.prevent="selectMode('latest')"
              >Nytt</a>
              <template v-if="currentMode !== 'all'">{{ " " }}</template>
              <a
                data-library-tab="authors"
                :href="authorsTabHref"
                :aria-current="currentMode === 'authors' ? 'page' : undefined"
                class="sc btn btn-small text-base"
                :class="{
                  active: currentMode === 'authors',
                  'library-tab-disabled-look': downloadMode || browseCounts.authors === 0
                }"
                :aria-disabled="downloadMode || undefined"
                @click.prevent="!downloadMode && selectMode('authors')"
              >Författare<span v-if="browseCounts.authors !== null" class="num_hits">: {{ browseCounts.authors }}</span></a>
              <template v-if="currentMode !== 'all'">{{ " " }}</template>
              <a
                data-library-tab="works"
                :href="worksTabHref"
                :aria-current="currentMode === 'works' ? 'page' : undefined"
                class="sc btn btn-small text-base"
                :class="{ active: currentMode === 'works' }"
                @click.prevent="selectMode('works')"
              >Verk<span v-if="browseCounts.works" class="num_hits">: {{ browseCounts.works }}</span></a>
              <template v-if="currentMode !== 'all'">{{ " " }}</template>
              <a
                v-if="!downloadMode"
                data-library-tab="parts"
                :href="partsTabHref"
                :aria-current="currentMode === 'parts' ? 'page' : undefined"
                class="sc btn btn-small text-base"
                :class="{
                  active: currentMode === 'parts',
                  'library-tab-disabled-look': browseCounts.parts === 0
                }"
                @click.prevent="selectMode('parts')"
              >Dikt, novell, etc.<span v-if="browseCounts.parts" class="parts num_hits">: {{ browseCounts.parts }}</span></a>
              <template v-if="!downloadMode && currentMode !== 'all'">{{ " " }}</template>
              <a
                v-if="!downloadMode"
                data-library-tab="epub"
                :href="epubTabHref"
                :aria-current="currentMode === 'epub' ? 'page' : undefined"
                class="sc btn btn-small text-base"
                :class="{
                  active: currentMode === 'epub',
                  'relevance-unavailable': currentMode === 'all' && !epubResults.distinctHits
                }"
                @click.prevent="selectMode('epub')"
              >Epub<span v-if="epubResults.distinctHits" class="num_hits">: {{ epubResults.distinctHits }}</span></a>
              <template v-if="!downloadMode && currentMode !== 'all'">{{ " " }}</template>
              <a
                v-if="!downloadMode"
                data-library-tab="pdf"
                :href="pdfTabHref"
                :aria-current="currentMode === 'pdf' ? 'page' : undefined"
                class="sc btn btn-small text-base"
                :class="{
                  active: currentMode === 'pdf',
                  'relevance-unavailable': currentMode !== 'pdf' && !pdfResults.distinctHits
                }"
                @click.prevent="selectMode('pdf')"
              >PDF<span v-if="pdfResults.distinctHits" class="num_hits">: {{ pdfResults.distinctHits }}</span></a>
            </template>
          </div>
        </form>
      </div>
      <div class="flex flex-col lg:flex-row items-stretch w-full lg:max-w-5xl text-lg leading-tight">
        <div class="bg-white/65 lg:p-6 p-2 lg:border border-gray-900 flex-grow">
          <div v-if="currentMode === 'all'" class="result relevance pl-0 lg:ml-3 lg:ml-0 w-full lg:w-auto">
            <div class="text-base">
              <div class="inline-block sc mr-2">Sortera: </div>
              <ul class="part_header top_header mb-4 inline-block">
                <li v-for="item in sorts" :key="item.key" class="inline-block sc">
                  <a
                    href=""
                    class="sort_item"
                    :class="{ active: selectedSort === item.key }"
                    :data-library-sort="item.key"
                    @click.prevent="selectSort(item.key)"
                  >{{ item.label }}</a>
                  <i
                    v-if="selectedSort === item.key"
                    class="fa"
                    :class="isSortReversed(currentMode, item.key) ? 'fa-caret-up' : 'fa-caret-down'"
                  />
                </li>
              </ul>
            </div>
            <div v-if="loading" class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0">
              <i class="spinner fa fa-spinner fa-pulse" />
            </div>
            <div v-else>
              <div v-if="results.failed" data-library-error>Ett fel uppstod.</div>
              <div v-else-if="!results.data.length" data-library-empty class="pb-4">Inga träffar.</div>
              <table v-else class="w-full -ml-4">
                <tbody>
                  <tr
                    v-for="(item, index) in results.data"
                    :key="`${item.index}:${item.primaryHref}:${index}`"
                    data-library-result
                    class="lg:table-row flex flex-col justify-between pb-2 lg:pb-0 -ml-2 hover:bg-gray-300 hover:bg-opacity-80 transition-colors duration-150"
                  >
                    <td class="lg:text-right lg:table-cell w-44">
                      <span class="sc primarycolor whitespace-nowrap text-base">{{ item.sourceLabel }}</span>
                    </td>
                    <td class="order-2 min-w-0">
                      <a
                        v-if="item.download || !isNuxtInternalHref(item.primaryHref)"
                        :href="item.primaryHref"
                        :download="item.download || undefined"
                        :data-library-author-name="item.index === 'author' || undefined"
                        :data-library-result-title="item.fullTitle ? '' : undefined"
                        :title="item.fullTitle && item.fullTitle !== item.primaryLabel ? item.fullTitle : undefined"
                        :class="item.fullTitle ? 'block max-w-[calc(100vw-2rem)] lg:max-w-[32rem] whitespace-nowrap overflow-hidden text-ellipsis' : undefined"
                      >
                        <template v-if="item.index === 'author'">
                          <span class="surname">{{ item.authorSurname }}</span><span v-if="item.authorGivenNames">,</span>
                          {{ item.authorGivenNames }}
                          <span
                            v-if="item.mobileYearLabel"
                            data-library-author-mobile-years
                            class="lg:hidden"
                          >{{ item.mobileYearLabel }}</span>
                        </template>
                        <template v-else>{{ item.primaryLabel }}</template>
                      </a>
                      <NuxtLink
                        v-else
                        :to="canonicalNuxtHref(item.primaryHref)"
                        :data-library-author-name="item.index === 'author' || undefined"
                        :data-library-result-title="item.fullTitle ? '' : undefined"
                        :title="item.fullTitle && item.fullTitle !== item.primaryLabel ? item.fullTitle : undefined"
                        :class="item.fullTitle ? 'block max-w-[calc(100vw-2rem)] lg:max-w-[32rem] whitespace-nowrap overflow-hidden text-ellipsis' : undefined"
                      >
                        <template v-if="item.index === 'author'">
                          <span class="surname">{{ item.authorSurname }}</span><span v-if="item.authorGivenNames">,</span>
                          {{ item.authorGivenNames }}
                          <span
                            v-if="item.mobileYearLabel"
                            data-library-author-mobile-years
                            class="lg:hidden"
                          >{{ item.mobileYearLabel }}</span>
                        </template>
                        <template v-else>{{ item.primaryLabel }}</template>
                      </NuxtLink>
                    </td>
                    <td class="lg:text-right hidden lg:table-cell text-base w-28 whitespace-nowrap">{{ item.yearLabel }}</td>
                    <td class="lg:text-right lg:uppercase lg:text-sm lg:pl-4 order-1 lg:max-w-40">
                      <NuxtLink
                        v-if="item.authorHref"
                        :to="canonicalNuxtHref(item.authorHref)"
                      >{{ item.secondaryAuthor }}</NuxtLink>
                      <span v-else class="text-gray-800">{{ item.secondaryAuthor }}</span>
                      <span
                        v-if="item.authorContribution"
                        data-library-author-contribution
                        class="text-gray-600 text-xs"
                      >{{ item.authorContribution }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else-if="currentMode === 'latest'" class="result title pl-0 flex-column min-h-500">
            <div class="flex items-baseline">
              <div class="text-base">
                <div class="inline-block sc mr-2">Sortera: </div>{{ " " }}
                <ul class="part_header top_header mb-4 inline-block">
                  <li class="inline-block sc">
                    <a
                      data-library-sort="nytillkommet"
                      class="sort_item active"
                      :href="latestTabHref"
                      @click.prevent="selectSort('nytillkommet')"
                    >Nytt</a>{{ " " }}<i
                      class="fa"
                      :class="isSortReversed(currentMode, 'nytillkommet') ? 'fa-caret-up' : 'fa-caret-down'"
                    />
                  </li>
                </ul>
              </div>
              <span class="sc ml-4">
                <span>{{ hide1800 ? "Visa även från:" : "Dölj verk:" }}</span>{{ " " }}
                <button
                  type="button"
                  data-library-hide-1800
                  class="text-primary ml-2 hover:text-gray-900 cursor-pointer bg-transparent border-0 p-0"
                  @click="toggle1800"
                >Nya vägar till det förflutna</button>
              </span>
            </div>
            <div v-if="loading" data-library-loading class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0">
              <i class="spinner fa fa-spinner fa-pulse" />
            </div>
            <div v-if="latestResults.failed" data-library-error>Ett fel uppstod.</div>
            <div v-else-if="!latestResults.groups.length" data-library-empty class="pb-4">Inga träffar.</div>
            <table v-else id="table" class="table block w-full flex-grow -ml-2">
              <tbody class="block">
                <template v-for="group in latestResults.groups" :key="group.imported">
                  <tr class="header grid grid-cols-1 w-full items-baseline">
                    <td class="type_header block">
                      <h3 data-library-latest-header class="row_title part_header">{{ group.label }}</h3>
                    </td>
                  </tr>
                  <tr
                    v-for="item in group.results"
                    :key="`${group.imported}:${item.titleId}:${item.titleHref}`"
                    data-library-latest-row
                    class="work_link grid w-full items-baseline transition-colors duration-150 hover:bg-gray-300 hover:bg-opacity-50 grid-cols-[minmax(0,1fr)_11rem] sm:grid-cols-[minmax(0,1fr)_7rem_11rem]"
                  >
                    <td class="block min-w-0">
                      <div class="text-ellipsis whitespace-nowrap overflow-hidden min-w-0 items-center gap-2">
                        <div class="header_container min-w-0 flex-1 align-middle">
                          <div class="header block overflow-hidden text-ellipsis whitespace-nowrap text-lg leading-tight">
                            <span class="title_inner">
                              <NuxtLink
                                :data-library-latest-title="item.titleId"
                                :to="canonicalNuxtHref(item.titleHref)"
                              >{{ item.title }}</NuxtLink>
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="text-left hidden sm:block w-28 text-base">{{ item.year }}</td>
                    <td class="block w-44 text-right">
                      <div class="text-ellipsis whitespace-nowrap overflow-hidden">
                        <span class="author uppercase text-sm">
                          <NuxtLink :to="canonicalNuxtHref(item.authorHref)">{{ item.surname }}</NuxtLink><template v-if="item.roleSuffix">{{ " " }}<span class="text-gray-700 sc">{{ item.roleSuffix.trim() }}</span></template>
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
                  <span v-if="currentPage <= 1" data-library-pagination-previous aria-disabled="true">Föregående</span>
                  <a v-else data-library-pagination-previous :href="latestPageHref(currentPage - 1)" @click.prevent="selectPage(currentPage - 1)">Föregående</a>
                </li>
                <li v-for="item in pages" :key="item.key" :class="{ active: item.page === currentPage }">
                  <span v-if="item.page === null" aria-hidden="true">…</span>
                  <a
                    v-else
                    :data-library-page="item.page"
                    :href="latestPageHref(item.page)"
                    :aria-current="item.page === currentPage ? 'page' : undefined"
                    @click.prevent="selectPage(item.page)"
                  >{{ item.page }}</a>
                </li>
                <li :class="{ disabled: currentPage >= pageCount }">
                  <span v-if="currentPage >= pageCount" data-library-pagination-next aria-disabled="true">Nästa</span>
                  <a v-else data-library-pagination-next :href="latestPageHref(currentPage + 1)" @click.prevent="selectPage(currentPage + 1)">Nästa</a>
                </li>
              </ul>
            </nav>
          </div>
          <div v-else-if="currentMode === 'authors'" class="result author pl-0 flex-column min-h-500">
            <div class="text-base">
              <div class="inline-block sc mr-2">Sortera: </div>
              <ul class="part_header top_header mb-4 inline-block">
                <li v-for="item in activeBrowseSorts" :key="item.key" class="inline-block sc">
                  <a
                    :href="browseSortHref(item.key)"
                    class="sort_item"
                    :class="{ active: selectedBrowseSort === item.key }"
                    :data-library-sort="item.key"
                    @click.prevent="selectSort(item.key)"
                  >{{ item.label }}</a><template v-if="selectedBrowseSort === item.key">{{ " " }}<i
                    class="fa"
                    :class="isSortReversed(currentMode, item.key) ? 'fa-caret-up' : 'fa-caret-down'"
                  /></template>
                </li>
              </ul>
            </div>
            <div v-if="loading" data-library-loading class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0">
              <i class="spinner fa fa-spinner fa-pulse" />
            </div>
            <div v-if="authorResults.failed" data-library-error>Ett fel uppstod.</div>
            <div v-else-if="!authorResults.data.length" data-library-empty class="pb-4">Inga träffar.</div>
            <table v-else class="table flex-grow w-full">
              <tbody>
                <tr
                  v-for="(item, index) in authorResults.data"
                  :key="`${item.primaryHref}:${index}`"
                  data-library-author-row
                  class="hover:bg-gray-300 hover:bg-opacity-80 transition-colors duration-150"
                >
                  <td class="author_row">
                    <NuxtLink :to="canonicalNuxtHref(item.primaryHref)" data-library-author-name>
                      <span class="surname uppercase">{{ item.authorSurname }}</span><span v-if="item.authorGivenNames">,</span>
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
                      Visa alla <span class="num">{{ authorResults.hits }}</span> träffar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else-if="currentMode === 'works' || currentMode === 'parts'" class="result title pl-0 flex-column min-h-500">
            <div class="text-base">
              <div class="inline-block sc mr-2">Sortera: </div>
              <ul class="part_header top_header mb-4 inline-block">
                <li v-for="item in activeBrowseSorts" :key="item.key" class="inline-block sc">
                  <a
                    :href="browseSortHref(item.key)"
                    class="sort_item"
                    :class="{ active: selectedBrowseSort === item.key }"
                    :data-library-sort="item.key"
                    @click.prevent="selectSort(item.key)"
                  >{{ item.label }}</a><template v-if="selectedBrowseSort === item.key">{{ " " }}<i
                    class="fa"
                    :class="isSortReversed(currentMode, item.key) ? 'fa-caret-up' : 'fa-caret-down'"
                  /></template>
                </li>
              </ul>
            </div>
            <div v-if="loading" data-library-loading class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0">
              <i class="spinner fa fa-spinner fa-pulse" />
            </div>
            <div v-if="browseResults.failed" data-library-error>Ett fel uppstod.</div>
            <div v-else-if="!browseResults.data.length" data-library-empty class="pb-4">Inga träffar.</div>
            <table v-else-if="currentMode === 'works'" id="table" class="table block w-full flex-grow -ml-2">
              <tbody class="block">
                <tr
                  v-for="item in browseResults.data"
                  :key="item.key"
                  data-library-work-row
                  class="work_link grid w-full items-baseline transition-colors duration-150 hover:bg-gray-300 hover:bg-opacity-50 grid-cols-[minmax(0,1fr)_11rem] sm:grid-cols-[minmax(0,1fr)_7rem_11rem]"
                  @click="downloadMode && toggleSourceWork(item)"
                >
                  <td class="block min-w-0">
                    <div class="min-w-0 items-center gap-2" :class="{ flex: downloadMode }">
                      <input
                        v-if="downloadMode"
                        data-library-source-checkbox
                        class="align-middle shrink-0"
                        type="checkbox"
                        :checked="selectedSourceWorks.has(item.key)"
                        :disabled="item.sourceExports.length === 0"
                        :aria-label="`Välj ${item.title}`"
                        @click.stop
                        @change="toggleSourceWork(item)"
                      >
                      <div class="header block overflow-hidden text-ellipsis whitespace-nowrap text-lg leading-tight">
                        <span class="title_inner">
                          <button
                            type="button"
                            data-library-work-toggle
                            class="library-work-toggle"
                            :aria-expanded="!downloadMode && expandedWorkKey === item.key"
                            @click.stop="downloadMode ? toggleSourceWork(item) : toggleWorkActions(item)"
                          >{{ item.title }}</button>
                        </span>
                      </div>
                    </div>
                    <div
                      v-show="!downloadMode && expandedWorkKey === item.key"
                      data-library-work-actions
                      class="collapse-content"
                    >
                      <ul class="links">
                        <li v-for="action in item.actions" :key="`${action.kind}:${action.href}`">
                          <a
                            v-if="action.kind === 'download'"
                            :href="action.href"
                            target="_self"
                            :download="action.downloadFilename"
                          >{{ action.label }}</a>
                          <NuxtLink
                            v-else
                            :to="canonicalNuxtHref(action.href)"
                          >{{ action.label }}</NuxtLink>
                        </li>
                      </ul>
                    </div>
                  </td>
                  <td class="text-left hidden sm:block w-28 text-base">{{ item.year }}</td>
                  <td class="block w-44 text-right">
                    <div class="text-ellipsis whitespace-nowrap overflow-hidden">
                      <span class="author uppercase text-sm">
                        <NuxtLink :to="canonicalNuxtHref(item.authorHref)">{{ item.surname }}</NuxtLink><template v-if="item.roleSuffix">{{ " " }}<span class="text-gray-700 sc">{{ item.roleSuffix.trim() }}</span></template>
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
                    <span class="title_inner"><NuxtLink :to="canonicalNuxtHref(item.titleHref)">{{ item.title }}</NuxtLink></span>
                  </td>
                  <td class="hidden lg:table-cell w-28">{{ item.year }}</td>
                  <td class="text-right uppercase text-sm w-40">
                    <NuxtLink :to="canonicalNuxtHref(item.authorHref)">{{ item.surname }}</NuxtLink><template v-if="item.roleSuffix">{{ " " }}<span class="text-xs text-gray-600">{{ item.roleSuffix.trim() }}</span></template>
                  </td>
                </tr>
              </tbody>
            </table>
            <nav v-if="pageCount > 1" aria-label="Sidnavigation">
              <ul class="pagination pagination-sm sc">
                <li :class="{ disabled: currentPage <= 1 }">
                  <span v-if="currentPage <= 1" data-library-pagination-previous aria-disabled="true">Föregående</span>
                  <a v-else data-library-pagination-previous :href="browsePageHref(currentPage - 1)" @click.prevent="selectPage(currentPage - 1)">Föregående</a>
                </li>
                <li v-for="item in pages" :key="item.key" :class="{ active: item.page === currentPage }">
                  <span v-if="item.page === null" aria-hidden="true">…</span>
                  <a v-else :data-library-page="item.page" :href="browsePageHref(item.page)" :aria-current="item.page === currentPage ? 'page' : undefined" @click.prevent="selectPage(item.page)">{{ item.page }}</a>
                </li>
                <li :class="{ disabled: currentPage >= pageCount }">
                  <span v-if="currentPage >= pageCount" data-library-pagination-next aria-disabled="true">Nästa</span>
                  <a v-else data-library-pagination-next :href="browsePageHref(currentPage + 1)" @click.prevent="selectPage(currentPage + 1)">Nästa</a>
                </li>
              </ul>
            </nav>
          </div>
          <div v-else-if="currentMode === 'epub' || currentMode === 'pdf'" class="result title pl-0 flex-column min-h-500">
            <div class="flex items-baseline">
              <div class="text-base">
                <div class="inline-block sc mr-2">Sortera: </div>{{ " " }}
                <ul class="part_header top_header mb-4 inline-block">
                  <li v-for="item in epubSorts" :key="item.key" class="inline-block sc">
                    <a
                      :href="epubSortHref(item.key)"
                      class="sort_item"
                      :class="{ active: selectedEpubSort === item.key }"
                      :data-library-sort="item.key"
                      @click.prevent="selectSort(item.key)"
                  >{{ item.label }}</a><template v-if="selectedEpubSort === item.key">{{ " " }}<i
                    class="fa"
                    :class="isSortReversed(currentMode, item.key) ? 'fa-caret-up' : 'fa-caret-down'"
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
            <div v-else-if="!downloadResults.length" data-library-empty class="pb-4">Inga träffar.</div>
            <table v-else id="table" class="table block w-full flex-grow -ml-2">
              <tbody class="block">
                <tr
                  v-for="item in downloadResults"
                  :key="`${item.downloadHref}:${item.titleHref}`"
                  :data-library-epub-row="currentMode === 'epub' || undefined"
                  :data-library-pdf-row="currentMode === 'pdf' || undefined"
                  class="work_link grid w-full items-baseline transition-colors duration-150 hover:bg-gray-300 hover:bg-opacity-50 grid-cols-[minmax(0,1fr)_11rem_5rem] sm:grid-cols-[minmax(0,1fr)_7rem_11rem_5rem]"
                >
                  <td class="block min-w-0">
                    <div class="text-ellipsis whitespace-nowrap overflow-hidden min-w-0 items-center gap-2">
                      <div class="header_container min-w-0 flex-1 align-middle">
                        <div class="header block overflow-hidden text-ellipsis whitespace-nowrap text-lg leading-tight">
                          <span class="title_inner">
                            <NuxtLink v-slot="{ navigate }" :to="item.titleTo" custom>
                              <a
                                :data-library-epub-title="currentMode === 'epub' || undefined"
                                :data-library-pdf-title="currentMode === 'pdf' || undefined"
                                :href="item.titleHref"
                                @click="navigate"
                              >{{ item.title }}</a>
                            </NuxtLink>
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="text-left hidden sm:block w-28 text-base">
                    <span
                      :data-library-epub-year="currentMode === 'epub' || undefined"
                      :data-library-pdf-year="currentMode === 'pdf' || undefined"
                    >{{ item.year }}</span>
                  </td>
                  <td class="block w-44 text-left">
                    <div class="text-ellipsis whitespace-nowrap overflow-hidden">
                      <span class="author uppercase text-sm">
                        <NuxtLink
                          :data-library-epub-author="currentMode === 'epub' || undefined"
                          :data-library-pdf-author="currentMode === 'pdf' || undefined"
                          :to="canonicalNuxtHref(item.authorHref)"
                        >{{ item.surname }}</NuxtLink><template v-if="item.roleSuffix">{{ " " }}<span class="text-gray-700 sc">{{ item.roleSuffix.trim() }}</span></template>
                      </span>
                    </div>
                  </td>
                  <td class="block whitespace-nowrap w-20 text-right">
                    <a
                      :data-library-epub-download="currentMode === 'epub' || undefined"
                      :data-library-pdf-download="currentMode === 'pdf' || undefined"
                      class="sc block"
                      :href="item.downloadHref"
                      :download="item.downloadFilename"
                      target="_self"
                    >Hämta</a>
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
                  >Föregående</span>
                  <a
                    v-else
                    data-library-pagination-previous
                    :href="epubPageHref(currentPage - 1)"
                    @click.prevent="selectPage(currentPage - 1)"
                  >Föregående</a>
                </li>
                <li
                  v-for="item in pages"
                  :key="item.key"
                  :class="{ active: item.page === currentPage }"
                >
                  <span v-if="item.page === null" aria-hidden="true">…</span>
                  <a
                    v-else
                    :data-library-page="item.page"
                    :href="epubPageHref(item.page)"
                    :aria-current="item.page === currentPage ? 'page' : undefined"
                    @click.prevent="selectPage(item.page)"
                  >{{ item.page }}</a>
                </li>
                <li :class="{ disabled: currentPage >= pageCount }">
                  <span
                    v-if="currentPage >= pageCount"
                    data-library-pagination-next
                    aria-disabled="true"
                  >Nästa</span>
                  <a
                    v-else
                    data-library-pagination-next
                    :href="epubPageHref(currentPage + 1)"
                    @click.prevent="selectPage(currentPage + 1)"
                  >Nästa</a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
        <div v-if="downloadMode">
          <div class="dl ml-4 p-4 sticky flex flex-col overflow-auto relative">
            <h3 class="uppercase text-xl mt-2 mb-2">Valda verk</h3>
            <div class="footer">
              <button
                type="button"
                data-library-clear-downloads
                class="btn text-sm mb-4"
                :disabled="selectedSourceWorkList.length === 0"
                @click="clearSourceSelection"
              >Rensa</button>
              {{ " " }}
              <button
                type="button"
                data-library-format-button
                class="btn text-sm mb-4"
                :disabled="selectedSourceWorkList.length === 0"
                @click="formatPopoverOpen = !formatPopoverOpen"
              >Välj format <i class="fa fa-download ml-2" /></button>

              <div
                v-if="formatPopoverOpen"
                data-library-format-popover
                class="popover block p-4 bg-white border border-gray-700"
              >
                <h3 class="popover-title">Välj format</h3>
                <div class="text-sm italic">
                  {{ sourceFormatAvailability.get("etext:workdb") ?? 0 }} etext<span v-if="(sourceFormatAvailability.get('etext:workdb') ?? 0) !== 1">er</span> vald<span v-if="(sourceFormatAvailability.get('etext:workdb') ?? 0) !== 1">a</span>,
                  {{ sourceFormatAvailability.get("faksimil:workdb") ?? 0 }} faksimil<span v-if="(sourceFormatAvailability.get('faksimil:workdb') ?? 0) !== 1">er</span> vald<span v-if="(sourceFormatAvailability.get('faksimil:workdb') ?? 0) !== 1">a</span>
                </div>
                <div class="flex justify-between w-64">
                  <div
                    v-for="group in sourceFormatGroups"
                    :key="group.mediatype"
                    :class="group.mediatype === 'etext' ? 'mr-4' : 'mx-2'"
                  >
                    <h3 class="uppercase text-base">{{ group.label }}</h3>
                    <ul class="checks">
                      <li v-for="format in group.formats" :key="format.type" class="whitespace-nowrap">
                        <input
                          :id="`source-${group.mediatype}-${format.type}`"
                          :data-library-source-format="`${group.mediatype}:${format.type}`"
                          type="checkbox"
                          class="mb-1 mr-1"
                          :checked="selectedSourceFormats.has(`${group.mediatype}:${format.type}`)"
                          :disabled="!(sourceFormatAvailability.get(`${group.mediatype}:${format.type}`) ?? 0)"
                          @change="toggleSourceFormat(`${group.mediatype}:${format.type}`)"
                        >
                        <label
                          class="capitalize"
                          :class="{ 'text-gray-500': !(sourceFormatAvailability.get(`${group.mediatype}:${format.type}`) ?? 0) }"
                          :for="`source-${group.mediatype}-${format.type}`"
                        >{{ format.label }}</label>
                      </li>
                    </ul>
                  </div>
                </div>
                <form action="/api/download" method="POST" class="mt-8 mb-4 flex justify-between">
                  <input type="hidden" name="files" :value="selectedDownloadFiles.join(',')">
                  <span data-library-download-size class="text-sm self-center">{{ downloadSizeLabel }}</span>
                  <button
                    type="submit"
                    data-library-download-submit
                    class="btn text-xs pull-right"
                    :disabled="selectedDownloadFiles.length === 0"
                  >Hämta <i class="fa fa-download ml-2" /></button>
                </form>
              </div>

              <ul class="mt-2 mb-2 flex-grow">
                <li v-for="item in selectedSourceWorkList" :key="item.key">
                  <button
                    type="button"
                    data-library-selected-work
                    class="download_item hover:line-through bg-transparent border-0 p-0 text-left"
                    @click="toggleSourceWork(item)"
                  ><span class="sc">{{ item.surname }}</span> {{ item.title }}</button>
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
  padding: 0;
  color: #7a1400;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.library-work-toggle:hover,
.library-work-toggle:focus {
  color: #333;
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
  text-transform: lowercase;
  color: #444;
  background: white;
  border: 1px solid lightgrey;
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

[data-library-chronology-range] input[type="range"] {
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

[data-library-chronology-range] input[type="range"]::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 4px;
  background: transparent;
}

[data-library-chronology-range] input[type="range"]::-webkit-slider-thumb {
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

</style>
