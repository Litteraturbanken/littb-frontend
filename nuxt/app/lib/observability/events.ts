import type { components } from "../api/generated/lbapi"

type BrowserErrorEvent = components["schemas"]["BrowserErrorEvent"]
type BrowserUnhandledRejectionEvent
  = components["schemas"]["BrowserUnhandledRejectionEvent"]
type BrowserChunkErrorEvent
  = components["schemas"]["BrowserChunkErrorEvent"]
type BrowserHydrationErrorEvent
  = components["schemas"]["BrowserHydrationErrorEvent"]
export type BrowserEvent
  = BrowserErrorEvent
    | BrowserUnhandledRejectionEvent
    | BrowserChunkErrorEvent
    | BrowserHydrationErrorEvent
export type BrowserEventName = BrowserEvent["event_name"]
export type EventEnvironment = BrowserEvent["environment"]
