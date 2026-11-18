import { hasC0OrC1Control } from "./text-safety"

export const maximumReaderMissingPageNameLength = 160

export function isReaderMissingPageName(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximumReaderMissingPageNameLength
    && !hasC0OrC1Control(value)
}
