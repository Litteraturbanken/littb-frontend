import type { components } from "../../app/lib/api/generated/lbapi"

export const quickSearchVisualQuery: string
export const quickSearchTypedResponse: components["schemas"]["QuickSearchResponse"]
export const angularQuickSearchResponse: Readonly<{
  data: readonly Record<string, unknown>[]
  suggest: readonly unknown[]
}>
