<script setup lang="ts">
import AboutPageShell from "../../components/about/AboutPageShell.vue"

const pages = {
  ide: {
    activePage: "ide",
    contentPath: "/red/om/ide/omlitteraturbanken.html"
  },
  organisation: {
    activePage: null,
    contentPath: "/red/om/ide/organisation.html"
  },
  rattigheter: {
    activePage: "rattigheter",
    contentPath: "/red/om/rattigheter/rattigheter.html"
  },
  tack: {
    activePage: "tack",
    contentPath: "/red/om/tack.html"
  }
} as const

type PageKey = keyof typeof pages

definePageMeta({
  validate: route => {
    const page = Array.isArray(route.params.page) ? route.params.page[0] : route.params.page
    return typeof page === "string" && ["ide", "organisation", "rattigheter", "tack"].includes(page)
  }
})

useSeoMeta({
  title: "Om LB | Litteraturbanken",
  description: "Om Litteraturbanken."
})

useHead({
  htmlAttrs: {
    style: "background: url('/assets/img/backgrounds/about_bkg.jpg') no-repeat;"
  },
  bodyAttrs: { class: "focus page-about ready" }
})

const route = useRoute()
const pageKey = computed(() => {
  const value = Array.isArray(route.params.page) ? route.params.page[0] : route.params.page
  return value as PageKey
})
const selectedPage = computed(() => pages[pageKey.value])
const asyncKey = computed(() => `about-content:${pageKey.value}`)
const config = useRuntimeConfig()

function extractBody(html: string): string {
  const body = html.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i)
  return body?.[1] ?? html
}

const { data: content } = await useAsyncData(asyncKey, async () => {
  const base = import.meta.server ? config.contentBase : config.public.contentBase
  const url = `${base.replace(/\/$/, "")}${selectedPage.value.contentPath}`
  try {
    const html = await $fetch<string>(url, { responseType: "text" })
    return extractBody(html)
  } catch (error) {
    if (import.meta.dev) console.error(`About content request failed for ${pageKey.value}`, error)
    return ""
  }
})
</script>

<template>
  <AboutPageShell :active-page="selectedPage.activePage">
    <div v-html="content || ''" />
  </AboutPageShell>
</template>
