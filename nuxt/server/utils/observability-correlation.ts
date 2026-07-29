import { randomUUID } from "node:crypto"

import type { ObservabilityContext } from "./observability"

const TOKEN_PATTERN
  = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const TOKEN_TTL_MS = 5 * 60_000
const MAX_TOKENS = 20_000

interface StoredCorrelation {
  context: ObservabilityContext
  expiresAt: number
}

export class CorrelationTokenStore {
  readonly #entries = new Map<string, StoredCorrelation>()
  readonly #maxTokens: number
  readonly #ttlMs: number
  #lastExpiresAt = 0

  constructor(maxTokens = MAX_TOKENS, ttlMs = TOKEN_TTL_MS) {
    this.#maxTokens = maxTokens
    this.#ttlMs = ttlMs
  }

  #pruneExpired(now: number): void {
    while (this.#entries.size > 0) {
      const oldest = this.#entries.entries().next().value as
        | [string, StoredCorrelation]
        | undefined
      if (!oldest || oldest[1].expiresAt > now) break
      this.#entries.delete(oldest[0])
    }
  }

  issue(context: ObservabilityContext, now = Date.now()): string {
    this.#pruneExpired(now)
    while (this.#entries.size >= this.#maxTokens) {
      const oldest = this.#entries.keys().next().value
      if (oldest === undefined) break
      this.#entries.delete(oldest)
    }
    const token = randomUUID()
    const expiresAt = Math.max(now + this.#ttlMs, this.#lastExpiresAt)
    this.#lastExpiresAt = expiresAt
    this.#entries.set(token, {
      context: { ...context },
      expiresAt
    })
    return token
  }

  resolve(token: string | null, now = Date.now()): ObservabilityContext | undefined {
    if (!token || !TOKEN_PATTERN.test(token)) return undefined
    const stored = this.#entries.get(token)
    if (!stored || stored.expiresAt <= now) {
      this.#entries.delete(token)
      return undefined
    }
    return { ...stored.context }
  }

  reset(): void {
    this.#entries.clear()
    this.#lastExpiresAt = 0
  }
}

const correlations = new CorrelationTokenStore()

export function issueCorrelationToken(
  context: ObservabilityContext,
  now = Date.now()
): string {
  return correlations.issue(context, now)
}

export function resolveCorrelationToken(
  token: string | null,
  now = Date.now()
): ObservabilityContext | undefined {
  return correlations.resolve(token, now)
}

export function resetCorrelationTokens(): void {
  correlations.reset()
}
