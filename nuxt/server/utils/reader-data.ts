import { createError, type H3Event } from "h3"
import type { ReaderManifestResponse } from "../../shared/types/work-manifest"
import type { ReaderSourceInfo } from "../../shared/types/reader-source-info"
import { createServerLbApiClient } from "./server-lb-api-client"
import { isReaderManifestResponse } from "./work-manifest-validation"
import { validateReaderSourceInfoResponse } from "./reader-source-info-validation"
import { manifestPathSerializer } from "./work-manifest-client"
import { projectReaderSourceInfo } from "./reader-source-info"

export async function loadReaderData(
  event: H3Event, author: string, title: string, media: string
): Promise<{ manifest: ReaderManifestResponse, sourceInfo: ReaderSourceInfo | null }> {
  if (media !== "etext" && media !== "faksimil") {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  const client = createServerLbApiClient(event)
  const result = await client.GET("/works/{author_id}/{title_path}/reader-data", {
    params: { path: { author_id: author, title_path: title }, query: { media_type: media } },
    pathSerializer: manifestPathSerializer,
    redirect: "manual"
  }).catch(() => { throw createError({ statusCode: 502, statusMessage: "Reader source unavailable" }) })
  if (!result.response.ok || result.error || !result.data) {
    throw createError({
      statusCode: [404, 422].includes(result.response.status) ? 404 : 502,
      statusMessage: "Reader source unavailable"
    })
  }
  const { manifest } = result.data
  if (!isReaderManifestResponse(manifest, author, title, media)) {
    throw createError({ statusCode: 502, statusMessage: "Invalid reader source" })
  }
  let sourceInfo: ReaderSourceInfo | null = null
  if (result.data.source_info !== null) {
    try {
      const source = validateReaderSourceInfoResponse(result.data.source_info, author, title, media)
      if (source.work_id === manifest.work_id) sourceInfo = await projectReaderSourceInfo(event, source)
    } catch {
      // Preserve readable content when optional source metadata is unavailable.
    }
  }
  return { manifest, sourceInfo }
}
