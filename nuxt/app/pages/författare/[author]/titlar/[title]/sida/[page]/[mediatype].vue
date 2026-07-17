<script setup lang="ts">
import { parseHTML } from "linkedom"

import type { ReaderPage } from "#shared/types/reader"
import { createLbApiClient } from "~/lib/api/client"
import type { components } from "~/lib/api/generated/lbapi"
import { readerAuthorHref, readerHitHref, readerPageHref } from "~/lib/reader-routes"

definePageMeta({
  validate: route => {
    const values = [
      route.params.author,
      route.params.title,
      route.params.page,
      route.params.mediatype
    ]
    return values.every(value => typeof value === "string" && value.length > 0) &&
      route.params.mediatype === "etext"
  }
})

const route = useRoute()
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
const wordIdPattern = /^w(?<page>\d+)_(?<ordinal>\d+)$/

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
  if (!Number.isSafeInteger(hit) || hit < 0 || Math.max(hit - 1, 0) > 1_000_000) {
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

function preservedQuery(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(route.query).flatMap(([key, value]) => {
      if (typeof value === "string") return [[key, value]]
      if (value === null) return [[key, ""]]
      return []
    })
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum
}

function isWorkSearchHit(value: unknown): value is WorkSearchHit {
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

  const fromMatch = wordIdPattern.exec(fromWordId)
  const toMatch = wordIdPattern.exec(toWordId)
  return fromMatch?.groups?.page === String(value.page_index) &&
    toMatch?.groups?.page === String(value.page_index)
}

function isExpectedHitResponse(
  value: unknown,
  state: CanonicalSearchState,
  offset: number
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
      !isWorkSearchHit(item) ||
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

const searchState = parseCanonicalSearchState()
const pageQuery = preservedQuery()
if (searchState) {
  pageQuery.q = searchState.query
  pageQuery.hit = String(searchState.hit)
}

function routeParam(name: "author" | "title" | "page" | "mediatype"): string {
  const value = route.params[name]
  if (typeof value !== "string" || !value) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  return value
}

const authorParam = routeParam("author")
const titleParam = routeParam("title")
const pageParam = routeParam("page")
const mediaTypeParam = routeParam("mediatype")
const readerApiUrl = [authorParam, titleParam, pageParam, mediaTypeParam]
  .map(encodeURIComponent)
  .join("/")
const requestFetch = useRequestFetch()

const { data, error } = await useAsyncData<ReaderPage>(
  `reader:${authorParam}:${titleParam}:${pageParam}:${mediaTypeParam}`,
  () => requestFetch(`/api/reader/${readerApiUrl}`)
)

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: error.value.statusMessage ?? "Reader page unavailable"
  })
}
if (!data.value) {
  throw createError({ statusCode: 502, statusMessage: "Reader page unavailable" })
}

const reader = computed(() => data.value!)
const authorHref = readerAuthorHref(authorParam)
const pageTitle = computed(
  () => `${reader.value.title} sida ${reader.value.pageName} etext | Litteraturbanken`
)

const hitFetch = searchState
  ? await useAsyncData(
      [
        "reader-hit",
        reader.value.workId,
        searchState.query,
        searchState.hit,
        Number(searchState.wordForms),
        Number(searchState.includeOlderSpellings),
        Number(searchState.prefix),
        Number(searchState.suffix)
      ].join(":"),
      async () => {
        const offset = Math.max(searchState.hit - 1, 0)
        try {
          const client = createLbApiClient(
            import.meta.server ? config.apiBase : config.public.apiBase
          )
          const result = await client.GET("/works/{work_id}/search-hits", {
            params: {
              path: { work_id: reader.value.workId },
              query: {
                media_type: "etext",
                query: searchState.query,
                offset,
                limit: 3,
                word_forms: searchState.wordForms,
                include_older_spellings: searchState.includeOlderSpellings,
                prefix: searchState.prefix,
                suffix: searchState.suffix
              }
            }
          })
          if (result.error || !isExpectedHitResponse(result.data, searchState, offset)) {
            return { status: "error" as const }
          }
          return { status: "success" as const, response: result.data }
        } catch {
          return { status: "error" as const }
        }
      }
    )
  : null

