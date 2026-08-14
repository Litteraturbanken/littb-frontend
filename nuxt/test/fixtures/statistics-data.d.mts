import type { components } from "../../app/lib/api/generated/lbapi"

export const stats: components["schemas"]["StatsResponse"]
export const popularWorks: readonly components["schemas"]["PopularWork"][]
export const popularEpubs: readonly components["schemas"]["PopularEpub"][]
export const malformedStatisticsRouteWorks: readonly {
  field: "author" | "title" | "page"
  character: "slash" | "backslash" | "percent"
  item: components["schemas"]["PopularWork"]
}[]
export const malformedStatisticsRouteEpubs: readonly {
  field: "author"
  character: "slash" | "backslash" | "percent"
  item: components["schemas"]["PopularEpub"]
}[]
export const validStatisticsRouteWork: components["schemas"]["PopularWork"]
export const validStatisticsPercentPdf: components["schemas"]["PopularWork"]
export const validStatisticsPercentWorkTitleId: components["schemas"]["PopularWork"]
export const validStatisticsEncodedPdf: components["schemas"]["PopularWork"]
export const validStatisticsNullableWork: components["schemas"]["PopularWork"]
export const validStatisticsPopulatedWork: components["schemas"]["PopularWork"]
export const malformedStatisticsWorkFields: readonly {
  field: "title_id" | "title" | "short_title" | "author.full_name" | "author.surname"
  problem: "missing" | "null" | "wrong-type" | "blank" | "control" | "lone-surrogate" | "dot" | "dot-dot" | "overlong"
  item: Record<string, unknown>
}[]
export const validStatisticsPercentEpub: components["schemas"]["PopularEpub"]
export const validStatisticsEncodedEpub: components["schemas"]["PopularEpub"]
export const malformedStatisticsDownloadWorks: readonly {
  field: "representation.work_id" | "title_id"
  problem: string
  item: components["schemas"]["PopularWork"]
}[]
export const malformedStatisticsDownloadEpubs: readonly {
  field: "title_id"
  problem: string
  item: components["schemas"]["PopularEpub"]
}[]
export const validStatisticsNullableEpub: components["schemas"]["PopularEpub"]
export const validStatisticsPopulatedEpub: components["schemas"]["PopularEpub"]
export const malformedStatisticsEpubFields: readonly {
  field: "title" | "short_title" | "author.full_name" | "author.surname"
  problem: "missing" | "null" | "wrong-type" | "blank" | "overlong"
  item: Record<string, unknown>
}[]
export const legacyWorks: readonly Record<string, unknown>[]
export const legacyEpubs: readonly Record<string, unknown>[]
