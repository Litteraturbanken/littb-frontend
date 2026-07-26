<script setup lang="ts">
import type { NuxtError } from "#app"
import { readerMissingPageName } from "~/lib/reader-missing-page"

const props = defineProps<{ error: NuxtError }>()
const isNotFound = computed(() => props.error.statusCode === 404)
const missingReaderPageName = computed(() => isNotFound.value
  ? readerMissingPageName(props.error.data)
  : null)

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
    <p v-if="missingReaderPageName">
      Hittar ingen sida '{{ missingReaderPageName }}' i verket.
    </p>
    <template v-else-if="isNotFound">
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
