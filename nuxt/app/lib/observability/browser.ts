import type {
  BrowserEvent,
  BrowserEventName,
  EventEnvironment
} from "./events"

export type { BrowserEvent } from "./events"

const MAX_BATCH_EVENTS = 10
const MAX_BATCH_BYTES = 16 * 1024
const MAX_PAGE_EXIT_BYTES = 60 * 1024
const MAX_QUEUE_EVENTS = 50
const DEDUPLICATION_WINDOW_MS = 60_000
const FLUSH_DELAY_MS = 1_000
const MAX_RETRY_DELAY_MS = 30_000
const FETCH_TIMEOUT_MS = 10_000
const TERMINAL_INTAKE_STATUSES = new Set([400, 403, 413, 415, 422])
const SAFE_LABEL_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/u
const EVENT_ID_PATTERN
  = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
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
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u
const ZERO_GIT_SHA = "0".repeat(40)

interface CreateBrowserErrorEventOptions {
  eventName: BrowserEventName
  error: unknown
  component?: string | null
  resourceKind?: BrowserEvent["attributes"]["resource_kind"]
  route?: string | null
  environment: EventEnvironment
  deploymentGitSha: string
  requestId?: string | null
  now?: () => Date
  randomUUID?: () => string
}

interface QueuedBrowserEvent {
  deduplicationKey: string
  event: BrowserIntakeEvent
  seenAt: number
}

interface BrowserIntakeEvent {
  event_id: string
  event_name: BrowserEventName
  error_type: string
  resource_kind: NonNullable<BrowserEvent["attributes"]["resource_kind"]>
  correlation_token: string | null
}

interface ExitDrainPlan {
  fallbackDeliveries: Array<{
    batch: QueuedBrowserEvent[]
    delivery: Promise<boolean>
  }>
  sentBytes: number
}

interface ExitDrainResult {
  failedBatch: QueuedBrowserEvent[]
  sentBytes: number
}

interface ReporterOptions {
  endpoint: string
  environment: EventEnvironment
  deploymentGitSha: string
  route: () => string | null
  fetch?: (url: string, init: RequestInit) => Promise<Response>
  beacon?: (url: string, data: Blob) => boolean
  autoFlush?: boolean
  nowMs?: () => number
  fetchTimeoutMs?: number
}

function safeLabel(value: string | null | undefined): string | null {
  return value && SAFE_LABEL_PATTERN.test(value) ? value : null
}

function safeRoute(value: string | null | undefined): string | null {
  if (
    !value
    || value.length > 300
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("?")
    || value.includes("#")
    || [...value].some(character => {
      const point = character.codePointAt(0) ?? 0
      return point < 32 || point === 127
    })
  ) return null
  return value
}

function safeBrowserErrorType(value: unknown): string {
  if (typeof value !== "string") return "UnknownError"
  return BROWSER_ERROR_TYPES.has(value) ? value : "OtherError"
}

function safeBrowserEventName(value: unknown): BrowserEventName {
  return typeof value === "string" && BROWSER_EVENT_NAMES.has(value as BrowserEventName)
    ? value as BrowserEventName
    : "browser.error"
}

function safeBrowserResourceKind(
  value: unknown
): NonNullable<BrowserEvent["attributes"]["resource_kind"]> {
  return typeof value === "string" && RESOURCE_KINDS.has(value as never)
    ? value as NonNullable<BrowserEvent["attributes"]["resource_kind"]>
    : "unknown"
}

function safeCorrelationToken(value: unknown): string | null {
  return typeof value === "string" && EVENT_ID_PATTERN.test(value) ? value : null
}

function errorType(error: unknown): string {
  let candidate = "UnknownError"
  if (error instanceof Error) {
    candidate = error.name || error.constructor.name
  } else if (typeof error === "string") {
    candidate = "StringRejection"
  } else if (error === null) {
    candidate = "NullRejection"
  } else if (error !== undefined) {
    candidate = `${typeof error}Rejection`
  }
  return safeBrowserErrorType(candidate)
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")
}

