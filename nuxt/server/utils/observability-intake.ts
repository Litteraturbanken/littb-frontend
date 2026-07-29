import { createHash, createHmac, randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"

import {
  createError,
  getHeader,
  getRequestHost,
  getRequestIP,
  getRequestProtocol,
  readRawBody,
  setResponseStatus,
  type H3Event
} from "h3"

import type {
  BrowserEvent,
  BrowserEventName,
  EventEnvironment
} from "../../app/lib/observability/events"
import { resolveCorrelationToken } from "./observability-correlation"
import { correlationHeaders } from "./observability"

const MAX_BODY_BYTES = 16 * 1024
const MAX_BATCH_EVENTS = 10
const MIN_SECRET_BYTES = 32
const MAX_SECRET_BYTES = 4_096
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 60
const REPLAY_WINDOW_MS = 5 * 60_000
const MAX_CLIENTS = 10_000
const MAX_EVENT_IDS = 20_000
const EVENT_ID_PATTERN
  = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u
const ZERO_GIT_SHA = "0".repeat(40)
const BROWSER_EVENT_NAMES = new Set<BrowserEventName>([
  "browser.error",
  "browser.unhandled_rejection",
  "browser.chunk_error"
])
const BROWSER_ERROR_TYPES = new Set([
  "ApiNetworkError",
  "ApiResponseError",
  "ChunkLoadError",
  "Error",
  "NullRejection",
  "OtherError",
  "RangeError",
  "ReferenceError",
  "StringRejection",
  "SyntaxError",
  "TypeError",
  "URIError",
  "UnknownError"
])
const RESOURCE_KINDS = new Set([
  "document",
  "script",
  "style",
  "image",
  "unknown"
] as const)

export interface ObservabilityIntakeConfig {
  apiBase: string
  allowedOrigins: string
  deploymentEnvironment: string
  deploymentGitSha: string
  hmacSecret: string
  hmacSecretFile: string
}

interface BrowserIntakeEvent {
  event_id: string
  event_name: BrowserEventName
  error_type: string
  resource_kind: NonNullable<BrowserEvent["attributes"]["resource_kind"]>
  correlation_token: string | null
}

interface BrowserIntakeBatch {
  events: BrowserIntakeEvent[]
}

interface RateEntry {
  startedAt: number
  count: number
}

export class ObservabilityIntakeGuard {
  readonly #clients = new Map<string, RateEntry>()
  readonly #eventIds = new Map<string, number>()

  enforceRate(clientKey: string, now = Date.now()): void {
    for (const [key, entry] of this.#clients) {
      if (now - entry.startedAt >= RATE_WINDOW_MS) this.#clients.delete(key)
    }
    const current = this.#clients.get(clientKey)
    if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
      this.#clients.set(clientKey, { startedAt: now, count: 1 })
    } else {
      current.count += 1
      if (current.count > RATE_LIMIT) {
        throw createError({ statusCode: 429, statusMessage: "Rate limit exceeded" })
      }
    }
    while (this.#clients.size > MAX_CLIENTS) {
      const oldest = this.#clients.keys().next().value
      if (oldest === undefined) break
      this.#clients.delete(oldest)
    }
  }

  reserveNewEvents<T extends { event_id: string }>(
    events: T[],
    now = Date.now()
  ): T[] {
    for (const [eventId, acceptedAt] of this.#eventIds) {
      if (now - acceptedAt >= REPLAY_WINDOW_MS) this.#eventIds.delete(eventId)
    }
    const unseen: T[] = []
    const batchIds = new Set<string>()
    for (const event of events) {
      if (batchIds.has(event.event_id)) {
        throw createError({ statusCode: 422, statusMessage: "Duplicate event ID" })
      }
      batchIds.add(event.event_id)
      if (!this.#eventIds.has(event.event_id)) unseen.push(event)
    }
    for (const event of unseen) this.#eventIds.set(event.event_id, now)
    while (this.#eventIds.size > MAX_EVENT_IDS) {
      const oldest = this.#eventIds.keys().next().value
      if (oldest === undefined) break
      this.#eventIds.delete(oldest)
    }
    return unseen
  }

  release(eventIds: string[]): void {
    for (const eventId of eventIds) this.#eventIds.delete(eventId)
  }
}

const intakeGuard = new ObservabilityIntakeGuard()

function validateOrigin(event: H3Event, allowedOrigins: string): void {
  const origin = getHeader(event, "origin")
  const expected = `${getRequestProtocol(event, { xForwardedProto: true })}://${getRequestHost(event, { xForwardedHost: false })}`
  let normalized: string | undefined
  try {
    normalized = origin ? new URL(origin).origin : undefined
  } catch {
    normalized = undefined
  }
  const configured = allowedOrigins
    .split(",")
    .slice(0, 10)
    .map(value => value.trim())
    .filter(value => value.length > 0 && value.length <= 300)
    .flatMap(value => {
      try {
        return [new URL(value).origin]
      } catch {
        return []
      }
    })
  if (!normalized || (normalized !== expected && !configured.includes(normalized))) {
    throw createError({ statusCode: 403, statusMessage: "Same origin required" })
  }
}

function isBrowserIntakeEvent(value: unknown): value is BrowserIntakeEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const event = value as Record<string, unknown>
  return Object.keys(event).length === 5
    && Object.hasOwn(event, "event_id")
    && typeof event.event_id === "string"
    && EVENT_ID_PATTERN.test(event.event_id)
    && typeof event.event_name === "string"
    && BROWSER_EVENT_NAMES.has(event.event_name as BrowserEventName)
    && typeof event.error_type === "string"
    && BROWSER_ERROR_TYPES.has(event.error_type)
    && typeof event.resource_kind === "string"
    && RESOURCE_KINDS.has(
      event.resource_kind as NonNullable<
        BrowserEvent["attributes"]["resource_kind"]
      >
    )
    && (event.correlation_token === null
      || (typeof event.correlation_token === "string"
        && EVENT_ID_PATTERN.test(event.correlation_token)))
}

