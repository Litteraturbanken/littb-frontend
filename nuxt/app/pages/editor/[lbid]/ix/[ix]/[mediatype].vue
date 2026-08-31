<script setup lang="ts">
import type { EditorReaderPage } from "#shared/types/editor-reader"
import type { ReaderSourceInfo } from "#shared/types/reader-source-info"
import { isEditorRouteIdentity } from "#shared/utils/editor-route-identity"
import { preferredFacsimileSize } from "#shared/utils/facsimile-source"
import { readerSliderGeometryStyles } from "#shared/utils/reader-slider"
import { useLbApiClient } from "~/composables/useLbApiClient"
import type { components } from "~/lib/api/generated/lbapi"
import { isSnapshotUnavailable } from "~/lib/api/snapshot"
import { isTextSearchSnapshot } from "~/lib/text-search"
import {
  markEditorEtextHtml,
  markReaderOcrHtml
} from "~/lib/search-hit-highlight"
import {
  horizontalScrollEdge,
  keyboardNavigationAction,
  type KeyboardNavigationAction,
  type KeyboardNavigationDirection
} from "~/lib/reader-keyboard-navigation"
import {
  parseTextSearchReturnHref,
  rawTextSearchReturnQuery
} from "~/lib/text-search-navigation"
import {
  nextWorkSearchOptions,
  rememberWorkSearchSnapshot,
  restoredWorkSearchSnapshot,
  replaceWorkSearchQuerySegments,
  workSearchHitAt,
  isWorkSearchHit as isRawWorkSearchHit,
  workSearchPositionMatchesHitPage,
  workSearchSnapshotIdentity,
  workSearchWordPosition,
  type WorkSearchOption
} from "~/lib/reader/work-search"
import { isExactWorkSearchHit } from "~/lib/reader-target"
import {
  readerContentsHref,
  readerContentsIsOpen,
  readerContentsNeutralFullPath,
  readerFullPathWithQueryValue,
  readerSourceInfoHref,
  readerSourceInfoIsOpen,
  readerSourceInfoNeutralFullPath
} from "~/lib/reader-routes"

definePageMeta({
  layout: "reader",
  validate: route => isEditorRouteIdentity(
    route.params.lbid,
    route.params.ix,
    route.params.mediatype
  )
})
const route = useRoute()
const router = useRouter()
const nuxtApp = useNuxtApp()
const requestUrl = useRequestURL()
const workId = computed(() => String(route.params.lbid))
const index = computed(() => String(route.params.ix))
const alias = computed(() => String(route.params.mediatype))
const initialRawFullPath = useState(
  `editor-reader-initial-raw-full-path:${route.path}`,
  () => `${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`
)
const rawFullPath = ref(import.meta.client && !nuxtApp.isHydrating
  ? `${window.location.pathname}${window.location.search}${window.location.hash}`
  : initialRawFullPath.value)
watch(() => route.fullPath, () => {
  if (import.meta.client && nuxtApp.isHydrating) return
  rawFullPath.value = import.meta.client
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : route.fullPath
}, { flush: "sync" })
const requestIdentity = computed(() => JSON.stringify([
  workId.value,
  index.value,
  alias.value
]))
const requestFetch = useRequestFetch()
const runtimeClient = useLbApiClient()
function requestPage(signal?: AbortSignal): Promise<EditorReaderPage> {
  return requestFetch<EditorReaderPage>(
    `/nuxt-api/editor/${encodeURIComponent(workId.value)}/${index.value}/${alias.value}`,
    { retry: 0, signal }
  )
}
const initialIdentity = requestIdentity.value
let pageRequestController: AbortController | null = null
const editorPageAsyncData = await useAsyncData(
  `editor-reader:${initialIdentity}`,
  async (_nuxtApp, { signal }) => {
    pageRequestController?.abort()
    const controller = new AbortController()
    pageRequestController = controller
    const requestSignal = AbortSignal.any([signal, controller.signal])
    try {
      const nextPage = await requestPage(requestSignal)
      if (requestSignal.aborted) {
        throw requestSignal.reason ?? new DOMException("Editor page request aborted", "AbortError")
      }
      return nextPage
    } finally {
      if (pageRequestController === controller) pageRequestController = null
    }
  },
  { lazy: true }
)
const {
  data: loadedPage,
  error,
  pending: editorPageAsyncPending
} = editorPageAsyncData
const routePagePending = ref(false)
const editorPagePending = computed(() => editorPageAsyncPending.value
  || editorPageAsyncData.status.value === "idle"
  || editorPageAsyncData.status.value === "pending"
  || routePagePending.value)
if (import.meta.server && error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: error.value.statusMessage ?? "Editor page unavailable"
  })
}
if (import.meta.server && !loadedPage.value) {
  throw createError({ statusCode: 502, statusMessage: "Editor page unavailable" })
}
type AcceptedEditorPage = { identity: string, page: EditorReaderPage }
const acceptedPage = useState<AcceptedEditorPage | null>(
  `editor-reader-accepted-page:${workId.value}:${alias.value}`,
  () => null
)
const loadedIdentity = ref<string | null>(loadedPage.value
  ? initialIdentity
  : acceptedPage.value?.identity ?? null)
watch(loadedPage, candidate => {
  if (candidate && requestIdentity.value === initialIdentity) {
    acceptedPage.value = { identity: initialIdentity, page: candidate }
    loadedIdentity.value = initialIdentity
  }
}, { immediate: true, flush: "sync" })
const page = computed(() => acceptedPage.value?.identity === requestIdentity.value
  ? acceptedPage.value.page
  : null)
const ocrMode = computed(() => route.query.ocr !== undefined && Boolean(page.value?.overlayHtml))
const authorSearchHref = computed(() => page.value?.authorId
  ? `/s%C3%B6k?avancerad&forfattare=${encodeURIComponent(page.value.authorId)}`
  : null)
const clientRequestFailed = ref(import.meta.client && Boolean(error.value))
watch(error, value => {
  if (import.meta.client && value) {
    acceptedPage.value = null
    loadedIdentity.value = null
    clientRequestFailed.value = true
  }
})
let requestGeneration = 0
watch(requestIdentity, async identity => {
  const generation = ++requestGeneration
  routePagePending.value = true
  clientRequestFailed.value = false
  sliderDraft.value = null
  pageRequestController?.abort()
  const controller = new AbortController()
  pageRequestController = controller
  try {
    const nextPage = await requestPage(controller.signal)
    if (controller.signal.aborted || generation !== requestGeneration) return
    loadedPage.value = nextPage
    acceptedPage.value = { identity, page: nextPage }
    loadedIdentity.value = identity
    clientRequestFailed.value = false
  } catch {
    if (!controller.signal.aborted && generation === requestGeneration) {
      acceptedPage.value = null
      loadedIdentity.value = null
      clientRequestFailed.value = true
    }
  } finally {
    if (generation === requestGeneration) routePagePending.value = false
    if (pageRequestController === controller) pageRequestController = null
  }
})
function cancelEditorPageRequest(): void {
  requestGeneration += 1
  routePagePending.value = false
  pageRequestController?.abort()
  editorPageAsyncData.clear()
  acceptedPage.value = null
}
onBeforeRouteLeave(to => {
  if (!isEditorRouteIdentity(to.params.lbid, to.params.ix, to.params.mediatype)) {
    cancelEditorPageRequest()
  }
})
onBeforeUnmount(() => {
  if (!isEditorRouteIdentity(route.params.lbid, route.params.ix, route.params.mediatype)) {
    cancelEditorPageRequest()
  }
})
function rawSuffix(fullPath: string): string {
  const query = fullPath.indexOf("?")
  const hash = fullPath.indexOf("#")
  const suffix = query >= 0 && (hash < 0 || query < hash) ? query : hash
  return suffix >= 0 ? fullPath.slice(suffix) : ""
}
function href(pageIndex: number): string {
  return `/editor/${encodeURIComponent(workId.value)}/ix/${pageIndex}/${alias.value}${rawSuffix(searchNavigationFullPath.value)}`
}
function partLabel(): string {
  const part = page.value?.currentPart
  return part?.nav_title || part?.short_title || part?.title || ""
}
function currentPartAuthorLabel(index: number): string {
  const part = page.value?.currentPart
  const author = part?.authors[index]
  if (!part || !author) return ""
  return part.authors.length === 1
    ? (author.full_name ?? author.author_id)
    : (author.surname ?? author.full_name ?? author.author_id)
}
function browserFullPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}
function navigateRawFullPath(fullPath: string, replace = false): Promise<void> {
  if (!import.meta.client) {
    return (replace ? router.replace(fullPath) : router.push(fullPath)).then(() => undefined)
  }
  const previousFullPath = rawFullPath.value
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
          editorFacsimileSize: facsimileSize.value,
          editorRotation: rotation.value,
          replaced: true
        }
        window.history.replaceState(state, "", fullPath)
      } else {
        window.history.replaceState(
          { ...currentState, current: previousFullPath, forward: fullPath },
          "",
          previousFullPath
        )
        state = {
          back: previousFullPath,
          current: fullPath,
          editorFacsimileSize: facsimileSize.value,
          editorRotation: rotation.value,
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
    } catch (navigationError) {
      removeAfterEach()
      reject(navigationError)
    }
  })
}

