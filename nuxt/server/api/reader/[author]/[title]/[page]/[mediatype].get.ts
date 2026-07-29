import type { ReaderPage } from "#shared/types/reader"
import { readerAuthorContributionSuffix } from "#shared/utils/reader-author"
import { issueManagedReaderHtml } from "#shared/utils/renderable-html"
import { fetchReaderOcrOverlay } from "#server/utils/reader-ocr"

function requiredParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name)
  if (!value) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  return value
}

function readerSliderPercent(pageIndex: number, declaredPageCount: number | null | undefined): number {
  if (declaredPageCount === null || declaredPageCount === undefined || declaredPageCount <= 1) {
    return 0
  }
  return Math.min(100, Math.max(0, pageIndex / (declaredPageCount - 1) * 100))
}

function readerSliderMaximum(
  pages: readonly Pick<ReaderPage["pageMap"][number], "page_index">[],
  declaredPageCount: number | null | undefined
): number | null {
  if (declaredPageCount === null || declaredPageCount === undefined) return null
  const maximum = declaredPageCount - 1
  return pages.every(page => page.page_index >= 0 && page.page_index <= maximum)
    ? maximum
    : null
}

function workContributorLabel(contributor: ReaderPage["contributors"][number]): string {
  const suffix = readerAuthorContributionSuffix(contributor.author_type, contributor.role)
  return suffix ? `${contributor.full_name} (${suffix})` : contributor.full_name
}

function workContributorText(contributors: ReaderPage["contributors"]): string {
  const labels = contributors.map(workContributorLabel)
  if (labels.length === 1) return labels[0]!
  return `${labels.slice(0, -1).join(", ")} & ${labels.at(-1)}`
}

const readerPageHandler = defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  const author = requiredParam(event, "author")
  const titlePath = requiredParam(event, "title")
  const pageName = requiredParam(event, "page")
  const mediaType = requiredParam(event, "mediatype")
  const metadata = await loadReaderMetadata(event, author, titlePath, mediaType)

  const currentPosition = metadata.pages.findIndex(page => page.page_name === pageName)
  if (currentPosition < 0) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }

  const currentPage = metadata.pages[currentPosition]!
  const parts = metadata.parts
  const partNavigation = resolveReaderPartNavigation(parts, currentPage.page_index)
  const knownNames = new Set(metadata.pages.map(page => page.page_name))
  const alternatePage = metadata.alternateMedia?.pages.find(page => page.page_name === pageName)
    ?? metadata.alternateMedia?.pages.find(page => page.page_index === currentPage.page_index)
    ?? metadata.alternateMedia?.pages[0]
  const commonPage = {
    alternateMedia: metadata.alternateMedia && alternatePage
      ? {
          mediaType: metadata.alternateMedia.media_type,
          pageName: alternatePage.page_name
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
    nextPageName: metadata.pages[currentPosition + metadata.pageStep]?.page_name ?? null,
    nextPartPageName: partNavigation.nextPartPageName,
    pageCount: metadata.pages.length,
    pageIndex: currentPage.page_index,
    pageMap: metadata.pages.map(page => ({
      page_index: page.page_index,
      page_name: page.page_name
    })),
    pageName,
    pageNames: metadata.pages.map(page => page.page_name),
    parts,
    previousPageName: metadata.pages[currentPosition - metadata.pageStep]?.page_name ?? null,
    previousPartPageName: partNavigation.previousPartPageName,
    searchable: metadata.searchable,
    sliderMaximum: readerSliderMaximum(metadata.pages, metadata.declaredPageCount),
    startPageName: metadata.startPageName && knownNames.has(metadata.startPageName)
      ? metadata.startPageName
      : null,
    sliderPercent: readerSliderPercent(currentPage.page_index, metadata.declaredPageCount),
    title: metadata.displayTitle,
    urn: metadata.urn,
    workId: metadata.workId
  }

  if (metadata.mediaType === "faksimil") {
    const facsimilePage = metadata.pages[currentPosition]!
    const ocrBase = useRuntimeConfig(event).contentBase.replace(/\/$/, "")
    const ocrOverlay = metadata.searchable
      ? await fetchReaderOcrOverlay(ocrBase, metadata.workId, facsimilePage.page_index)
      : null
    return {
      ...commonPage,
      imageNumber: facsimilePage.image_number,
      mediaType: metadata.mediaType,
      ocrOverlay,
      preferredSize: metadata.preferredSize,
      sources: buildFacsimileSources(
        metadata.workId,
        facsimilePage.image_number,
        metadata.sizes
      )
    } satisfies ReaderPage
  }

  const [pageHtml, sharedStylesheetCss, workStylesheetCss] = await Promise.all([
    fetchReaderPageHtml(
      metadata.base,
      metadata.workId,
      currentPage.page_index
    ),
    fetchReaderSharedStylesheet(useRuntimeConfig(event).contentBase.replace(/\/$/u, "")),
    fetchReaderWorkStylesheet(metadata.base, metadata.workId)
  ])
  const html = issueManagedReaderHtml(pageHtml.replaceAll("\u00ad", "-"))

  return {
    ...commonPage,
    html,
    mediaType: metadata.mediaType,
    sharedStylesheetCss,
    sharedStylesheetUrl: "/red/css/etext.css",
    workStylesheetCss,
    workStylesheetUrl: `/txt/css/${encodeURIComponent(metadata.workId)}-etext.css`
  } satisfies ReaderPage
})

export default defineCachedEventHandler(readerPageHandler, {
  maxAge: 60 * 60,
  shouldBypassCache: () => import.meta.dev
})
