<script setup lang="ts">
import { authorProfilePath } from "~/lib/author-profile"

const props = defineProps<{ authorId: string }>()
const hasWorks = await useAuthorWorksAvailability(computed(() => props.authorId))
</script>

<template>
  <li v-if="hasWorks !== false">
    <NuxtLink :to="authorProfilePath(authorId, 'titlar')">Verk</NuxtLink>
  </li>
</template>