function withBareQueryKey(fullPath: string, key: string, enabled: boolean): string {
  const fragmentIndex = fullPath.indexOf("#")
  const fragment = fragmentIndex < 0 ? "" : fullPath.slice(fragmentIndex)
  const beforeHash = fragmentIndex < 0 ? fullPath : fullPath.slice(0, fragmentIndex)
  const queryIndex = beforeHash.indexOf("?")
  const path = queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex)
  const rawQuery = queryIndex < 0 ? "" : beforeHash.slice(queryIndex + 1)
  const retained = rawQuery.length === 0 ? [] : rawQuery.split("&").filter(segment => {
    const separator = segment.indexOf("=")
    const rawKey = separator < 0 ? segment : segment.slice(0, separator)
    try {
      return decodeURIComponent(rawKey.replace(/\+/g, " ")) !== key
    } catch {
      return true
    }
  })
  if (enabled) retained.push(key)
  return `${path}${retained.length ? `?${retained.join("&")}` : ""}${fragment}`
}
function navigateLink(event: MouseEvent, target: string): void {
  if (
    event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey ||
    event.metaKey || event.shiftKey
  ) return
  event.preventDefault()
  void navigateRawFullPath(target)
}
const sliderDraft = ref<number | null>(null)
const sliderValue = computed(() => sliderDraft.value ?? page.value?.pageIndex ?? 0)
const sliderPercent = computed(() => {
  const maximum = (page.value?.pageCount ?? 1) - 1
  return maximum > 0 ? sliderValue.value / maximum * 100 : 0
})
const sliderStyles = computed(() => {
  const geometry = readerSliderGeometryStyles(sliderPercent.value)
  return {
    pointer: { left: geometry.pointerLeft },
    selection: { width: geometry.selectionWidth }
  }
})
function previewSlider(event: Event): void {
  if (!(event.currentTarget instanceof HTMLInputElement)) return
  const value = event.currentTarget.valueAsNumber
  if (Number.isInteger(value)) sliderDraft.value = value
}
function commitSlider(): void {
  const value = sliderDraft.value
  sliderDraft.value = null
  if (value === null || value === page.value?.pageIndex) return
  void navigateRawFullPath(href(value))
}
const facsimileImage = ref<HTMLImageElement | null>(null)
function editorHistoryNumber(key: "editorFacsimileSize" | "editorRotation"): number | null {
  if (!import.meta.client || nuxtApp.isHydrating) return null
  const value = (window.history.state as Record<string, unknown> | null)?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
const facsimileSize = ref(editorHistoryNumber("editorFacsimileSize") ?? 3)
const rotation = ref(editorHistoryNumber("editorRotation") ?? 0)
const selectedFacsimileSource = computed(() => {
  const sources = page.value?.facsimileSources ?? []
  if (sources.length === 0) return null
  const preferredSize = preferredFacsimileSize(sources)
  return sources.find(source => source.size === facsimileSize.value)
    ?? sources.find(source => source.size === preferredSize)
    ?? null
})
const selectedFacsimileSrcset = computed(() => {
  const selected = selectedFacsimileSource.value
  if (!selected || selected.size >= 4) return undefined
  const retina = page.value?.facsimileSources.find(source => source.size === selected.size + 2)
  return retina ? `${selected.url} 1x, ${retina.url} 2x` : undefined
})
const smallerFacsimileSource = computed(() => [...(page.value?.facsimileSources ?? [])]
  .reverse().find(source => source.size < (selectedFacsimileSource.value?.size ?? 3)) ?? null)
const largerFacsimileSource = computed(() => page.value?.facsimileSources.find(
  source => source.size > (selectedFacsimileSource.value?.size ?? 3)
) ?? null)
const imageWidth = ref(selectedFacsimileSource.value?.width ?? 0)
function updateImageWidth(): void {
  imageWidth.value = facsimileImage.value?.getBoundingClientRect().width ?? 0
}
watch(() => selectedFacsimileSource.value?.url, () => {
  imageWidth.value = selectedFacsimileSource.value?.width ?? 0
})
watch([workId, alias], () => {
  facsimileSize.value = 3
  rotation.value = 0
})
function selectFacsimileSource(source: { size: number } | null): void {
  if (!source) return
  facsimileSize.value = source.size
  persistEditorImageState()
}
function rotateFacsimile(amount: number): void {
  rotation.value += amount
  persistEditorImageState()
}
function persistEditorImageState(): void {
  if (!import.meta.client) return
  window.history.replaceState({
    ...(window.history.state ?? {}),
    editorFacsimileSize: facsimileSize.value,
    editorRotation: rotation.value
  }, "", browserFullPath())
}
const overlayStyle = computed(() => {
  const width = page.value?.overlayWidth ?? 0
  return {
    width: `${width}px`,
    height: `${page.value?.overlayHeight ?? 0}px`,
    transform: `scale(${width > 0 && imageWidth.value > 0 ? imageWidth.value / width : 1})`
  }
})

const contentsRequested = computed(() => readerContentsIsOpen(route.query.innehall))
const contentsOpen = computed(() => (
  !sourceInfoRequested.value && contentsRequested.value && (page.value?.parts.length ?? 0) > 0
))
const contentsHref = computed(() => readerContentsHref(rawFullPath.value))
const contentsNeutralHref = computed(() => readerContentsNeutralFullPath(rawFullPath.value))
const contentsTrigger = ref<HTMLAnchorElement | null>(null)
const contentsPartHrefs = computed(() => page.value?.parts.map(part => (
  readerContentsNeutralFullPath(href(part.start_page_index))
)) ?? [])
let contentsClosePending = false

function openContents(): void {
  if (!contentsOpen.value) void navigateRawFullPath(contentsHref.value, true)
}

async function closeContents(): Promise<void> {
  if (!contentsOpen.value || contentsClosePending) return
  contentsClosePending = true
  try {
    await navigateRawFullPath(contentsNeutralHref.value, true)
    await nextTick()
    contentsTrigger.value?.focus()
  } finally {
    contentsClosePending = false
  }
}

function selectContentsPage(pageName: string): void {
  const part = page.value?.parts.find(item => item.start_page_name === pageName)
  if (!part) return
  void navigateRawFullPath(readerContentsNeutralFullPath(href(part.start_page_index)))
}

const sourceInfoRequested = computed(() => readerSourceInfoIsOpen(route.query["om-boken"]))
const sourceInfoAvailable = computed(() => Boolean(
  page.value?.metadataAvailable && page.value.authorId && page.value.titlePath
))
const sourceInfoOpen = computed(() => sourceInfoRequested.value && sourceInfoAvailable.value)
const sourceInfoHref = computed(() => readerSourceInfoHref(rawFullPath.value))
const sourceInfoNeutralHref = computed(() => readerSourceInfoNeutralFullPath(rawFullPath.value))
const sourceInfoTrigger = ref<HTMLAnchorElement | null>(null)
const sourceInfoIdentity = computed(() => JSON.stringify([
  page.value?.authorId,
  page.value?.titlePath,
  page.value?.mediaType
]))
type EditorSourceInfoState =
  | { status: "success", identity: string, sourceInfo: ReaderSourceInfo }
  | { status: "error", identity: string }
const initialSourceInfoRequested = sourceInfoRequested.value
let sourceInfoController: AbortController | null = null
let sourceInfoControllerIdentity: string | null = null
function abortSourceInfoRequest(): void {
  const controller = sourceInfoController
  sourceInfoController = null
  sourceInfoControllerIdentity = null
  controller?.abort()
}
const sourceInfoFetch = await useAsyncData<EditorSourceInfoState>(
  computed(() => `editor-source-info:${sourceInfoIdentity.value}`),
  async (_nuxtApp, { signal }) => {
    abortSourceInfoRequest()
    const identity = sourceInfoIdentity.value
    const current = page.value
    if (!current?.metadataAvailable || !current.authorId || !current.titlePath) {
      return { status: "error" as const, identity }
    }
    const controller = new AbortController()
    sourceInfoController = controller
    sourceInfoControllerIdentity = identity
    const requestSignal = AbortSignal.any([signal, controller.signal])
    try {
      const sourceInfo = await requestFetch<ReaderSourceInfo>([
        "/nuxt-api/reader/source-info",
        encodeURIComponent(current.authorId),
        encodeURIComponent(current.titlePath)
      ].join("/"), {
        query: { media_type: current.mediaType },
        retry: 0,
        signal: requestSignal
      })
      if (requestSignal.aborted || sourceInfoController !== controller) {
        throw requestSignal.reason ?? new DOMException(
          "Editor source information request superseded",
          "AbortError"
        )
      }
      return { status: "success" as const, identity, sourceInfo }
    } catch (requestError) {
      if (requestSignal.aborted || sourceInfoController !== controller) throw requestError
      return { status: "error" as const, identity }
    } finally {
      if (sourceInfoController === controller) {
        sourceInfoController = null
        sourceInfoControllerIdentity = null
      }
    }
  },
  { immediate: initialSourceInfoRequested, lazy: true }
)
const sourceInfo = computed(() => {
  const current = sourceInfoFetch.data.value
  return current?.status === "success" && current.identity === sourceInfoIdentity.value
    ? current.sourceInfo
    : null
})
const sourceInfoFailed = computed(() => {
  const current = sourceInfoFetch.data.value
  return current?.status === "error" && current.identity === sourceInfoIdentity.value
})
const sourceInfoLoading = computed(() => sourceInfoOpen.value && !sourceInfo.value &&
  !sourceInfoFailed.value && (
    sourceInfoFetch.status.value === "idle" || sourceInfoFetch.status.value === "pending"
  ))
watch(sourceInfoRequested, open => {
  if (!open) {
    abortSourceInfoRequest()
    return
  }
  if (import.meta.client && nuxtApp.isHydrating) return
  const current = sourceInfoFetch.data.value
  if (!current || current.identity !== sourceInfoIdentity.value || current.status === "error") {
    void sourceInfoFetch.execute()
  }
})
watch(sourceInfoIdentity, identity => {
  if (sourceInfoControllerIdentity !== identity) abortSourceInfoRequest()
})
onBeforeUnmount(abortSourceInfoRequest)

function openSourceInfo(): void {
  if (!sourceInfoOpen.value) void navigateRawFullPath(sourceInfoHref.value, true)
}

async function closeSourceInfo(): Promise<void> {
  if (!sourceInfoOpen.value) return
  await navigateRawFullPath(sourceInfoNeutralHref.value, true)
  await nextTick()
  sourceInfoTrigger.value?.focus()
}

const focusMode = computed(() => route.query.fokus !== undefined)
const focusHref = computed(() => withBareQueryKey(rawFullPath.value, "fokus", true))
const focusNeutralHref = computed(() => withBareQueryKey(rawFullPath.value, "fokus", false))
const focusBarVisible = ref(true)
const focusNightMode = ref(false)
const focusTextScale = ref(1)
const focusReaderStyle = computed(() => focusMode.value && page.value?.mediaType === "etext"
  ? {
      transform: `scaleX(${focusTextScale.value}) scaleY(${focusTextScale.value})`,
      transformOrigin: "left top"
    }
  : undefined)
const focusParts = computed(() => page.value?.parts.map(part => ({
  href: href(part.start_page_index),
  label: part.nav_title || part.short_title || part.title
})) ?? [])
function activateFocus(): void {
  focusBarVisible.value = true
  focusNightMode.value = false
  void navigateRawFullPath(focusHref.value, true)
}
function closeFocus(): void {
  void navigateRawFullPath(focusNeutralHref.value, true)
}
function toggleFocusBar(): void {
  if (focusMode.value) focusBarVisible.value = !focusBarVisible.value
}
function adjustFocusText(delta: number): void {
  focusTextScale.value = Math.min(2.5, Math.max(0.5, focusTextScale.value + delta))
}

type WorkSearchHit = components["schemas"]["WorkSearchHit"]
type WorkSearchHitsResponse = components["schemas"]["WorkSearchHitsResponse"]
type EditorSearchState = Readonly<{
  fromWordId: string | null
  hit: number
  includeOlderSpellings: boolean
  prefix: boolean
  query: string
  snapshot: string | null
  suffix: boolean
  toWordId: string | null
  wordForms: boolean
}>
type WorkSearchSubmission = Readonly<Pick<
  EditorSearchState,
  "includeOlderSpellings" | "prefix" | "query" | "snapshot" | "suffix" | "wordForms"
>>
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
  { key: "default", label: "SÖK EFTER ORD ELLER FRAS", selected: !workSearchLemma.value && !workSearchPrefix.value && !workSearchSuffix.value },
  { key: "lemma", label: "INKLUDERA BÖJNINGSFORMER", selected: workSearchLemma.value },
  { key: "modernize", label: "INKLUDERA ÄLDRE STAVNINGSFORMER", selected: workSearchOlderSpellings.value },
  { key: "prefix", label: "SÖK EFTER ORDBÖRJAN", selected: workSearchPrefix.value },
  { key: "suffix", label: "SÖK EFTER ORDSLUT", selected: workSearchSuffix.value },
  { key: "infix", label: "SÖK EFTER DEL AV ORD", selected: workSearchPrefix.value && workSearchSuffix.value }
])
let workSearchController: AbortController | null = null
let workSearchGeneration = 0

