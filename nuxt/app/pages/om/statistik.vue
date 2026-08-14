<script setup lang="ts">
import AboutPageShell from "../../components/about/AboutPageShell.vue"
import { useLbApiClient } from "../../composables/useLbApiClient"
import type { components } from "../../lib/api/generated/lbapi"
import { authorProfilePath, encodeRfc3986Segment } from "../../lib/author-profile"
import { isSafePopularEpub, isSafePopularWork } from "../../lib/statistics-items"

type PopularWork = components["schemas"]["PopularWork"]
type PopularEpub = components["schemas"]["PopularEpub"]

useSeoMeta({
  title: "Om LB | Litteraturbanken",
  description: "Statistik för Litteraturbanken."
})

useHead({
  htmlAttrs: {
    style: "background: url('/assets/img/backgrounds/about_bkg.jpg') no-repeat;"
  },
  bodyAttrs: { class: "focus page-about ready" }
})

const client = useLbApiClient()

function reportFailure(resource: string, error: unknown) {
  if (import.meta.dev) console.error(`Statistics ${resource} request failed`, error)
}

async function requestStats() {
  try {
    const { data, error } = await client.GET("/stats")
    if (error) reportFailure("summary", error)
    return data ?? null
  } catch (error) {
    reportFailure("summary", error)
    return null
  }
}

async function requestPopularWorks() {
  try {
    const { data, error } = await client.GET("/works/popular", {
      params: { query: { limit: 30 } }
    })
    if (error) reportFailure("popular works", error)
    return data ?? null
  } catch (error) {
    reportFailure("popular works", error)
    return null
  }
}

async function requestPopularEpubs() {
  try {
    const { data, error } = await client.GET("/epubs/popular", {
      params: { query: { limit: 30 } }
    })
    if (error) reportFailure("popular EPUBs", error)
    return data ?? null
  } catch (error) {
    reportFailure("popular EPUBs", error)
    return null
  }
}

const statsAsync = useAsyncData(
  "statistics-summary",
  async () => ({ value: await requestStats() }),
  { lazy: true }
)
const worksAsync = useAsyncData(
  "statistics-popular-works",
  async () => ({
    value: await requestPopularWorks()
  }),
  { lazy: true }
)
const epubsAsync = useAsyncData(
  "statistics-popular-epubs",
  async () => ({
    value: await requestPopularEpubs()
  }),
  { lazy: true }
)

if (import.meta.server) await Promise.all([statsAsync, worksAsync, epubsAsync])

const statsData = computed(() => statsAsync.data.value?.value ?? null)
const popularWorks = computed(() => (
  worksAsync.data.value?.value?.items ?? []
).filter(isSafePopularWork))
const popularEpubs = computed(() => (
  epubsAsync.data.value?.value?.items ?? []
).filter(isSafePopularEpub))
const statisticsPending = computed(() => [statsAsync, worksAsync, epubsAsync]
  .some(resource => resource.status.value === "idle" || resource.status.value === "pending"))
const statisticsReady = computed(() => !statisticsPending.value)

function numberFmt(value: number): string {
  const digits = String(value)
  return digits.length < 5 ? digits : digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

function authorHref(item: PopularWork | PopularEpub): string {
  return authorProfilePath(item.author.author_id)
}

function authorLabel(item: PopularWork | PopularEpub): string {
  return item.author.surname || item.author.full_name
}

function readerHref(item: PopularWork): string {
  const base = authorProfilePath(item.author.author_id, "titlar", item.title_path)
  const page = item.representation.start_page_name
  return page === null
    ? `${base}/${encodeRfc3986Segment(item.representation.media_type)}`
    : `${base}/sida/${encodeRfc3986Segment(page)}`
      + `/${encodeRfc3986Segment(item.representation.media_type)}`
}

function pdfHref(item: PopularWork): string {
  const workId = encodeRfc3986Segment(item.representation.work_id)
  return `/txt/${workId}/${workId}.pdf`
}

function epubHref(item: PopularEpub): string {
  const authorId = encodeRfc3986Segment(item.author.author_id)
  const titleId = encodeRfc3986Segment(item.title_id)
  return `/txt/epub/${authorId}_${titleId}.epub`
}
</script>

<template>
  <AboutPageShell active-page="statistik">
  <div
    v-if="statisticsPending"
    role="status"
    aria-live="polite"
    aria-label="Laddar statistik"
  >
    Laddar statistik
  </div>
  <div v-else-if="statisticsReady && statsData" class="content stats unbox">
    <h3>Litteraturbanken innehåller just nu</h3>
    <ul>
      <li>{{ numberFmt(statsData.works) }} verk</li>
      <li>{{ numberFmt(statsData.authors) }} författare</li>
      <li>{{ numberFmt(statsData.pages.etext) }} sidor etext</li>
      <li>{{ numberFmt(statsData.pages.faksimil) }} sidor faksimil</li>
      <li>{{ numberFmt(statsData.words.etext + statsData.words.faksimil) }} ord</li>
      <li>{{ numberFmt(statsData.epubs) }} epubfiler</li>
    </ul>

    <h3>De mest lästa verken</h3>
    <ul>
      <li v-for="(item, index) in popularWorks" :key="item.representation.work_id">
        <span class="num">{{ index + 1 }}. </span>
        <a
          v-if="item.representation.media_type === 'pdf'"
          :href="pdfHref(item)"
          target="_self"
        >{{ item.short_title || item.title }}</a>
        <NuxtLink v-else :to="readerHref(item)">{{ item.short_title || item.title }}</NuxtLink>
        <NuxtLink class="author pull-right" :to="authorHref(item)">
          {{ authorLabel(item) }}
        </NuxtLink>
      </li>
    </ul>

    <h3>De mest nedladdade epubarna</h3>
    <ul>
      <li v-for="(item, index) in popularEpubs" :key="item.title_id">
        <span class="num">{{ index + 1 }}. </span>
        <a :href="epubHref(item)" download target="_self">
          {{ item.short_title || item.title }}
        </a>
        <NuxtLink class="author pull-right" :to="authorHref(item)">
          {{ authorLabel(item) }}
        </NuxtLink>
      </li>
    </ul>
  </div>
  </AboutPageShell>
</template>
