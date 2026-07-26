<script setup lang="ts">
import type { EditorReaderPage } from "#shared/types/editor-reader"
import { readerSliderGeometryStyles } from "#shared/utils/reader-slider"

definePageMeta({
  validate: route => typeof route.params.lbid === "string" &&
    /^(?:0|[1-9]\d*)$/.test(String(route.params.ix)) &&
    (route.params.mediatype === "e" || route.params.mediatype === "f")
})
const route = useRoute()
const router = useRouter()
const nuxtApp = useNuxtApp()
const requestUrl = useRequestURL()
const workId = computed(() => String(route.params.lbid))
const index = computed(() => String(route.params.ix))
const alias = computed(() => String(route.params.mediatype))
const initialRawFullPath = useState(
  `editor-reader-initial-raw-full-path:${route.path}`,
  () => `${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`
)
const rawFullPath = ref(import.meta.client && !nuxtApp.isHydrating
  ? `${window.location.pathname}${window.location.search}${window.location.hash}`
  : initialRawFullPath.value)
watch(() => route.fullPath, () => {
  if (import.meta.client && nuxtApp.isHydrating) return
  rawFullPath.value = import.meta.client
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : route.fullPath
}, { flush: "sync" })
const requestIdentity = computed(() => JSON.stringify([
  workId.value,
  index.value,
  alias.value
]))
const requestFetch = useRequestFetch()
function requestPage(): Promise<EditorReaderPage> {
  return requestFetch<EditorReaderPage>(
    `/api/editor/${encodeURIComponent(workId.value)}/${index.value}/${alias.value}`
  )
}
const initialIdentity = requestIdentity.value
const { data: loadedPage, error } = await useAsyncData(
  `editor-reader:${initialIdentity}`,
  requestPage
)
if (import.meta.server && error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: error.value.statusMessage ?? "Editor page unavailable"
  })
}
if (import.meta.server && !loadedPage.value) {
  throw createError({ statusCode: 502, statusMessage: "Editor page unavailable" })
}
const loadedIdentity = ref(initialIdentity)
const page = computed(() => loadedIdentity.value === requestIdentity.value
  ? loadedPage.value
  : null)
const ocrMode = computed(() => route.query.ocr !== undefined && Boolean(page.value?.overlayHtml))
const authorHref = computed(() => page.value?.authorId
  ? `/f%C3%B6rfattare/${encodeURIComponent(page.value.authorId)}`
  : null)
const authorSearchHref = computed(() => page.value?.authorId
  ? `/s%C3%B6k?avancerad&forfattare=${encodeURIComponent(page.value.authorId)}`
  : null)
