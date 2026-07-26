<script setup lang="ts">
import type { components } from "~/lib/api/generated/lbapi"
import { createLbApiClient } from "~/lib/api/client"
import {
  readerWordFromTarget,
  sanitizeDictionaryArticle,
  selectedReaderWord
} from "~/lib/reader-dictionary"

type DictionaryArticle = components["schemas"]["DictionaryArticleResponse"]

const route = useRoute()
const config = useRuntimeConfig()
const indicator = ref<{ left: number, top: number, word: string } | null>(null)
const article = ref<DictionaryArticle | null>(null)
const articleHtml = ref("")
const message = ref("")
let selectionTimer: ReturnType<typeof setTimeout> | null = null
let messageTimer: ReturnType<typeof setTimeout> | null = null

const modalOpen = computed(() => article.value !== null && articleHtml.value.length > 0)

useHead(() => ({
  bodyAttrs: { class: modalOpen.value ? "modal-open" : "" }
}))

function showMessage(value: string): void {
  message.value = value
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = setTimeout(() => {
    message.value = ""
    messageTimer = null
  }, 2200)
}

function clearSelectionTimer(): void {
  if (!selectionTimer) return
  clearTimeout(selectionTimer)
  selectionTimer = null
}

function showIndicator(selected: { element: HTMLElement, word: string }): void {
  const box = selected.element.getBoundingClientRect()
  indicator.value = {
    left: box.right + window.scrollX,
    top: box.top + window.scrollY - 20,
    word: selected.word
  }
}

function inspectSelection(): void {
  const root = document.querySelector(".reader_main")
  const selected = root ? selectedReaderWord(window.getSelection(), root) : null
  if (!selected) {
    indicator.value = null
    return
  }
  showIndicator(selected)
}

function handleMouseup(): void {
  clearSelectionTimer()
  selectionTimer = setTimeout(() => {
    selectionTimer = null
    inspectSelection()
  }, 500)
}

function handleDoubleClick(event: MouseEvent): void {
  clearSelectionTimer()
  indicator.value = null
  const target = event.target
  const root = document.querySelector(".reader_main")
  if (!(target instanceof Element) || !root) return
  const targetWord = readerWordFromTarget(target, root)
  if (!targetWord) return
  const selected = selectedReaderWord(window.getSelection(), root) ?? targetWord
  showIndicator(selected)
}

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target
  if (target instanceof Element && target.closest(".search_dict, [role='dialog']")) return
  indicator.value = null
}

function validArticle(value: unknown, word: string): value is DictionaryArticle {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return Object.keys(item).length === 3
    && item.word === word
    && typeof item.base_form === "string"
    && item.base_form.length > 0
    && item.base_form.length <= 200
    && typeof item.article_html === "string"
    && item.article_html.length > 0
    && item.article_html.length <= 200_000
}

async function lookup(): Promise<void> {
  const selected = indicator.value
  indicator.value = null
  clearSelectionTimer()
  window.getSelection()?.removeAllRanges()
  if (!selected) return
  try {
    const client = createLbApiClient(config.public.apiBase)
    const result = await client.GET("/dictionary/articles", {
      params: { query: { word: selected.word } }
    })
    if (result.error || !validArticle(result.data, selected.word)) {
      showMessage("Hittade inget uppslag")
      return
    }
    const sanitized = sanitizeDictionaryArticle(result.data.article_html)
    if (!sanitized) {
      showMessage("Hittade inget uppslag")
      return
    }
    articleHtml.value = sanitized
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    article.value = result.data
  } catch {
    showMessage("Hittade inget uppslag")
  }
}

function close(): void {
  article.value = null
  articleHtml.value = ""
}

watch(() => route.fullPath, () => {
  clearSelectionTimer()
  indicator.value = null
  close()
})

onBeforeMount(() => {
  document.addEventListener("mouseup", handleMouseup)
  document.addEventListener("dblclick", handleDoubleClick)
  document.addEventListener("click", handleDocumentClick)
})
onBeforeUnmount(() => {
  document.removeEventListener("mouseup", handleMouseup)
  document.removeEventListener("dblclick", handleDoubleClick)
  document.removeEventListener("click", handleDocumentClick)
  clearSelectionTimer()
  if (messageTimer) clearTimeout(messageTimer)
})
</script>

<template>
  <Teleport to="body">
    <button
      v-if="indicator"
      class="search_dict"
      type="button"
      :style="{ left: `${indicator.left}px`, top: `${indicator.top}px` }"
      :aria-label="`Slå upp ${indicator.word} i Svensk ordbok`"
      @mousedown.prevent
      @click.stop="lookup"
    >
      <i class="fa fa-search glass" aria-hidden="true" />
      <i class="fa fa-search shadow" aria-hidden="true" />
      <span class="circle" aria-hidden="true" />
    </button>
  </Teleport>
  <ReaderDictionaryDialog
    :article-html="articleHtml"
    :open="modalOpen"
    @close="close"
  />
  <LegacyNotice :message="message" />
</template>