function cancelPendingWorkSearch(): void {
  workSearchGeneration += 1
  workSearchController?.abort()
  workSearchController = null
}

onBeforeUnmount(cancelPendingWorkSearch)
watch(requestIdentity, () => {
  cancelPendingWorkSearch()
  workSearchOpen.value = route.query.show_search_work !== undefined
  workSearchMessage.value = ""
})

function toggleWorkSearch(): void {
  if (!page.value?.searchable) return
  workSearchOpen.value = !workSearchOpen.value
  if (!workSearchOpen.value) cancelPendingWorkSearch()
  workSearchMessage.value = ""
  if (workSearchOpen.value) void nextTick(() => workSearchInput.value?.focus())
}

function chooseWorkSearchOption(option: WorkSearchOption): void {
  cancelPendingWorkSearch()
  const next = nextWorkSearchOptions({
    lemma: workSearchLemma.value,
    olderSpellings: workSearchOlderSpellings.value,
    prefix: workSearchPrefix.value,
    suffix: workSearchSuffix.value
  }, option)
  workSearchLemma.value = next.lemma
  workSearchOlderSpellings.value = next.olderSpellings
  workSearchPrefix.value = next.prefix
  workSearchSuffix.value = next.suffix
}

function routeSingleString(key: string): string | null {
  const value = route.query[key]
  return typeof value === "string" ? value : null
}

function routeBoolean(key: string, fallback: boolean): boolean | null {
  if (!Object.hasOwn(route.query, key)) return fallback
  const value = route.query[key]
  if (value === null) return true
  if (value === "true") return true
  if (value === "false") return false
  return null
}

const maximumHitOffset = 1_000_000
const maximumNavigableHit = maximumHitOffset + 1
function boundedSearchQuery(): string | null {
  const query = routeSingleString("s_query") ?? ""
  return query.trim().length >= 1 && query.length <= 200 ? query : null
}

function boundedSearchHit(): number | null {
  const rawHit = routeSingleString("hit_index")
  if (!rawHit || !/^(?:0|[1-9]\d*)$/.test(rawHit)) return null
  const hit = Number(rawHit)
  return Number.isSafeInteger(hit) && Math.max(hit - 1, 0) <= maximumHitOffset
    ? hit
    : null
}

function boundedSearchWordId(key: "traff" | "traffslut"): string | null {
  const value = routeSingleString(key)
  return value && value.length <= 100 ? value : null
}

