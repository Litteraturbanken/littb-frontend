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


test("download counts survive invalidation and independently arriving responses", () => {
  const old = { identity: "old", epub: 132, pdf: 81 }
  const pending = displayedSummary({ identity: "new", epub: null, pdf: null }, old)
  expect(pending).toEqual({ identity: "new", epub: 132, pdf: 81 })
  const epub = displayedSummary({ identity: "new", epub: 62, pdf: null }, pending)
  expect(epub).toEqual({ identity: "new", epub: 62, pdf: 81 })
  expect(displayedSummary({ identity: "new", epub: 62, pdf: 0 }, epub))
    .toEqual({ identity: "new", epub: 62, pdf: 0 })
})
