import { describe, expect, test } from "vitest"

import {
  cloneRecord,
  requiredArray,
  requiredRecord
} from "../helpers/malformed-json"

describe("malformed JSON helpers", () => {
  test("clones records and narrows nested containers", () => {
    expect(cloneRecord({ nested: { rows: [1] } })).toEqual({ nested: { rows: [1] } })
    expect(requiredRecord({ child: {} }, "child")).toEqual({})
    expect(requiredArray({ rows: [1] }, "rows")).toEqual([1])
  })

  test("rejects a wrong nested container", () => {
    expect(() => requiredRecord({ child: [] }, "child")).toThrow("child must be an object")
    expect(() => requiredArray({ rows: {} }, "rows")).toThrow("rows must be an array")
  })
})
