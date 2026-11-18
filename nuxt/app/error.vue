<script setup lang="ts">
import type { NuxtError } from "#app"

const props = defineProps<{ error: NuxtError }>()
const isNotFound = computed(() => props.error.statusCode === 404)

useSeoMeta({
  title: computed(() => isNotFound.value
    ? "Sidan kan inte hittas | Litteraturbanken"
    : "Ett fel inträffade | Litteraturbanken")
})

useHead({
  htmlAttrs: { style: "" },
  bodyAttrs: { class: "focus ready" }
})
</script>

<template>
  <NuxtLayout name="default">
    <template v-if="isNotFound">
      <p>Du har angett en adress som inte finns på Litteraturbanken.</p>
      <p>
        Använd webbläsarens bakåtknapp för att komma tillbaka till
        sidan du var på innan, eller klicka på någon av
        länkarna till vänster.
      </p>
    </template>
    <p v-else>Ett fel inträffade. Vänligen försök igen senare.</p>
  </NuxtLayout>
</template>
