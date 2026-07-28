<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/vue"

import type {
  WorkManifestContributor,
  WorkManifestPart,
  WorkManifestPartAuthor
} from "#shared/types/work-manifest"
import { readerManifestPartAuthorLabel } from "#shared/utils/reader-author"
import { readerAuthorHref, readerPartAuthorKey } from "~/lib/reader-routes"

defineProps<{
  open: boolean
  contributors: readonly WorkManifestContributor[]
  title: string
  imprintYear: string | null
  parts: readonly WorkManifestPart[]
  partHrefs: readonly string[]
}>()

const emit = defineEmits<{
  close: []
  "select-page": [pageName: string]
}>()

function partLabel(part: WorkManifestPart): string {
  return part.nav_title || part.short_title || part.title
}

function authorLabel(author: WorkManifestPartAuthor): string {
  return readerManifestPartAuthorLabel(author, true)
}

const dialogPanel = ref<HTMLElement | null>(null)
</script>

<template>
  <Dialog
    v-if="open"
    :open="open"
    :initial-focus="dialogPanel"
    as="div"
    class="modal chapters fade in"
    @close="emit('close')"
  >
    <div class="modal-backdrop fade in" aria-hidden="true" />
    <div class="modal-dialog">
      <DialogPanel ref="dialogPanel" class="modal-content" tabindex="-1">
        <div class="chapters-modal modal-body">
          <button
            class="close_btn submit btn pull-right"
            type="button"
            @click="emit('close')"
          >Stäng</button>
          <DialogTitle class="sr-only">Innehållsförteckning</DialogTitle>

          <div class="header">
            <h2 class="author sc"><ReaderContributors :contributors="contributors" /></h2>
            <h2 class="title">
              {{ title }} <span v-if="imprintYear">({{ imprintYear }})</span>
            </h2>
          </div>

          <ul class="part_menu">
            <li
              v-for="(part, partIndex) in parts"
              :key="part.source_index"
              :title="part.title"
            >
              <span>
                <span
                  v-for="(author, authorIndex) in part.authors"
                  :key="readerPartAuthorKey(author.author_id, authorIndex)"
                  class="author"
                ><NuxtLink :to="readerAuthorHref(author.author_id)">{{ authorLabel(author) }}</NuxtLink><span
                  v-if="authorIndex < part.authors.length - 1"
                >, </span>{{ " " }}</span>
              </span><span class="title">
                <NuxtLink
                  v-slot="{ href }"
                  custom
                  :to="partHrefs[partIndex]"
                ><a
                  :href="href || partHrefs[partIndex] || ''"
                  @click.prevent.stop="emit('select-page', part.start_page_name)"
                >{{ partLabel(part) }}</a></NuxtLink>
              </span>
            </li>
          </ul>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>
