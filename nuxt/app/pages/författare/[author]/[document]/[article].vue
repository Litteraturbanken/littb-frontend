<script setup lang="ts">
import ordinaryBackground from "~/assets/img/forf2_bkg.jpg"
import { canonicalNuxtHref, encodeRfc3986Segment } from "~/lib/internal-navigation"
import {
  SLA_ARTICLE_REGISTRY_BY_ID,
  isSlaArticleId,
  type SlaArticleErrorCode,
  type SlaArticleId,
  type SlaArticlePage
} from "#shared/types/sla-article"

type UnknownRecord = Record<string, unknown>
type PageResult = {
  identity: string
  status: 200 | 404 | 502
  errorCode: SlaArticleErrorCode | null
  page: SlaArticlePage | null
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function routeParam(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === "string" ? candidate : ""
}

function canonicalRoutePath(author: string, document: string, article: string): string {
  try {
    return "/f%C3%B6rfattare/" + [author, document, article]
      .map(encodeRfc3986Segment)
      .join("/")
  } catch {
    return ""
  }
}

function isExactAuthor(value: unknown): boolean {
  if (!isRecord(value)) return false
  return Object.keys(value).length === 7
    && value.authorId === "LagerlöfS"
    && value.fullName === "Selma Lagerlöf"
    && value.lifespan === "1858-1940"
    && value.hasIntroduction === true
    && value.hasDramawebben === true
    && value.searchUrl === "/sok?forfattare=Lagerl%C3%B6fS&avancerad"
    && (value.audioUrl === null
      || value.audioUrl
        === "https://litteraturbanken.se/ljudochbild/författare/lagerlofs")
}

function isExactSlaArticlePage(
  value: unknown,
  article: SlaArticleId
): value is SlaArticlePage {
  if (!isRecord(value)) return false
  return Object.keys(value).length === 4
    && isExactAuthor(value.author)
    && value.articleId === article
    && value.sourcePath === SLA_ARTICLE_REGISTRY_BY_ID[article].sourcePath
    && typeof value.bodyHtml === "string"
}

function localCode(error: unknown): SlaArticleErrorCode | null {
  if (!isRecord(error) || !isRecord(error.data)) return null
  const nested = error.data.data
  if (!isRecord(nested) || typeof nested.code !== "string") return null
  return nested.code === "sla_article_not_found"
    || nested.code === "sla_article_unavailable"
    ? nested.code
    : null
}

async function loadPageResult(
  fetcher: ReturnType<typeof useRequestFetch>,
  author: string,
  document: string,
  article: SlaArticleId,
  identity: string
): Promise<PageResult> {
  try {
    const page = await fetcher<SlaArticlePage>(
      "/api/author-documents/"
      + [author, document, article].map(encodeRfc3986Segment).join("/"),
      { retry: 0 }
    )
    if (!isExactSlaArticlePage(page, article)) {
      return {
        identity,
        status: 502,
        errorCode: "sla_article_unavailable",
        page: null
      }
    }
    return { identity, status: 200, errorCode: null, page }
  } catch (error) {
    const code = localCode(error)
    if (code === "sla_article_not_found") {
      return { identity, status: 404, errorCode: code, page: null }
    }
    return {
      identity,
      status: 502,
      errorCode: "sla_article_unavailable",
      page: null
    }
  }
}

definePageMeta({
  validate: route => {
    const author = routeParam(route.params.author)
    const document = routeParam(route.params.document)
    const article = routeParam(route.params.article)
    const path = route.fullPath.split(/[?#]/u, 1)[0]
    return author === "LagerlöfS"
      && document === "omtexterna"
      && isSlaArticleId(article)
      && path === canonicalRoutePath(author, document, article)
  }
})

const route = useRoute()
const fetcher = useRequestFetch()
const navigateManagedHtml = useManagedHtmlNavigation()
const authorId = computed(() => routeParam(route.params.author))
const documentKind = computed(() => routeParam(route.params.document))
const articleId = computed<SlaArticleId>(() => {
  const value = routeParam(route.params.article)
  return isSlaArticleId(value) ? value : "TextkritiskaRiktlinjer.html"
})
const currentIdentity = computed(
  () => `${authorId.value}:${documentKind.value}:${articleId.value}`
)
const asyncKey = computed(() => `sla-article:${currentIdentity.value}`)

const { data } = await useAsyncData<PageResult>(
  asyncKey,
  async () => {
    const author = authorId.value
    const document = documentKind.value
    const article = articleId.value
    const identity = `${author}:${document}:${article}`
    return await loadPageResult(fetcher, author, document, article, identity)
  },
  {
    lazy: true
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
useAuthorQuickSearchContextPublisher(computed(() => page.value?.author ?? null))
const rootHref = "/f%C3%B6rfattare/Lagerl%C3%B6fS"
const titlesHref = `${rootHref}/titlar`
const dramawebbenHref = `${rootHref}/dramawebben`

useSeoMeta({
  title: "Selma Lagerlöf, Om texterna | Litteraturbanken",
  description: "Selma Lagerlöf, Om texterna"
})
useHead({
  htmlAttrs: { style: `background: url('${ordinaryBackground}') no-repeat;` },
  bodyAttrs: { class: "focus page-authorInfo site-sla ready" }
})
</script>

<template>
  <div class="contents">
    <div :class="{ searching: !accepted }">
      <div v-if="!accepted" class="preloader" aria-live="polite">
        <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
        <span class="sr-only">Laddar artikel</span>
      </div>
      <div v-else-if="accepted.status === 404" class="error">
        Artikeln kan inte hittas. Kontrollera adressen.
      </div>
      <div v-else-if="accepted.status !== 200 || !page" class="error">
        Artikeln kan inte visas just nu.
      </div>
      <template v-else>
        <h1 class="text-balance max-w-5xl">
          {{ page.author.fullName }}{{ " " }}<span class="author_year">({{ page.author.lifespan }})</span>
        </h1>

        <nav aria-label="Författarsidor">
          <ul class="links">
            <li>
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
            <li>
              <NuxtLink :to="canonicalNuxtHref(dramawebbenHref)">Dramawebben</NuxtLink>
            </li>{{ " " }}
            <li>
              <NuxtLink :to="canonicalNuxtHref(page.author.searchUrl!)">Sök i texterna</NuxtLink>
            </li>
          </ul>
        </nav>

        <div class="page_content">
          <RenderableHtmlContent
            as="div"
            class="content unbox"
            :html="page.bodyHtml"
            @click="navigateManagedHtml"
          />
        </div>
      </template>
    </div>
  </div>
</template>
