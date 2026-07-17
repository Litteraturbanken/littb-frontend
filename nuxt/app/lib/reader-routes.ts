interface ReaderRouteSegments {
  author: string
  title: string
  page: string
  mediaType: string
  query?: ReaderRouteQuery
}

export type ReaderRouteQuery = Record<string, string | readonly string[]>

interface ReaderHitRouteSegments extends ReaderRouteSegments {
  hit: number
}

export function readerAuthorHref(author: string): string {
  return `/författare/${encodeURIComponent(author)}`
}

export function readerPageHref({
  author,
  title,
  page,
  mediaType,
  query
}: ReaderRouteSegments): string {
  const path = [
    "/författare",
    encodeURIComponent(author),
    "titlar",
    encodeURIComponent(title),
    "sida",
    encodeURIComponent(page),
    encodeURIComponent(mediaType)
  ].join("/")
  if (!query) return path

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      searchParams.append(key, value)
    } else {
      for (const item of value) searchParams.append(key, item)
    }
  }
  const search = searchParams.toString()
  return search ? `${path}?${search}` : path
}

export function readerHitHref({
  hit,
  query,
  ...segments
}: ReaderHitRouteSegments): string {
  return readerPageHref({
    ...segments,
    query: { ...query, hit: String(hit) }
  })
}
