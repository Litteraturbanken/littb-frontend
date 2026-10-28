<script setup lang="ts">
import WipeTransition from "../global/WipeTransition.vue"

defineProps<{ open: boolean }>()
</script>

<template>
  <WipeTransition>
    <div v-show="open" class="searchbox" :inert="!open || undefined"><slot /></div>
  </WipeTransition>
</template>