function parseBatch(body: Buffer): BrowserIntakeBatch {
  let value: unknown
  try {
    value = JSON.parse(body.toString("utf8"))
  } catch {
    throw createError({ statusCode: 422, statusMessage: "Invalid event batch" })
  }
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.keys(value).length !== 1
    || !("events" in value)
    || !Array.isArray(value.events)
    || value.events.length < 1
    || value.events.length > MAX_BATCH_EVENTS
    || value.events.some(event => !isBrowserIntakeEvent(event))
  ) {
    throw createError({ statusCode: 422, statusMessage: "Invalid event batch" })
  }
  return value as BrowserIntakeBatch
}

function normalizeEnvironment(value: string): EventEnvironment {
  if (value === "stage" || value === "staging") return "stage"
  if (value === "production") return "production"
  return "development"
}

function nonZeroSpanId(): string {
  const value = randomBytes(8).toString("hex")
  return /^0+$/u.test(value) ? `1${value.slice(1)}` : value
}

function trustedBrowserEvent(
  event: BrowserIntakeEvent,
  config: ObservabilityIntakeConfig,
  now: number,
  resolveCorrelation: typeof resolveCorrelationToken
): BrowserEvent {
  const correlation = resolveCorrelation(event.correlation_token, now)
  const fingerprint = createHash("sha256")
    .update(event.event_name)
    .update("\n")
    .update(event.error_type)
    .update("\n")
    .update(event.resource_kind)
    .digest("hex")
  const common = {
    schema_version: "lb.observability.v1" as const,
    timestamp: new Date(now).toISOString(),
    event_id: event.event_id,
    event_kind: "error" as const,
    severity: "error" as const,
    service: "lb-frontend" as const,
    producer: "browser" as const,
    environment: normalizeEnvironment(config.deploymentEnvironment),
    deployment_git_sha: GIT_SHA_PATTERN.test(config.deploymentGitSha)
      ? config.deploymentGitSha
      : ZERO_GIT_SHA,
    request_id: correlation?.requestId ?? null,
    trace_id: correlation?.traceId ?? null,
    span_id: correlation ? nonZeroSpanId() : null,
    route: null,
    http_method: null,
    status_code: null,
    duration_ms: null,
    error_type: event.error_type,
    error_fingerprint: fingerprint,
    attributes: {
      component: null,
      resource_kind: event.resource_kind
    }
  }
  return { ...common, event_name: event.event_name } as BrowserEvent
}

