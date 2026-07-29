import { describe, expect, test } from "vitest"

import { safeBackendPath } from "../../server/utils/backend-proxy"

describe("backend proxy paths", () => {
  test("encodes every decoded path segment", () => {
    expect(safeBackendPath("authors/SöderbergH"))
      .toBe("authors/S%C3%B6derbergH")
    expect(safeBackendPath("works/a b%20c"))
      .toBe("works/a%20b%2520c")
  })

  test.each([
    undefined,
    "",
    "/authors",
    "authors/",
    "authors//SöderbergH",
    ".",
    "../private",
    "authors/../private",
    "reader\\private",
    "reader/\u0000private",
    "reader/\u001fprivate",
    "reader/\u007fprivate"
  ])("rejects unsafe backend path %j", value => {
    expect(() => safeBackendPath(value)).toThrowError(/Invalid backend path/u)
  })
})
