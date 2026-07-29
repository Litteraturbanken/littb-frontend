<script setup lang="ts">
import type { WorkManifestContributor } from "#shared/types/work-manifest"
import { readerAuthorContributionSuffix } from "#shared/utils/reader-author"
import { readerAuthorHref } from "~/lib/reader-routes"

defineProps<{
  contributors: readonly WorkManifestContributor[]
}>()

function suffix(contributor: WorkManifestContributor): string | null {
  return readerAuthorContributionSuffix(contributor.author_type, contributor.role)
}
</script>

<template>
  <template
    v-for="(contributor, index) in contributors"
    :key="`${contributor.author_id}:${index}`"
  >
    <NuxtLink :to="readerAuthorHref(contributor.author_id)" no-prefetch>{{ contributor.full_name }}{{
      suffix(contributor) ? " " : ""
    }}<span v-if="suffix(contributor)" class="authortype">{{ suffix(contributor) }}</span></NuxtLink><template
      v-if="index < contributors.length - 2"
    >, </template><template
      v-else-if="index === contributors.length - 2"
    >{{ " " }}<em class="font-normal">&</em>{{ " " }}</template>
  </template>
</template>
