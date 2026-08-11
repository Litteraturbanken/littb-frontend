<script setup lang="ts">
import { computed } from "vue"
import type { RouteLocationRaw } from "vue-router"
import { libraryTooltipDirective } from "../../directives/library-tooltip"
import { canonicalNuxtHref } from "../../lib/internal-navigation"
import type {
    LibraryImprintYearTarget,
    LibraryPaginationModel,
    LibrarySortOption
} from "~/lib/library/component-models"
import type { LatestSortKey } from "~/lib/library/navigation"
import type { LatestResponse } from "~/lib/library/page-results"
import LibraryPagination from "./LibraryPagination.vue"

const props = defineProps<{
    response: LatestResponse
    sortOptions: readonly LibrarySortOption<LatestSortKey>[]
    sortReversed: boolean
    hide1800: boolean
    imprintYearTargets: readonly LibraryImprintYearTarget[]
    loading: boolean
    pagination: LibraryPaginationModel
}>()
const emit = defineEmits<{
    selectSort: [sort: LatestSortKey]
    toggleHide1800: []
    selectPage: [page: number]
}>()

const vLibraryTooltip = libraryTooltipDirective
const imprintYearTargetsByYear = computed(
    () => new Map(props.imprintYearTargets.map(target => [target.year, target.to]))
)

function hasImprintYearTarget(year: string): boolean {
    return imprintYearTargetsByYear.value.has(year)
}

function imprintYearTo(year: string): RouteLocationRaw {
    return imprintYearTargetsByYear.value.get(year)!
}
</script>

<template>
    <div class="result title pl-0 flex-column min-h-500">
        <div class="flex items-baseline">
            <div class="text-base">
                <div class="inline-block sc mr-2">Sortera:</div>
                {{ " " }}
                <ul class="part_header top_header mb-4 inline-block">
                    <li v-for="item in sortOptions" :key="item.key" class="inline-block sc">
                        <NuxtLink
                            v-slot="{ href }"
                            custom
                            :to="item.to"
                        ><a
                            :data-library-sort="item.key"
                            class="sort_item"
                            :class="{ active: item.active }"
                            :href="href || ''"
                            @click.prevent="emit('selectSort', item.key)"
                            >{{ item.label }}</a
                        ></NuxtLink>{{ " "
                        }}<i
                            v-if="item.active"
                            class="fa"
                            :class="sortReversed ? 'fa-caret-up' : 'fa-caret-down'"
                        />
                    </li>
                </ul>
            </div>
            <span class="sc ml-4">
                <span>{{ hide1800 ? "Visa även från:" : "Dölj verk:" }}</span
                >{{ " " }}
                <button
                    type="button"
                    data-library-hide-1800
                    class="text-primary sc ml-2 hover:text-gray-900 cursor-pointer bg-transparent border-0 p-0"
                    @click="emit('toggleHide1800')"
                >
                    Nya vägar till det förflutna
                </button>
            </span>
        </div>
        <div
            v-if="loading"
            data-library-loading
            class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0"
        >
            <i class="spinner fa fa-spinner fa-pulse" />
        </div>
        <div v-if="response.failed" data-library-error>Ett fel uppstod.</div>
        <div v-else-if="!response.groups.length" data-library-empty class="pb-4">
            Inga träffar.
        </div>
        <table v-else id="table" class="table w-full flex-grow -ml-2">
            <tbody class="block">
                <template v-for="group in response.groups" :key="group.imported">
                    <tr class="header grid grid-cols-1 w-full items-baseline">
                        <td class="type_header block">
                            <h3 data-library-latest-header class="row_title part_header">
                                {{ group.label }}
                            </h3>
                        </td>
                    </tr>
                    <tr
                        v-for="item in group.results"
                        :key="`${group.imported}:${item.titleId}:${item.titleHref}`"
                        data-library-latest-row
                        class="work_link grid w-full items-baseline transition-colors duration-150 hover:bg-gray-300 hover:bg-opacity-50 grid-cols-[minmax(0,1fr)_11rem] sm:grid-cols-[minmax(0,1fr)_7rem_11rem]"
                    >
                        <td class="block min-w-0">
                            <div
                                class="text-ellipsis whitespace-nowrap overflow-hidden min-w-0 items-center gap-2"
                            >
                                <div class="header_container min-w-0 flex-1 align-middle">
                                    <div
                                        class="header block overflow-hidden text-ellipsis whitespace-nowrap text-lg leading-tight"
                                    >
                                        <span class="title_inner">
                                            <NuxtLink
                                                v-library-tooltip="item.titleTooltip"
                                                :data-library-latest-title="item.titleId"
                                                data-library-tooltip-kind="title"
                                                :to="canonicalNuxtHref(item.titleHref)"
                                                >{{ item.title }}</NuxtLink
                                            >
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="text-left hidden sm:block w-28 text-base">
                            <NuxtLink
                                v-if="hasImprintYearTarget(item.year)"
                                data-library-imprint-year
                                class="text-current"
                                :to="imprintYearTo(item.year)"
                                >{{ item.year }}</NuxtLink
                            ><template v-else>{{ item.year }}</template>
                        </td>
                        <td class="block w-44 text-right">
                            <div class="text-ellipsis whitespace-nowrap overflow-hidden">
                                <span class="author uppercase text-sm">
                                    <NuxtLink
                                        v-library-tooltip="item.authorTooltip"
                                        data-library-tooltip-kind="author"
                                        :to="canonicalNuxtHref(item.authorHref)"
                                        >{{ item.surname }}</NuxtLink
                                    ><template v-if="item.roleSuffix"
                                        >{{ " "
                                        }}<span class="text-gray-700 sc">{{
                                            item.roleSuffix.trim()
                                        }}</span></template
                                    >
                                </span>
                            </div>
                        </td>
                    </tr>
                </template>
            </tbody>
        </table>
        <LibraryPagination
            v-if="pagination.pageCount > 1"
            :model="pagination"
            @select-page="emit('selectPage', $event)"
        />
    </div>
</template>
