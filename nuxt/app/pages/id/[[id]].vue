<script setup lang="ts">
import { useLbApiClient } from "../../composables/useLbApiClient"
import type { components } from "../../lib/api/generated/lbapi"

type LookupBody =
  | components["schemas"]["WorkLookupByIdRequest"]
  | components["schemas"]["WorkLookupByTitlesRequest"]
type LookupItem = components["schemas"]["WorkLookupItem"]
type LookupResponse = components["schemas"]["WorkLookupResponse"]

const description = "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."

useSeoMeta({
  title: "Litteraturbanken",
  description
})
useHead({ bodyAttrs: { class: "focus page-id ready" } })

const normalizeTextarea = (value: string) => value
  .split("\n")
  .map(row => (row.split("–")[1] || row).trim())

const requestTitles = (values: string[]) => values
  .map(value => value.trim())
  .filter(Boolean)
  .slice(0, 100)

const requestWorkId = (rawValue: string) => rawValue.trim().toLowerCase()

const isAbortError = (error: unknown) => (
  error instanceof DOMException && error.name === "AbortError"
)

function normalizedRouteValue(rawValue: unknown): string {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
  if (typeof value !== "string") return ""
  return value.trim().toLowerCase()
}

function bodyForWorkId(value: string): LookupBody | null {
  return value.startsWith("lb") && value.length >= 2 && value.length <= 100
    ? { work_id: value, titles: [] }
    : null
}

function bodyForTitles(values: string[]): LookupBody | null {
  const normalized = requestTitles(values)
  return normalized.length > 0
    && normalized.every(value => value.length <= 200)
    ? { work_id: null, titles: normalized }
    : null
}

function bodyForRouteValue(value: string): LookupBody | null {
  if (!value) return null
  return value.startsWith("lb")
    ? bodyForWorkId(value)
    : bodyForTitles([value])
}

const route = useRoute()
const api = useLbApiClient()

function postLookup(body: LookupBody, signal?: AbortSignal) {
  // openapi-fetch 0.17's Writable helper drops required null-only properties.
  // LookupBody retains the canonical required work_id: null runtime shape.
  return api.POST("/works/lookup", { body: body as never, signal })
}

const routeValue = normalizedRouteValue(route.params.id)
const workId = ref(routeValue.startsWith("lb") ? routeValue : "")
const titles = ref<string[]>(
  routeValue && !routeValue.startsWith("lb") ? [routeValue] : []
)
const textarea = ref("")
const loading = ref(false)

async function requestLookup(body: LookupBody, signal?: AbortSignal) {
  try {
    const { data, error } = await postLookup(body, signal)
    return error ? { items: [] } : (data ?? { items: [] })
  } catch {
    return { items: [] }
  }
}

const initialBody = bodyForRouteValue(routeValue)
let initialResponse: LookupResponse = { items: [] }
if (initialBody) {
  const initialLookup = await useAsyncData(
    `id-lookup:${route.path}`,
    () => requestLookup(initialBody)
  )
  initialResponse = initialLookup.data.value ?? { items: [] }
}

const items = ref<LookupItem[]>(initialResponse.items)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let controller: AbortController | null = null
let requestVersion = 0

function cancelTimer() {
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = null
}

function invalidateRequest(clearRows: boolean) {
  requestVersion += 1
  controller?.abort()
  controller = null
  loading.value = false
  if (clearRows) items.value = []
}

function clearLookup() {
  cancelTimer()
  invalidateRequest(true)
}

async function runLookup(body: LookupBody, signal?: AbortSignal) {
  const version = ++requestVersion
  loading.value = true
  items.value = []
  try {
    const { data, error } = await postLookup(body, signal)
    if (version !== requestVersion) return
    items.value = error ? [] : (data?.items ?? [])
  } catch (error) {
    if (version !== requestVersion) return
    if (!isAbortError(error)) items.value = []
  } finally {
    if (version === requestVersion) {
      loading.value = false
      controller = null
    }
  }
}

function startLookup(body: LookupBody) {
  cancelTimer()
  controller?.abort()
  controller = new AbortController()
  void runLookup(body, controller.signal)
}

function scheduleTitleLookup(clearRows: boolean) {
  cancelTimer()
  invalidateRequest(clearRows)
  const body = bodyForTitles(titles.value)
  if (!body) {
    items.value = []
    return
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    controller = new AbortController()
    void runLookup(body, controller.signal)
  }, 500)
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function onWorkIdInput(event: Event) {
  workId.value = inputValue(event)
  titles.value = []
  const body = bodyForWorkId(requestWorkId(workId.value))
  if (body) startLookup(body)
  else clearLookup()
}

function onTitleInput(event: Event) {
  const switchedMode = Boolean(workId.value)
  workId.value = ""
  const nextTitles = [...titles.value]
  nextTitles[0] = inputValue(event)
  titles.value = nextTitles
  scheduleTitleLookup(switchedMode)
}

function onTextareaInput(event: Event) {
  const switchedMode = Boolean(workId.value)
  textarea.value = inputValue(event)
  workId.value = ""
  titles.value = normalizeTextarea(textarea.value)
  scheduleTitleLookup(switchedMode)
}

watch(
  () => route.params.id,
  rawValue => {
    clearLookup()
    const value = normalizedRouteValue(rawValue)
    workId.value = value.startsWith("lb") ? value : ""
    titles.value = value && !value.startsWith("lb") ? [value] : []
    textarea.value = ""
    const body = bodyForRouteValue(value)
    if (body) startLookup(body)
  }
)

onUnmounted(clearLookup)
</script>

<template>
  <div :class="{ searching: loading }">
    <input
      id="work-lookup-id"
      :value="workId"
      placeholder="lbid"
      autofocus
      @input="onWorkIdInput"
    >
    <input
      id="work-lookup-title"
      :value="titles[0] ?? ''"
      placeholder="titel"
      @input="onTitleInput"
    >
    <textarea
      id="work-lookup-titles"
      :value="textarea"
      placeholder="flera titlar separarade med nyrad"
      @input="onTextareaInput"
    />
    <span class="sr-only">
      <label for="work-lookup-id">LB-ID</label>
      <label for="work-lookup-title">Titel</label>
      <label for="work-lookup-titles">Flera titlar, en per rad</label>
    </span>
    <div class="preloader" role="status" aria-live="polite" aria-atomic="true">
      <span aria-hidden="true">Hämtar <span class="dots_blink" /></span>
      <span class="sr-only">{{ loading ? "Hämtar resultat" : "" }}</span>
    </div>
    <table class="table-striped">
      <caption class="sr-only">Sökresultat för verk</caption>
      <thead class="sr-only">
        <tr>
          <th scope="col">LB-ID</th>
          <th scope="col">Författare</th>
          <th scope="col">Titel</th>
          <th scope="col">Format</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, rowIndex) in items"
          :key="`${item.work_id}:${item.title.url}:${rowIndex}`"
        >
          <td>{{ item.work_id }}</td>
          <td>
            <IdWorkLookupResultLink :label="item.author.label" :url="item.author.url" />
          </td>
          <td>
            <IdWorkLookupResultLink :label="item.title.label" :url="item.title.url" />
          </td>
          <td>
            <template
              v-for="(media, index) in item.media"
              :key="`${media.url}:${index}`"
            >
              <span v-if="index">:::</span><IdWorkLookupResultLink
                :label="media.label"
                :url="media.url"
              />
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
