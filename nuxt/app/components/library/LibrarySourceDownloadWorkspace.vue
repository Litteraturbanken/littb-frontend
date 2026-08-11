<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import type { CSSProperties } from "vue"
import type { RouteLocationRaw } from "vue-router"
import { libraryTooltipDirective } from "../../directives/library-tooltip"
import { canonicalNuxtHref } from "../../lib/internal-navigation"
import type {
    LibraryImprintYearTarget,
    LibraryNativeSortOption,
    LibraryPaginationModel,
    LibrarySourceFormatGroup,
    LibrarySourceFormatKey
} from "~/lib/library/component-models"
import type { BrowseSortKey } from "~/lib/library/navigation"
import type { BrowseResponse } from "~/lib/library/page-results"
import type { BrowseResult } from "~/lib/library/view-model"
import LibraryPagination from "./LibraryPagination.vue"

const props = defineProps<{
    response: BrowseResponse
    loading: boolean
    sortOptions: readonly LibraryNativeSortOption<BrowseSortKey>[]
    sortReversed: boolean
    pagination: LibraryPaginationModel
    imprintYearTargets: readonly LibraryImprintYearTarget[]
}>()
const emit = defineEmits<{
    selectSort: [sort: BrowseSortKey]
    selectPage: [page: number]
}>()

const vLibraryTooltip = libraryTooltipDirective
const selectedSourceWorks = ref<Map<string, BrowseResult>>(new Map())
const selectedSourceFormats = ref<Set<LibrarySourceFormatKey>>(new Set())
const formatPopoverOpen = ref(false)
const formatButtonElement = ref<HTMLButtonElement | null>(null)
const formatPopoverElement = ref<HTMLDivElement | null>(null)
const formatPopoverScrollportElement = ref<HTMLDivElement | null>(null)
const formatPopoverPlacement = ref<"top" | "bottom">("top")
const formatPopoverStyle = ref<CSSProperties>({
    top: "0px",
    left: "0px",
    visibility: "hidden"
})
const formatPopoverScrollportStyle = ref<CSSProperties>({})
const sourceFormatGroups: readonly LibrarySourceFormatGroup[] = [
    {
        mediatype: "etext",
        label: "Etext",
        formats: [
            { key: "etext:txt", type: "txt", label: "ren text" },
            { key: "etext:xml", type: "xml", label: "xml" },
            { key: "etext:workdb", type: "workdb", label: "Metadata" }
        ]
    },
    {
        mediatype: "faksimil",
        label: "Faksimil",
        formats: [
            { key: "faksimil:txt", type: "txt", label: "ren text" },
            { key: "faksimil:xml", type: "xml", label: "xml" },
            { key: "faksimil:workdb", type: "workdb", label: "Metadata" },
            { key: "faksimil:pdf", type: "pdf", label: "PDF" }
        ]
    }
]

