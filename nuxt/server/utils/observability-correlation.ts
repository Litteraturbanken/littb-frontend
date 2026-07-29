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

const correlations = new Map<string, StoredCorrelation>()

function prune(now: number): void {
  for (const [token, stored] of correlations) {
    if (stored.expiresAt <= now) correlations.delete(token)
  }
  while (correlations.size >= MAX_TOKENS) {
    const oldest = correlations.keys().next().value
    if (oldest === undefined) break
    correlations.delete(oldest)
  }
}

export function issueCorrelationToken(
  context: ObservabilityContext,
  now = Date.now()
): string {
  prune(now)
  const token = randomUUID()
  correlations.set(token, {
    context: { ...context },
    expiresAt: now + TOKEN_TTL_MS
  })
  return token
}

export function resolveCorrelationToken(
  token: string | null,
  now = Date.now()
): ObservabilityContext | undefined {
  if (!token || !TOKEN_PATTERN.test(token)) return undefined
  const stored = correlations.get(token)
  if (!stored || stored.expiresAt <= now) {
    correlations.delete(token)
    return undefined
  }
  return { ...stored.context }
}

export function resetCorrelationTokens(): void {
  correlations.clear()
}
