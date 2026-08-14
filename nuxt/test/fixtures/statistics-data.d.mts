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
export const validStatisticsPercentEpub: components["schemas"]["PopularEpub"]
export const validStatisticsNullableEpub: components["schemas"]["PopularEpub"]
export const validStatisticsPopulatedEpub: components["schemas"]["PopularEpub"]
export const malformedStatisticsEpubFields: readonly {
  field: "title" | "short_title" | "author.full_name" | "author.surname"
  problem: "missing" | "null" | "wrong-type" | "blank" | "overlong"
  item: Record<string, unknown>
}[]
export const legacyWorks: readonly Record<string, unknown>[]
export const legacyEpubs: readonly Record<string, unknown>[]
