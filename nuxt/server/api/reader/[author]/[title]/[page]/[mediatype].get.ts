import type { ReaderPage } from "#shared/types/reader"

function requiredParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name)
  if (!value) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  return value
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
  const commonPage = {
    author: metadata.author,
    description:
      `${metadata.displayTitle} av ${metadata.author.name}, sida ${pageName} som ${metadata.mediaType}.`,
    fullTitle: metadata.fullTitle,
    imprintYear: metadata.imprintYear,
    nextPageName: metadata.pages[currentPosition + 1]?.pageName ?? null,
    pageCount: metadata.pages.length,
    pageIndex: currentPage.pageIndex,
    pageName,
    previousPageName: metadata.pages[currentPosition - 1]?.pageName ?? null,
    title: metadata.displayTitle,
    workId: metadata.workId
  }

  if (metadata.mediaType === "faksimil") {
    const facsimilePage = metadata.pages[currentPosition]!
    return {
      ...commonPage,
      imageNumber: facsimilePage.imageNumber,
      mediaType: metadata.mediaType,
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
