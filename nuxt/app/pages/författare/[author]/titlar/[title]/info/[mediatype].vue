<script setup lang="ts">
import type { ReaderMediaType } from "#shared/types/reader"

import ReaderSourceInfoAlias from "../index.vue"

definePageMeta({
  key: route => route.fullPath,
  validate: route => route.params.mediatype === "etext"
    || route.params.mediatype === "faksimil"
})

const route = useRoute()
const requestedMediaType = computed(() => route.params.mediatype as ReaderMediaType)
</script>

<template>
  <ReaderSourceInfoAlias :media-type="requestedMediaType" />
</template>
