<script setup lang="ts">
import type { ReaderRouteResolution } from "#shared/types/reader"
import { isNavigationFailure } from "vue-router"

definePageMeta({
  key: route => route.fullPath,
  validate: route => {
    const author = route.params.author
    const title = route.params.title
    return typeof author === "string" && author.length > 0 &&
      typeof title === "string" && title.length > 0 &&
      route.params.mediatype === "etext"
  }
})

type UnknownRecord = Record<string, unknown>

const route = useRoute()
const nuxtApp = useNuxtApp()
const router = useRouter()
const requestFetch = useRequestFetch()
const requestUrl = useRequestURL()
const requestedFullPath = route.fullPath
const requestedAuthor = scalarParam("author")
const requestedTitle = scalarParam("title")
const requestedMediaType = scalarParam("mediatype")
const queryIndex = requestedFullPath.indexOf("?")
const rawQuerySuffix = import.meta.server
  ? requestUrl.search
  : queryIndex >= 0 ? requestedFullPath.slice(queryIndex) : ""
const expectedCanonicalPath = [
  "/författare",
  encodeRfc3986Segment(requestedAuthor),
  "titlar",
  encodeRfc3986Segment(requestedTitle),
  "sida"
].join("/")
const activeIdentity = { current: true }
const failedStatus = shallowRef<404 | 502 | null>(null)

function scalarParam(name: "author" | "title" | "mediatype"): string {
  const value = route.params[name]
  if (typeof value !== "string" || value.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  return value
}

function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isExpectedResolution(value: unknown): value is ReaderRouteResolution {
  if (!isRecord(value)) return false
  const startPageName = value.startPageName
  if (typeof startPageName !== "string" || startPageName.length === 0) return false
  const canonicalPath = `${expectedCanonicalPath}/${encodeRfc3986Segment(startPageName)}/etext`
  return value.authorId === requestedAuthor &&
    value.titlePath === requestedTitle &&
    value.mediaType === requestedMediaType &&
    value.canonicalPath === canonicalPath
}

function isCurrentIdentity(): boolean {
  return activeIdentity.current && route.fullPath === requestedFullPath
}

function requestStatus(error: unknown): 404 | 502 {
  if (!isRecord(error)) return 502
  return error.statusCode === 404 || error.status === 404 ? 404 : 502
}

async function resolveReaderShorthand(): Promise<void> {
  try {
    const resolverPath = [
      "/api/reader/resolve",
      encodeURIComponent(requestedAuthor),
      encodeURIComponent(requestedTitle),
      encodeURIComponent(requestedMediaType)
    ].join("/")
    const resolution = await requestFetch<unknown>(resolverPath)
    if (!isExpectedResolution(resolution)) {
      throw createError({ statusCode: 502, statusMessage: "Reader page unavailable" })
    }
    if (!isCurrentIdentity()) return
    const publicTarget = `${resolution.canonicalPath}${rawQuerySuffix}`
    const navigationTarget = import.meta.client
      ? publicTarget.replace(/^\/författare(?=\/)/, "/f%C3%B6rfattare")
      : publicTarget
    const resolvedNavigation = import.meta.client
      ? router.resolve(navigationTarget)
      : null
    const normalizedNavigationFullPath = resolvedNavigation
      ? router.resolve({
          path: resolvedNavigation.path,
          query: resolvedNavigation.query,
          hash: resolvedNavigation.hash
        }).fullPath
      : ""
    const navigationResult = await nuxtApp.runWithContext(() => navigateTo(
      navigationTarget,
      { redirectCode: 307, replace: true }
    ))
    if (
      import.meta.client &&
      !isNavigationFailure(navigationResult) &&
      router.currentRoute.value.fullPath === normalizedNavigationFullPath &&
      router.options.history.location === normalizedNavigationFullPath
    ) {
      router.options.history.replace(publicTarget)
    }
  } catch (error) {
    if (!isCurrentIdentity()) return
    const statusCode = requestStatus(error)
    if (import.meta.server) {
      throw createError({
        statusCode,
        statusMessage: statusCode === 404
          ? "Reader page not found"
          : "Reader page unavailable"
      })
    }
    failedStatus.value = statusCode
  }
}

onBeforeRouteLeave(() => {
  activeIdentity.current = false
})
onBeforeUnmount(() => {
  activeIdentity.current = false
})

if (import.meta.server) {
  onServerPrefetch(resolveReaderShorthand)
} else {
  void resolveReaderShorthand()
}
</script>

<template>
  <div v-if="failedStatus" class="error" role="alert">
    <template v-if="failedStatus === 404">Läsarsidan kunde inte hittas.</template>
    <template v-else>Läsarsidan kunde inte hämtas.</template>
  </div>
  <div v-else class="searching" aria-live="polite">
    <div class="preloader">
      <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
      <span class="sr-only">Hämtar läsarsidan</span>
    </div>
  </div>
</template>
