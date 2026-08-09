import createClient, { type ClientOptions } from "openapi-fetch"

import type { paths } from "./generated/lbapi"

const CORRELATION_ID_PATTERN
  = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const TRACEPARENT_PATTERN
  = /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u

export interface ApiFailureCorrelation {
  correlationToken: string | null
  errorType: "ApiNetworkError" | "ApiResponseError"
}

export interface ApiRequestCorrelation {
  requestId: string
  traceparent: string
}

export function normalizeApiRequestCorrelation(
  value: unknown
): ApiRequestCorrelation | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined
  }
  const { requestId, traceparent } = value as Record<string, unknown>
  return typeof requestId === "string"
    && CORRELATION_ID_PATTERN.test(requestId)
    && typeof traceparent === "string"
    && TRACEPARENT_PATTERN.test(traceparent)
    ? { requestId, traceparent }
    : undefined
}

let apiFailureObserver:
  ((failure: ApiFailureCorrelation) => void) | undefined

export function observeApiFailures(
  observer: (failure: ApiFailureCorrelation) => void
): () => void {
  apiFailureObserver = observer
  return () => {
    if (apiFailureObserver === observer) apiFailureObserver = undefined
  }
}

function reportApiFailure(failure: ApiFailureCorrelation): void {
  try {
    apiFailureObserver?.(failure)
  } catch {
    // Error reporting must never alter an API request.
  }
}

export function createLbApiClient(
  baseUrl: string,
  customFetch?: ClientOptions["fetch"],
  onRequestId?: (requestId: string) => void
) {
  const fetchWithCorrelation = async (request: Request): Promise<Response> => {
    let response: Response
    try {
      response = await (customFetch ?? globalThis.fetch)(request)
    } catch (error) {
      reportApiFailure({
        correlationToken: null,
        errorType: "ApiNetworkError"
      })
      throw error
    }
    const requestId = response.headers.get("x-request-id")
    if (requestId) onRequestId?.(requestId)
    if (response.status >= 500) {
      const candidate = response.headers.get("x-lb-observability-correlation")
      reportApiFailure({
        correlationToken: candidate && CORRELATION_ID_PATTERN.test(candidate)
          ? candidate
          : null,
        errorType: "ApiResponseError"
      })
    }
    return response
  }

  return createClient<paths>({
    baseUrl: baseUrl.replace(/\/$/, ""),
    fetch: fetchWithCorrelation
  })
}

export function createCorrelatedLbApiClient(
  baseUrl: string,
  correlation: ApiRequestCorrelation | undefined,
  customFetch?: ClientOptions["fetch"]
): ReturnType<typeof createLbApiClient> {
  if (!correlation) return createLbApiClient(baseUrl, customFetch)

  const fetchWithRequestCorrelation = (request: Request): Promise<Response> => {
    request.headers.set("x-request-id", correlation.requestId)
    request.headers.set("traceparent", correlation.traceparent)
    return (customFetch ?? globalThis.fetch)(request)
  }
  return createLbApiClient(baseUrl, fetchWithRequestCorrelation)
}
