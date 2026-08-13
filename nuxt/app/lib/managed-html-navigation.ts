import { canonicalNuxtHref, isNuxtInternalHref } from "./internal-navigation"

export type ManagedHtmlNavigationInput = {
  href: string | null
  currentUrl: string
  button: number
  defaultPrevented: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  download: boolean
  target: string | null
}

function hasUnmanagedClickBehavior(input: ManagedHtmlNavigationInput): boolean {
  return input.defaultPrevented
    || input.button !== 0
    || input.altKey
    || input.ctrlKey
    || input.metaKey
    || input.shiftKey
    || input.download
    || input.target !== null
}

function isManagedDestination(destination: URL, current: URL): boolean {
  return destination.origin === current.origin
    && ["http:", "https:"].includes(destination.protocol)
    && !destination.username
    && !destination.password
    && !destination.hash
    && isNuxtInternalHref(destination.pathname)
}

function rawPathname(value: string): string | null {
  const absolute = /^[a-z][a-z\d+.-]*:\/\//iu.exec(value)
  const pathStart = absolute
    ? value.indexOf("/", absolute[0].length)
    : 0
  if (pathStart < 0) return "/"
  const fragmentIndex = value.indexOf("#", pathStart)
  const queryIndex = value.indexOf("?", pathStart)
  const pathEnd = queryIndex < 0 ? fragmentIndex : fragmentIndex < 0
    ? queryIndex
    : Math.min(queryIndex, fragmentIndex)
  return pathEnd < 0 ? value.slice(pathStart) : value.slice(pathStart, pathEnd)
}

function hasRawDotSegment(value: string): boolean {
  const pathname = rawPathname(value)
  if (pathname === null) return true
  try {
    return pathname.split("/").some(segment => {
      const decoded = decodeURIComponent(segment)
      return decoded === "." || decoded === ".."
    })
  } catch {
    return true
  }
}

function managedRootRelativeHref(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null
  const pathname = rawPathname(href)
  return !href.includes("#") && pathname !== null && isNuxtInternalHref(pathname)
    ? canonicalNuxtHref(href)
    : ""
}

function rawAbsolutePathIsInternal(href: string): boolean {
  if (!/^[a-z][a-z\d+.-]*:\/\//iu.test(href)) return true
  const pathname = rawPathname(href)
  return pathname !== null && isNuxtInternalHref(pathname)
}

export function managedHtmlNavigationTarget(input: ManagedHtmlNavigationInput): string | null {
  if (hasUnmanagedClickBehavior(input)) return null

  const href = input.href?.trim()
  if (!href || href.startsWith("#")) return null

  try {
    const current = new URL(input.currentUrl)
    if (hasRawDotSegment(href)) return null
    const rootRelative = managedRootRelativeHref(href)
    if (rootRelative !== null) return rootRelative || null
    const destination = new URL(href, current)
    if (!isManagedDestination(destination, current)) return null
    if (!rawAbsolutePathIsInternal(href)) return null

    const localHref = `${destination.pathname}${destination.search}`
    return canonicalNuxtHref(localHref)
  } catch {
    return null
  }
}
