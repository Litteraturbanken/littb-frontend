<script setup lang="ts">
import type { ComponentPublicInstance } from "vue"

import type { components } from "~/lib/api/generated/lbapi"
import type { SanitizedHtml } from "#shared/types/renderable-html"
import { emptyRenderableHtml } from "#shared/utils/renderable-html"
import { useLbApiClient } from "~/composables/useLbApiClient"
import {
  readerWordFromTarget,
  sanitizeDictionaryArticle,
  selectedReaderWord
} from "~/lib/reader-dictionary"
import {
  buildSvenskaDictionaryUrl,
  readerDictionaryMode
} from "~/lib/reader-dictionary-embed"

type DictionaryArticle = components["schemas"]["DictionaryArticleResponse"]

const safeSvenskaOrigin = "https://svenska.se"
const route = useRoute()
const router = useRouter()
const client = useLbApiClient()
const mode = readerDictionaryMode(useRuntimeConfig().public.readerDictionaryMode)
const embed = useReaderDictionaryEmbed({ onCloseRequest: close })
const indicator = shallowRef<{
  element: HTMLElement
  left: number
  top: number
  word: string
} | null>(null)
const articleHtml = ref<SanitizedHtml<"dictionary-article">>(emptyRenderableHtml())
const embedAttemptWord = ref<string | null>(null)
const message = ref("")
let selectionTimer: ReturnType<typeof setTimeout> | null = null
let messageTimer: ReturnType<typeof setTimeout> | null = null
let lookupGeneration = 0
let lookupController: AbortController | null = null
let focusRestoreGeneration = 0
let focusRestoreTarget: HTMLElement | null = null
let focusRestoreTabIndexCleanup: (() => void) | null = null

const legacyModalOpen = computed(() => articleHtml.value.length > 0)
const embedModalOpen = computed(() => (
  embedAttemptWord.value !== null && embed.status.value !== "closed"
))
const modalOpen = computed(() => mode === "embed" ? embedModalOpen.value : legacyModalOpen.value)
const embedFullSiteUrl = computed(() => {
  const word = embedAttemptWord.value
  if (!word) return null
  const session = embed.session.value
  if (!session) return buildSvenskaDictionaryUrl(safeSvenskaOrigin, word)
  return buildSvenskaDictionaryUrl(
    new URL(session.src).origin,
    word,
    { allowLocalHttp: true }
  )
})

useHead(() => ({
  bodyAttrs: { class: modalOpen.value ? "modal-open" : "" }
}))

function showMessage(value: string): void {
  clearMessage()
  message.value = value
  messageTimer = setTimeout(() => {
    message.value = ""
    messageTimer = null
  }, 2200)
}

function clearMessage(): void {
  message.value = ""
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = null
}

function clearSelectionTimer(): void {
  if (!selectionTimer) return
  clearTimeout(selectionTimer)
  selectionTimer = null
}

function clearIndicator(): void {
  indicator.value = null
}

function clearFocusRestoreTarget(): void {
  focusRestoreGeneration += 1
  focusRestoreTarget = null
  focusRestoreTabIndexCleanup?.()
}

function showIndicator(selected: { element: HTMLElement, word: string }): void {
  clearFocusRestoreTarget()
  const box = selected.element.getBoundingClientRect()
  indicator.value = {
    element: selected.element,
    left: box.right + window.scrollX,
    top: box.top + window.scrollY - 20,
    word: selected.word
  }
}

