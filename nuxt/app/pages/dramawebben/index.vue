<script setup lang="ts">
import DramawebbenShell from "~/components/dramawebben/DramawebbenShell.vue"
import dramawebbenBackground from "~/assets/img/dramawebben.jpg"

useSeoMeta({
  title: "Litteraturbanken",
  description: "På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis."
})
useHead({
  bodyAttrs: {
    class: "focus page-dramaweb ready",
    style: `--dramawebben-background-image: url('${dramawebbenBackground}')`
  }
})
</script>

<template>
  <DramawebbenShell page="start" />
</template>
