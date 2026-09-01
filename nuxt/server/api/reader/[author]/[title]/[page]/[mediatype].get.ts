import type { ReaderPage } from "#shared/types/reader"
import { readerAuthorContributionSuffix } from "#shared/utils/reader-author"
import { issueManagedReaderHtml } from "#shared/utils/renderable-html"
import { resolveReaderPartNavigation } from "#shared/utils/reader-part-navigation"
import { fetchReaderOcrOverlay } from "#server/utils/reader-ocr"
import type {
  ReaderEtextWorkMetadata,
  ReaderFacsimileWorkMetadata
} from "#server/utils/reader-source"

type ReaderEvent = Parameters<typeof getRouterParam>[0]
type ReaderMetadata = Awaited<ReturnType<typeof loadReaderMetadata>>
type ReaderMetadataPage = ReaderMetadata["pages"][number]

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
  return pages.length === declaredPageCount
    && pages.every((page, index) => page.page_index === index)
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

function readerPagePosition(metadata: ReaderMetadata, pageName: string): number {
  const position = metadata.pages.findIndex(page => page.page_name === pageName)
  if (position < 0) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  return position
}

function alternateMediaTarget(
  metadata: ReaderMetadata,
  pageName: string,
  pageIndex: number
): ReaderPage["alternateMedia"] {
  if (!metadata.alternateMedia) return null
  const page = metadata.alternateMedia.pages.find(candidate => candidate.page_name === pageName)
    ?? metadata.alternateMedia.pages.find(candidate => candidate.page_index === pageIndex)
    ?? metadata.alternateMedia.pages[0]
  return page
    ? { mediaType: metadata.alternateMedia.media_type, pageName: page.page_name }
    : null
}

function commonReaderPage(
  metadata: ReaderMetadata,
  currentPage: ReaderMetadataPage,
  currentPosition: number,
  pageName: string
) {
  const partNavigation = resolveReaderPartNavigation(metadata.parts, currentPage.page_index)
  const knownNames = new Set(metadata.pages.map(page => page.page_name))
  return {
    alternateMedia: alternateMediaTarget(metadata, pageName, currentPage.page_index),
    alternateMediaPageMap: metadata.alternateMedia?.pages ?? null,
    author: metadata.author,
    contributors: metadata.contributors,
    declaredPageCount: metadata.declaredPageCount ?? null,
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
    pageMap: metadata.pages.map(page => ({ ...page })),
    pageName,
    pageNames: metadata.pages.map(page => page.page_name),
    pageStep: metadata.pageStep,
    parts: metadata.parts,
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
}

async function facsimileReaderPage(
  event: ReaderEvent,
  metadata: ReaderFacsimileWorkMetadata,
  currentPosition: number,
  commonPage: ReturnType<typeof commonReaderPage>
): Promise<ReaderPage> {
  const currentPage = metadata.pages[currentPosition]!
  const ocrBase = useRuntimeConfig(event).contentBase.replace(/\/$/, "")
  const ocrOverlay = metadata.searchable
    ? await fetchReaderOcrOverlay(ocrBase, metadata.workId, currentPage.page_index)
    : null
  return {
    ...commonPage,
    imageNumber: currentPage.image_number,
    mediaType: "faksimil",
    ocrOverlay,
    pageMap: metadata.pages.map(page => ({ ...page })),
    preferredSize: metadata.preferredSize,
    sources: buildFacsimileSources(metadata.workId, currentPage.image_number, metadata.sizes)
  }
}

async function etextReaderPage(
  event: ReaderEvent,
  metadata: ReaderEtextWorkMetadata,
  currentPosition: number,
  commonPage: ReturnType<typeof commonReaderPage>
): Promise<ReaderPage> {
  const currentPage = metadata.pages[currentPosition]!
  const [pageHtml, sharedStylesheetCss, workStylesheetCss] = await Promise.all([
    fetchReaderPageHtml(metadata.base, metadata.workId, currentPage.page_index),
    fetchReaderSharedStylesheet(useRuntimeConfig(event).contentBase.replace(/\/$/u, "")),
    fetchReaderWorkStylesheet(metadata.base, metadata.workId)
  ])
  return {
    ...commonPage,
    html: issueManagedReaderHtml(pageHtml.replaceAll("\u00ad", "-")),
    mediaType: "etext",
    sharedStylesheetCss,
    sharedStylesheetUrl: "/red/css/etext.css",
    workStylesheetCss,
    workStylesheetUrl: `/txt/css/${encodeURIComponent(metadata.workId)}-etext.css`
  }
}

const readerPageHandler = defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  const author = requiredParam(event, "author")
  const titlePath = requiredParam(event, "title")
  const pageName = requiredParam(event, "page")
  const mediaType = requiredParam(event, "mediatype")
  const metadata = await loadReaderMetadata(event, author, titlePath, mediaType)
  const currentPosition = readerPagePosition(metadata, pageName)
  const currentPage = metadata.pages[currentPosition]!
  const commonPage = commonReaderPage(metadata, currentPage, currentPosition, pageName)
  if (metadata.mediaType === "faksimil") {
    return facsimileReaderPage(event, metadata, currentPosition, commonPage)
  }
  return etextReaderPage(event, metadata, currentPosition, commonPage)
})

export default readerPageHandler
