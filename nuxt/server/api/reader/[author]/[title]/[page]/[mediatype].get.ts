import type { ReaderPage } from "#shared/types/reader"

type UnknownRecord = Record<string, unknown>

interface LegacyPage {
  pageIndex: number
  pageName: string
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requiredParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name)
  if (!value) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  return value
}

function requiredString(record: UnknownRecord, key: string): string | null {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function legacyPages(value: unknown): LegacyPage[] | null {
  if (!Array.isArray(value)) return null

  const pages: LegacyPage[] = []
  for (const page of value) {
    if (!isRecord(page)) return null
    const pageName = requiredString(page, "pagename")
    const pageIndex = Number(page.pageindex)
    if (!pageName || !Number.isInteger(pageIndex) || pageIndex < 0) return null
    pages.push({ pageName, pageIndex })
  }
  return pages.sort((left, right) => left.pageIndex - right.pageIndex)
}

async function fetchMetadata(
  base: string,
  author: string,
  title: string
): Promise<unknown> {
  try {
    return await $fetch(`${base}/api/get_work_info`, {
      query: {
        authorid: author,
        exclude: "content_vector",
        titlepath: title
      },
      retry: 0
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" })
  }
}

async function fetchPageHtml(base: string, workId: string, pageIndex: number): Promise<string> {
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

export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  const author = requiredParam(event, "author")
  const titlePath = requiredParam(event, "title")
  const pageName = requiredParam(event, "page")
  const mediaType = requiredParam(event, "mediatype")
  if (mediaType !== "etext") {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }

  const sourceBase = useRuntimeConfig(event).readerSourceBase.replace(/\/$/, "")
  const raw = await fetchMetadata(sourceBase, author, titlePath)
  if (!isRecord(raw) || !Array.isArray(raw.data)) {
    throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
  }

  const representation = raw.data.find(item => (
    isRecord(item) &&
    item.mediatype === "etext" &&
    item.titlepath === titlePath
  ))
  if (!isRecord(representation)) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }

  const authors = representation.authors
  const firstAuthor = Array.isArray(authors) ? authors[0] : null
  const pages = legacyPages(representation.pages)
  const workId = requiredString(representation, "lbworkid")
  const fullTitle = requiredString(representation, "title")
  const displayTitle = requiredString(representation, "shorttitle") ?? fullTitle
  if (!isRecord(firstAuthor) || !pages || !workId || !fullTitle || !displayTitle) {
    throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
  }

  const authorId = requiredString(firstAuthor, "authorid")
  const authorName = requiredString(firstAuthor, "full_name")
  if (!authorId || !authorName) {
    throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
  }

  const currentPosition = pages.findIndex(page => page.pageName === pageName)
  if (currentPosition < 0) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }

  const currentPage = pages[currentPosition]!
  const imprint = isRecord(representation.sort_date_imprint)
    ? requiredString(representation.sort_date_imprint, "plain")
    : null
  const imprintYear = imprint ?? requiredString(representation, "imprintyear")
  const html = (await fetchPageHtml(sourceBase, workId, currentPage.pageIndex))
    .replaceAll("\u00ad", "-")

  return {
    author: { id: authorId, name: authorName },
    description: `${displayTitle} av ${authorName}, sida ${pageName} som etext.`,
    fullTitle,
    html,
    imprintYear,
    mediaType: "etext",
    nextPageName: pages[currentPosition + 1]?.pageName ?? null,
    pageCount: pages.length,
    pageIndex: currentPage.pageIndex,
    pageName,
    previousPageName: pages[currentPosition - 1]?.pageName ?? null,
    sharedStylesheetUrl: "/red/css/etext.css",
    title: displayTitle,
    workId,
    workStylesheetUrl: `/txt/css/${encodeURIComponent(workId)}-etext.css`
  } satisfies ReaderPage
})
