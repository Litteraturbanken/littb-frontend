<script setup lang="ts">
import { parseHTML } from "linkedom"
import type { LocationQueryRaw, RouteLocationRaw } from "vue-router"

import type {
  ReaderFacsimileSize,
  ReaderPage
} from "#shared/types/reader"
import type { ReaderSourceInfo } from "#shared/types/reader-source-info"
import { readerSliderGeometryStyles } from "#shared/utils/reader-slider"
import dramawebbenLogo from "~/assets/img/dramawebben_svart.svg"
import nyaVagarLogo from "~/assets/img/lb_logga_nyavagar_2.2021.svg"
import { createLbApiClient } from "~/lib/api/client"
import type { components } from "~/lib/api/generated/lbapi"
import { toBoundedDeveloperValue } from "~/lib/quick-search-developer"
import {
  copyProductionValue,
  isProductionShortcutGuarded,
  urnResolverUrl
} from "~/lib/production-shortcuts"
import {
  parseTextSearchReturnHref,
  type TextSearchRouteQuery
} from "~/lib/text-search-navigation"
import {
  readerAuthorHref,
  readerContentsHref,
  readerContentsIsOpen,
  readerContentsNeutralFullPath,
  readerDialogNeutralFullPath,
  readerFullPathWithFragment,
  readerHitHref,
  readerMediaFullPath,
  readerPartAuthorKey,
  readerPageFullPath,
  readerSourceInfoHref,
  readerSourceInfoIsOpen,
  readerSourceInfoNeutralFullPath,
  type ReaderRouteQuery
} from "~/lib/reader-routes"

definePageMeta({
  key: route => [route.params.author, route.params.title, route.params.mediatype].join(":"),
  validate: route => {
    const values = [
      route.params.author,
      route.params.title,
      route.params.page,
      route.params.mediatype
    ]
    return values.every(value => typeof value === "string" && value.length > 0) &&
      (route.params.mediatype === "etext" || route.params.mediatype === "faksimil")
  }
})

const route = useRoute()
const router = useRouter()
const nuxtApp = useNuxtApp()
const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const initialRawFullPath = useState(
  `reader-initial-raw-full-path:${route.path}`,
  () => `${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`
)
const rawFullPath = ref(
  import.meta.client && !nuxtApp.isHydrating
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : initialRawFullPath.value
)
function beforeFragment(fullPath: string): string {
  const fragmentIndex = fullPath.indexOf("#")
  return fragmentIndex < 0 ? fullPath : fullPath.slice(0, fragmentIndex)
}

function readerFocusFullPath(fullPath: string, enabled: boolean): string {
  const fragmentIndex = fullPath.indexOf("#")
  const fragment = fragmentIndex < 0 ? "" : fullPath.slice(fragmentIndex)
  const beforeHash = fragmentIndex < 0 ? fullPath : fullPath.slice(0, fragmentIndex)
  const queryIndex = beforeHash.indexOf("?")
  const path = queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex)
  const segments = queryIndex < 0 || queryIndex === beforeHash.length - 1
    ? []
    : beforeHash.slice(queryIndex + 1).split("&")
  const preserved = segments.filter(segment => {
    const separator = segment.indexOf("=")
    const rawKey = separator < 0 ? segment : segment.slice(0, separator)
    try {
      return decodeURIComponent(rawKey.replace(/\+/g, " ")) !== "fokus"
    } catch {
      return true
    }
  })
  if (enabled) preserved.push("fokus")
  return `${path}${preserved.length ? `?${preserved.join("&")}` : ""}${fragment}`
}

function browserFullPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function navigateRawFullPath(
  fullPath: string,
  replace: boolean,
  previousFullPath = browserFullPath()
): Promise<void> {
  if (!import.meta.client) {
    return (replace ? router.replace(fullPath) : router.push(fullPath))
      .then(() => undefined)
  }

  return new Promise<void>((resolve, reject) => {
    const removeAfterEach = router.afterEach((_to, _from, failure) => {
      removeAfterEach()
      if (failure) reject(failure)
      else resolve()
    })
    try {
      const currentState = window.history.state ?? {}
      let state
      if (replace) {
        state = {
          ...currentState,
          current: fullPath,
          replaced: true
        }
        window.history.replaceState(state, "", fullPath)
      } else {
        window.history.replaceState(
          {
            ...currentState,
            current: previousFullPath,
            forward: fullPath
          },
          "",
          previousFullPath
        )
        state = {
          back: previousFullPath,
          current: fullPath,
          forward: null,
          position: typeof currentState.position === "number"
            ? currentState.position + 1
            : window.history.length,
          replaced: false,
          scroll: null
        }
        window.history.pushState(state, "", fullPath)
      }
      window.dispatchEvent(new PopStateEvent("popstate", { state }))
    } catch (error) {
      removeAfterEach()
      reject(error)
    }
  })
}

watch(() => route.fullPath, (nextRouteFullPath, previousRouteFullPath) => {
  if (!import.meta.client) {
    rawFullPath.value = nextRouteFullPath
    return
  }
  const nextBrowserFullPath = browserFullPath()
  rawFullPath.value = previousRouteFullPath !== undefined &&
    beforeFragment(previousRouteFullPath) === beforeFragment(nextRouteFullPath)
    ? readerFullPathWithFragment(rawFullPath.value, nextBrowserFullPath)
    : nextBrowserFullPath
}, { flush: "sync" })

const dialogNeutralIdentity = computed(
  () => readerDialogNeutralFullPath(rawFullPath.value)
)
const contentsNeutralFullPath = computed(
  () => readerContentsNeutralFullPath(rawFullPath.value)
)
const contentsRequested = computed(() => readerContentsIsOpen(route.query.innehall))
const contentsHref = computed(() => readerContentsHref(rawFullPath.value))
const sourceInfoRequested = computed(
  () => readerSourceInfoIsOpen(route.query["om-boken"])
)
const sourceInfoHref = computed(() => readerSourceInfoHref(rawFullPath.value))
const sourceInfoNeutralFullPath = computed(
  () => readerSourceInfoNeutralFullPath(rawFullPath.value)
)

type WorkSearchHit = components["schemas"]["WorkSearchHit"]
type WorkSearchHitsResponse = components["schemas"]["WorkSearchHitsResponse"]
type SimilarWork = components["schemas"]["SimilarWork"]
type SimilarWorksResponse = components["schemas"]["SimilarWorksResponse"]

type CanonicalSearchState = Readonly<{
  query: string
  hit: number
  wordForms: boolean
  includeOlderSpellings: boolean
  prefix: boolean
  suffix: boolean
}>

const canonicalSearchKeys = [
  "q",
  "hit",
  "lemma",
  "ej_modern",
  "prefix",
  "suffix"
] as const
const wordIdPattern = /^w(?<page>[0-9]+)_(?<ordinal>[0-9]+)$/
const maximumHitOffset = 1_000_000
const maximumNavigableHit = maximumHitOffset + 1

function parseCanonicalSearchState(): CanonicalSearchState | null {
  for (const key of canonicalSearchKeys) {
    const value = route.query[key]
    if (Array.isArray(value) || (value !== undefined && typeof value !== "string")) {
      return null
    }
  }

  const rawQuery = route.query.q
  const rawHit = route.query.hit
  if (typeof rawQuery !== "string" || typeof rawHit !== "string") return null

  const query = rawQuery.trim()
  if (query.length < 1 || query.length > 200) return null
  if (!/^(?:0|[1-9]\d*)$/.test(rawHit)) return null

  const hit = Number(rawHit)
  if (!Number.isSafeInteger(hit) || hit < 0 || Math.max(hit - 1, 0) > maximumHitOffset) {
    return null
  }

  for (const key of ["lemma", "ej_modern", "prefix", "suffix"] as const) {
    const value = route.query[key]
    if (value !== undefined && value !== "1") return null
  }

  return Object.freeze({
    query,
    hit,
    wordForms: route.query.lemma === "1",
    includeOlderSpellings: route.query.ej_modern !== "1",
    prefix: route.query.prefix === "1",
    suffix: route.query.suffix === "1"
  })
}

function preservedQuery(): ReaderRouteQuery {
  return Object.fromEntries(
    Object.entries(route.query)
      .filter(([key]) => key !== "innehall" && key !== "om-boken")
      .map(([key, value]) => [
        key,
        Array.isArray(value)
          ? value.map(item => item ?? "")
          : value ?? ""
      ])
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum
}

function exactObjectKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && expected.every(key => keys.includes(key))
}

function isReaderSegment(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 200
    && value.trim() === value
    && value !== "."
    && value !== ".."
    && !/[\\/%\p{Cc}\p{Cs}]/u.test(value)
}

function isReaderLabel(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 20_000
    && value.trim() === value
    && !/[\p{Cc}\p{Cs}]/u.test(value)
}

function isSimilarWork(value: unknown): value is SimilarWork {
  if (!isRecord(value) || !exactObjectKeys(value, [
    "author_id",
    "author_surname",
    "title_id",
    "start_page",
    "media_type",
    "label"
  ])) return false
  return isReaderSegment(value.author_id)
    && isReaderLabel(value.author_surname)
    && isReaderSegment(value.title_id)
    && isReaderSegment(value.start_page)
    && (value.media_type === "etext" || value.media_type === "faksimil")
    && isReaderLabel(value.label)
}

function isSimilarWorksResponse(value: unknown): value is SimilarWorksResponse {
  return isRecord(value)
    && exactObjectKeys(value, ["items"])
    && Array.isArray(value.items)
    && value.items.length <= 5
    && value.items.every(isSimilarWork)
}

type ReaderWordPosition = Readonly<{
  scope: string
  ordinal: number
  pageIndex: number | null
}>

