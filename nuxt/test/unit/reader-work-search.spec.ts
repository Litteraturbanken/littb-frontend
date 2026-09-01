import { describe, expect, test } from "vitest"
import {
  decodedWorkSearchQueryKey,
  nextWorkSearchOptions,
  rememberWorkSearchSnapshot,
  restoredWorkSearchSnapshot,
  replaceWorkSearchQuerySegments,
  workSearchHitAt,
  isWorkSearchHit,
  workSearchPositionMatchesHitPage,
  workSearchSnapshotIdentity,
  workSearchWordPosition,
  type WorkSearchOptionsState
} from "../../app/lib/reader/work-search"

const initial: WorkSearchOptionsState = {
  lemma: false,
  olderSpellings: true,
  prefix: false,
  suffix: false
}

describe("reader and editor work-search options", () => {
  test("restores only the same work media phrase and options from its own history entry", () => {
    const state = { query: " doktor glas ", wordForms: false, includeOlderSpellings: true, prefix: false, suffix: false }
    const identity = workSearchSnapshotIdentity("work-a", "etext", state)
    const historyState = { back: "/old", current: "/reader?bare&repeat=%2f&repeat=%2F", position: 3,
      readerSearchSnapshot: { identity, snapshot: "gen-A" } }
    expect(restoredWorkSearchSnapshot(historyState, identity)).toBe("gen-A")
    expect(restoredWorkSearchSnapshot({}, identity)).toBeNull()
    for (const other of [
      workSearchSnapshotIdentity("work-b", "etext", state),
      workSearchSnapshotIdentity("work-a", "faksimil", state),
      workSearchSnapshotIdentity("work-a", "etext", { ...state, query: "doktor glas" }),
      workSearchSnapshotIdentity("work-a", "etext", { ...state, prefix: true })
    ]) expect(restoredWorkSearchSnapshot(historyState, other)).toBeNull()
    expect(restoredWorkSearchSnapshot({ readerSearchSnapshot: { identity, snapshot: "gen.tmp" } }, identity)).toBeNull()
  })

  test("adoption preserves router state and raw location without rewriting the entry URL", () => {
    const existing = { back: "/old", current: "/reader?bare&repeat=%2f&repeat=%2F", forward: null, position: 3, scroll: { left: 0, top: 40 } }
    const calls: unknown[][] = []
    const history = { state: existing, replaceState: (...args: unknown[]) => { calls.push(args) } } as unknown as History
    rememberWorkSearchSnapshot(history, "work-session", "gen-A")
    expect(calls).toEqual([[{ ...existing, readerSearchSnapshot: { identity: "work-session", snapshot: "gen-A" } }, ""]])
  })

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

  test("preserves the raw page identity while parsing bounded word positions", () => {
    expect(workSearchWordPosition("w01_4", "lb-work")).toEqual({
      scope: "page:01",
      ordinal: 4,
      pageIndex: 1
    })
    expect(workSearchWordPosition("lb-work_7", "lb-work")).toEqual({
      scope: "work:lb-work",
      ordinal: 7,
      pageIndex: null
    })
    expect(workSearchWordPosition("missing", "lb-work")).toBeNull()
  })

  test("keeps facsimile word scope independent of physical and printed page identity", () => {
    const facsimile = workSearchWordPosition("w40_263", "lb-work")
    const conventional = workSearchWordPosition("w75_189", "lb-work")
    const etext = workSearchWordPosition("w40_263", "lb-work")

    expect(facsimile).toEqual({ scope: "page:40", ordinal: 263, pageIndex: 40 })
    expect(conventional).toEqual({ scope: "page:75", ordinal: 189, pageIndex: 75 })
    expect(facsimile && workSearchPositionMatchesHitPage(facsimile, 40, "faksimil")).toBe(true)
    expect(conventional && workSearchPositionMatchesHitPage(conventional, 74, "faksimil")).toBe(true)
    expect(etext && workSearchPositionMatchesHitPage(etext, 17, "etext")).toBe(false)
    expect(workSearchPositionMatchesHitPage(
      workSearchWordPosition("w01_4", "lb-work")!, 1, "etext"
    )).toBe(false)
  })

  test("validates raw source coordinates without applying Reader page maps to unavailable hits", () => {
    expect(isWorkSearchHit({
      index: 1, source_identity: "lb1:faksimil:0", source_start: 9, source_end: 10,
      start_word_id: "w119_1", end_word_id: "w119_1", page_index: 119,
      page_name: null, reader_target_status: "unmapped_page", highlight: null
    }, "lb1", "faksimil")).toBe(true)
  })

})
