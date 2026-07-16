interface ReaderRouteSegments {
  author: string
  title: string
  page: string
  mediaType: string
}

export function readerAuthorHref(author: string): string {
  return `/författare/${encodeURIComponent(author)}`
}

export function readerPageHref({
  author,
  title,
  page,
  mediaType
}: ReaderRouteSegments): string {
  return [
    "/författare",
    encodeURIComponent(author),
    "titlar",
    encodeURIComponent(title),
    "sida",
    encodeURIComponent(page),
    encodeURIComponent(mediaType)
  ].join("/")
}
