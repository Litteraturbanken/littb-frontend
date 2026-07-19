<script setup lang="ts">
import DramawebbenShell from "~/components/dramawebben/DramawebbenShell.vue"

useSeoMeta({
  title: "Litteraturbanken",
  description: "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."
})
useHead({ bodyAttrs: { class: "focus page-dramaweb ready" } })
</script>

<template>
  <DramawebbenShell page="start" />
</template>
