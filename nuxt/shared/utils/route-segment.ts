import { hasC0OrC1Control, hasLoneSurrogate } from "./text-safety"

export function validRouteSegment(value: string, maximumLength: number): boolean {
  return value.length > 0
    && value.length <= maximumLength
    && value === value.trim()
    && value !== "."
    && value !== ".."
    && !value.includes("\\")
    && !value.includes("/")
    && !value.includes("%")
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

export function encodeValidatedRouteSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}
