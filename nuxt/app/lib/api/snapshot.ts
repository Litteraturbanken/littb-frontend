import type { components } from "./generated/lbapi"

export function isSnapshotUnavailable(result: {
  response: Pick<Response, "status">
  error?: components["schemas"]["ApiErrorResponse"]
}): boolean {
  return result.response.status === 409
    && result.error?.error.code === "snapshot_unavailable"
}
