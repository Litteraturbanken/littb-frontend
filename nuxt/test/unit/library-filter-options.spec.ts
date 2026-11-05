import { describe, expect, it } from "vitest"

import { availableLibraryCollectionGroups, createLibraryFilterOptions } from "../../app/lib/library/filter-options"

describe("Library filter option ownership", () => {
  it("returns fresh mutable views for each page instance", () => {
    const first = createLibraryFilterOptions()
    const second = createLibraryFilterOptions()

    first.collectionValues.clear()
    first.collectionSelectGroups[0]?.options.shift()
    first.mediaSelectOptions.pop()
    first.languageValues.clear()

    expect(second.collectionValues).toContain("texttype:roman")
    expect(second.collectionSelectGroups[0]?.options[0]).toEqual({
      value: "texttype:brev;brevsamling",
      label: "Brev"
    })
    expect(second.mediaSelectOptions.at(-1)).toEqual({
      value: "mediatype:pdf",
      label: "PDF"
    })
    expect(second.languageValues).toContain("language:swe")
  })
})

it("offers Tal directly after Sakprosa", () => {
  const options = createLibraryFilterOptions().collectionSelectGroups.flatMap(group => group.options)
  const index = options.findIndex(option => option.label === "Sakprosa")
  expect(options[index + 1]).toEqual({ value: "texttype:tal", label: "Tal" })
})


it("only offers categories present in the downloadable catalogue and removes empty groups", () => {
  const groups = createLibraryFilterOptions().collectionSelectGroups
  const visible = availableLibraryCollectionGroups(groups, ["texttype:roman", "keyword:Dramawebben"])
  expect(visible.map(group => group.label)).toEqual(["Kategorier", "Avdelningar"])
  expect(visible.flatMap(group => group.options).map(option => option.label)).toEqual(["Romaner", "Dramawebben"])
  expect(availableLibraryCollectionGroups(groups, [])).toEqual([])
  expect(availableLibraryCollectionGroups(groups, null)).toBe(groups)
  expect(groups.flatMap(group => group.options).some(option => option.value === "source:skolan")).toBe(true)
})
