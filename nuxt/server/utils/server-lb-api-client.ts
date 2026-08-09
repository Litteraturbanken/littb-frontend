import type { H3Event } from "h3"
import type { ClientOptions } from "openapi-fetch"

import {
  createCorrelatedLbApiClient,
  normalizeApiRequestCorrelation,
  type createLbApiClient
} from "../../app/lib/api/client"
import { correlationHeaders } from "./observability"

type ApiFetch = NonNullable<ClientOptions["fetch"]>
export type ServerLbApiClient = ReturnType<typeof createLbApiClient>

export function createServerLbApiClient(
  event: H3Event,
  customFetch?: ApiFetch
): ServerLbApiClient {
  const headers = event.context ? correlationHeaders(event) : {}
  const correlation = normalizeApiRequestCorrelation({
    requestId: headers["x-request-id"],
    traceparent: headers.traceparent
  })
  return createCorrelatedLbApiClient(
    useRuntimeConfig(event).apiBase,
    correlation,
    customFetch
  )
}
