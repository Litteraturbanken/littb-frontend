<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/vue"

import type { SanitizedHtml } from "#shared/types/renderable-html"

defineProps<{
  articleHtml: SanitizedHtml<"dictionary-article">
  open: boolean
}>()

const emit = defineEmits<{ close: [] }>()
const closeButton = ref<HTMLButtonElement | null>(null)
</script>

<template>
  <Dialog
    v-if="open"
    :open="open"
    :initial-focus="closeButton"
    as="div"
    class="modal reader-dictionary-modal fade in"
    @close="emit('close')"
  >
    <div class="modal-backdrop fade in" aria-hidden="true" />
    <div class="modal-dialog">
      <DialogPanel class="modal-content" tabindex="-1">
        <div class="so_modal">
          <div class="modal-header">
            <DialogTitle as="h4">Svensk ordbok utgiven av <br>Svenska Akademien (2009)</DialogTitle>
            <button
              ref="closeButton"
              class="btn pull-right"
              type="button"
              @click="emit('close')"
            >Stäng</button>
          </div>
          <RenderableHtmlContent as="div" class="_so_article" :html="articleHtml" />
          <div class="modal-footer"><i>Artikeln får inte kopieras eller spridas.</i></div>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>
