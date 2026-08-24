import { availableParallelism } from "node:os"

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive integer`)
  }
  return value
}

export function boundedParallelism(cap, available = availableParallelism()) {
  return Math.min(
    positiveInteger(cap, "parallelism cap"),
    positiveInteger(available, "available parallelism")
  )
}

export function configuredShardCount(raw, available = availableParallelism()) {
  const requested = raw === undefined ? 3 : Number(raw)
  return boundedParallelism(
    positiveInteger(requested, "LITTB_PLAYWRIGHT_SHARDS"),
    available
  )
}

export function shardPorts(
  index,
  fixtureBase = 4100,
  nuxtBase = 3000,
  viteServerHmrBase = 24_678,
  svenskaEmbedBase = 4200
) {
  if (!Number.isInteger(index) || index < 0) {
    throw new TypeError("shard index must be a non-negative integer")
  }
  return {
    fixturePort: positiveInteger(fixtureBase, "fixture port") + (index * 2),
    nuxtPort: positiveInteger(nuxtBase, "Nuxt port") + index,
    svenskaEmbedPort: positiveInteger(svenskaEmbedBase, "Svenska embed port") + index,
    viteServerHmrPort: positiveInteger(viteServerHmrBase, "Vite server HMR port") + index
  }
}
