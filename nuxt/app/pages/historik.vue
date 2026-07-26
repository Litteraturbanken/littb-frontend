<script setup lang="ts">
import { createLbApiClient } from "../lib/api/client"
import type { components } from "../lib/api/generated/lbapi"
import { canonicalNuxtHref, isNuxtInternalHref } from "../lib/internal-navigation"

type AuthorSummary = components["schemas"]["AuthorSummary"]
type StoredHistory = { author: string, label: string, url: string }

useSeoMeta({ title: "History | Litteraturbanken" })
useHead({ bodyAttrs: { class: "focus page-history ready" } })

function safeHistoryUrl(value: unknown): value is string {
  if (typeof value !== "string" || /[\\\u0000-\u001f\u007f]/.test(value)) return false
  if (!value.startsWith("/") || value.startsWith("//")) return false
  if (/%(?![0-9a-fA-F]{2})/.test(value)) return false
  try {
    return new URL(value, "https://history.invalid").origin === "https://history.invalid"
  } catch {
    return false
  }
}

function storedHistory(value: unknown): StoredHistory | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const author = typeof record.author === "string" ? record.author.trim() : ""
  if (author.length < 1 || author.length > 100) return null
  if (typeof record.label !== "string" || !record.label.trim()) return null
  if (!safeHistoryUrl(record.url)) return null
  return { author, label: record.label, url: record.url }
}

const config = useRuntimeConfig()
const history = ref<StoredHistory[]>([])
const authorsById = ref<Record<string, AuthorSummary>>({})
const authorsResolved = ref(false)
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
    authorsById.value = Object.fromEntries(
      data.items.map(author => [author.author_id, author])
    )
    authorsResolved.value = true
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
    <ul v-if="authorsResolved">
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