async function readSecret(config: ObservabilityIntakeConfig): Promise<Buffer> {
  let secret: Buffer
  try {
    secret = config.hmacSecretFile
      ? Buffer.from((await readFile(config.hmacSecretFile)).toString().trim())
      : Buffer.from(config.hmacSecret)
  } catch {
    throw createError({ statusCode: 503, statusMessage: "Event intake unavailable" })
  }
  if (secret.length < MIN_SECRET_BYTES || secret.length > MAX_SECRET_BYTES) {
    throw createError({ statusCode: 503, statusMessage: "Event intake unavailable" })
  }
  return secret
}

function clientKey(event: H3Event): string {
  const address = getRequestIP(event, { xForwardedFor: true }) ?? "unknown"
  return createHash("sha256").update(address).digest("hex")
}

export async function handleObservabilityIntake(
  event: H3Event,
  config: ObservabilityIntakeConfig,
  options: {
    guard?: ObservabilityIntakeGuard
    fetch?: typeof globalThis.fetch
    now?: () => number
    resolveCorrelation?: typeof resolveCorrelationToken
  } = {}
): Promise<{ accepted: number }> {
  const contentType = getHeader(event, "content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase()
  if (contentType !== "application/json") {
    throw createError({ statusCode: 415, statusMessage: "JSON content type required" })
  }
  validateOrigin(event, config.allowedOrigins)
  const declaredLength = Number(getHeader(event, "content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "Event batch too large" })
  }
  const body = await readRawBody(event, false) ?? Buffer.alloc(0)
  if (body.byteLength > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "Event batch too large" })
  }
  const batch = parseBatch(body)
  const guard = options.guard ?? intakeGuard
  const now = (options.now ?? Date.now)()
  guard.enforceRate(clientKey(event), now)
  const intakeEvents = guard.reserveNewEvents(batch.events, now)
  if (intakeEvents.length === 0) {
    setResponseStatus(event, 202)
    return { accepted: 0 }
  }

  const events = intakeEvents.map(item => trustedBrowserEvent(
    item,
    config,
    now,
    options.resolveCorrelation ?? resolveCorrelationToken
  ))
  const forwardedBody = Buffer.from(JSON.stringify({ events }))
  const timestamp = String(Math.floor(now / 1_000))
  const secret = await readSecret(config)
  const signature = `sha256=${createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(forwardedBody)
    .digest("hex")}`
  const target = `${config.apiBase.replace(/\/$/u, "")}/internal/observability/events`
  let response: Response
  try {
    response = await (options.fetch ?? globalThis.fetch)(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lb-observability-timestamp": timestamp,
        "x-lb-observability-signature": signature,
        ...correlationHeaders(event)
      },
      body: forwardedBody.toString("utf8")
    })
  } catch {
    guard.release(intakeEvents.map(item => item.event_id))
    throw createError({ statusCode: 502, statusMessage: "Event intake unavailable" })
  }
  if (response.status === 409) {
    setResponseStatus(event, 202)
    return { accepted: 0 }
  }
  if (!response.ok) {
    guard.release(intakeEvents.map(item => item.event_id))
    throw createError({
      statusCode: response.status >= 400 && response.status < 500 ? 422 : 502,
      statusMessage: "Event intake unavailable"
    })
  }
  const result = await response.json() as { accepted?: unknown }
  const accepted = typeof result.accepted === "number"
    ? result.accepted
    : events.length
  setResponseStatus(event, 202)
  return { accepted }
}
