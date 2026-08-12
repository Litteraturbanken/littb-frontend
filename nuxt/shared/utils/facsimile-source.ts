import type { FacsimileSize } from "../types/work-manifest"

type FacsimileSourceIdentity = Pick<FacsimileSize, "size">

export function preferredFacsimileSize(
  sources: readonly FacsimileSourceIdentity[]
): FacsimileSize["size"] {
  if (sources.length === 0) throw new RangeError("At least one faksimil source is required")
  const sizes = sources.map(source => source.size).sort((left, right) => left - right)
  if (sizes.includes(3)) return 3
  return sizes.filter(size => size < 3).at(-1) ?? sizes[0]!
}
