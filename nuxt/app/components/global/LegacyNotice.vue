<script setup lang="ts">
defineProps<{ message: string }>()
</script>

<template>
  <div :class="{ alert_popup: message }" role="status" aria-live="polite">
    {{ message }}
  </div>
</template>