const imprintYearTargetsByYear = computed(
    () => new Map(props.imprintYearTargets.map(target => [target.year, target.to]))
)
const visibleSourceWorks = computed(() =>
    props.response.data.filter(item => item.sourceExports.length > 0)
)
const selectedSourceWorkList = computed(() => [...selectedSourceWorks.value.values()])
const allVisibleSourceWorksSelected = computed(
    () =>
        visibleSourceWorks.value.length > 0
        && visibleSourceWorks.value.every(item => selectedSourceWorks.value.has(item.key))
)
const selectedSourceExports = computed(() =>
    selectedSourceWorkList.value.flatMap(item => item.sourceExports)
)
const sourceFormatAvailability = computed(() => {
    const counts = new Map<LibrarySourceFormatKey, number>()
    for (const item of selectedSourceExports.value) {
        const key = sourceFormatKey(item.mediatype, item.type)
        if (!key) continue
        counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
})
const selectedDownloadExports = computed(() =>
    selectedSourceExports.value.filter(item => {
        const key = sourceFormatKey(item.mediatype, item.type)
        return key !== null && selectedSourceFormats.value.has(key)
    })
)
const selectedDownloadFiles = computed(() =>
    selectedDownloadExports.value
        .map(item => `${item.lbworkid}-${item.mediatype}-${item.type}`)
        .filter((token, index, all) => all.indexOf(token) === index)
)
const downloadSizeLabel = computed(() => {
    const size = selectedDownloadExports.value.reduce((sum, item) => sum + item.size, 0)
    if (!size) return ""
    return size < 1_050_000
        ? `${Math.round(size / 1024)} KB`
        : `${(size / (1024 * 1024)).toFixed(2)}MB`
})

watch(
    () => props.response.data,
    results => {
        const refreshedWorks = new Map(
            results
                .filter(item => item.sourceExports.length > 0)
                .map(item => [item.key, item] as const)
        )
        const reconciled = new Map<string, BrowseResult>()
        for (const key of selectedSourceWorks.value.keys()) {
            const refreshed = refreshedWorks.get(key)
            if (refreshed) reconciled.set(key, refreshed)
        }
        selectedSourceWorks.value = reconciled

        const availableFormats = new Set<LibrarySourceFormatKey>()
        for (const work of reconciled.values()) {
            for (const item of work.sourceExports) {
                const key = sourceFormatKey(item.mediatype, item.type)
                if (key) availableFormats.add(key)
            }
        }
        const reconciledFormats = new Set(
            [...selectedSourceFormats.value].filter(key => availableFormats.has(key))
        )
        if (reconciledFormats.size !== selectedSourceFormats.value.size) {
            selectedSourceFormats.value = reconciledFormats
        }
    }
)

function sourceFormatKey(
    mediatype: BrowseResult["sourceExports"][number]["mediatype"],
    type: BrowseResult["sourceExports"][number]["type"]
): LibrarySourceFormatKey | null {
    if (mediatype === "etext") {
        if (type === "txt") return "etext:txt"
        if (type === "xml") return "etext:xml"
        if (type === "workdb") return "etext:workdb"
        return null
    }
    if (mediatype !== "faksimil") return null
    if (type === "txt") return "faksimil:txt"
    if (type === "xml") return "faksimil:xml"
    if (type === "workdb") return "faksimil:workdb"
    if (type === "pdf") return "faksimil:pdf"
    return null
}

function hasImprintYearTarget(year: string): boolean {
    return imprintYearTargetsByYear.value.has(year)
}

function imprintYearTo(year: string): RouteLocationRaw {
    return imprintYearTargetsByYear.value.get(year)!
}

function workActionsId(key: string): string {
    return `library-work-actions-${encodeURIComponent(key)}`
}

function clearSourceSelection() {
    selectedSourceWorks.value = new Map()
    selectedSourceFormats.value = new Set()
    formatPopoverOpen.value = false
}

function positionFormatPopover() {
    if (!formatPopoverOpen.value) return
    const button = formatButtonElement.value
    const popover = formatPopoverElement.value
    const scrollport = formatPopoverScrollportElement.value
    if (!button || !popover || !scrollport) return
    const buttonBox = button.getBoundingClientRect()
    const popoverBox = popover.getBoundingClientRect()
    const viewportPadding = 8
    const triggerGap = 10
    const popoverChromeHeight = popoverBox.height - scrollport.clientHeight
    const naturalHeight = scrollport.scrollHeight + popoverChromeHeight
    const availableAbove = Math.max(0, buttonBox.top - triggerGap - viewportPadding)
    const availableBelow = Math.max(
        0,
        window.innerHeight - buttonBox.bottom - triggerGap - viewportPadding
    )
    const placement = naturalHeight <= availableAbove || availableAbove >= availableBelow
        ? "top"
        : "bottom"
    const availableHeight = placement === "top" ? availableAbove : availableBelow
    const boundedScrollportHeight = Math.max(0, availableHeight - popoverChromeHeight)
    const renderedHeight = Math.min(naturalHeight, availableHeight)
    const viewportTop = placement === "top"
        ? buttonBox.top - triggerGap - renderedHeight
        : buttonBox.bottom + triggerGap
    const buttonWidth = Math.round(buttonBox.width)
    const centeredLeft = buttonBox.left + buttonWidth / 2 - popoverBox.width / 2
    const maximumLeft = Math.max(
        viewportPadding,
        window.innerWidth - popoverBox.width - viewportPadding
    )
    const viewportLeft = Math.min(Math.max(centeredLeft, viewportPadding), maximumLeft)
    formatPopoverPlacement.value = placement
    formatPopoverStyle.value = {
        top: `${Math.round(window.scrollY + viewportTop)}px`,
        left: `${Math.round(window.scrollX + viewportLeft)}px`,
        visibility: "visible",
        marginTop: "0px"
    }
    formatPopoverScrollportStyle.value = {
        maxHeight: `${Math.floor(boundedScrollportHeight)}px`,
        overflowY: naturalHeight > availableHeight ? "auto" : "visible"
    }
}

async function toggleFormatPopover() {
    if (formatPopoverOpen.value) {
        formatPopoverOpen.value = false
        return
    }
    formatPopoverStyle.value = {
        top: "0px",
        left: "0px",
        visibility: "hidden",
        marginTop: "0px"
    }
    formatPopoverScrollportStyle.value = {}
    formatPopoverOpen.value = true
    await nextTick()
    positionFormatPopover()
    await nextTick()
    const popover = formatPopoverElement.value
    const focusTarget = popover?.querySelector<HTMLElement>(
        "[data-library-source-format]:not(:disabled)"
    ) ?? popover?.querySelector<HTMLElement>("[data-library-download-submit]:not(:disabled)") ?? popover
    focusTarget?.focus()
}

function handleFormatPopoverKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !formatPopoverOpen.value) return
    event.preventDefault()
    formatPopoverOpen.value = false
    void nextTick(() => formatButtonElement.value?.focus())
}