export function classifyBrowserError(error: unknown): BrowserEventName {
  if (!(error instanceof Error)) return "browser.error"
  const diagnostic = `${error.name} ${error.message}`
  return /ChunkLoadError|Loading chunk|dynamically imported module|module script failed/iu
    .test(diagnostic)
    ? "browser.chunk_error"
    : "browser.error"
}

export async function createBrowserErrorEvent(
  options: CreateBrowserErrorEventOptions
): Promise<BrowserEvent> {
  const eventName = safeBrowserEventName(options.eventName)
  const type = errorType(options.error)
  const component = safeLabel(options.component)
  const route = safeRoute(options.route)
  const resourceKind = safeBrowserResourceKind(options.resourceKind)
  const fingerprint = await sha256([
    eventName,
    type,
    component ?? "",
    route ?? "",
    resourceKind ?? ""
  ].join("\n"))
  const now = (options.now ?? (() => new Date()))()
  const randomUUID = options.randomUUID ?? (() => globalThis.crypto.randomUUID())
  const common = {
    schema_version: "lb.observability.v1" as const,
    timestamp: now.toISOString(),
    event_id: randomUUID(),
    event_kind: "error" as const,
    severity: "error" as const,
    service: "lb-frontend" as const,
    producer: "browser" as const,
    environment: options.environment,
    deployment_git_sha: GIT_SHA_PATTERN.test(options.deploymentGitSha)
      ? options.deploymentGitSha
      : ZERO_GIT_SHA,
    request_id: options.requestId ?? null,
    trace_id: null,
    span_id: null,
    route,
    http_method: null,
    status_code: null,
    duration_ms: null,
    error_type: type,
    error_fingerprint: fingerprint,
    attributes: {
      component,
      resource_kind: resourceKind
    }
  }

  if (eventName === "browser.unhandled_rejection") {
    return { ...common, event_name: eventName }
  }
  if (eventName === "browser.chunk_error") {
    return { ...common, event_name: eventName }
  }
  return { ...common, event_name: "browser.error" }
}

function intakeEvent(queued: QueuedBrowserEvent): BrowserIntakeEvent {
  return queued.event
}

