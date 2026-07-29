import { describe, expect, test } from "vitest"

import type { components } from "../../app/lib/api/generated/lbapi"

type ObservabilityEvent
  = components["schemas"]["ObservabilityEventBatch"]["events"][number]
type ReaderPageEvent = Extract<
  ObservabilityEvent,
  { event_name: "business.reader_page" }
>

const validReaderPageEvent = {
  schema_version: "lb.observability.v1",
  timestamp: "2026-07-29T12:00:00Z",
  event_id: "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d",
  event_name: "business.reader_page",
  event_kind: "business",
  severity: "info",
  service: "lb-frontend",
  producer: "browser",
  environment: "stage",
  deployment_git_sha: "a".repeat(40),
  request_id: null,
  trace_id: null,
  span_id: null,
  route: "/författare/:author/titlar/:title/sida/:page/:mediatype",
  http_method: null,
  status_code: null,
  duration_ms: null,
  error_type: null,
  error_fingerprint: null,
  attributes: {
    author_id: "SöderbergH",
    work_id: "lb123",
    page_id: "1",
    media_type: "etext"
  }
} satisfies ReaderPageEvent

describe("generated observability contract", () => {
  test("narrows attributes using event_name", () => {
    const event: ObservabilityEvent = validReaderPageEvent

    if (event.event_name !== "business.reader_page") {
      throw new Error("Expected a reader-page event")
    }
    expect(event.attributes.media_type).toBe("etext")
  })
})
