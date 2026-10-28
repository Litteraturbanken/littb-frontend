<script setup lang="ts">
import { computed } from "vue"
import { Listbox, ListboxButton, ListboxLabel, ListboxOption, ListboxOptions } from "@headlessui/vue"
import type {
    LibraryAdvancedChange,
    LibraryAdvancedControlsModel
} from "~/lib/library/component-models"
import type { LibraryCategory, LibraryLanguage, LibraryMedia } from "~/lib/library/filter-options"
import ChronologyRangeSlider from "../global/ChronologyRangeSlider.vue"
import SearchMultiSelect from "../search/SearchMultiSelect.vue"

// Animate the measured panel rather than a fixed max-height, so content and
// mobile layouts keep their natural size and dropdowns are unclipped at rest.
const panelMotion = new WeakMap<HTMLElement, Animation>()
const panelSpacing = new WeakMap<HTMLElement, { marginTop: string, marginBottom: string }>()
function cancelPanelMotion(element: Element): void {
    const panel = element as HTMLElement
    const animation = panelMotion.get(panel)
    if (!animation) return
    const current = getComputedStyle(panel)
    panel.style.height = `${panel.getBoundingClientRect().height}px`
    panel.style.opacity = current.opacity
    panel.style.marginTop = current.marginTop
    panel.style.marginBottom = current.marginBottom
    animation.cancel()
    panelMotion.delete(panel)
}
function animatePanel(element: Element, done: () => void, entering: boolean): void {
    const panel = element as HTMLElement
    panel.inert = !entering
    if (typeof panel.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        done()
        return
    }
    const style = getComputedStyle(panel)
    const interrupted = panel.style.height !== ""
    if (!panelSpacing.has(panel)) panelSpacing.set(panel, { marginTop: style.marginTop, marginBottom: style.marginBottom })
    const expanded = { height: `${panel.scrollHeight}px`, opacity: 1, ...panelSpacing.get(panel)! }
    const collapsed = { height: "0px", opacity: 0, marginTop: "0px", marginBottom: "0px" }
    const current = {
        height: `${panel.getBoundingClientRect().height}px`, opacity: style.opacity,
        marginTop: style.marginTop, marginBottom: style.marginBottom
    }
    panel.style.overflow = "hidden"
    const animation = panel.animate(
        [entering && !interrupted ? collapsed : current, entering ? expanded : collapsed],
        { duration: entering ? 180 : 140, easing: entering ? "cubic-bezier(.2,.7,.2,1)" : "ease-in", fill: "both" }
    )
    panelMotion.set(panel, animation)
    animation.onfinish = () => {
        panelMotion.delete(panel)
        panelSpacing.delete(panel)
        animation.cancel()
        for (const property of ["height", "opacity", "overflow", "margin-top", "margin-bottom"]) panel.style.removeProperty(property)
        done()
    }
}

type ChronologyEndpoint = "from" | "to"

const props = defineProps<{
    model: LibraryAdvancedControlsModel
}>()
const emit = defineEmits<{
    change: [change: LibraryAdvancedChange]
    "reset-chronology": []
    "toggle-download-mode": []
    "select-visible-source-works": []
    "deselect-visible-source-works": []
}>()
const genderOptions = [
    { value: "", label: "Alla författare" },
    { value: "female", label: "Kvinnliga författare" },
    { value: "male", label: "Manliga författare" }
] as const
const genderLabel = computed(() => props.model.gender
    ? genderOptions.find(option => option.value === props.model.gender)?.label
    : "Filtrera: kvinnliga / manliga / alla")

const narrowingSelectGroups = computed(() =>
    props.model.collectionSelectGroups.map(group => ({
        ...group,
        options: group.options.map(option => ({
            ...option,
            disabled: props.model.keywords.includes(option.value)
        }))
    }))
)

function inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value
}

function emitGender(value: string): void {
    if (value !== "" && value !== "female" && value !== "male") return
    emit("change", { field: "gender", value })
}

function emitKeywords(value: readonly string[]): void {
    emit("change", { field: "keywords", value: value as readonly LibraryCategory[] })
}

function emitNarrowingKeywords(value: readonly string[]): void {
    emit("change", {
        field: "narrowingKeywords",
        value: value as readonly LibraryCategory[]
    })
}

function emitAboutAuthors(value: readonly string[]): void {
    emit("change", { field: "aboutAuthorIds", value })
}

function emitMedia(value: readonly string[]): void {
    emit("change", { field: "media", value: value as readonly LibraryMedia[] })
}

function emitLanguages(value: readonly string[]): void {
    emit("change", { field: "languages", value: value as readonly LibraryLanguage[] })
}

function draftValues(
    endpoint: ChronologyEndpoint,
    value: string
): readonly [string, string] | null {
    const chronology = props.model.chronology
    if (!chronology) return null
    return endpoint === "from" ? [value, chronology.to] : [chronology.from, value]
}

