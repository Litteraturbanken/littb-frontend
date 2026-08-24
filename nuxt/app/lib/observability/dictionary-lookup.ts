export type DictionaryLookupOutcome
  = | "opened"
    | "so"
    | "saob"
    | "both"
    | "empty"
    | "child_error"
    | "timeout"

export type DictionaryLookupSelection = "so" | "saob" | null

interface DictionaryLookupOutcomeOptions {
  durationMs: number
  endpoint?: string
  fetch?: typeof globalThis.fetch
  outcome: DictionaryLookupOutcome
  selectedDictionary: DictionaryLookupSelection
  wordLength: number
}

export async function reportDictionaryLookupOutcome(
  options: DictionaryLookupOutcomeOptions
): Promise<void> {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  try {
    await fetchImplementation(options.endpoint ?? "/_observability/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        events: [{
          event_id: globalThis.crypto.randomUUID(),
          event_name: "business.dictionary_lookup",
          word_length: options.wordLength,
          outcome: options.outcome,
          selected_dictionary: options.selectedDictionary,
          duration_ms: options.durationMs
        }]
      }),
      keepalive: true
    })
  } catch {
    // Observability delivery must not change the Reader interaction.
  }
}
