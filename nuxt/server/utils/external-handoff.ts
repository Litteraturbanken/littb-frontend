import { hasC0OrC1Control, hasLoneSurrogate } from "../../shared/utils/text-safety"
import { rawUrlParts } from "../../shared/utils/url-safety"

const MAX_SUFFIX_LENGTH = 8_192
const MAX_DECODE_PASSES = 16

export function rawHandoffTarget(value: string): {
  pathname: string
  search: string
} | null {
  const { rawPath, rawQuery, hasQuery, hasFragment } = rawUrlParts(value)
  if (hasFragment) return null
  return {
    pathname: rawPath,
    search: hasQuery ? `?${rawQuery}` : ""
  }
}

function hasUnsafeSegment(value: string): boolean {
  return value === "."
    || value === ".."
    || value.includes("/")
    || value.includes("\\")
    || hasC0OrC1Control(value)
    || hasLoneSurrogate(value)
}

function isSafeRawSegment(value: string): boolean {
  let decoded = value
  try {
    for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
      if (hasUnsafeSegment(decoded)) return false
      const next = decodeURIComponent(decoded)
      if (next === decoded) return true
      decoded = next
    }
  } catch {
    return false
  }
  return false
}

export function isSafeHandoffSuffix(suffix: string): boolean {
  return suffix.length <= MAX_SUFFIX_LENGTH
    && suffix.split("/").every(isSafeRawSegment)
}
