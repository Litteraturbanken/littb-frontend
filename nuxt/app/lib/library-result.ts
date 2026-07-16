export type LibraryIndex =
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

export type LibraryResult = {
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

export type LibraryResponse = {
  data: LibraryResult[]
  hits: number
  suggest: unknown[]
  failed: boolean
}

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

export function parseLibraryResponse(value: unknown): LibraryResponse {
  const record = asRecord(value)
  if (!record || !Array.isArray(record.data) || typeof record.hits !== "number"
    || !Number.isFinite(record.hits) || !Array.isArray(record.suggest)) {
    throw new Error("Invalid Library relevance response")
  }
  return {
    data: record.data.map(parseResult).filter((item): item is LibraryResult => item !== null),
    hits: record.hits,
    suggest: record.suggest,
    failed: false
  }
}

export function emptyLibraryResponse(failed = false): LibraryResponse {
  return { data: [], hits: 0, suggest: [], failed }
}
