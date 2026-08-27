<script setup lang="ts">
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogPanel,
  DialogTitle
} from "@headlessui/vue"

import { useLbApiClient } from "../../composables/useLbApiClient"
import type { components } from "../../lib/api/generated/lbapi"
import {
  developerQuickSearchCommands,
  stableDeveloperJson,
  type QuickSearchContext,
  type QuickSearchDeveloperAction,
  type RedFtpEntry
} from "../../lib/quick-search-developer"

type QuickSearchItem = components["schemas"]["QuickSearchItem"]

type Command = {
  label: string
  url: string
  aliases?: string[]
}

type SearchRow = {
  id: string
  label: string
  typeLabel: string | null
  mediaTypeLabel: string | null
  url: string | null
  correction: boolean
  disabled: boolean
  developerAction: QuickSearchDeveloperAction | null
}

type DeveloperOutput =
  | { kind: "id", value: string, status: string | null }
  | { kind: "info", value: string }
  | { kind: "ftp", entries: RedFtpEntry[], status: string | null }

const props = withDefaults(defineProps<{
  initiallyOpen?: boolean
  showContextInfoInitially?: boolean
}>(), {
  initiallyOpen: false,
  showContextInfoInitially: false
})
const emit = defineEmits<{
  closed: []
}>()

const commands: Command[] = [
  { label: "Start", url: "/" },
  { label: "Bibliotek", url: "/bibliotek" },
  { label: "Epub", url: "/epub" },
  { label: "Ljud och bild", url: "/ljudochbild" },
  { label: "Sök", url: "/sok", aliases: ["Sok"] },
  { label: "Presentationer", url: "/presentationer" },
  { label: "Dramawebben", url: "/dramawebben" },
  { label: "Nytillkommet", url: "/bibliotek?visa=latest&sort=nytillkommet" },
  { label: "Skolan", url: "/skolan" },
  { label: "Skolan/lyrik", url: "/skolan/lyrik" },
  { label: "Om", url: "/om/ide" },
  { label: "Hjälp", url: "/om/hjalp", aliases: ["hjalp"] },
  { label: "Kontakt", url: "/om/kontakt" },
  { label: "Statistik", url: "/om/statistik" },
  { label: "Läshistorik", url: "/historik" }
]

const trigger = ref<HTMLAnchorElement | null>(null)
const isOpen = ref(props.initiallyOpen)
const query = ref("")
const remoteItems = ref<QuickSearchItem[]>([])
const correction = ref<string | null>(null)
const requestState = ref<"idle" | "loading" | "success" | "failure">("idle")
const developerOutput = ref<DeveloperOutput | null>(null)
const developerContext = useQuickSearchContext()

const client = useLbApiClient()

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestController: AbortController | null = null
let requestVersion = 0

function inputElement(): HTMLInputElement | null {
  return document.querySelector("#autocomplete")
}

const matchingCommands = computed(() => {
  const prefix = query.value.toLocaleLowerCase("sv-SE")
  if (!prefix || prefix.startsWith("/")) return []
  return commands.filter(command =>
    [command.label, ...(command.aliases ?? [])].some(value =>
      value.toLocaleLowerCase("sv-SE").startsWith(prefix)
    )
  )
})

function remoteRow(item: QuickSearchItem, index: number): SearchRow {
  return {
    id: `remote-${index}-${item.url}`,
    label: item.label,
    typeLabel: item.type_label,
    mediaTypeLabel: item.media_type_label,
    url: item.url,
    correction: false,
    disabled: false,
    developerAction: null
  }
}

const developerRows = computed<SearchRow[]>(() => developerQuickSearchCommands(
  query.value,
  developerContext.value,
  import.meta.dev
).map(command => ({
  id: command.id,
  label: command.label,
  typeLabel: command.typeLabel,
  mediaTypeLabel: null,
  url: command.url,
  correction: false,
  disabled: false,
  developerAction: command.action
})))

const rows = computed<SearchRow[]>(() => {
  if (!query.value) return []
  if (query.value.startsWith("/")) return developerRows.value
  if (requestState.value === "idle" || requestState.value === "loading") {
    return developerRows.value
  }

  const output = requestState.value === "success"
    ? remoteItems.value.map(remoteRow)
    : []

  if (requestState.value === "success" && correction.value) {
    output.push({
      id: "correction",
      label: correction.value,
      typeLabel: "Menade du",
      mediaTypeLabel: null,
      url: null,
      correction: true,
      disabled: false,
      developerAction: null
    })
  } else if (
    requestState.value === "success" &&
    remoteItems.value.length === 0
  ) {
    output.push({
      id: "no-hits",
      label: "Inga träffar.",
      typeLabel: null,
      mediaTypeLabel: null,
      url: null,
      correction: false,
      disabled: true,
      developerAction: null
    })
  }

  output.push(...matchingCommands.value.map((command, index) => ({
    id: `command-${index}-${command.url}`,
    label: command.label,
    typeLabel: "Gå till sidan",
    mediaTypeLabel: null,
    url: command.url,
    correction: false,
    disabled: false,
    developerAction: null
  })))
  output.push(...developerRows.value)
  return output
})

