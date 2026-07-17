<script setup lang="ts">
import type { ReaderPage } from "#shared/types/reader"
import { readerAuthorHref, readerPageHref } from "~/lib/reader-routes"

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
    mediaType: mediaTypeParam
  })
}
</script>

<template>
  <div class="reader-page">
    <section class="reader_main state-not-parallel" :aria-label="`${reader.title}, sida ${reader.pageName}`">
      <div class="etext txt" v-html="reader.html" />
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
