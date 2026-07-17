<script setup lang="ts">
import { parseHTML } from "linkedom"
import type { LocationQueryRaw, RouteLocationRaw } from "vue-router"

import type { ReaderPage } from "#shared/types/reader"
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

const searchState = computed(parseCanonicalSearchState)
const pageQuery = computed(() => {
  const query = preservedQuery()
  if (searchState.value) {
    query.q = searchState.value.query
    query.hit = String(searchState.value.hit)
  }
  return query
})

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
const requestFetch = useRequestFetch()

type CurrentReaderPage =
  | { status: "success", identity: string, reader: ReaderPage }
  | { status: "error", identity: string }

const { data, error } = await useAsyncData<CurrentReaderPage>(
  computed(() => `reader:${route.fullPath}`),
  async () => {
    const identity = route.fullPath
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
  { lazy: true, watch: [() => route.fullPath] }
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
  return current?.status === "success" && current.identity === route.fullPath
    ? current.reader
    : null
})
const primaryReaderFailed = computed(
  () => data.value?.status === "error" && data.value.identity === route.fullPath
)
const authorHref = computed(() => reader.value
  ? readerAuthorHref(authorParam.value)
  : ""
)
const pageTitle = computed(
  () => reader.value
    ? `${reader.value.title} sida ${reader.value.pageName} etext | Litteraturbanken`
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
          currentReader.identity !== identity
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
          if (result.error || !isExpectedHitResponse(result.data, state, offset)) {
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
    data.value.identity === route.fullPath
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
  if (!reader.value) return ""
  if (!activeHit.value) return reader.value.html
  return markReaderHtml(
    reader.value.html,
    activeHit.value,
    reader.value.pageName,
    reader.value.pageIndex
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
  ([fullPath, identity, status]) => {
    if (status === "success" && identity === fullPath) writeLastPageView()
  },
  { flush: "post" }
)

useSeoMeta({
  title: pageTitle,
  description: () => reader.value?.description
})

useHead(() => ({
  bodyAttrs: { class: "focus page-reading ready" },
  link: reader.value
    ? [
        { rel: "stylesheet", href: reader.value.sharedStylesheetUrl },
        { rel: "stylesheet", href: reader.value.workStylesheetUrl }
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
</script>

<template>
  <div class="reader-page">
    <template v-if="reader">
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
            <NuxtLink
              v-if="previousHit"
              v-slot="{ navigate }"
              custom
              :to="readerTarget(previousHit.page_name, previousHit.index)"
            ><a rel="prev" :href="hitHref(previousHit)" @click="navigate">Föregående sökträff</a></NuxtLink>
            <span v-else />
            <NuxtLink
              v-if="nextHit"
              v-slot="{ navigate }"
              custom
              :to="readerTarget(nextHit.page_name, nextHit.index)"
            ><a rel="next" :href="hitHref(nextHit)" @click="navigate">Nästa sökträff</a></NuxtLink>
          </nav>
        </div>

        <hr v-if="searchState">

        <nav class="reader-navigation" aria-label="Sidnavigering">
          <NuxtLink
            v-if="reader.previousPageName"
            v-slot="{ navigate }"
            custom
            :to="readerTarget(reader.previousPageName)"
          ><a rel="prev" :href="pageHref(reader.previousPageName)" @click="navigate">Föregående sida</a></NuxtLink>
          <span v-else />
          <NuxtLink
            v-if="reader.nextPageName"
            v-slot="{ navigate }"
            custom
            :to="readerTarget(reader.nextPageName)"
          ><a rel="next" :href="pageHref(reader.nextPageName)" @click="navigate">Nästa sida</a></NuxtLink>
        </nav>

        <p class="reader-page-position">{{ reader.pageName }} av {{ reader.pageCount }}</p>
      </aside>

      <ClientOnly>
        <Teleport v-if="searchState" to="#toolkit">
        <i
          class="spinner_search fa fa-spinner fa-pulse"
          :class="{ searching: hitFetch?.status.value === 'pending' }"
          aria-hidden="true"
        />
        <nav id="search_nav" class="active" aria-label="Sökträffsnavigering">
          <div v-if="hitResponse" class="text" aria-live="polite">
            <div>
              <span class="num">{{ hitResponse.total_hits }}</span>
              {{ hitResponse.total_hits === 1 ? "sökträff" : "sökträffar" }}
            </div>
            <div v-if="activeHit">
              Träff <span>{{ activeHit.index + 1 }}</span>, sida {{ reader.pageName }}
            </div>
          </div>
          <p v-else-if="hitMessage" class="text" aria-live="polite">{{ hitMessage }}</p>
          <div v-if="previousHit || nextHit" class="ctrls">
            <div class="arrows">
              <NuxtLink
                v-if="previousHit"
                v-slot="{ navigate }"
                custom
                :to="readerTarget(previousHit.page_name, previousHit.index)"
              ><a
                rel="prev"
                class="submit btn navicon left"
                :href="hitHref(previousHit)"
                aria-label="Föregående sökträff"
                @click="navigate"
              ><i class="fa fa-angle-left" aria-hidden="true" /></a></NuxtLink>
              <NuxtLink
                v-if="nextHit"
                v-slot="{ navigate }"
                custom
                :to="readerTarget(nextHit.page_name, nextHit.index)"
              ><a
                rel="next"
                class="submit btn navicon"
                :href="hitHref(nextHit)"
                aria-label="Nästa sökträff"
                @click="navigate"
              ><i class="fa fa-angle-right" aria-hidden="true" /></a></NuxtLink>
            </div>
          </div>
        </nav>
        </Teleport>
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