function cancelPendingSearch() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  requestController?.abort()
  requestController = null
  requestVersion += 1
}

function resetResults() {
  remoteItems.value = []
  correction.value = null
  requestState.value = "idle"
}

async function runSearch(value: string, version: number) {
  requestController = new AbortController()
  const controller = requestController
  requestState.value = "loading"
  try {
    const { data, error } = await client.GET("/quick-search", {
      params: { query: { query: value } },
      signal: controller.signal
    })
    if (version !== requestVersion) return
    if (error || !data) {
      requestState.value = "failure"
      return
    }
    remoteItems.value = data.items
    correction.value = data.correction
    requestState.value = "success"
  } catch {
    if (version !== requestVersion || controller.signal.aborted) return
    requestState.value = "failure"
  } finally {
    if (requestController === controller) requestController = null
  }
}

watch(query, value => {
  cancelPendingSearch()
  resetResults()
  developerOutput.value = null
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith("/")) return

  const version = requestVersion
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void runSearch(trimmed, version)
  }, 200)
})

function open() {
  if (isOpen.value) return
  isOpen.value = true
  document.body.classList.add("modal-open")
  void nextTick(() => inputElement()?.focus())
}

function close() {
  if (!isOpen.value) return
  isOpen.value = false
  cancelPendingSearch()
  query.value = ""
  resetResults()
  developerOutput.value = null
  document.body.classList.remove("modal-open")
  void nextTick(() => trigger.value?.focus())
  emit("closed")
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (event.key !== "s" || isOpen.value) return
  const focused = document.activeElement
  if (focused?.matches("input, textarea, select")) return
  event.preventDefault()
  open()
}

function onQueryChange(event: Event) {
  query.value = (event.target as HTMLInputElement).value
}

function dispatchComboboxKey(key: "Home" | "End") {
  inputElement()?.dispatchEvent(new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true
  }))
}

function onInputKeydown(event: KeyboardEvent, activeIndex: number | null) {
  const selectable = rows.value.flatMap((row, index) => row.disabled ? [] : [index])
  const first = selectable[0]
  const last = selectable.at(-1)
  const wrapKey = event.key === "ArrowUp" && activeIndex === first
    ? "End"
    : event.key === "ArrowDown" && activeIndex === last
      ? "Home"
      : null
  if (wrapKey) window.setTimeout(() => dispatchComboboxKey(wrapKey))
}

watch(rows, async values => {
  if (!values.length || !isOpen.value) return
  await nextTick()
  window.requestAnimationFrame(() => dispatchComboboxKey("Home"))
})

async function selectRow(row: SearchRow | null) {
  if (!row || row.disabled) return
  if (row.correction) {
    query.value = row.label
    await nextTick()
    const element = inputElement()
    if (element) {
      element.value = row.label
      element.focus()
      element.dispatchEvent(new Event("input", { bubbles: true }))
    }
    return
  }
  if (row.developerAction) {
    await runDeveloperAction(row.developerAction, row.label)
    return
  }
  if (!row.url) return
  close()
  await navigateTo(row.url)
}

function isRedFtpEntries(value: unknown): value is RedFtpEntry[] {
  if (!Array.isArray(value) || value.length > 50) return false
  return value.every(entry => entry !== null
    && typeof entry === "object"
    && typeof (entry as RedFtpEntry).url === "string"
    && (entry as RedFtpEntry).url.startsWith("//mnt/")
    && Array.isArray((entry as RedFtpEntry).breadcrumbs)
    && (entry as RedFtpEntry).breadcrumbs.every(breadcrumb =>
      typeof breadcrumb.label === "string"
      && typeof breadcrumb.url === "string"
      && breadcrumb.url.startsWith("//mnt/")
    ))
}

async function runDeveloperAction(
  action: QuickSearchDeveloperAction,
  label: string
): Promise<void> {
  if (!import.meta.dev) return
  const context = developerContext.value
  if (action === "id") {
    await copyDeveloperWorkId(context)
    return
  }
  if (action === "info") {
    showContextInfo()
    return
  }

  await searchDeveloperFtp(label)
}

function showContextInfo(): void {
  const context = developerContext.value
  if (!context) return
  developerOutput.value = { kind: "info", value: stableDeveloperJson(context.info) }
}

async function copyDeveloperWorkId(context: QuickSearchContext | null): Promise<void> {
  if (context?.kind !== "reader") return
  developerOutput.value = { kind: "id", value: context.workId, status: null }
  try {
    await navigator.clipboard.writeText(context.workId)
    if (developerOutput.value?.kind === "id") developerOutput.value.status = "Kopierat."
  } catch {
    if (developerOutput.value?.kind === "id") {
      developerOutput.value.status = "Kunde inte kopiera id:t."
    }
  }
}

