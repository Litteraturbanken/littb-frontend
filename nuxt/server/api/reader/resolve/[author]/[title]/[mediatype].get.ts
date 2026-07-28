import type { ReaderRouteResolution } from "#shared/types/reader"

function requiredParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name)
  if (!value) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  return value
}

function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  const author = requiredParam(event, "author")
  const titlePath = requiredParam(event, "title")
  const mediaType = requiredParam(event, "mediatype")
  const metadata = await loadReaderMetadata(event, author, titlePath, mediaType)
  const startPageName = metadata.startPageName
  if (!startPageName || !metadata.pages.some(page => page.page_name === startPageName)) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }

  const canonicalPath = [
    "/författare",
    encodeRfc3986Segment(metadata.author.author_id),
    "titlar",
    encodeRfc3986Segment(metadata.titlePath),
    "sida",
    encodeRfc3986Segment(startPageName),
    metadata.mediaType
  ].join("/")

  return {
    authorId: metadata.author.author_id,
    canonicalPath,
    mediaType: metadata.mediaType,
    startPageName,
    titlePath: metadata.titlePath
  } satisfies ReaderRouteResolution
})
