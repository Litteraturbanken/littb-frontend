<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import VueMultiselect from "vue-multiselect"

defineOptions({ inheritAttrs: false })

export type SearchMultiSelectOption = Readonly<{
  value: string
  label: string
  selectionLabel?: string
  disabled?: boolean
}>

export type SearchMultiSelectOptionGroup = Readonly<{
  label: string
  options: readonly SearchMultiSelectOption[]
}>

type VueMultiselectOption = SearchMultiSelectOption & Readonly<{
  $isDisabled?: boolean
}>

type VueMultiselectOptionGroup = Readonly<{
  label: string
  options: readonly VueMultiselectOption[]
}>

type ToggleableMultiselect = Readonly<{
  toggle: () => void
}>

const props = withDefaults(defineProps<{
  modelValue: readonly string[]
  options: readonly SearchMultiSelectOption[]
  optionGroups?: readonly SearchMultiSelectOptionGroup[]
  placeholder: string
  accessibleName?: string
  searchable?: boolean
  internalSearch?: boolean
  loading?: boolean
  spaceAfterRemove?: boolean
  persistentInputRow?: boolean
  hideSelected?: boolean
}>(), {
  optionGroups: () => [],
  accessibleName: undefined,
  searchable: false,
  internalSearch: false,
  loading: false,
  spaceAfterRemove: true,
  persistentInputRow: false,
  hideSelected: false
})

const emit = defineEmits<{
  "update:modelValue": [value: string[]]
  query: [value: string]
}>()

const multiselect = ref<InstanceType<typeof VueMultiselect> | null>(null)
const isOpen = ref(false)
let closeOnControlClick = false
const controlName = computed(() => props.accessibleName ?? props.placeholder)
const flatOptions = computed(() => props.optionGroups.length > 0
  ? props.optionGroups.flatMap(group => group.options)
  : props.options)
const knownOptions = new Map<string, SearchMultiSelectOption>()
watch(flatOptions, (options) => {
  for (const option of options) {
    rememberOption(option)
  }
}, { immediate: true })
const multiselectOptions = computed<VueMultiselectOption[] | VueMultiselectOptionGroup[]>(() => {
  const mapOption = (option: SearchMultiSelectOption): VueMultiselectOption => ({
    ...option,
    $isDisabled: option.disabled === true
  })
  return props.optionGroups.length > 0
    ? props.optionGroups.map(group => ({ label: group.label, options: group.options.map(mapOption) }))
    : props.options.map(mapOption)
})
const selectedOptions = computed<VueMultiselectOption[]>(() => props.modelValue.map((value) => {
  const current = flatOptions.value.find(option => option.value === value)
  const remembered = knownOptions.get(value)
  if (current?.label === value && remembered && remembered.label !== value) return remembered
  return current ?? remembered ?? { value, label: value }
}))

function selectedLabel(option: SearchMultiSelectOption): string {
  return option.selectionLabel ?? option.label
}

function rememberOption(option: SearchMultiSelectOption) {
  const remembered = knownOptions.get(option.value)
  if (option.label !== option.value || !remembered) {
    knownOptions.set(option.value, option)
  }
}

function update(value: readonly VueMultiselectOption[] | null) {
  for (const option of value ?? []) {
    knownOptions.set(option.value, option)
  }
  const selected = new Set((value ?? []).map(option => option.value))
  const known = flatOptions.value
    .filter(option => selected.has(option.value))
    .map(option => option.value)
  const unknown = props.modelValue.filter(value => (
    selected.has(value) && !flatOptions.value.some(option => option.value === value)
  ))
  emit("update:modelValue", [...known, ...unknown])
}

function toggleOptions() {
  const toggleable = multiselect.value as unknown as ToggleableMultiselect | null
  toggleable?.toggle()
}

function isControlSurface(target: EventTarget | null): boolean {
  return target instanceof Element
    && (target.matches(".multiselect") || target.closest(".multiselect__tags") !== null)
    && target.closest(".select2-selection__choice__remove") === null
}

function prepareControlClick(event: MouseEvent) {
  closeOnControlClick = isOpen.value && isControlSurface(event.target)
}

