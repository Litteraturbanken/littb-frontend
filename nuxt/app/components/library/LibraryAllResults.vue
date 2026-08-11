<script setup lang="ts">
import { computed } from "vue"
import type { RouteLocationRaw } from "vue-router"
import { canonicalNuxtHref, isNuxtInternalHref } from "../../lib/internal-navigation"
import type {
    LibraryImprintYearTarget,
    LibraryPaginationModel,
    LibrarySortOption
} from "~/lib/library/component-models"
import type { RelevanceSortKey } from "~/lib/library/navigation"
import type { LibraryResponse } from "~/lib/library/page-results"
import LibraryPagination from "./LibraryPagination.vue"

const props = defineProps<{
    response: LibraryResponse
    sortOptions: readonly LibrarySortOption<RelevanceSortKey>[]
    sortReversed: boolean
    imprintYearTargets: readonly LibraryImprintYearTarget[]
    loading: boolean
    pagination: LibraryPaginationModel
}>()
const emit = defineEmits<{
    selectSort: [sort: RelevanceSortKey]
    selectPage: [page: number]
}>()

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
    <div class="result relevance pl-0 lg:ml-3 w-full lg:w-auto">
        <div class="text-base">
            <div class="inline-block sc mr-2">Sortera:</div>
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
                    ></NuxtLink>
                    <i
                        v-if="item.active"
                        class="fa"
                        :class="sortReversed ? 'fa-caret-up' : 'fa-caret-down'"
                    />
                </li>
            </ul>
        </div>
        <div
            v-if="loading"
            class="flex justify-center items-center spinner_row ng-fade transition duration-200 h-0"
        >
            <i class="spinner fa fa-spinner fa-pulse" />
        </div>
        <div v-else>
            <div v-if="response.failed" data-library-error>Ett fel uppstod.</div>
            <div v-else-if="!response.data.length" data-library-empty class="pb-4">
                Inga träffar.
            </div>
            <table v-else class="w-full -ml-4">
                <tbody>
                    <tr
                        v-for="(item, index) in response.data"
                        :key="`${item.index}:${item.primaryHref}:${index}`"
                        data-library-result
                        class="lg:table-row flex flex-col justify-between pb-2 lg:pb-0 -ml-2 hover:bg-gray-300 hover:bg-opacity-80 transition-colors duration-150"
                    >
                        <td class="lg:text-right lg:table-cell w-44">
                            <span class="sc primarycolor whitespace-nowrap text-base">{{
                                item.sourceLabel
                            }}</span>
                        </td>
                        <td class="order-2 min-w-0">
                            <a
                                v-if="item.download || !isNuxtInternalHref(item.primaryHref)"
                                :href="item.primaryHref"
                                :download="item.download || undefined"
                                :data-library-author-name="item.index === 'author' || undefined"
                                :data-library-result-title="item.fullTitle ? '' : undefined"
                                :title="
                                    item.fullTitle && item.fullTitle !== item.primaryLabel
                                        ? item.fullTitle
                                        : undefined
                                "
                                :class="
                                    item.fullTitle
                                        ? 'block max-w-[calc(100vw-2rem)] lg:max-w-[32rem] whitespace-nowrap overflow-hidden text-ellipsis'
                                        : undefined
                                "
                            >
                                <template v-if="item.index === 'author'">
                                    <span class="surname">{{ item.authorSurname }}</span
                                    ><span v-if="item.authorGivenNames">,</span>
                                    {{ item.authorGivenNames }}
                                    <span
                                        v-if="item.mobileYearLabel"
                                        data-library-author-mobile-years
                                        class="lg:hidden"
                                        >{{ item.mobileYearLabel }}</span
                                    >
                                </template>
                                <template v-else>{{ item.primaryLabel }}</template>
                            </a>
                            <NuxtLink
                                v-else
                                :to="canonicalNuxtHref(item.primaryHref)"
                                :data-library-author-name="item.index === 'author' || undefined"
                                :data-library-result-title="item.fullTitle ? '' : undefined"
                                :title="
                                    item.fullTitle && item.fullTitle !== item.primaryLabel
                                        ? item.fullTitle
                                        : undefined
                                "
                                :class="
                                    item.fullTitle
                                        ? 'block max-w-[calc(100vw-2rem)] lg:max-w-[32rem] whitespace-nowrap overflow-hidden text-ellipsis'
                                        : undefined
                                "
                            >
                                <template v-if="item.index === 'author'">
                                    <span class="surname">{{ item.authorSurname }}</span
                                    ><span v-if="item.authorGivenNames">,</span>
                                    {{ item.authorGivenNames }}
                                    <span
                                        v-if="item.mobileYearLabel"
                                        data-library-author-mobile-years
                                        class="lg:hidden"
                                        >{{ item.mobileYearLabel }}</span
                                    >
                                </template>
                                <template v-else>{{ item.primaryLabel }}</template>
                            </NuxtLink>
                            <ul v-if="item.highlights.length" class="highlight list-none p-0 m-0">
                                <li
                                    v-for="(fragment, fragmentIndex) in item.highlights"
                                    :key="fragmentIndex"
                                    data-library-highlight
                                    class="text-xs relative z-10"
                                >
                                    {{ "”… "
                                    }}<template
                                        v-for="(segment, segmentIndex) in fragment.segments"
                                        :key="segmentIndex"
                                        ><em
                                            v-if="segment.hit"
                                            data-library-highlight-hit
                                            class="hit"
                                            >{{ segment.text }}</em
                                        ><template v-else>{{ segment.text }}</template></template
                                    >{{ " …”" }}
                                </li>
                            </ul>
                        </td>
                        <td
                            class="lg:text-right hidden lg:table-cell text-base w-28 whitespace-nowrap"
                        >
                            <NuxtLink
                                v-if="
                                    item.index !== 'author' &&
                                    hasImprintYearTarget(item.yearLabel)
                                "
                                data-library-imprint-year
                                class="text-current"
                                :to="imprintYearTo(item.yearLabel)"
                                >{{ item.yearLabel }}</NuxtLink
                            ><template v-else>{{ item.yearLabel }}</template>
                        </td>
                        <td
                            class="lg:text-right lg:uppercase lg:text-sm lg:pl-4 order-1 lg:max-w-40"
                        >
                            <NuxtLink
                                v-if="item.authorHref"
                                :to="canonicalNuxtHref(item.authorHref)"
                                >{{ item.secondaryAuthor }}</NuxtLink
                            >
                            <span v-else class="text-gray-800">{{ item.secondaryAuthor }}</span>
                            <span
                                v-if="item.authorContribution"
                                data-library-author-contribution
                                class="text-gray-600 text-xs"
                                >{{ item.authorContribution }}</span
                            >
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <LibraryPagination
            v-if="pagination.pageCount > 1"
            :model="pagination"
            @select-page="emit('selectPage', $event)"
        />
    </div>
</template>
