<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
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

const props = withDefaults(defineProps<{
  modelValue: readonly string[]
  options: readonly SearchMultiSelectOption[]
  optionGroups?: readonly SearchMultiSelectOptionGroup[]
  placeholder: string
  accessibleName?: string
  searchable?: boolean
  loading?: boolean
  spaceAfterRemove?: boolean
}>(), {
  searchable: false,
  loading: false,
  spaceAfterRemove: true
})

const emit = defineEmits<{
  "update:modelValue": [value: string[]]
  query: [value: string]
}>()

const multiselect = ref<InstanceType<typeof VueMultiselect> | null>(null)
const controlName = computed(() => props.accessibleName ?? props.placeholder)
const flatOptions = computed(() => props.optionGroups
  ? props.optionGroups.flatMap(group => group.options)
  : props.options)
const multiselectOptions = computed<VueMultiselectOption[] | VueMultiselectOptionGroup[]>(() => {
  const mapOption = (option: SearchMultiSelectOption): VueMultiselectOption => ({
    ...option,
    $isDisabled: option.disabled === true
  })
  return props.optionGroups
    ? props.optionGroups.map(group => ({ label: group.label, options: group.options.map(mapOption) }))
    : props.options.map(mapOption)
})
const selectedOptions = computed<VueMultiselectOption[]>(() => props.modelValue.map(value => (
  flatOptions.value.find(option => option.value === value) ?? { value, label: value }
)))

function selectedLabel(option: SearchMultiSelectOption): string {
  return option.selectionLabel ?? option.label
}

function update(value: readonly VueMultiselectOption[] | null) {
  const selected = new Set((value ?? []).map(option => option.value))
  const known = flatOptions.value
    .filter(option => selected.has(option.value))
    .map(option => option.value)
  const unknown = props.modelValue.filter(value => (
    selected.has(value) && !flatOptions.value.some(option => option.value === value)
  ))
  emit("update:modelValue", [...known, ...unknown])
}

function openOptions(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || target.closest("button, input")) return
  multiselect.value?.activate()
}

onMounted(() => {
  const search = multiselect.value?.$el.querySelector("input.multiselect__input")
  search?.classList.add("select2-search__field")
  search?.setAttribute("aria-label", controlName.value)
})
</script>

<template>
  <span
    v-bind="$attrs"
    class="filter_select select2 select2-container select2-container--default"
  >
    <VueMultiselect
      ref="multiselect"
      class="select2-selection select2-selection--multiple"
      :model-value="selectedOptions"
      :options="multiselectOptions"
      :name="controlName"
      :aria-label="controlName"
      :group-values="optionGroups ? 'options' : undefined"
      :group-label="optionGroups ? 'label' : undefined"
      :group-select="false"
      :placeholder="placeholder"
      :searchable="searchable"
      :internal-search="false"
      :loading="loading"
      :multiple="true"
      track-by="value"
      label="label"
      :close-on-select="false"
      :hide-selected="false"
      :show-labels="false"
      :allow-empty="true"
      @mousedown="openOptions"
      @update:model-value="update"
      @search-change="emit('query', $event)"
    >
      <template #caret="{ toggle }">
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

      <template #tag="{ option, remove }">
        <span class="select2-selection__choice" :title="option.label">
          <button
            type="button"
            class="select2-selection__choice__remove"
            :aria-label="`Ta bort ${selectedLabel(option)}`"
            @mousedown.prevent.stop
            @click.prevent.stop="remove(option)"
          >
            ×
          </button>{{ spaceAfterRemove ? " " : "" }}{{ selectedLabel(option) }}
        </span>
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
