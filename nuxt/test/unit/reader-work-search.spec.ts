import { readFileSync } from "node:fs"

import { describe, expect, test } from "vitest"
import {
  decodedWorkSearchQueryKey,
  isWorkSearchActivationKey,
  nextWorkSearchOptions,
  replaceWorkSearchQuerySegments,
  workSearchHitAt,
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

  test("replaces configured raw query values while preserving unrelated bytes", () => {
    expect(replaceWorkSearchQuerySegments(
      ["keep=one", "hit=2", "%68it=3", "%E0%A4%A=broken"],
      new Set(),
      new Map([["hit", "4"], ["traff", "w1_2"]])
    )).toEqual([
      "keep=one",
      "hit=4",
      "hit=4",
      "%E0%A4%A=broken",
      "traff=w1_2"
    ])
  })

  test("removes configured search keys and appends missing replacements in insertion order", () => {
    expect(replaceWorkSearchQuerySegments(
      ["q=old", "show_search_work", "repeat=first", "repeat=second"],
      new Set(["q", "show_search_work"]),
      new Map([["s_query", "doktor glas"], ["hit_index", "0"]])
    )).toEqual([
      "repeat=first",
      "repeat=second",
      "s_query=doktor%20glas",
      "hit_index=0"
    ])
  })

  test("finds an exact indexed work-search hit", () => {
    const hits = [{ index: 2, label: "second" }, { index: 3, label: "third" }]

    expect(workSearchHitAt(hits, 3)).toEqual({ index: 3, label: "third" })
    expect(workSearchHitAt(hits, 1)).toBeNull()
  })

  test("adds a flag replacement without an equals sign", () => {
    expect(replaceWorkSearchQuerySegments(
      [],
      new Set(),
      new Map([["show_search_work", null]])
    )).toEqual(["show_search_work"])
  })

  test("Reader work-search query filtering delegates to the shared raw segment helper", () => {
    const source = readFileSync(new URL(
      "../../app/pages/författare/[author]/titlar/[title]/sida/[page]/[mediatype].vue",
      import.meta.url
    ), "utf8")
    const functionStart = source.indexOf("function workSearchFullPath")
    const functionEnd = source.indexOf("\nfunction submitWorkSearch", functionStart)
    const functionSource = source.slice(functionStart, functionEnd)

    expect(functionSource).toContain("replaceWorkSearchQuerySegments(")
    expect(functionSource).not.toContain("decodedRawQueryKey(segment)")
  })
})
