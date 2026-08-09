import { describe, expect, test } from "vitest"

import { catalogSourceInfoKey } from "../../app/lib/dramawebben-source-info"

describe("Dramawebben source-information identity", () => {
  test("does not collide when either segment contains a delimiter", () => {
    const left = { authorId: "a", titlePath: "b|c" }
    const right = { authorId: "a|b", titlePath: "c" }

    expect(catalogSourceInfoKey(left)).not.toBe(catalogSourceInfoKey(right))
  })
})
