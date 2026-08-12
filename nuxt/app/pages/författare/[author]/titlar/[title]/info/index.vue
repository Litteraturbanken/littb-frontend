<script setup lang="ts">
import ReaderSourceInfoAlias from "../index.vue"

definePageMeta({
  key: route => route.fullPath
})
</script>

<template>
  <ReaderSourceInfoAlias />
</template>
