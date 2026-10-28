<script setup lang="ts">
import { canonicalNuxtHref } from "../../lib/internal-navigation"
import type { BrowseAction } from "../../lib/library/view-model"
import WipeTransition from "../global/WipeTransition.vue"

defineProps<{
    id: string
    open: boolean
    actions: readonly BrowseAction[]
}>()
</script>

<template>
    <WipeTransition>
        <div v-show="open" :id="id" data-library-work-actions class="collapse-content" :inert="!open || undefined">
            <ul class="links">
                <li v-for="(action, index) in actions" :key="`${action.kind}:${action.href}:${action.label}:${index}`">
                    <a
                        v-if="action.href && action.kind === 'download'"
                        :href="action.href"
                        target="_self"
                        :download="action.downloadFilename"
                    >{{ action.label }}</a>
                    <NuxtLink v-else-if="action.href" :to="canonicalNuxtHref(action.href)">{{ action.label }}</NuxtLink>
                    <span v-else>{{ action.label }}</span>
                </li>
            </ul>
        </div>
    </WipeTransition>
</template>
