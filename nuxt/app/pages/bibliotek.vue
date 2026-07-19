<script setup lang="ts">
import type { LocationQuery, RouteLocationRaw } from "vue-router"

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
}

type LibraryResponse = {
  data: LibraryResult[]
  hits: number
  suggest: unknown[]
  failed: boolean
}

type LibraryMode = "all" | "epub" | "pdf"
type RelevanceSortKey = "relevans" | "forfattare" | "titlar" | "kronologi"
type EpubSortKey = "forfattare" | "titlar" | "popularitet" | "kronologi"

type LibraryRouteState = {
  standalone: boolean
  mode: LibraryMode
  filter: string
  sort: RelevanceSortKey | EpubSortKey
  page: number
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

type LibraryPageData =
  | { mode: "all", response: LibraryResponse }
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
    mobileYearLabel: ""
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
} | null {
  const mainAuthor = recordAt(record, "main_author")
  const id = stringAt(mainAuthor, "authorid")
  const name = stringAt(mainAuthor, "full_name")
  return id && name ? { id, name } : null
}

function parseTextResult(record: UnknownRecord, index: LibraryIndex): LibraryResult | null {
  const label = stringAt(record, "shorttitle") || stringAt(record, "title")
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
    primaryHref: `/författare/${encodeURIComponent(author)}/titlar/${encodeURIComponent(title)}/sida/${encodeURIComponent(page)}/${encodeURIComponent(media)}`,
    yearLabel: imprintYear(record),
    secondaryAuthor: mainAuthor.name,
    authorHref: `/författare/${encodeURIComponent(mainAuthor.id)}`
  }
}

function parsePdfResult(record: UnknownRecord): LibraryResult | null {
  const label = stringAt(record, "shorttitle") || stringAt(record, "title")
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
    download: true,
    yearLabel: imprintYear(record),
    secondaryAuthor: mainAuthor.name,
    authorHref: `/författare/${encodeURIComponent(mainAuthor.id)}`
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
    primaryHref: `/författare/${encodeURIComponent(id)}/`,
    yearLabel: years,
    authorSurname,
    authorGivenNames,
    mobileYearLabel: years ? `(${years})` : ""
  }
}

