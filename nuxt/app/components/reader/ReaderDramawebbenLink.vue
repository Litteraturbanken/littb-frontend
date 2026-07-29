<script setup lang="ts">
import dramawebbenLogo from "~/assets/img/dramawebben_svart.svg"

withDefaults(defineProps<{
  clientNavigation?: boolean
}>(), {
  clientNavigation: true
})
</script>

<template>
  <NuxtLink v-if="clientNavigation" class="inline-block" to="/dramawebben" no-prefetch>
    <img class="dw_logo" :src="dramawebbenLogo" alt="Dramawebben logotyp">
  </NuxtLink>
  <a v-else href="/dramawebben">
    <img class="dw_logo" :src="dramawebbenLogo" alt="Dramawebben logotyp">
  </a>
</template>
