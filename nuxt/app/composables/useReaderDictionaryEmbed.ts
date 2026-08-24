import { ref, type Ref } from "vue"

import type {
  DictionaryLookupOutcome,
  DictionaryLookupSelection
} from "../lib/observability/dictionary-lookup"
import { reportDictionaryLookupOutcome } from "../lib/observability/dictionary-lookup"
import {
  buildReaderDictionaryEmbedUrl,
  parseReaderLookupMessage,
  svenskaReaderEmbedOrigin,
  type ReaderLookupMessage
} from "../lib/reader-dictionary-embed"

export type EmbedStatus = "closed" | "loading" | "result" | "empty" | "error" | "timeout"

export type EmbedSession = {
  requestId: string
  startedAt: number
  src: string
  word: string
}

const LOOKUP_TIMEOUT_MS = 8_000
const localParentHosts = new Set(["localhost", "127.0.0.1", "[::1]"])

function localParentAllowsHttp(): boolean {
  return typeof window !== "undefined" && localParentHosts.has(window.location.hostname)
}

function resultOutcome(message: ReaderLookupMessage): DictionaryLookupOutcome {
  const dictionaries = message.dictionaries ?? []
  if (dictionaries.includes("so") && dictionaries.includes("saob")) return "both"
  return dictionaries[0] === "saob" ? "saob" : "so"
}

class ReaderDictionaryEmbedLifecycle {
  readonly frame: Ref<HTMLIFrameElement | null> = ref(null)
  readonly selectedDictionary: Ref<DictionaryLookupSelection> = ref(null)
  readonly session: Ref<EmbedSession | null> = ref(null)
  readonly status: Ref<EmbedStatus> = ref("closed")
  private activeRequestId: string | null = null
  private terminalReported = false
  private timeout: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly origin: string | null,
    private readonly allowLocalHttp: boolean
  ) {}

  private clearLookupTimeout(): void {
    if (this.timeout === null) return
    clearTimeout(this.timeout)
    this.timeout = null
  }

  private report(
    activeSession: Pick<EmbedSession, "startedAt" | "word">,
    outcome: DictionaryLookupOutcome,
    selection: DictionaryLookupSelection
  ): void {
    void reportDictionaryLookupOutcome({
      durationMs: Math.max(0, Date.now() - activeSession.startedAt),
      outcome,
      selectedDictionary: selection,
      wordLength: activeSession.word.length
    })
  }

  private finish(
    nextStatus: Extract<EmbedStatus, "result" | "empty" | "error" | "timeout">,
    outcome: DictionaryLookupOutcome,
    selection: DictionaryLookupSelection
  ): void {
    const activeSession = this.session.value
    if (!activeSession || this.terminalReported) return
    this.terminalReported = true
    this.clearLookupTimeout()
    this.selectedDictionary.value = selection
    this.status.value = nextStatus
    this.report(activeSession, outcome, selection)
  }

  private invalidate(): void {
    this.clearLookupTimeout()
    this.activeRequestId = null
    this.terminalReported = false
    this.frame.value = null
    this.session.value = null
    this.selectedDictionary.value = null
  }

  close(): void {
    this.invalidate()
    this.status.value = "closed"
  }

  start(word: string): void {
    this.invalidate()
    const requestId = globalThis.crypto.randomUUID()
    const startedAt = Date.now()
    const pending = { startedAt, word }
    this.report(pending, "opened", null)
    const src = this.origin === null
      ? null
      : buildReaderDictionaryEmbedUrl({
          origin: this.origin,
          requestId,
          word,
          allowLocalHttp: this.allowLocalHttp
        })
    if (src === null) {
      this.status.value = "error"
      this.report(pending, "child_error", null)
      return
    }

    this.activeRequestId = requestId
    this.session.value = { requestId, startedAt, src, word }
    this.status.value = "loading"
    this.timeout = setTimeout(() => {
      this.finish("timeout", "timeout", null)
    }, LOOKUP_TIMEOUT_MS)
  }

  handleMessage(event: MessageEvent): void {
    if (
      this.origin === null
      || event.origin !== this.origin
      || event.source !== this.frame.value?.contentWindow
    ) return
    const message = parseReaderLookupMessage(event.data)
    if (
      message === null
      || message.requestId !== this.activeRequestId
      || this.terminalReported
    ) return

    if (message.event === "ready") {
      return
    }
    if (message.event === "result") {
      this.finish("result", resultOutcome(message), message.selectedDictionary ?? null)
      return
    }
    if (message.event === "empty") {
      this.finish("empty", "empty", null)
      return
    }
    this.finish("error", "child_error", null)
  }
}

export function useReaderDictionaryEmbed() {
  const route = useRoute()
  const configuredOrigin = useRuntimeConfig().public.svenskaReaderEmbedOrigin
  const allowLocalHttp = localParentAllowsHttp()
  const origin = svenskaReaderEmbedOrigin(configuredOrigin, { allowLocalHttp })
  const lifecycle = new ReaderDictionaryEmbedLifecycle(origin, allowLocalHttp)
  const close = lifecycle.close.bind(lifecycle)
  const handleMessage = lifecycle.handleMessage.bind(lifecycle)
  const start = lifecycle.start.bind(lifecycle)
  function handleFrameLoad(): void {
    // A cross-origin load event is not an authenticated lookup result.
  }

  watch(() => route.fullPath, close)
  onMounted(() => window.addEventListener("message", handleMessage))
  onBeforeUnmount(() => {
    window.removeEventListener("message", handleMessage)
    close()
  })

  return {
    close,
    frame: lifecycle.frame,
    handleFrameLoad,
    handleMessage,
    selectedDictionary: lifecycle.selectedDictionary,
    session: lifecycle.session,
    start,
    status: lifecycle.status
  }
}
