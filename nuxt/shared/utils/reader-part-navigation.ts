import type { WorkManifestPart } from "../types/work-manifest"

export function resolveReaderPartNavigation(
  parts: readonly WorkManifestPart[],
  pageIndex: number
): {
  currentPartIndex: number | null
  previousPartPageName: string | null
  nextPartPageName: string | null
} {
  for (const [sourceIndex, part] of parts.entries()) {
    if (part.source_index !== sourceIndex) {
      throw new RangeError("Reader part source indexes must match source order")
    }
  }

  const ordered = [...parts].sort((left, right) => (
    left.start_page_index - right.start_page_index || left.source_index - right.source_index
  ))
  const starting = ordered.find(part => part.start_page_index === pageIndex)
  const active = ordered.filter(part => (
    part.start_page_index <= pageIndex && pageIndex <= part.end_page_index
  ))
  const previous = ordered.filter(part => part.start_page_index <= pageIndex - 1).at(-1)
  const next = ordered.find(part => part.start_page_index >= pageIndex + 1)
  return {
    currentPartIndex: (starting ?? active.at(-1))?.source_index ?? null,
    previousPartPageName: previous?.start_page_name ?? null,
    nextPartPageName: next?.start_page_name ?? null
  }
}
