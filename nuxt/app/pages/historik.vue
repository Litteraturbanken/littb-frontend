<script setup lang="ts">
import { createLbApiClient } from "../lib/api/client"
import type { components } from "../lib/api/generated/lbapi"
import {
  canonicalNuxtHref,
  isNuxtInternalHref,
  safeNativeHref,
  validRouteSegment
} from "../lib/internal-navigation"
import { hasC0OrC1Control, hasLoneSurrogate } from "#shared/utils/text-safety"

type AuthorSummary = components["schemas"]["AuthorSummary"]
type StoredHistory = { author: string, label: string, url: string }

const maximumHistoryLabelLength = 20_000
const maximumResolvedAuthorNameLength = 2_000

useSeoMeta({ title: "History | Litteraturbanken" })
useHead({ bodyAttrs: { class: "focus page-history ready" } })

function safeHistoryUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && safeNativeHref(value) !== null
}

function storedHistory(value: unknown): StoredHistory | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const author = typeof record.author === "string" ? record.author.trim() : ""
  if (!validRouteSegment(author, 100)) return null
  if (typeof record.label !== "string"
    || !record.label.trim()
    || record.label.length > maximumHistoryLabelLength) return null
  if (!safeHistoryUrl(record.url)) return null
  return { author, label: record.label, url: record.url }
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort()
  return actual.length === expected.length
    && expected.every((key, index) => key === actual[index])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isResolvedAuthorName(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximumResolvedAuthorNameLength
    && value === value.trim()
    && !hasC0OrC1Control(value)
    && !hasLoneSurrogate(value)
}

function isAcceptedResolvedAuthorId(
  value: unknown,
  requested: ReadonlySet<string>,
  seen: ReadonlySet<string>
): value is string {
  return typeof value === "string"
    && validRouteSegment(value, 100)
    && requested.has(value)
    && !seen.has(value)
}

function resolvedAuthor(
  value: unknown,
  requested: ReadonlySet<string>,
  seen: ReadonlySet<string>
): AuthorSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, ["author_id", "full_name", "surname"])) {
    return null
  }
  const { author_id: authorId, full_name: fullName, surname } = value
  if (!isAcceptedResolvedAuthorId(authorId, requested, seen)
    || !isResolvedAuthorName(fullName)
    || (surname !== null && !isResolvedAuthorName(surname))) return null
  return { author_id: authorId, full_name: fullName, surname }
}

function resolvedAuthors(
  value: unknown,
  requestedIds: readonly string[]
): Record<string, AuthorSummary> | null {
  if (!isRecord(value) || !hasExactKeys(value, ["items"]) || !Array.isArray(value.items)
    || value.items.length > requestedIds.length) return null

  const requested = new Set(requestedIds)
  const seen = new Set<string>()
  const entries: Array<[string, AuthorSummary]> = []
  for (const item of value.items) {
    const author = resolvedAuthor(item, requested, seen)
    if (author === null) return null
    seen.add(author.author_id)
    entries.push([author.author_id, author])
  }
  return Object.fromEntries(entries)
}

const config = useRuntimeConfig()
const history = ref<StoredHistory[]>([])
const authorsById = ref<Record<string, AuthorSummary>>({})
const controller = new AbortController()
let unmounted = false

async function loadHistory() {
  let raw: string | null
  try {
    raw = localStorage.getItem("lastPageViews")
  } catch {
    return
  }
  if (raw === null) return

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return
  }
  if (!Array.isArray(parsed)) return

  history.value = parsed
    .map(storedHistory)
    .filter((record): record is StoredHistory => record !== null)
    .slice(0, 50)
  if (history.value.length === 0) return

  const authorIds = [...new Set(history.value.map(record => record.author))]
  const client = createLbApiClient(config.public.apiBase)
  try {
    const { data, error } = await client.POST("/authors/resolve", {
      body: { author_ids: authorIds },
      signal: controller.signal
    })
    if (error || !data || unmounted || controller.signal.aborted) return
    const resolved = resolvedAuthors(data, authorIds)
    if (resolved !== null) authorsById.value = resolved
  } catch {
    // The legacy page has no visible error state.
  }
}

onMounted(() => void loadHistory())
onBeforeUnmount(() => {
  unmounted = true
  controller.abort()
})
</script>

<template>
  <div>
    <h1>Senast lästa verk</h1>
    <ul v-if="history.length > 0">
      <li v-for="(pageview, index) in history" :key="`${index}:${pageview.url}`">
        <NuxtLink v-if="isNuxtInternalHref(pageview.url)" :to="canonicalNuxtHref(pageview.url)">
          <span>{{ authorsById[pageview.author]?.full_name ?? "" }}</span> –
          <span class="">{{ pageview.label }}</span>
        </NuxtLink>
        <a v-else :href="pageview.url">
          <span>{{ authorsById[pageview.author]?.full_name ?? "" }}</span> –
          <span class="">{{ pageview.label }}</span>
        </a>
      </li>
    </ul>
  </div>
</template>
