<script setup lang="ts">
import DramawebbenShell from "~/components/dramawebben/DramawebbenShell.vue"

useSeoMeta({ title: "Litteraturbanken" })
useHead({ bodyAttrs: { class: "focus page-dramaweb ready" } })
</script>

<template>
  <DramawebbenShell page="start" />
</template>
