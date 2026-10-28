export type LegacyPaginationItem = { key: string, page: number, label: string }
export type PaginationWindowOptions = { windowSize?: number, boundaryCount?: number }

// Vue adapter for the legacy rotating window/boundary-number options. Retain
// several boundary pages so people can choose an end page without another hop.
export function legacyPaginationItems(totalPages: number, currentPage: number, options: PaginationWindowOptions = {}): LegacyPaginationItem[] {
  const total = Math.max(0, Math.floor(totalPages))
  if (!total) return []
  const current = Math.max(1, Math.min(Math.floor(currentPage), total))
  const windowSize = Math.max(1, Math.floor(options.windowSize ?? 5))
  const boundaries = Math.max(1, Math.floor(options.boundaryCount ?? 3))
  const start = Math.max(1, Math.min(current - Math.floor((windowSize - 1) / 2), total - windowSize + 1))
  const pages = new Set<number>()
  for (let page = 1; page <= Math.min(total, boundaries); page++) pages.add(page)
  for (let page = start; page <= Math.min(total, start + windowSize - 1); page++) pages.add(page)
  for (let page = Math.max(1, total - boundaries + 1); page <= total; page++) pages.add(page)
  const items: LegacyPaginationItem[] = []
  for (const page of [...pages].sort((a, b) => a - b)) {
    const previous = items.at(-1)?.page ?? 0
    if (page - previous > 1) {
      const target = Math.floor((previous + page) / 2)
      items.push({ key: `gap-${target}`, page: target, label: page - previous === 2 ? String(target) : "..." })
    }
    items.push({ key: `page-${page}`, page, label: String(page) })
  }
  return items
}

export function mobilePaginationItems(totalPages: number, currentPage: number): LegacyPaginationItem[] {
  return legacyPaginationItems(totalPages, currentPage, { windowSize: totalPages >= 1000 ? 1 : 3, boundaryCount: 2 })
}
