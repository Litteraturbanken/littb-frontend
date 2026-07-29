import createClient, { type ClientOptions } from "openapi-fetch"

import type { paths } from "./generated/lbapi"

export function createLbApiClient(
  baseUrl: string,
  customFetch?: ClientOptions["fetch"],
  onRequestId?: (requestId: string) => void
) {
  const fetchWithCorrelation = customFetch || onRequestId
    ? async (request: Request): Promise<Response> => {
        const response = await (customFetch ?? globalThis.fetch)(request)
        const requestId = response.headers.get("x-request-id")
        if (requestId) onRequestId?.(requestId)
        return response
      }
    : undefined

  return createClient<paths>({
    baseUrl: baseUrl.replace(/\/$/, ""),
    ...(fetchWithCorrelation ? { fetch: fetchWithCorrelation } : {})
  })
}
