import { describe, expect, test } from "vitest"

import {
  CorrelationTokenStore
} from "../../server/utils/observability-correlation"

const CONTEXT = {
  requestId: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d",
  traceId: "1".repeat(32),
  spanId: "2".repeat(16),
  traceparent: `00-${"1".repeat(32)}-${"2".repeat(16)}-01`
}

describe("correlation token store", () => {
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
})
