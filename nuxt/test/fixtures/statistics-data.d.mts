import type { components } from "../../app/lib/api/generated/lbapi"

export const stats: components["schemas"]["StatsResponse"]
export const popularWorks: readonly components["schemas"]["PopularWork"][]
export const popularEpubs: readonly components["schemas"]["PopularEpub"][]
export const legacyWorks: readonly Record<string, unknown>[]
export const legacyEpubs: readonly Record<string, unknown>[]
