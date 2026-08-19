import { describe, expect, test } from "vitest"

import {
  boundedParallelism,
  configuredShardCount,
  shardPorts
} from "../../scripts/test-runner-policy.mjs"

describe("test runner parallelism policy", () => {
  test.each([
    [18, 12, 12],
    [8, 12, 8],
    [1, 12, 1]
  ])("uses %i available workers with cap %i as %i", (available, cap, expected) => {
    expect(boundedParallelism(cap, available)).toBe(expected)
  })

  test.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid available parallelism %s",
    available => {
      expect(() => boundedParallelism(12, available)).toThrow(/positive integer/u)
    }
  )

  test("defaults browser execution to four bounded shards", () => {
    expect(configuredShardCount(undefined, 18)).toBe(4)
    expect(configuredShardCount(undefined, 2)).toBe(2)
  })

  test.each(["", "0", "-1", "1.5", "many"])(
    "rejects invalid shard override %j",
    raw => {
      expect(() => configuredShardCount(raw, 18)).toThrow(/positive integer/u)
    }
  )

  test("honors a positive shard override without exceeding available parallelism", () => {
    expect(configuredShardCount("6", 18)).toBe(6)
    expect(configuredShardCount("20", 18)).toBe(18)
  })

  test("allocates deterministic unique fixture and Nuxt ports", () => {
    expect(shardPorts(0)).toEqual({ fixturePort: 4100, nuxtPort: 3000 })
    expect(shardPorts(3)).toEqual({ fixturePort: 4103, nuxtPort: 3003 })
  })
})
