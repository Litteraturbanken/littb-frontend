import { expect, test } from "vitest"

import { createLbApiClient } from "../../app/lib/api/client"
import { isSnapshotUnavailable } from "../../app/lib/api/snapshot"

test("classifies the FastAPI snapshot failure without changing its request correlation or envelope", async () => {
  const requestId = "fa781be9-6f29-4696-9aee-2bd75f2b32cb"
  const envelope = { error: {
    code: "snapshot_unavailable", message: "Search snapshot unavailable", details: null
  }, request_id: requestId }
  const observed: string[] = []
  const client = createLbApiClient("http://api.invalid/v2", async () => new Response(JSON.stringify(envelope), {
    status: 409, headers: { "content-type": "application/json", "X-Request-ID": requestId }
  }), id => observed.push(id))
  const result = await client.GET("/works/{work_id}/search-hits", {
    params: { path: { work_id: "lbfixture1" }, query: { media_type: "etext", query: "glas" } }
  })
  expect(isSnapshotUnavailable(result)).toBe(true)
  expect(result.error).toEqual(envelope)
  expect(observed).toEqual([requestId])
  expect(result.response.headers.get("x-request-id")).toBe(requestId)
})

test.each([
  { status: 200, code: "snapshot_unavailable" },
  { status: 503, code: "snapshot_unavailable" },
  { status: 409, code: "other_conflict" },
  { status: 409, code: "text_search_snapshot_expired" }
])("does not classify $status/$code as snapshot expiry", ({ status, code }) => {
  expect(isSnapshotUnavailable({ response: { status }, error: {
    error: { code, message: "Other error", details: null }, request_id: null
  } })).toBe(false)
})

test("does not classify an absent error envelope as snapshot expiry", () => {
  expect(isSnapshotUnavailable({ response: { status: 409 } })).toBe(false)
})
