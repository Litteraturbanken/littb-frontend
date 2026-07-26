<script setup lang="ts">
import type { ReaderWorkContributor } from "#shared/types/reader"
import { readerAuthorContributionSuffix } from "#shared/utils/reader-author"
import { readerAuthorHref } from "~/lib/reader-routes"

defineProps<{
  contributors: readonly ReaderWorkContributor[]
}>()

function suffix(contributor: ReaderWorkContributor): string | null {
  return readerAuthorContributionSuffix(contributor.authorType, contributor.role)
}
</script>

<template>
  <template
    v-for="(contributor, index) in contributors"
    :key="`${contributor.id}:${index}`"
  >
    <NuxtLink :to="readerAuthorHref(contributor.id)">{{ contributor.name }}{{
      suffix(contributor) ? " " : ""
    }}<span v-if="suffix(contributor)" class="authortype">{{ suffix(contributor) }}</span></NuxtLink><template
      v-if="index < contributors.length - 2"
    >, </template><template
      v-else-if="index === contributors.length - 2"
    > <em class="font-normal">&</em> </template>
  </template>
</template>
