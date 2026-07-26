<script setup lang="ts">
defineProps<{ message: string }>()
</script>

<template>
  <div v-if="message" class="alert_popup" role="status" aria-live="polite">
    {{ message }}
  </div>
</template>
