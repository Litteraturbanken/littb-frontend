import { describe, expect, test } from "vitest"

import {
  CorrelationTokenStore
} from "../../server/utils/observability-correlation"

const CONTEXT = {
  requestId: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d",
  traceId: "1".repeat(32),
  spanId: "2".repeat(16),
  traceparent: `00-${"1".repeat(32)}-${"2".repeat(16)}-00`
}

function context(requestId: string): typeof CONTEXT {
  return { ...CONTEXT, requestId }
}

describe("correlation token store", () => {
  test("preserves exact trace flags without exposing mutable stored context", () => {
    const store = new CorrelationTokenStore(3, 1_000)
    const token = store.issue(CONTEXT, 100)
    const first = store.resolve(token, 101)

    expect(first).toEqual(CONTEXT)
    if (!first) throw new Error("Expected stored correlation")
    first.traceparent = `00-${"3".repeat(32)}-${"4".repeat(16)}-01`
    expect(store.resolve(token, 102)).toEqual(CONTEXT)
  })

  test("evicts only the oldest entry when its bounded capacity is reached", () => {
    const store = new CorrelationTokenStore(3, 1_000)
    const oldest = store.issue(CONTEXT, 100)
    const retained = [store.issue(CONTEXT, 101), store.issue(CONTEXT, 102)]
    const newest = store.issue(CONTEXT, 103)

    expect(store.resolve(oldest, 104)).toBeUndefined()
    for (const token of [...retained, newest]) {
      expect(store.resolve(token, 104)).toEqual(CONTEXT)
    }
  })

  test("removes an expired prefix while retaining live tokens", () => {
    const store = new CorrelationTokenStore(3, 100)
    const expired = store.issue(CONTEXT, 0)
    const live = store.issue(CONTEXT, 50)

    store.issue(CONTEXT, 101)

    expect(store.resolve(expired, 101)).toBeUndefined()
    expect(store.resolve(live, 101)).toEqual(CONTEXT)
  })

  test("expires each token at its own issue time after the clock regresses", () => {
    const store = new CorrelationTokenStore(3, 100)
    const future = store.issue(context("future"), 1_000)
    const regressed = store.issue(context("regressed"), 0)

    expect(store.resolve(regressed, 99)).toEqual(context("regressed"))
    expect(store.resolve(regressed, 100)).toBeUndefined()
    expect(store.resolve(future, 100)).toEqual(context("future"))
  })

  test("prunes expired non-prefix entries without changing insertion-order capacity", () => {
    const store = new CorrelationTokenStore(3, 100)
    const future = store.issue(context("future"), 1_000)
    const expired = store.issue(context("expired"), 0)
    const firstAfterRegression = store.issue(context("first-after-regression"), 101)
    const newest = store.issue(context("newest"), 102)

    expect(store.resolve(expired, 102)).toBeUndefined()
    expect(store.resolve(future, 102)).toEqual(context("future"))
    expect(store.resolve(firstAfterRegression, 102))
      .toEqual(context("first-after-regression"))
    expect(store.resolve(newest, 102)).toEqual(context("newest"))
  })

  test("reset removes entries without carrying expiry state into later issues", () => {
    const store = new CorrelationTokenStore(1, 100)
    store.issue(context("future"), 1_000)
    store.reset()
    const afterReset = store.issue(context("after-reset"), 0)

    expect(store.resolve(afterReset, 99)).toEqual(context("after-reset"))
    expect(store.resolve(afterReset, 100)).toBeUndefined()
  })
})
