<script setup lang="ts">
defineProps<{ message: string }>()
</script>

<template>
  <div :class="{ alert_popup: message }" role="status" aria-live="polite">
    {{ message }}
  </div>
</template>

<style scoped>
.alert_popup {
  position: fixed;
  bottom: 1em;
  right: 1em;
  padding: 2em;
  color: white;
  background: linear-gradient(#7a1400, #560e00);
  opacity: 1;
  transition: opacity ease-in-out 200ms;
}
</style>