const clientRequestFailed = ref(import.meta.client && Boolean(error.value))
let requestGeneration = 0
watch(requestIdentity, async identity => {
  const generation = ++requestGeneration
  clientRequestFailed.value = false
  sliderDraft.value = null
  try {
    const nextPage = await requestPage()
    if (generation !== requestGeneration) return
    loadedPage.value = nextPage
    loadedIdentity.value = identity
    clientRequestFailed.value = false
  } catch {
    if (generation === requestGeneration) clientRequestFailed.value = true
  }
})
function rawSuffix(fullPath: string): string {
  const query = fullPath.indexOf("?")
  const hash = fullPath.indexOf("#")
  const suffix = query >= 0 ? query : hash
  return suffix >= 0 ? fullPath.slice(suffix) : ""
}
function href(pageIndex: number): string {
  return `/editor/${encodeURIComponent(workId.value)}/ix/${pageIndex}/${alias.value}${rawSuffix(rawFullPath.value)}`
}
function browserFullPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}
function navigateRawFullPath(fullPath: string): Promise<void> {
  if (!import.meta.client) return router.push(fullPath).then(() => undefined)
  const previousFullPath = rawFullPath.value
  return new Promise<void>((resolve, reject) => {
    const removeAfterEach = router.afterEach((_to, _from, failure) => {
      removeAfterEach()
      if (failure) reject(failure)
      else resolve()
    })
    try {
      const currentState = window.history.state ?? {}
      window.history.replaceState(
        { ...currentState, current: previousFullPath, forward: fullPath },
        "",
        previousFullPath
      )
      const state = {
        back: previousFullPath,
        current: fullPath,
        editorFacsimileSize: facsimileSize.value,
        editorRotation: rotation.value,
        forward: null,
        position: typeof currentState.position === "number"
          ? currentState.position + 1
          : window.history.length,
        replaced: false,
        scroll: null
      }
      window.history.pushState(state, "", fullPath)
      window.dispatchEvent(new PopStateEvent("popstate", { state }))
    } catch (navigationError) {
      removeAfterEach()
      reject(navigationError)
    }
  })
}
function navigateLink(event: MouseEvent, target: string): void {
  if (
    event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey ||
    event.metaKey || event.shiftKey
  ) return
  event.preventDefault()
  void navigateRawFullPath(target)
}
const sliderDraft = ref<number | null>(null)
const sliderValue = computed(() => sliderDraft.value ?? page.value?.pageIndex ?? 0)
const sliderPercent = computed(() => {
  const maximum = (page.value?.pageCount ?? 1) - 1
  return maximum > 0 ? sliderValue.value / maximum * 100 : 0
})
const sliderStyles = computed(() => {
  const geometry = readerSliderGeometryStyles(sliderPercent.value)
  return {
    pointer: { left: geometry.pointerLeft },
    selection: { width: geometry.selectionWidth }
  }
})
function previewSlider(event: Event): void {
  if (!(event.currentTarget instanceof HTMLInputElement)) return
  const value = event.currentTarget.valueAsNumber
  if (Number.isInteger(value)) sliderDraft.value = value
}
function commitSlider(): void {
  const value = sliderDraft.value
  sliderDraft.value = null
  if (value === null || value === page.value?.pageIndex) return
  void navigateRawFullPath(href(value))
}
const facsimileImage = ref<HTMLImageElement | null>(null)
function editorHistoryNumber(key: "editorFacsimileSize" | "editorRotation"): number | null {
  if (!import.meta.client || nuxtApp.isHydrating) return null
  const value = (window.history.state as Record<string, unknown> | null)?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
const facsimileSize = ref(editorHistoryNumber("editorFacsimileSize") ?? 3)
const rotation = ref(editorHistoryNumber("editorRotation") ?? 0)
const selectedFacsimileSource = computed(() => page.value?.facsimileSources.find(
  source => source.size === facsimileSize.value
) ?? page.value?.facsimileSources.find(source => source.size === 3) ?? null)
const smallerFacsimileSource = computed(() => [...(page.value?.facsimileSources ?? [])]
  .reverse().find(source => source.size < facsimileSize.value) ?? null)
const largerFacsimileSource = computed(() => page.value?.facsimileSources.find(
  source => source.size > facsimileSize.value
) ?? null)
const imageWidth = ref(selectedFacsimileSource.value?.width ?? 0)
function updateImageWidth(): void {
  imageWidth.value = facsimileImage.value?.getBoundingClientRect().width ?? 0
}
watch(() => selectedFacsimileSource.value?.url, () => {
  imageWidth.value = selectedFacsimileSource.value?.width ?? 0
})
watch([workId, alias], () => {
  facsimileSize.value = 3
  rotation.value = 0
})
function selectFacsimileSource(source: { size: number } | null): void {
  if (!source) return
  facsimileSize.value = source.size
  persistEditorImageState()
}
function rotateFacsimile(amount: number): void {
  rotation.value += amount
  persistEditorImageState()
}
function persistEditorImageState(): void {
  if (!import.meta.client) return
  window.history.replaceState({
    ...(window.history.state ?? {}),
    editorFacsimileSize: facsimileSize.value,
    editorRotation: rotation.value
  }, "", browserFullPath())
}
const overlayStyle = computed(() => {
  const width = page.value?.overlayWidth ?? 0
  return {
    width: `${width}px`,
    height: `${page.value?.overlayHeight ?? 0}px`,
    transform: `scale(${width > 0 && imageWidth.value > 0 ? imageWidth.value / width : 1})`
  }
})
function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
  )
}
function keyboardTarget(event: KeyboardEvent): number | null {
  const current = page.value
  if (!current) return null
  const boundedTarget = (target: number) => {
    if (current.pageIndexes) return current.pageIndexes.includes(target) ? target : null
    return target >= 0 && current.pageCount !== null && target < current.pageCount ? target : null
  }
  if (event.key === "n") return current.nextIndex
  if (event.key === "f") return current.previousIndex
  if (event.key === "m" || event.key === "F16") {
    return boundedTarget(current.pageIndex + 10)
  }
  if (event.key === "d" || event.key === "F15") {
    return boundedTarget(current.pageIndex - 10)
  }
  if (event.key === "ArrowRight") {
    if (event.altKey && event.shiftKey) {
      return boundedTarget(current.pageIndex + 10)
    }
    if (event.altKey) return null
    const atRightEdge = Math.ceil(window.scrollX + window.innerWidth) >=
      document.documentElement.scrollWidth
    return event.shiftKey || atRightEdge ? current.nextIndex : null
  }
  if (event.key === "ArrowLeft") {
    if (event.altKey && event.shiftKey) {
      return boundedTarget(current.pageIndex - 10)
    }
    if (event.altKey) return null
    return event.shiftKey || window.scrollX < 10 ? current.previousIndex : null
  }
  return null
}
function handleKeyboard(event: KeyboardEvent): void {
  if (
    event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey ||
    isEditableTarget(event.target) || isEditableTarget(document.activeElement)
  ) return
  const target = keyboardTarget(event)
  if (target === null) return
  event.preventDefault()
  void navigateRawFullPath(href(target))
}
onMounted(() => {
  const browserPath = browserFullPath()
  const fragmentIndex = browserPath.indexOf("#")
  if (fragmentIndex >= 0) {
    rawFullPath.value = `${rawFullPath.value.split("#", 1)[0]}${browserPath.slice(fragmentIndex)}`
  }
  window.addEventListener("resize", updateImageWidth)
  document.addEventListener("keydown", handleKeyboard)
})
onBeforeUnmount(() => {
  window.removeEventListener("resize", updateImageWidth)
  document.removeEventListener("keydown", handleKeyboard)
})
useHead(() => ({
  title: `${page.value?.title ?? workId.value} sida ${index.value} | Litteraturbanken`,
  bodyAttrs: { class: "focus page-reading ready" }
}))
</script>