function readerWordPosition(value: string, workId: string): ReaderWordPosition | null {
  const pageMatch = wordIdPattern.exec(value)
  if (pageMatch?.groups) {
    const pageIndex = Number(pageMatch.groups.page)
    const ordinal = Number(pageMatch.groups.ordinal)
    return Number.isSafeInteger(pageIndex) && Number.isSafeInteger(ordinal)
      ? { scope: `page:${pageMatch.groups.page}`, ordinal, pageIndex }
      : null
  }

  const prefix = `${workId}_`
  if (!workId || !value.startsWith(prefix)) return null
  const rawOrdinal = value.slice(prefix.length)
  if (!/^[0-9]+$/.test(rawOrdinal)) return null
  const ordinal = Number(rawOrdinal)
  return Number.isSafeInteger(ordinal)
    ? { scope: `work:${workId}`, ordinal, pageIndex: null }
    : null
}

function isWorkSearchHit(value: unknown, workId: string): value is WorkSearchHit {
  if (!isRecord(value)) return false
  if (
    !isSafeInteger(value.index) ||
    typeof value.page_name !== "string" ||
    value.page_name.trim().length < 1 ||
    value.page_name.length > 100 ||
    !isSafeInteger(value.page_index) ||
    !isRecord(value.highlight)
  ) return false

  const { from_word_id: fromWordId, to_word_id: toWordId } = value.highlight
  if (
    typeof fromWordId !== "string" ||
    typeof toWordId !== "string" ||
    fromWordId.length > 100 ||
    toWordId.length > 100
  ) return false

  const fromPosition = readerWordPosition(fromWordId, workId)
  const toPosition = readerWordPosition(toWordId, workId)
  if (!fromPosition || !toPosition || fromPosition.scope !== toPosition.scope ||
    fromPosition.ordinal > toPosition.ordinal) return false

  const expectedPageScopes = new Set([`page:${value.page_index}`])
  if (/^[0-9]+$/.test(value.page_name)) expectedPageScopes.add(`page:${value.page_name}`)
  return (fromPosition.pageIndex === null || expectedPageScopes.has(fromPosition.scope)) &&
    (toPosition.pageIndex === null || expectedPageScopes.has(toPosition.scope))
}

function isExpectedHitResponse(
  value: unknown,
  state: CanonicalSearchState,
  offset: number,
  workId: string,
  limit = 3
): value is WorkSearchHitsResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) return false
  if (
    value.query !== state.query ||
    value.media_type !== "etext" ||
    value.offset !== offset ||
    value.limit !== limit ||
    !isSafeInteger(value.total_hits) ||
    value.items.length > limit
  ) return false

  for (const [position, item] of value.items.entries()) {
    if (
      !isWorkSearchHit(item, workId) ||
      item.index !== offset + position ||
      item.index >= value.total_hits
    ) return false
  }
  return true
}

function markReaderHtml(
  html: string,
  hit: WorkSearchHit,
  pageName: string,
  pageIndex: number
): string {
  if (hit.page_name !== pageName || hit.page_index !== pageIndex) return html

  const { document } = parseHTML(`<div data-reader-highlight-root>${html}</div>`)
  const root = document.querySelector("[data-reader-highlight-root]")
  if (!root) return html

  const spans = Array.from(root.querySelectorAll("span[id]"))
  const startMatches = spans.filter(span => span.getAttribute("id") === hit.highlight.from_word_id)
  const endMatches = spans.filter(span => span.getAttribute("id") === hit.highlight.to_word_id)
  if (startMatches.length === 0 || endMatches.length === 0) return html

  const isValidDuplicateGroup = (matches: typeof spans): boolean => {
    if (matches.length === 1) return true

    const indexes = matches.map(match => spans.indexOf(match))
    return matches.every((match, index) =>
      indexes[index] === indexes[0]! + index &&
      !match.hasAttribute("hidden") &&
      match.getAttribute("aria-hidden") !== "true" &&
      Boolean(match.textContent?.trim())
    )
  }
  if (!isValidDuplicateGroup(startMatches) || !isValidDuplicateGroup(endMatches)) return html

  const start = spans.indexOf(startMatches[0]!)
  const end = spans.indexOf(endMatches.at(-1)!)
  if (start < 0 || end < start) return html

  for (let index = start; index <= end; index += 1) {
    spans[index]!.classList.add("markee")
    if ((index - start) % 2 === 1) spans[index]!.classList.add("flip")
  }
  return root.innerHTML
}

function routeParam(name: "author" | "title" | "page" | "mediatype"): string {
  const value = route.params[name]
  if (typeof value !== "string" || !value) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  return value
}

const authorParam = computed(() => routeParam("author"))
const titleParam = computed(() => routeParam("title"))
const pageParam = computed(() => routeParam("page"))
const mediaTypeParam = computed(() => routeParam("mediatype"))
const explicitOcrRequested = computed(() => route.query.ocr !== undefined)
const readerRequestIdentity = computed(() => JSON.stringify([
  authorParam.value,
  titleParam.value,
  pageParam.value,
  mediaTypeParam.value
]))
const readerFetchIdentity = ref(readerRequestIdentity.value)
let readerFetchDebounce: ReturnType<typeof setTimeout> | null = null
watch(readerRequestIdentity, identity => {
  if (!import.meta.client) {
    readerFetchIdentity.value = identity
    return
  }
  if (readerFetchDebounce) clearTimeout(readerFetchDebounce)
  readerFetchDebounce = setTimeout(() => {
    readerFetchDebounce = null
    readerFetchIdentity.value = identity
  }, 200)
}, { flush: "sync" })
onBeforeUnmount(() => {
  if (readerFetchDebounce) clearTimeout(readerFetchDebounce)
})
const requestFetch = useRequestFetch()

type CurrentReaderPage =
  | { status: "success", identity: string, reader: ReaderPage }
  | { status: "error", identity: string }

const { data, error } = await useAsyncData<CurrentReaderPage>(
  computed(() => `reader:${readerFetchIdentity.value}`),
  async () => {
    const identity = readerFetchIdentity.value
    const requestParts = JSON.parse(identity) as [string, string, string, string]
    const readerApiUrl = requestParts.map(encodeURIComponent).join("/")
    try {
      const currentReader = await requestFetch<ReaderPage>(`/api/reader/${readerApiUrl}`)
      return { status: "success" as const, identity, reader: currentReader }
    } catch (requestError) {
      if (import.meta.server) throw requestError
      return { status: "error" as const, identity }
    }
  },
  { lazy: true, watch: [readerFetchIdentity] }
)

if (import.meta.server) {
  if (error.value) {
    throw createError({
      statusCode: error.value.statusCode ?? 500,
      statusMessage: error.value.statusMessage ?? "Reader page unavailable"
    })
  }
  if (!data.value || data.value.status !== "success") {
    throw createError({ statusCode: 502, statusMessage: "Reader page unavailable" })
  }
}

const sourceInfoRequestIdentity = computed(() => JSON.stringify([
  authorParam.value,
  titleParam.value,
  mediaTypeParam.value
]))
const initialSourceInfoRequested = sourceInfoRequested.value
type CurrentReaderSourceInfo =
  | {
    status: "success"
    identity: string
    sourceInfo: ReaderSourceInfo
    similarWorks: SimilarWork[]
  }
  | { status: "error", identity: string }

const sourceInfoFetch = await useAsyncData<CurrentReaderSourceInfo>(
  computed(() => `reader-source-info:${sourceInfoRequestIdentity.value}`),
  async () => {
    const identity = sourceInfoRequestIdentity.value
    const sourceInfoApiUrl = [
      "/api/reader/source-info",
      encodeURIComponent(authorParam.value),
      encodeURIComponent(titleParam.value)
    ].join("/")
    try {
      const sourceInfo = await requestFetch<ReaderSourceInfo>(sourceInfoApiUrl, {
        query: { media_type: mediaTypeParam.value },
        retry: 0
      })
      let similarWorks: SimilarWork[] = []
      if (sourceInfo.mediaType === "etext" || sourceInfo.mediaType === "faksimil") {
        try {
          const client = createLbApiClient(
            import.meta.server ? config.apiBase : config.public.apiBase
          )
          const result = await client.GET("/works/{work_id}/similar", {
            params: {
              path: { work_id: sourceInfo.workId },
              query: { media_type: sourceInfo.mediaType }
            },
            redirect: "manual"
          })
          if (!result.error && isSimilarWorksResponse(result.data)) {
            similarWorks = result.data.items
          }
        } catch {
          // Recommendations are optional and must never replace valid source information.
        }
      }
      return { status: "success" as const, identity, sourceInfo, similarWorks }
    } catch {
      return { status: "error" as const, identity }
    }
  },
  { immediate: initialSourceInfoRequested }
)

const sourceInfo = computed(() => {
  const current = sourceInfoFetch.data.value
  return current?.status === "success"
    && current.identity === sourceInfoRequestIdentity.value
    ? current.sourceInfo
    : null
})
const similarWorks = computed(() => {
  const current = sourceInfoFetch.data.value
  return current?.status === "success"
    && current.identity === sourceInfoRequestIdentity.value
    ? current.similarWorks
    : []
})
const sourceInfoFailed = computed(
  () => sourceInfoFetch.data.value?.status === "error"
    && sourceInfoFetch.data.value.identity === sourceInfoRequestIdentity.value
)
const sourceInfoLoading = computed(
  () => sourceInfoRequested.value
    && !sourceInfo.value
    && !sourceInfoFailed.value
    && (sourceInfoFetch.status.value === "idle"
      || sourceInfoFetch.status.value === "pending")
)

watch(sourceInfoRequested, open => {
  if (!open || (import.meta.client && nuxtApp.isHydrating)) return
  const current = sourceInfoFetch.data.value
  if (
    !current
    || current.identity !== sourceInfoRequestIdentity.value
    || current.status === "error"
  ) {
    void sourceInfoFetch.execute()
  }
})

const currentReader = computed(() => {
  const current = data.value
  return current?.status === "success" && current.identity === readerRequestIdentity.value
    ? current.reader
    : null
})
const retainedReaderKey = [authorParam.value, titleParam.value, mediaTypeParam.value].join(":")
const retainedReader = import.meta.client
  ? useState<ReaderPage | null>(`reader-retained:${retainedReaderKey}`, () => currentReader.value)
  : shallowRef<ReaderPage | null>(currentReader.value)
