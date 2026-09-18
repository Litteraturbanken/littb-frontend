<script setup lang="ts">
import type { LibraryPaginationModel } from "~/lib/library/component-models"

defineProps<{
    model: LibraryPaginationModel
    compact?: boolean
}>()
const emit = defineEmits<{ selectPage: [page: number] }>()
</script>

<template>
    <nav aria-label="Sidnavigation">
        <ul class="pagination pagination-sm sc">
            <li :class="{ disabled: model.previous === null }">
                <span
                    v-if="model.previous === null"
                    data-library-pagination-previous
                    aria-label="Föregående"
                    aria-disabled="true"
                    >{{ compact ? '←' : 'Föregående' }}</span
                >
                <NuxtLink
                    v-else
                    v-slot="{ href }"
                    custom
                    no-prefetch
                    :to="model.previous"
                ><a
                    data-library-pagination-previous
                    aria-label="Föregående"
                    :href="href || ''"
                    @click.prevent="emit('selectPage', model.currentPage - 1)"
                    >{{ compact ? '←' : 'Föregående' }}</a
                ></NuxtLink>
            </li>
            <li
                v-for="item in model.entries"
                :key="item.key"
                :class="{ active: item.page === model.currentPage }"
            >
                <NuxtLink
                    v-slot="{ href }"
                    custom
                    no-prefetch
                    :to="item.to"
                ><a
                    :data-library-page="item.ellipsis ? undefined : item.page"
                    :data-library-pagination-ellipsis="item.ellipsis || undefined"
                    :href="href || ''"
                    :aria-current="item.page === model.currentPage ? 'page' : undefined"
                    @click.prevent="emit('selectPage', item.page)"
                    >{{ item.label }}</a
                ></NuxtLink>
            </li>
            <li :class="{ disabled: model.next === null }">
                <span
                    v-if="model.next === null"
                    data-library-pagination-next
                    aria-label="Nästa"
                    aria-disabled="true"
                    >{{ compact ? '→' : 'Nästa' }}</span
                >
                <NuxtLink
                    v-else
                    v-slot="{ href }"
                    custom
                    no-prefetch
                    :to="model.next"
                ><a
                    data-library-pagination-next
                    aria-label="Nästa"
                    :href="href || ''"
                    @click.prevent="emit('selectPage', model.currentPage + 1)"
                    >{{ compact ? '→' : 'Nästa' }}</a
                ></NuxtLink>
            </li>
        </ul>
    </nav>
</template>
