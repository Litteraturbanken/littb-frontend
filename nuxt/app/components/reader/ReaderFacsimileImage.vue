<script setup lang="ts">
import type {
  ReaderFacsimilePage,
  ReaderFacsimileSize,
  ReaderFacsimileSource
} from "#shared/types/reader"
import { adjacentFacsimileSize } from "#shared/utils/facsimile-source"

const props = defineProps<{
  ocrMode: boolean
  page: ReaderFacsimilePage
  selectedSize: ReaderFacsimileSize
}>()

const emit = defineEmits<{
  "select-size": [size: ReaderFacsimileSize]
}>()

const rotation = ref(0)
const imageFailed = ref(false)
const fallbackFacsimileAspect = { width: 625, height: 900 } as const

const selectedSource = computed<ReaderFacsimileSource>(() => {
  const source = props.page.sources.find(item => item.size === props.selectedSize)
  if (!source) throw new Error("Selected faksimil source is unavailable")
  return source
})
const retinaSource = computed(() => props.page.sources.find(
  item => item.size === props.selectedSize + 2
))
const smallerSize = computed(() => adjacentFacsimileSize(
  props.page.sources,
  props.selectedSize,
  -1
))
const largerSize = computed(() => adjacentFacsimileSize(
  props.page.sources,
  props.selectedSize,
  1
))
const sourceSet = computed(() => retinaSource.value
  ? `${selectedSource.value.url} 1x, ${retinaSource.value.url} 2x`
  : undefined
)
// A page's OCR dimensions can arrive after its image URL. Keep the rendered
// scan (including its geometry) until the next scan is decoded, instead of
// briefly rendering the fallback aspect ratio on every page turn.
const rendered = shallowRef({
  page: props.page,
  source: selectedSource.value,
  sourceSet: sourceSet.value,
  aspect: null as { width: number, height: number } | null
})
const renderedPage = computed(() => rendered.value.source.url === selectedSource.value.url
  ? props.page
  : rendered.value.page)
const renderedWidth = computed(() => rendered.value.page.workId === props.page.workId
  && rendered.value.page.imageNumber === props.page.imageNumber
  ? selectedSource.value.width
  : rendered.value.source.width)
const selectedHeight = computed(() => {
  const overlay = renderedPage.value.ocrOverlay
  const aspect = rendered.value.aspect ?? (overlay && overlay.width > 0 && overlay.height > 0
    ? overlay
    : fallbackFacsimileAspect)
  return Math.round(renderedWidth.value * aspect.height / aspect.width)
})
const imageAreaStyle = computed(() => ({
  width: `${renderedWidth.value}px`
}))
const overlayStyle = computed(() => {
  const overlay = renderedPage.value.ocrOverlay
  if (!overlay) return undefined
  return {
    width: `${overlay.width}px`,
    height: `${overlay.height}px`,
    transform: `scale(${renderedWidth.value / overlay.width})`
  }
})
watch(() => props.page.workId, () => {
  rotation.value = 0
})
let requestVersion = 0
onMounted(() => watch([() => selectedSource.value.url, sourceSet], async () => {
  const version = ++requestVersion
  const next = { page: props.page, source: selectedSource.value, sourceSet: sourceSet.value }
  const image = new Image()
  // Set srcset first so Safari requests only the appropriate density source.
  if (next.sourceSet) image.srcset = next.sourceSet
  image.src = next.source.url
  try {
    await image.decode()
    if (version !== requestVersion) return
    rendered.value = {
      ...next,
      aspect: { width: image.naturalWidth, height: image.naturalHeight }
    }
    imageFailed.value = false
  } catch {
    if (version === requestVersion) imageFailed.value = true
  }
}))
onBeforeUnmount(() => { requestVersion++ })

function imageLoaded(event: Event) {
  const image = event.target as HTMLImageElement
  if (image.getAttribute("src") !== rendered.value.source.url) return
  if (image.naturalWidth && image.naturalHeight) {
    rendered.value = {
      ...rendered.value,
      aspect: { width: image.naturalWidth, height: image.naturalHeight }
    }
  }
}
function imageError(event: Event) {
  const image = event.target as HTMLImageElement
  if (image.getAttribute("src") === rendered.value.source.url) imageFailed.value = true
}
</script>

<template>
  <div class="img_area" :style="imageAreaStyle">
    <div
      v-if="renderedPage.ocrOverlay && !imageFailed"
      class="reader-ocr-layer absolute left-0 top-0 overflow-hidden h-full w-full"
      :aria-hidden="!ocrMode"
    >
      <RenderableHtmlContent
        as="div"
        class="overlay overflow-hidden origin-top-left"
        :style="overlayStyle"
        :html="renderedPage.ocrOverlay.html"
      />
    </div>
    <img
      :key="rendered.source.url"
      class="faksimil"
      :srcset="rendered.sourceSet"
      :src="rendered.source.url"
      :width="renderedWidth"
      :height="selectedHeight"
      :alt="`${renderedPage.title} av ${renderedPage.author.full_name}, sida ${renderedPage.pageName}`"
      :aria-hidden="imageFailed"
      :style="{
        width: `${renderedWidth}px`,
        maxWidth: `${renderedWidth}px`,
        visibility: imageFailed ? 'hidden' : undefined,
        transform: `rotate(${rotation}deg)`
      }"
      @load="imageLoaded"
      @error="imageError"
    >
    <p
      v-if="imageFailed"
      class="reader-facsimile-error absolute left-0 top-0"
      role="alert"
    >Faksimilbilden kunde inte hämtas.</p>
  </div>

  <ClientOnly>
    <Teleport to="#reader-facsimile-toolkit">
      <div class="reader-facsimile-controls">
        <div class="reader-facsimile-size-controls">
          <h2>Ändra storlek</h2>
          <button
            class="small_text btn btn-small"
            type="button"
            :disabled="smallerSize === undefined"
            @click="smallerSize !== undefined && emit('select-size', smallerSize)"
          >Mindre</button>
          <button
            class="small_text btn btn-small"
            type="button"
            :disabled="largerSize === undefined"
            @click="largerSize !== undefined && emit('select-size', largerSize)"
          >Större</button>
        </div>
        <div class="reader-facsimile-rotation-controls">
          <h2>Rotera</h2>
          <button
            class="small_text btn btn-small"
            type="button"
            @click="rotation -= 90"
          >Vänster</button>
          <button
            class="small_text btn btn-small"
            type="button"
            @click="rotation += 90"
          >Höger</button>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>
