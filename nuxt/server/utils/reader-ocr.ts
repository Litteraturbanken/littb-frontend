import type { ReaderOcrOverlay } from "../../shared/types/reader"
import { fetchManagedText } from "../../shared/utils/managed-text"
import {
  maximumReaderOcrBytes,
  parseReaderOcrOverlay
} from "../../shared/utils/reader-ocr"

export async function fetchReaderOcrOverlay(
  base: string,
  workId: string,
  pageIndex: number
): Promise<ReaderOcrOverlay | null> {
  const filename = String(pageIndex).padStart(5, "0")
  try {
    const path = `/txt/${encodeURIComponent(workId)}/ocr_${filename}.html`
    const target = `${base}${path}`
    const source = await fetchManagedText(target, {
      authorityOrigin: new URL(base).origin,
      allowedPaths: [new URL(target).pathname],
      allowedPathPrefixes: [],
      allowedContentTypes: ["text/html"],
      maximumBytes: maximumReaderOcrBytes
    })
    return parseReaderOcrOverlay(source)
  } catch {
    return null
  }
}
