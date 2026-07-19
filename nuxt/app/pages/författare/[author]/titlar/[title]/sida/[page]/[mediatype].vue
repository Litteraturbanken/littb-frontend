<script setup lang="ts">
import { parseHTML } from "linkedom"
import type { LocationQueryRaw, RouteLocationRaw } from "vue-router"

import type {
  ReaderFacsimileSize,
  ReaderPage
} from "#shared/types/reader"
import type { ReaderSourceInfo } from "#shared/types/reader-source-info"
import { readerAuthorContributionSuffix } from "#shared/utils/reader-author"
import { readerSliderGeometryStyles } from "#shared/utils/reader-slider"
import dramawebbenLogo from "~/assets/img/dramawebben_svart.svg"
import { createLbApiClient } from "~/lib/api/client"
import type { components } from "~/lib/api/generated/lbapi"
import {
  readerAuthorHref,
  readerContentsHref,
  readerContentsIsOpen,
  readerContentsNeutralFullPath,
  readerDialogNeutralFullPath,
  readerFullPathWithFragment,
  readerHitHref,
  readerPartAuthorKey,
  readerPageFullPath,
  readerSourceInfoHref,
  readerSourceInfoIsOpen,
  readerSourceInfoNeutralFullPath,
  type ReaderRouteQuery
} from "~/lib/reader-routes"

