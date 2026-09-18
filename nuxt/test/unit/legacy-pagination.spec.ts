import { describe, expect, test } from "vitest"

import { legacyPaginationItems, mobilePaginationItems } from "../../app/lib/legacy-pagination"

describe("legacyPaginationItems", () => {
  test("shows the first ten pages and a forward ellipsis on the first page", () => {
    expect(legacyPaginationItems(17, 1)).toEqual([
      ...Array.from({ length: 10 }, (_, index) => ({
        key: `page-${index + 1}`,
        page: index + 1,
        label: String(index + 1)
      })),
      { key: "ellipsis-next-11", page: 11, label: "..." }
    ])
  })

  test("centres ten numeric pages between clickable ellipses in the middle", () => {
    expect(legacyPaginationItems(17, 9)).toEqual([
      { key: "ellipsis-previous-3", page: 3, label: "..." },
      ...Array.from({ length: 10 }, (_, index) => ({
        key: `page-${index + 4}`,
        page: index + 4,
        label: String(index + 4)
      })),
      { key: "ellipsis-next-14", page: 14, label: "..." }
    ])
  })

  test("shows a backward ellipsis and the final ten pages at the end", () => {
    expect(legacyPaginationItems(17, 17)).toEqual([
      { key: "ellipsis-previous-7", page: 7, label: "..." },
      ...Array.from({ length: 10 }, (_, index) => ({
        key: `page-${index + 8}`,
        page: index + 8,
        label: String(index + 8)
      }))
    ])
  })
})


describe("mobilePaginationItems", () => {
  test.each([
    [1, ["1", "2", "3", "...", "273"]],
    [3, ["1", "2", "3", "4", "...", "273"]],
    [137, ["1", "...", "137", "138", "...", "273"]],
    [271, ["1", "...", "271", "272", "273"]],
    [273, ["1", "...", "271", "272", "273"]]
  ])("keeps endpoints and the current page within six slots on page %d", (page, labels) => {
    const items = mobilePaginationItems(273, page)
    expect(items.map(item => item.label)).toEqual(labels)
    expect(items.every(item => item.page >= 1 && item.page <= 273)).toBe(true)
  })

  test("shows every page for short result sets", () => {
    expect(mobilePaginationItems(5, 3).map(item => item.label)).toEqual(["1", "2", "3", "4", "5"])
    expect(mobilePaginationItems(1, 1).map(item => item.label)).toEqual(["1"])
    expect(mobilePaginationItems(0, 1)).toEqual([])
  })
})
