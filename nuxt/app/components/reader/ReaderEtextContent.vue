<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/vue"
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type ComponentPublicInstance } from "vue"
import type { ManagedAssetHtml } from "#shared/types/renderable-html"

const props = defineProps<{ html: ManagedAssetHtml<"reader-etext"> }>()
const content = ref<ComponentPublicInstance | null>(null)
const figures = shallowRef<{ image: HTMLImageElement, parent: HTMLElement }[]>([])
const enlarged = shallowRef<HTMLImageElement | null>(null)
const panel = ref<HTMLElement | null>(null)
let observer: ResizeObserver | undefined

function clearFigures() {
  for (const figure of figures.value) figure.parent.classList.remove("img-overflow")
  figures.value = []
}

function measureImages() {
  const root = content.value?.$el as HTMLElement | undefined
  if (!root) return
  clearFigures()
  figures.value = Array.from(root.querySelectorAll<HTMLImageElement>("img.graphicimg"))
    .filter(image => image.complete && image.naturalWidth - image.width > 100
      && image.parentElement && !/\.svg(?:[?#]|$)/i.test(image.src))
    .map(image => {
      const parent = image.parentElement!
      parent.classList.add("img-overflow")
      return { image, parent }
    })
}

watch(() => props.html, async () => {
  enlarged.value = null
  clearFigures()
  await nextTick()
  measureImages()
})
onMounted(() => {
  observer = new ResizeObserver(measureImages)
  observer.observe(content.value!.$el)
  measureImages()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  clearFigures()
})
</script>

<template>
  <RenderableHtmlContent
    ref="content"
    as="div"
    class="etext txt"
    :html="html"
    @load.capture="measureImages"
  />
  <Teleport v-for="(figure, index) in figures" :key="index" :to="figure.parent">
    <button type="button" class="btn btn-xs expand" @click.stop="enlarged = figure.image">
      Förstora
    </button>
  </Teleport>
  <Dialog
    v-if="enlarged"
    :open="true"
    :initial-focus="panel"
    class="modal reader-image-modal fade in"
    @close="enlarged = null"
  >
    <div class="modal-backdrop fade in" aria-hidden="true" />
    <div class="modal-dialog modal-lg">
      <DialogPanel ref="panel" class="modal-content" tabindex="-1">
        <DialogTitle class="sr-only">Förstorad bild</DialogTitle>
        <div class="img-modal modal-body">
          <img :src="enlarged.src" :alt="enlarged.alt">
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>

<style lang="scss">
.reader-image-modal {
  display: block;
  position: fixed;
  overflow: auto;
  inset: 0;

  .modal-dialog.modal-lg {
    width: 71vw;
    z-index: 1050;
  }
}
.reader-page .etext .img-overflow {
  position: relative;

  .expand {
    position: absolute;
    bottom: -30px;
    right: 10px;
    padding: 3px 7px;
    font-size: 0.5em;
  }
}
</style>
