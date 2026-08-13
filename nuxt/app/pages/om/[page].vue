<script setup lang="ts">
import AboutPageShell from "../../components/about/AboutPageShell.vue"
import {
  aboutPages,
  isAboutPageKey,
  type AboutContent,
  type AboutPageKey
} from "#shared/about-pages"
import { emptyRenderableHtml } from "#shared/utils/renderable-html"

function emptyAboutContent(): AboutContent {
  return emptyRenderableHtml<AboutContent>()
}

interface AboutContentPayload {
  page: AboutPageKey
  html: AboutContent
}

definePageMeta({
  validate: route => {
    const page = Array.isArray(route.params.page) ? route.params.page[0] : route.params.page
    return isAboutPageKey(page)
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
  return value as AboutPageKey
})
const selectedPage = computed(() => aboutPages[pageKey.value])
const asyncKey = computed(() => `about-content:${pageKey.value}`)
const requestFetch = useRequestFetch()
const pendingPageKey = shallowRef<AboutPageKey | null>(null)
onBeforeRouteUpdate(to => {
  const value = Array.isArray(to.params.page) ? to.params.page[0] : to.params.page
  pendingPageKey.value = isAboutPageKey(value) ? value : null
})
watch(pageKey, value => {
  if (pendingPageKey.value === value) pendingPageKey.value = null
}, { flush: "sync" })
const displayedPageKey = computed(() => pendingPageKey.value ?? pageKey.value)

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

const { data: contentPayload } = await useAsyncData<AboutContentPayload>(asyncKey, async () => {
  const requestedPage = pageKey.value
  try {
    return {
      page: requestedPage,
      html: await requestFetch<AboutContent>(`/api/about/${encodeURIComponent(requestedPage)}`)
    }
  } catch (error) {
    if (import.meta.dev) console.error(`About content request failed for ${requestedPage}`, error)
    return { page: requestedPage, html: emptyAboutContent() }
  }
})

const aboutContent = computed(() =>
  contentPayload.value?.page === displayedPageKey.value
    ? contentPayload.value.html
    : emptyAboutContent()
)
const helpSubmenu = computed(() => pageKey.value === "hjalp" ? extractHelpSubmenu(aboutContent.value) : [])
const navigateManagedHtml = useManagedHtmlNavigation()
const helpContentComponent = useTemplateRef<{ $el: HTMLElement }>("help-content")

async function scrollToHelpAnchor(value: unknown): Promise<boolean> {
  if (
    !import.meta.client
    || pageKey.value !== "hjalp"
    || typeof value !== "string"
    || !value
  ) return false
  const requestedAnchor = value
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  if (pageKey.value !== "hjalp" || route.query.ankare !== requestedAnchor) return false
  const anchor = document.getElementById(requestedAnchor)
  if (!anchor) return false
  window.scrollTo({ top: window.scrollY + anchor.getBoundingClientRect().top - 40 })
  return true
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

watch(
  aboutContent,
  () => { void scrollToHelpAnchor(route.query.ankare) },
  { flush: "post" }
)

const removePageLoadingHook = useNuxtApp().hook("page:loading:end", () => {
  void scrollToHelpAnchor(route.query.ankare)
})
let helpResizeObserver: ResizeObserver | null = null
watch(
  [pageKey, helpContentComponent],
  ([currentPage, helpContent], _previous, onCleanup) => {
    helpResizeObserver?.disconnect()
    helpResizeObserver = null
    if (currentPage !== "hjalp" || !helpContent) return

    let observedHeight: number | null = null
    helpResizeObserver = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height
      if (height === undefined) return
      if (observedHeight === null) {
        observedHeight = height
        return
      }
      if (height === observedHeight) return
      helpResizeObserver?.disconnect()
      helpResizeObserver = null
      void scrollToHelpAnchor(route.query.ankare)
    })
    helpResizeObserver.observe(helpContent.$el)
    onCleanup(() => {
      helpResizeObserver?.disconnect()
      helpResizeObserver = null
    })
  },
  { flush: "post", immediate: true }
)
onBeforeUnmount(() => {
  helpResizeObserver?.disconnect()
  removePageLoadingHook()
})
</script>

<template>
  <AboutPageShell :active-page="selectedPage.activePage">
    <RenderableHtmlContent
      v-if="pageKey === 'hjalp'"
      ref="help-content"
      as="div"
      :html="aboutContent"
      class="help_content content unbox page-help"
      @click="navigateManagedHtml"
    />
    <RenderableHtmlContent
      v-else
      as="section"
      :html="aboutContent"
      @click="navigateManagedHtml"
    />
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
