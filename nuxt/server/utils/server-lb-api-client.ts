import type { H3Event } from "h3"
import type { ClientOptions } from "openapi-fetch"

import { createLbApiClient } from "../../app/lib/api/client"
import { correlationHeaders } from "./observability"

type ApiFetch = NonNullable<ClientOptions["fetch"]>
export type ServerLbApiClient = ReturnType<typeof createLbApiClient>

export function createServerLbApiClient(
  event: H3Event,
  customFetch?: ApiFetch
): ServerLbApiClient {
  const fetchWithCorrelation: ApiFetch = request => {
    const headers = event.context ? correlationHeaders(event) : {}
    for (const [name, value] of Object.entries(headers)) {
      request.headers.set(name, value)
    }
    return (customFetch ?? globalThis.fetch)(request)
  }

  return createLbApiClient(useRuntimeConfig(event).apiBase, fetchWithCorrelation)
}