watch(data, current => {
  if (current?.status === "success") {
    retainedReader.value = current.reader
  } else if (current?.status === "error" && current.identity === readerRequestIdentity.value) {
    retainedReader.value = null
  }
}, { immediate: true })
const reader = computed(() => currentReader.value ?? retainedReader.value)
const quickSearchReaderContext = computed(() => {
  const current = reader.value
  if (!current) return null
  const info = current.mediaType === "etext"
    ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== "html"))
    : Object.fromEntries(Object.entries(current).filter(([key]) => key !== "ocrOverlay"))
  return {
    kind: "reader" as const,
    workId: current.workId,
    editorWorkId: current.editorWorkId,
    pageIndex: current.pageIndex,
    mediaType: current.mediaType,
    info: toBoundedDeveloperValue(info)
  }
})
useQuickSearchContextPublisher(quickSearchReaderContext)
const readerLoadStatus = computed(() => {
  const current = data.value
  return current?.identity === readerRequestIdentity.value ? current.status : null
})
watch(readerLoadStatus, (status, _previousStatus, onCleanup) => {
  if (!import.meta.client || !status) return
  const fullPath = route.fullPath
  let cancelled = false
  let frame = 0
  onCleanup(() => {
    cancelled = true
    if (frame) cancelAnimationFrame(frame)
  })
  void nextTick().then(() => {
    if (cancelled) return
    frame = requestAnimationFrame(() => {
      if (!cancelled) {
        void nuxtApp.callHook("reader:page-ready", fullPath, status === "success")
      }
    })
  })
}, { flush: "post", immediate: true })
const contentsOpen = computed(
  () => !sourceInfoRequested.value
    && contentsRequested.value
    && (reader.value?.parts.length ?? 0) > 0
)
const sourceInfoOpen = computed(() => sourceInfoRequested.value && reader.value !== null)
onMounted(() => {
  rawFullPath.value = readerFullPathWithFragment(rawFullPath.value, browserFullPath())
})
const primaryReaderFailed = computed(
  () => data.value?.status === "error" &&
    data.value.identity === readerRequestIdentity.value
)
const etextReader = computed(() => reader.value?.mediaType === "etext" ? reader.value : null)
const facsimileReader = computed(
  () => reader.value?.mediaType === "faksimil" ? reader.value : null
)
const focusMode = computed(() => route.query.fokus !== undefined)
const focusHref = computed(() => readerFocusFullPath(rawFullPath.value, true))
const focusNeutralHref = computed(() => readerFocusFullPath(rawFullPath.value, false))
const focusBarVisible = ref(true)
const focusStateKey = [authorParam.value, titleParam.value, mediaTypeParam.value].join(":")
const focusNightMode = useState(`reader-focus-night:${focusStateKey}`, () => false)
const focusTextScale = useState(`reader-focus-scale:${focusStateKey}`, () => 1)
const focusTextScaleInitialized = useState(
  `reader-focus-scale-initialized:${focusStateKey}`,
  () => false
)
const focusReaderStyle = computed(() => focusMode.value && etextReader.value
  ? {
      transform: `scaleX(${focusTextScale.value}) scaleY(${focusTextScale.value})`,
      transformOrigin: "left top"
    }
  : undefined
)
const ocrMode = computed(() => Boolean(
  explicitOcrRequested.value && facsimileReader.value?.ocrOverlay
))
const searchState = computed(() => etextReader.value?.searchable
  ? parseCanonicalSearchState()
  : null
)
function decodeRawQueryComponent(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "))
  } catch {
    return null
  }
}

function rawReaderReturnQuery(fullPath: string): TextSearchRouteQuery {
  const beforeHash = beforeFragment(fullPath)
  const queryIndex = beforeHash.indexOf("?")
  if (queryIndex < 0) return {}

  const values: string[] = []
  for (const segment of beforeHash.slice(queryIndex + 1).split("&")) {
    const separator = segment.indexOf("=")
    const rawKey = separator < 0 ? segment : segment.slice(0, separator)
    const key = decodeRawQueryComponent(rawKey)
    if (key !== "s_return") continue
    const rawValue = separator < 0 ? "" : segment.slice(separator + 1)
    const value = decodeRawQueryComponent(rawValue)
    if (value === null) return { s_return: null }
    values.push(value)
  }
  if (values.length === 0) return {}
  return { s_return: values.length === 1 ? values[0]! : values }
}
const searchReturnHref = computed(() => parseTextSearchReturnHref(
  rawReaderReturnQuery(rawFullPath.value)
))
const hasActiveSearchOrigin = computed(() => searchReturnHref.value !== null &&
  typeof route.query.q === "string" && typeof route.query.hit === "string"
)
const pageQuery = computed(() => {
  const query = preservedQuery()
  if (searchState.value) {
    query.q = searchState.value.query
    query.hit = String(searchState.value.hit)
  }
  return query
})
const selectedFacsimileSize = computed<ReaderFacsimileSize | null>(() => {
  const currentReader = facsimileReader.value
  if (!currentReader) return null
  const raw = route.query.storlek
  if (typeof raw === "string" && /^[1-5]$/.test(raw)) {
    const size = Number(raw) as ReaderFacsimileSize
    if (currentReader.sources.some(source => source.size === size)) return size
  }
  return currentReader.preferredSize
})
const focusSmallerSizeEnabled = computed(() => {
  const current = selectedFacsimileSize.value
  return current !== null && Boolean(
    facsimileReader.value?.sources.some(source => source.size === current - 1)
  )
})
const focusLargerSizeEnabled = computed(() => {
  const current = selectedFacsimileSize.value
  return current !== null && Boolean(
    facsimileReader.value?.sources.some(source => source.size === current + 1)
  )
})
const focusParts = computed(() => reader.value?.parts.map(part => ({
  href: pageHref(part.startPageName),
  label: part.navTitle || part.shortTitle || part.title
})) ?? [])
const alternateMediaHref = computed(() => {
  const alternate = reader.value?.alternateMedia
  return alternate
    ? readerMediaFullPath(rawFullPath.value, alternate.pageName, alternate.mediaType)
    : null
})
const pageRouteDraftName = ref(pageParam.value)
let pendingPageNavigations = 0
let pageNavigationGeneration = 0
let pageNavigationChain = Promise.resolve()
watch(pageParam, pageName => {
  if (pendingPageNavigations === 0) pageRouteDraftName.value = pageName
}, { flush: "sync" })
function draftAdjacentPageName(direction: -1 | 1): string | null {
  const currentReader = reader.value
  if (!currentReader) return null
  const position = currentReader.pageMap.findIndex(page => page.pageName === pageRouteDraftName.value)
  return currentReader.pageMap[position + direction]?.pageName ?? null
}
const draftPreviousPageName = computed(() => draftAdjacentPageName(-1))
const draftNextPageName = computed(() => draftAdjacentPageName(1))
function queueReaderPage(pageName: string): void {
  const currentReader = reader.value
  if (!currentReader?.pageMap.some(page => page.pageName === pageName)) return
  const generation = ++pageNavigationGeneration
  pageRouteDraftName.value = pageName
  const href = pageHref(pageName)
  pendingPageNavigations += 1
  pageNavigationChain = pageNavigationChain
    .then(async () => {
      try {
        await router.push(href)
      } catch {
        if (generation === pageNavigationGeneration) {
          pageRouteDraftName.value = pageParam.value
        }
      }
    })
    .finally(() => {
      pendingPageNavigations -= 1
      if (pendingPageNavigations === 0) pageRouteDraftName.value = pageParam.value
    })
}
function queueReaderHref(href: string): void {
  const target = reader.value?.pageMap.find(page => pageHref(page.pageName) === href)
  if (target) queueReaderPage(target.pageName)
}
type SliderDraft = Readonly<{
  identity: string
  rawIndex: number
}>

