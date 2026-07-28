<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/vue"

import type { ReaderPart, ReaderWorkContributor } from "#shared/types/reader"
import type {
  WorkManifestContributor,
  WorkManifestPart,
  WorkManifestPartAuthor
} from "#shared/types/work-manifest"
import { readerManifestPartAuthorLabel } from "#shared/utils/reader-author"
import { readerAuthorHref, readerPartAuthorKey } from "~/lib/reader-routes"

type ContentsContributor = ReaderWorkContributor | WorkManifestContributor
type ContentsPart = ReaderPart | WorkManifestPart
type ContentsPartAuthor = ReaderPart["authors"][number] | WorkManifestPartAuthor

defineProps<{
  open: boolean
  contributors: readonly ContentsContributor[]
  title: string
  imprintYear: string | null
  parts: readonly ContentsPart[]
  partHrefs: readonly string[]
}>()

const emit = defineEmits<{
  close: []
  "select-page": [pageName: string]
}>()

function partSourceIndex(part: ContentsPart): number {
  return "source_index" in part ? part.source_index : part.sourceIndex
}

function partStartPageName(part: ContentsPart): string {
  return "start_page_name" in part ? part.start_page_name : part.startPageName
}

function partLabel(part: ContentsPart): string {
  return "nav_title" in part
    ? part.nav_title || part.short_title || part.title
    : part.navTitle || part.shortTitle || part.title
}

function authorId(author: ContentsPartAuthor): string {
  return "author_id" in author ? author.author_id : author.id
}

function authorLabel(author: ContentsPartAuthor): string {
  return "author_id" in author
    ? readerManifestPartAuthorLabel(author, true)
    : author.surname ?? author.name ?? author.id
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
              :key="partSourceIndex(part)"
              :title="part.title"
            >
              <span>
                <span
                  v-for="(author, authorIndex) in part.authors"
                  :key="readerPartAuthorKey(authorId(author), authorIndex)"
                  class="author"
                ><NuxtLink :to="readerAuthorHref(authorId(author))">{{ authorLabel(author) }}</NuxtLink><span
                  v-if="authorIndex < part.authors.length - 1"
                >, </span>{{ " " }}</span>
              </span><span class="title">
                <NuxtLink
                  v-slot="{ href }"
                  custom
                  :to="partHrefs[partIndex]"
                ><a
                  :href="href || partHrefs[partIndex] || ''"
                  @click.prevent.stop="emit('select-page', partStartPageName(part))"
                >{{ partLabel(part) }}</a></NuxtLink>
              </span>
            </li>
          </ul>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>
