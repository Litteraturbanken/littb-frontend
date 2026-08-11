<script setup lang="ts">
import type { ReaderMediaType, ReaderRouteResolution } from "#shared/types/reader"
import { encodeRfc3986Segment } from "~/lib/internal-navigation"

const props = defineProps<{ mediaType?: ReaderMediaType }>()

definePageMeta({
  key: route => route.fullPath,
  validate: route => typeof route.params.author === "string"
    && route.params.author.length > 0
    && typeof route.params.title === "string"
    && route.params.title.length > 0
})

type UnknownRecord = Record<string, unknown>

const route = useRoute()
const requestFetch = useRequestFetch()
const requestedFullPath = route.fullPath
const requestedAuthor = scalarParam("author")
const requestedTitle = scalarParam("title")
const activeIdentity = { current: true }
const resolverPath = [
  "/api/reader/resolve",
  encodeURIComponent(requestedAuthor),
  encodeURIComponent(requestedTitle)
].join("/")

function scalarParam(name: "author" | "title"): string {
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
  const mediaType = value.mediaType
  const startPageName = value.startPageName
  if (
    (mediaType !== "etext" && mediaType !== "faksimil")
    || typeof value.authorId !== "string"
    || value.authorId.length === 0
    || value.titlePath !== requestedTitle
    || typeof startPageName !== "string"
    || startPageName.length === 0
  ) return false
  const expectedPath = [
    "/författare",
    encodeRfc3986Segment(value.authorId),
    "titlar",
    encodeRfc3986Segment(requestedTitle),
    "sida",
    encodeRfc3986Segment(startPageName),
    mediaType
  ].join("/")
  return value.canonicalPath === expectedPath
}

function requestStatus(error: unknown): 404 | 502 {
  if (!isRecord(error)) return 502
  return error.statusCode === 404 || error.status === 404 ? 404 : 502
}

function isCurrentIdentity(): boolean {
  return activeIdentity.current && route.fullPath === requestedFullPath
}

onBeforeRouteLeave(() => {
  activeIdentity.current = false
})
onBeforeUnmount(() => {
  activeIdentity.current = false
})

let resolution: ReaderRouteResolution | null = null
try {
  const result = await requestFetch<unknown>(resolverPath, {
    query: props.mediaType === undefined ? undefined : { media_type: props.mediaType }
  })
  if (!isExpectedResolution(result)) {
    throw createError({ statusCode: 502, statusMessage: "Reader page unavailable" })
  }
  resolution = result
} catch (error) {
  if (isCurrentIdentity()) {
    const statusCode = requestStatus(error)
    throw createError({
      statusCode,
      statusMessage: statusCode === 404
        ? "Reader page not found"
        : "Reader page unavailable"
    })
  }
}

if (resolution !== null && isCurrentIdentity()) {
  await navigateTo(`${resolution.canonicalPath}?om-boken`, {
    redirectCode: 307,
    replace: true
  })
}
</script>

<template>
  <div class="searching" aria-live="polite">
    <div class="preloader">
      <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
      <span class="sr-only">Hämtar läsarsidan</span>
    </div>
  </div>
</template>