function parsePresentationResult(record: UnknownRecord): LibraryResult | null {
  const label = stringAt(record, "title")
  const href = safeProvidedDestination(stringAt(record, "url"))
  const author = stringAt(record, "article_author")
  if (!label || !href || !author) return null
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
    titleHref: `/författare/${encodedAuthor}/titlar/${encodedTitle}/${encodedMedia}?om-boken`,
    titleTo: {
      name: "författare-author-titlar-title-mediatype",
      params: { author: authorId, title: titleId, mediatype: mediaType },
      query: { "om-boken": null }
    },
    authorHref: `/författare/${encodedAuthor}`,
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
  const titleHref = `/författare/${encodedAuthor}/titlar/${encodedTitle}/${encodedAboutMedia}?om-boken`

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
    authorHref: `/författare/${encodedAuthor}`,
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

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()

function queryValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function relevanceSortKey(value: unknown): RelevanceSortKey {
  return sorts.some(item => item.key === value) ? value as RelevanceSortKey : "relevans"
}

function epubSortKey(value: unknown): EpubSortKey {
  return epubSorts.some(item => item.key === value) ? value as EpubSortKey : "popularitet"
}

function routeState(path: string, query: LocationQuery): LibraryRouteState {
  const standalone = path === "/epub"
  const requestedMode = queryValue(query.visa)
  const mode: LibraryMode = requestedMode === "pdf"
    ? "pdf"
    : standalone || requestedMode === "epub" ? "epub" : "all"
  const parsed = Number(queryValue(query.sida))
  return {
    standalone,
    mode,
    filter: queryValue(query.filter),
    sort: mode === "all" ? relevanceSortKey(query.sort) : epubSortKey(query.sort),
    page: Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
  }
}

function sanitizeFilter(value: string): string {
  return value
    .replace(/([A-Öa-ö])[-–—]([A-Öa-ö])/g, "$1 $2")
    .replace(/[.,!"“'”]/g, "")
    .trim()
}

function requestUrl(base: string, filter: string, selectedSort: RelevanceSortKey): string {
  const params = new URLSearchParams({
    exclude: excludedFields,
    show_all: "false",
    sort_field: sorts.find(item => item.key === selectedSort)?.expression ?? "_score|desc",
    from: "0",
    to: "100",
    vectorize: "true",
    sid: "true"
  })
  const sanitized = sanitizeFilter(filter)
  if (sanitized) params.set("q", `(${sanitized})`)
  return `${base.replace(/\/$/, "")}/relevance/${resultTypes}?${params}`
}

async function fetchResults(
  base: string,
  filter: string,
  selectedSort: RelevanceSortKey,
  signal?: AbortSignal
): Promise<LibraryResponse> {
  try {
    const response = await $fetch<unknown>(requestUrl(base, filter, selectedSort), {
      signal,
      retry: 0
    })
    return parseLibraryResponse(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyLibraryResponse(true)
  }
}

function epubRequestUrl(
  base: string,
  filter: string,
  selectedSort: EpubSortKey,
  page: number
): string {
  const sanitized = sanitizeFilter(filter)
  const predicate = sanitized ? `has_epub:true AND (${sanitized})` : "has_epub:true"
  const params = new URLSearchParams({
    exclude: epubExcludedFields,
    include: epubIncludedFields,
    partial_string: "true",
    q: `${epubQueryPrefix} (${predicate})`,
    sort_field: epubSorts.find(item => item.key === selectedSort)?.expression ?? "popularity|desc",
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
  signal?: AbortSignal
): Promise<EpubResponse> {
  try {
    const response = await $fetch<unknown>(epubRequestUrl(base, filter, selectedSort, page), {
      signal,
      retry: 0
    })
    return parseEpubResponse(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyEpubResponse(true)
  }
}

const pdfPredicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"

function pdfRequestUrl(
  base: string,
  filter: string,
  selectedSort: EpubSortKey,
  page: number
): string {
  const sanitized = sanitizeFilter(filter)
  const predicate = sanitized ? `${pdfPredicate} AND (${sanitized})` : pdfPredicate
  const params = new URLSearchParams({
    exclude: epubExcludedFields,
    include: pdfIncludedFields,
    partial_string: "true",
    q: `${epubQueryPrefix} (${predicate})`,
    sort_field: epubSorts.find(item => item.key === selectedSort)?.expression ?? "popularity|desc",
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
  signal?: AbortSignal
): Promise<PdfResponse> {
  try {
    const response = await $fetch<unknown>(pdfRequestUrl(base, filter, selectedSort, page), {
      signal,
      retry: 0
    })
    return parsePdfResponse(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return emptyPdfResponse(true)
  }
}

const initialState = Object.freeze(routeState(route.path, route.query))
const standalone = initialState.standalone
const mode = initialState.mode
const initialFilter = initialState.filter
const initialSort = initialState.mode === "all"
  ? initialState.sort as RelevanceSortKey
  : "relevans"
const initialEpubSort = initialState.mode !== "all"
  ? initialState.sort as EpubSortKey
  : "popularitet"
const initialApiBase = import.meta.server
  ? config.libraryApiBase
  : config.public.libraryApiBase
const { data: initialData } = await useAsyncData<LibraryPageData>(
  `library:${route.path}:${mode}:${initialFilter}:${initialState.sort}:${initialState.page}`,
  async (): Promise<LibraryPageData> => initialState.mode === "epub"
    ? {
        mode: "epub",
        response: await fetchEpubResults(
          initialApiBase,
          initialFilter,
          initialEpubSort,
          initialState.page
        )
      }
    : initialState.mode === "pdf"
      ? {
          mode: "pdf",
          response: await fetchPdfResults(
            initialApiBase,
            initialFilter,
            initialEpubSort,
            initialState.page
          )
        }
    : {
        mode: "all",
        response: await fetchResults(initialApiBase, initialFilter, initialSort)
      },
  {
    default: (): LibraryPageData => initialState.mode === "epub"
      ? { mode: "epub", response: emptyEpubResponse() }
      : initialState.mode === "pdf"
        ? { mode: "pdf", response: emptyPdfResponse() }
        : { mode: "all", response: emptyLibraryResponse() }
  }
)

const filter = ref(initialFilter)
const selectedSort = ref(initialSort)
const selectedEpubSort = ref(initialEpubSort)
const currentMode = ref(initialState.mode)
const currentPage = ref(initialState.page)
const results = ref(
  initialData.value?.mode === "all" ? initialData.value.response : emptyLibraryResponse()
)
const epubResults = ref(initialData.value?.mode === "epub"
  ? initialData.value.response
  : emptyEpubResponse())
const pdfResults = ref(initialData.value?.mode === "pdf"
  ? initialData.value.response
  : emptyPdfResponse())
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let controller: AbortController | null = null
let requestVersion = 0
let ownedNavigation: { key: string, version: number } | null = null

type QueryState = {
  standalone: boolean
  mode: LibraryMode
  filter: string
  sort: RelevanceSortKey | EpubSortKey
  page: number
}

function stateKey(state: QueryState): string {
  return JSON.stringify([state.standalone, state.mode, state.filter, state.sort, state.page])
}

function requestState(state: LibraryRouteState): QueryState {
  return {
    standalone: state.standalone,
    mode: state.mode,
    filter: state.filter,
    sort: state.sort,
    page: state.mode === "all" ? 1 : state.page
  }
}

function currentState(): QueryState {
  return {
    standalone: route.path === "/epub",
    mode: currentMode.value,
    filter: filter.value,
    sort: currentMode.value === "all" ? selectedSort.value : selectedEpubSort.value,
    page: currentMode.value === "all" ? 1 : currentPage.value
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

function queryFor(state: QueryState): LocationQuery {
  const query: LocationQuery = { ...route.query }
  delete query.visa
  delete query.filter
  delete query.sort
  delete query.sida
  if (state.mode !== "all" && (!state.standalone || state.mode === "pdf")) {
    query.visa = state.mode
  }
  if (state.filter) query.filter = state.filter
  if (state.mode !== "all" || state.sort !== "relevans") query.sort = state.sort
  if (state.mode !== "all" && state.page > 1) query.sida = String(state.page)
  return query
}

async function runBrowserRequest(state: QueryState, version: number) {
  if (version !== requestVersion) return
  controller = new AbortController()
  loading.value = true
  const response = state.mode === "epub"
    ? await fetchEpubResults(
        config.public.libraryApiBase,
        state.filter,
        state.sort as EpubSortKey,
        state.page,
        controller.signal
      ).catch(() => null)
    : state.mode === "pdf"
      ? await fetchPdfResults(
          config.public.libraryApiBase,
          state.filter,
          state.sort as EpubSortKey,
          state.page,
          controller.signal
        ).catch(() => null)
      : await fetchResults(
          config.public.libraryApiBase,
          state.filter,
          state.sort as RelevanceSortKey,
          controller.signal
        ).catch(() => null)
  if (version !== requestVersion || response === null) return
  if (state.mode === "epub") epubResults.value = response as EpubResponse
  else if (state.mode === "pdf") pdfResults.value = response as PdfResponse
  else results.value = response as LibraryResponse
  loading.value = false
  controller = null
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
  filter.value = captured.filter
  currentPage.value = captured.page
  if (captured.mode !== "all") selectedEpubSort.value = captured.sort as EpubSortKey
  else selectedSort.value = captured.sort as RelevanceSortKey
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
  beginIntent({ ...currentState(), filter: "", page: 1 })
}

function selectMode(nextMode: LibraryMode) {
  beginIntent({
    standalone: route.path === "/epub",
    mode: nextMode,
    filter: filter.value,
    sort: nextMode === "all" ? "relevans" : "popularitet",
    page: 1
  })
}

function selectSort(key: RelevanceSortKey | EpubSortKey) {
  beginIntent({ ...currentState(), sort: key, page: 1 })
}

function selectPage(page: number) {
  const boundedPage = Math.max(1, Math.min(page, Math.max(1, epubPageCount.value)))
  beginIntent({ ...currentState(), page: boundedPage })
}

watch(
  () => stateKey(requestState(routeState(route.path, route.query))),
  () => {
    const state = requestState(routeState(route.path, route.query))
    currentMode.value = state.mode
    filter.value = state.filter
    currentPage.value = state.page
    if (state.mode !== "all") selectedEpubSort.value = state.sort as EpubSortKey
    else selectedSort.value = state.sort as RelevanceSortKey
    if (ownedNavigation?.key === stateKey(state)) return
    const version = invalidateIntent()
    void runBrowserRequest(state, version)
  },
  { flush: "sync" }
)

const ownedQueryKeys = new Set(["visa", "filter", "sort", "sida"])

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
  sort: RelevanceSortKey | EpubSortKey
  page?: number
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
  if (state.page !== undefined) params.set("sida", String(state.page))
  const query = params.toString()
  return `${route.path}${query ? `?${query}` : ""}`
}

const allTabHref = computed(() => stateHref({
  mode: "all",
  filter: filter.value,
  sort: "relevans"
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

const downloadResults = computed(() => currentMode.value === "pdf"
  ? pdfResults.value.data
  : epubResults.value.data)
const downloadFailed = computed(() => currentMode.value === "pdf"
  ? pdfResults.value.failed
  : epubResults.value.failed)
const downloadDistinctHits = computed(() => currentMode.value === "pdf"
  ? pdfResults.value.distinctHits
  : epubResults.value.distinctHits)
const epubPageCount = computed(() => Math.ceil(downloadDistinctHits.value / 100))
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

const epubPages = computed(() => paginationItems(epubPageCount.value, currentPage.value))

function epubPageHref(page: number): string {
  return stateHref({
    mode: currentMode.value === "pdf" ? "pdf" : "epub",
    filter: filter.value,
    sort: selectedEpubSort.value,
    page
  })
}

function disposeLibraryRequest() {
  requestVersion += 1
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

onUnmounted(disposeLibraryRequest)
</script>

<template>
  <div>
    <h1 class="text-6xl lg:ml-12">{{ standalone ? "Hämta e-böcker" : "Botanisera i biblioteket" }}</h1>
    <div class="lg:ml-12" :class="{ searching: loading }">
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
              v-show="filter"
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
              disabled
              title="Utökad sökning är inte tillgänglig ännu"
              class="bg-white border border-gray-500 self-stretch px-4 focus:ring-1 focus:ring-inset focus:ring-primary"
            >
              <span class="uppercase text-xs">Visa utökad sökning</span><template v-if="currentMode !== 'all'">{{ " " }}</template>
              <svg
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
            </button>
          </div>
          <div class="chronology primarycolor ml-px pl-px">
            <i class="fa fa-clock-o mr-1 ml-px" /><template v-if="currentMode !== 'all'">{{ " " }}</template>
            <span class="sc mt-8">Tidslinje: kronologisk sökning</span>
          </div>
          <div v-if="currentMode !== 'all'" data-library-chronology-range class="flex">
            <div class="rzslider mt-3 slider-large" aria-hidden="true">
              <span class="rz-bar-wrapper"><span class="rz-bar" /></span>
              <span class="rz-bar-wrapper"><span class="rz-bar rz-selection" /></span>
              <span class="rz-pointer rz-pointer-min" />
              <span class="rz-pointer rz-pointer-max" />
            </div>
            <div class="whitespace-nowrap self-center chronology_inputs">
              <span class="text-sm sc">Tryckår: </span>
              <input class="text-sm text-center py-1" type="text" value="1800" readonly aria-label="Från tryckår">{{ " " }}
              <span class="text-sm sc">till </span>
              <input class="text-sm text-center py-1" type="text" value="2026" readonly aria-label="Till tryckår">
            </div>
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
              {{ " " }}
              <a
                data-library-tab="pdf"
                :href="pdfTabHref"
                :aria-current="currentMode === 'pdf' ? 'page' : undefined"
                class="sc btn btn-small text-base"
                :class="{ active: currentMode === 'pdf' }"
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
              <template
                v-for="tab in [
                  { key: 'latest', label: 'Nytt' },
                  { key: 'authors', label: 'Författare' },
                  { key: 'works', label: 'Verk' },
                  { key: 'parts', label: 'Dikt, novell, etc.' }
                ]"
                :key="tab.key"
              >
                <template v-if="currentMode !== 'all'">{{ " " }}</template>
                <button
                  :data-library-tab="tab.key"
                  data-deferred
                  type="button"
                  disabled
                  title="Inte tillgänglig i denna version"
                  class="sc btn btn-small text-base disabled"
                  :class="{ 'authority-available': currentMode !== 'all' && ['latest', 'works'].includes(tab.key) }"
                >{{ tab.label }}<span v-if="tab.key === 'authors' && currentMode !== 'all'" class="num_hits">: 0</span></button>
              </template>
              <template v-if="currentMode !== 'all'">{{ " " }}</template>
              <a
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
              <template v-if="currentMode !== 'all'">{{ " " }}</template>
              <a
                data-library-tab="pdf"
                :href="pdfTabHref"
                :aria-current="currentMode === 'pdf' ? 'page' : undefined"
                class="sc btn btn-small text-base"
                :class="{ active: currentMode === 'pdf' }"
                @click.prevent="selectMode('pdf')"
              >PDF<span v-if="pdfResults.distinctHits" class="num_hits">: {{ pdfResults.distinctHits }}</span></a>
            </template>
          </div>
        </form>
      </div>
      <div class="flex items-stretch w-full lg:max-w-5xl text-lg leading-tight">
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
                  <i v-if="selectedSort === item.key" class="fa fa-caret-down" />
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
                    <td class="order-2">
                      <a
                        :href="item.primaryHref"
                        :download="item.download || undefined"
                        :data-library-author-name="item.index === 'author' || undefined"
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
                    </td>
                    <td class="lg:text-right hidden lg:table-cell text-base w-28 whitespace-nowrap">{{ item.yearLabel }}</td>
                    <td class="lg:text-right lg:uppercase lg:text-sm lg:pl-4 order-1 lg:max-w-40">
                      <a v-if="item.authorHref" :href="item.authorHref">{{ item.secondaryAuthor }}</a>
                      <span v-else class="text-gray-800">{{ item.secondaryAuthor }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else class="result title pl-0 flex-column min-h-500">
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
                  >{{ item.label }}</a><template v-if="selectedEpubSort === item.key">{{ " " }}<i class="fa fa-caret-down" /></template>
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
                        <a
                          :data-library-epub-author="currentMode === 'epub' || undefined"
                          :data-library-pdf-author="currentMode === 'pdf' || undefined"
                          :href="item.authorHref"
                        >{{ item.surname }}</a><template v-if="item.roleSuffix">{{ " " }}<span class="text-gray-700 sc">{{ item.roleSuffix.trim() }}</span></template>
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
            <nav v-if="epubPageCount > 1" aria-label="Sidnavigation">
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
                  v-for="item in epubPages"
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
                <li :class="{ disabled: currentPage >= epubPageCount }">
                  <span
                    v-if="currentPage >= epubPageCount"
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.authority-available {
  opacity: 1;
}

.relevance-unavailable {
  color: #333;
  opacity: 0.65;
}

[data-library-chronology-range] .rzslider {
  position: relative;
  display: inline-block;
  width: 100%;
  height: 4px;
  margin: 12px 1.85rem 15px 0;
  vertical-align: middle;
  user-select: none;
}

[data-library-chronology-range] .rzslider span {
  position: absolute;
  display: inline-block;
  white-space: nowrap;
}

[data-library-chronology-range] .rz-bar-wrapper {
  left: 0;
  z-index: 1;
  width: 100%;
  height: 32px;
  padding-top: 16px;
  margin-top: -16px;
  box-sizing: border-box;
}

[data-library-chronology-range] .rz-bar {
  left: 0;
  z-index: 1;
  width: 100%;
  border-radius: 2px;
}

[data-library-chronology-range] .rz-selection {
  z-index: 2;
  left: 10px;
  width: calc(100% - 20px);
}

[data-library-chronology-range] .rz-pointer {
  z-index: 3;
  cursor: default;
  border-radius: 16px;
}

[data-library-chronology-range] .rz-pointer-min {
  left: 0;
}

[data-library-chronology-range] .rz-pointer-max {
  right: 0;
}

</style>
