<script setup lang="ts">
import { computed } from "vue"
import type {
    LibraryAdvancedChange,
    LibraryAdvancedControlsModel
} from "~/lib/library/component-models"
import type { LibraryCategory, LibraryLanguage, LibraryMedia } from "~/lib/library/filter-options"
import ChronologyRangeSlider from "../global/ChronologyRangeSlider.vue"
import SearchMultiSelect from "../search/SearchMultiSelect.vue"
import SearchSingleSelect from "../search/SearchSingleSelect.vue"
import WipeTransition from "../global/WipeTransition.vue"

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
    <WipeTransition>
    <div
        v-if="model.advancedOpen"
        id="library-advanced-panel"
        data-library-advanced-panel
        class="more_container show_more mt-2 mb-4"
    >
        <div class="title_select_container">
            <SearchSingleSelect
                class="library-gender-control"
                :model-value="model.gender"
                :options="genderOptions"
                accessible-name="Författarkön"
                :display-label="genderLabel"
                :display-title="model.gender === '' ? 'Alla författare' : undefined"

                :button-attrs="{ 'data-library-gender': '', 'data-library-gender-visual': '' }"
                @update:model-value="emitGender"
            />
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
                class="library-download-mode-toggle sc"
                :aria-pressed="model.downloadMode"
                @click="emit('toggle-download-mode')"
            >
                <i class="fa fa-download mr-1" aria-hidden="true" />{{ " "
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
    </WipeTransition>
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
    display: inline;
    max-width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--primary-color);
    font: inherit;
    white-space: normal;
    text-align: left;
    box-shadow: none;
    cursor: pointer;
}

.library-download-mode-toggle .fa {
    font-size: 0.85em;
}

.library-download-mode-toggle:hover {
    color: black;
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