function toggleSourceWork(item: BrowseResult) {
    if (item.sourceExports.length === 0) return
    const selected = new Map(selectedSourceWorks.value)
    if (selected.has(item.key)) selected.delete(item.key)
    else selected.set(item.key, item)
    selectedSourceWorks.value = selected
}

function selectVisibleSourceWorks() {
    const selected = new Map(selectedSourceWorks.value)
    for (const item of visibleSourceWorks.value) selected.set(item.key, item)
    selectedSourceWorks.value = selected
}

function deselectVisibleSourceWorks() {
    const selected = new Map(selectedSourceWorks.value)
    for (const item of visibleSourceWorks.value) selected.delete(item.key)
    selectedSourceWorks.value = selected
}

defineExpose({
    allVisibleSourceWorksSelected,
    selectVisibleSourceWorks,
    deselectVisibleSourceWorks
})

function toggleSourceFormat(key: LibrarySourceFormatKey) {
    if (!sourceFormatAvailability.value.get(key)) return
    const selected = new Set(selectedSourceFormats.value)
    if (selected.has(key)) selected.delete(key)
    else selected.add(key)
    selectedSourceFormats.value = selected
}

onMounted(() => {
    document.addEventListener("keydown", handleFormatPopoverKeydown)
    window.addEventListener("resize", positionFormatPopover)
    window.addEventListener("scroll", positionFormatPopover, true)
})
onUnmounted(() => {
    clearSourceSelection()
    document.removeEventListener("keydown", handleFormatPopoverKeydown)
    window.removeEventListener("resize", positionFormatPopover)
    window.removeEventListener("scroll", positionFormatPopover, true)
})
</script>