const sliderDraft = ref<SliderDraft | null>(null)
const sliderKeyboardPending = ref(false)
const sliderMaximum = computed(() => reader.value?.sliderMaximum ?? null)
const sliderDraftIndex = computed(() => {
  const draft = sliderDraft.value
  const maximum = sliderMaximum.value
  if (!draft || maximum === null || draft.identity !== readerRequestIdentity.value) return null
  return Math.min(maximum, Math.max(0, draft.rawIndex))
})
const sliderValue = computed(() => sliderDraftIndex.value ?? reader.value?.pageIndex ?? 0)
const sliderPercent = computed(() => {
  const maximum = sliderMaximum.value
  if (sliderDraftIndex.value === null || maximum === null || maximum === 0) return null
  return sliderDraftIndex.value / maximum * 100
})
function sliderPageName(rawIndex: number): string {
  return reader.value?.pageMap.find(page => page.pageIndex === rawIndex)?.pageName ?? String(rawIndex)
}
const sliderValueText = computed(() => `Sida ${sliderPageName(sliderValue.value)}`)
const sliderBubbleStyles = computed(() => {
  if (searchState.value) return { left: "calc(100% - 10px)" }
  if (sliderPercent.value === null) return undefined
  return { left: readerSliderGeometryStyles(sliderPercent.value).selectionWidth }
})
function sliderRawValue(event: Event): number | null {
  const maximum = sliderMaximum.value
  if (maximum === null || !(event.currentTarget instanceof HTMLInputElement)) return null
  const value = event.currentTarget.valueAsNumber
  return Number.isInteger(value) && value >= 0 && value <= maximum ? value : null
}
function previewSlider(rawIndex: number): void {
  sliderDraft.value = {
    identity: readerRequestIdentity.value,
    rawIndex
  }
}
function clearSliderDraft(): void {
  sliderDraft.value = null
  sliderKeyboardPending.value = false
}
function previewSliderInput(event: Event): void {
  const rawIndex = sliderRawValue(event)
  if (rawIndex !== null) previewSlider(rawIndex)
}
function commitSliderDraft(): void {
  const draft = sliderDraft.value
  const currentReader = reader.value
  if (!draft || !currentReader || draft.identity !== readerRequestIdentity.value) {
    clearSliderDraft()
    return
  }
  const target = currentReader.pageMap.find(page => page.pageIndex === draft.rawIndex)
  sliderKeyboardPending.value = false
  if (!target || target.pageName === currentReader.pageName) {
    sliderDraft.value = null
    return
  }
  queueReaderPage(target.pageName)
}
function handleSliderChange(): void {
  if (!sliderKeyboardPending.value) commitSliderDraft()
}
function sliderKeyboardTarget(event: KeyboardEvent): number | null {
  const maximum = sliderMaximum.value
  if (maximum === null || event.altKey || event.ctrlKey || event.metaKey) return null
  const current = sliderValue.value
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowDown":
      return Math.max(0, current - 1)
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(maximum, current + 1)
    case "PageDown":
      return Math.max(0, current - Math.max(1, Math.round(maximum * 0.1)))
    case "PageUp":
      return Math.min(maximum, current + Math.max(1, Math.round(maximum * 0.1)))
    case "Home":
      return 0
    case "End":
      return maximum
    default:
      return null
  }
}
function handleSliderKeydown(event: KeyboardEvent): void {
  const target = sliderKeyboardTarget(event)
  if (target === null) return
  event.preventDefault()
  event.stopPropagation()
  sliderKeyboardPending.value = true
  previewSlider(target)
}
function handleSliderKeyup(event: KeyboardEvent): void {
  if (sliderKeyboardTarget(event) === null || !sliderKeyboardPending.value) return
  event.preventDefault()
  event.stopPropagation()
  commitSliderDraft()
}
const readerSliderStyles = computed(() => {
  // Search-hit mode owns the legacy slider through `.has-search-hit`; avoid
  // inline page-position styles overriding that established visual state.
  if (searchState.value) return { pointer: undefined, selection: undefined }
  const geometry = readerSliderGeometryStyles(
    sliderPercent.value ?? reader.value?.sliderPercent ?? 0
  )
  return {
    pointer: { left: geometry.pointerLeft },
    selection: { width: geometry.selectionWidth }
  }
})
const pageTitle = computed(
  () => reader.value
    ? `${reader.value.title} sida ${reader.value.pageName} ${reader.value.mediaType} | Litteraturbanken`
    : "Litteraturbanken"
)
const currentPart = computed(() => {
  const currentReader = reader.value
  if (!currentReader || currentReader.currentPartIndex === null) return null
  return currentReader.parts[currentReader.currentPartIndex] ?? null
})
const currentPartLabel = computed(() => {
  const part = currentPart.value
  return part ? (part.navTitle || part.shortTitle || part.title) : ""
})

function currentPartAuthorLabel(index: number): string {
  const part = currentPart.value
  const author = part?.authors[index]
  if (!part || !author) return ""
  return part.authors.length === 1
    ? (author.name ?? author.id)
    : (author.surname ?? author.name ?? author.id)
}

const hitFetch = await useAsyncData(
  computed(() => [
        "reader-hit",
        dialogNeutralIdentity.value,
        data.value?.identity ?? "pending",
        data.value?.status === "success" ? data.value.reader.workId : "pending"
      ].join(":")),
      async () => {
        const identity = dialogNeutralIdentity.value
        const state = searchState.value
        const currentReader = data.value
        if (
          !state ||
          currentReader?.status !== "success" ||
          currentReader.identity !== readerRequestIdentity.value ||
          currentReader.reader.mediaType !== "etext"
        ) {
          return { status: "inactive" as const, identity }
        }
        const offset = Math.max(state.hit - 1, 0)
        try {
          const client = createLbApiClient(
            import.meta.server ? config.apiBase : config.public.apiBase
          )
          const result = await client.GET("/works/{work_id}/search-hits", {
            params: {
              path: { work_id: currentReader.reader.workId },
              query: {
                media_type: "etext",
                query: state.query,
                offset,
                limit: 3,
                word_forms: state.wordForms,
                include_older_spellings: state.includeOlderSpellings,
                prefix: state.prefix,
                suffix: state.suffix
              }
            }
          })
          if (result.error || !isExpectedHitResponse(
            result.data,
            state,
            offset,
            currentReader.reader.workId
          )) {
            return { status: "error" as const, identity }
          }
          return { status: "success" as const, identity, response: result.data }
        } catch {
          return { status: "error" as const, identity }
        }
      },
      { watch: [dialogNeutralIdentity, () => data.value?.identity] }
    )

const hitResponse = computed(() => {
  const value = hitFetch.data.value
  return value?.status === "success" &&
    value.identity === dialogNeutralIdentity.value &&
    data.value?.status === "success" &&
    data.value.identity === readerRequestIdentity.value &&
    data.value.reader.mediaType === "etext"
    ? value.response
    : null
})
const hitRequestFailed = computed(
  () => hitFetch.data.value?.status === "error" &&
    hitFetch.data.value.identity === dialogNeutralIdentity.value
)
const activeHit = computed(() => {
  if (!searchState.value || !hitResponse.value) return null
  return hitResponse.value.items.find(item => item.index === searchState.value!.hit) ?? null
})
const selectedSearchHit = computed<WorkSearchHit | null>(() => {
  const currentReader = reader.value
  if (!currentReader?.searchable) return null

  const rawHitIndex = route.query.hit_index
  const rawQuery = route.query.s_query
  const fromWordId = route.query.traff
  const toWordId = route.query.traffslut
  if (
    typeof rawHitIndex !== "string" || !/^(?:0|[1-9]\d*)$/.test(rawHitIndex) ||
    typeof rawQuery !== "string" || rawQuery.trim().length < 1 || rawQuery.length > 200 ||
    route.query.s_lbworkid !== currentReader.workId ||
    (route.query.s_mediatype !== undefined && route.query.s_mediatype !== currentReader.mediaType) ||
    typeof fromWordId !== "string" || typeof toWordId !== "string"
  ) return null

  const hitIndex = Number(rawHitIndex)
  if (!Number.isSafeInteger(hitIndex) || hitIndex > maximumNavigableHit) return null
  const hasCanonicalState = route.query.q !== undefined || route.query.hit !== undefined
  const canonicalState = hasCanonicalState ? parseCanonicalSearchState() : null
  if (hasCanonicalState && (
    !canonicalState || canonicalState.query !== rawQuery || canonicalState.hit !== hitIndex
  )) return null

  const hit: WorkSearchHit = {
    index: hitIndex,
    page_name: currentReader.pageName,
    page_index: currentReader.pageIndex,
    highlight: {
      from_word_id: fromWordId,
      to_word_id: toWordId
    }
  }
  return isWorkSearchHit(hit, currentReader.workId) ? hit : null
})
const previousHit = computed(() => {
  if (!searchState.value || !hitResponse.value) return null
  return hitResponse.value.items.find(
    item => item.index === searchState.value!.hit - 1 && item.index <= maximumNavigableHit
  ) ?? null
})
const nextHit = computed(() => {
  if (!searchState.value || !hitResponse.value) return null
  return hitResponse.value.items.find(
    item => item.index === searchState.value!.hit + 1 && item.index <= maximumNavigableHit
  ) ?? null
})
const markedReaderHtml = computed(() => {
  const currentReader = etextReader.value
  if (!currentReader) return ""
  const hit = selectedSearchHit.value ?? activeHit.value
  if (!hit) return currentReader.html
  return markReaderHtml(
    currentReader.html,
    hit,
    currentReader.pageName,
    currentReader.pageIndex
  )
})
const markedFacsimileReader = computed(() => {
  const currentReader = facsimileReader.value
  const overlay = currentReader?.ocrOverlay
  const hit = selectedSearchHit.value
  if (!currentReader || !overlay || !hit) return currentReader

  return {
    ...currentReader,
    ocrOverlay: {
      ...overlay,
      html: markReaderHtml(
        overlay.html,
        hit,
        currentReader.pageName,
        currentReader.pageIndex
      )
    }
  }
})
const hitPosition = computed(() => {
  if (!searchState.value || !activeHit.value || !hitResponse.value) return null
  return `Sökträff ${searchState.value.hit + 1} av ${hitResponse.value.total_hits}`
})
const hitMessage = computed(() => {
  if (!searchState.value) return null
  if (hitRequestFailed.value) return "Sökträffen kunde inte hämtas."
  if (hitResponse.value && !activeHit.value) return "Ingen sådan sökträff."
  return null
})

const gotoHitInputOpen = ref(false)
const gotoHitOrdinal = ref("")
const gotoHitInput = ref<HTMLInputElement | null>(null)
const gotoHitPending = ref(false)
let hitNavigationGeneration = 0

watch(rawFullPath, () => {
  hitNavigationGeneration += 1
  gotoHitPending.value = false
}, { flush: "sync" })

function toggleGotoHitInput(): void {
  gotoHitInputOpen.value = !gotoHitInputOpen.value
  if (gotoHitInputOpen.value) {
    void nextTick(() => gotoHitInput.value?.focus())
  }
}

async function hitAtIndex(index: number): Promise<WorkSearchHit | null> {
  const state = searchState.value
  const response = hitResponse.value
  const currentReader = data.value
  const sourceIdentity = dialogNeutralIdentity.value
  if (
    !state ||
    !response ||
    index < 0 ||
    index >= response.total_hits ||
    index > maximumNavigableHit ||
    currentReader?.status !== "success" ||
    currentReader.identity !== readerRequestIdentity.value ||
    currentReader.reader.mediaType !== "etext"
  ) return null

  const cached = response.items.find(item => item.index === index)
  if (cached) return cached

  try {
    const client = createLbApiClient(config.public.apiBase)
    const result = await client.GET("/works/{work_id}/search-hits", {
      params: {
        path: { work_id: currentReader.reader.workId },
        query: {
          media_type: "etext",
          query: state.query,
          offset: index,
          limit: 1,
          word_forms: state.wordForms,
          include_older_spellings: state.includeOlderSpellings,
          prefix: state.prefix,
          suffix: state.suffix
        }
      }
    })
    if (
      result.error ||
      !isExpectedHitResponse(result.data, state, index, currentReader.reader.workId, 1) ||
      result.data.total_hits !== response.total_hits
    ) return null
    const latestState = searchState.value
    const latestReader = data.value
    if (
      dialogNeutralIdentity.value !== sourceIdentity ||
      latestReader?.status !== "success" ||
      latestReader.identity !== currentReader.identity ||
      !latestState ||
      latestState.query !== state.query ||
      latestState.hit !== state.hit ||
      latestState.wordForms !== state.wordForms ||
      latestState.includeOlderSpellings !== state.includeOlderSpellings ||
      latestState.prefix !== state.prefix ||
      latestState.suffix !== state.suffix
    ) return null
    return result.data.items[0] ?? null
  } catch {
    return null
  }
}

