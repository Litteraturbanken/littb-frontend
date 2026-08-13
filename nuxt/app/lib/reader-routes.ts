import { encodeRfc3986Segment } from "./internal-navigation"

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

function splitFragment(fullPath: string): { beforeFragment: string, fragment: string } {
  const fragmentIndex = fullPath.indexOf("#")
  return fragmentIndex < 0
    ? { beforeFragment: fullPath, fragment: "" }
    : {
        beforeFragment: fullPath.slice(0, fragmentIndex),
        fragment: fullPath.slice(fragmentIndex)
      }
}

type ReaderDialogKey = "innehall" | "om-boken"

const contentsKey = new Set<ReaderDialogKey>(["innehall"])
const sourceInfoKey = new Set<ReaderDialogKey>(["om-boken"])
const readerDialogKeys = new Set<ReaderDialogKey>(["innehall", "om-boken"])

function decodedQuerySegmentKey(segment: string): string | null {
  const separator = segment.indexOf("=")
  const rawKey = separator < 0 ? segment : segment.slice(0, separator)
  try {
    return decodeURIComponent(rawKey.replace(/\+/gu, " "))
  } catch {
    return null
  }
}

function isDialogSegment(segment: string, keys: ReadonlySet<ReaderDialogKey>): boolean {
  const key = decodedQuerySegmentKey(segment)
  return key !== null && keys.has(key as ReaderDialogKey)
}

function withoutReaderDialogKeys(
  fullPath: string,
  keys: ReadonlySet<ReaderDialogKey>
): string {
  const { beforeFragment, fragment } = splitFragment(fullPath)
  const queryIndex = beforeFragment.indexOf("?")
  if (queryIndex < 0) return fullPath

  const path = beforeFragment.slice(0, queryIndex)
  const rawQuery = beforeFragment.slice(queryIndex + 1)
  const retained = rawQuery.split("&").filter(segment => !isDialogSegment(segment, keys))
  return `${path}${retained.length > 0 ? `?${retained.join("&")}` : ""}${fragment}`
}

function appendBareQueryKey(fullPath: string, key: ReaderDialogKey): string {
  const { beforeFragment, fragment } = splitFragment(fullPath)
  const separator = beforeFragment.includes("?")
    ? beforeFragment.endsWith("?") ? "" : "&"
    : "?"
  return `${beforeFragment}${separator}${key}${fragment}`
}

export function readerContentsIsOpen(value: unknown): boolean {
  return value === null || value === ""
}

export function readerSourceInfoIsOpen(value: unknown): boolean {
  return value === null
    || Array.isArray(value)
    || (typeof value === "string" && value.length > 0)
}

export function readerFullPathWithFragment(
  rawFullPath: string,
  fragmentSource: string
): string {
  const { beforeFragment } = splitFragment(rawFullPath)
  const { fragment } = splitFragment(fragmentSource)
  return `${beforeFragment}${fragment}`
}

export function readerFullPathWithQueryValue(
  fullPath: string,
  key: string,
  value: string
): string {
  const { beforeFragment, fragment } = splitFragment(fullPath)
  const queryIndex = beforeFragment.indexOf("?")
  const path = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex)
  const rawQuery = queryIndex < 0 ? "" : beforeFragment.slice(queryIndex + 1)
  let replaced = false
  const segments = (rawQuery ? rawQuery.split("&") : []).flatMap(segment => {
    if (decodedQuerySegmentKey(segment) !== key) return [segment]
    if (replaced) return []
    replaced = true
    return [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`]
  })
  if (!replaced) segments.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  return `${path}?${segments.join("&")}${fragment}`
}

export function readerPartAuthorKey(authorId: string, index: number): string {
  return `${authorId}:${index}`
}

export function readerContentsNeutralFullPath(fullPath: string): string {
  return withoutReaderDialogKeys(fullPath, contentsKey)
}

export function readerSourceInfoNeutralFullPath(fullPath: string): string {
  return withoutReaderDialogKeys(fullPath, sourceInfoKey)
}

export function readerDialogNeutralFullPath(fullPath: string): string {
  return withoutReaderDialogKeys(fullPath, readerDialogKeys)
}

export function readerContentsHref(fullPath: string): string {
  return appendBareQueryKey(readerDialogNeutralFullPath(fullPath), "innehall")
}

export function readerSourceInfoHref(fullPath: string): string {
  return appendBareQueryKey(readerDialogNeutralFullPath(fullPath), "om-boken")
}

export function readerPageFullPath(fullPath: string, pageName: string): string {
  const neutral = readerDialogNeutralFullPath(fullPath)
  const { beforeFragment, fragment } = splitFragment(neutral)
  const queryIndex = beforeFragment.indexOf("?")
  const path = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex)
  const query = queryIndex < 0 ? "" : beforeFragment.slice(queryIndex)
  const segments = path.split("/")
  if (segments.length < 3 || segments.at(-3) !== "sida") {
    throw new RangeError("Reader full path is not canonical")
  }
  segments[segments.length - 2] = encodeURIComponent(pageName)
  return `${segments.join("/")}${query}${fragment}`
}

export function readerMediaFullPath(
  fullPath: string,
  pageName: string,
  mediaType: "etext" | "faksimil"
): string {
  const pageFullPath = readerPageFullPath(fullPath, pageName)
  const { beforeFragment, fragment } = splitFragment(pageFullPath)
  const queryIndex = beforeFragment.indexOf("?")
  const path = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex)
  const query = queryIndex < 0 ? "" : beforeFragment.slice(queryIndex)
  const segments = path.split("/")
  if (segments.length < 2 || (segments.at(-1) !== "etext" && segments.at(-1) !== "faksimil")) {
    throw new RangeError("Reader full path is not canonical")
  }
  segments[segments.length - 1] = mediaType
  return `${segments.join("/")}${query}${fragment}`
}

export function readerAuthorHref(author: string): string {
  return `/f%C3%B6rfattare/${encodeRfc3986Segment(author)}`
}

export function readerPageHref({
  author,
  title,
  page,
  mediaType,
  query
}: ReaderRouteSegments): string {
  const path = [
    "/f%C3%B6rfattare",
    encodeRfc3986Segment(author),
    "titlar",
    encodeRfc3986Segment(title),
    "sida",
    encodeRfc3986Segment(page),
    encodeRfc3986Segment(mediaType)
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
