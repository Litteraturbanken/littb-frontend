<script setup lang="ts">
import type { LibraryModeTab } from "~/lib/library/component-models"

defineProps<{
    tabs: readonly LibraryModeTab[]
}>()
</script>

<template>
    <template v-for="tab in tabs" :key="tab.mode">
        <template v-if="tab.separatorBefore">{{ " " }}</template>
        <NuxtLink
            :data-library-tab="tab.mode"
            :to="tab.to"
            :aria-current="tab.active ? 'page' : undefined"
            :aria-disabled="tab.disabledLook || undefined"
            class="sc btn btn-small text-base"
            :class="{
                active: tab.active,
                'library-tab-disabled-look':
                    tab.disabledLook && (tab.mode === 'authors' || tab.mode === 'parts'),
                'relevance-unavailable':
                    tab.disabledLook && (tab.mode === 'epub' || tab.mode === 'pdf')
            }"
            >{{ tab.label }}<span
                v-if="tab.count !== null"
                class="num_hits"
                :class="{ parts: tab.mode === 'parts' }"
                >: {{ tab.count }}</span
            ></NuxtLink
        >
    </template>
</template>

<style scoped>
.relevance-unavailable {
    color: #333;
    opacity: 0.65;
}

.library-tab-disabled-look {
    opacity: 0.65;
    box-shadow: none;
}

[data-library-tab] {
    margin-right: calc(0.2em + 4px);
}
</style>
