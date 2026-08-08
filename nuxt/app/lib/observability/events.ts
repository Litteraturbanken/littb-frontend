import type { components } from "../api/generated/lbapi"

type BrowserErrorEvent = components["schemas"]["BrowserErrorEvent"]
type BrowserUnhandledRejectionEvent
  = components["schemas"]["BrowserUnhandledRejectionEvent"]
type BrowserChunkErrorEvent
  = components["schemas"]["BrowserChunkErrorEvent"]
export type BrowserEvent
  = BrowserErrorEvent
    | BrowserUnhandledRejectionEvent
    | BrowserChunkErrorEvent
export type BrowserEventName = BrowserEvent["event_name"]
export type EventEnvironment = BrowserEvent["environment"]