function editorSearchMatchesReader(
  current: EditorReaderPage | null | undefined
): current is EditorReaderPage {
  return current?.searchable === true
    && routeSingleString("s_lbworkid") === current.workId
    && routeSingleString("s_mediatype") === current.mediaType
    && (route.query.s_snapshot === undefined || isTextSearchSnapshot(route.query.s_snapshot))
}

function editorHistorySearchSnapshot(identity: string): string | null {
  // SSR owns initial hydration; history adoption only owns later SPA restores.
  if (!import.meta.client || nuxtApp.isHydrating) return null
  return restoredWorkSearchSnapshot(window.history.state, identity)
}

function editorSearchState(current: EditorReaderPage | null | undefined): EditorSearchState | null {
  if (!editorSearchMatchesReader(current)) return null

  const query = boundedSearchQuery()
  let snapshot = routeSingleString("s_snapshot")
  const hit = boundedSearchHit()
  const hasFromWordId = Object.hasOwn(route.query, "traff")
  const hasToWordId = Object.hasOwn(route.query, "traffslut")
  const fromWordId = hasFromWordId ? boundedSearchWordId("traff") : null
  const toWordId = hasToWordId ? boundedSearchWordId("traffslut") : null
  const wordFormOnly = routeBoolean("s_word_form_only", false)
  const includeOlderSpellings = routeBoolean("s_include_modernized", true)
  const prefix = routeBoolean("s_prefix", false)
  const suffix = routeBoolean("s_suffix", false)
  if (!query || hit === null || hasFromWordId !== hasToWordId ||
    (hasFromWordId && (!fromWordId || !toWordId)) ||
    wordFormOnly === null || includeOlderSpellings === null || prefix === null || suffix === null
  ) return null
  if (snapshot === null) {
    snapshot = editorHistorySearchSnapshot(workSearchSnapshotIdentity(
      current.workId, current.mediaType,
      { query, wordForms: !wordFormOnly, includeOlderSpellings, prefix, suffix }
    ))
  }
  return Object.freeze({
    fromWordId,
    hit,
    includeOlderSpellings,
    prefix,
    query,
    snapshot,
    suffix,
    toWordId,
    wordForms: !wordFormOnly
  })
}

const searchState = computed<EditorSearchState | null>(() => editorSearchState(page.value))

watch(() => route.query.show_search_work, value => {
  workSearchOpen.value = value !== undefined
}, { immediate: true })

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hitRangeIsValid(hit: WorkSearchHit, currentWorkId: string): boolean {
  if (!isExactWorkSearchHit(hit)) return false
  const from = workSearchWordPosition(hit.highlight.from_word_id, currentWorkId)
  const to = workSearchWordPosition(hit.highlight.to_word_id, currentWorkId)
  return Boolean(from && to && from.scope === to.scope && from.ordinal <= to.ordinal)
}

function hitMatchesEditorPageRange(hit: WorkSearchHit, current: EditorReaderPage): boolean {
  if (!isExactWorkSearchHit(hit)) return false
  const pageIndexIsValid = current.pageIndexes
    ? current.pageIndexes.includes(hit.page_index)
    : hit.page_index >= 0 && hit.page_index < (current.pageCount ?? 0)
  if (!pageIndexIsValid) return false
  const from = workSearchWordPosition(hit.highlight.from_word_id, current.workId)
  if (!from) return false
  if (from.pageIndex === null) return true
  return workSearchPositionMatchesHitPage(from, hit.page_index, current.mediaType)
}

function isWorkSearchHit(value: unknown, current: EditorReaderPage): value is WorkSearchHit {
  return isRawWorkSearchHit(value, current.workId, current.mediaType) &&
    (!isExactWorkSearchHit(value) || (
      hitRangeIsValid(value, current.workId) && hitMatchesEditorPageRange(value, current)
    ))
}

function hasExpectedHitEnvelope(
  value: unknown,
  state: WorkSearchSubmission,
  current: EditorReaderPage,
  offset: number,
  limit: number
): value is WorkSearchHitsResponse {
  return isRecord(value)
    && Array.isArray(value.items)
    && Number.isSafeInteger(value.total_hits)
    && Number(value.total_hits) >= 0
    && value.query === state.query
    && isTextSearchSnapshot(value.snapshot)
    && (state.snapshot === null || value.snapshot === state.snapshot)
    && value.media_type === current.mediaType
    && value.offset === offset
    && value.limit === limit
}

function isExpectedHitResponse(
  value: unknown,
  state: EditorSearchState,
  current: EditorReaderPage,
  offset: number,
  expectedHitIndex: number,
  limit: number
): value is WorkSearchHitsResponse {
  if (!hasExpectedHitEnvelope(value, state, current, offset, limit)) return false
  const totalHits = value.total_hits
  if (value.items.length > limit || expectedHitIndex >= totalHits) return false
  const itemsAreExpected = value.items.every((item, position) =>
    isWorkSearchHit(item, current) && item.index === offset + position && item.index < totalHits
  )
  return itemsAreExpected && value.items.some(item =>
    isRecord(item) && item.index === expectedHitIndex
  )
}

function responseHitMatchesRoute(
  value: WorkSearchHitsResponse,
  state: EditorSearchState,
  current: EditorReaderPage,
  expectedHitIndex: number
): boolean {
  return value.items.some(item => {
    if (item.index !== expectedHitIndex) return false
    if (!isExactWorkSearchHit(item)) {
      return state.fromWordId === null && state.toWordId === null
    }
    return item.page_index === current.pageIndex &&
      item.highlight.from_word_id === state.fromWordId &&
      item.highlight.to_word_id === state.toWordId
  })
}

const searchRequestIdentity = computed(() => JSON.stringify([
  requestIdentity.value,
  loadedIdentity.value,
  searchState.value
]))
let hitFetchController: AbortController | null = null
const hitFetch = await useAsyncData(
  computed(() => `editor-hit:${searchRequestIdentity.value}`),
  async (_nuxtApp, { signal }) => {
    hitFetchController?.abort()
    const identity = searchRequestIdentity.value
    const state = searchState.value
    const current = page.value
    if (!state || !current) return { status: "inactive" as const, identity }
    const offset = Math.max(state.hit - 1, 0)
    const controller = new AbortController()
    hitFetchController = controller
    try {
      const result = await runtimeClient.GET("/works/{work_id}/search-hits", {
        signal: AbortSignal.any([signal, controller.signal]),
        params: {
          path: { work_id: current.workId },
          query: {
            media_type: current.mediaType,
            query: state.query,
            offset,
            limit: 3,
            word_forms: state.wordForms,
            include_older_spellings: state.includeOlderSpellings,
            prefix: state.prefix,
            suffix: state.suffix,
            snapshot: state.snapshot ?? undefined
          }
        }
      })
      if (isSnapshotUnavailable(result)) {
        return { status: "expired" as const, identity }
      }
      if (result.error || !isExpectedHitResponse(
        result.data,
        state,
        current,
        offset,
        state.hit,
        3
      ) || !responseHitMatchesRoute(result.data, state, current, state.hit)) {
        return { status: "error" as const, identity }
      }
      return { status: "success" as const, identity, response: result.data }
    } catch (error) {
      if (isAbortError(error) || identity !== searchRequestIdentity.value) {
        return { status: "inactive" as const, identity }
      }
      return { status: "error" as const, identity }
    } finally {
      if (hitFetchController === controller) hitFetchController = null
    }
  },
  { lazy: true, watch: [searchRequestIdentity] }
)
onBeforeUnmount(() => hitFetchController?.abort())
const hitResponse = computed(() => {
  const current = hitFetch.data.value
  return current?.status === "success" && current.identity === searchRequestIdentity.value
    ? current.response
    : null
})
const searchNavigationFullPath = computed(() => {
  const snapshot = hitResponse.value?.snapshot ?? searchState.value?.snapshot
  return snapshot && route.query.s_snapshot === undefined
    ? readerFullPathWithQueryValue(rawFullPath.value, "s_snapshot", snapshot)
    : rawFullPath.value
})
watch(hitResponse, response => {
  const state = searchState.value
  const current = page.value
  if (import.meta.client && response && state && current && route.query.s_snapshot === undefined) {
    rememberWorkSearchSnapshot(window.history,
      workSearchSnapshotIdentity(current.workId, current.mediaType, state), response.snapshot)
  }
}, { immediate: true, flush: "sync" })
const hitRequestFailed = computed(() => {
  const current = hitFetch.data.value
  return (current?.status === "error" && current.identity === searchRequestIdentity.value)
    || (hitContinuationFailure.value?.identity === searchRequestIdentity.value && hitContinuationFailure.value.status === "error")
})
const hitContinuationFailure = shallowRef<{ identity: string, status: "error" | "expired" } | null>(null)
const hitExpired = computed(() => (
  (hitFetch.data.value?.status === "expired" && hitFetch.data.value.identity === searchRequestIdentity.value)
  || (hitContinuationFailure.value?.identity === searchRequestIdentity.value && hitContinuationFailure.value.status === "expired")
))
const activeHit = computed(() => {
  const state = searchState.value
  if (!state || !hitResponse.value) return null
  const hit = workSearchHitAt(hitResponse.value.items, state.hit)
  if (!hit) return null
  if (!isExactWorkSearchHit(hit)) {
    return state.fromWordId === null && state.toWordId === null ? hit : null
  }
  return hit.highlight.from_word_id === state.fromWordId &&
    hit.highlight.to_word_id === state.toWordId ? hit : null
})
const previousHit = computed(() => {
  const state = searchState.value
  return state && hitResponse.value
    ? workSearchHitAt(hitResponse.value.items, state.hit - 1)
    : null
})
const nextHit = computed(() => {
  const state = searchState.value
  return state && hitResponse.value && state.hit + 1 <= maximumNavigableHit
    ? workSearchHitAt(hitResponse.value.items, state.hit + 1)
    : null
})

