<script setup lang="ts">
import { computed } from "vue"
import type {
    LibraryAdvancedChange,
    LibraryAdvancedControlsModel
} from "~/lib/library/component-models"
import type { LibraryCategory, LibraryLanguage, LibraryMedia } from "~/lib/library/filter-options"
import ChronologyRangeSlider from "../global/ChronologyRangeSlider.vue"
import SearchMultiSelect from "../search/SearchMultiSelect.vue"

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

function emitGender(event: Event): void {
    const value = inputValue(event)
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

function draftValues(endpoint: ChronologyEndpoint, value: string): readonly [string, string] | null {
    const chronology = props.model.chronology
    if (!chronology) return null
    return endpoint === "from"
        ? [value, chronology.to]
        : [chronology.from, value]
}

function rangeValues(endpoint: ChronologyEndpoint, value: string): readonly [string, string] | null {
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
    <div
        v-if="model.advancedOpen"
        id="library-advanced-panel"
        data-library-advanced-panel
        class="more_container show_more mt-2 mb-4"
    >
        <div class="title_select_container">
            <label class="library-gender-control select2-container select2-container--default">
                <span class="sr-only">Författarkön</span>
                <select
                    :value="model.gender"
                    data-library-gender
                    class="gender_select"
                    :class="{ 'library-select-placeholder': !model.gender }"
                    aria-label="Författarkön"
                    @change="emitGender"
                >
                    <option value="" :selected="model.gender === ''">
                        Filtrera: kvinnliga / manliga / alla
                    </option>
                    <option value="female" :selected="model.gender === 'female'">
                        Kvinnliga författare
                    </option>
                    <option value="male" :selected="model.gender === 'male'">
                        Manliga författare
                    </option>
                </select>
                <span class="selection" aria-hidden="true">
                    <span
                        data-library-gender-visual
                        class="select2-selection select2-selection--single"
                    >
                        <span
                            class="select2-selection__rendered"
                            :title="model.gender === '' ? 'Alla författare' : undefined"
                            >{{
                                model.gender === "female"
                                    ? "Kvinnliga författare"
                                    : model.gender === "male"
                                      ? "Manliga författare"
                                      : "Filtrera: kvinnliga / manliga / alla"
                            }}</span
                        >
                        <span class="select2-selection__arrow"><b /></span>
                    </span>
                </span>
            </label>
        </div>
        <div class="title_select_container">
            <label>
                <span class="sr-only">Kategorier och utgivare</span>
                <SearchMultiSelect
                    data-library-keywords
                    class="keyword_select"
                    persistent-input-row
                    accessible-name="Filtrera: Kategorier / Utgivare"
                    :model-value="model.keywords"
                    :options="model.collectionSelectOptions"
                    :option-groups="model.collectionSelectGroups"
                    :space-after-remove="false"
                    placeholder="Filtrera: Kategorier / Utgivare"
                    @update:model-value="emitKeywords"
                />
            </label>
        </div>
        <div
            v-if="!model.standalone && model.aboutAuthorOptions.length"
            class="title_select_container about_container"
        >
            <label>
                <span class="sr-only">Om ett författarskap</span>
                <SearchMultiSelect
                    data-library-about-authors
                    class="about_select"
                    accessible-name="Om ett författarskap"
                    :model-value="model.aboutAuthorIds"
                    :options="model.aboutAuthorOptions.map(author => ({
                        value: author.id,
                        label: author.label
                    }))"
                    placeholder="Om ett författarskap"
                    searchable
                    internal-search
                    persistent-input-row
                    @update:model-value="emitAboutAuthors"
                />
            </label>
        </div>
        <div v-if="!model.standalone">
            <div class="text-sm mb-4 max-w-sm">
                Får du för många träffar? Välj ytterligare samlingar (en eller flera) i menyn
                <span class="sc">AVGRÄNSA SÖKNINGEN</span> här nedanför. Ju fler samlingar du
                väljer, desto färre sökträffar får du.
            </div>
            <label>
                <span class="sr-only">Avgränsa sökningen</span>
                <SearchMultiSelect
                    data-library-narrowing
                    class="keyword_select block"
                    persistent-input-row
                    accessible-name="Avgränsa sökningen"
                    :model-value="model.narrowingKeywords"
                    :options="model.collectionSelectOptions"
                    :option-groups="narrowingSelectGroups"
                    :space-after-remove="false"
                    placeholder="Avgränsa sökningen"
                    @update:model-value="emitNarrowingKeywords"
                />
            </label>
        </div>
        <div class="title_select_container">
            <label>
                <span class="sr-only">Utgivningsformat</span>
                <SearchMultiSelect
                    data-library-media
                    class="keyword_select"
                    persistent-input-row
                    accessible-name="Utgivningsformat"
                    :model-value="model.media"
                    :options="model.mediaSelectOptions"
                    :space-after-remove="false"
                    placeholder="Utgivningsformat"
                    @update:model-value="emitMedia"
                />
            </label>
        </div>
        <div class="title_select_container">
            <label>
                <span class="sr-only">Språk och status</span>
                <SearchMultiSelect
                    data-library-languages
                    class="keyword_select"
                    persistent-input-row
                    accessible-name="Språk …"
                    :model-value="model.languages"
                    :options="model.languageSelectOptions"
                    :space-after-remove="false"
                    placeholder="Språk …"
                    @update:model-value="emitLanguages"
                />
            </label>
        </div>
        <div
            v-if="!model.standalone"
            class="more ml-[2px] relative"
            :class="{ show_more: model.downloadMode }"
        >
            <a
                data-library-download-mode
                role="button"
                tabindex="0"
                @click.prevent="emit('toggle-download-mode')"
                @keydown.enter.prevent="emit('toggle-download-mode')"
                @keydown.space.prevent="emit('toggle-download-mode')"
            >
                <i class="fa fa-download color-black mr-1 text-xs" />{{ " "
                }}<span>{{
                    model.downloadMode ? "Stäng källmaterial" : "Ladda ner källmaterial"
                }}</span>
            </a>
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
        <div class="whitespace-nowrap self-center chronology_inputs">
            <span class="text-sm sc">Tryckår: </span>
            <input
                class="text-sm text-center py-1"
                type="text"
                :value="model.chronology.from"
                aria-label="Från tryckår"
                @input="emitChronologyDraft('from', inputValue($event))"
                @change="emitChronologyRange('from', inputValue($event))"
            >{{ " " }}
            <span class="text-sm sc">till </span>
            <input
                class="text-sm text-center py-1"
                type="text"
                :value="model.chronology.to"
                aria-label="Till tryckår"
                @input="emitChronologyDraft('to', inputValue($event))"
                @change="emitChronologyRange('to', inputValue($event))"
            >
        </div>
    </div>
    <div v-else data-library-chronology-unavailable class="text-sm py-1">
        Tidslinjen kunde inte hämtas.
    </div>
