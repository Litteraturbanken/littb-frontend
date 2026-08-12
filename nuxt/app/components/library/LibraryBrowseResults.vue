<script setup lang="ts">
import { computed, useId } from "vue"
import type { RouteLocationRaw } from "vue-router"
import { libraryTooltipDirective } from "../../directives/library-tooltip"
import { canonicalNuxtHref } from "../../lib/internal-navigation"
import {
    librarySortDirection,
    type LibraryBrowseMode,
    type LibraryImprintYearTarget,
    type LibraryNativeSortOption,
    type LibraryPaginationModel
} from "../../lib/library/component-models"
import type { BrowseSortKey } from "~/lib/library/navigation"
import type { BrowseResponse } from "~/lib/library/page-results"
import LibraryPagination from "./LibraryPagination.vue"

const props = defineProps<{
    mode: LibraryBrowseMode
    response: BrowseResponse
    expandedKey: string
    loading: boolean
    sortOptions: readonly LibraryNativeSortOption<BrowseSortKey>[]
    sortReversed: boolean
    pagination: LibraryPaginationModel
    imprintYearTargets: readonly LibraryImprintYearTarget[]
}>()
const emit = defineEmits<{
    selectSort: [sort: BrowseSortKey]
    selectPage: [page: number]
    toggleWork: [key: string]
}>()

const vLibraryTooltip = libraryTooltipDirective
const imprintYearTargetsByYear = computed(
    () => new Map(props.imprintYearTargets.map(target => [target.year, target.to]))
)
const sortDirectionId = `library-browse-sort-direction-${useId()}`

function hasImprintYearTarget(year: string): boolean {
    return imprintYearTargetsByYear.value.has(year)
}

function imprintYearTo(year: string): RouteLocationRaw {
    return imprintYearTargetsByYear.value.get(year)!
}

function workActionsId(key: string): string {
    return `library-work-actions-${encodeURIComponent(key)}`
}
</script>

