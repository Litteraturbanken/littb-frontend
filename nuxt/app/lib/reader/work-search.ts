import { isTextSearchSnapshot } from "../text-search"
import type { components } from "../api/generated/lbapi"
import { isExactWorkSearchHit, isReaderTargetStatus } from "../reader-target"

type WorkSearchHit = components["schemas"]["WorkSearchHit"]

type SnapshotSearch = Readonly<{
  query: string
  wordForms: boolean
  includeOlderSpellings: boolean
  prefix: boolean
  suffix: boolean
}>

export function workSearchSnapshotIdentity(
  workId: string,
  mediaType: string,
  state: SnapshotSearch
): string {
  return JSON.stringify([workId, mediaType, state.query, state.wordForms,
    state.includeOlderSpellings, state.prefix, state.suffix])
}

export function restoredWorkSearchSnapshot(historyState: unknown, identity: string): string | null {
  if (!historyState || typeof historyState !== "object") return null
  const saved = (historyState as Record<string, unknown>).readerSearchSnapshot
  if (!saved || typeof saved !== "object") return null
  const { identity: savedIdentity, snapshot } = saved as Record<string, unknown>
  return savedIdentity === identity && isTextSearchSnapshot(snapshot) ? snapshot : null
}

export function rememberWorkSearchSnapshot(history: History, identity: string, snapshot: string): void {
  if (restoredWorkSearchSnapshot(history.state, identity) === snapshot) return
  // Store adoption on this entry, without rewriting its raw URL. A different
  // phrase/work/options identity cannot inherit it on an explicit new search.
  history.replaceState({ ...history.state, readerSearchSnapshot: { identity, snapshot } }, "")
}

export type WorkSearchOption =
  | "default"
  | "lemma"
  | "modernize"
  | "prefix"
  | "suffix"
  | "infix"

export type WorkSearchOptionsState = Readonly<{
  lemma: boolean
  olderSpellings: boolean
  prefix: boolean
  suffix: boolean
}>

export type WorkSearchWordPosition = Readonly<{
  scope: string
  ordinal: number
  pageIndex: number | null
}>

const pageWordIdPattern = /^w(?<page>[0-9]+)_(?<ordinal>[0-9]+)$/

export function workSearchWordPosition(
  value: string,
  workId: string
): WorkSearchWordPosition | null {
  const pageMatch = pageWordIdPattern.exec(value)
  if (pageMatch?.groups) {
    const pageIndex = Number(pageMatch.groups.page)
    const ordinal = Number(pageMatch.groups.ordinal)
    return Number.isSafeInteger(pageIndex) && Number.isSafeInteger(ordinal)
      ? { scope: `page:${pageMatch.groups.page}`, ordinal, pageIndex }
      : null
  }

  const prefix = `${workId}_`
  if (!workId || !value.startsWith(prefix)) return null
  const rawOrdinal = value.slice(prefix.length)
  if (!/^[0-9]+$/.test(rawOrdinal)) return null
  const ordinal = Number(rawOrdinal)
  return Number.isSafeInteger(ordinal)
    ? { scope: `work:${workId}`, ordinal, pageIndex: null }
    : null
}

export function workSearchPositionMatchesHitPage(
  position: WorkSearchWordPosition,
  pageIndex: number,
  mediaType: "etext" | "faksimil"
): boolean {
  return position.pageIndex === null || mediaType === "faksimil" || position.scope === `page:${pageIndex}`
}

function isRawSourceString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

export function isWorkSearchHit(
  value: unknown,
  workId: string,
  mediaType: "etext" | "faksimil"
): value is WorkSearchHit {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const hit = value as Record<string, unknown>
  if (!Number.isSafeInteger(hit.index) || (hit.index as number) < 0 ||
    !isRawSourceString(hit.source_identity) ||
    !Number.isSafeInteger(hit.source_start) || !Number.isSafeInteger(hit.source_end) ||
    (hit.source_start as number) < 0 || (hit.source_end as number) <= (hit.source_start as number) ||
    !isRawSourceString(hit.start_word_id) || !isRawSourceString(hit.end_word_id) ||
    !Number.isSafeInteger(hit.page_index) || (hit.page_index as number) < 0 ||
    !isReaderTargetStatus(hit.reader_target_status)) return false
  if ((hit.page_name === null) !== (hit.reader_target_status === "unmapped_page")) return false
  if (hit.page_name !== null && !isRawSourceString(hit.page_name)) return false
  const candidate = hit as unknown as WorkSearchHit
  if (isExactWorkSearchHit(candidate)) {
    if (candidate.highlight.from_word_id !== candidate.start_word_id ||
      candidate.highlight.to_word_id !== candidate.end_word_id) return false
    const from = workSearchWordPosition(candidate.start_word_id, workId)
    const to = workSearchWordPosition(candidate.end_word_id, workId)
    return Boolean(from && to && from.scope === to.scope && from.ordinal <= to.ordinal &&
      workSearchPositionMatchesHitPage(from, candidate.page_index, mediaType) &&
      workSearchPositionMatchesHitPage(to, candidate.page_index, mediaType))
  }
  return candidate.highlight === null
}

const clearedOptions: WorkSearchOptionsState = {
  lemma: false,
  olderSpellings: false,
  prefix: false,
  suffix: false
}

export function nextWorkSearchOptions(
  current: WorkSearchOptionsState,
  option: WorkSearchOption
): WorkSearchOptionsState {
  if (option === "default") return clearedOptions
  if (option === "lemma") return { ...clearedOptions, lemma: true }
  if (option === "modernize") {
    return current.olderSpellings
      ? clearedOptions
      : { ...clearedOptions, olderSpellings: true }
  }
  if (option === "infix") {
    return { ...clearedOptions, prefix: true, suffix: true }
  }
  return {
    ...clearedOptions,
    prefix: option === "prefix" ? !current.prefix : false,
    suffix: option === "suffix" ? !current.suffix : false
  }
}

export function decodedWorkSearchQueryKey(segment: string): string | null {
  const separator = segment.indexOf("=")
  const rawKey = separator < 0 ? segment : segment.slice(0, separator)
  try {
    return decodeURIComponent(rawKey.replace(/\+/g, " "))
  } catch {
    return null
  }
}

export function replaceWorkSearchQuerySegments(
  segments: readonly string[],
  keysToRemove: ReadonlySet<string>,
  replacements: ReadonlyMap<string, string | null>
): string[] {
  const replaced = new Set<string>()
  const next = segments.flatMap(segment => {
    const key = decodedWorkSearchQueryKey(segment)
    if (key === null) return [segment]

    if (replacements.has(key)) {
      const value = replacements.get(key) ?? null
      replaced.add(key)
      return [value === null ? encodeURIComponent(key) : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`]
    }
    return keysToRemove.has(key) ? [] : [segment]
  })

  for (const [key, value] of replacements) {
    if (!replaced.has(key)) {
      next.push(value === null ? encodeURIComponent(key) : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  }
  return next
}

export function workSearchHitAt<THit extends { index: number }>(
  hits: readonly THit[],
  index: number
): THit | null {
  return hits.find(hit => hit.index === index) ?? null
}
