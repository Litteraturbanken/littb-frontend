<script setup lang="ts">
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogPanel
} from "@headlessui/vue"

import { createLbApiClient } from "../../lib/api/client"
import type { components } from "../../lib/api/generated/lbapi"

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
}

const commands: Command[] = [
  { label: "Start", url: "/" },
  { label: "Bibliotek", url: "/bibliotek" },
  { label: "Epub", url: "/epub" },
  { label: "Ljud och bild", url: "/ljudochbild" },
  { label: "Sök", url: "/sok", aliases: ["Sok"] },
  { label: "Presentationer", url: "/presentationer" },
  { label: "Dramawebben", url: "/dramawebben" },
  { label: "Nytillkommet", url: "/bibliotek?sort=nytillkommet" },
  { label: "Skolan", url: "/skolan" },
  { label: "Skolan/lyrik", url: "/skolan/lyrik" },
  { label: "Om", url: "/om/ide" },
  { label: "Hjälp", url: "/om/hjalp", aliases: ["hjalp"] },
  { label: "Kontakt", url: "/om/kontakt" },
  { label: "Statistik", url: "/om/statistik" },
  { label: "Läshistorik", url: "/historik" }
]

const trigger = ref<HTMLButtonElement | null>(null)
const isOpen = ref(false)
const query = ref("")
const remoteItems = ref<QuickSearchItem[]>([])
const correction = ref<string | null>(null)
const requestState = ref<"idle" | "loading" | "success" | "failure">("idle")
const activeIndex = ref(-1)

const config = useRuntimeConfig()
const client = createLbApiClient(config.public.apiBase)

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
    disabled: false
  }
}

const rows = computed<SearchRow[]>(() => {
  if (!query.value || query.value.startsWith("/")) return []
  if (requestState.value === "idle" || requestState.value === "loading") return []

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
      disabled: false
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
      disabled: true
    })
  }

  output.push(...matchingCommands.value.map((command, index) => ({
    id: `command-${index}-${command.url}`,
    label: command.label,
    typeLabel: "Gå till sidan",
    mediaTypeLabel: null,
    url: command.url,
    correction: false,
    disabled: false
  })))
  return output
})

function firstSelectableIndex(values = rows.value): number {
  return values.findIndex(row => !row.disabled)
}

watch(rows, values => {
  activeIndex.value = firstSelectableIndex(values)
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
  activeIndex.value = -1
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
  } catch (error) {
    if (version !== requestVersion || controller.signal.aborted) return
    requestState.value = "failure"
  } finally {
    if (requestController === controller) requestController = null
  }
}

watch(query, value => {
  cancelPendingSearch()
  resetResults()
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
  document.body.classList.remove("modal-open")
  void nextTick(() => trigger.value?.focus())
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

function selectableIndexes(): number[] {
  return rows.value.flatMap((row, index) => row.disabled ? [] : [index])
}

function moveActive(direction: 1 | -1) {
  const indexes = selectableIndexes()
  if (!indexes.length) return
  const current = indexes.indexOf(activeIndex.value)
  const next = current === -1
    ? (direction === 1 ? 0 : indexes.length - 1)
    : (current + direction + indexes.length) % indexes.length
  activeIndex.value = indexes[next] ?? -1
}

function stopHeadlessUiKey(event: KeyboardEvent) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (!rows.value.length) return
    stopHeadlessUiKey(event)
    moveActive(event.key === "ArrowDown" ? 1 : -1)
    return
  }
  if (event.key !== "Enter" && event.key !== "Tab") return
  const row = rows.value[activeIndex.value]
  if (!row || row.disabled) return
  stopHeadlessUiKey(event)
  void selectRow(row)
}

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
  if (!row.url) return
  close()
  await navigateTo(row.url)
}

async function goToLibrary() {
  close()
  await navigateTo("/bibliotek")
}

onMounted(() => window.addEventListener("keydown", onGlobalKeydown))
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onGlobalKeydown)
  cancelPendingSearch()
  document.body.classList.remove("modal-open")
})
</script>

<template>
  <li>
    <button
      ref="trigger"
      type="button"
      class="quick-search-trigger"
      title="Snabbkommando: 's'"
      @click="open"
    >Snabbsökning</button>
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
          <div class="modal-body">
            <Combobox :model-value="null" nullable @update:model-value="selectRow">
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
                @keydown.capture="onInputKeydown"
              />
              <ComboboxOptions v-if="rows.length" class="dropdown-menu quick-search-options">
                <ComboboxOption
                  v-for="(row, index) in rows"
                  :key="row.id"
                  :value="row"
                  :disabled="row.disabled"
                  :class="{
                    active: index === activeIndex,
                    'quick-search-correction': row.correction
                  }"
                  @mouseenter="activeIndex = row.disabled ? activeIndex : index"
                >
                  <a>
                    <span v-if="row.typeLabel" class="type_label">
                      {{ row.typeLabel }}<template v-if="row.mediaTypeLabel">, {{ row.mediaTypeLabel }}</template>
                    </span>
                    <span class="quick-search-label">{{ row.label }}</span>
                  </a>
                </ComboboxOption>
              </ComboboxOptions>
            </Combobox>
            <div class="footer">
              <span>Gå till <a class="sc" href="/bibliotek" @click.prevent="goToLibrary">biblioteket</a> om du vill utföra mer avancerade sökningar</span>
            </div>
          </div>
        </DialogPanel>
      </div>
      </Dialog>
    </ClientOnly>
  </li>
</template>
