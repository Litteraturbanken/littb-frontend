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
const SAFE_LABEL_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/u
const ERROR_TYPE_PATTERN = /^[A-Za-z0-9_.:-]{1,160}$/u
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
  event: BrowserEvent
  correlationToken: string | null
}

interface BrowserIntakeEvent {
  event_id: string
  event_name: BrowserEventName
  error_type: string
  resource_kind: NonNullable<BrowserEvent["attributes"]["resource_kind"]>
  correlation_token: string | null
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
  if (!ERROR_TYPE_PATTERN.test(candidate)) return "UnknownError"
  return new Set([
    "ApiNetworkError",
    "ApiResponseError",
    "ChunkLoadError",
    "Error",
    "NullRejection",
    "RangeError",
    "ReferenceError",
    "StringRejection",
    "SyntaxError",
    "TypeError",
    "URIError",
    "UnknownError"
  ]).has(candidate) ? candidate : "OtherError"
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
  const type = errorType(options.error)
  const component = safeLabel(options.component)
  const route = safeRoute(options.route)
  const resourceKind = options.resourceKind ?? "unknown"
  const fingerprint = await sha256([
    options.eventName,
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

  if (options.eventName === "browser.unhandled_rejection") {
    return { ...common, event_name: options.eventName }
  }
  if (options.eventName === "browser.chunk_error") {
    return { ...common, event_name: options.eventName }
  }
  return { ...common, event_name: "browser.error" }
}

function intakeEvent(queued: QueuedBrowserEvent): BrowserIntakeEvent {
  return {
    event_id: queued.event.event_id,
    event_name: queued.event.event_name,
    error_type: queued.event.error_type ?? "UnknownError",
    resource_kind: queued.event.attributes.resource_kind ?? "unknown",
    correlation_token: queued.correlationToken
  }
}

function serializedBatch(events: QueuedBrowserEvent[]): string {
  return JSON.stringify({ events: events.map(intakeEvent) })
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export class BrowserObservabilityReporter {
  readonly #options: ReporterOptions
  readonly #queue: QueuedBrowserEvent[] = []
  readonly #seen = new Map<string, number>()
  #timer: ReturnType<typeof setTimeout> | undefined
  #flushing: Promise<void> | undefined
  #exitFlushing: Promise<void> | undefined
  #retryDelayMs = FLUSH_DELAY_MS

  constructor(options: ReporterOptions) {
    this.#options = options
  }

  async capture(
    error: unknown,
    metadata: {
      eventName?: BrowserEventName
      component?: string | null
      resourceKind?: BrowserEvent["attributes"]["resource_kind"]
      correlationToken?: string | null
    } = {}
  ): Promise<void> {
    try {
      const event = await createBrowserErrorEvent({
        eventName: metadata.eventName ?? classifyBrowserError(error),
        error,
        component: metadata.component,
        resourceKind: metadata.resourceKind,
        route: this.#options.route(),
        environment: this.#options.environment,
        deploymentGitSha: this.#options.deploymentGitSha
      })
      this.enqueue(event, metadata.correlationToken)
    } catch {
      // Capturing an error must never create another application failure.
    }
  }

  enqueue(event: BrowserEvent, correlationToken: string | null = null): void {
    const now = (this.#options.nowMs ?? Date.now)()
    const deduplicationKey
      = `${event.event_name}:${event.error_fingerprint}:${event.route}`
    const previous = this.#seen.get(deduplicationKey)
    if (previous !== undefined && now - previous < DEDUPLICATION_WINDOW_MS) return
    const queued = { event, correlationToken }
    if (byteLength(serializedBatch([queued])) > MAX_BATCH_BYTES) return

    this.#seen.set(deduplicationKey, now)
    for (const [key, seenAt] of this.#seen) {
      if (now - seenAt >= DEDUPLICATION_WINDOW_MS) this.#seen.delete(key)
    }
    if (this.#queue.length >= MAX_QUEUE_EVENTS) this.#queue.shift()
    this.#queue.push(queued)
    this.#scheduleFlush(FLUSH_DELAY_MS)
  }

  #scheduleFlush(delay: number): void {
    if (this.#options.autoFlush === false || this.#timer) return
    this.#timer = setTimeout(() => {
      this.#timer = undefined
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
      if (this.#queue.length > 0) this.#scheduleFlush(FLUSH_DELAY_MS)
    }
  }

  async #flushOnExit(): Promise<void> {
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = undefined
    if (!this.#exitFlushing) this.#exitFlushing = this.#deliverOnExit()
    try {
      await this.#exitFlushing
    } finally {
      this.#exitFlushing = undefined
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
    const beacon = this.#options.beacon
      ?? (typeof navigator === "undefined" ? undefined : navigator.sendBeacon.bind(navigator))
    try {
      return beacon?.(
        this.#options.endpoint,
        new Blob([body], { type: "application/json" })
      ) ?? false
    } catch {
      return false
    }
  }

  async #deliverByFetch(body: string): Promise<boolean> {
    const fetchRequest = this.#options.fetch
      ?? ((url: string, init: RequestInit) => globalThis.fetch(url, init))
    try {
      const response = await fetchRequest(this.#options.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        credentials: "same-origin",
        keepalive: true
      })
      return response.ok || (response.status >= 400 && response.status < 500)
    } catch {
      return false
    }
  }

  #retryBatch(batch: QueuedBrowserEvent[]): void {
    this.#queue.unshift(...batch)
    if (this.#queue.length > MAX_QUEUE_EVENTS) this.#queue.length = MAX_QUEUE_EVENTS
    this.#scheduleFlush(this.#retryDelayMs)
    this.#retryDelayMs = Math.min(this.#retryDelayMs * 2, MAX_RETRY_DELAY_MS)
  }

  async #deliver(): Promise<void> {
    if (this.#queue.length === 0) return
    const batch = this.#takeBatch()
    if (batch.length === 0) return

    const body = serializedBatch(batch)
    if (await this.#deliverByFetch(body)) {
      this.#retryDelayMs = FLUSH_DELAY_MS
      return
    }
    this.#retryBatch(batch)
  }

  async #deliverOnExit(): Promise<void> {
    let sentBytes = 0
    while (this.#queue.length > 0) {
      const batch = this.#takeBatch()
      if (batch.length === 0) break
      const body = serializedBatch(batch)
      const bodyBytes = byteLength(body)
      if (sentBytes + bodyBytes > MAX_PAGE_EXIT_BYTES) {
        this.#queue.unshift(...batch)
        break
      }
      if (this.#deliverByBeacon(body)) {
        sentBytes += bodyBytes
        this.#retryDelayMs = FLUSH_DELAY_MS
        continue
      }
      if (!await this.#deliverByFetch(body)) {
        this.#retryBatch(batch)
        return
      }
      this.#retryDelayMs = FLUSH_DELAY_MS
      break
    }
    if (this.#queue.length > 0) this.#scheduleFlush(FLUSH_DELAY_MS)
  }
}
