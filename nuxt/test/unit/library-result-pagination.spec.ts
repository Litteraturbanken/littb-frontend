import { describe, expect, it } from "vitest"

import { canonicalLibraryResultPage } from "../../app/lib/library/result-pagination"

describe("canonicalLibraryResultPage", () => {
  it.each([
    [1, 0, 1],
    [2, 0, 1],
    [100, 100, 1],
    [100, 101, 2],
    [2, 101, 2],
    [101, 100360, 101],
    [1004, 100360, 1004],
    [999999999, 100360, 1004],
    [175, 16661, 167]
  ])("normalizes requested page %d for %d hits to %d", (requested, hits, expected) => {
    expect(canonicalLibraryResultPage(requested, hits)).toBe(expected)
  })
})
