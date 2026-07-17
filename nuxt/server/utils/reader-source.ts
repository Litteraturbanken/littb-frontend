import { createError, type H3Event } from "h3"

type UnknownRecord = Record<string, unknown>

export interface ReaderSourcePage {
  pageIndex: number
  pageName: string
}

export interface ReaderWorkMetadata {
  author: { id: string, name: string }
  base: string
  displayTitle: string
  fullTitle: string
  imprintYear: string | null
  mediaType: "etext"
  pages: ReaderSourcePage[]
  startPageName: string | null
  titlePath: string
  workId: string
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requiredString(record: UnknownRecord, key: string): string | null {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function readerPages(value: unknown): ReaderSourcePage[] | null {
  if (!Array.isArray(value)) return null

  const pages: ReaderSourcePage[] = []
  for (const page of value) {
    if (!isRecord(page)) return null
    const pageName = requiredString(page, "pagename")
    const pageIndex = page.pageindex
    if (
      !pageName ||
      typeof pageIndex !== "number" ||
      !Number.isSafeInteger(pageIndex) ||
      pageIndex < 0
    ) return null
    pages.push({ pageName, pageIndex })
  }
  return pages.sort((left, right) => left.pageIndex - right.pageIndex)
}

async function fetchReaderMetadata(
  base: string,
  author: string,
  titlePath: string
): Promise<unknown> {
  try {
    return await $fetch(`${base}/api/get_work_info`, {
      query: {
        authorid: author,
        exclude: "content_vector",
        titlepath: titlePath
      },
      retry: 0
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" })
  }
}

function invalidReaderSource(): never {
  throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
}

function readerPageNotFound(): never {
  throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
}

export async function loadReaderMetadata(
  event: H3Event,
  author: string,
  titlePath: string,
  mediaType: string
): Promise<ReaderWorkMetadata> {
  if (mediaType !== "etext") readerPageNotFound()

  const base = useRuntimeConfig(event).readerSourceBase.replace(/\/$/, "")
  const raw = await fetchReaderMetadata(base, author, titlePath)
  if (!isRecord(raw) || !Array.isArray(raw.data)) invalidReaderSource()

  const representation = raw.data.find(item => (
    isRecord(item) &&
    item.mediatype === "etext" &&
    item.titlepath === titlePath
  ))
  if (!isRecord(representation)) readerPageNotFound()

  const authors = representation.authors
  const firstAuthor = Array.isArray(authors) ? authors[0] : null
  const workId = requiredString(representation, "lbworkid")
  const fullTitle = requiredString(representation, "title")
  const displayTitle = requiredString(representation, "shorttitle") ?? fullTitle
  if (!isRecord(firstAuthor) || !workId || !fullTitle || !displayTitle) {
    invalidReaderSource()
  }

  const authorId = requiredString(firstAuthor, "authorid")
  const authorName = requiredString(firstAuthor, "full_name")
  if (!authorId || !authorName) invalidReaderSource()
  if (authorId !== author) readerPageNotFound()

  let pages = readerPages(representation.pages)
  if (!pages) {
    for (const sibling of raw.data) {
      if (
        sibling !== representation &&
        isRecord(sibling) &&
        sibling.lbworkid === workId
      ) {
        const siblingPages = readerPages(sibling.pages)
        if (siblingPages) {
          pages = siblingPages
          break
        }
      }
    }
  }
  if (!pages) invalidReaderSource()

  let startPageName: string | null = null
  if (Object.hasOwn(representation, "startpagename")) {
    startPageName = requiredString(representation, "startpagename")
    if (!startPageName) invalidReaderSource()
  }

  const imprint = isRecord(representation.sort_date_imprint)
    ? requiredString(representation.sort_date_imprint, "plain")
    : null
  const imprintYear = imprint ?? requiredString(representation, "imprintyear")

  return {
    author: { id: authorId, name: authorName },
    base,
    displayTitle,
    fullTitle,
    imprintYear,
    mediaType: "etext",
    pages,
    startPageName,
    titlePath,
    workId
  }
}

export async function fetchReaderPageHtml(
  base: string,
  workId: string,
  pageIndex: number
): Promise<string> {
  const filename = String(pageIndex).padStart(5, "0")
  try {
    return await $fetch<string>(
      `${base}/txt/${encodeURIComponent(workId)}/res_${filename}.html`,
      {
        query: { username: "app" },
        responseType: "text",
        retry: 0
      }
    )
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" })
  }
}
