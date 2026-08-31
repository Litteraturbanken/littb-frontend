import { describe, expect, test } from "vitest"

import {
  isExactWorkSearchHit,
  isReaderTargetStatus,
  readerTargetUnavailableMessage
} from "../../app/lib/reader-target"
import { isWorkSearchHit } from "../../app/lib/reader/work-search"

describe("Reader source-quality targets", () => {
  test("keeps an unmapped occurrence as valid raw search data without a highlight", () => {
    const hit = {
      index: 1,
      source_identity: "lb10435130:faksimil:0",
      source_start: 100,
      source_end: 101,
      start_word_id: "w119_1",
      end_word_id: "w119_1",
      page_index: 119,
      page_name: null,
      reader_target_status: "unmapped_page" as const,
      highlight: null
    }
    expect(isWorkSearchHit(hit, "lb10435130", "faksimil")).toBe(true)
    expect(isExactWorkSearchHit(hit)).toBe(false)
  })

  test("recognizes the closed public status set and exposes the unavailable copy", () => {
    expect(isReaderTargetStatus("ambiguous_word_id")).toBe(true)
    expect(isReaderTargetStatus("future-status")).toBe(false)
    expect(readerTargetUnavailableMessage).toBe("Träffen kan inte öppnas exakt i läsaren.")
  })

  test.each([
    ["exact without highlight", { reader_target_status: "exact", highlight: null }],
    ["unexpected hit field", { extra: true }],
    ["one-token unequal endpoints", { start_word_id: "w1_1", end_word_id: "w1_2" }],
    ["numeric alias endpoints", { start_word_id: "w1_01", end_word_id: "w1_1", source_end: 2 }]
  ])("rejects malformed %s without throwing", (_label, change) => {
    const hit = {
      index: 0, source_identity: "lb1:etext:0", source_start: 0, source_end: 1,
      start_word_id: "w1_1", end_word_id: "w1_1", page_index: 1, page_name: "1",
      reader_target_status: "exact", highlight: { from_word_id: "w1_1", to_word_id: "w1_1" },
      ...change
    }
    expect(() => isWorkSearchHit(hit, "lb1", "etext")).not.toThrow()
    expect(isWorkSearchHit(hit, "lb1", "etext")).toBe(false)
  })

  test("rejects an exact hit with a missing highlight field without throwing", () => {
    const hit: Record<string, unknown> = {
      index: 0, source_identity: "lb1:etext:0", source_start: 0, source_end: 1,
      start_word_id: "w1_1", end_word_id: "w1_1", page_index: 1, page_name: "1",
      reader_target_status: "exact", highlight: { from_word_id: "w1_1", to_word_id: "w1_1" }
    }
    delete hit.highlight

    expect(() => isWorkSearchHit(hit, "lb1", "etext")).not.toThrow()
    expect(isWorkSearchHit(hit, "lb1", "etext")).toBe(false)
  })
})