function rangeValues(
    endpoint: ChronologyEndpoint,
    value: string
): readonly [string, string] | null {
    const chronology = props.model.chronology
    if (!chronology) return null
    const numeric = Number(value)
    if (endpoint === "from") {
        const to = Number(chronology.to)
        return [String(Number.isFinite(to) ? Math.min(numeric, to) : numeric), chronology.to]
    }
    const from = Number(chronology.from)
    return [chronology.from, String(Number.isFinite(from) ? Math.max(numeric, from) : numeric)]
}

function emitChronologyDraft(endpoint: ChronologyEndpoint, value: string): void {
    const draft = draftValues(endpoint, value)
    if (!draft) return
    emit("change", { field: "chronologyDraft", from: draft[0], to: draft[1] })
}

function emitChronologyRange(endpoint: ChronologyEndpoint, value: string): void {
    const range = rangeValues(endpoint, value)
    if (!range) return
    emit("change", {
        field: "chronologyRange",
        value: [Number(range[0]), Number(range[1])]
    })
}
</script>

<template>
    <Transition
        :css="false"
        @enter="(element, done) => animatePanel(element, done, true)"
        @leave="(element, done) => animatePanel(element, done, false)"
        @enter-cancelled="cancelPanelMotion"
        @leave-cancelled="cancelPanelMotion"
    >
    <div
        v-if="model.advancedOpen"
        id="library-advanced-panel"
        data-library-advanced-panel
        class="more_container show_more mt-2 mb-4"
    >
        <div class="title_select_container">
            <Listbox
                v-slot="{ open }"
                :model-value="model.gender"
                @update:model-value="emitGender"
            >
                <div
                    class="library-gender-control select2-container select2-container--default"
                    :class="{ 'select2-container--open': open }"
                >
                    <ListboxLabel class="sr-only">Författarkön</ListboxLabel>
                    <ListboxButton
                        data-library-gender
                        data-library-gender-visual
                        :value="model.gender"
                        class="select2-selection select2-selection--single"
                    >
                        <span
                            class="select2-selection__rendered"
                            :title="model.gender === '' ? 'Alla författare' : undefined"
                        >{{ genderLabel }}</span>
                        <span class="select2-selection__arrow" aria-hidden="true"><b /></span>
                    </ListboxButton>
                    <ListboxOptions class="library-gender-options select2-dropdown select2-dropdown--below">
                        <ListboxOption
                            v-for="option in genderOptions"
                            :key="option.value"
                            v-slot="{ active }"
                            :value="option.value"
                            as="template"
                        >
                            <li
                                class="select2-results__option"
                                :class="{ 'select2-results__option--highlighted': active }"
                            >{{ option.label }}</li>
                        </ListboxOption>
                    </ListboxOptions>
                </div>
            </Listbox>
        </div>
        <div class="title_select_container">
            <SearchMultiSelect
                data-library-keywords
                class="keyword_select"
                persistent-input-row
                accessible-name="Filtrera: Kategorier / Utgivare"
                :model-value="model.keywords"
                :options="model.collectionSelectOptions"
                :option-groups="model.collectionSelectGroups"
                :space-after-remove="false"
                searchable
                internal-search
                placeholder="Filtrera: Kategorier / Utgivare"
                @update:model-value="emitKeywords"
            />
        </div>
        <div
            v-if="!model.standalone && model.aboutAuthorOptions.length"
            class="title_select_container about_container"
        >
            <SearchMultiSelect
                data-library-about-authors
                class="about_select"
                accessible-name="Om ett författarskap"
                :model-value="model.aboutAuthorIds"
                :options="
                    model.aboutAuthorOptions.map(author => ({
                        value: author.id,
                        label: author.label
                    }))
                "
                placeholder="Om ett författarskap"
                searchable
                internal-search
                persistent-input-row
                @update:model-value="emitAboutAuthors"
            />
        </div>
        <div v-if="!model.standalone">
            <div class="text-sm mb-4 max-w-sm">
                Får du för många träffar? Välj ytterligare samlingar (en eller flera) i menyn
                <span class="sc">AVGRÄNSA SÖKNINGEN</span> här nedanför. Ju fler samlingar du
                väljer, desto färre sökträffar får du.
            </div>
            <SearchMultiSelect
                data-library-narrowing
                class="keyword_select block"
                persistent-input-row
                accessible-name="Avgränsa sökningen"
                :model-value="model.narrowingKeywords"
                :options="model.collectionSelectOptions"
                :option-groups="narrowingSelectGroups"
                :space-after-remove="false"
                searchable
                internal-search
                placeholder="Avgränsa sökningen"
                @update:model-value="emitNarrowingKeywords"
            />
        </div>
        <div v-if="!model.standalone" class="title_select_container">
            <SearchMultiSelect
                data-library-media
                class="keyword_select"
                persistent-input-row
                accessible-name="Utgivningsformat"
                :model-value="model.media"
                :options="model.mediaSelectOptions"
                :space-after-remove="false"
                searchable
                internal-search
                placeholder="Utgivningsformat"
                @update:model-value="emitMedia"
            />
        </div>
        <div class="title_select_container">
            <SearchMultiSelect
                data-library-languages
                class="keyword_select"
                persistent-input-row
                accessible-name="Språk …"
                :model-value="model.languages"
                :options="model.languageSelectOptions"
                :space-after-remove="false"
                searchable
                internal-search
                placeholder="Språk …"
                @update:model-value="emitLanguages"
            />
        </div>
        <div
            v-if="!model.standalone"
            class="more ml-[2px] relative"
            :class="{ show_more: model.downloadMode }"
        >
            <button
                type="button"
                data-library-download-mode
                class="library-download-mode-toggle sc btn btn-small"
                :aria-pressed="model.downloadMode"
                @click="emit('toggle-download-mode')"
            >
                <i class="fa fa-download mr-1 text-xs" aria-hidden="true" />{{ " "
                }}<span>{{
                    model.downloadMode ? "Stäng källmaterial" : "Ladda ner källmaterial"
                }}</span>
            </button>
        </div>
        <div v-if="model.downloadMode" class="more_container h-8 relative mb-4 show_more">
            <button
                v-if="!model.allVisibleSourceWorksSelected"
                type="button"
                data-library-select-visible
                class="sc btn btn-small absolute left"
                @click="emit('select-visible-source-works')"
            >
                Välj alla verk i listan
            </button>
            <button
                v-else
                type="button"
                data-library-deselect-visible
                class="sc btn btn-small absolute left"
                @click="emit('deselect-visible-source-works')"
            >
                Avmarkera alla verk i listan
            </button>
        </div>
    </div>
    </Transition>
    <div class="chronology primarycolor ml-px pl-px">
        <i class="fa fa-clock-o mr-1 ml-px" />{{ " " }}
        <span class="sc mt-8">Tidslinje: kronologisk sökning</span>
    </div>
    <div v-if="model.chronology" data-library-chronology-range class="flex">
        <ChronologyRangeSlider
            class="mt-3 slider-large chronology_ranges"
            :min="model.chronology.min"
            :max="model.chronology.max"
            :from="model.chronology.from"
            :to="model.chronology.to"
            from-label="Från tryckår reglage"
            to-label="Till tryckår reglage"
            @draft="emitChronologyDraft"
            @commit="emitChronologyRange"
            @cancel="emit('reset-chronology')"
        />

    </div>
    <div
        v-else-if="model.chronologyUnavailable"
        data-library-chronology-unavailable
        class="text-sm py-1"
    >
        Tidslinjen kunde inte hämtas.
    </div>