function rawHitFullPath(hit: Pick<WorkSearchHit, "page_name" | "index">): string {
  const pagePath = readerPageFullPath(rawFullPath.value, hit.page_name)
  const fragmentIndex = pagePath.indexOf("#")
  const fragment = fragmentIndex < 0 ? "" : pagePath.slice(fragmentIndex)
  const beforeHash = fragmentIndex < 0 ? pagePath : pagePath.slice(0, fragmentIndex)
  const queryIndex = beforeHash.indexOf("?")
  if (queryIndex < 0) return `${beforeHash}?hit=${hit.index}${fragment}`

  const path = beforeHash.slice(0, queryIndex)
  const segments = beforeHash.slice(queryIndex + 1).split("&")
  let replaced = false
  const query = segments.map(segment => {
    const separator = segment.indexOf("=")
    const rawKey = separator < 0 ? segment : segment.slice(0, separator)
    let key: string
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, " "))
    } catch {
      return segment
    }
    if (key !== "hit") return segment
    replaced = true
    return `hit=${hit.index}`
  })
  if (!replaced) query.push(`hit=${hit.index}`)
  return `${path}?${query.join("&")}${fragment}`
}

async function navigateToHit(index: number): Promise<void> {
  const generation = ++hitNavigationGeneration
  if (searchState.value?.hit === index) {
    gotoHitInputOpen.value = false
    gotoHitOrdinal.value = ""
    return
  }
  gotoHitPending.value = true
  try {
    const hit = await hitAtIndex(index)
    if (generation !== hitNavigationGeneration) return
    if (!hit) {
      gotoHitInput.value?.focus()
      return
    }
    gotoHitInputOpen.value = false
    gotoHitOrdinal.value = ""
    await navigateRawFullPath(rawHitFullPath(hit), false, rawFullPath.value)
  } finally {
    if (generation === hitNavigationGeneration) gotoHitPending.value = false
  }
}

function submitGotoHit(): void {
  if (!/^[1-9]\d*$/.test(gotoHitOrdinal.value)) {
    gotoHitInput.value?.focus()
    return
  }
  const ordinal = Number(gotoHitOrdinal.value)
  const totalHits = hitResponse.value?.total_hits ?? 0
  if (!Number.isSafeInteger(ordinal) || ordinal > totalHits) {
    gotoHitInput.value?.focus()
    return
  }
  void navigateToHit(ordinal - 1)
}

type WorkSearchOption = "default" | "lemma" | "modernize" | "prefix" | "suffix" | "infix"

const workSearchOpen = ref(false)
const workSearchQuery = ref("")
const workSearchMessage = ref("")
const workSearchInput = ref<HTMLInputElement | null>(null)
const workSearchLemma = ref(false)
const workSearchOlderSpellings = ref(true)
const workSearchPrefix = ref(false)
const workSearchSuffix = ref(false)

const workSearchOptions = computed<ReadonlyArray<{
  key: WorkSearchOption
  label: string
  selected: boolean
}>>(() => [
  {
    key: "default",
    label: "SÖK EFTER ORD ELLER FRAS",
    selected: !workSearchLemma.value && !workSearchPrefix.value && !workSearchSuffix.value
  },
  {
    key: "lemma",
    label: "INKLUDERA BÖJNINGSFORMER",
    selected: workSearchLemma.value
  },
  {
    key: "modernize",
    label: "INKLUDERA ÄLDRE STAVNINGSFORMER",
    selected: workSearchOlderSpellings.value
  },
  {
    key: "prefix",
    label: "SÖK EFTER ORDBÖRJAN",
    selected: workSearchPrefix.value
  },
  {
    key: "suffix",
    label: "SÖK EFTER ORDSLUT",
    selected: workSearchSuffix.value
  },
  {
    key: "infix",
    label: "SÖK EFTER DEL AV ORD",
    selected: workSearchPrefix.value && workSearchSuffix.value
  }
])

function syncWorkSearchFromRoute(): void {
  const query = typeof route.query.q === "string" ? route.query.q : null
  workSearchQuery.value = query?.trim() ?? ""
  workSearchLemma.value = route.query.lemma === "1"
  workSearchOlderSpellings.value = route.query.ej_modern !== "1"
  workSearchPrefix.value = route.query.prefix === "1"
  workSearchSuffix.value = route.query.suffix === "1"
  workSearchMessage.value = ""
}

watch(
  () => [
    route.query.q,
    route.query.lemma,
    route.query.ej_modern,
    route.query.prefix,
    route.query.suffix
  ],
  syncWorkSearchFromRoute,
  { immediate: true }
)

function toggleWorkSearch(): void {
  if (!etextReader.value) return
  workSearchOpen.value = !workSearchOpen.value
  workSearchMessage.value = ""
  if (workSearchOpen.value) {
    syncWorkSearchFromRoute()
    void nextTick(() => workSearchInput.value?.focus())
  }
}

function chooseWorkSearchOption(option: WorkSearchOption): void {
  if (option === "default") {
    workSearchLemma.value = false
    workSearchOlderSpellings.value = false
    workSearchPrefix.value = false
    workSearchSuffix.value = false
    return
  }
  if (option === "lemma") {
    workSearchLemma.value = true
    workSearchOlderSpellings.value = false
    workSearchPrefix.value = false
    workSearchSuffix.value = false
    return
  }
  if (option === "modernize") {
    if (workSearchOlderSpellings.value) {
      workSearchOlderSpellings.value = false
    } else {
      workSearchLemma.value = false
      workSearchOlderSpellings.value = true
      workSearchPrefix.value = false
      workSearchSuffix.value = false
    }
    return
  }
  if (option === "infix") {
    if (!workSearchPrefix.value || !workSearchSuffix.value) {
      workSearchLemma.value = false
      workSearchOlderSpellings.value = false
      workSearchPrefix.value = true
      workSearchSuffix.value = true
    }
    return
  }

  workSearchLemma.value = false
  workSearchOlderSpellings.value = false
  if (option === "prefix") workSearchPrefix.value = !workSearchPrefix.value
  if (option === "suffix") workSearchSuffix.value = !workSearchSuffix.value
}

function activateWorkSearchOption(event: KeyboardEvent, option: WorkSearchOption): void {
  if (event.key !== "Enter" && event.key !== " ") return
  event.preventDefault()
  chooseWorkSearchOption(option)
}

const workSearchQueryKeys = new Set([
  "q",
  "hit",
  "lemma",
  "ej_modern",
  "prefix",
  "suffix"
])

function decodedRawQueryKey(segment: string): string | null {
  const separator = segment.indexOf("=")
  const rawKey = separator < 0 ? segment : segment.slice(0, separator)
  try {
    return decodeURIComponent(rawKey.replace(/\+/g, " "))
  } catch {
    return null
  }
}

function workSearchFullPath(query: string | null): string {
  const fragmentIndex = rawFullPath.value.indexOf("#")
  const fragment = fragmentIndex < 0 ? "" : rawFullPath.value.slice(fragmentIndex)
  const beforeFragment = fragmentIndex < 0
    ? rawFullPath.value
    : rawFullPath.value.slice(0, fragmentIndex)
  const queryIndex = beforeFragment.indexOf("?")
  const path = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex)
  const rawQuery = queryIndex < 0 ? "" : beforeFragment.slice(queryIndex + 1)
  const retained = rawQuery.length === 0
    ? []
    : rawQuery.split("&").filter(segment => {
        const key = decodedRawQueryKey(segment)
        return key === null || !workSearchQueryKeys.has(key)
      })

  if (query !== null) {
    retained.push(new URLSearchParams({ q: query }).toString(), "hit=0")
    if (workSearchLemma.value) retained.push("lemma=1")
    if (!workSearchOlderSpellings.value) retained.push("ej_modern=1")
    if (workSearchPrefix.value) retained.push("prefix=1")
    if (workSearchSuffix.value) retained.push("suffix=1")
  }
  return `${path}${retained.length > 0 ? `?${retained.join("&")}` : ""}${fragment}`
}

function submitWorkSearch(): void {
  const query = workSearchQuery.value.trim()
  if (query.length < 1) {
    workSearchMessage.value = "Ange ett sökord eller en fras."
    workSearchInput.value?.focus()
    return
  }
  if (query.length > 200) {
    workSearchMessage.value = "Sökningen får vara högst 200 tecken."
    workSearchInput.value?.focus()
    return
  }
  workSearchMessage.value = ""
  workSearchQuery.value = query
  void navigateRawFullPath(workSearchFullPath(query), false, rawFullPath.value)
}

function closeWorkSearchHits(): void {
  workSearchOpen.value = false
  workSearchQuery.value = ""
  workSearchMessage.value = ""
  void navigateRawFullPath(workSearchFullPath(null), false, rawFullPath.value)
}

type LastPageView = {
  pageix: number
  pagename: string | undefined
  timestamp: string
  mediatype: "etext" | "faksimil"
  lbworkid: string
  author: string
  label: string
  url: string
}

