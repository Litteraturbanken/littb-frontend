import type { ReaderPage, ReaderPart, ReaderPartAuthor } from "#shared/types/reader"
import { readerAuthorContributionSuffix } from "#shared/utils/reader-author"
import { fetchReaderOcrOverlay } from "#server/utils/reader-ocr"

import { createLbApiClient } from "../../../../../../app/lib/api/client"

type UnknownRecord = Record<string, unknown>

const MAX_AUTHOR_IDS = 50
const MAX_AUTHOR_ID_LENGTH = 100
const MAX_AUTHOR_NAME_LENGTH = 2_000
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u

interface ResolvedPartAuthor {
  id: string
  name: string
  surname: string | null
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function invalidReaderSource(): never {
  throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
}

function hasExactKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
}

function strictString(value: unknown, maximumLength: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximumLength
    && value.trim() === value
    && !CONTROL_CHARACTERS.test(value)
}

function validateResolvedAuthors(
  value: unknown,
  requestedIds: readonly string[]
): ResolvedPartAuthor[] {
  if (!isRecord(value) || !hasExactKeys(value, ["items"])) invalidReaderSource()
  if (!Array.isArray(value.items) || value.items.length > MAX_AUTHOR_IDS) {
    invalidReaderSource()
  }

  const requested = new Set(requestedIds)
  const seen = new Set<string>()
  return value.items.map(item => {
    if (!isRecord(item) || !hasExactKeys(item, ["author_id", "full_name", "surname"])) {
      invalidReaderSource()
    }
    if (
      !strictString(item.author_id, MAX_AUTHOR_ID_LENGTH)
      || !requested.has(item.author_id)
      || seen.has(item.author_id)
      || !strictString(item.full_name, MAX_AUTHOR_NAME_LENGTH)
      || (
        item.surname !== null
        && !strictString(item.surname, MAX_AUTHOR_NAME_LENGTH)
      )
    ) {
      invalidReaderSource()
    }
    seen.add(item.author_id)
    return {
      id: item.author_id,
      name: item.full_name,
      surname: item.surname
    }
  })
}

async function completePartAuthors(
  event: Parameters<typeof getRouterParam>[0],
  parts: readonly ReaderPart[]
): Promise<ReaderPart[]> {
  const unresolvedIds: string[] = []
  const unresolved = new Set<string>()
  for (const part of parts) {
    for (const author of part.authors) {
      if (!strictString(author.id, MAX_AUTHOR_ID_LENGTH)) invalidReaderSource()
      if (author.name !== null) continue
      if (!unresolved.has(author.id)) {
        unresolved.add(author.id)
        unresolvedIds.push(author.id)
      }
    }
  }
  if (unresolvedIds.length > MAX_AUTHOR_IDS) invalidReaderSource()

  const resolved = new Map<string, ResolvedPartAuthor>()
  if (unresolvedIds.length > 0) {
    const client = createLbApiClient(useRuntimeConfig(event).apiBase)
    let raw: unknown
    try {
      const response = await client.POST("/authors/resolve", {
        body: { author_ids: unresolvedIds }
      })
      if (!response.response.ok || response.error !== undefined || response.data === undefined) {
        invalidReaderSource()
      }
      raw = response.data
    } catch {
      invalidReaderSource()
    }
    for (const author of validateResolvedAuthors(raw, unresolvedIds)) {
      resolved.set(author.id, author)
    }
  }

  return parts.map(part => ({
    ...part,
    authors: part.authors.map((author): ReaderPartAuthor => {
      if (author.name !== null) {
        return {
          ...author,
          surname: author.surname ?? author.name
        }
      }
      const summary = resolved.get(author.id)
      if (!summary) return { id: author.id, name: author.id, surname: author.id }
      return {
        id: author.id,
        name: summary.name,
        surname: summary.surname ?? summary.name
      }
    })
  }))
}

function requiredParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name)
  if (!value) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  return value
}

function readerSliderPercent(pageIndex: number, explicitPageCount: number | null): number {
  if (explicitPageCount === null || explicitPageCount <= 1) return 0
  return Math.min(100, Math.max(0, pageIndex / (explicitPageCount - 1) * 100))
}

function readerSliderMaximum(
  pages: readonly Pick<ReaderPage["pageMap"][number], "pageIndex">[],
  explicitPageCount: number | null
): number | null {
  if (explicitPageCount === null) return null
  const maximum = explicitPageCount - 1
  return pages.every(page => page.pageIndex >= 0 && page.pageIndex <= maximum)
    ? maximum
    : null
}