function markEditorHtml(
  html: NonNullable<EditorReaderPage["html"]>,
  hit: WorkSearchHit | null
): NonNullable<EditorReaderPage["html"]> {
  const current = page.value
  if (!hit || !isExactWorkSearchHit(hit) || !current || hit.page_index !== current.pageIndex) return html
  return markEditorEtextHtml(
    html,
    hit.highlight.from_word_id,
    hit.highlight.to_word_id
  )
}
const markedEditorHtml = computed(() => page.value?.html
  ? markEditorHtml(page.value.html, activeHit.value)
  : null)
const markedOverlayHtml = computed(() => page.value?.overlayHtml
  ? activeHit.value && isExactWorkSearchHit(activeHit.value) && page.value && activeHit.value.page_index === page.value.pageIndex
    ? markReaderOcrHtml(
        page.value.overlayHtml,
        activeHit.value.highlight.from_word_id,
        activeHit.value.highlight.to_word_id
      )
    : page.value.overlayHtml
  : null)

const editorSearchKeys = new Set([
  "show_search_work", "s_query", "s_lbworkid", "s_mediatype",
  "s_word_form_only", "s_include_modernized", "s_prefix", "s_suffix",
  "s_snapshot",
  "hit_index", "traff", "traffslut"
])

function searchNeutralHref(fullPath: string): string {
  const fragmentIndex = fullPath.indexOf("#")
  const fragment = fragmentIndex < 0 ? "" : fullPath.slice(fragmentIndex)
  const beforeHash = fragmentIndex < 0 ? fullPath : fullPath.slice(0, fragmentIndex)
  const queryIndex = beforeHash.indexOf("?")
  if (queryIndex < 0) return fullPath
  const path = beforeHash.slice(0, queryIndex)
  const retained = replaceWorkSearchQuerySegments(
    beforeHash.slice(queryIndex + 1).split("&"),
    editorSearchKeys,
    new Map()
  )
  return `${path}${retained.length ? `?${retained.join("&")}` : ""}${fragment}`
}

function workSearchHitHref(hit: WorkSearchHit, submission: WorkSearchSubmission): string {
  const target = isExactWorkSearchHit(hit) ? href(hit.page_index) : rawFullPath.value
  const fragmentIndex = target.indexOf("#")
  const fragment = fragmentIndex < 0 ? "" : target.slice(fragmentIndex)
  const beforeHash = fragmentIndex < 0 ? target : target.slice(0, fragmentIndex)
  const queryIndex = beforeHash.indexOf("?")
  const path = queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex)
  const rawQuery = queryIndex < 0 ? "" : beforeHash.slice(queryIndex + 1)
  const replacements = new Map<string, string | null>([
    ["show_search_work", null],
    ["s_query", submission.query],
    ["s_lbworkid", workId.value],
    ["s_mediatype", page.value?.mediaType ?? ""],
    ["s_word_form_only", String(!submission.wordForms)],
    ["s_include_modernized", String(submission.includeOlderSpellings)]
  ])
  if (submission.snapshot) replacements.set("s_snapshot", submission.snapshot)
  if (submission.prefix) replacements.set("s_prefix", "true")
  if (submission.suffix) replacements.set("s_suffix", "true")
  replacements.set("hit_index", String(hit.index))
  if (isExactWorkSearchHit(hit)) {
    replacements.set("traff", hit.highlight.from_word_id)
    replacements.set("traffslut", hit.highlight.to_word_id)
  }
  const withoutSearchState = replaceWorkSearchQuerySegments(
    rawQuery.length === 0 ? [] : rawQuery.split("&"),
    isExactWorkSearchHit(hit)
      ? editorSearchKeys
      : new Set([...editorSearchKeys, "traff", "traffslut"]),
    new Map()
  )
  const retained = replaceWorkSearchQuerySegments(
    withoutSearchState,
    new Set(),
    replacements
  )
  return `${path}?${retained.join("&")}${fragment}`
}

const previousHitHref = computed(() => previousHit.value && searchState.value
  ? workSearchHitHref(previousHit.value, { ...searchState.value, snapshot: hitResponse.value!.snapshot })
  : null)
const nextHitHref = computed(() => nextHit.value && searchState.value
  ? workSearchHitHref(nextHit.value, { ...searchState.value, snapshot: hitResponse.value!.snapshot })
  : null)

function workSearchQueryIsValid(query: string): boolean {
  if (query.length < 1) {
    workSearchMessage.value = "Ange ett sökord eller en fras."
    workSearchInput.value?.focus()
    return false
  }
  if (query.length > 200) {
    workSearchMessage.value = "Sökningen får vara högst 200 tecken."
    workSearchInput.value?.focus()
    return false
  }
  return true
}

function isCurrentWorkSearch(generation: number, controller: AbortController): boolean {
  return generation === workSearchGeneration && workSearchController === controller
}

function isValidSubmittedHit(value: unknown, current: EditorReaderPage): value is WorkSearchHit {
  return isWorkSearchHit(value, current)
}

type SubmittedSearchResponse =
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "hit", hit: WorkSearchHit, snapshot: string }>
  | Readonly<{ status: "invalid" }>

function submittedSearchResponse(
  value: unknown,
  submission: WorkSearchSubmission,
  current: EditorReaderPage
): SubmittedSearchResponse {
  if (!hasExpectedHitEnvelope(value, submission, current, 0, 1)) {
    return { status: "invalid" }
  }
  if (value.total_hits === 0) {
    return value.items.length === 0 ? { status: "empty" } : { status: "invalid" }
  }
  const hit = value.items[0]
  return value.items.length === 1 && isValidSubmittedHit(hit, current) && hit.index === 0
    ? { status: "hit", hit, snapshot: value.snapshot }
    : { status: "invalid" }
}

async function submitWorkSearch(): Promise<void> {
  const query = workSearchQuery.value.trim()
  if (!workSearchQueryIsValid(query)) return
  const current = page.value
  if (!current?.searchable) return
  const submission: WorkSearchSubmission = Object.freeze({
    query,
    snapshot: null,
    wordForms: workSearchLemma.value,
    includeOlderSpellings: workSearchOlderSpellings.value,
    prefix: workSearchPrefix.value,
    suffix: workSearchSuffix.value
  })
  await runWorkSearch(submission)
}

async function restartWorkSearch(): Promise<void> {
  const state = searchState.value
  if (state) await runWorkSearch({ ...state, snapshot: null })
}