function writeLastPageView(): void {
  const currentReader = reader.value
  if (!currentReader) return
  const current: LastPageView = {
    pageix: currentReader.pageIndex,
    pagename: currentReader.pageName,
    timestamp: new Date().toISOString(),
    mediatype: currentReader.mediaType,
    lbworkid: currentReader.workId,
    author: authorParam.value,
    label: currentReader.title,
    url: dialogNeutralIdentity.value
  }
  try {
    const raw = localStorage.getItem("lastPageViews")
    let parsed: unknown = []
    if (raw !== null) {
      try {
        parsed = JSON.parse(raw)
      } catch {
        // Malformed legacy data is treated as an empty history.
      }
    }
    const previous = Array.isArray(parsed) ? parsed : []
    const next = [
      current,
      ...previous.filter(value => {
        if (value === null || typeof value !== "object" || Array.isArray(value)) return true
        const record = value as Record<string, unknown>
        return record.lbworkid !== current.lbworkid || record.mediatype !== current.mediatype
      })
    ].slice(0, 50)
    localStorage.setItem("lastPageViews", JSON.stringify(next))
  } catch {
    // A storage failure must not break reading.
  }
}

onMounted(() => {
  if (currentReader.value) writeLastPageView()
})
watch(
  [dialogNeutralIdentity, () => data.value?.identity, () => data.value?.status],
  ([_historyIdentity, identity, status]) => {
    if (status === "success" && identity === readerRequestIdentity.value) {
      writeLastPageView()
    }
  },
  { flush: "post" }
)

useSeoMeta({
  title: pageTitle,
  description: () => reader.value?.description
})

useHead(() => ({
  bodyAttrs: {
    class: [
      "focus page-reading ready",
      focusMode.value ? "reader-focus-mode" : "",
      focusMode.value && etextReader.value && focusNightMode.value ? "night" : "",
      contentsOpen.value || sourceInfoOpen.value ? "modal-open" : ""
    ].filter(Boolean).join(" ")
  },
  meta: currentPart.value?.titleId
    ? [{ name: "part", content: currentPart.value.titleId }]
    : [],
  link: etextReader.value
    ? [
        { rel: "stylesheet", href: etextReader.value.sharedStylesheetUrl },
        { rel: "stylesheet", href: etextReader.value.workStylesheetUrl }
      ]
    : []
}))

function readerTarget(pageName: string, hit?: number): RouteLocationRaw {
  if (hit === undefined) return readerPageFullPath(rawFullPath.value, pageName)
  const query = Object.fromEntries(
    Object.entries(pageQuery.value).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value
    ])
  ) as LocationQueryRaw
  if (hit !== undefined) query.hit = String(hit)
  return {
    name: route.name as string,
    params: {
      author: authorParam.value,
      title: titleParam.value,
      page: pageName,
      mediatype: mediaTypeParam.value
    },
    query
  }
}

function pageHref(pageName: string): string {
  return readerPageFullPath(rawFullPath.value, pageName)
}

function hitHref(hit: WorkSearchHit): string {
  return readerHitHref({
    author: authorParam.value,
    title: titleParam.value,
    page: hit.page_name,
    mediaType: mediaTypeParam.value,
    query: pageQuery.value,
    hit: hit.index
  })
}

function selectFacsimileSize(size: ReaderFacsimileSize): void {
  const currentReader = facsimileReader.value
  const selectedSize = selectedFacsimileSize.value
  if (
    !currentReader ||
    selectedSize === null ||
    Math.abs(size - selectedSize) !== 1 ||
    !currentReader.sources.some(source => source.size === size)
  ) return

  const query = Object.fromEntries(
    Object.entries(preservedQuery()).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value
    ])
  ) as LocationQueryRaw
  query.storlek = String(size)
  void router.replace({
    name: route.name as string,
    params: {
      author: authorParam.value,
      title: titleParam.value,
      page: pageParam.value,
      mediatype: mediaTypeParam.value
    },
    query
  })
}

function activateFocus(): void {
  focusBarVisible.value = true
  focusNightMode.value = false
  void navigateRawFullPath(focusHref.value, true, rawFullPath.value)
}

function closeFocus(): void {
  void navigateRawFullPath(focusNeutralHref.value, true, rawFullPath.value)
}

function toggleFocusBar(): void {
  if (focusMode.value) focusBarVisible.value = !focusBarVisible.value
}

function adjustFocusText(delta: number): void {
  focusTextScale.value = Math.min(2.5, Math.max(0.5, focusTextScale.value + delta))
}

function selectFocusFacsimileSize(delta: -1 | 1): void {
  const current = selectedFacsimileSize.value
  if (current === null) return
  selectFacsimileSize((current + delta) as ReaderFacsimileSize)
}

onMounted(() => {
  if (!focusTextScaleInitialized.value) {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    focusTextScale.value = Math.min(2.5, Math.max(0.5, viewportHeight / 900))
    focusTextScaleInitialized.value = true
  }
})

const showGotoInput = ref(false)
const gotoPage = ref("")
const gotoMessage = ref("")
const gotoInput = ref<HTMLInputElement | null>(null)
const contentsTrigger = ref<HTMLAnchorElement | null>(null)
const titleSourceInfoTrigger = ref<HTMLAnchorElement | null>(null)
const sidebarSourceInfoTrigger = ref<HTMLAnchorElement | null>(null)
let sourceInfoTrigger: HTMLElement | null = null
const contentsPartHrefs = computed(() => reader.value?.parts.map(
  part => readerPageFullPath(rawFullPath.value, part.startPageName)
) ?? [])
let contentsClosePending = false

function openContents(): void {
  if (contentsOpen.value) return
  void navigateRawFullPath(contentsHref.value, true, rawFullPath.value)
}

async function closeContents(): Promise<void> {
  if (!contentsOpen.value || contentsClosePending) return
  contentsClosePending = true
  try {
    await navigateRawFullPath(contentsNeutralFullPath.value, true)
    await nextTick()
    contentsTrigger.value?.focus()
  } finally {
    contentsClosePending = false
  }
}

function openSourceInfo(trigger: HTMLElement | null): void {
  if (sourceInfoOpen.value) return
  sourceInfoTrigger = trigger
  void navigateRawFullPath(sourceInfoHref.value, true, rawFullPath.value)
}

async function closeSourceInfo(): Promise<void> {
  if (!sourceInfoOpen.value) return
  await navigateRawFullPath(sourceInfoNeutralFullPath.value, true)
  await nextTick()
  sourceInfoTrigger?.focus()
  sourceInfoTrigger = null
}

function openSourceInfoFromTitle(): void {
  openSourceInfo(titleSourceInfoTrigger.value)
}

function openSourceInfoFromSidebar(): void {
  openSourceInfo(sidebarSourceInfoTrigger.value)
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const name = target.tagName.toLowerCase()
  return name === "input" || name === "textarea" || name === "select"
    || target.isContentEditable
}

function anotherDialogOwnsFocus(target: EventTarget | null): boolean {
  const focused = target instanceof HTMLElement
    ? target
    : document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  const dialog = focused?.closest<HTMLElement>('[role="dialog"]')
  return Boolean(dialog && !dialog.classList.contains("about"))
}

function readerDialogIsOpen(): boolean {
  return document.body.classList.contains("modal-open")
    || document.querySelector('[role="dialog"][aria-modal="true"]') !== null
}

function keyboardPageTarget(event: KeyboardEvent): string | null {
  const currentReader = reader.value
  if (!currentReader) return null

  if (event.key === "n") return draftNextPageName.value
  if (event.key === "f") return draftPreviousPageName.value
  if (event.key === "m" || event.key === "F16") {
    return currentReader.nextPartPageName
  }
  if (event.key === "d" || event.key === "F15") {
    return currentReader.previousPartPageName
  }

  const forwards = event.key === "ArrowRight"
  const backwards = event.key === "ArrowLeft"
  if (!forwards && !backwards) return null

  if (event.altKey && event.shiftKey) {
    const draftPage = currentReader.pageMap.find(page => page.pageName === pageRouteDraftName.value)
    const targetPageIndex = (draftPage?.pageIndex ?? currentReader.pageIndex) + (forwards ? 10 : -10)
    return currentReader.pageMap.find(page => page.pageIndex === targetPageIndex)?.pageName
      ?? null
  }
  if (event.altKey) {
    return forwards
      ? currentReader.nextPartPageName
      : currentReader.previousPartPageName
  }
  if (event.shiftKey) {
    return forwards
      ? draftNextPageName.value
      : draftPreviousPageName.value
  }

  if (forwards) {
    const atRightEdge = document.body.scrollWidth - window.scrollX === window.innerWidth
    return atRightEdge ? draftNextPageName.value : null
  }
  return window.scrollX < 10 ? draftPreviousPageName.value : null
}

function handleReaderPagingKeydown(event: KeyboardEvent): void {
  if (
    event.defaultPrevented
    || event.isComposing
    || event.ctrlKey
    || event.metaKey
    || isEditableTarget(event.target)
    || isEditableTarget(document.activeElement)
    || readerDialogIsOpen()
  ) return

  const target = keyboardPageTarget(event)
  if (!target) return
  event.preventDefault()
  queueReaderPage(target)
}

const productionShortcutMessage = ref("")
let productionShortcutMessageTimer: ReturnType<typeof setTimeout> | null = null

function showProductionShortcutMessage(message: string): void {
  productionShortcutMessage.value = message
  if (productionShortcutMessageTimer) clearTimeout(productionShortcutMessageTimer)
  productionShortcutMessageTimer = setTimeout(() => {
    productionShortcutMessage.value = ""
    productionShortcutMessageTimer = null
  }, 2200)
}

async function handleProductionShortcutKeydown(event: KeyboardEvent): Promise<void> {
  const currentReader = reader.value
  if (!currentReader || isProductionShortcutGuarded(event)) return

  if (event.key === "i" || event.key === "F17") {
    event.preventDefault()
    const value = currentReader.editorWorkId || currentReader.workId
    showProductionShortcutMessage(
      await copyProductionValue(value) ? "Kopierade lbworkid" : "Kunde inte kopiera lbworkid"
    )
    return
  }
  if (event.key === "u" || event.key === "F21") {
    event.preventDefault()
    const url = urnResolverUrl(currentReader.urn)
    if (!url) {
      showProductionShortcutMessage("Ingen urn hittades")
      return
    }
    showProductionShortcutMessage(
      await copyProductionValue(url) ? "Kopierade urn" : "Kunde inte kopiera urn"
    )
    return
  }
  if (event.key === "å" || event.key === "[") {
    const href = alternateMediaHref.value
    if (!href) return
    event.preventDefault()
    void router.push(href)
  }
}