<template>
    <div class="result title pl-0 flex-column min-h-500">
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
                        :aria-describedby="
                            item.active ? `${sortDirectionId}-${item.key}` : undefined
                        "
                        @click.prevent="emit('selectSort', item.key)"
                        >{{ item.label }}</a
                    ><template v-if="item.active"
                        ><span :id="`${sortDirectionId}-${item.key}`" class="sr-only"
                            >Aktiv sortering, {{ librarySortDirection(mode, item.key, sortReversed) }}</span
                        >{{ " "
                        }}<i aria-hidden="true" class="fa" :class="sortReversed ? 'fa-caret-up' : 'fa-caret-down'" />
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
        <template v-else>
            <div v-if="response.failed" data-library-error role="alert">Ett fel uppstod.</div>
            <div v-else-if="!response.data.length" data-library-empty class="pb-4">
                Inga träffar.
            </div>
            <table v-else-if="mode === 'works'" id="table" class="table w-full flex-grow -ml-2">
            <tbody class="block">
                <tr
                    v-for="item in response.data"
                    :key="item.key"
                    data-library-work-row
                    class="work_link grid w-full items-baseline transition-colors duration-150 hover:bg-gray-300 hover:bg-opacity-50 grid-cols-[minmax(0,1fr)_11rem] sm:grid-cols-[minmax(0,1fr)_7rem_11rem]"
                >
                    <td class="block min-w-0">
                        <div class="min-w-0 items-center gap-2">
                            <div class="header block text-lg leading-tight">
                                <span class="title_inner">
                                    <button
                                        v-library-tooltip="item.titleTooltip"
                                        type="button"
                                        data-library-work-toggle
                                        data-library-tooltip-kind="title"
                                        class="library-work-toggle"
                                        :aria-controls="workActionsId(item.key)"
                                        :aria-expanded="expandedKey === item.key"
                                        @click="emit('toggleWork', item.key)"
                                    >
                                        {{ item.title }}
                                    </button>
                                </span>
                            </div>
                        </div>
                        <div
                            v-show="expandedKey === item.key"
                            :id="workActionsId(item.key)"
                            data-library-work-actions
                            class="collapse-content"
                        >
                            <ul class="links">
                                <li
                                    v-for="(action, actionIndex) in item.actions"
                                    :key="`${action.kind}:${action.href}:${action.label}:${actionIndex}`"
                                >
                                    <a
                                        v-if="action.href && action.kind === 'download'"
                                        :href="action.href"
                                        target="_self"
                                        :download="action.downloadFilename"
                                        >{{ action.label }}</a
                                    >
                                    <NuxtLink v-else-if="action.href" :to="canonicalNuxtHref(action.href)">
                                        {{ action.label }}
                                    </NuxtLink>
                                    <span v-else>{{ action.label }}</span>
                                </li>
                            </ul>
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
                        <div class="min-w-0 whitespace-nowrap">
                            <span class="author uppercase text-sm flex min-w-0 justify-end">
                                <NuxtLink
                                    v-if="item.authorHref"
                                    v-library-tooltip="item.authorTooltip"
                                    data-library-tooltip-kind="author"
                                    class="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap align-bottom"
                                    :to="canonicalNuxtHref(item.authorHref)"
                                    >{{ item.surname }}</NuxtLink
                                ><span
                                    v-else
                                    v-library-tooltip="item.authorTooltip"
                                    data-library-tooltip-kind="author"
                                    class="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap align-bottom"
                                    >{{ item.surname }}</span
                                ><template v-if="item.roleSuffix"
                                    ><span class="shrink-0 text-gray-700 sc">&nbsp;{{
                                        item.roleSuffix.trim()
                                    }}</span></template
                                >
                            </span>
                        </div>
                    </td>
                </tr>
            </tbody>
            </table>
            <table v-else class="table flex-grow w-full">
            <tbody>
                <tr
                    v-for="item in response.data"
                    :key="item.key"
                    data-library-part-row
                    class="parts hover:bg-gray-300 hover:bg-opacity-80 transition-colors duration-150"
                >
                    <td class="title">
                        <span class="title_inner"
                            ><NuxtLink
                                v-if="item.titleHref"
                                v-library-tooltip="item.titleTooltip"
                                data-library-tooltip-kind="title"
                                :to="canonicalNuxtHref(item.titleHref)"
                                >{{ item.title }}</NuxtLink
                            ><span
                                v-else
                                v-library-tooltip="item.titleTooltip"
                                data-library-tooltip-kind="title"
                                >{{ item.title }}</span
                            ></span
                        >
                    </td>
                    <td class="hidden lg:table-cell w-28">
                        <NuxtLink
                            v-if="hasImprintYearTarget(item.year)"
                            data-library-imprint-year
                            class="text-current"
                            :to="imprintYearTo(item.year)"
                            >{{ item.year }}</NuxtLink
                        ><template v-else>{{ item.year }}</template>
                    </td>
                    <td class="text-right uppercase text-sm w-40">
                        <NuxtLink
                            v-if="item.authorHref"
                            v-library-tooltip="item.authorTooltip"
                            data-library-tooltip-kind="author"
                            :to="canonicalNuxtHref(item.authorHref)"
                            >{{ item.surname }}</NuxtLink
                        ><span
                            v-else
                            v-library-tooltip="item.authorTooltip"
                            data-library-tooltip-kind="author"
                            >{{ item.surname }}</span
                        ><template v-if="item.roleSuffix"
                            >{{ " "
                            }}<span class="text-xs text-gray-600">{{
                                item.roleSuffix.trim()
                            }}</span></template
                        >
                    </td>
                </tr>
            </tbody>
            </table>
            <LibraryPagination
                v-if="pagination.pageCount > 1"
                :model="pagination"
                @select-page="emit('selectPage', $event)"
            />
        </template>
    </div>
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
