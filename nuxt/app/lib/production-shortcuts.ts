import {
  isCanonicalPastedWorkId,
  libraryWorkIdFilterHref
} from "./library-navigation"
import { hasC0OrC1Control, hasEcmaWhitespace } from "#shared/utils/text-safety"

const pastedLbId = /(?<![A-Za-z0-9_])lb[A-Za-z0-9_]+(?![A-Za-z0-9_])/giu
const maximumPasteLength = 65_536
const maximumPastedIds = 100

function editableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object" || !("closest" in target)) return false
  const element = target as Element
  return element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null
}

function dialogTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object" || !("closest" in target)) return false
  return (target as Element).closest('dialog[open], [role="dialog"]') !== null
}

function openDialog(): boolean {
  return typeof document !== "undefined"
    && document.querySelector('dialog[open], [role="dialog"]') !== null
}

function hasFocusedPasteOwner(target: EventTarget | null): boolean {
  if (target === null) return false
  if (typeof target !== "object" || !("ownerDocument" in target)) return true
  const element = target as Element
  return element !== element.ownerDocument.body
    && element !== element.ownerDocument.documentElement
}

export function isProductionShortcutGuarded(
  event: KeyboardEvent,
  activeElement?: EventTarget | null
): boolean {
  const currentActiveElement = activeElement === undefined && typeof document !== "undefined"
    ? document.activeElement
    : activeElement ?? null
  return event.defaultPrevented
    || event.isComposing
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey
    || editableTarget(event.target)
    || editableTarget(currentActiveElement)
    || dialogTarget(event.target)
    || dialogTarget(currentActiveElement)
    || openDialog()
}

export function isPublicShellPasteGuarded(
  event: ClipboardEvent,
  activeElement?: EventTarget | null
): boolean {
  const currentActiveElement = activeElement === undefined && typeof document !== "undefined"
    ? document.activeElement
    : activeElement ?? null
  return event.defaultPrevented
    || hasFocusedPasteOwner(currentActiveElement)
    || editableTarget(event.target)
    || dialogTarget(event.target)
    || openDialog()
}

export function publicShellShortcutDestination(
  key: string,
  libraryHref: string
): string | null {
  if (key === "h") return "/historik"
  if (key === "b") return libraryHref
  return null
}

export function pastedLbNavigationDestination(text: string): string | null {
  if (!text || text.length > maximumPasteLength) return null
  const matches = [...text.matchAll(pastedLbId)]
  if (matches.length === 0 || matches.length > maximumPastedIds) return null
  const ids = matches.map(match => {
    const value = match[0]!
    return `lb${value.slice(2)}`
  })
  if (ids.some(id => !isCanonicalPastedWorkId(id))) return null
  if (ids.length > 1) return libraryWorkIdFilterHref(ids)
  return `/editor/${encodeURIComponent(ids[0]!)}/ix/0/f`
}

export function urnResolverUrl(urn: string | null): string | null {
  if (
    !urn
    || urn.length > 100
    || urn.trim() !== urn
    || hasEcmaWhitespace(urn)
    || hasC0OrC1Control(urn)
  ) return null
  return `https://urn.kb.se/resolve?urn=${urn}`
}

export async function copyProductionValue(value: string): Promise<boolean> {
  if (!value || !navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
