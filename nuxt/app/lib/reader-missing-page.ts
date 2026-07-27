import { hasC0OrC1Control } from "#shared/utils/text-safety"

export const maximumReaderMissingPageNameLength = 160

export const readerMissingPageErrorCode = "reader_page_not_found"

type ReaderMissingPageErrorData = Readonly<{
  code: typeof readerMissingPageErrorCode
  pageName: string
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function readerMissingPageErrorData(
  value: unknown
): ReaderMissingPageErrorData | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumReaderMissingPageNameLength ||
    hasC0OrC1Control(value)
  ) return null

  return { code: readerMissingPageErrorCode, pageName: value }
}

export function readerMissingPageName(value: unknown): string | null {
  if (!isRecord(value)) return null
  if (value.code !== readerMissingPageErrorCode) return null
  if (Object.keys(value).some(key => key !== "code" && key !== "pageName")) return null
  return readerMissingPageErrorData(value.pageName)?.pageName ?? null
}
