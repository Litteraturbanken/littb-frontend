const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/u

function editableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object" || !("tagName" in target)) return false
  const element = target as HTMLElement
  const name = element.tagName.toLowerCase()
  return name === "input" || name === "textarea" || name === "select" || element.isContentEditable
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
    || (typeof document !== "undefined"
      && document.querySelector('[role="dialog"][aria-modal="true"]') !== null)
}

export function urnResolverUrl(urn: string | null): string | null {
  if (
    !urn
    || urn.length > 100
    || urn.trim() !== urn
    || /\s/u.test(urn)
    || controlCharacters.test(urn)
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
