<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/vue"
import type { ComponentPublicInstance } from "vue"

import type { SanitizedHtml } from "#shared/types/renderable-html"
import type {
  EmbedSession,
  EmbedStatus
} from "~/composables/useReaderDictionaryEmbed"

type LegacyDialogProps = {
  articleHtml: SanitizedHtml<"dictionary-article">
  mode: "legacy"
  open: boolean
}

type EmbedDialogProps = {
  frameRef: (element: Element | ComponentPublicInstance | null) => void
  fullSiteUrl: string | null
  handleFrameLoad: () => void
  mode: "embed"
  open: boolean
  session: EmbedSession | null
  status: EmbedStatus
  word: string
}

const props = defineProps<LegacyDialogProps | EmbedDialogProps>()

const emit = defineEmits<{ close: [] }>()
const closeButton = ref<HTMLButtonElement | null>(null)
const frameTitle = computed(() => props.mode === "embed"
  ? `Slå upp ${props.word} i SO och SAOB`
  : "")
</script>

<template>
  <Dialog
    v-if="props.open"
    :open="props.open"
    :initial-focus="closeButton"
    as="div"
    class="modal reader-dictionary-modal fade in"
    @close="emit('close')"
  >
    <div class="modal-backdrop fade in" aria-hidden="true" />
    <div class="modal-dialog">
      <DialogPanel class="modal-content" tabindex="-1">
        <div v-if="props.mode === 'legacy'" class="so_modal">
          <div class="modal-header">
            <DialogTitle as="h4">Svensk ordbok utgiven av <br>Svenska Akademien (2009)</DialogTitle>
            <button
              ref="closeButton"
              class="btn pull-right"
              type="button"
              @click="emit('close')"
            >Stäng</button>
          </div>
          <RenderableHtmlContent as="div" class="_so_article" :html="props.articleHtml" />
          <div class="modal-footer"><i>Artikeln får inte kopieras eller spridas.</i></div>
        </div>
        <div v-else class="reader-dictionary-embed">
          <div class="modal-header">
            <DialogTitle as="h4">Slå upp ord</DialogTitle>
            <button
              ref="closeButton"
              class="btn pull-right"
              type="button"
              @click="emit('close')"
            >Stäng</button>
          </div>
          <p
            v-if="props.status === 'loading'"
            class="reader-dictionary-embed__status"
            role="status"
          >Laddar ordboken…</p>
          <p
            v-else-if="props.status === 'empty'"
            class="reader-dictionary-embed__status"
            role="status"
          >Hittade inget uppslag</p>
          <p
            v-else-if="props.status === 'error' || props.status === 'timeout'"
            class="reader-dictionary-embed__status"
            role="status"
          >Ordboken kunde inte laddas</p>
          <iframe
            v-if="props.session"
            :ref="props.frameRef"
            class="reader-dictionary-embed__frame"
            :src="props.session.src"
            :title="frameTitle"
            sandbox="allow-scripts allow-same-origin"
            referrerpolicy="origin"
            @load="props.handleFrameLoad"
          />
          <p
            v-if="props.fullSiteUrl && ['empty', 'error', 'timeout'].includes(props.status)"
            class="reader-dictionary-embed__fallback"
          >
            <a :href="props.fullSiteUrl">Öppna uppslaget på Svenska Akademiens ordbokssida</a>
          </p>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>
