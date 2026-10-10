import { expect, test } from "vitest"
import { recoverWorkSearchHit } from "../../app/lib/reader/recover-search"
import type { components } from "../../app/lib/api/generated/lbapi"

type Hit = components["schemas"]["WorkSearchHit"]
function hit(index: number, word = index): Hit {
  return { index, source_identity: "book:faksimil:0", source_start: word, source_end: word + 1,
    start_word_id: `w74_${word}`, end_word_id: `w74_${word}`, page_index: 74, page_name: "75",
    reader_target_status: "exact", highlight: { from_word_id: `w74_${word}`, to_word_id: `w74_${word}` } }
}
const target = { workId: "book", pageIndex: 74, pageName: "75", hitIndex: 0,
  fromWordId: "w74_147", toWordId: "w74_147" }
function fixture(items: Hit[]) {
  const calls: { offset: number, snapshot: string | null }[] = []
  return { calls, request: async (offset: number, limit: number, snapshot: string | null) => {
    calls.push({ offset, snapshot })
    return { query: "kyrka", media_type: "faksimil" as const, offset, limit,
      snapshot: "gen-current", total_hits: items.length, items: items.slice(offset, offset + limit) }
  } }
}

test("recovers an unchanged saved word on a fresh generation", async () => {
  const api = fixture([hit(0, 147), hit(1, 156)])
  expect(await recoverWorkSearchHit(target, api.request)).toEqual({ hit: hit(0, 147), snapshot: "gen-current" })
  expect(api.calls).toEqual([{ offset: 0, snapshot: null }])
})

test("finds the same word when hundreds of preceding hits change its ordinal", async () => {
  const items = Array.from({ length: 1000 }, (_, i) => hit(i))
  const api = fixture(items)
  expect((await recoverWorkSearchHit(target, api.request)).hit).toEqual(items[147])
  expect(api.calls.length).toBeLessThan(12)
  expect(api.calls.slice(1).every(call => call.snapshot === "gen-current")).toBe(true)
})

test("does not substitute a different passage when the saved word disappeared", async () => {
  const api = fixture([hit(0, 146), hit(1, 148)])
  expect((await recoverWorkSearchHit(target, api.request)).hit).toBeNull()
})

test("old links without word anchors stay on their saved page", async () => {
  const items = [hit(0, 147), hit(1, 156)]
  const api = fixture(items)
  expect((await recoverWorkSearchHit({ workId: "book", pageIndex: 74, pageName: "75", hitIndex: 1 }, api.request)).hit).toEqual(items[1])
})