function handleSourceInfoKeydown(event: KeyboardEvent): void {
  if (
    (event.key !== "o" && event.key !== "F18")
    || event.ctrlKey
    || event.metaKey
    || isEditableTarget(event.target)
    || anotherDialogOwnsFocus(event.target)
  ) return
  event.preventDefault()
  if (sourceInfoOpen.value) {
    void closeSourceInfo()
    return
  }
  openSourceInfo(document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null)
}

onMounted(() => document.addEventListener("keydown", handleSourceInfoKeydown))
onBeforeUnmount(() => document.removeEventListener("keydown", handleSourceInfoKeydown))
onMounted(() => document.addEventListener("keydown", handleReaderPagingKeydown))
onBeforeUnmount(() => document.removeEventListener("keydown", handleReaderPagingKeydown))
onMounted(() => document.addEventListener("keydown", handleProductionShortcutKeydown))
onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleProductionShortcutKeydown)
  if (productionShortcutMessageTimer) clearTimeout(productionShortcutMessageTimer)
})

function selectContentsPage(pageName: string): void {
  const currentReader = reader.value
  if (!currentReader || !currentReader.pageNames.includes(pageName)) return
  void navigateRawFullPath(
    readerPageFullPath(rawFullPath.value, pageName),
    false,
    rawFullPath.value
  )
}

function toggleGoto(): void {
  showGotoInput.value = !showGotoInput.value
  gotoMessage.value = ""
  if (showGotoInput.value) {
    void nextTick(() => gotoInput.value?.focus())
  }
}

function submitGoto(): void {
  const currentReader = reader.value
  if (!currentReader || !currentReader.pageNames.includes(gotoPage.value)) {
    gotoMessage.value = "Sidan finns inte i verket."
    return
  }
  gotoMessage.value = ""
  showGotoInput.value = false
  queueReaderPage(gotoPage.value)
}

watch(readerRequestIdentity, () => {
  clearSliderDraft()
  showGotoInput.value = false
  gotoPage.value = ""
  gotoMessage.value = ""
})
</script>

