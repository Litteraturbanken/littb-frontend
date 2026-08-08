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
    && !destination.hash
    && isNuxtInternalHref(destination.pathname)
}

export function managedHtmlNavigationTarget(input: ManagedHtmlNavigationInput): string | null {
  if (hasUnmanagedClickBehavior(input)) return null

  const href = input.href?.trim()
  if (!href || href.startsWith("#")) return null

  try {
    const current = new URL(input.currentUrl)
    const destination = new URL(href, current)
    if (!isManagedDestination(destination, current)) return null

    const localHref = href.startsWith("/") && !href.startsWith("//")
      ? href
      : `${destination.pathname}${destination.search}`
    return canonicalNuxtHref(localHref)
  } catch {
    return null
  }
}