definePageMeta({
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

  const expectedPageScope = `page:${value.page_index}`
  return (fromPosition.pageIndex === null || fromPosition.scope === expectedPageScope) &&
    (toPosition.pageIndex === null || toPosition.scope === expectedPageScope)
}

function isExpectedHitResponse(
  value: unknown,
  state: CanonicalSearchState,
  offset: number,
  workId: string
): value is WorkSearchHitsResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) return false
  if (
    value.query !== state.query ||
    value.media_type !== "etext" ||
    value.offset !== offset ||
    value.limit !== 3 ||
    !isSafeInteger(value.total_hits) ||
    value.items.length > 3
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
  if (startMatches.length !== 1 || endMatches.length !== 1) return html

  const start = spans.indexOf(startMatches[0]!)
  const end = spans.indexOf(endMatches[0]!)
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
const readerRequestIdentity = computed(() => JSON.stringify([
  authorParam.value,
  titleParam.value,
  pageParam.value,
  mediaTypeParam.value
]))
const requestFetch = useRequestFetch()

type CurrentReaderPage =
  | { status: "success", identity: string, reader: ReaderPage }
  | { status: "error", identity: string }

const { data, error } = await useAsyncData<CurrentReaderPage>(
  computed(() => `reader:${readerRequestIdentity.value}`),
  async () => {
    const identity = readerRequestIdentity.value
    const readerApiUrl = [
      authorParam.value,
      titleParam.value,
      pageParam.value,
      mediaTypeParam.value
    ].map(encodeURIComponent).join("/")
    try {
      const currentReader = await requestFetch<ReaderPage>(`/api/reader/${readerApiUrl}`)
      return { status: "success" as const, identity, reader: currentReader }
    } catch (requestError) {
      if (import.meta.server) throw requestError
      return { status: "error" as const, identity }
    }
  },
  { lazy: true, watch: [readerRequestIdentity] }
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
  | { status: "success", identity: string, sourceInfo: ReaderSourceInfo }
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
      return { status: "success" as const, identity, sourceInfo }
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

const reader = computed(() => {
  const current = data.value
  return current?.status === "success" && current.identity === readerRequestIdentity.value
    ? current.reader
    : null
})
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
const searchState = computed(() => etextReader.value?.searchable
  ? parseCanonicalSearchState()
  : null
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
const authorHref = computed(() => reader.value
  ? readerAuthorHref(authorParam.value)
  : ""
)
const readerAuthorSuffix = computed(() => {
  const author = reader.value?.author
  return author
    ? readerAuthorContributionSuffix(author.authorType, author.role)
    : null
})
const readerSliderStyles = computed(() => {
  // Search-hit mode owns the legacy slider through `.has-search-hit`; avoid
  // inline page-position styles overriding that established visual state.
  if (searchState.value) return { pointer: undefined, selection: undefined }
  const geometry = readerSliderGeometryStyles(reader.value?.sliderPercent ?? 0)
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
  if (!activeHit.value) return currentReader.html
  return markReaderHtml(
    currentReader.html,
    activeHit.value,
    currentReader.pageName,
    currentReader.pageIndex
  )
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

onMounted(writeLastPageView)
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
    class: contentsOpen.value || sourceInfoOpen.value
      ? "focus page-reading ready modal-open"
      : "focus page-reading ready"
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

  const forwards = event.key === "ArrowRight"
  const backwards = event.key === "ArrowLeft"
  if (!forwards && !backwards) return null

  if (event.altKey && event.shiftKey) {
    const targetPageIndex = currentReader.pageIndex + (forwards ? 10 : -10)
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
      ? currentReader.nextPageName
      : currentReader.previousPageName
  }

  if (forwards) {
    const atRightEdge = document.body.scrollWidth - window.scrollX === window.innerWidth
    return atRightEdge ? currentReader.nextPageName : null
  }
  return window.scrollX < 10 ? currentReader.previousPageName : null
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
  void navigateRawFullPath(pageHref(target), false, rawFullPath.value)
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
onBeforeRouteLeave(() => document.removeEventListener("keydown", handleReaderPagingKeydown))

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
  void router.push(readerTarget(gotoPage.value))
}

watch(readerRequestIdentity, () => {
  showGotoInput.value = false
  gotoPage.value = ""
  gotoMessage.value = ""
})
</script>

<template>
  <div class="reader-page">
    <template v-if="reader">
      <section
        class="reader_main state-not-parallel"
        :class="{ 'type-faksimil': facsimileReader }"
        :aria-label="`${reader.title}, sida ${reader.pageName}`"
      >
        <div v-if="etextReader" class="etext txt" v-html="markedReaderHtml" />
        <ReaderFacsimileImage
          v-else-if="facsimileReader && selectedFacsimileSize"
          :page="facsimileReader"
          :selected-size="selectedFacsimileSize"
          @select-size="selectFacsimileSize"
        />
      </section>

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
              <div class="author"><a :href="authorHref">{{ reader.author.name }}{{
                readerAuthorSuffix ? " " : ""
              }}<span v-if="readerAuthorSuffix" class="authortype">{{ readerAuthorSuffix }}</span></a></div>
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
                    <a
                      :href="readerAuthorHref(partAuthor.id)"
                    >{{ currentPartAuthorLabel(index) }}</a><span
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

              <NuxtLink
                v-if="reader.previousPageName"
                v-slot="{ navigate }"
                custom
                :to="readerTarget(reader.previousPageName)"
              ><a
                rel="prev"
                :href="pageHref(reader.previousPageName)"
                aria-label="Föregående sida"
                @click="navigate"
              ><span class="submit btn navicon navicon-visual left" aria-hidden="true"><i class="fa fa-angle-left" /></span>{{ " " }}</a></NuxtLink>
              <NuxtLink
                v-if="reader.nextPageName"
                v-slot="{ navigate }"
                custom
                :to="readerTarget(reader.nextPageName)"
              ><a
                rel="next"
                :href="pageHref(reader.nextPageName)"
                aria-label="Nästa sida"
                @click="navigate"
              ><span class="submit btn navicon navicon-visual right" aria-hidden="true"><i class="fa fa-angle-right right" /></span>{{ " " }}</a></NuxtLink>

              <span class="expl small" aria-hidden="true">Du kan också bläddra med tangentbordets piltangenter.</span>
            </nav>

            <div class="w-11/12" aria-hidden="true">
              <span class="rzslider mt-3 slider-large">
                <span class="rz-base">
                  <span class="rz-bar-wrapper"><span class="rz-bar" /></span>
                  <span class="rz-bar-wrapper"><span
                    class="rz-bar rz-selection"
                    :style="readerSliderStyles.selection"
                  /></span>
                </span>
                <span
                  class="rz-pointer rz-pointer-min"
                  :style="readerSliderStyles.pointer"
                />
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
                <li aria-hidden="true">Läsfokus</li>
                <li v-if="etextReader && reader.searchable">
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
                          Sök i <span class="author">{{ reader.author.name }}</span>
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
                <li aria-hidden="true">Sök i författarens texter</li>
                <li v-if="reader.hasDramawebben">
                  <a href="/dramawebben"><img
                    class="dw_logo"
                    :src="dramawebbenLogo"
                    alt="Dramawebben logotyp"
                  ></a>
                </li>
              </ul>
            </div>
          </aside>
        </Teleport>
        <Teleport v-if="searchState" to="#toolkit">
        <i
          class="spinner_search fa fa-spinner fa-pulse"
          :class="{ searching: hitFetch?.status.value === 'pending' }"
          aria-hidden="true"
        />
        <nav id="search_nav" class="active" aria-label="Sökträffsnavigering">
          <div v-if="hitResponse" class="text">
            <div>
              <span class="num">{{ hitResponse.total_hits }}</span>
              {{ hitResponse.total_hits === 1 ? "sökträff" : "sökträffar" }}
            </div>
            <div v-if="activeHit">
              Träff <span>{{ activeHit.index + 1 }}</span>, sida {{ reader.pageName }}
            </div>
          </div>
          <p v-else-if="hitMessage" class="text">{{ hitMessage }}</p>
          <ul class="ctrls">
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
            <li><a aria-hidden="true">Gå till första träffen</a></li>
            <li><a aria-hidden="true">Gå till sista träffen</a></li>
            <li><a aria-hidden="true">Gå direkt till träff . . .</a></li>
            <li><a href="" @click.prevent="closeWorkSearchHits">Stäng träffvisningen</a></li>
          </ul>
        </nav>
        </Teleport>
        <template #fallback>
          <aside class="reader-context-ssr" aria-label="Läsinformation och sidnavigering">
            <a :href="authorHref">{{ reader.author.name }}{{
              readerAuthorSuffix ? " " : ""
            }}<span v-if="readerAuthorSuffix" class="authortype">{{ readerAuthorSuffix }}</span></a>
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
            <span
              class="reader-work-search-trigger"
              :class="{ disabled: !reader.searchable || !etextReader }"
            >Sök i verket</span>
            <a v-if="reader.hasDramawebben" href="/dramawebben"><img
              class="dw_logo"
              :src="dramawebbenLogo"
              alt="Dramawebben logotyp"
            ></a>
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
          :author-name="reader.author.name"
          :author-href="authorHref"
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
        @close="closeSourceInfo"
      />
    </template>
    <p
      v-else-if="primaryReaderFailed"
      class="reader-primary-error"
      role="alert"
    >Läsarsidan kunde inte hämtas.</p>
    <p
      v-else
      class="reader-primary-loading"
      role="status"
      aria-live="polite"
    >Hämtar läsarsidan …</p>
  </div>
</template>
