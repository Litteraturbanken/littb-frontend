export type LegacyPaginationItem = {
  key: string
  page: number
  label: string
}

export function legacyPaginationItems(
  totalPages: number,
  currentPage: number
): LegacyPaginationItem[] {
  const maxSize = 10
  if (totalPages <= 0) return []
  const boundedCurrent = Math.max(1, Math.min(currentPage, totalPages))
  const maxSized = maxSize < totalPages
  let startPage = 1
  let endPage = totalPages

  if (maxSized) {
    startPage = Math.max(boundedCurrent - Math.floor(maxSize / 2), 1)
    endPage = startPage + maxSize - 1
    if (endPage > totalPages) {
      endPage = totalPages
      startPage = endPage - maxSize + 1
    }
  }

  const items = Array.from({ length: endPage - startPage + 1 }, (_, index) => {
    const page = startPage + index
    return { key: `page-${page}`, page, label: String(page) }
  })
  if (maxSized && startPage > 1) {
    items.unshift({
      key: `ellipsis-previous-${startPage - 1}`,
      page: startPage - 1,
      label: "..."
    })
  }
  if (maxSized && endPage < totalPages) {
    items.push({
      key: `ellipsis-next-${endPage + 1}`,
      page: endPage + 1,
      label: "..."
    })
  }
  return items
}

// Keep both endpoints and the current page within six slots on narrow screens.
export function mobilePaginationItems(totalPages: number, currentPage: number): LegacyPaginationItem[] {
  if (totalPages <= 0) return []
  const current = Math.max(1, Math.min(currentPage, totalPages))
  const nearby = Math.max(2, Math.min(current, totalPages - 2))
  const pages = totalPages <= 6
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [...new Set([1, nearby, nearby + 1, totalPages])]
  const items: LegacyPaginationItem[] = []
  for (const page of pages) {
    const previous = items.at(-1)?.page ?? 0
    if (page - previous > 1) {
      const target = Math.floor((previous + page) / 2)
      items.push({ key: `gap-${target}`, page: target, label: page - previous === 2 ? String(target) : "..." })
    }
    items.push({ key: `page-${page}`, page, label: String(page) })
  }
  return items
}
