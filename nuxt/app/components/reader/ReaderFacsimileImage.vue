<script setup lang="ts">
import type {
  ReaderFacsimilePage,
  ReaderFacsimileSize,
  ReaderFacsimileSource
} from "#shared/types/reader"

const props = defineProps<{
  page: ReaderFacsimilePage
  selectedSize: ReaderFacsimileSize
}>()

const emit = defineEmits<{
  "select-size": [size: ReaderFacsimileSize]
}>()

const rotation = ref(0)
const imageFailed = ref(false)

const selectedSource = computed<ReaderFacsimileSource>(() => {
  const source = props.page.sources.find(item => item.size === props.selectedSize)
  if (!source) throw new Error("Selected faksimil source is unavailable")
  return source
})
const retinaSource = computed(() => props.page.sources.find(
  item => item.size === props.selectedSize + 2
))
const smallerSize = computed(() => props.page.sources.find(
  item => item.size === props.selectedSize - 1
)?.size)
const largerSize = computed(() => props.page.sources.find(
  item => item.size === props.selectedSize + 1
)?.size)
const sourceSet = computed(() => retinaSource.value
  ? `${selectedSource.value.url} 1x, ${retinaSource.value.url} 2x`
  : undefined
)
const overlayStyle = computed(() => {
  const overlay = props.page.ocrOverlay
  if (!overlay) return undefined
  return {
    width: `${overlay.width}px`,
    height: `${overlay.height}px`,
    transform: `scale(${selectedSource.value.width / overlay.width})`
  }
})
const pageIdentity = computed(() => [
  props.page.workId,
  props.page.pageName,
  props.page.imageNumber
].join(":"))
const selectedSourceIdentity = computed(() => selectedSource.value.url)

watch(pageIdentity, () => {
  imageFailed.value = false
})
watch(() => props.page.workId, () => {
  rotation.value = 0
})
watch(selectedSourceIdentity, () => {
  imageFailed.value = false
})
</script>

<template>
  <div class="img_area" :style="{ width: `${selectedSource.width}px` }">
    <div
      v-if="page.ocrOverlay"
      class="reader-ocr-layer absolute left-0 top-0 overflow-hidden h-full w-full"
    >
      <div
        class="overlay overflow-hidden origin-top-left"
        :style="overlayStyle"
        v-html="page.ocrOverlay.html"
      />
    </div>
    <img
      :key="selectedSourceIdentity"
      v-show="!imageFailed"
      class="faksimil"
      :src="selectedSource.url"
      :srcset="sourceSet"
      :width="selectedSource.width"
      :alt="`${page.title} av ${page.author.name}, sida ${page.pageName}`"
      :style="{
        width: `${selectedSource.width}px`,
        maxWidth: `${selectedSource.width}px`,
        transform: `rotate(${rotation}deg)`
      }"
      @load="imageFailed = false"
      @error="imageFailed = true"
    >
    <p
      v-if="imageFailed"
      class="reader-facsimile-error"
      role="alert"
    >Faksimilbilden kunde inte hämtas.</p>
  </div>

  <ClientOnly>
    <Teleport to="#toolkit">
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
