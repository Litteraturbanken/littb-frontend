import type { components } from "../../app/lib/api/generated/lbapi.js"

type ObservabilityEvent
  = components["schemas"]["ObservabilityEventBatch"]["events"][number]
type ReaderPageEvent = Extract<
  ObservabilityEvent,
  { event_name: "business.reader_page" }
>
type DictionaryLookupEvent = Extract<
  ObservabilityEvent,
  { event_name: "business.dictionary_lookup" }
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

const dictionaryAttributes: DictionaryLookupEvent["attributes"] = {
  found: true,
  outcome: "both",
  selected_dictionary: "so",
  word_length: 7,
  // @ts-expect-error Raw selected words are forbidden by the generated contract.
  word: "private word"
}

void dictionaryAttributes