function serializedBatch(events: QueuedBrowserEvent[]): string {
  return JSON.stringify({ events: events.map(intakeEvent) })
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function remainingPageExitBytes(...inflightBodyBytes: number[]): number {
  return Math.max(
    0,
    MAX_PAGE_EXIT_BYTES - inflightBodyBytes.reduce((total, bytes) => total + bytes, 0)
  )
}

function eventIdentity(
  eventName: BrowserEventName,
  type: string,
  component: string | null,
  route: string | null,
  resourceKind: NonNullable<BrowserEvent["attributes"]["resource_kind"]>
): string {
  return JSON.stringify([eventName, type, component, route, resourceKind])
}

export class BrowserObservabilityReporter {
  readonly #options: ReporterOptions
  readonly #queue: QueuedBrowserEvent[] = []
  readonly #seen = new Map<string, number>()
  #timer: ReturnType<typeof setTimeout> | undefined
  #flushing: Promise<void> | undefined
  #activeBatch: QueuedBrowserEvent[] | undefined
  #activeBatchBytes = 0
  #activeBatchFailed = false
  #exitFlushing: Promise<void> | undefined
  #retryDelayMs = FLUSH_DELAY_MS
  #retryDueAt: number | undefined

  constructor(options: ReporterOptions) {
    this.#options = options
  }

  capture(
    error: unknown,
    metadata: {
      eventName?: BrowserEventName
      component?: string | null
      resourceKind?: BrowserEvent["attributes"]["resource_kind"]
      correlationToken?: string | null
    } = {}
  ): Promise<void> {
    try {
      const eventName = safeBrowserEventName(
        metadata.eventName ?? classifyBrowserError(error)
      )
      const type = errorType(error)
      const component = safeLabel(metadata.component)
      const route = safeRoute(this.#options.route())
      const resourceKind = safeBrowserResourceKind(metadata.resourceKind)
      const correlationToken = safeCorrelationToken(metadata.correlationToken)
      const eventId = globalThis.crypto.randomUUID()
      if (!EVENT_ID_PATTERN.test(eventId)) return Promise.resolve()
      this.#enqueueIntake({
        event_id: eventId,
        event_name: eventName,
        error_type: type,
        resource_kind: resourceKind,
        correlation_token: correlationToken
      }, eventIdentity(eventName, type, component, route, resourceKind), correlationToken)
    } catch {
      // Capturing an error must never create another application failure.
    }
    return Promise.resolve()
  }

  enqueue(event: BrowserEvent, correlationToken: string | null = null): void {
    let eventId = event.event_id
    if (typeof eventId !== "string" || !EVENT_ID_PATTERN.test(eventId)) {
      try {
        eventId = globalThis.crypto.randomUUID()
      } catch {
        return
      }
      if (!EVENT_ID_PATTERN.test(eventId)) return
    }
    const eventName = safeBrowserEventName(event.event_name)
    const resourceKind = safeBrowserResourceKind(event.attributes?.resource_kind)
    const normalizedCorrelationToken = safeCorrelationToken(correlationToken)
    const type = safeBrowserErrorType(event.error_type)
    this.#enqueueIntake({
      event_id: eventId,
      event_name: eventName,
      error_type: type,
      resource_kind: resourceKind,
      correlation_token: normalizedCorrelationToken
    }, eventIdentity(
      eventName,
      type,
      safeLabel(event.attributes.component),
      safeRoute(event.route),
      resourceKind
    ), normalizedCorrelationToken)
  }

  #enqueueIntake(
    event: BrowserIntakeEvent,
    eventIdentity: string,
    correlationToken: string | null
  ): void {
    const now = (this.#options.nowMs ?? Date.now)()
    const deduplicationKey = JSON.stringify([eventIdentity, correlationToken])
    const previous = this.#seen.get(deduplicationKey)
    if (previous !== undefined && now - previous < DEDUPLICATION_WINDOW_MS) return
    const queued = { deduplicationKey, event, seenAt: now }
    if (byteLength(serializedBatch([queued])) > MAX_BATCH_BYTES) return

    this.#seen.set(deduplicationKey, now)
    for (const [key, seenAt] of this.#seen) {
      if (now - seenAt >= DEDUPLICATION_WINDOW_MS) this.#seen.delete(key)
    }
    if (this.#queue.length >= MAX_QUEUE_EVENTS) {
      const discarded = this.#queue.shift()
      if (discarded) this.#releaseDeduplicationMarker(discarded)
    }
    this.#queue.push(queued)
    this.#scheduleFlush(FLUSH_DELAY_MS)
  }

  #scheduleFlush(delay: number): void {
    if (this.#options.autoFlush === false || this.#timer) return
    if (this.#retryDueAt !== undefined) {
      delay = Math.max(0, this.#retryDueAt - Date.now())
    }
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      this.#retryDueAt = undefined
      void this.flush()
    }, delay)
  }

  async flush(preferBeacon = false): Promise<void> {
    if (preferBeacon) return await this.#flushOnExit()
    if (this.#exitFlushing) return await this.#exitFlushing
    if (this.#flushing) return await this.#flushing
    this.#flushing = this.#deliver()
    try {
      await this.#flushing
    } finally {
      this.#flushing = undefined
      if (this.#queue.length > 0 && !this.#exitFlushing) {
        this.#scheduleFlush(FLUSH_DELAY_MS)
      }
    }
  }

  async #flushOnExit(): Promise<void> {
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = undefined
    if (!this.#exitFlushing) this.#exitFlushing = this.#deliverAroundActiveFlush()
    try {
      await this.#exitFlushing
    } finally {
      if (this.#timer) clearTimeout(this.#timer)
      this.#timer = undefined
      this.#exitFlushing = undefined
      if (this.#queue.length > 0) this.#scheduleFlush(FLUSH_DELAY_MS)
      else this.#retryDueAt = undefined
    }
  }

  async #deliverAroundActiveFlush(): Promise<void> {
    const activeFlush = this.#flushing
    if (!activeFlush) {
      await this.#deliverOnExit()
      return
    }
    const activeBatchBytes = this.#activeBatchBytes
    const exitPlan = this.#startExitDrain(
      remainingPageExitBytes(activeBatchBytes)
    )
    await activeFlush
    // The keepalive quota covers bodies still in flight. The awaited active
    // request is done here, so only exit-drain bodies remain reserved.
    let activeBatch: QueuedBrowserEvent[] | undefined
    let activeDelivery: Promise<{ bytes: number, delivered: boolean }> | undefined
    if (this.#activeBatchFailed && this.#activeBatch) {
      activeBatch = this.#activeBatch
      this.#activeBatch = undefined
      this.#activeBatchBytes = 0
      this.#activeBatchFailed = false
      activeDelivery = this.#deliverExitBatch(
        activeBatch,
        remainingPageExitBytes(exitPlan.sentBytes)
      )
    }
    const [exitDelivery, resolvedActiveDelivery] = await Promise.all([
      this.#settleExitDrain(exitPlan),
      activeDelivery ?? Promise.resolve({ bytes: 0, delivered: true })
    ])
    const failedBatch = [
      ...(activeBatch && !resolvedActiveDelivery.delivered ? activeBatch : []),
      ...exitDelivery.failedBatch
    ]
    if (failedBatch.length > 0) {
      this.#requeueFront(failedBatch)
      this.#scheduleRetry()
      return
    }
    if (exitPlan.sentBytes > 0 || resolvedActiveDelivery.bytes > 0) {
      this.#resetRetry()
    }
    if (this.#queue.length > 0) {
      await this.#deliverOnExit(remainingPageExitBytes(
        exitDelivery.sentBytes,
        resolvedActiveDelivery.bytes
      ))
    }
  }

  #takeBatch(): QueuedBrowserEvent[] {
    const batch: QueuedBrowserEvent[] = []
    while (batch.length < MAX_BATCH_EVENTS && this.#queue.length > 0) {
      const candidate = this.#queue[0]
      if (!candidate) break
      if (byteLength(serializedBatch([...batch, candidate])) > MAX_BATCH_BYTES) break
      batch.push(candidate)
      this.#queue.shift()
    }
    return batch
  }

  #deliverByBeacon(body: string): boolean {
    try {
      let beacon = this.#options.beacon
      if (!beacon) {
        if (typeof navigator === "undefined") return false
        const defaultBeacon = navigator.sendBeacon
        if (typeof defaultBeacon !== "function") return false
        beacon = defaultBeacon.bind(navigator)
      }
      return beacon(
        this.#options.endpoint,
        new Blob([body], { type: "application/json" })
      )
    } catch {
      return false
    }
  }

  async #deliverByFetch(body: string): Promise<boolean> {
    const fetchRequest = this.#options.fetch
      ?? ((url: string, init: RequestInit) => globalThis.fetch(url, init))
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const request = fetchRequest(this.#options.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        credentials: "same-origin",
        keepalive: true,
        signal: controller.signal
      })
      const observedRequest = request.then(
        response => response,
        () => null
      )
      const deadline = new Promise<null>(resolve => {
        timeout = setTimeout(() => {
          controller.abort()
          resolve(null)
        }, this.#options.fetchTimeoutMs ?? FETCH_TIMEOUT_MS)
      })
      const response = await Promise.race([observedRequest, deadline])
      if (!response) return false
      return response.ok || TERMINAL_INTAKE_STATUSES.has(response.status)
    } catch {
      return false
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
    }
  }

  #retryBatch(batch: QueuedBrowserEvent[]): void {
    this.#requeueFront(batch)
    this.#scheduleRetry()
  }

  #requeueFront(batch: QueuedBrowserEvent[]): void {
    this.#queue.unshift(...batch)
    if (this.#queue.length > MAX_QUEUE_EVENTS) {
      const discarded = this.#queue.splice(MAX_QUEUE_EVENTS)
      for (const queued of discarded) this.#releaseDeduplicationMarker(queued)
    }
  }

  #releaseDeduplicationMarker(queued: QueuedBrowserEvent): void {
    if (this.#seen.get(queued.deduplicationKey) === queued.seenAt) {
      this.#seen.delete(queued.deduplicationKey)
    }
  }

  #scheduleRetry(): void {
    const dueAt = Date.now() + this.#retryDelayMs
    this.#retryDueAt = Math.max(this.#retryDueAt ?? 0, dueAt)
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = undefined
    this.#scheduleFlush(this.#retryDelayMs)
    this.#retryDelayMs = Math.min(this.#retryDelayMs * 2, MAX_RETRY_DELAY_MS)
  }

  #resetRetry(): void {
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = undefined
    this.#retryDelayMs = FLUSH_DELAY_MS
    this.#retryDueAt = undefined
  }

  async #deliver(): Promise<void> {
    if (this.#queue.length === 0) return
    const batch = this.#takeBatch()
    if (batch.length === 0) return
    this.#activeBatch = batch
    this.#activeBatchFailed = false

    const body = serializedBatch(batch)
    this.#activeBatchBytes = byteLength(body)
    if (await this.#deliverByFetch(body)) {
      this.#activeBatch = undefined
      this.#activeBatchBytes = 0
      this.#resetRetry()
      return
    }
    this.#activeBatchFailed = true
    if (this.#exitFlushing) return
    this.#activeBatch = undefined
    this.#activeBatchBytes = 0
    this.#activeBatchFailed = false
    this.#retryBatch(batch)
  }

  async #deliverExitBatch(batch: QueuedBrowserEvent[], byteBudget: number): Promise<{
    bytes: number
    delivered: boolean
  }> {
    const body = serializedBatch(batch)
    const bodyBytes = byteLength(body)
    if (bodyBytes > byteBudget) return { bytes: 0, delivered: false }
    const delivered = this.#deliverByBeacon(body) || await this.#deliverByFetch(body)
    return { bytes: bodyBytes, delivered }
  }

  #startExitDrain(byteBudget: number): ExitDrainPlan {
    const fallbackDeliveries: ExitDrainPlan["fallbackDeliveries"] = []
    let sentBytes = 0
    while (this.#queue.length > 0) {
      const batch = this.#takeBatch()
      if (batch.length === 0) break
      const body = serializedBatch(batch)
      const bodyBytes = byteLength(body)
      if (sentBytes + bodyBytes > byteBudget) {
        this.#requeueFront(batch)
        break
      }
      if (this.#deliverByBeacon(body)) {
        sentBytes += bodyBytes
        continue
      }
      sentBytes += bodyBytes
      fallbackDeliveries.push({ batch, delivery: this.#deliverByFetch(body) })
    }
    return { fallbackDeliveries, sentBytes }
  }

  async #settleExitDrain(plan: ExitDrainPlan): Promise<ExitDrainResult> {
    const fallbackResults = await Promise.all(plan.fallbackDeliveries.map(
      fallback => fallback.delivery
    ))
    const failedBatch = plan.fallbackDeliveries.flatMap((fallback, index) => (
      fallbackResults[index] ? [] : fallback.batch
    ))
    return { failedBatch, sentBytes: plan.sentBytes }
  }

  async #deliverOnExit(byteBudget = MAX_PAGE_EXIT_BYTES): Promise<ExitDrainResult> {
    const result = await this.#settleExitDrain(this.#startExitDrain(byteBudget))
    if (result.failedBatch.length > 0) {
      this.#requeueFront(result.failedBatch)
      this.#scheduleRetry()
    }
    else if (result.sentBytes > 0) this.#resetRetry()
    if (this.#queue.length > 0) this.#scheduleFlush(FLUSH_DELAY_MS)
    return result
  }
}
