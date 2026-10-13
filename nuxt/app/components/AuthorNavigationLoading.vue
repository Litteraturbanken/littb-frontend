<script setup lang="ts">
import ordinaryBackground from "~/assets/img/forf2_bkg.jpg"
import dramawebbenBackground from "~/assets/img/dramawebben_fade_more.jpg"

const props = defineProps<{ destination: string }>()

// Present the destination shell while the route guard waits for its title.
// This entry is disposed on completion or cancellation, restoring the page head.
useHead(() => ({
  htmlAttrs: {
    style: `background: url('${props.destination.split(/[?#]/u)[0]?.endsWith("/dramawebben")
      ? dramawebbenBackground : ordinaryBackground}') no-repeat;`
  },
  bodyAttrs: {
    class: "focus page-authorInfo ready",
    tagDuplicateStrategy: "replace"
  }
}))
</script>

<template>
  <div data-author-navigation-loading class="author-data-loading" role="status" aria-label="Laddar författarsidan">
    <i class="fa fa-spinner fa-pulse" aria-hidden="true" />
    <span class="sr-only">Laddar författarsidan</span>
  </div>
</template>

<style scoped>
.author-data-loading {
  min-height: 8rem;
  padding: 2rem;
  color: var(--primary-color);
  text-align: center;
}
</style>
