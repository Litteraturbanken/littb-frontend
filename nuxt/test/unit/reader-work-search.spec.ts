import { describe, expect, test } from "vitest"
import {
  decodedWorkSearchQueryKey,
  isWorkSearchActivationKey,
  nextWorkSearchOptions,
  type WorkSearchOptionsState
} from "../../app/lib/reader/work-search"

const initial: WorkSearchOptionsState = {
  lemma: false,
  olderSpellings: true,
  prefix: false,
  suffix: false
}

describe("reader and editor work-search options", () => {
  test.each([
    ["default", { lemma: false, olderSpellings: false, prefix: false, suffix: false }],
    ["lemma", { lemma: true, olderSpellings: false, prefix: false, suffix: false }],
    ["modernize", { lemma: false, olderSpellings: false, prefix: false, suffix: false }],
    ["prefix", { lemma: false, olderSpellings: false, prefix: true, suffix: false }],
    ["suffix", { lemma: false, olderSpellings: false, prefix: false, suffix: true }],
    ["infix", { lemma: false, olderSpellings: false, prefix: true, suffix: true }]
  ] as const)("applies the %s option", (option, expected) => {
    expect(nextWorkSearchOptions(initial, option)).toEqual(expected)
  })

  test("turning modernized spelling on clears incompatible options", () => {
    expect(nextWorkSearchOptions({
      lemma: true,
      olderSpellings: false,
      prefix: true,
      suffix: true
    }, "modernize")).toEqual(initial)
  })

  test("recognizes only Enter and Space as option activation keys", () => {
    expect(isWorkSearchActivationKey("Enter")).toBe(true)
    expect(isWorkSearchActivationKey(" ")).toBe(true)
    expect(isWorkSearchActivationKey("Spacebar")).toBe(false)
  })

  test("decodes a raw query key without throwing on malformed escapes", () => {
    expect(decodedWorkSearchQueryKey("s_query=kyrka")).toBe("s_query")
    expect(decodedWorkSearchQueryKey("show+search")).toBe("show search")
    expect(decodedWorkSearchQueryKey("%E0%A4%A=value")).toBeNull()
  })
})
