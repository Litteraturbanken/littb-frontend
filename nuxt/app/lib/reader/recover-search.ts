import type { components } from "../api/generated/lbapi"
import { workSearchWordPosition } from "./work-search"

type Hit = components["schemas"]["WorkSearchHit"]
type Response = components["schemas"]["WorkSearchHitsResponse"]
export type SavedSearchTarget = Readonly<{
  workId: string
  pageIndex: number
  pageName: string
  hitIndex: number
  fromWordId?: string
  toWordId?: string
}>

function matches(hit: Hit, target: SavedSearchTarget): boolean {
  return hit.page_index === target.pageIndex && hit.page_name === target.pageName
    && (!target.fromWordId || (hit.start_word_id === target.fromWordId
      && hit.end_word_id === target.toWordId))
}

/** Re-find the passage, never assume that an old ordinal still means the same hit. */
export async function recoverWorkSearchHit(
  target: SavedSearchTarget,
  request: (offset: number, limit: number, snapshot: string | null) => Promise<Response>
): Promise<{ hit: Hit | null, snapshot: string }> {
  const initial = await request(Math.max(target.hitIndex - 1, 0), 3, null)
  const nearby = initial.items.find(hit => hit.index === target.hitIndex && matches(hit, target))
    ?? initial.items.find(hit => matches(hit, target))
  if (nearby) return { hit: nearby, snapshot: initial.snapshot }

  // Work hits are in reading order. Locate the saved page/word without loading
  // every occurrence in a large book. Every probe uses the newly adopted snapshot.
  const position = target.fromWordId ? workSearchWordPosition(target.fromWordId, target.workId) : null
  let lower = 0
  let upper = Math.min(initial.total_hits, 1_000_001)
  while (lower < upper) {
    const offset = Math.floor((lower + upper) / 2)
    const response = await request(offset, 1, initial.snapshot)
    if (response.total_hits !== initial.total_hits) throw new Error("Search changed within snapshot")
    const hit = response.items[0]
    if (!hit) throw new Error("Missing search probe")
    if (matches(hit, target)) return { hit, snapshot: initial.snapshot }
    const hitPosition = workSearchWordPosition(hit.start_word_id, target.workId)
    const before = hit.page_index < target.pageIndex || (hit.page_index === target.pageIndex
      && position && hitPosition && hitPosition.scope === position.scope
      && hitPosition.ordinal < position.ordinal)
    if (before) lower = offset + 1
    else upper = offset
  }
  return { hit: null, snapshot: initial.snapshot }
}
