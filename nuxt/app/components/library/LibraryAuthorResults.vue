<script setup lang="ts">
import { useId } from "vue"
import { canonicalNuxtHref } from "../../lib/internal-navigation"
import {
    librarySortDirection,
    type LibraryNativeSortOption
} from "../../lib/library/component-models"
import type { AuthorSortKey } from "~/lib/library/navigation"
import type { AuthorBrowseResponse } from "~/lib/library/page-results"

defineProps<{
    response: AuthorBrowseResponse
    sortOptions: readonly LibraryNativeSortOption<AuthorSortKey>[]
    sortReversed: boolean
    loading: boolean
    showAll: boolean
}>()
const emit = defineEmits<{
    selectSort: [sort: AuthorSortKey]
    showAll: []
}>()
const sortDirectionId = `library-author-sort-direction-${useId()}`
</script>

<template>
    <div class="result author pl-0 flex-column min-h-500">
        <div class="text-base">
            <div class="inline-block sc mr-2">Sortera:</div>
            <ul class="part_header top_header mb-4 inline-block">
                <li v-for="item in sortOptions" :key="item.key" class="inline-block sc">
                    <a
                        :href="item.to"
                        class="sort_item"
                        :class="{ active: item.active }"
                        :data-library-sort="item.key"
                        :aria-current="item.active ? 'true' : undefined"
                        :aria-describedby="item.active ? `${sortDirectionId}-${item.key}` : undefined"
                        @click.prevent="emit('selectSort', item.key)"
                        >{{ item.label }}</a>
                    <template v-if="item.active"
                        ><span :id="`${sortDirectionId}-${item.key}`" class="sr-only"
                            >Aktiv sortering, {{ librarySortDirection("authors", item.key, sortReversed) }}</span
                        >{{ " "
                        }}<i
                            aria-hidden="true"
                            class="fa"
                            :class="sortReversed ? 'fa-caret-up' : 'fa-caret-down'"
                        />
                    </template>
                </li>
            </ul>
        </div>
        <div
            v-if="loading"
            data-library-loading
            role="status"
            class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0"
        >
            <span class="sr-only">Laddar resultat</span>
            <i aria-hidden="true" class="spinner fa fa-spinner fa-pulse" />
        </div>
        <div v-if="response.failed" data-library-error role="alert">Ett fel uppstod.</div>
        <div v-else-if="!response.data.length" data-library-empty class="pb-4">
            Inga träffar.
        </div>
        <table v-else class="table flex-grow w-full">
            <tbody>
                <tr
                    v-for="(item, index) in response.data"
                    :key="`${item.primaryHref}:${index}`"
                    data-library-author-row
                    class="hover:bg-gray-300 hover:bg-opacity-80 transition-colors duration-150"
                >
                    <td class="author_row">
                        <NuxtLink
                            :to="canonicalNuxtHref(item.primaryHref)"
                            data-library-author-name
                        >
                            <span class="surname uppercase">{{ item.authorSurname }}</span
                            ><span v-if="item.authorGivenNames">,</span>
                            {{ item.authorGivenNames }}
                        </NuxtLink>
                    </td>
                    <td>{{ item.yearLabel }}</td>
                </tr>
                <tr v-if="showAll">
                    <td>
                        <button
                            type="button"
                            data-library-authors-show-all
                            class="btn btn-sm show_all"
                            :disabled="loading"
                            @click="emit('showAll')"
                        >
                            Visa alla
                            <span class="num">{{ response.hits }}</span>
                            träffar
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
