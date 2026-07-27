<script setup lang="ts">
import presentationBackground from "~/assets/img/presentations.jpg"

import {
  emptyPresentationDocument,
  parseBackgroundRules,
  parsePresentationDocument,
  selectBackgroundRule,
  validatePresentationSegments,
  type BackgroundRule,
  type PresentationDocument
} from "./presentation-parser"

type PresentationPageData = {
  document: PresentationDocument
  background: BackgroundRule | null
}

function emptyPageData(): PresentationPageData {
  return {
    document: emptyPresentationDocument(),
    background: null
  }
}

definePageMeta({
  validate: route => validatePresentationSegments(route.params.segments)
})

const route = useRoute()
const config = useRuntimeConfig()
const segments = computed(() =>
  Array.isArray(route.params.segments)
    ? route.params.segments.map(String)
    : []
)
const isIndex = computed(() => segments.value.length === 0)
const contentPath = computed(() => isIndex.value
  ? "/red/presentationer/presentationerForfattare.html"
  : `/red/presentationer/${segments.value[0]}/${segments.value[1]}`
)
const canonicalPath = computed(() => isIndex.value
  ? "/presentationer"
  : `/presentationer/${segments.value[0]}/${segments.value[1]}`
)
const asyncKey = computed(() => `presentation-content:${segments.value.join("/") || "index"}`)

function contentUrl(path: string) {
  const base = import.meta.server ? config.contentBase : config.public.contentBase
  return `${base.replace(/\/$/, "")}${path}`
}

async function fetchDocument(path: string): Promise<PresentationDocument> {
  try {
    const source = await $fetch<string>(contentUrl(path), {
      responseType: "text",
      retry: 0
    })
    return parsePresentationDocument(source)
  } catch {
    return emptyPresentationDocument()
  }
}

async function fetchBackground(path: string): Promise<BackgroundRule | null> {
  try {
    const source = await $fetch<string>(
      contentUrl("/red/bilder/bakgrundsbilder/backgrounds.xml"),
      { responseType: "text", retry: 0 }
    )
    return selectBackgroundRule(parseBackgroundRules(source), path)
  } catch {
    return null
  }
}

const { data } = await useAsyncData<PresentationPageData>(asyncKey, async () => {
  if (isIndex.value) {
    return {
      document: await fetchDocument(contentPath.value),
      background: null
    }
  }

  const [document, background] = await Promise.all([
    fetchDocument(contentPath.value),
    fetchBackground(canonicalPath.value)
  ])
  return { document, background }
}, {
  default: emptyPageData
})

const pageData = computed(() => data.value ?? emptyPageData())
const navigateManagedHtml = useManagedHtmlNavigation()
const metadata = computed(() => isIndex.value
  ? {
      title: "Presentationer | Litteraturbanken",
      description: "Litteraturbankens presentationer."
    }
  : {
      title: pageData.value.document.title || "Presentationer | Litteraturbanken",
      description: pageData.value.document.description
    }
)

async function scrollToIndexAnchor(value: unknown) {
  if (!import.meta.client || !isIndex.value) return
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  if (typeof value !== "string" || !value) {
    window.scrollTo({ top: 0 })
    return
  }
  const anchor = document.getElementById(value)
  if (!anchor) return
  window.scrollTo({ top: window.scrollY + anchor.getBoundingClientRect().top })
}

watch(
  [
    () => route.query.ankare,
    () => pageData.value.document.bodyHtml,
    isIndex
  ],
  ([value]) => { void scrollToIndexAnchor(value) },
  { immediate: true, flush: "post" }
)

useSeoMeta({
  title: () => metadata.value.title,
  description: () => metadata.value.description
})

useHead(() => {
  const document = pageData.value.document
  const background = pageData.value.background
  const backgroundClasses = background?.className
    ?.split(/\s+/)
    .filter(Boolean)
    .map(className => `bkg-${className}`) ?? []
  const htmlBackground = isIndex.value
    ? `background: url('${presentationBackground}') no-repeat;`
    : background?.imagePath
      ? `background: url('${background.imagePath}') no-repeat;`
      : ""
  const stylesheetLinks = document.styleNodes.flatMap((node, index) =>
    node.kind === "stylesheet"
      ? [{
          key: `presentation-style-node-${index}`,
          rel: "stylesheet",
          href: node.href,
          tagPosition: "bodyClose" as const,
          tagPriority: 1_000 + index
        }]
      : []
  )
  const inlineStyles = document.styleNodes.flatMap((node, index) =>
    node.kind === "inline"
      ? [{
          key: `presentation-style-node-${index}`,
          textContent: node.textContent,
          tagPosition: "bodyClose" as const,
          tagPriority: 1_000 + index
        }]
      : []
  )

  return {
    htmlAttrs: { style: htmlBackground },
    bodyAttrs: {
      class: [
        "focus",
        "page-presentation",
        "ready",
        ...(!isIndex.value ? ["subpage"] : []),
        ...backgroundClasses
      ].join(" ")
    },
    link: stylesheetLinks,
    style: [
      ...inlineStyles,
      ...(background?.styleText
        ? [{ key: "presentation-background-style", textContent: background.styleText }]
        : [])
    ]
  }
})
</script>

<template>
  <div
    v-if="isIndex"
    class="doc main"
    @click="navigateManagedHtml"
    v-html="pageData.document.bodyHtml"
  />
  <div
    v-else
    class="content"
    style="position:relative;"
    @click="navigateManagedHtml"
    v-html="pageData.document.bodyHtml"
  />
</template>
