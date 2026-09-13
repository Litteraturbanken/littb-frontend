<script setup lang="ts">
import { PopoverPanel } from "@headlessui/vue"

const props = defineProps<{
  open: boolean
  close: () => void
}>()
const route = useRoute()

watch(() => route.fullPath, () => {
  if (props.open) props.close()
})

function closeAfterNavigation(event: MouseEvent) {
  if (props.open && (event.target as HTMLElement).closest("a[href]")) props.close()
}
</script>

<template>
  <PopoverPanel
    as="nav"
    static
    aria-label="Huvudnavigation"
    class="site-navigation-panel"
    :class="{ 'site-navigation-panel--open': open }"
    @click="closeAfterNavigation"
  >
    <slot />
  </PopoverPanel>
</template>