function toggleActiveControl(event: MouseEvent) {
  if (!closeOnControlClick) return
  closeOnControlClick = false
  event.preventDefault()
  event.stopPropagation()
  toggleOptions()
}

onMounted(() => {
  const search = multiselect.value?.$el.querySelector(
    "input.multiselect__input:not(.search-multiselect__input-row)"
  )
  search?.classList.add("select2-search__field", "search-multiselect__native-search")
  search?.setAttribute("aria-label", controlName.value)
})
</script>

<template>
  <span
    :class="$attrs.class"
    :data-library-about-authors="$attrs['data-library-about-authors']"
    :data-library-keywords="$attrs['data-library-keywords']"
    :data-library-languages="$attrs['data-library-languages']"
    :data-library-media="$attrs['data-library-media']"
    :data-library-narrowing="$attrs['data-library-narrowing']"
    class="filter_select select2 select2-container select2-container--default"
    @mousedown.capture="prepareControlClick"
    @click.capture="toggleActiveControl"
  >
    <VueMultiselect
      ref="multiselect"
      class="select2-selection select2-selection--multiple"
      :model-value="selectedOptions"
      :options="multiselectOptions"
      :name="controlName"
      :aria-label="controlName"
      :group-values="optionGroups.length > 0 ? 'options' : undefined"
      :group-label="optionGroups.length > 0 ? 'label' : undefined"
      :group-select="false"
      :placeholder="placeholder"
      :searchable="searchable"
      :internal-search="internalSearch"
      :loading="loading"
      :multiple="true"
      track-by="value"
      label="label"
      :close-on-select="false"
      :hide-selected="hideSelected"
      :show-labels="false"
      :allow-empty="true"
      @update:model-value="update"
      @select="rememberOption"
      @search-change="emit('query', $event)"
      @open="isOpen = true"
      @close="isOpen = false"
    >
      <template #caret="{ toggle }">
        <input
          v-if="selectedOptions.length === 0 && !searchable"
          class="multiselect__input search-multiselect__input-row search-multiselect__main-trigger"
          type="search"
          :placeholder="placeholder"
          readonly
          aria-hidden="true"
          tabindex="-1"
          @mousedown.prevent.stop
          @click.prevent.stop="toggle"
        >
        <button
          type="button"
          class="select2-selection__arrow multiselect__select"
          :aria-label="`Visa alternativ för ${placeholder}`"
          @mousedown.prevent.stop
          @click.prevent.stop="toggle"
        >
          <b aria-hidden="true" />
        </button>
      </template>

      <template #selection="{ values, remove }">
        <input
          v-if="values.length && persistentInputRow && (!searchable || !isOpen)"
          class="multiselect__input search-multiselect__input-row"
          type="search"
          :placeholder="placeholder"
          readonly
          tabindex="-1"
          aria-hidden="true"
          @mousedown.prevent.stop
          @click.prevent.stop="toggleOptions"
        >
        <div
          v-if="values.length"
          class="multiselect__tags-wrap"
          @mousedown.prevent.stop
          @click.prevent.stop="toggleOptions"
        >
          <span
            v-for="option in values"
            :key="option.value"
            class="select2-selection__choice"
            :title="option.label"
          >
            <button
              type="button"
              class="select2-selection__choice__remove"
              :aria-label="`Ta bort ${selectedLabel(option)}`"
              @mousedown.prevent.stop
              @click.prevent.stop="remove(option)"
            >{{ "×" }}</button>
            <span class="select2-selection__choice-label">{{ spaceAfterRemove ? " " : "" }}{{ selectedLabel(option) }}</span>
          </span>
        </div>
      </template>

      <template #option="{ option }">
        <span
          v-if="option.$isLabel"
          class="select2-results__group"
        >{{ option.$groupLabel }}</span>
        <span
          v-else
          class="select2-results__option"
          :aria-disabled="option.$isDisabled ? 'true' : undefined"
        >{{ option.label }}</span>
      </template>

      <template #loading>
        <i
          v-if="loading"
          class="spinner fa fa-spinner fa-pulse"
          aria-label="Laddar alternativ"
        />
      </template>
    </VueMultiselect>
  </span>
</template>

<style src="vue-multiselect/dist/vue-multiselect.css"></style>