async function runWorkSearch(submission: WorkSearchSubmission): Promise<void> {
  const current = page.value
  if (!current?.searchable) return
  cancelPendingHitNavigation()
  cancelPendingWorkSearch()
  const generation = workSearchGeneration
  const controller = new AbortController()
  workSearchController = controller
  workSearchMessage.value = ""
  try {
    const result = await runtimeClient.GET("/works/{work_id}/search-hits", {
      signal: controller.signal,
      params: {
        path: { work_id: current.workId },
        query: {
          media_type: current.mediaType,
          query: submission.query,
          offset: 0,
          limit: 1,
          word_forms: submission.wordForms,
          include_older_spellings: submission.includeOlderSpellings,
          prefix: submission.prefix,
          suffix: submission.suffix,
          snapshot: submission.snapshot ?? undefined
        }
      }
    })
    if (!isCurrentWorkSearch(generation, controller)) return
    if (result.error) {
      workSearchMessage.value = "Sökningen kunde inte genomföras."
      return
    }
    const response = submittedSearchResponse(result.data, submission, current)
    if (response.status !== "hit") {
      workSearchMessage.value = response.status === "empty"
        ? "Inga träffar."
        : "Sökningen kunde inte genomföras."
      return
    }
    await navigateRawFullPath(workSearchHitHref(response.hit, { ...submission, snapshot: response.snapshot }))
  } catch (searchError) {
    if (isCurrentWorkSearch(generation, controller) && !isAbortError(searchError)) {
      workSearchMessage.value = "Sökningen kunde inte genomföras."
    }
  } finally {
    if (workSearchController === controller) workSearchController = null
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

watch(searchState, state => {
  if (!state) return
  workSearchQuery.value = state.query
  workSearchLemma.value = state.wordForms
  workSearchOlderSpellings.value = state.includeOlderSpellings
  workSearchPrefix.value = state.prefix
  workSearchSuffix.value = state.suffix
}, { immediate: true })

let hitNavigationGeneration = 0
let hitNavigationController: AbortController | null = null
function cancelPendingHitNavigation(): void {
  hitNavigationGeneration += 1
  hitNavigationController?.abort()
  hitNavigationController = null
}
watch(rawFullPath, () => {
  cancelPendingHitNavigation()
  cancelPendingWorkSearch()
  hitContinuationFailure.value = null
}, { flush: "sync" })
onBeforeUnmount(cancelPendingHitNavigation)

type EditorHitLookupContext = {
  state: EditorSearchState
  current: EditorReaderPage
  response: WorkSearchHitsResponse
  sourceIdentity: string
}

function editorHitLookupContext(index: number): EditorHitLookupContext | null {
  const state = searchState.value
  const current = page.value
  const response = hitResponse.value
  if (!state || !current || !response) return null
  if (index < 0 || index >= response.total_hits || index > maximumNavigableHit) return null
  return { state, current, response, sourceIdentity: searchRequestIdentity.value }
}

async function fetchEditorHitAtIndex(
  context: EditorHitLookupContext,
  index: number,
  signal: AbortSignal
): Promise<WorkSearchHit | null> {
  const { state, current, response, sourceIdentity } = context
  const pinnedState = { ...state, snapshot: response.snapshot }
  const offset = Math.max(index - 1, 0)
  const limit = 3
  const result = await runtimeClient.GET("/works/{work_id}/search-hits", {
    signal,
    params: {
      path: { work_id: current.workId },
      query: {
        media_type: current.mediaType,
        query: state.query,
        offset,
        limit,
        word_forms: state.wordForms,
        include_older_spellings: state.includeOlderSpellings,
        prefix: state.prefix,
        suffix: state.suffix,
        snapshot: pinnedState.snapshot
      }
    }
  })
  if (signal.aborted || sourceIdentity !== searchRequestIdentity.value) return null
  if (isSnapshotUnavailable(result)) {
    hitContinuationFailure.value = { identity: sourceIdentity, status: "expired" }
    return null
  }
  if (result.error || !isExpectedHitResponse(
    result.data,
    pinnedState,
    current,
    offset,
    index,
    limit
  )) {
    hitContinuationFailure.value = { identity: sourceIdentity, status: "error" }
    return null
  }
  if (result.data.total_hits !== response.total_hits) return null
  if (sourceIdentity !== searchRequestIdentity.value) return null
  return workSearchHitAt(result.data.items, index)
}

async function hitAtIndex(index: number, signal: AbortSignal): Promise<WorkSearchHit | null> {
  const context = editorHitLookupContext(index)
  if (!context) return null
  const { response } = context
  const cached = workSearchHitAt(response.items, index)
  if (cached) return cached
  try {
    return await fetchEditorHitAtIndex(context, index, signal)
  } catch {
    return null
  }
}

async function navigateToHit(index: number): Promise<void> {
  if (hitExpired.value) return
  cancelPendingHitNavigation()
  const generation = hitNavigationGeneration
  const state = searchState.value
  if (!state || state.hit === index) return
  const controller = new AbortController()
  hitNavigationController = controller
  try {
    const hit = await hitAtIndex(index, controller.signal)
    if (!hit || generation !== hitNavigationGeneration) return
    await navigateRawFullPath(workSearchHitHref(hit, { ...state, snapshot: hitResponse.value!.snapshot }))
  } finally {
    if (hitNavigationController === controller) hitNavigationController = null
  }
}

function closeWorkSearchHits(): void {
  cancelPendingHitNavigation()
  cancelPendingWorkSearch()
  workSearchOpen.value = false
  workSearchQuery.value = ""
  workSearchMessage.value = ""
  void navigateRawFullPath(searchNeutralHref(rawFullPath.value))
}

const searchCloseHref = computed(() => searchNeutralHref(rawFullPath.value))
const searchReturnHref = computed(() => parseTextSearchReturnHref(
  rawTextSearchReturnQuery(rawFullPath.value)
))
function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
  )
}
function editorAtScrollEdge(direction: KeyboardNavigationDirection): boolean {
  return horizontalScrollEdge(direction, {
    contentWidth: document.documentElement.scrollWidth,
    scrollLeft: window.scrollX,
    viewportWidth: window.innerWidth
  })
}

function boundedEditorTarget(current: EditorReaderPage, target: number): number | null {
  if (current.pageIndexes) return current.pageIndexes.includes(target) ? target : null
  return target >= 0 && current.pageCount !== null && target < current.pageCount ? target : null
}

function editorTargetForAction(
  current: EditorReaderPage,
  action: KeyboardNavigationAction
): number | null {
  if (action.kind === "adjacent") {
    return action.direction === "next" ? current.nextIndex : current.previousIndex
  }
  if (action.kind === "jump") {
    return boundedEditorTarget(current, current.pageIndex + (action.direction === "next" ? 10 : -10))
  }
  return null
}

function keyboardTarget(event: KeyboardEvent): number | null {
  const current = page.value
  if (!current) return null
  const action = keyboardNavigationAction(event, {
    altArrowAction: null,
    atEdge: editorAtScrollEdge,
    letterAction: "jump"
  })
  return action ? editorTargetForAction(current, action) : null
}
function handleKeyboard(event: KeyboardEvent): void {
  if (
    event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey ||
    isEditableTarget(event.target) || isEditableTarget(document.activeElement) ||
    document.querySelector('[role="dialog"]')
  ) return
  if (event.key === "Escape" && focusMode.value) {
    event.preventDefault()
    closeFocus()
    return
  }
  const target = keyboardTarget(event)
  if (target === null) return
  event.preventDefault()
  void navigateRawFullPath(href(target))
}
onMounted(() => {
  const browserPath = browserFullPath()
  const fragmentIndex = browserPath.indexOf("#")
  if (fragmentIndex >= 0) {
    rawFullPath.value = `${rawFullPath.value.split("#", 1)[0]}${browserPath.slice(fragmentIndex)}`
  }
  window.addEventListener("resize", updateImageWidth)
  document.addEventListener("keydown", handleKeyboard)
})
onBeforeUnmount(() => {
  window.removeEventListener("resize", updateImageWidth)
  document.removeEventListener("keydown", handleKeyboard)
})
useHead(() => ({
  title: `${page.value?.title ?? workId.value} sida ${index.value} | Litteraturbanken`,
  bodyAttrs: { class: "focus page-reading ready" }
}))
</script>