<template>
    <div class="bg-white/65 lg:p-6 p-2 lg:border border-gray-900 flex-grow">
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
                            @click.prevent="emit('selectSort', item.key)"
                            >{{ item.label }}</a
                        ><template v-if="item.active"
                            >{{ " "
                            }}<i class="fa" :class="sortReversed ? 'fa-caret-up' : 'fa-caret-down'" />
                        </template>
                    </li>
                </ul>
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
                        :key="item.key"
                        data-library-work-row
                        class="work_link grid w-full items-baseline transition-colors duration-150 hover:bg-gray-300 hover:bg-opacity-50 grid-cols-[minmax(0,1fr)_11rem] sm:grid-cols-[minmax(0,1fr)_7rem_11rem]"
                        @click="toggleSourceWork(item)"
                    >
                        <td class="block min-w-0">
                            <div class="min-w-0 items-center gap-2 flex">
                                <input
                                    data-library-source-checkbox
                                    class="align-middle shrink-0 relative z-10"
                                    type="checkbox"
                                    :checked="selectedSourceWorks.has(item.key)"
                                    :disabled="item.sourceExports.length === 0"
                                    :aria-label="`Välj ${item.title}`"
                                    @click.stop
                                    @change="toggleSourceWork(item)"
                                >
                                <div class="header block text-lg leading-tight min-w-0 flex-1">
                                    <span class="title_inner">
                                        <button
                                            v-library-tooltip="item.titleTooltip"
                                            type="button"
                                            data-library-work-toggle
                                            data-library-tooltip-kind="title"
                                            class="library-work-toggle"
                                            :aria-pressed="selectedSourceWorks.has(item.key)"
                                            :disabled="item.sourceExports.length === 0"
                                            @click.stop="toggleSourceWork(item)"
                                        >
                                            {{ item.title }}
                                        </button>
                                    </span>
                                </div>
                            </div>
                            <div
                                v-show="false"
                                :id="workActionsId(item.key)"
                                data-library-work-actions
                                class="collapse-content"
                            >
                                <ul class="links">
                                    <li
                                        v-for="action in item.actions"
                                        :key="`${action.kind}:${action.href}`"
                                    >
                                        <a
                                            v-if="action.kind === 'download'"
                                            :href="action.href"
                                            target="_self"
                                            :download="action.downloadFilename"
                                            >{{ action.label }}</a
                                        >
                                        <NuxtLink v-else :to="canonicalNuxtHref(action.href)">
                                            {{ action.label }}
                                        </NuxtLink>
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
                                        v-library-tooltip="item.authorTooltip"
                                        data-library-tooltip-kind="author"
                                        class="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap align-bottom"
                                        :to="canonicalNuxtHref(item.authorHref)"
                                        >{{ item.surname }}</NuxtLink
                                    ><template v-if="item.roleSuffix"
                                        ><span class="shrink-0 text-gray-700 sc"
                                            >&nbsp;{{ item.roleSuffix.trim() }}</span
                                        ></template
                                    >
                                </span>
                            </div>
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
    </div>
    <div>
        <div class="dl ml-4 p-4 sticky flex flex-col overflow-auto">
            <h3 class="uppercase text-xl mt-2 mb-2">Valda verk</h3>
            <div class="footer">
            <button
                type="button"
                data-library-clear-downloads
                class="btn text-sm mb-4"
                :disabled="selectedSourceWorkList.length === 0"
                @click="clearSourceSelection"
            >
                Rensa
            </button>
            {{ " " }}
            <button
                ref="formatButtonElement"
                type="button"
                data-library-format-button
                class="btn text-sm mb-4"
                :disabled="selectedSourceWorkList.length === 0"
                aria-haspopup="dialog"
                aria-controls="library-format-popover"
                :aria-expanded="formatPopoverOpen"
                @click="toggleFormatPopover"
            >
                Välj format <i class="fa fa-download ml-2" />
            </button>

            <Teleport to="body">
                <div
                    v-if="formatPopoverOpen"
                    id="library-format-popover"
                    ref="formatPopoverElement"
                    data-library-format-popover
                    class="popover block bg-white border border-gray-700"
                    :class="formatPopoverPlacement"
                    role="dialog"
                    tabindex="-1"
                    aria-label="Välj format"
                    :style="formatPopoverStyle"
                >
                    <div class="arrow" aria-hidden="true" />
                    <div
                        ref="formatPopoverScrollportElement"
                        data-library-format-scrollport
                        :style="formatPopoverScrollportStyle"
                    >
                        <div class="text-sm italic">
                            {{ sourceFormatAvailability.get("etext:workdb") ?? 0 }}
                            etext<span
                                v-if="(sourceFormatAvailability.get('etext:workdb') ?? 0) !== 1"
                                >er</span
                            >
                            vald<span
                                v-if="(sourceFormatAvailability.get('etext:workdb') ?? 0) !== 1"
                                >a</span
                            >,
                            {{ sourceFormatAvailability.get("faksimil:workdb") ?? 0 }}
                            faksimil<span
                                v-if="(sourceFormatAvailability.get('faksimil:workdb') ?? 0) !== 1"
                                >er</span
                            >
                            vald<span
                                v-if="(sourceFormatAvailability.get('faksimil:workdb') ?? 0) !== 1"
                                >a</span
                            >
                        </div>
                        <div class="flex justify-between w-64">
                            <div
                                v-for="group in sourceFormatGroups"
                                :key="group.mediatype"
                                :class="group.mediatype === 'etext' ? 'mr-4' : 'mx-2'"
                            >
                                <h3 class="uppercase text-base">{{ group.label }}</h3>
                                <ul class="checks">
                                    <li
                                        v-for="format in group.formats"
                                        :key="format.type"
                                        class="whitespace-nowrap"
                                    >
                                        <input
                                            :id="`source-${group.mediatype}-${format.type}`"
                                            :data-library-source-format="format.key"
                                            type="checkbox"
                                            class="mb-1 mr-1"
                                            :checked="selectedSourceFormats.has(format.key)"
                                            :disabled="!(sourceFormatAvailability.get(format.key) ?? 0)"
                                            @change="toggleSourceFormat(format.key)"
                                        >
                                        <label
                                            class="capitalize"
                                            :class="{
                                                'text-gray-500': !(
                                                    sourceFormatAvailability.get(format.key) ?? 0
                                                )
                                            }"
                                            :for="`source-${group.mediatype}-${format.type}`"
                                            >{{ format.label }}</label
                                        >
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <form
                            action="/api/download"
                            method="POST"
                            class="mt-8 mb-4 flex justify-between"
                        >
                            <input
                                type="hidden"
                                name="files"
                                :value="selectedDownloadFiles.join(',')"
                            >
                            <span
                                data-library-download-size
                                class="text-sm self-center"
                                >{{ downloadSizeLabel }}</span
                            >
                            <button
                                type="submit"
                                data-library-download-submit
                                class="btn text-xs pull-right"
                                :disabled="selectedDownloadFiles.length === 0"
                            >
                                Hämta <i class="fa fa-download ml-2" />
                            </button>
                        </form>
                    </div>
                </div>
            </Teleport>

                <ul class="mt-2 mb-2 flex-grow">
                    <li v-for="item in selectedSourceWorkList" :key="item.key">
                        <button
                            type="button"
                            data-library-selected-work
                            class="download_item hover:line-through bg-transparent border-0 p-0 text-left"
                            @click="toggleSourceWork(item)"
                        >
                            <span class="sc">{{ item.surname }}</span> {{ item.title }}
                        </button>
                    </li>
                </ul>
            </div>
        </div>
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

[data-library-format-popover] {
    width: 288px;
    padding: 14px;
}
</style>
