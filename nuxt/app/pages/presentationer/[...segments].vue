<script setup lang="ts">
import presentationBackground from "~/assets/img/presentations.jpg"

import {
  fetchManagedText,
  managedPresentationBackgroundTextRules,
  managedPresentationDocumentTextRules
} from "#shared/utils/managed-text"

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

function contentLocation(path: string) {
  const base = import.meta.server ? config.contentBase : config.public.contentBase
  return {
    authorityOrigin: base || window.location.origin,
    url: `${base.replace(/\/$/, "")}${path}`
  }
}

async function fetchDocument(path: string, signal: AbortSignal): Promise<PresentationDocument> {
  try {
    const location = contentLocation(path)
    const source = await fetchManagedText(
      location.url,
      managedPresentationDocumentTextRules(location.authorityOrigin),
      (input, init) => fetch(input, { ...init, signal })
    )
    if (signal.aborted) throw signal.reason
    return parsePresentationDocument(source)
  } catch (error) {
    if (signal.aborted) throw error
    return emptyPresentationDocument()
  }
}

async function fetchBackground(path: string, signal: AbortSignal): Promise<BackgroundRule | null> {
  try {
    const location = contentLocation("/red/bilder/bakgrundsbilder/backgrounds.xml")
    const source = await fetchManagedText(
      location.url,
      managedPresentationBackgroundTextRules(location.authorityOrigin),
      (input, init) => fetch(input, { ...init, signal })
    )
    if (signal.aborted) throw signal.reason
    return selectBackgroundRule(parseBackgroundRules(source), path)
  } catch (error) {
    if (signal.aborted) throw error
    return null
  }
}

const presentationAsyncData = await useAsyncData<PresentationPageData>(asyncKey, async (_nuxtApp, { signal }) => {
  if (isIndex.value) {
    return {
      document: await fetchDocument(contentPath.value, signal),
      background: null
    }
  }

  const [document, background] = await Promise.all([
    fetchDocument(contentPath.value, signal),
    fetchBackground(canonicalPath.value, signal)
  ])
  return { document, background }
}, {
  lazy: true
})
const { data, pending: presentationPending } = presentationAsyncData

const pageData = computed(() => data.value ?? emptyPageData())
const navigateManagedHtml = useManagedHtmlNavigation()

function cancelPresentationContent(): void {
  presentationAsyncData.clear()
}

onBeforeRouteLeave(cancelPresentationContent)
onBeforeUnmount(cancelPresentationContent)
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
    v-if="presentationPending && !data"
    class="searching"
    role="status"
    aria-live="polite"
  >
    <div class="preloader">
      <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
      <span class="sr-only">Laddar presentationen</span>
    </div>
  </div>
  <RenderableHtmlContent
    v-else-if="isIndex"
    as="div"
    :html="pageData.document.bodyHtml"
    class="doc main"
    @click="navigateManagedHtml"
  />
  <RenderableHtmlContent
    v-else
    as="div"
    :html="pageData.document.bodyHtml"
    class="content"
    style="position:relative;"
    @click="navigateManagedHtml"
  />
</template>
