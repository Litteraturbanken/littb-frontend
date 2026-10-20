import { describe, expect, test } from "vitest"
import { displayedSummary } from "../../app/lib/library/displayed-summary"

describe("displayed library counts", () => {
  test("retains settled counts across pending searches but accepts zero results", () => {
    const old = { identity: "berg", works: 100, parts: 40 }
    const pending = displayedSummary({ identity: "strindberg", works: null, parts: null }, old)
    expect(pending).toEqual({ identity: "strindberg", works: 100, parts: 40 })
    expect(displayedSummary({ identity: "empty", works: 0, parts: 0 }, pending))
      .toEqual({ identity: "empty", works: 0, parts: 0 })
  })
  test("does not invent counts before the first result", () => {
    expect(displayedSummary({ identity: "first", works: null })).toEqual({ identity: "first", works: null })
  })
})
