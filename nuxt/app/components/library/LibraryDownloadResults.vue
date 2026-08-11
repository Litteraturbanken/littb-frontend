<script setup lang="ts">
import { computed } from "vue"
import type { RouteLocationRaw } from "vue-router"
import { libraryTooltipDirective } from "../../directives/library-tooltip"
import { canonicalNuxtHref } from "../../lib/internal-navigation"
import type {
    LibraryDownloadMode,
    LibraryImprintYearTarget,
    LibraryPaginationModel,
    LibrarySortOption
} from "~/lib/library/component-models"
import type { EpubSortKey } from "~/lib/library/navigation"
import type { EpubResponse } from "~/lib/library/page-results"
import LibraryPagination from "./LibraryPagination.vue"

const props = defineProps<{
    mode: LibraryDownloadMode
    response: EpubResponse
    sortOptions: readonly LibrarySortOption<EpubSortKey>[]
    sortReversed: boolean
    imprintYearTargets: readonly LibraryImprintYearTarget[]
    loading: boolean
    pagination: LibraryPaginationModel
}>()
const emit = defineEmits<{
    selectSort: [sort: EpubSortKey]
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
                            :href="href || ''"
                            class="sort_item"
                            :class="{ active: item.active }"
                            :data-library-sort="item.key"
                            @click.prevent="emit('selectSort', item.key)"
                            >{{ item.label }}</a
                        ></NuxtLink><template v-if="item.active"
                            >{{ " "
                            }}<i class="fa" :class="sortReversed ? 'fa-caret-up' : 'fa-caret-down'" />
                        </template>
                    </li>
                </ul>
            </div>
        </div>
        <div
            v-if="loading"
            data-library-loading
            class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0"
        >
            <i class="spinner fa fa-spinner fa-pulse" />
        </div>
        <div v-if="response.failed" data-library-error>Ett fel uppstod.</div>
        <div v-else-if="!response.data.length" data-library-empty class="pb-4">
            Inga träffar.
        </div>
        <table v-else id="table" class="table w-full flex-grow -ml-2">
            <tbody class="block">
                <tr
                    v-for="item in response.data"
                    :key="`${item.downloadHref}:${item.titleHref}`"
                    :data-library-epub-row="mode === 'epub' || undefined"
                    :data-library-pdf-row="mode === 'pdf' || undefined"
                    class="work_link grid w-full items-baseline transition-colors duration-150 hover:bg-gray-300 hover:bg-opacity-50 grid-cols-[minmax(0,1fr)_11rem_5rem] sm:grid-cols-[minmax(0,1fr)_7rem_11rem_5rem]"
                >
                    <td class="block min-w-0">
                        <div class="text-ellipsis whitespace-nowrap overflow-hidden min-w-0 items-center gap-2">
                            <div class="header_container min-w-0 flex-1 align-middle">
                                <div class="header block overflow-hidden text-ellipsis whitespace-nowrap text-lg leading-tight">
                                    <span class="title_inner">
                                        <NuxtLink v-slot="{ navigate }" :to="item.titleTo" custom>
                                            <a
                                                v-library-tooltip="item.titleTooltip"
                                                :data-library-epub-title="mode === 'epub' || undefined"
                                                :data-library-pdf-title="mode === 'pdf' || undefined"
                                                data-library-tooltip-kind="title"
                                                :href="canonicalNuxtHref(item.titleHref)"
                                                @click="navigate"
                                                >{{ item.title }}</a
                                            >
                                        </NuxtLink>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="text-left hidden sm:block w-28 text-base">
                        <span
                            :data-library-epub-year="mode === 'epub' || undefined"
                            :data-library-pdf-year="mode === 'pdf' || undefined"
                            ><NuxtLink
                                v-if="hasImprintYearTarget(item.year)"
                                data-library-imprint-year
                                class="text-current"
                                :to="imprintYearTo(item.year)"
                                >{{ item.year }}</NuxtLink
                            ><template v-else>{{ item.year }}</template></span
                        >
                    </td>
                    <td class="block w-44 text-left">
                        <div class="text-ellipsis whitespace-nowrap overflow-hidden">
                            <span class="author uppercase text-sm">
                                <NuxtLink
                                    v-library-tooltip="item.authorTooltip"
                                    :data-library-epub-author="mode === 'epub' || undefined"
                                    :data-library-pdf-author="mode === 'pdf' || undefined"
                                    data-library-tooltip-kind="author"
                                    :to="canonicalNuxtHref(item.authorHref)"
                                    >{{ item.surname }}</NuxtLink
                                ><template v-if="item.roleSuffix"
                                    >{{ " "
                                    }}<span class="text-gray-700 sc">{{ item.roleSuffix.trim() }}</span></template
                                >
                            </span>
                        </div>
                    </td>
                    <td class="block whitespace-nowrap w-20 text-right">
                        <a
                            :data-library-epub-download="mode === 'epub' || undefined"
                            :data-library-pdf-download="mode === 'pdf' || undefined"
                            class="sc block"
                            :href="item.downloadHref"
                            :download="item.downloadFilename"
                            target="_self"
                            >Hämta</a
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
    </div>
</template>
