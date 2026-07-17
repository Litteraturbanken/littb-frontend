import type { ReaderRouteResolution } from "#shared/types/reader"

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
  const mediaType = requiredParam(event, "mediatype")
  const metadata = await loadReaderMetadata(event, author, titlePath, mediaType)
  const startPageName = metadata.startPageName
  if (!startPageName || !metadata.pages.some(page => page.pageName === startPageName)) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }

  const canonicalPath = [
    "/författare",
    encodeURIComponent(metadata.author.id),
    "titlar",
    encodeURIComponent(metadata.titlePath),
    "sida",
    encodeURIComponent(startPageName),
    metadata.mediaType
  ].join("/")

  return {
    authorId: metadata.author.id,
    canonicalPath,
    mediaType: metadata.mediaType,
    startPageName,
    titlePath: metadata.titlePath
  } satisfies ReaderRouteResolution
})
