import type { components } from "./api/generated/lbapi"

type WorkSearchHit = components["schemas"]["WorkSearchHit"]
type ReaderTargetStatus = components["schemas"]["ReaderTargetStatus"]

export type ExactWorkSearchHit = WorkSearchHit & {
  reader_target_status: "exact"
  page_name: string
  highlight: NonNullable<WorkSearchHit["highlight"]>
}

const statuses = new Set<ReaderTargetStatus>([
  "exact",
  "unmapped_page",
  "ambiguous_word_id",
  "unsupported_reader_identity"
])

export const readerTargetUnavailableMessage = "Träffen kan inte öppnas exakt i läsaren."

export function isReaderTargetStatus(value: unknown): value is ReaderTargetStatus {
  return typeof value === "string" && statuses.has(value as ReaderTargetStatus)
}

export function isExactWorkSearchHit(hit: WorkSearchHit): hit is ExactWorkSearchHit {
  return hit.reader_target_status === "exact" && typeof hit.page_name === "string"
    && hit.highlight !== null
}
