import type { components, paths } from "../../app/lib/api/generated/lbapi"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T

type Request = components["schemas"]["TextSearchResultsRequest"]
type Response = components["schemas"]["TextSearchResponse"]
type ReaderResponse = components["schemas"]["WorkSearchHitsResponse"]

const request: Request = {
  query: "hus", page: 2, page_size: 30, highlight_limit: 5,
  prefix: false, suffix: false, word_form_only: true,
  include_modernized: true, snapshot: "gen-0123456789abcdef"
}
const work: components["schemas"]["TextSearchWork"] = {
  lbworkid: "lb1", author_id: "A", author_name: "A",
  title: "Hus", title_id: "Hus", mediatype: "etext",
  occurrence_count: 1,
  highlights: [{
    left_context: [], match: [{ word: "hus", page_name: "1", word_id: "lb1_1" }], right_context: [],
    source_identity: "lb1:etext:0", source_start: 0, source_end: 1,
    page_index: 1, reader_target_status: "exact"
  }],
  has_more_highlights: false
}
const response: Response = {
  query: "hus", page: 1, page_size: 30,
  snapshot: "gen-0123456789abcdef",
  totals: { occurrences: 1, documents: 1, works: 1 },
  author_facets: [], works: [work]
}
declare const readerResponse: ReaderResponse
type CountRouteIsAbsent = Assert<Equal<Extract<"/text-search/count", keyof paths>, never>>
declare const countRouteIsAbsent: CountRouteIsAbsent
const readerSnapshot: string = readerResponse.snapshot
void request
void response
void readerSnapshot
void countRouteIsAbsent