async function searchDeveloperFtp(label: string): Promise<void> {
  developerOutput.value = { kind: "ftp", entries: [], status: "Söker i red …" }
  try {
    const response = await $fetch<{ entries: unknown }>("/nuxt-api/dev/red-ftp", {
      query: { q: label },
      retry: 0
    })
    if (!isRedFtpEntries(response.entries)) throw new Error("Invalid Red FTP response")
    developerOutput.value = { kind: "ftp", entries: response.entries, status: null }
  } catch {
    developerOutput.value = { kind: "ftp", entries: [], status: "Hittade inte red-tjänsten." }
  }
}

onMounted(() => window.addEventListener("keydown", onGlobalKeydown))
onMounted(() => {
  if (!isOpen.value) return
  void nextTick(() => {
    inputElement()?.focus()
    if (props.showContextInfoInitially) showContextInfo()
  })
})
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onGlobalKeydown)
  cancelPendingSearch()
  document.body.classList.remove("modal-open")
})
</script>

<template>
  <a
    v-if="!initiallyOpen"
    ref="trigger"
    role="button"
    tabindex="0"
    class="quick-search-trigger"
    title="Snabbkommando: 's'"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent="open"
  >Snabbsökning</a>
  <ClientOnly>
      <Dialog
      v-if="isOpen"
      :open="isOpen"
      as="div"
      class="modal autocomplete fade in"
      @close="close"
    >
      <div class="modal-backdrop fade in" aria-hidden="true" @click="close" />
      <div class="modal-dialog modal-sm">
        <DialogPanel class="modal-content">
          <DialogTitle class="sr-only">Snabbsökning</DialogTitle>
          <div
            class="modal-body"
            :class="{ info: developerOutput?.kind === 'info' || developerOutput?.kind === 'ftp' }"
          >
            <Combobox v-slot="{ activeIndex }" :model-value="null" nullable @update:model-value="selectRow">
              <ComboboxInput
                id="autocomplete"
                class="text-gray-900"
                type="text"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="none"
                spellcheck="false"
                placeholder="Gå till ett verk, en dikt, en novell eller en författare"
                @change="onQueryChange"
                @keydown.capture="onInputKeydown($event, activeIndex)"
              />
              <ComboboxOptions v-if="rows.length" class="dropdown-menu quick-search-options">
                <ComboboxOption
                  v-for="row in rows"
                  v-slot="{ active: optionActive }"
                  :key="row.id"
                  as="template"
                  :value="row"
                  :disabled="row.disabled"
                >
                  <li
:class="{
                    active: optionActive,
                    'quick-search-correction': row.correction
                  }">
                    <a>
                      <span v-if="row.typeLabel" class="type_label">
                        {{ row.typeLabel }}<template v-if="row.mediaTypeLabel">, {{ row.mediaTypeLabel }}</template>
                      </span>
                      <span class="quick-search-label">{{ row.label }}</span>
                    </a>
                  </li>
                </ComboboxOption>
              </ComboboxOptions>
            </Combobox>
            <pre
              v-if="developerOutput?.kind === 'id'"
              class="quick-search-developer-id"
            >{{ developerOutput.value }}</pre>
            <pre
              v-else-if="developerOutput?.kind === 'info'"
              class="quick-search-developer-info"
            >{{ developerOutput.value }}</pre>
            <div
              v-else-if="developerOutput?.kind === 'ftp'"
              class="quick-search-developer-ftp"
            >
              <ul>
                <li v-for="entry in developerOutput.entries" :key="entry.url" class="mb-4">
                  <ul class="flex gap-2">
                    <li
                      v-for="(breadcrumb, index) in entry.breadcrumbs"
                      :key="breadcrumb.url"
                    ><a
                      class="!text-gray-600 hover:!text-gray-400"
                      :href="breadcrumb.url"
                    >{{ breadcrumb.label }}</a><span
                      v-if="index < entry.breadcrumbs.length - 1"
                      class="!text-gray-600"
                    > &gt; </span></li>
                  </ul>
                  <a
                    class="!text-gray-800 hover:!text-gray-400 font-mono text-sm"
                    :href="entry.url"
                  >/{{ entry.url.split('/').slice(4).join('/') }}</a>
                </li>
              </ul>
            </div>
            <p
              v-if="developerOutput && 'status' in developerOutput && developerOutput.status"
              class="quick-search-developer-status"
              role="status"
            >{{ developerOutput.status }}</p>
            <div class="footer">
              <span>Gå till <NuxtLink class="sc" to="/bibliotek" no-prefetch @click="close">biblioteket</NuxtLink> om du vill utföra mer avancerade sökningar</span>
            </div>
          </div>
        </DialogPanel>
      </div>
      </Dialog>
  </ClientOnly>
</template>
