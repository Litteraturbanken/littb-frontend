<script setup lang="ts">
import { libraryTooltipDirective } from "../../directives/library-tooltip"

defineProps<{ label: string, tooltip: string, controls: string, expanded: boolean }>()
const emit = defineEmits<{ click: [event: MouseEvent] }>()
const vLibraryTooltip = libraryTooltipDirective
</script>

<template>
    <button
        v-library-tooltip="tooltip"
        type="button"
        data-library-work-toggle
        data-library-tooltip-kind="title"
        class="library-work-toggle"
        :aria-controls="controls"
        :aria-expanded="expanded"
        @click="emit('click', $event)"
    >{{ label }}</button>
</template>

<style scoped>
.library-work-toggle {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    padding: 0;
    color: #333;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
    cursor: pointer;
    background: transparent;
    border: 0;
}

.library-work-toggle:hover,
.library-work-toggle:focus-visible {
    color: #7a1400;
}
</style>
