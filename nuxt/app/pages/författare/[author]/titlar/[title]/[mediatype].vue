<script setup lang="ts">
import type { ReaderRouteResolution } from "#shared/types/reader"
import { isNavigationFailure } from "vue-router"
import { encodeRfc3986Segment } from "~/lib/internal-navigation"

definePageMeta({
  key: route => route.fullPath,
  validate: route => {
    const author = route.params.author
    const title = route.params.title
    return typeof author === "string" && author.length > 0 &&
      typeof title === "string" && title.length > 0 &&
      (route.params.mediatype === "etext" || route.params.mediatype === "faksimil")
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
const rawSuffix = import.meta.server
  ? requestUrl.search
  : rawRouteSuffix(requestedFullPath)
const expectedCanonicalPath = [
  "/författare",
  encodeRfc3986Segment(requestedAuthor),
  "titlar",
  encodeRfc3986Segment(requestedTitle),
  "sida"
].join("/")
const activeIdentity = { current: true }
const failedStatus = shallowRef<404 | 502 | null>(null)

function rawRouteSuffix(fullPath: string): string {
  const queryIndex = fullPath.indexOf("?")
  const fragmentIndex = fullPath.indexOf("#")
  if (queryIndex >= 0 && (fragmentIndex < 0 || queryIndex < fragmentIndex)) {
    return fullPath.slice(queryIndex)
  }
  return fragmentIndex < 0 ? "" : fullPath.slice(fragmentIndex)
}

function scalarParam(name: "author" | "title" | "mediatype"): string {
  const value = route.params[name]
  if (typeof value !== "string" || value.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "Reader page not found" })
  }
  return value
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isExpectedResolution(value: unknown): value is ReaderRouteResolution {
  if (!isRecord(value)) return false
  const startPageName = value.startPageName
  if (typeof startPageName !== "string" || startPageName.length === 0) return false
  const canonicalPath =
    `${expectedCanonicalPath}/${encodeRfc3986Segment(startPageName)}/` +
    encodeRfc3986Segment(requestedMediaType)
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

function resolverPath(): string {
  return [
    "/api/reader/resolve",
    encodeURIComponent(requestedAuthor),
    encodeURIComponent(requestedTitle),
    encodeURIComponent(requestedMediaType)
  ].join("/")
}

function navigationDestination(publicTarget: string): Readonly<{
  target: string
  normalizedFullPath: string
}> {
  if (import.meta.server) return { target: publicTarget, normalizedFullPath: "" }
  const target = publicTarget.replace(/^\/författare(?=\/)/, "/f%C3%B6rfattare")
  const resolved = router.resolve(target)
  const normalizedFullPath = router.resolve({
    path: resolved.path,
    query: resolved.query,
    hash: resolved.hash
  }).fullPath
  return { target, normalizedFullPath }
}

function synchronizePublicHistory(
  navigationResult: unknown,
  normalizedFullPath: string,
  publicTarget: string
): void {
  if (import.meta.server || isNavigationFailure(navigationResult)) return
  if (router.currentRoute.value.fullPath !== normalizedFullPath) return
  if (router.options.history.location !== normalizedFullPath) return
  router.options.history.replace(publicTarget)
}

function handleResolutionError(error: unknown): void {
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

async function resolveReaderShorthand(): Promise<void> {
  try {
    const resolution = await requestFetch<unknown>(resolverPath(), { retry: 0 })
    if (!isExpectedResolution(resolution)) {
      throw createError({ statusCode: 502, statusMessage: "Reader page unavailable" })
    }
    if (!isCurrentIdentity()) return
    const publicTarget = `${resolution.canonicalPath}${rawSuffix}`
    const destination = navigationDestination(publicTarget)
    const navigationResult = await nuxtApp.runWithContext(() => navigateTo(
      destination.target,
      { redirectCode: 307, replace: true }
    ))
    synchronizePublicHistory(navigationResult, destination.normalizedFullPath, publicTarget)
  } catch (error) {
    handleResolutionError(error)
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
