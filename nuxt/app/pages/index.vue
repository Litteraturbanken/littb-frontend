<script setup lang="ts">
import {
  emptyHomeContent,
  parseHomeContent,
  type HomeContent
} from "../lib/home-content"
import {
  fetchManagedText,
  managedHomeTextRules
} from "#shared/utils/managed-text"

const contentPath = "/red/om/start/startsida-ny.html"
const navigateManagedHtml = useManagedHtmlNavigation()

useSeoMeta({
  title: "Litteraturbanken | Svenska klassiker som e-bok och epub",
  description: "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."
})

const cacheBuster = useState<string>("home-cache-buster", () => {
  if (import.meta.dev) return Math.random().toString(36).slice(2)
  const now = new Date()
  return String((now.getFullYear() % 100) * 100 + now.getMonth() + 1)
})
const config = useRuntimeConfig()

const { data: content } = await useAsyncData<HomeContent>("home-content", async () => {
  const base = import.meta.server ? config.contentBase : config.public.contentBase
  const url = `${base.replace(/\/$/, "")}${contentPath}?${cacheBuster.value}`
  try {
    const authorityOrigin = base || window.location.origin
    const source = await fetchManagedText(url, managedHomeTextRules(authorityOrigin))
    return parseHomeContent(source)
  } catch {
    return emptyHomeContent()
  }
}, {
  default: () => emptyHomeContent()
})

const homeContent = computed(() => content.value ?? emptyHomeContent())

useHead(() => {
  const parsed = homeContent.value
  const background = parsed.backgroundImagePath && parsed.backgroundColor
    ? `background: ${parsed.backgroundColor} url('${parsed.backgroundImagePath}') no-repeat;`
    : ""
  return {
    htmlAttrs: { style: background },
    bodyAttrs: { class: "focus page-start ready" },
    link: parsed.stylesheetPath
      ? [{
          key: "home-runtime-stylesheet",
          rel: "stylesheet",
          href: `${parsed.stylesheetPath}?${cacheBuster.value}`
        }]
      : []
  }
})
</script>

<template>
  <div class="center_col">
    <h1>Litteraturbanken</h1>
    <h2 class="caps">Nytt <i class="no-caps">&amp;</i> anmärkningsvärt</h2>
    <RenderableHtmlContent
      as="div"
      :html="homeContent.bodyHtml"
      class="home-editorial"
      @click="navigateManagedHtml"
    />
  </div>
</template>
