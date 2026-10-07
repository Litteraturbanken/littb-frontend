import type { MatomoCommand } from "./matomo"

interface SearchOutcome {
  status: number
  count: number | null
}

/** One text-search event per accepted search, not per request or result page. */
export class MatomoTextSearch {
  #identity: string | null = null
  #tracked = false
  constructor(private readonly send: (command: MatomoCommand) => void) {}

  observe(identity: string | null, phrase: string | null, outcome: SearchOutcome | null): void {
    if (identity !== this.#identity) {
      this.#identity = identity
      this.#tracked = false
    }
    if (!identity || !phrase || this.#tracked || outcome?.status !== 200
      || outcome.count === null || !Number.isSafeInteger(outcome.count) || outcome.count < 0) return
    this.#tracked = true
    this.send(["setCustomUrl", "/sök"])
    this.send(["trackEvent", "Text search", "search", phrase, outcome.count])
  }

  openResult(event: Pick<MouseEvent, "button">, workId: string, kind: "title" | "hit" | "continuation"): void {
    if (event.button !== 0 && event.button !== 1) return
    this.send(["setCustomUrl", "/sök"])
    this.send(["trackEvent", "Text search", `result_open:${kind}`, workId])
  }
}