const hitResponse = computed(() => {
  const value = hitFetch?.data.value
  return value?.status === "success" ? value.response : null
})
const hitRequestFailed = computed(
  () => hitFetch !== null && hitFetch.data.value?.status === "error"
)
const activeHit = computed(() => {
  if (!searchState || !hitResponse.value) return null
  return hitResponse.value.items.find(item => item.index === searchState.hit) ?? null
})
const previousHit = computed(() => {
  if (!searchState || !hitResponse.value) return null
  return hitResponse.value.items.find(item => item.index === searchState.hit - 1) ?? null
})
const nextHit = computed(() => {
  if (!searchState || !hitResponse.value) return null
  return hitResponse.value.items.find(item => item.index === searchState.hit + 1) ?? null
})
const markedReaderHtml = computed(() => {
  if (!activeHit.value) return reader.value.html
  return markReaderHtml(
    reader.value.html,
    activeHit.value,
    reader.value.pageName,
    reader.value.pageIndex
  )
})
const hitPosition = computed(() => {
  if (!searchState || !activeHit.value || !hitResponse.value) return null
  return `Sökträff ${searchState.hit + 1} av ${hitResponse.value.total_hits}`
})
const hitMessage = computed(() => {
  if (!searchState) return null
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
  const current: LastPageView = {
    pageix: reader.value.pageIndex,
    pagename: reader.value.pageName,
    timestamp: new Date().toISOString(),
    mediatype: reader.value.mediaType,
    lbworkid: reader.value.workId,
    author: authorParam,
    label: reader.value.title,
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

useSeoMeta({
  title: pageTitle,
  description: () => reader.value.description
})

useHead(() => ({
  bodyAttrs: { class: "focus page-reading ready" },
  link: [
    { rel: "stylesheet", href: reader.value.sharedStylesheetUrl },
    { rel: "stylesheet", href: reader.value.workStylesheetUrl }
  ]
}))

function pageHref(pageName: string): string {
  return readerPageHref({
    author: authorParam,
    title: titleParam,
    page: pageName,
    mediaType: mediaTypeParam,
    query: pageQuery
  })
}

function hitHref(hit: WorkSearchHit): string {
  return readerHitHref({
    author: authorParam,
    title: titleParam,
    page: hit.page_name,
    mediaType: mediaTypeParam,
    query: pageQuery,
    hit: hit.index
  })
}
</script>

<template>
  <div class="reader-page">
    <section class="reader_main state-not-parallel" :aria-label="`${reader.title}, sida ${reader.pageName}`">
      <div class="etext txt" v-html="markedReaderHtml" />
    </section>

    <aside class="reader-context" aria-label="Läsinformation och sidnavigering">
      <div class="reader-work">
        <a class="author" :href="authorHref">{{ reader.author.name }}</a>
        <div>
          <span class="title">{{ reader.title }}</span>
          <span v-if="reader.imprintYear"> ({{ reader.imprintYear }})</span>
        </div>
      </div>

      <hr>

      <div v-if="searchState" class="reader-search-state" aria-live="polite">
        <p v-if="hitPosition" class="reader-search-position">{{ hitPosition }}</p>
        <p v-if="hitMessage" class="reader-search-message">{{ hitMessage }}</p>
        <nav
          v-if="previousHit || nextHit"
          class="reader-hit-navigation"
          aria-label="Sökträffsnavigering"
        >
          <a v-if="previousHit" rel="prev" :href="hitHref(previousHit)">Föregående sökträff</a>
          <span v-else />
          <a v-if="nextHit" rel="next" :href="hitHref(nextHit)">Nästa sökträff</a>
        </nav>
      </div>

      <hr v-if="searchState">

      <nav class="reader-navigation" aria-label="Sidnavigering">
        <a
          v-if="reader.previousPageName"
          rel="prev"
          :href="pageHref(reader.previousPageName)"
        >Föregående sida</a>
        <span v-else />
        <a
          v-if="reader.nextPageName"
          rel="next"
          :href="pageHref(reader.nextPageName)"
        >Nästa sida</a>
      </nav>

      <p class="reader-page-position">{{ reader.pageName }} av {{ reader.pageCount }}</p>
    </aside>
  </div>
</template>
