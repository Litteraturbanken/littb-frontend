import { describe, expect, test } from "vitest"

import { queryWithoutKey } from "../../app/lib/dramawebben-query"

describe("queryWithoutKey", () => {
  test("removes only the selected key while preserving ordered repeated values", () => {
    expect(queryWithoutKey({
      first: "1",
      repeat: ["a", "b"],
      selected: "x",
      last: "2"
    }, "selected")).toEqual({
      first: "1",
      repeat: ["a", "b"],
      last: "2"
    })
  })
})
