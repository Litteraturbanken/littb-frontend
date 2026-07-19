import { describe, expect, test } from "vitest"

import { readerSliderGeometryStyles } from "../../shared/utils/reader-slider"

describe("legacy Reader slider geometry", () => {
  test.each([
    [0, { pointerLeft: "0px", selectionWidth: "10px" }],
    [50, { pointerLeft: "calc(50% - 10px)", selectionWidth: "50%" }],
    [100, {
      pointerLeft: "calc(100% - 20px)",
      selectionWidth: "calc(100% - 10px)"
    }]
  ])("positions the pointer and selection at %i percent", (percent, expected) => {
    expect(readerSliderGeometryStyles(percent)).toEqual(expected)
  })

  test.each([
    [-25, { pointerLeft: "0px", selectionWidth: "10px" }],
    [125, {
      pointerLeft: "calc(100% - 20px)",
      selectionWidth: "calc(100% - 10px)"
    }]
  ])("clamps %i percent to the slider track", (percent, expected) => {
    expect(readerSliderGeometryStyles(percent)).toEqual(expected)
  })
})
