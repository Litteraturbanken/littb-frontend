import type {
  ReaderAlternateMedia,
  ReaderFacsimilePage,
  ReaderOcrOverlay
} from "#shared/types/reader"
import { readerAuthorContributionSuffix } from "#shared/utils/reader-author"
import { buildFacsimileSources, facsimileOcrUrl } from "#shared/utils/facsimile-source"
import { fetchManagedText } from "#shared/utils/managed-text"
import {
  maximumReaderOcrBytes,
  parseReaderOcrOverlay
} from "#shared/utils/reader-ocr"
import { resolveReaderPartNavigation } from "#shared/utils/reader-part-navigation"

function contributorLabel(
  contributor: ReaderFacsimilePage["contributors"][number]
): string {
  const suffix = readerAuthorContributionSuffix(contributor.author_type, contributor.role)
  return suffix ? `${contributor.full_name} (${suffix})` : contributor.full_name
}

function contributorText(contributors: ReaderFacsimilePage["contributors"]): string {
  const labels = contributors.map(contributorLabel)
  if (labels.length === 1) return labels[0]!
  return `${labels.slice(0, -1).join(", ")} & ${labels.at(-1)}`
}

function alternateMediaTarget(
  page: ReaderFacsimilePage,
  pageName: string,
  pageIndex: number
): ReaderAlternateMedia | null {
  if (!page.alternateMedia || !page.alternateMediaPageMap) return null
  const target = page.alternateMediaPageMap.find(candidate => candidate.page_name === pageName)
    ?? page.alternateMediaPageMap.find(candidate => candidate.page_index === pageIndex)
    ?? page.alternateMediaPageMap[0]
  return target
    ? { mediaType: page.alternateMedia.mediaType, pageName: target.page_name }
    : null
}

function sliderPercent(pageIndex: number, declaredPageCount: number | null): number {
  if (declaredPageCount === null || declaredPageCount <= 1) return 0
  return Math.min(100, Math.max(0, pageIndex / (declaredPageCount - 1) * 100))
}

export function projectFacsimileReaderPage(
  source: ReaderFacsimilePage,
  pageName: string,
  ocrOverlay: ReaderOcrOverlay | null
): ReaderFacsimilePage | null {
  const position = source.pageMap.findIndex(page => page.page_name === pageName)
  const target = source.pageMap[position]
  if (!target) return null
  const navigation = resolveReaderPartNavigation(source.parts, target.page_index)
  const knownNames = new Set(source.pageMap.map(page => page.page_name))
  const sizes = source.sources.map(({ size, width }) => ({ size, width }))
  return {
    ...source,
    ...navigation,
    alternateMedia: alternateMediaTarget(source, pageName, target.page_index),
    description:
      `${source.title} av ${contributorText(source.contributors)}, ` +
      `sida ${pageName} som faksimil.`,
    endPageName: source.endPageName && knownNames.has(source.endPageName)
      ? source.endPageName
      : null,
    imageNumber: target.image_number,
    nextPageName: source.pageMap[position + source.pageStep]?.page_name ?? null,
    ocrOverlay,
    pageIndex: target.page_index,
    pageName,
    previousPageName: source.pageMap[position - source.pageStep]?.page_name ?? null,
    sliderPercent: sliderPercent(target.page_index, source.declaredPageCount),
    sources: buildFacsimileSources(source.workId, target.image_number, sizes),
    startPageName: source.startPageName && knownNames.has(source.startPageName)
      ? source.startPageName
      : null
  }
}

export async function fetchFacsimileOcr(
  workId: string,
  pageIndex: number,
  signal: AbortSignal
): Promise<ReaderOcrOverlay | null> {
  const path = facsimileOcrUrl(workId, pageIndex)
  const fetcher: typeof fetch = (input, init) => fetch(input, { ...init, signal })
  try {
    const source = await fetchManagedText(path, {
      authorityOrigin: window.location.origin,
      allowedPaths: [path],
      allowedPathPrefixes: [],
      allowedContentTypes: ["text/html"],
      maximumBytes: maximumReaderOcrBytes
    }, fetcher)
    return parseReaderOcrOverlay(source)
  } catch (error) {
    if (signal.aborted) throw error
    return null
  }
}
