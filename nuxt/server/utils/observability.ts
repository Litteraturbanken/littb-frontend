import { randomBytes, randomUUID } from "node:crypto"

import {
  getHeader,
  setResponseHeader,
  type H3Event,
  type RouteNode
} from "h3"

import type { components } from "../../app/lib/api/generated/lbapi"
import { issueCorrelationToken } from "./observability-correlation"

type RequestCompletedEvent
  = components["schemas"]["RequestCompletedEvent"]
type RequestFailedEvent = components["schemas"]["RequestFailedEvent"]

export type ObservabilityRequestEvent
  = RequestCompletedEvent | RequestFailedEvent

export interface ObservabilityContext {
  requestId: string
  traceId: string
  spanId: string
  traceparent: string
}

export interface RequestObservabilityOptions {
  environment: string
  deploymentGitSha: string
  emit?: (event: ObservabilityRequestEvent) => void
  nowNs?: () => bigint
}

interface StoredRequestObservability {
  context: ObservabilityContext
  startedNs: bigint
}

const REQUEST_ID_PATTERN
  = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const TRACEPARENT_PATTERN
  = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/u
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u
const ZERO_GIT_SHA = "0".repeat(40)
const HTTP_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS"
] as const)

type HttpMethod = NonNullable<RequestCompletedEvent["http_method"]>
type EventEnvironment = RequestCompletedEvent["environment"]

function nonZeroHex(bytes: number): string {
  const value = randomBytes(bytes).toString("hex")
  return /^0+$/u.test(value) ? `1${value.slice(1)}` : value
}

export function createObservabilityContext(incoming: {
  requestId?: string
  traceparent?: string
}): ObservabilityContext {
  const requestId = incoming.requestId
    && REQUEST_ID_PATTERN.test(incoming.requestId)
    ? incoming.requestId
    : randomUUID()
  const traceMatch = incoming.traceparent
    ? TRACEPARENT_PATTERN.exec(incoming.traceparent)
    : null
  const suppliedTraceId = traceMatch?.[1]
  const suppliedParentId = traceMatch?.[2]
  const suppliedTraceFlags = traceMatch?.[3]
  const validIncomingTrace = suppliedTraceId
    && suppliedParentId
    && !/^0+$/u.test(suppliedTraceId)
    && !/^0+$/u.test(suppliedParentId)
  const traceId = validIncomingTrace
    ? suppliedTraceId
    : nonZeroHex(16)
  const spanId = nonZeroHex(8)
  const traceFlags = validIncomingTrace && suppliedTraceFlags
    ? (Number.parseInt(suppliedTraceFlags, 16) & 1).toString(16).padStart(2, "0")
    : "01"

  return {
    requestId,
    traceId,
    spanId,
    traceparent: `00-${traceId}-${spanId}-${traceFlags}`
  }
}

function normalizeEnvironment(value: string): EventEnvironment {
  if (value === "stage" || value === "staging") return "stage"
  if (value === "production") return "production"
  return "development"
}

function routeTemplate(event: H3Event): string {
  const matchedRoute = event.context.matchedRoute as RouteNode | undefined
  const route = matchedRoute?.path
  const valid = route
    && route.length <= 300
    && route.startsWith("/")
    && !route.startsWith("//")
    && !route.includes("?")
    && !route.includes("#")
    && [...route].every(character => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint >= 32 && codePoint !== 127
    })
  return valid ? route : "/_unmatched"
}

function requestMethod(event: H3Event): HttpMethod | null {
  const method = event.method.toUpperCase()
  return HTTP_METHODS.has(method as HttpMethod) ? method as HttpMethod : null
}

function emitJsonEvent(event: ObservabilityRequestEvent): void {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}

function buildRequestEvent(
  event: H3Event,
  state: StoredRequestObservability,
  options: RequestObservabilityOptions,
  statusCode: number
): ObservabilityRequestEvent {
  const failed = statusCode >= 400
  const environment = normalizeEnvironment(options.environment)
  const deploymentGitSha = GIT_SHA_PATTERN.test(options.deploymentGitSha)
    ? options.deploymentGitSha
    : ZERO_GIT_SHA
  const durationMs = Number((options.nowNs ?? process.hrtime.bigint)()
    - state.startedNs) / 1_000_000
  const common = {
    schema_version: "lb.observability.v1" as const,
    timestamp: new Date().toISOString(),
    event_id: randomUUID(),
    severity: (statusCode >= 500 ? "error" : failed ? "warning" : "info") as
      ObservabilityRequestEvent["severity"],
    service: "lb-frontend" as const,
    producer: "nuxt-server" as const,
    environment,
    deployment_git_sha: deploymentGitSha,
    request_id: state.context.requestId,
    trace_id: state.context.traceId,
    span_id: state.context.spanId,
    route: routeTemplate(event),
    http_method: requestMethod(event),
    status_code: statusCode,
    duration_ms: Math.max(0, durationMs),
    error_type: null,
    error_fingerprint: null,
    attributes: {}
  }

  if (failed) {
    return {
      ...common,
      event_name: "request.failed",
      event_kind: "request"
    }
  }
  return {
    ...common,
    event_name: "request.completed",
    event_kind: "request"
  }
}

export function requestObservabilityContext(
  event: H3Event
): ObservabilityContext | undefined {
  const state = event.context.observability as
    StoredRequestObservability | undefined
  return state?.context
}

export function correlationHeaders(event: H3Event): Record<string, string> {
  const context = requestObservabilityContext(event)
  return context
    ? {
        "x-request-id": context.requestId,
        traceparent: context.traceparent
      }
    : {}
}

export function initializeRequestObservability(
  event: H3Event,
  options: RequestObservabilityOptions
): ObservabilityContext {
  const existing = requestObservabilityContext(event)
  if (existing) return existing

  const context = createObservabilityContext({
    requestId: getHeader(event, "x-request-id"),
    traceparent: getHeader(event, "traceparent")
  })
  const nowNs = options.nowNs ?? process.hrtime.bigint
  const state: StoredRequestObservability = {
    context,
    startedNs: nowNs()
  }
  event.context.observability = state
  setResponseHeader(event, "x-request-id", context.requestId)
  setResponseHeader(event, "traceparent", context.traceparent)
  setResponseHeader(
    event,
    "x-lb-observability-correlation",
    issueCorrelationToken(context)
  )

  let emitted = false
  const complete = (aborted: boolean): void => {
    if (emitted) return
    emitted = true
    const statusCode = aborted ? 499 : event.node.res.statusCode
    const requestEvent = buildRequestEvent(event, state, options, statusCode)
    try {
      (options.emit ?? emitJsonEvent)(requestEvent)
    } catch {
      // Observability must never affect the response path.
    }
  }
  event.node.res.once("finish", () => complete(false))
  event.node.res.once("close", () => complete(!event.node.res.writableFinished))

  return context
}
