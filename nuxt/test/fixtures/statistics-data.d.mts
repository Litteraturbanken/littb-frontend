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
export const legacyWorks: readonly Record<string, unknown>[]
export const legacyEpubs: readonly Record<string, unknown>[]
