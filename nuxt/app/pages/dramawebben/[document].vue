<script setup lang="ts">
import DramawebbenShell from "~/components/dramawebben/DramawebbenShell.vue"
import type {
  DramawebbenDocumentErrorCode,
  DramawebbenDocumentKind,
  DramawebbenManagedDocument
} from "~~/shared/types/dramawebben-document"

type UnknownRecord = Record<string, unknown>
type PageResult = {
  identity: string
  status: 200 | 404 | 502
  errorCode: DramawebbenDocumentErrorCode | null
  page: DramawebbenManagedDocument | null
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDocumentKind(value: unknown): value is DramawebbenDocumentKind {
  return value === "om" || value === "kringtexter"
}

function routeDocumentParam(route: ReturnType<typeof useRoute>): unknown {
  return Array.isArray(route.params.document)
    ? route.params.document[0]
    : route.params.document
}

function validatedDocumentParam(
  route: ReturnType<typeof useRoute>
): DramawebbenDocumentKind {
  const value = routeDocumentParam(route)
  if (!isDocumentKind(value)) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" })
  }
  return value
}

function isManagedDocument(value: unknown): value is DramawebbenManagedDocument {
  return isRecord(value)
    && isDocumentKind(value.documentKind)
    && typeof value.bodyHtml === "string"
}

function localCode(error: unknown): DramawebbenDocumentErrorCode | null {
  if (!isRecord(error) || !isRecord(error.data)) return null
  const nested = error.data.data
  if (!isRecord(nested) || typeof nested.code !== "string") return null
  return [
    "dramawebben_document_not_found",
    "dramawebben_document_unavailable"
  ].includes(nested.code) ? nested.code as DramawebbenDocumentErrorCode : null
}

async function loadPageResult(
  fetcher: ReturnType<typeof useRequestFetch>,
  kind: DramawebbenDocumentKind,
  identity: string
): Promise<PageResult> {
  try {
    const page = await fetcher<DramawebbenManagedDocument>(
      `/api/dramawebben/documents/${kind}`,
      { retry: 0 }
    )
    if (!isManagedDocument(page) || page.documentKind !== kind) {
      return {
        identity,
        status: 502,
        errorCode: "dramawebben_document_unavailable",
        page: null
      }
    }
    return { identity, status: 200, errorCode: null, page }
  } catch (error) {
    const code = localCode(error)
    if (code === "dramawebben_document_not_found") {
      return { identity, status: 404, errorCode: code, page: null }
    }
    return {
      identity,
      status: 502,
      errorCode: "dramawebben_document_unavailable",
      page: null
    }
  }
}

definePageMeta({
  validate: route => !Array.isArray(route.params.document)
    && isDocumentKind(route.params.document)
})

const route = useRoute()
const fetcher = useRequestFetch()
const kind = computed<DramawebbenDocumentKind>(() => validatedDocumentParam(route))
const currentIdentity = computed(() => kind.value)
const asyncKey = computed(() => `dramawebben-document:${currentIdentity.value}`)

const { data } = await useAsyncData<PageResult>(
  asyncKey,
  async () => {
    const requestedKind = kind.value
    return await loadPageResult(fetcher, requestedKind, requestedKind)
  },
  {
    lazy: true,
    getCachedData: (key, nuxtApp) => {
      const cached = nuxtApp.payload.data[key] as PageResult | undefined
      return cached?.identity === currentIdentity.value ? cached : undefined
    }
  }
)

const accepted = shallowRef<PageResult | null>(null)
watch(currentIdentity, () => {
  accepted.value = null
}, { flush: "sync" })
watch([data, currentIdentity], ([candidate, identity]) => {
  if (candidate?.identity === identity) accepted.value = candidate
}, { immediate: true, flush: "sync" })

if (import.meta.server && accepted.value?.status !== 200) {
  setResponseStatus(accepted.value?.status ?? 502)
}

const page = computed(() => accepted.value?.status === 200 ? accepted.value.page : null)

useSeoMeta({
  title: "Litteraturbanken",
  description: "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."
})
useHead({
  bodyAttrs: { class: "focus page-dramaweb drama-dramasubpage ready" }
})
</script>

<template>
  <DramawebbenShell :page="kind">
    <RenderableHtmlContent v-if="page" as="div" :html="page.bodyHtml" />
    <p v-else-if="accepted" class="error">Innehållet kan inte visas just nu.</p>
  </DramawebbenShell>
</template>
