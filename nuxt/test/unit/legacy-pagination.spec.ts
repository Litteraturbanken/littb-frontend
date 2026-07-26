import { describe, expect, test } from "vitest"

import { legacyPaginationItems } from "../../app/lib/legacy-pagination"

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
