import { describe, expect, it } from "vitest"

import { libraryTooltipDirective } from "../../app/directives/library-tooltip"

describe("libraryTooltipDirective", () => {
  it("exposes tooltip text to SSR without emitting empty metadata", () => {
    expect(libraryTooltipDirective.getSSRProps?.({ value: "Full title" } as never, {} as never))
      .toEqual({ "data-library-tooltip-content": "Full title" })
    expect(libraryTooltipDirective.getSSRProps?.({ value: "" } as never, {} as never))
      .toEqual({})
  })
})
