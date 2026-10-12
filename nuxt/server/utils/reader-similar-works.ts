import type { H3Event } from "h3"
import type { components } from "../../app/lib/api/generated/lbapi"
import { createServerLbApiClient } from "./server-lb-api-client"

type SimilarWork = components["schemas"]["SimilarWork"]
type SimilarWorksResponse = components["schemas"]["SimilarWorksResponse"]
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function exactObjectKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && expected.every(key => keys.includes(key))
}

function isReaderSegment(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 200
    && value.trim() === value
    && value !== "."
    && value !== ".."
    && !/[\\/%\p{Cc}\p{Cs}]/u.test(value)
}

function isReaderLabel(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 20_000
    && value.trim() === value
    && !/[\p{Cc}\p{Cs}]/u.test(value)
}

function isSimilarWork(value: unknown): value is SimilarWork {
  if (!isRecord(value) || !exactObjectKeys(value, [
    "author_id",
    "author_surname",
    "title_id",
    "start_page",
    "media_type",
    "label"
  ])) return false
  return isReaderSegment(value.author_id)
    && isReaderLabel(value.author_surname)
    && isReaderSegment(value.title_id)
    && isReaderSegment(value.start_page)
    && (value.media_type === "etext" || value.media_type === "faksimil")
    && isReaderLabel(value.label)
}

function isSimilarWorksResponse(value: unknown): value is SimilarWorksResponse {
  return isRecord(value)
    && exactObjectKeys(value, ["items"])
    && Array.isArray(value.items)
    && value.items.length <= 5
    && value.items.every(isSimilarWork)
}

export async function loadReaderSimilarWorks(
  event: H3Event, workId: string, mediaType: "etext" | "faksimil"
): Promise<SimilarWork[]> {
  try {
    const result = await createServerLbApiClient(event).GET("/works/{work_id}/similar", {
      params: { path: { work_id: workId }, query: { media_type: mediaType } },
      redirect: "manual"
    })
    return !result.error && isSimilarWorksResponse(result.data) ? result.data.items : []
  } catch {
    return []
  }
}