function workContributorLabel(contributor: ReaderPage["contributors"][number]): string {
  const suffix = readerAuthorContributionSuffix(contributor.authorType, contributor.role)
  return suffix ? `${contributor.name} (${suffix})` : contributor.name
}

function workContributorText(contributors: ReaderPage["contributors"]): string {
  const labels = contributors.map(workContributorLabel)
  if (labels.length === 1) return labels[0]!
  return `${labels.slice(0, -1).join(", ")} & ${labels.at(-1)}`
}

export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  const author = requiredParam(event, "author")
  const titlePath = requiredParam(event, "title")
  const pageName = requiredParam(event, "page")
  const mediaType = requiredParam(event, "mediatype")
  const metadata = await loadReaderMetadata(event, author, titlePath, mediaType)

  const currentPosition = metadata.pages.findIndex(page => page.pageName === pageName)
  if (currentPosition < 0) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }

  const currentPage = metadata.pages[currentPosition]!
  const parts = await completePartAuthors(event, metadata.parts)
  const partNavigation = resolveReaderPartNavigation(parts, currentPage.pageIndex)
  const knownNames = new Set(metadata.pages.map(page => page.pageName))
  const alternatePage = metadata.alternateMedia?.pages.find(page => page.pageName === pageName)
    ?? metadata.alternateMedia?.pages.find(page => page.pageIndex === currentPage.pageIndex)
    ?? metadata.alternateMedia?.pages[0]
  const commonPage = {
    alternateMedia: metadata.alternateMedia && alternatePage
      ? {
          mediaType: metadata.alternateMedia.mediaType,
          pageName: alternatePage.pageName
        }
      : null,
    author: metadata.author,
    contributors: metadata.contributors,
    description:
      `${metadata.displayTitle} av ${workContributorText(metadata.contributors)}, ` +
      `sida ${pageName} som ${metadata.mediaType}.`,
    editorWorkId: metadata.editorWorkId,
    fullTitle: metadata.fullTitle,
    hasDramawebben: metadata.hasDramawebben,
    hasNyaVagar: metadata.hasNyaVagar,
    imprintYear: metadata.imprintYear,
    isDrama: metadata.isDrama,
    currentPartIndex: partNavigation.currentPartIndex,
    endPageName: metadata.endPageName && knownNames.has(metadata.endPageName)
      ? metadata.endPageName
      : null,
    nextPageName: metadata.pages[currentPosition + metadata.pageStep]?.pageName ?? null,
    nextPartPageName: partNavigation.nextPartPageName,
    pageCount: metadata.pages.length,
    pageIndex: currentPage.pageIndex,
    pageMap: metadata.pages.map(page => ({
      pageIndex: page.pageIndex,
      pageName: page.pageName
    })),
    pageName,
    pageNames: metadata.pages.map(page => page.pageName),
    parts,
    previousPageName: metadata.pages[currentPosition - metadata.pageStep]?.pageName ?? null,
    previousPartPageName: partNavigation.previousPartPageName,
    searchable: metadata.searchable,
    sliderMaximum: readerSliderMaximum(metadata.pages, metadata.explicitPageCount),
    startPageName: metadata.startPageName && knownNames.has(metadata.startPageName)
      ? metadata.startPageName
      : null,
    sliderPercent: readerSliderPercent(currentPage.pageIndex, metadata.explicitPageCount),
    title: metadata.displayTitle,
    urn: metadata.urn,
    workId: metadata.workId
  }

  if (metadata.mediaType === "faksimil") {
    const facsimilePage = metadata.pages[currentPosition]!
    const ocrBase = useRuntimeConfig(event).contentBase.replace(/\/$/, "")
    const ocrOverlay = metadata.searchable
      ? await fetchReaderOcrOverlay(ocrBase, metadata.workId, facsimilePage.pageIndex)
      : null
    return {
      ...commonPage,
      imageNumber: facsimilePage.imageNumber,
      mediaType: metadata.mediaType,
      ocrOverlay,
      preferredSize: metadata.preferredSize,
      sources: buildFacsimileSources(
        metadata.workId,
        facsimilePage.imageNumber,
        metadata.sizes
      )
    } satisfies ReaderPage
  }

  const html = (await fetchReaderPageHtml(
    metadata.base,
    metadata.workId,
    currentPage.pageIndex
  )).replaceAll("\u00ad", "-")

  return {
    ...commonPage,
    html,
    mediaType: metadata.mediaType,
    sharedStylesheetUrl: "/red/css/etext.css",
    workStylesheetUrl: `/txt/css/${encodeURIComponent(metadata.workId)}-etext.css`
  } satisfies ReaderPage
})