</template>

<style scoped>
.library-gender-control {
    position: relative;
    display: block;
    width: 350px;
    max-width: 100%;
    height: 31px;
    margin: 5px 0;
}

.library-gender-control [data-library-gender]:focus-visible {
    outline: 1px solid #7a1400;
    outline-offset: 0;
    box-shadow: none;
}

@media (forced-colors: active) {
    .library-gender-control [data-library-gender]:focus-visible {
        outline-color: Highlight;
    }
}

.library-gender-control [data-library-gender-visual] {
    box-sizing: border-box;
    display: block;
    width: 100%;
    height: 31px;
    text-align: left;
}

.library-gender-control .select2-selection__rendered {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0;
    overflow: visible;
    line-height: 28px;
}

.library-gender-control .select2-selection__arrow {
    position: absolute;
    top: 1px;
    right: 1px;
    display: block;
    width: 20px;
    height: 26px;
}

.library-gender-control .select2-selection__arrow b {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    margin-top: -2px;
    margin-left: -4px;
    border-color: #888 transparent transparent;
    border-style: solid;
    border-width: 5px 4px 0;
}

.library-gender-control.select2-container--open .select2-selection__arrow b {
    border-color: transparent transparent #888;
    border-width: 0 4px 5px;
}

.library-gender-control .library-gender-options {
    position: absolute;
    top: calc(100% - 2px);
    left: 0;
    z-index: 1051;
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid #333;
    border-top: 0;
    border-radius: 0;
    background: white;
    box-shadow: none;
    outline: none;
    font-size: 16px;
    line-height: 1.2;
}

.library-gender-options .select2-results__option {
    padding: 6px;
    cursor: pointer;
}

.library-gender-options .select2-results__option[aria-selected="true"] {
    background: #ddd;
}

.library-gender-options .select2-results__option--highlighted[aria-selected] {
    color: black;
    background: #ededed;
}

[data-library-advanced-panel] :deep(.multiselect__input::placeholder),
[data-library-advanced-panel] :deep(.search-multiselect__input-row) {
    color: #9e9e9e !important;
    opacity: 1;
}

[data-library-advanced-panel] .keyword_select.filter_select {
    margin-top: 0 !important;
}

[data-library-advanced-panel] :deep(.select2-selection__arrow.multiselect__select::before) {
    display: none;
}


.library-download-mode-toggle {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 4px 8px;
    border: 1px solid #999;
    background: white;
    color: var(--primary-color);
    font: inherit;
    line-height: 1.2;
    white-space: normal;
    text-align: left;
    box-shadow: none;
    cursor: pointer;
}

.library-download-mode-toggle[aria-pressed="true"] {
    border-color: var(--primary-color);
    background: var(--primary-color);
    color: white;
}

.library-download-mode-toggle:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

@media (forced-colors: active) {
    .library-download-mode-toggle:focus-visible {
        outline-color: Highlight;
    }
}

</style>
