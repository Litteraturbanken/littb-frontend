<script setup lang="ts">
import { parseHTML } from "linkedom"
import type { LocationQueryRaw, RouteLocationRaw } from "vue-router"

import type {
  ReaderFacsimileSize,
  ReaderPage
} from "#shared/types/reader"
import { createLbApiClient } from "~/lib/api/client"
import type { components } from "~/lib/api/generated/lbapi"
import {
  readerAuthorHref,
  readerHitHref,
  readerPageHref,
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
const config = useRuntimeConfig()

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
    Object.entries(route.query).map(([key, value]) => [
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

const reader = computed(() => {
  const current = data.value
  return current?.status === "success" && current.identity === readerRequestIdentity.value
    ? current.reader
    : null
})
const primaryReaderFailed = computed(
  () => data.value?.status === "error" &&
    data.value.identity === readerRequestIdentity.value
)
const etextReader = computed(() => reader.value?.mediaType === "etext" ? reader.value : null)
const facsimileReader = computed(
  () => reader.value?.mediaType === "faksimil" ? reader.value : null
)
const searchState = computed(() => etextReader.value ? parseCanonicalSearchState() : null)
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
const pageTitle = computed(
  () => reader.value
    ? `${reader.value.title} sida ${reader.value.pageName} ${reader.value.mediaType} | Litteraturbanken`
    : "Litteraturbanken"
)

const hitFetch = await useAsyncData(
  computed(() => [
        "reader-hit",
        route.fullPath,
        data.value?.identity ?? "pending",
        data.value?.status === "success" ? data.value.reader.workId : "pending"
      ].join(":")),
      async () => {
        const identity = route.fullPath
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
      { watch: [() => route.fullPath, () => data.value?.identity] }
    )

const hitResponse = computed(() => {
  const value = hitFetch.data.value
  return value?.status === "success" &&
    value.identity === route.fullPath &&
    data.value?.status === "success" &&
    data.value.identity === readerRequestIdentity.value &&
    data.value.reader.mediaType === "etext"
    ? value.response
    : null
})
const hitRequestFailed = computed(
  () => hitFetch.data.value?.status === "error" &&
    hitFetch.data.value.identity === route.fullPath
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
    url: route.fullPath
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
  [() => route.fullPath, () => data.value?.identity, () => data.value?.status],
  ([_fullPath, identity, status]) => {
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
  bodyAttrs: { class: "focus page-reading ready" },
  link: etextReader.value
    ? [
        { rel: "stylesheet", href: etextReader.value.sharedStylesheetUrl },
        { rel: "stylesheet", href: etextReader.value.workStylesheetUrl }
      ]
    : []
}))

function readerTarget(pageName: string, hit?: number): RouteLocationRaw {
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
  return readerPageHref({
    author: authorParam.value,
    title: titleParam.value,
    page: pageName,
    mediaType: mediaTypeParam.value,
    query: pageQuery.value
  })
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
              <div class="author"><a :href="authorHref">{{ reader.author.name }}</a></div>
              <a class="title" aria-hidden="true">{{ reader.title }}</a>
              <span v-if="reader.imprintYear"> ({{ reader.imprintYear }})</span>
            </div>
            <span class="reader-page-position sr-only">{{ reader.pageName }} av {{ reader.pageCount }}</span>

            <hr>

            <div class="current_part">
              <div class="header"><a aria-hidden="true">{{ reader.author.name }}</a></div>
              <div><p class="navtitle line-clamp-4">{{ reader.title }}</p></div>
            </div>

            <hr class="lower">

            <nav class="pager_ctrls reader-navigation" aria-label="Sidnavigering">
              <a class="prev_part" aria-hidden="true">Gå bakåt en del</a>
              <br>
              <a class="next_part disabled" aria-hidden="true">Gå till nästa del</a>
              <br>
              <a class="disabled" aria-hidden="true">Gå till första sidan</a>
              <br>
              <a aria-hidden="true">Gå till sista sidan</a>
              <br>
              <form class="goto" aria-hidden="true"><a>Gå till sida . . .
                <span class="pages">{{ reader.pageName }} av {{ reader.nextPageName || reader.pageCount }}</span></a>
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
                  <span class="rz-bar-wrapper"><span class="rz-bar rz-selection" /></span>
                </span>
                <span class="rz-pointer rz-pointer-min" />
              </span>
            </div>

            <div class="subnav mt-10" aria-hidden="true">
              <ul>
                <li>Innehållsförteckning</li>
                <li>Mer om boken</li>
                <li>Läsfokus</li>
                <li>Sök i verket</li>
                <li>Sök i författarens texter</li>
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
            <li><a aria-hidden="true">Stäng träffvisningen</a></li>
          </ul>
        </nav>
        </Teleport>
        <template #fallback>
          <aside class="reader-context-ssr sr-only" aria-label="Läsinformation och sidnavigering">
            <a :href="authorHref">{{ reader.author.name }}</a>
            <span>{{ reader.title }}<template v-if="reader.imprintYear"> ({{ reader.imprintYear }})</template></span>
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
