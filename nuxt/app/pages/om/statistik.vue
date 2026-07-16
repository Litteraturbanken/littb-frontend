<script setup lang="ts">
import AboutPageShell from "../../components/about/AboutPageShell.vue"
import { createLbApiClient } from "../../lib/api/client"
import type { components } from "../../lib/api/generated/lbapi"

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

const config = useRuntimeConfig()
const client = createLbApiClient(
  import.meta.server ? config.apiBase : config.public.apiBase
)

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

const [statsAsync, worksAsync, epubsAsync] = await Promise.all([
  useAsyncData("statistics-summary", async () => ({ value: await requestStats() })),
  useAsyncData("statistics-popular-works", async () => ({
    value: await requestPopularWorks()
  })),
  useAsyncData("statistics-popular-epubs", async () => ({
    value: await requestPopularEpubs()
  }))
])

const statsData = computed(() => statsAsync.data.value?.value ?? null)
const popularWorks = computed(() => worksAsync.data.value?.value?.items ?? [])
const popularEpubs = computed(() => epubsAsync.data.value?.value?.items ?? [])

function numberFmt(value: number): string {
  const digits = String(value)
  return digits.length < 5 ? digits : digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

function authorHref(item: PopularWork | PopularEpub): string {
  return `/författare/${item.author.author_id}`
}

function authorLabel(item: PopularWork | PopularEpub): string {
  return item.author.surname || item.author.full_name
}

function readerHref(item: PopularWork): string {
  const base = `/författare/${item.author.author_id}/titlar/${item.title_id}`
  const page = item.representation.start_page_name
  return page === null
    ? `${base}/${item.representation.media_type}`
    : `${base}/sida/${page}/${item.representation.media_type}`
}

function epubHref(item: PopularEpub): string {
  return `/txt/epub/${item.author.author_id}_${item.title_id}.epub`
}
</script>

<template>
  <AboutPageShell active-page="statistik">
  <div v-if="statsData" class="content stats unbox">
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
        <a :href="readerHref(item)">{{ item.short_title || item.title }}</a>
        <a class="author pull-right" :href="authorHref(item)">
          {{ authorLabel(item) }}
        </a>
      </li>
    </ul>

    <h3>De mest nedladdade epubarna</h3>
    <ul>
      <li v-for="(item, index) in popularEpubs" :key="item.title_id">
        <span class="num">{{ index + 1 }}. </span>
        <a :href="epubHref(item)" download target="_self">
          {{ item.short_title || item.title }}
        </a>
        <a class="author pull-right" :href="authorHref(item)">
          {{ authorLabel(item) }}
        </a>
      </li>
    </ul>
  </div>
  </AboutPageShell>
</template>
