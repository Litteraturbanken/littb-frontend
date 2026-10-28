import { describe, expect, test } from "vitest"
import { legacyPaginationItems, mobilePaginationItems } from "../../app/lib/legacy-pagination"

const labels = (total: number, current: number) => legacyPaginationItems(total, current).map(item => item.label)
describe("configured pagination windows", () => {
  test("keeps useful first and last clusters around start, middle and end windows", () => {
    expect(labels(30, 1)).toEqual(["1", "2", "3", "4", "5", "...", "28", "29", "30"])
    expect(labels(30, 15)).toEqual(["1", "2", "3", "...", "13", "14", "15", "16", "17", "...", "28", "29", "30"])
    expect(labels(30, 30)).toEqual(["1", "2", "3", "...", "26", "27", "28", "29", "30"])
  })
  test("shows all short sets and fills single-number gaps without ellipses", () => {
    expect(labels(8, 4)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"])
    expect(labels(1, 1)).toEqual(["1"])
    expect(labels(0, 1)).toEqual([])
    expect(labels(30, 100)).toEqual(labels(30, 30))
    expect(labels(30, -1)).toEqual(labels(30, 1))
    expect(legacyPaginationItems(30, 15, { boundaryCount: 1, windowSize: 1 }).map(item => item.label)).toEqual(["1", "...", "15", "...", "30"])
  })
  test.each([1, 3, 137, 271, 273])("keeps mobile boundaries/current inside nine slots on page %d", current => {
    const items = mobilePaginationItems(273, current)
    expect(items.length).toBeLessThanOrEqual(9)
    for (const page of [1, 2, current, 272, 273]) expect(items.some(item => item.page === page && item.label !== "...")).toBe(true)
    expect(items.every(item => item.page >= 1 && item.page <= 273)).toBe(true)
  })
  test("four/five-digit pages keep the current page and useful end clusters within seven slots", () => {
    const items = mobilePaginationItems(10000, 5000)
    expect(items.map(item => item.label)).toEqual(["1", "2", "...", "5000", "...", "9999", "10000"])
  })
  test("compact mode shows every page in a small set", () => {
    expect(mobilePaginationItems(5, 3).map(item => item.label)).toEqual(["1", "2", "3", "4", "5"])
  })
})
