import {
  createCorrelatedLbApiClient,
  normalizeApiRequestCorrelation,
  type ApiRequestCorrelation
} from "../lib/api/client"
import type { ClientOptions } from "openapi-fetch"

interface LbRuntimeConfig {
  apiBase: string
  public: { apiBase: string }
}

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

function createRuntimeLbApiClient(
  config: LbRuntimeConfig,
  event: RequestEventLike | undefined,
  server: boolean,
  customFetch?: ClientOptions["fetch"]
): ReturnType<typeof createCorrelatedLbApiClient> {
  return server
    ? createCorrelatedLbApiClient(
        config.apiBase,
        requestCorrelation(event),
        customFetch
      )
    : createCorrelatedLbApiClient(
        config.public.apiBase,
        undefined,
        customFetch
      )
}

export function useLbApiClient(): ReturnType<typeof createCorrelatedLbApiClient> {
  const config = useRuntimeConfig()
  const event = import.meta.server ? useRequestEvent() : undefined
  return createRuntimeLbApiClient(config, event, import.meta.server)
}