<template>
  <div class="editor-reader reader-page">
    <div v-if="editorPagePending && !page" class="searching" role="status" aria-live="polite">
      <div class="preloader">
        <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
        <span class="sr-only">Laddar editorsidan</span>
      </div>
    </div>
    <p v-if="clientRequestFailed" class="reader-error" role="alert">Ett fel inträffade vid sidhämtningen.</p>
    <section v-if="page" class="reader_main state-not-parallel relative" :class="{ 'type-faksimil': page.mediaType === 'faksimil', focus: focusMode, night: focusMode && focusNightMode, ocr: ocrMode }" :style="focusReaderStyle" @click="toggleFocusBar">
      <RenderableHtmlContent
        v-if="markedEditorHtml"
        as="div"
        class="etext txt"
        :html="markedEditorHtml"
      />
      <div v-if="markedOverlayHtml && page.overlayWidth && page.overlayHeight" class="absolute left-0 top-0 overflow-hidden h-full w-full pointer-events-none">
        <RenderableHtmlContent
          as="div"
          class="overlay overflow-hidden origin-top-left"
          :style="overlayStyle"
          :html="markedOverlayHtml"
        />
      </div>
      <div v-if="selectedFacsimileSource" class="img_area" :style="selectedFacsimileSource.width ? { width: `${selectedFacsimileSource.width}px` } : undefined"><img ref="facsimileImage" class="faksimil transform transition duration-200" :style="{ ...(selectedFacsimileSource.width ? { width: `${selectedFacsimileSource.width}px`, maxWidth: `${selectedFacsimileSource.width}px` } : {}), transform: `rotate(${rotation}deg)` }" :src="selectedFacsimileSource.url" :srcset="selectedFacsimileSrcset" :alt="`Sida ${page.pageIndex}`" @load="updateImageWidth"></div>
    </section>
    <ClientOnly>
      <ReaderFocusControls
        v-if="page && focusMode"
        :bar-visible="focusBarVisible"
        :larger-size-enabled="Boolean(largerFacsimileSource)"
        :media-type="page.mediaType"
        :next-href="page.nextIndex === null ? null : href(page.nextIndex)"
        :night-mode="focusNightMode"
        :parts="focusParts"
        :previous-href="page.previousIndex === null ? null : href(page.previousIndex)"
        :smaller-size-enabled="Boolean(smallerFacsimileSource)"
        :start-href="href(page.firstReadableIndex)"
        @adjust-text="adjustFocusText"
        @close="closeFocus"
        @navigate="navigateRawFullPath"
        @select-size="delta => selectFacsimileSource(delta < 0 ? smallerFacsimileSource : largerFacsimileSource)"
        @toggle-bar="toggleFocusBar"
        @toggle-night="focusNightMode = !focusNightMode"
      />
    </ClientOnly>
    <ClientOnly>
      <Teleport v-if="searchState" to="#toolkit">
        <EditorSearchNavigation
          :active-hit="activeHit"
          :close-href="searchCloseHref"
          :current-page-name="page?.pageName ?? null"
          :failed="hitRequestFailed"
          :expired="hitExpired"
          :loading="hitFetch.status.value === 'pending'"
          :next-href="nextHitHref"
          :next-hit="nextHit"
          :previous-href="previousHitHref"
          :previous-hit="previousHit"
          :return-href="searchReturnHref"
          :total-hits="hitResponse?.total_hits ?? null"
          @close="closeWorkSearchHits"
          @navigate="navigateToHit"
          @restart="restartWorkSearch"
        />
      </Teleport>
      <template #fallback>
        <EditorSearchNavigation
          v-if="searchState"
          :active-hit="activeHit"
          :close-href="searchCloseHref"
          :current-page-name="page?.pageName ?? null"
          :failed="hitRequestFailed"
          :expired="hitExpired"
          :interactive="false"
          :loading="hitFetch.status.value === 'pending'"
          :next-href="nextHitHref"
          :next-hit="nextHit"
          :previous-href="previousHitHref"
          :previous-hit="previousHit"
          :return-href="searchReturnHref"
          :total-hits="hitResponse?.total_hits ?? null"
          @close="closeWorkSearchHits"
          @navigate="navigateToHit"
          @restart="restartWorkSearch"
        />
      </template>
    </ClientOnly>
    <ClientOnly>
      <Teleport to="#toolkit">
        <div
          v-if="page?.mediaType === 'faksimil'"
          class="reader-facsimile-controls editor-facsimile-controls"
        >
          <div class="reader-facsimile-size-controls">
            <h2>Ändra storlek</h2>
            <button class="small_text btn btn-small" type="button" :disabled="!smallerFacsimileSource" @click="selectFacsimileSource(smallerFacsimileSource)">Mindre</button>
            <button class="small_text btn btn-small" type="button" :disabled="!largerFacsimileSource" @click="selectFacsimileSource(largerFacsimileSource)">Större</button>
          </div>
          <div class="reader-facsimile-rotation-controls">
            <h2>Rotera</h2>
            <button class="small_text btn btn-small" type="button" @click="rotateFacsimile(-90)">Vänster</button>
            <button class="small_text btn btn-small" type="button" @click="rotateFacsimile(90)">Höger</button>
          </div>
        </div>
      </Teleport>
      <Teleport to="#toolkit-right">
        <aside v-if="page" class="reader-context editor-reader-context" :class="{ 'has-search-hit': searchState }" aria-label="Läsinformation och sidnavigering">
          <template v-if="page.metadataAvailable">
            <div class="editor-metadata-controls"><div class="author"><ReaderContributors :contributors="page.contributors" /></div><span class="title">{{ page.title }}{{ " " }}</span><span
              v-if="page.imprintYear"
              class="editor-imprint-year"
            >({{ page.imprintYear }})</span></div>
            <hr class="editor-metadata-controls">
            <div class="current_part editor-metadata-controls">
              <template v-if="page.currentPart">
                <div class="header">
                  <template
                    v-for="(partAuthor, partAuthorIndex) in page.currentPart.authors"
                    :key="`${partAuthor.author_id}:${partAuthorIndex}`"
                  >
                    <NuxtLink :to="`/f%C3%B6rfattare/${encodeURIComponent(partAuthor.author_id)}`">{{ currentPartAuthorLabel(partAuthorIndex) }}</NuxtLink><span
                      v-if="partAuthorIndex < page.currentPart.authors.length - 1"
                    >, </span>
                  </template>
                </div>
                <div><p class="navtitle line-clamp-4">{{ partLabel() }}</p></div>
              </template>
            </div>
            <hr class="lower editor-metadata-controls">
          </template>
          <nav class="pager_ctrls" aria-label="Sidnavigering">
            <NuxtLink v-if="page.previousPartIndex !== null" custom :to="href(page.previousPartIndex)"><a class="prev_part sc" :href="href(page.previousPartIndex)" @click="navigateLink($event, href(page.previousPartIndex))">Gå bakåt en del</a></NuxtLink>
            <span v-else class="prev_part disabled sc" aria-disabled="true">Gå bakåt en del</span>
            <br>
            <NuxtLink v-if="page.nextPartIndex !== null" custom :to="href(page.nextPartIndex)"><a class="next_part sc" :href="href(page.nextPartIndex)" @click="navigateLink($event, href(page.nextPartIndex))">Gå till nästa del</a></NuxtLink>
            <span v-else class="next_part disabled sc" aria-disabled="true">Gå till nästa del</span>
            <br>
            <NuxtLink v-if="page.pageIndex !== page.firstReadableIndex" custom :to="href(page.firstReadableIndex)"><a :href="href(page.firstReadableIndex)" @click="navigateLink($event, href(page.firstReadableIndex))">Gå till första sidan</a></NuxtLink>
            <span v-else class="disabled sc" aria-disabled="true">Gå till första sidan</span>
            <br>
            <NuxtLink v-if="page.pageIndex !== page.lastReadableIndex" custom :to="href(page.lastReadableIndex)"><a :href="href(page.lastReadableIndex)" @click="navigateLink($event, href(page.lastReadableIndex))">Gå till sista sidan</a></NuxtLink>
            <span v-else class="disabled sc" aria-disabled="true">Gå till sista sidan</span>
            <br>
            <span class="goto"><span class="sc">Gå till sida . . .{{ " " }}<span
              v-if="page.pageName || page.endPageName"
              class="pages"
            ><template v-if="page.pageName">{{ page.pageName }}{{ " " }}</template><template
              v-if="page.endPageName"
            >av {{ page.endPageName }}</template></span></span></span>
            <NuxtLink v-if="page.previousIndex !== null" custom :to="href(page.previousIndex)"><a rel="prev" :href="href(page.previousIndex)" aria-label="Föregående sida" @click="navigateLink($event, href(page.previousIndex))"><span class="submit btn navicon navicon-visual left" aria-hidden="true"><i class="fa fa-angle-left" /></span></a></NuxtLink>{{ " " }}
            <NuxtLink v-if="page.nextIndex !== null" custom :to="href(page.nextIndex)"><a rel="next" :href="href(page.nextIndex)" aria-label="Nästa sida" @click="navigateLink($event, href(page.nextIndex))"><span class="submit btn navicon navicon-visual right" aria-hidden="true"><i class="fa fa-angle-right right" /></span></a></NuxtLink>
            <span class="expl small" aria-hidden="true">Du kan också bläddra med tangentbordets piltangenter.</span>
          </nav>
          <div v-if="page.pageCount !== null && page.pageIndexes === null" class="w-11/12">
            <span class="rzslider mt-3 slider-large" :class="{ active: sliderDraft !== null }">
              <span class="rz-base" aria-hidden="true">
                <span class="rz-bar-wrapper"><span class="rz-bar" /></span>
                <span class="rz-bar-wrapper"><span class="rz-bar rz-selection" :style="sliderStyles.selection" /></span>
              </span>
              <span class="rz-pointer rz-pointer-min" :style="sliderStyles.pointer" aria-hidden="true" />
              <span v-if="sliderDraft !== null" class="rz-bubble rz-model-value" :style="{ left: sliderStyles.selection.width }" aria-hidden="true">{{ sliderDraft }}</span>
              <input
                class="reader-slider-input editor-page-slider"
                type="range"
                min="0"
                :max="page.pageCount - 1"
                step="1"
                :value="sliderValue"
                aria-label="Gå till sida"
                :aria-valuetext="`Sida ${sliderValue}`"
                @input="previewSlider"
                @change="commitSlider"
                @blur="sliderDraft = null"
                @pointercancel="sliderDraft = null"
              >
            </span>
          </div>
          <div v-if="page.metadataAvailable" class="subnav mt-10 editor-metadata-controls">
            <ul>
              <li v-if="page.parts.length"><a ref="contentsTrigger" :href="contentsHref" @click.prevent="openContents">Innehållsförteckning</a></li>
              <li v-if="sourceInfoAvailable"><a ref="sourceInfoTrigger" :href="sourceInfoHref" @click.prevent="openSourceInfo">Mer om boken</a></li>
              <li><a :href="focusHref" @click.prevent="activateFocus">Läsfokus</a></li>
              <li v-if="page.searchable">
                <button
                  type="button"
                  class="reader-work-search-trigger reader-action-button"
                  :aria-expanded="workSearchOpen"
                  @click="toggleWorkSearch"
                >Sök i verket</button>
                <div v-show="workSearchOpen" class="searchbox">
                  <div class="collapse-content">
                    <div class="header">
                      <div class="auth">Sök i <span class="author"><ReaderContributors :contributors="page.contributors" /></span></div>
                      <div class="title">{{ page.title }}</div>
                    </div>
                    <div class="ctrls">
                      <form @submit.prevent="submitWorkSearch">
                        <input ref="workSearchInput" v-model="workSearchQuery" class="border border-gray-300" type="search" aria-label="Sök i verket">
                        <button type="submit" class="submit btn">Sök</button>
                      </form>
                      <p v-if="workSearchMessage" class="work-search-message" role="status">{{ workSearchMessage }}</p>
                      <ul class="search_opts_widget inline-block">
                        <li v-for="option in workSearchOptions" :key="option.key" class="hover:text-primary">
                          <span aria-hidden="true"><span>{{ option.selected ? "✓" : "" }}</span></span>
                          <button
                            type="button"
                            class="reader-action-button"
                            @click="chooseWorkSearchOption(option.key)"
                          ><span v-if="option.selected" class="sr-only">Valt: </span>{{ option.label }}</button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </li>
              <li v-else aria-disabled="true"><a class="disabled" aria-disabled="true" tabindex="-1">Sök i verket</a></li>
              <li><NuxtLink v-if="authorSearchHref" :to="authorSearchHref">Sök i författarens texter</NuxtLink><span v-else>Sök i författarens texter</span></li>
            </ul>
            <NuxtLink v-if="page.closeHref" class="submit btn mt-4 text-xs" :to="page.closeHref">Stäng editor</NuxtLink>
          </div>
        </aside>
      </Teleport>
      <template #fallback>
        <aside v-if="page" class="reader-context-ssr" aria-label="Läsinformation och sidnavigering">
          <div v-if="page.metadataAvailable" class="editor-metadata-controls"><span class="author"><ReaderContributors :contributors="page.contributors" /></span><span>{{ page.title }}<span
              v-if="page.imprintYear"
              class="editor-imprint-year"
            > ({{ page.imprintYear }})</span></span></div>
          <div v-if="page.metadataAvailable && page.currentPart" class="current_part editor-metadata-controls">
            <div class="header">
              <template
                v-for="(partAuthor, partAuthorIndex) in page.currentPart.authors"
                :key="`${partAuthor.author_id}:${partAuthorIndex}`"
              ><NuxtLink :to="`/f%C3%B6rfattare/${encodeURIComponent(partAuthor.author_id)}`">{{ currentPartAuthorLabel(partAuthorIndex) }}</NuxtLink><span
                  v-if="partAuthorIndex < page.currentPart.authors.length - 1"
                >, </span></template>
            </div>
            <p class="navtitle line-clamp-4">{{ partLabel() }}</p>
          </div>
          <nav aria-label="Sidnavigering">
            <a v-if="page.previousPartIndex !== null" :href="href(page.previousPartIndex)">Gå bakåt en del</a>
            <span v-else aria-disabled="true">Gå bakåt en del</span>
            <a v-if="page.nextPartIndex !== null" :href="href(page.nextPartIndex)">Gå till nästa del</a>
            <span v-else aria-disabled="true">Gå till nästa del</span>
            <a v-if="page.pageIndex !== page.firstReadableIndex" :href="href(page.firstReadableIndex)">Gå till första sidan</a>
            <span v-else aria-disabled="true">Gå till första sidan</span>
            <a v-if="page.pageIndex !== page.lastReadableIndex" :href="href(page.lastReadableIndex)">Gå till sista sidan</a>
            <span v-else aria-disabled="true">Gå till sista sidan</span>
            <a v-if="page.previousIndex !== null" rel="prev" :href="href(page.previousIndex)">Föregående sida</a>
            <a v-if="page.nextIndex !== null" rel="next" :href="href(page.nextIndex)">Nästa sida</a>
          </nav>
          <span v-if="page.pageName || page.endPageName" class="pages"><template
            v-if="page.pageName"
          >{{ page.pageName }}{{ " " }}</template><template
            v-if="page.endPageName"
          >av {{ page.endPageName }}</template></span>
          <input v-if="page.pageCount !== null && page.pageIndexes === null" type="range" min="0" :max="page.pageCount - 1" :value="page.pageIndex" aria-label="Gå till sida">
          <a v-if="page.metadataAvailable && page.parts.length" :href="contentsHref">Innehållsförteckning</a>
          <a v-if="page.metadataAvailable && page.authorId && page.titlePath" :href="sourceInfoHref">Mer om boken</a>
          <a v-if="page.metadataAvailable" :href="focusHref">Läsfokus</a>
          <span v-if="page.metadataAvailable" class="reader-work-search-trigger" :class="{ disabled: !page.searchable }">Sök i verket</span>
          <a v-if="page.metadataAvailable && page.closeHref" :href="page.closeHref">Stäng editor</a>
        </aside>
      </template>
    </ClientOnly>
    <ReaderContentsDialog
      v-if="page"
      :open="contentsOpen"
      :contributors="page.contributors"
      :title="page.title ?? page.workId"
      :imprint-year="page.imprintYear"
      :parts="page.parts"
      :part-hrefs="contentsPartHrefs"
      @close="closeContents"
      @select-page="selectContentsPage"
    />
    <ReaderSourceInfoDialog
      :open="sourceInfoOpen"
      :loading="sourceInfoLoading"
      :failed="sourceInfoFailed"
      :source-info="sourceInfo"
      @close="closeSourceInfo"
    />
  </div>
</template>

<style lang="scss" src="~/assets/styles/reader.scss"></style>

<style scoped>
.editor-reader-context .expl {
  margin-left: 8.078125px !important;
}

.editor-reader-context .pager_ctrls > .disabled {
  color: lightgrey;
}

.editor-facsimile-controls .reader-facsimile-size-controls button:first-of-type {
  margin-right: 4.53125px;
  width: 65.734375px;
}

.editor-facsimile-controls .reader-facsimile-rotation-controls button:first-of-type {
  margin-right: 4.53125px;
  text-indent: 0;
  width: 69.75px;
}

</style>
