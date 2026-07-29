import type { components } from "../api/generated/lbapi"

export type ObservabilityEvent
  = components["schemas"]["ObservabilityEventBatch"]["events"][number]
export type ObservabilityEventBatch
  = components["schemas"]["ObservabilityEventBatch"]
export type BrowserErrorEvent = components["schemas"]["BrowserErrorEvent"]
export type BrowserUnhandledRejectionEvent
  = components["schemas"]["BrowserUnhandledRejectionEvent"]
export type BrowserChunkErrorEvent
  = components["schemas"]["BrowserChunkErrorEvent"]
export type BrowserEvent
  = BrowserErrorEvent
    | BrowserUnhandledRejectionEvent
    | BrowserChunkErrorEvent
export type BrowserEventName = BrowserEvent["event_name"]
export type EventEnvironment = BrowserEvent["environment"]