<template>
  <div class="reader-page">
    <template v-if="reader">
      <section
        :class="[
          'reader_main',
          'state-not-parallel',
          { 'type-faksimil': facsimileReader, focus: focusMode, ocr: ocrMode }
        ]"
        :style="focusReaderStyle"
        :aria-label="`${reader.title}, sida ${reader.pageName}`"
        @click="toggleFocusBar"
      >
        <div v-if="etextReader" class="etext txt" v-html="markedReaderHtml" />
        <ReaderFacsimileImage
          v-else-if="markedFacsimileReader && selectedFacsimileSize"
          :page="markedFacsimileReader"
          :selected-size="selectedFacsimileSize"
          @select-size="selectFacsimileSize"
        />
      </section>

      <ReaderDictionaryLookup />
      <LegacyNotice :message="productionShortcutMessage" />
      <ClientOnly>
        <ReaderFocusControls
          v-if="focusMode"
          :bar-visible="focusBarVisible"
          :larger-size-enabled="focusLargerSizeEnabled"
          :media-type="reader.mediaType"
          :next-href="draftNextPageName ? pageHref(draftNextPageName) : null"
          :night-mode="focusNightMode"
          :parts="focusParts"
          :previous-href="draftPreviousPageName ? pageHref(draftPreviousPageName) : null"
          :smaller-size-enabled="focusSmallerSizeEnabled"
          :start-href="reader.startPageName ? pageHref(reader.startPageName) : null"
          @adjust-text="adjustFocusText"
          @close="closeFocus"
          @navigate="queueReaderHref"
          @select-size="selectFocusFacsimileSize"
          @toggle-night="focusNightMode = !focusNightMode"
        />
      </ClientOnly>

      <div v-if="searchState" class="reader-search-state sr-only" aria-live="polite">
        <p v-if="hitPosition" class="reader-search-position">{{ hitPosition }}</p>
        <p v-if="hitMessage" class="reader-search-message">{{ hitMessage }}</p>
      </div>

      <ClientOnly>
        <Teleport to="#toolkit-right">
          <aside
            class="reader-context"
            :class="{ 'has-search-hit': searchState }"
            aria-label="Läsinformation och sidnavigering"
          >
            <div>
              <div class="author"><ReaderContributors :contributors="reader.contributors" /></div>
              <a
                ref="titleSourceInfoTrigger"
                class="title"
                :href="sourceInfoHref"
                @click.prevent="openSourceInfoFromTitle"
              >{{ reader.title }}</a>
              <span v-if="reader.imprintYear"> ({{ reader.imprintYear }})</span>
            </div>
            <span class="reader-page-position sr-only">{{ reader.pageName }} av {{ reader.pageCount }}</span>

            <hr>

            <div class="current_part">
              <template v-if="currentPart">
                <div class="header">
                  <template
                    v-for="(partAuthor, index) in currentPart.authors"
                    :key="readerPartAuthorKey(partAuthor.id, index)"
                  >
                    <NuxtLink
                      :to="readerAuthorHref(partAuthor.id)"
                    >{{ currentPartAuthorLabel(index) }}</NuxtLink><span
                      v-if="index < currentPart.authors.length - 1"
                    >, </span>
                  </template>
                </div>
                <div
                  :title="currentPart.title !== currentPartLabel ? currentPart.title : undefined"
                ><p class="navtitle line-clamp-4">{{ currentPartLabel }}</p></div>
              </template>
            </div>

            <hr class="lower">

            <nav class="pager_ctrls reader-navigation" aria-label="Sidnavigering">
              <NuxtLink
                v-if="reader.previousPartPageName"
                v-slot="{ navigate }"
                custom
                :to="readerTarget(reader.previousPartPageName)"
              ><a
                class="prev_part"
                :href="pageHref(reader.previousPartPageName)"
                @click="navigate"
              >Gå bakåt en del</a></NuxtLink>
              <a
                v-else
                class="prev_part disabled"
                aria-disabled="true"
                tabindex="-1"
              >Gå bakåt en del</a>
              <br>
              <NuxtLink
                v-if="reader.nextPartPageName"
                v-slot="{ navigate }"
                custom
                :to="readerTarget(reader.nextPartPageName)"
              ><a
                class="next_part"
                :href="pageHref(reader.nextPartPageName)"
                @click="navigate"
              >Gå till nästa del</a></NuxtLink>
              <a
                v-else
                class="next_part disabled"
                aria-disabled="true"
                tabindex="-1"
              >Gå till nästa del</a>
              <br>
              <NuxtLink
                v-if="reader.startPageName && reader.pageName !== reader.startPageName"
                v-slot="{ navigate }"
                custom
                :to="readerTarget(reader.startPageName)"
              ><a
                :href="pageHref(reader.startPageName)"
                @click="navigate"
              >Gå till första sidan</a></NuxtLink>
              <a
                v-else
                class="disabled"
                aria-disabled="true"
                tabindex="-1"
              >Gå till första sidan</a>
              <br>
              <NuxtLink
                v-if="reader.endPageName && reader.pageName !== reader.endPageName"
                v-slot="{ navigate }"
                custom
                :to="readerTarget(reader.endPageName)"
              ><a
                :href="pageHref(reader.endPageName)"
                @click="navigate"
              >Gå till sista sidan</a></NuxtLink>
              <a
                v-else
                class="disabled"
                aria-disabled="true"
                tabindex="-1"
              >Gå till sista sidan</a>
              <br>
              <form class="goto" @submit.prevent="submitGoto"><a href="" @click.prevent="toggleGoto">Gå till sida . . .
                <span class="pages">{{ reader.pageName }} av {{ reader.endPageName || reader.pageCount }}</span></a>
                <template v-if="showGotoInput">
                  <input ref="gotoInput" v-model="gotoPage" type="text" aria-label="Gå till sida">
                  <button type="submit" class="goto-submit" aria-label="Gå"><i class="fa fa-angle-double-right" /></button>
                  <span v-if="gotoMessage" class="goto-message" role="status">{{ gotoMessage }}</span>
                </template>
              </form>

              <a
                v-if="draftPreviousPageName"
                rel="prev"
                :href="pageHref(draftPreviousPageName)"
                aria-label="Föregående sida"
                @click.prevent="queueReaderPage(draftPreviousPageName)"
              ><span class="submit btn navicon navicon-visual left" aria-hidden="true"><i class="fa fa-angle-left" /></span>{{ " " }}</a>
              <a
                v-if="draftNextPageName"
                rel="next"
                :href="pageHref(draftNextPageName)"
                aria-label="Nästa sida"
                @click.prevent="queueReaderPage(draftNextPageName)"
              ><span class="submit btn navicon navicon-visual right" aria-hidden="true"><i class="fa fa-angle-right right" /></span>{{ " " }}</a>

              <span class="expl small" aria-hidden="true">Du kan också bläddra med tangentbordets piltangenter.</span>
            </nav>

            <div class="w-11/12">
              <span
                class="rzslider mt-3 slider-large"
                :class="{ active: sliderDraftIndex !== null }"
              >
                <span class="rz-base" aria-hidden="true">
                  <span class="rz-bar-wrapper"><span class="rz-bar" /></span>
                  <span class="rz-bar-wrapper"><span
                    class="rz-bar rz-selection"
                    :style="readerSliderStyles.selection"
                  /></span>
                </span>
                <span
                  class="rz-pointer rz-pointer-min"
                  :style="readerSliderStyles.pointer"
                  aria-hidden="true"
                />
                <span
                  v-if="sliderDraftIndex !== null"
                  class="rz-bubble rz-model-value"
                  :style="sliderBubbleStyles"
                  aria-hidden="true"
                >{{ sliderPageName(sliderDraftIndex) }}</span>
                <input
                  v-if="sliderMaximum !== null"
                  class="reader-slider-input"
                  type="range"
                  min="0"
                  :max="sliderMaximum"
                  step="1"
                  :value="sliderValue"
                  aria-label="Gå till sida"
                  :aria-valuetext="sliderValueText"
                  @input="previewSliderInput"
                  @change="handleSliderChange"
                  @keydown="handleSliderKeydown"
                  @keyup="handleSliderKeyup"
                  @blur="clearSliderDraft"
                  @pointercancel="clearSliderDraft"
                >
              </span>
            </div>

            <div class="subnav mt-10">
              <ul>
                <li v-if="reader.parts.length">
                  <a
                    ref="contentsTrigger"
                    :href="contentsHref"
                    @click.prevent="openContents"
                  >Innehållsförteckning</a>
                </li>
                <li><a
                  ref="sidebarSourceInfoTrigger"
                  :href="sourceInfoHref"
                  @click.prevent="openSourceInfoFromSidebar"
                >{{ reader.isDrama ? "Mer om pjäsen" : "Mer om boken" }}</a></li>
                <li><a :href="focusHref" @click.prevent="activateFocus">Läsfokus</a></li>
                <li v-if="reader.searchable && etextReader">
                  <a
                    class="reader-work-search-trigger"
                    href=""
                    :aria-expanded="workSearchOpen"
                    @click.prevent="toggleWorkSearch"
                  >Sök i verket</a>
                  <div v-show="workSearchOpen" class="searchbox">
                    <div class="collapse-content">
                      <div class="header">
                        <div class="auth">
                          Sök i <span class="author"><ReaderContributors
                            :contributors="reader.contributors"
                          /></span>
                        </div>
                        <div class="title">{{ reader.title }}</div>
                      </div>
                      <div
                        class="ctrls"
                        :class="{ searching: hitFetch.status.value === 'pending' }"
                      >
                        <form @submit.prevent="submitWorkSearch">
                          <input
                            ref="workSearchInput"
                            v-model="workSearchQuery"
                            class="border border-gray-300"
                            type="search"
                            aria-label="Sök i verket"
                          >
                          <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
                          <button type="submit" class="submit btn">Sök</button>
                        </form>
                        <p v-if="workSearchMessage" class="work-search-message" role="status">
                          {{ workSearchMessage }}
                        </p>
                        <ul class="search_opts_widget inline-block">
                          <li
                            v-for="option in workSearchOptions"
                            :key="option.key"
                            class="hover:text-primary"
                          >
                            <span aria-hidden="true"><span>{{ option.selected ? "✓" : "" }}</span></span>
                            <span
                              role="checkbox"
                              :aria-checked="option.selected"
                              tabindex="0"
                              @click="chooseWorkSearchOption(option.key)"
                              @keydown="activateWorkSearchOption($event, option.key)"
                            >{{ option.label }}</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </li>
                <li v-else aria-disabled="true">
                  <a class="disabled" aria-disabled="true" tabindex="-1">Sök i verket</a>
                </li>
                <li>
                  <NuxtLink :to="{ path: '/s%C3%B6k', query: { avancerad: null, forfattare: reader.author.id } }">
                    Sök i författarens texter
                  </NuxtLink>
                </li>
                <li v-if="reader.hasDramawebben">
                  <NuxtLink class="inline-block" to="/dramawebben"><img
                    class="dw_logo"
                    :src="dramawebbenLogo"
                    alt="Dramawebben logotyp"
                  ></NuxtLink>
                </li>
                <li v-if="reader.hasNyaVagar" class="-ml-px">
                  <a
                    class="block w-3/6 -ml-3 reader-nya-vagar"
                    href="https://litteraturbanken.se/diktensmuseum/nya-vagar-inledning/"
                  ><img
                    class="object-contain"
                    :src="nyaVagarLogo"
                    alt="Logotyp för Nya vägar"
                  ></a>
                </li>
              </ul>
            </div>
          </aside>
        </Teleport>
        <Teleport v-if="searchState || hasActiveSearchOrigin" to="#toolkit">
        <i
          v-if="searchState"
          class="spinner_search fa fa-spinner fa-pulse"
          :class="{ searching: hitFetch?.status.value === 'pending' }"
          aria-hidden="true"
        />
        <nav id="search_nav" class="active" aria-label="Sökträffsnavigering">
          <div v-if="searchState && hitResponse" class="text">
            <div>
              <span class="num">{{ hitResponse.total_hits }}</span>
              {{ hitResponse.total_hits === 1 ? "sökträff" : "sökträffar" }}
            </div>
            <div v-if="activeHit">
              Träff <span>{{ activeHit.index + 1 }}</span>, sida {{ reader.pageName }}
            </div>
          </div>
          <p v-else-if="searchState && hitMessage" class="text">{{ hitMessage }}</p>
          <ul class="ctrls">
            <template v-if="searchState">
            <li class="arrows">
              <NuxtLink
                v-if="previousHit"
                v-slot="{ navigate }"
                custom
                :to="readerTarget(previousHit.page_name, previousHit.index)"
              ><a
                rel="prev"
                :href="hitHref(previousHit)"
                aria-label="Föregående sökträff"
                @click="navigate"
              ><span class="submit btn navicon navicon-visual left" aria-hidden="true"><i class="fa fa-angle-left" /></span></a></NuxtLink>
              <button v-else rel="prev" class="submit btn navicon left" disabled aria-hidden="true" tabindex="-1"><i class="fa fa-angle-left" /></button>
              <NuxtLink
                v-if="nextHit"
                v-slot="{ navigate }"
                custom
                :to="readerTarget(nextHit.page_name, nextHit.index)"
              ><a
                rel="next"
                :href="hitHref(nextHit)"
                aria-label="Nästa sökträff"
                @click="navigate"
              ><span class="submit btn navicon navicon-visual" aria-hidden="true"><i class="fa fa-angle-right" /></span></a></NuxtLink>
              <button v-else rel="next" class="submit btn navicon" disabled aria-hidden="true" tabindex="-1"><i class="fa fa-angle-right" /></button>
            </li>
            <li><a href="" @click.prevent="navigateToHit(0)">Gå till första träffen</a></li>
            <li><a
              href=""
              @click.prevent="navigateToHit((hitResponse?.total_hits ?? 0) - 1)"
            >Gå till sista träffen</a></li>
            <li :class="{ open: gotoHitInputOpen }">
              <a href="" @click.prevent="toggleGotoHitInput">Gå direkt till träff . . .</a>
              <form v-show="gotoHitInputOpen" @submit.prevent="submitGotoHit">
                <input
                  ref="gotoHitInput"
                  v-model="gotoHitOrdinal"
                  class="border border-gray-300"
                  type="text"
                  aria-label="Träffnummer"
                >
                <i v-show="gotoHitInputOpen" class="fa fa-angle-double-right" />
              </form>
            </li>
            </template>
            <li><a href="" @click.prevent="closeWorkSearchHits">Stäng träffvisningen</a></li>
            <li v-if="searchReturnHref">
              <NuxtLink :to="searchReturnHref">Tillbaka till sökningen</NuxtLink>
            </li>
          </ul>
        </nav>
        </Teleport>
        <template #fallback>
          <aside class="reader-context-ssr" aria-label="Läsinformation och sidnavigering">
            <span class="author"><ReaderContributors
              :contributors="reader.contributors"
            /></span>
            <span><a :href="sourceInfoHref">{{ reader.title }}</a><template
              v-if="reader.imprintYear"
            > ({{ reader.imprintYear }})</template></span>
            <nav aria-label="Sidnavigering">
              <a
                v-if="reader.previousPageName"
                :href="pageHref(reader.previousPageName)"
              >Föregående sida</a>
              <a
                v-if="reader.nextPageName"
                :href="pageHref(reader.nextPageName)"
              >Nästa sida</a>
            </nav>
            <span class="reader-page-position">{{ reader.pageName }} av {{ reader.pageCount }}</span>
            <a
              v-if="reader.parts.length"
              :href="contentsHref"
            >Innehållsförteckning</a>
            <a :href="sourceInfoHref">{{ reader.isDrama ? "Mer om pjäsen" : "Mer om boken" }}</a>
            <a :href="focusHref">Läsfokus</a>
            <span
              class="reader-work-search-trigger"
              :class="{ disabled: !reader.searchable || !etextReader }"
            >Sök i verket</span>
            <!-- Progressive-enhancement fallback: native before hydration. -->
            <a v-if="reader.hasDramawebben" href="/dramawebben"><img
              class="dw_logo"
              :src="dramawebbenLogo"
              alt="Dramawebben logotyp"
            ></a>
            <a
              v-if="reader.hasNyaVagar"
              class="reader-nya-vagar"
              href="https://litteraturbanken.se/diktensmuseum/nya-vagar-inledning/"
            ><img :src="nyaVagarLogo" alt="Logotyp för Nya vägar"></a>
            <nav
              v-if="previousHit || nextHit"
              class="reader-hit-navigation"
              aria-label="Sökträffsnavigering"
            >
              <a
                v-if="previousHit"
                rel="prev"
                :href="hitHref(previousHit)"
              >Föregående sökträff</a>
              <a
                v-if="nextHit"
                rel="next"
                :href="hitHref(nextHit)"
              >Nästa sökträff</a>
            </nav>
          </aside>
        </template>
      </ClientOnly>
      <ClientOnly>
        <ReaderContentsDialog
          :open="contentsOpen"
          :contributors="reader.contributors"
          :title="reader.fullTitle"
          :imprint-year="reader.imprintYear"
          :parts="reader.parts"
          :part-hrefs="contentsPartHrefs"
          @close="closeContents"
          @select-page="selectContentsPage"
        />
      </ClientOnly>
      <ReaderSourceInfoDialog
        :open="sourceInfoOpen"
        :loading="sourceInfoLoading"
        :failed="sourceInfoFailed"
        :source-info="sourceInfo"
        :similar-works="similarWorks"
        @close="closeSourceInfo"
      />
    </template>
    <p
      v-else-if="primaryReaderFailed"
      class="reader-primary-error"
      role="alert"
    >Läsarsidan kunde inte hämtas.</p>
  </div>
</template>