<template>
  <div class="editor-reader reader-page">
    <p v-if="clientRequestFailed" class="reader-error" role="alert">Ett fel inträffade vid sidhämtningen.</p>
    <section v-if="page" class="reader_main state-not-parallel relative" :class="{ 'type-faksimil': page.mediaType === 'faksimil', ocr: ocrMode }">
      <div v-if="page.html" class="etext txt" v-html="page.html" />
      <div v-if="page.overlayHtml && page.overlayWidth && page.overlayHeight" class="absolute left-0 top-0 overflow-hidden h-full w-full pointer-events-none">
        <div class="overlay overflow-hidden origin-top-left" :style="overlayStyle" v-html="page.overlayHtml" />
      </div>
      <div v-if="selectedFacsimileSource" class="img_area" :style="selectedFacsimileSource.width ? { width: `${selectedFacsimileSource.width}px` } : undefined"><img ref="facsimileImage" class="faksimil transform transition duration-200" :style="{ ...(selectedFacsimileSource.width ? { width: `${selectedFacsimileSource.width}px`, maxWidth: `${selectedFacsimileSource.width}px` } : {}), transform: `rotate(${rotation}deg)` }" :src="selectedFacsimileSource.url" :alt="`Sida ${page.pageIndex}`" @load="updateImageWidth"></div>
    </section>
    <ClientOnly>
      <Teleport to="#toolkit">
        <div
          v-if="page?.mediaType === 'faksimil'"
          class="reader-facsimile-controls editor-facsimile-controls"
        >
          <div class="reader-facsimile-size-controls">
            <h2>Ändra storlek</h2>
            <button class="small_text btn btn-small" type="button" :disabled="!smallerFacsimileSource" @click="selectFacsimileSource(smallerFacsimileSource)">Mindre</button>
            <button class="small_text btn btn-small" type="button" :disabled="!largerFacsimileSource" @click="selectFacsimileSource(largerFacsimileSource)">Större</button>
          </div>
          <div class="reader-facsimile-rotation-controls">
            <h2>Rotera</h2>
            <button class="small_text btn btn-small" type="button" @click="rotateFacsimile(-90)">Vänster</button>
            <button class="small_text btn btn-small" type="button" @click="rotateFacsimile(90)">Höger</button>
          </div>
        </div>
      </Teleport>
      <Teleport to="#toolkit-right">
        <aside v-if="page" class="reader-context editor-reader-context" aria-label="Läsinformation och sidnavigering">
          <template v-if="page.metadataAvailable">
            <div class="editor-metadata-controls"><div class="author"><NuxtLink v-if="authorHref" :to="authorHref">{{ page.authorName }}</NuxtLink><span v-else>{{ page.authorName }}</span></div><span class="title">{{ page.title }}{{ " " }}</span><span
              v-if="page.imprintYear"
              class="editor-imprint-year"
            >({{ page.imprintYear }})</span></div>
            <hr class="editor-metadata-controls">
            <div class="current_part editor-metadata-controls">
              <div class="header" />
              <div><p class="navtitle" /></div>
            </div>
            <hr class="lower editor-metadata-controls">
          </template>
          <nav class="pager_ctrls" aria-label="Sidnavigering">
            <span class="prev_part disabled sc" aria-disabled="true">Gå bakåt en del</span>
            <br>
            <span class="next_part disabled sc" aria-disabled="true">Gå till nästa del</span>
            <br>
            <NuxtLink v-if="page.pageIndex > (page.pageIndexes?.[0] ?? 0)" custom :to="href(page.pageIndexes?.[0] ?? 0)"><a :href="href(page.pageIndexes?.[0] ?? 0)" @click="navigateLink($event, href(page.pageIndexes?.[0] ?? 0))">Gå till första sidan</a></NuxtLink>
            <span v-else class="disabled sc" aria-disabled="true">Gå till första sidan</span>
            <br>
            <NuxtLink v-if="page.pageCount !== null && page.pageIndex < (page.pageIndexes?.at(-1) ?? page.pageCount - 1)" custom :to="href(page.pageIndexes?.at(-1) ?? page.pageCount - 1)"><a :href="href(page.pageIndexes?.at(-1) ?? page.pageCount - 1)" @click="navigateLink($event, href(page.pageIndexes?.at(-1) ?? page.pageCount - 1))">Gå till sista sidan</a></NuxtLink>
            <span v-else class="disabled sc" aria-disabled="true">Gå till sista sidan</span>
            <br>
            <span class="goto"><span class="sc">Gå till sida . . .{{ " " }}<span
              v-if="page.pageName || page.endPageName"
              class="pages"
            ><template v-if="page.pageName">{{ page.pageName }}{{ " " }}</template><template
              v-if="page.endPageName"
            >av {{ page.endPageName }}</template></span></span></span>
            <NuxtLink v-if="page.previousIndex !== null" custom :to="href(page.previousIndex)"><a rel="prev" :href="href(page.previousIndex)" aria-label="Föregående sida" @click="navigateLink($event, href(page.previousIndex))"><span class="submit btn navicon navicon-visual left" aria-hidden="true"><i class="fa fa-angle-left" /></span></a></NuxtLink>{{ " " }}
            <NuxtLink v-if="page.nextIndex !== null" custom :to="href(page.nextIndex)"><a rel="next" :href="href(page.nextIndex)" aria-label="Nästa sida" @click="navigateLink($event, href(page.nextIndex))"><span class="submit btn navicon navicon-visual right" aria-hidden="true"><i class="fa fa-angle-right right" /></span></a></NuxtLink>
            <span class="expl small" aria-hidden="true">Du kan också bläddra med tangentbordets piltangenter.</span>
          </nav>
          <div v-if="page.pageCount !== null && page.pageIndexes === null" class="w-11/12">
            <span class="rzslider mt-3 slider-large" :class="{ active: sliderDraft !== null }">
              <span class="rz-base" aria-hidden="true">
                <span class="rz-bar-wrapper"><span class="rz-bar" /></span>
                <span class="rz-bar-wrapper"><span class="rz-bar rz-selection" :style="sliderStyles.selection" /></span>
              </span>
              <span class="rz-pointer rz-pointer-min" :style="sliderStyles.pointer" aria-hidden="true" />
              <span v-if="sliderDraft !== null" class="rz-bubble rz-model-value" :style="{ left: sliderStyles.selection.width }" aria-hidden="true">{{ sliderDraft }}</span>
              <input
                class="reader-slider-input editor-page-slider"
                type="range"
                min="0"
                :max="page.pageCount - 1"
                step="1"
                :value="sliderValue"
                aria-label="Gå till sida"
                :aria-valuetext="`Sida ${sliderValue}`"
                @input="previewSlider"
                @change="commitSlider"
                @blur="sliderDraft = null"
                @pointercancel="sliderDraft = null"
              >
            </span>
          </div>
          <div v-if="page.metadataAvailable" class="subnav mt-10 editor-metadata-controls">
            <ul>
              <li><span>Mer om boken</span></li>
              <li><span>Läsfokus</span></li>
              <li><span>Sök i verket</span></li>
              <li><NuxtLink v-if="authorSearchHref" :to="authorSearchHref">Sök i författarens texter</NuxtLink><span v-else>Sök i författarens texter</span></li>
            </ul>
            <NuxtLink v-if="page.closeHref" class="submit btn mt-4 text-xs" :to="page.closeHref">Stäng editor</NuxtLink>
          </div>
        </aside>
      </Teleport>
      <template #fallback>
        <aside v-if="page" class="reader-context-ssr" aria-label="Läsinformation och sidnavigering">
          <div v-if="page.metadataAvailable" class="editor-metadata-controls"><span>{{ page.authorName }}</span><span>{{ page.title }}<span
              v-if="page.imprintYear"
              class="editor-imprint-year"
            > ({{ page.imprintYear }})</span></span></div>
          <nav aria-label="Sidnavigering">
            <a v-if="page.previousIndex !== null" rel="prev" :href="href(page.previousIndex)">Föregående sida</a>
            <a v-if="page.nextIndex !== null" rel="next" :href="href(page.nextIndex)">Nästa sida</a>
          </nav>
          <span v-if="page.pageName || page.endPageName" class="pages"><template
            v-if="page.pageName"
          >{{ page.pageName }}{{ " " }}</template><template
            v-if="page.endPageName"
          >av {{ page.endPageName }}</template></span>
          <input v-if="page.pageCount !== null && page.pageIndexes === null" type="range" min="0" :max="page.pageCount - 1" :value="page.pageIndex" aria-label="Gå till sida">
          <a v-if="page.metadataAvailable && page.closeHref" :href="page.closeHref">Stäng editor</a>
        </aside>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.editor-reader-context .expl {
  margin-left: 8.078125px !important;
}

.editor-reader-context .pager_ctrls > .disabled {
  color: lightgrey;
}

.editor-facsimile-controls .reader-facsimile-size-controls button:first-of-type {
  margin-right: 4.53125px;
  width: 65.734375px;
}

.editor-facsimile-controls .reader-facsimile-rotation-controls button:first-of-type {
  margin-right: 4.53125px;
  text-indent: 0;
  width: 69.75px;
}

</style>