function inspectSelection(): void {
  const root = document.querySelector(".reader_main")
  const selected = root ? selectedReaderWord(window.getSelection(), root) : null
  if (!selected) {
    clearIndicator()
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

function handleSelectionKeyup(event: KeyboardEvent): void {
  if (!event.shiftKey) return
  clearSelectionTimer()
  inspectSelection()
}

function handleDoubleClick(event: MouseEvent): void {
  clearSelectionTimer()
  clearIndicator()
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
  clearIndicator()
}

function validArticle(value: unknown, word: string): value is DictionaryArticle {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return item.word === word
    && typeof item.base_form === "string"
    && item.base_form.length > 0
    && item.base_form.length <= 200
    && typeof item.article_html === "string"
    && item.article_html.length > 0
    && item.article_html.length <= 200_000
}

function cancelLookup(): void {
  lookupGeneration += 1
  lookupController?.abort()
  lookupController = null
}

function lookupIsCurrent(
  generation: number,
  controller: AbortController,
  routeFullPath: string
): boolean {
  return generation === lookupGeneration
    && lookupController === controller
    && !controller.signal.aborted
    && route.fullPath === routeFullPath
}

function restorePendingReaderWordFocus(): void {
  const target = focusRestoreTarget
  const generation = focusRestoreGeneration
  focusRestoreTarget = null
  void restoreReaderWordFocus(target, generation)
}

function failLegacyLookup(): void {
  showMessage("Hittade inget uppslag")
  restorePendingReaderWordFocus()
}

async function lookupLegacy(word: string): Promise<void> {
  const generation = lookupGeneration
  const controller = new AbortController()
  const routeFullPath = route.fullPath
  lookupController = controller
  try {
    const result = await client.GET("/dictionary/articles", {
      params: { query: { word } },
      signal: controller.signal
    })
    if (!lookupIsCurrent(generation, controller, routeFullPath)) return
    if (result.error || !validArticle(result.data, word)) {
      failLegacyLookup()
      return
    }
    const sanitized = sanitizeDictionaryArticle(result.data.article_html)
    if (!sanitized) {
      failLegacyLookup()
      return
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    if (!lookupIsCurrent(generation, controller, routeFullPath)) return
    articleHtml.value = sanitized
  } catch {
    if (lookupIsCurrent(generation, controller, routeFullPath)) {
      failLegacyLookup()
    }
  } finally {
    if (lookupController === controller) lookupController = null
  }
}

async function lookup(): Promise<void> {
  const selected = indicator.value
  clearIndicator()
  clearSelectionTimer()
  window.getSelection()?.removeAllRanges()
  if (!selected) return
  clearFocusRestoreTarget()
  focusRestoreTarget = selected.element
  cancelLookup()
  articleHtml.value = emptyRenderableHtml()
  if (mode === "embed") {
    await setRouteLookupWord(selected.word)
    embedAttemptWord.value = selected.word
    embed.start(selected.word)
    return
  }
  closeEmbed()
  await lookupLegacy(selected.word)
}

async function setRouteLookupWord(
  word: string | null,
  options: { replace?: boolean } = {}
): Promise<void> {
  const query = { ...route.query }
  if (word) query.so = word
  else Reflect.deleteProperty(query, "so")
  const location = { path: route.path, query, hash: route.hash }
  if (options.replace) await router.replace(location)
  else await router.push(location)
}

function closeLegacy(): void {
  articleHtml.value = emptyRenderableHtml()
}

function closeEmbed(): void {
  embedAttemptWord.value = null
  embed.close()
}

async function restoreReaderWordFocus(
  target: HTMLElement | null,
  generation: number
): Promise<void> {
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  if (!target || generation !== focusRestoreGeneration || !target.isConnected) return

  const previousTabIndex = target.getAttribute("tabindex")
  target.setAttribute("tabindex", "-1")
  const restoreTabIndex = (): void => {
    target.removeEventListener("blur", restoreTabIndex)
    if (previousTabIndex === null) target.removeAttribute("tabindex")
    else target.setAttribute("tabindex", previousTabIndex)
    if (focusRestoreTabIndexCleanup === restoreTabIndex) {
      focusRestoreTabIndexCleanup = null
    }
  }
  focusRestoreTabIndexCleanup?.()
  focusRestoreTabIndexCleanup = restoreTabIndex
  target.addEventListener("blur", restoreTabIndex, { once: true })
  target.focus({ preventScroll: true })
  if (document.activeElement !== target) restoreTabIndex()
}

function close(): void {
  cancelLookup()
  closeLegacy()
  closeEmbed()
  if (route.query.so !== undefined) void setRouteLookupWord(null, { replace: true })
  restorePendingReaderWordFocus()
}

function setEmbedFrame(element: Element | ComponentPublicInstance | null): void {
  embed.frame.value = element instanceof HTMLIFrameElement ? element : null
}

watch(() => {
  const query = { ...route.query }
  Reflect.deleteProperty(query, "so")
  return JSON.stringify([route.path, route.hash, query])
}, () => {
  cancelLookup()
  closeEmbed()
  clearFocusRestoreTarget()
  clearSelectionTimer()
  clearIndicator()
  closeLegacy()
  clearMessage()
  if (route.query.so !== undefined) void setRouteLookupWord(null, { replace: true })
})

onBeforeMount(() => {
  document.addEventListener("mouseup", handleMouseup)
  document.addEventListener("dblclick", handleDoubleClick)
  document.addEventListener("click", handleDocumentClick)
  document.addEventListener("keyup", handleSelectionKeyup)
})
onBeforeUnmount(() => {
  cancelLookup()
  closeEmbed()
  clearFocusRestoreTarget()
  document.removeEventListener("mouseup", handleMouseup)
  document.removeEventListener("dblclick", handleDoubleClick)
  document.removeEventListener("click", handleDocumentClick)
  document.removeEventListener("keyup", handleSelectionKeyup)
  clearSelectionTimer()
  clearMessage()
})
</script>

<template>
  <Teleport to="body">
    <button
      v-if="indicator"
      class="search_dict"
      type="button"
      :style="{ left: `${indicator.left}px`, top: `${indicator.top}px` }"
      :aria-label="mode === 'embed'
        ? `Slå upp ${indicator.word} i SO och SAOB`
        : `Slå upp ${indicator.word} i Svensk ordbok`"
      @mousedown.prevent
      @click.stop="lookup"
    >
      <i class="fa fa-search glass" aria-hidden="true" />
      <i class="fa fa-search shadow" aria-hidden="true" />
      <span class="circle" aria-hidden="true" />
    </button>
  </Teleport>
  <ReaderDictionaryDialog
    v-if="mode === 'embed' && embedAttemptWord"
    mode="embed"
    :frame-ref="setEmbedFrame"
    :full-site-url="embedFullSiteUrl"
    :handle-frame-load="embed.handleFrameLoad"
    :open="modalOpen"
    :session="embed.session.value"
    :status="embed.status.value"
    :word="embedAttemptWord"
    @close="close"
  />
  <ReaderDictionaryDialog
    v-else-if="mode === 'legacy'"
    mode="legacy"
    :article-html="articleHtml"
    :open="modalOpen"
    @close="close"
  />
  <LegacyNotice :message="message" />
</template>