</template>

<style scoped>
[data-library-advanced-panel] select {
    display: block;
    width: 350px;
    max-width: 100%;
    height: 31px;
    padding: 3px 28px 3px 10px;
    margin-top: 5px;
    margin-bottom: 5px;
    font-family: "Requiem Text SC A", "Requiem Text SC B";
    font-size: 0.8em;
    line-height: 1.2;
    text-transform: lowercase;
    color: #444;
    background: white;
    border: 1px solid #999;
}

.library-gender-control {
    position: relative;
    display: block;
    width: 350px;
    max-width: 100%;
    height: 31px;
    margin: 5px 0;
}

[data-library-advanced-panel] .library-gender-control select[data-library-gender] {
    position: absolute;
    inset: 0;
    z-index: 2;
    width: 100%;
    height: 31px;
    padding: 0;
    margin: 0;
    cursor: pointer;
    opacity: 0;
}

[data-library-advanced-panel]
    .library-gender-control
    select[data-library-gender]:focus-visible
    + .selection
    [data-library-gender-visual] {
    outline: 2px solid #fff;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px #333;
}

@media (forced-colors: active) {
    [data-library-advanced-panel]
        .library-gender-control
        select[data-library-gender]:focus-visible
        + .selection
        [data-library-gender-visual] {
        outline-color: Highlight;
        box-shadow: none;
    }
}

.library-gender-control .selection {
    display: block;
    height: 31px;
}

.library-gender-control [data-library-gender-visual] {
    box-sizing: border-box;
    display: block;
    width: 100%;
    height: 31px;
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

[data-library-advanced-panel] select.library-select-placeholder {
    color: #999 !important;
    opacity: 1;
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

[data-library-advanced-panel] option[data-library-placeholder] {
    color: #666;
}

[data-library-chronology-range] .rzslider {
    position: relative;
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    height: 20px;
    margin: 8px 1.85rem 3px 0 !important;
    background: linear-gradient(
        to right,
        rgba(122, 20, 0, 0.15) 0 var(--chronology-from),
        #7a1400 var(--chronology-from) var(--chronology-to),
        rgba(122, 20, 0, 0.15) var(--chronology-to) 100%
    );
    background-position: 10px calc(50% - 2px);
    background-size: calc(100% - 20px) 8px;
    background-repeat: no-repeat;
}
</style>
