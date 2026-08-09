import { describe, expect, test } from "vitest"

import { queryWithoutKey, queryWithoutKeys } from "../../app/lib/dramawebben-query"

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

describe("queryWithoutKeys", () => {
  test("removes the owned keys while preserving unrelated and repeated values", () => {
    expect(queryWithoutKeys({
      gender: "female",
      repeat: ["a", "b"],
      filterTxt: "Julie",
      keep: "one"
    }, new Set(["gender", "filterTxt"]))).toEqual({
      repeat: ["a", "b"],
      keep: "one"
    })
  })
})
