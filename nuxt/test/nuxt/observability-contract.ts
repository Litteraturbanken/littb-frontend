import type { components } from "../../app/lib/api/generated/lbapi"

type ObservabilityEvent
  = components["schemas"]["ObservabilityEventBatch"]["events"][number]
type ReaderPageEvent = Extract<
  ObservabilityEvent,
  { event_name: "business.reader_page" }
>

const attributes: ReaderPageEvent["attributes"] = {
  author_id: "SöderbergH",
  work_id: "lb123",
  page_id: "1",
  media_type: "etext",
  // @ts-expect-error Raw selected text is forbidden by the generated contract.
  selected_text: "private word"
}

void attributes
