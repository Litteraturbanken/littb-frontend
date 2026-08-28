import type {
  ReaderFacsimileSize,
  ReaderFacsimileSizeSource,
  ReaderFacsimileSource
} from "../types/reader"
import type { FacsimileSize } from "../types/work-manifest"

type FacsimileSourceIdentity = Pick<FacsimileSize, "size">

function isFacsimileSize(value: number): value is ReaderFacsimileSize {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

function safeNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

export function facsimileImageUrl(
  workId: string,
  size: ReaderFacsimileSize,
  imageNumber: number
): string {
  if (!isFacsimileSize(size) || !safeNonnegativeInteger(imageNumber)) {
    throw new RangeError("Invalid faksimil source identity")
  }
  const encodedWorkId = encodeRfc3986Segment(workId)
  const encodedImageNumber = encodeRfc3986Segment(String(imageNumber).padStart(4, "0"))
  return [
    "",
    "txt",
    encodedWorkId,
    `${encodedWorkId}_${size}`,
    `${encodedWorkId}_${size}_${encodedImageNumber}.jpeg`
  ].join("/")
}

export function facsimileOcrUrl(workId: string, pageIndex: number): string {
  if (!safeNonnegativeInteger(pageIndex)) {
    throw new RangeError("Invalid faksimil OCR identity")
  }
  return `/txt/${encodeRfc3986Segment(workId)}/ocr_${String(pageIndex).padStart(5, "0")}.html`
}

export function buildFacsimileSources(
  workId: string,
  imageNumber: number,
  sizes: readonly ReaderFacsimileSizeSource[]
): ReaderFacsimileSource[] {
  return sizes
    .map(({ size, width }) => ({
      size,
      url: facsimileImageUrl(workId, size, imageNumber),
      width
    }))
    .sort((left, right) => left.size - right.size)
}

export function preferredFacsimileSize(
  sources: readonly FacsimileSourceIdentity[]
): FacsimileSize["size"] {
  if (sources.length === 0) throw new RangeError("At least one faksimil source is required")
  const sizes = sources.map(source => source.size).sort((left, right) => left - right)
  if (sizes.includes(3)) return 3
  return sizes.filter(size => size < 3).at(-1) ?? sizes[0]!
}

export function adjacentFacsimileSize(
  sources: readonly FacsimileSourceIdentity[],
  selectedSize: FacsimileSize["size"],
  direction: -1 | 1
): FacsimileSize["size"] | undefined {
  const sizes = sources.map(source => source.size).sort((left, right) => left - right)
  return direction === -1
    ? sizes.filter(size => size < selectedSize).at(-1)
    : sizes.find(size => size > selectedSize)
}
