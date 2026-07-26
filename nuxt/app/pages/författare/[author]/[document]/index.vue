<script setup lang="ts">
import ordinaryBackground from "~/assets/img/forf2_bkg.jpg"
import { canonicalNuxtHref } from "~/lib/internal-navigation"
import type {
  AuthorDocumentErrorCode,
  AuthorDocumentKind,
  AuthorSupplementalPage
} from "~~/shared/types/author-document"

type UnknownRecord = Record<string, unknown>
type PageResult = {
  identity: string
  status: 200 | 404 | 502
  errorCode: AuthorDocumentErrorCode | null
  page: AuthorSupplementalPage | null
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validRouteParam(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.length >= 1 && value.length <= maximum
    && value === value.trim()
    && value !== "." && value !== ".."
    && !/[\\/%\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value)
}

function isDocumentKind(value: unknown): value is AuthorDocumentKind {
  return value === "presentation"
    || value === "bibliografi"
    || value === "semer"
    || value === "omtexterna"
}

function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function isAuthorSupplementalPage(value: unknown): value is AuthorSupplementalPage {
  if (!isRecord(value) || !isRecord(value.author)) return false
  const author = value.author
  return typeof author.authorId === "string"
    && typeof author.fullName === "string"
    && typeof author.lifespan === "string"
    && typeof author.hasIntroduction === "boolean"
    && typeof author.hasDramawebben === "boolean"
    && (author.searchUrl === null || typeof author.searchUrl === "string")
    && (author.audioUrl === null || typeof author.audioUrl === "string")
    && isDocumentKind(value.documentKind)
    && typeof value.bodyHtml === "string"
}

function localCode(error: unknown): AuthorDocumentErrorCode | null {
  if (!isRecord(error) || !isRecord(error.data)) return null
  const nested = error.data.data
  if (!isRecord(nested) || typeof nested.code !== "string") return null
  return [
    "author_document_author_not_found",
    "author_document_not_found",
    "author_document_unavailable"
  ].includes(nested.code) ? nested.code as AuthorDocumentErrorCode : null
}

async function loadPageResult(
  fetcher: ReturnType<typeof useRequestFetch>,
  author: string,
  kind: AuthorDocumentKind,
  identity: string
): Promise<PageResult> {
  try {
    const page = await fetcher<AuthorSupplementalPage>(
      `/api/author-documents/${encodeRfc3986Segment(author)}/${kind}`,
      { retry: 0 }
    )
    if (!isAuthorSupplementalPage(page)
      || page.author.authorId !== author
      || page.documentKind !== kind) {
      return {
        identity,
        status: 502,
        errorCode: "author_document_unavailable",
        page: null
      }
    }
    return { identity, status: 200, errorCode: null, page }
  } catch (error) {
    const code = localCode(error)
    if (code === "author_document_author_not_found" || code === "author_document_not_found") {
      return { identity, status: 404, errorCode: code, page: null }
    }
    return {
      identity,
      status: 502,
      errorCode: "author_document_unavailable",
      page: null
    }
  }
}

definePageMeta({
  validate: route => {
    const author = Array.isArray(route.params.author)
      ? route.params.author[0]
      : route.params.author
    const document = Array.isArray(route.params.document)
      ? route.params.document[0]
      : route.params.document
    return validRouteParam(author, 100)
      && isDocumentKind(document)
      && (document !== "omtexterna" || author === "LagerlöfS")
  }
})

const route = useRoute()
const fetcher = useRequestFetch()
const authorId = computed(() => {
  const value = Array.isArray(route.params.author) ? route.params.author[0] : route.params.author
  return typeof value === "string" ? value : ""
})
const documentKind = computed<AuthorDocumentKind>(() => {
  const value = Array.isArray(route.params.document)
    ? route.params.document[0]
    : route.params.document
  return isDocumentKind(value) ? value : "presentation"
})
const currentIdentity = computed(() => `${documentKind.value}:${authorId.value}`)
const isSlaLanding = computed(() => currentIdentity.value === "omtexterna:LagerlöfS")
const asyncKey = computed(() => `author-document:${currentIdentity.value}`)

const { data } = await useAsyncData<PageResult>(
  asyncKey,
  async () => {
    const author = authorId.value
    const kind = documentKind.value
    const identity = `${kind}:${author}`
    return await loadPageResult(fetcher, author, kind, identity)
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
const labels: Record<AuthorDocumentKind, string> = {
  presentation: "Presentation",
  bibliografi: "Bibliografi",
  semer: "Mera om",
  omtexterna: "Om texterna"
}
const pageLabel = computed(() => labels[documentKind.value])
const rootHref = computed(() => `/f%C3%B6rfattare/${encodeRfc3986Segment(authorId.value)}`)
const titlesHref = computed(() => `${rootHref.value}/titlar`)
const dramawebbenHref = computed(() => `${rootHref.value}/dramawebben`)

useSeoMeta({
  title: () => page.value
    ? `${page.value.author.fullName}, ${pageLabel.value} | Litteraturbanken`
    : `Författardokument | Litteraturbanken`,
  description: () => page.value
    ? `${page.value.author.fullName}, ${pageLabel.value}`
    : "Författardokument"
})
useHead(() => ({
  htmlAttrs: { style: `background: url('${ordinaryBackground}') no-repeat;` },
  bodyAttrs: {
    class: isSlaLanding.value
      ? "focus page-authorInfo site-sla ready"
      : "focus page-authorInfo ready"
  }
}))
</script>

<template>
  <div class="contents">
    <div :class="{ searching: !accepted }">
      <div v-if="!accepted" class="preloader" aria-live="polite">
        <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
        <span class="sr-only">Laddar författardokument</span>
      </div>
      <div
        v-else-if="accepted.errorCode === 'author_document_author_not_found'"
        class="error"
      >
        Ett fel har inträffat: författarid <code>{{ authorId }}</code> kan inte hittas. Kontrollera adressen.
      </div>
      <div
        v-else-if="accepted.errorCode === 'author_document_not_found'"
        class="error"
      >
        Ett fel har inträffat: dokumentet kan inte hittas. Kontrollera adressen.
      </div>
      <div v-else-if="accepted.status !== 200 || !page" class="error">
        Ett fel har inträffat. Författardokumentet kan inte visas just nu.
      </div>
      <template v-else>
        <h1 class="text-balance max-w-5xl">
          {{ page.author.fullName }}{{ " " }}<span
            v-if="page.author.lifespan"
            class="author_year"
          >({{ page.author.lifespan }})</span>
        </h1>

        <nav aria-label="Författarsidor">
          <ul class="links">
            <li v-if="page.author.hasIntroduction">
              <NuxtLink :to="canonicalNuxtHref(rootHref)">Introduktion</NuxtLink>
            </li>{{ " " }}
            <li>
              <NuxtLink :to="canonicalNuxtHref(titlesHref)">Verk</NuxtLink>
            </li>{{ " " }}
            <li v-if="page.author.audioUrl">
              <a
                :href="page.author.audioUrl"
                target="_blank"
                rel="noopener noreferrer"
              >Ljud</a>
            </li>{{ " " }}
            <li v-if="page.author.hasDramawebben">
              <NuxtLink :to="canonicalNuxtHref(dramawebbenHref)">Dramawebben</NuxtLink>
            </li>{{ " " }}
            <li v-if="page.author.searchUrl">
              <NuxtLink :to="canonicalNuxtHref(page.author.searchUrl)">Sök i texterna</NuxtLink>
            </li>
          </ul>
        </nav>

        <div class="page_content">
          <div class="content unbox" v-html="page.bodyHtml" />
        </div>
      </template>
    </div>
  </div>
</template>
