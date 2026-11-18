<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue"
import type { LibraryPaginationModel } from "~/lib/library/component-models"

const props = withDefaults(defineProps<{
    model: LibraryPaginationModel
    compact?: boolean
    fitContainer?: boolean
}>(), { compact: undefined })
const emit = defineEmits<{ selectPage: [page: number] }>()
const narrow = ref(false)
const element = ref<HTMLElement | null>(null)
const sizing = ref<HTMLElement | null>(null)
const availableWidth = ref(Infinity)
const measuredWidths = ref<number[]>([])
let resizeObserver: ResizeObserver | null = null
let query: MediaQueryList | null = null
function syncWidth() { narrow.value = query?.matches ?? false }
onMounted(() => {
    if (typeof window.matchMedia !== "function") return
    query = window.matchMedia("(max-width: 767px)")
    syncWidth()
    query.addEventListener("change", syncWidth)
    resizeObserver = new ResizeObserver(observations => {
        for (const observation of observations) {
            if (observation.target === element.value) availableWidth.value = observation.contentRect.width
        }
        measuredWidths.value = Array.from(sizing.value?.children ?? [], row => row.getBoundingClientRect().width)
    })
    observePagination()
})
function observePagination() {
    resizeObserver?.disconnect()
    if (element.value) resizeObserver?.observe(element.value)
    for (const row of sizing.value?.children ?? []) resizeObserver?.observe(row)
}
onBeforeUnmount(() => { query?.removeEventListener("change", syncWidth); resizeObserver?.disconnect() })
const compactLayout = computed(() => (props.compact ?? narrow.value) || availableWidth.value < 520)
const preferredEntries = computed(() => compactLayout.value || availableWidth.value < (props.model.pageCount >= 1000 ? 850 : 700) ? props.model.compactEntries ?? props.model.entries : props.model.entries)
const entryOptions = computed(() => [...new Set([
    preferredEntries.value, props.model.compactEntries, props.model.minimumEntries
].filter(option => option !== undefined))])
watch([element, sizing, entryOptions], observePagination, { flush: "post" })
const entries = computed(() => {
    if (!props.fitContainer || measuredWidths.value.length !== entryOptions.value.length) return preferredEntries.value
    const fitting = measuredWidths.value.findIndex(width => width <= availableWidth.value)
    return entryOptions.value[fitting] ?? entryOptions.value.at(-1)
})
function select(event: MouseEvent, page: number) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    emit("selectPage", page)
}
</script>

<template>
    <nav v-if="model.pageCount > 1" ref="element" class="library-pagination" :class="{ compact: compactLayout }" aria-label="Sidnavigation">
        <ul class="pagination sc">
            <li class="direction previous" :class="{ disabled: model.previous === null }">
                <span v-if="model.previous === null" data-library-pagination-previous aria-label="Föregående" aria-disabled="true"><span aria-hidden="true">←</span><span v-if="!compactLayout"> Föregående</span></span>
                <NuxtLink v-else v-slot="{ href }" custom no-prefetch :to="model.previous"><a data-library-pagination-previous rel="prev" aria-label="Föregående" :href="href || ''" @click="select($event, model.currentPage - 1)"><span aria-hidden="true">←</span><span v-if="!compactLayout"> Föregående</span></a></NuxtLink>
            </li>
            <li v-for="item in entries" :key="item.key" :class="{ active: item.page === model.currentPage && !item.ellipsis, ellipsis: item.ellipsis }">
                <span v-if="item.ellipsis" data-library-pagination-ellipsis aria-hidden="true">…</span>
                <NuxtLink v-else v-slot="{ href }" custom no-prefetch :to="item.to"><a :data-library-page="item.page" :href="href || ''" :aria-label="`Sida ${item.page}`" :aria-current="item.page === model.currentPage ? 'page' : undefined" @click="select($event, item.page)">{{ item.label }}</a></NuxtLink>
            </li>
            <li class="direction next" :class="{ disabled: model.next === null }">
                <span v-if="model.next === null" data-library-pagination-next aria-label="Nästa" aria-disabled="true"><span v-if="!compactLayout">Nästa </span><span aria-hidden="true">→</span></span>
                <NuxtLink v-else v-slot="{ href }" custom no-prefetch :to="model.next"><a data-library-pagination-next rel="next" aria-label="Nästa" :href="href || ''" @click="select($event, model.currentPage + 1)"><span v-if="!compactLayout">Nästa </span><span aria-hidden="true">→</span></a></NuxtLink>
            </li>
        </ul>
    </nav>
    <div v-if="fitContainer && model.pageCount > 1" ref="sizing" class="pagination-sizing" :class="{ compact: compactLayout }" aria-hidden="true">
        <ul v-for="(option, index) in entryOptions" :key="index" class="pagination sc">
            <li><span><span>←</span><span v-if="!compactLayout"> Föregående</span></span></li>
            <li v-for="item in option" :key="item.key" :class="{ active: item.page === model.currentPage && !item.ellipsis, ellipsis: item.ellipsis }">
                <span>{{ item.ellipsis ? '…' : item.label }}</span>
            </li>
            <li><span><span v-if="!compactLayout">Nästa </span><span>→</span></span></li>
        </ul>
    </div>
</template>

<style scoped>
.library-pagination { max-width: 100%; }
.pagination-sizing {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    visibility: hidden;
}
.pagination-sizing .pagination {
    width: max-content;
    max-width: none;
    flex-wrap: nowrap;
    white-space: nowrap;
}
.pagination-sizing .pagination > .active > span { font-weight: bold; }
.pagination {
    display: flex;
    font-size: 16px;
    flex-wrap: wrap;
    align-items: center;
    gap: .2em;
    max-width: 100%;
    padding: 0;
    border-radius: 0;
}
.pagination > li { display: block; }
:is(.library-pagination, .pagination-sizing) .pagination > li > a,
:is(.library-pagination, .pagination-sizing) .pagination > li > span {
    display: block;
    float: none;
    min-width: 2em;
    margin: 0;
    padding: .4em .45em;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #7a1400;
    line-height: 1.2;
    text-align: center;
}
.pagination > li > a:hover { background: #eee; text-decoration: underline; }
.pagination > li > a:focus-visible { outline: 2px solid #7a1400; outline-offset: 1px; }
.library-pagination .pagination > .active > a,
.library-pagination .pagination > .active > a:hover,
.library-pagination .pagination > .active > a:focus { background: #7a1400; color: white !important; font-weight: bold; }
.pagination > .direction > a { text-decoration: underline; text-underline-offset: .15em; }
.pagination > .disabled > span { color: #777; }
.pagination > .ellipsis > span { min-width: 1em; padding-inline: .15em; color: #333; }
.compact .pagination { gap: .1em; font-size: 14px; }
.compact .pagination > li > a,
.compact .pagination > li > span { min-width: 24px; min-height: 40px; padding: .8em .3em; }
.compact .pagination > .ellipsis > span { min-width: .7em; padding-inline: .1em; }
</style>
