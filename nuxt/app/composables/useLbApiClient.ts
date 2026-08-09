import {
  createCorrelatedLbApiClient,
  normalizeApiRequestCorrelation,
  type ApiRequestCorrelation
} from "../lib/api/client"

interface RequestEventLike {
  context: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requestCorrelation(
  event: RequestEventLike | undefined
): ApiRequestCorrelation | undefined {
  const stored = event?.context.observability
  if (!isRecord(stored) || !isRecord(stored.context)) return undefined
  return normalizeApiRequestCorrelation(stored.context)
}

export function useLbApiClient(): ReturnType<typeof createCorrelatedLbApiClient> {
  if (!import.meta.server) {
    return createCorrelatedLbApiClient(
      useRuntimeConfig().public.apiBase,
      undefined
    )
  }
  return createCorrelatedLbApiClient(
    useRuntimeConfig().apiBase,
    requestCorrelation(useRequestEvent())
  )
}
