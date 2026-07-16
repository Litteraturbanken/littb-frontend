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
  },
  hjalp: {
    activePage: "hjalp",
    contentPath: "/red/om/hjalp/hjalp.html"
  },
  "mål": {
    activePage: null,
    contentPath: "/red/om/visioner/visioner.html"
  },
  "english.html": {
    activePage: null,
    contentPath: "/red/om/ide/english.html"
  },
  "deutsch.html": {
    activePage: null,
    contentPath: "/red/om/ide/deutsch.html"
  },
  "francais.html": {
    activePage: null,
    contentPath: "/red/om/ide/francais.html"
  }
} as const

type PageKey = keyof typeof pages

definePageMeta({
  validate: route => {
    const page = Array.isArray(route.params.page) ? route.params.page[0] : route.params.page
    return typeof page === "string" && [
      "ide",
      "organisation",
      "rattigheter",
      "tack",
      "hjalp",
      "mål",
      "english.html",
      "deutsch.html",
      "francais.html"
    ].includes(page)
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

function humanizeHelpLabel(value: string): string {
  const words = value
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/([a-z\d])([A-Z]+)/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase()
    .replace(/_id$/, "")
    .replace(/_/g, " ")
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

function extractHelpSubmenu(html: string): Array<{ id: string; label: string }> {
  if (!import.meta.client) return []
  const document = new DOMParser().parseFromString(html, "text/html")
  return Array.from(document.querySelectorAll<HTMLElement>("[id][name]"), element => ({
    id: element.id,
    label: humanizeHelpLabel(element.getAttribute("name") ?? "")
  }))
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

const helpSubmenu = computed(() => pageKey.value === "hjalp" ? extractHelpSubmenu(content.value ?? "") : [])

async function scrollToHelpAnchor(value: unknown) {
  if (!import.meta.client || typeof value !== "string" || !value) return
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const anchor = document.getElementById(value)
  if (!anchor) return
  window.scrollTo({ top: window.scrollY + anchor.getBoundingClientRect().top - 40 })
}

async function selectHelpAnchor(id: string) {
  await navigateTo({
    path: route.path,
    query: { ...route.query, ankare: id }
  })
}

watch(
  () => route.query.ankare,
  value => { void scrollToHelpAnchor(value) },
  { immediate: true, flush: "post" }
)
</script>

<template>
  <AboutPageShell :active-page="selectedPage.activePage">
    <div
      v-if="pageKey === 'hjalp'"
      class="help_content content unbox page-help"
      v-html="content || ''"
    />
    <section v-else v-html="content || ''" />
    <ClientOnly>
      <Teleport v-if="pageKey === 'hjalp'" to="#toolkit">
        <div toolkit>
          <ul class="help_submenu sticky">
            <li v-for="item in helpSubmenu" :key="item.id">
              <a
                :href="`/om/hjalp?ankare=${encodeURIComponent(item.id)}`"
                @click.prevent="selectHelpAnchor(item.id)"
              >{{ item.label }}</a>
            </li>
          </ul>
        </div>
      </Teleport>
    </ClientOnly>
  </AboutPageShell>
</template>
