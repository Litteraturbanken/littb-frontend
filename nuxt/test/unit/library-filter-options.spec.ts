import { describe, expect, it } from "vitest"

import { createLibraryFilterOptions } from "../../app/lib/library/filter-options"

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
