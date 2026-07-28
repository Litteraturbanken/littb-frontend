<script setup lang="ts">
import type { ReaderWorkContributor } from "#shared/types/reader"
import type { WorkManifestContributor } from "#shared/types/work-manifest"
import { readerAuthorContributionSuffix } from "#shared/utils/reader-author"
import { readerAuthorHref } from "~/lib/reader-routes"

type Contributor = ReaderWorkContributor | WorkManifestContributor

defineProps<{
  contributors: readonly Contributor[]
}>()

function contributorId(contributor: Contributor): string {
  return "author_id" in contributor ? contributor.author_id : contributor.id
}

function contributorName(contributor: Contributor): string {
  return "full_name" in contributor ? contributor.full_name : contributor.name
}

function suffix(contributor: Contributor): string | null {
  const authorType = "author_type" in contributor
    ? contributor.author_type
    : contributor.authorType
  return readerAuthorContributionSuffix(authorType, contributor.role)
}
</script>

<template>
  <template
    v-for="(contributor, index) in contributors"
    :key="`${contributorId(contributor)}:${index}`"
  >
    <NuxtLink :to="readerAuthorHref(contributorId(contributor))">{{ contributorName(contributor) }}{{
      suffix(contributor) ? " " : ""
    }}<span v-if="suffix(contributor)" class="authortype">{{ suffix(contributor) }}</span></NuxtLink><template
      v-if="index < contributors.length - 2"
    >, </template><template
      v-else-if="index === contributors.length - 2"
    > <em class="font-normal">&</em> </template>
  </template>
</template>
