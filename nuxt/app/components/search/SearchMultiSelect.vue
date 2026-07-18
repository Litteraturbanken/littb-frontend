<script setup lang="ts">
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions
} from "@headlessui/vue"

defineOptions({ inheritAttrs: false })

export type SearchMultiSelectOption = Readonly<{
  value: string
  label: string
  selectionLabel?: string
  disabled?: boolean
}>

const props = withDefaults(defineProps<{
  modelValue: readonly string[]
  options: readonly SearchMultiSelectOption[]
  placeholder: string
  searchable?: boolean
  loading?: boolean
}>(), {
  searchable: false,
  loading: false
})

const emit = defineEmits<{
  "update:modelValue": [value: string[]]
  query: [value: string]
}>()

const selectedOptions = computed(() => props.modelValue.map(value => (
  props.options.find(option => option.value === value) ?? { value, label: value }
)))

function selectedLabel(option: SearchMultiSelectOption): string {
  return option.selectionLabel ?? option.label
}

function update(value: string[]) {
  emit("update:modelValue", [...value])
}

function remove(value: string) {
  emit("update:modelValue", props.modelValue.filter(item => item !== value))
}
</script>

<template>
  <Combobox
    :model-value="[...modelValue]"
    multiple
    nullable
    @update:model-value="update"
  >
    <div
      v-bind="$attrs"
      class="filter_select select2-container select2-container--default"
    >
      <div class="select2-selection select2-selection--multiple">
        <ul class="select2-selection__rendered">
          <li
            v-for="option in selectedOptions"
            :key="option.value"
            class="select2-selection__choice"
            :title="option.label"
          >
            <button
              type="button"
              class="select2-selection__choice__remove"
              :aria-label="`Ta bort ${selectedLabel(option)}`"
              @click.stop="remove(option.value)"
            >
              ×
            </button>
            {{ selectedLabel(option) }}
          </li>
          <li class="select2-search select2-search--inline">
            <ComboboxInput
              class="select2-search__field"
              :placeholder="modelValue.length ? '' : placeholder"
              :readonly="!searchable"
              autocomplete="off"
              @change="emit('query', ($event.target as HTMLInputElement).value)"
            />
          </li>
        </ul>
        <ComboboxButton
          type="button"
          class="select2-selection__arrow"
          :aria-label="`Visa alternativ för ${placeholder}`"
        >
          <b aria-hidden="true" />
        </ComboboxButton>
      </div>
      <ComboboxOptions class="select2-results__options">
        <ComboboxOption
          v-for="option in options"
          :key="option.value"
          v-slot="{ active, selected }"
          as="template"
          :value="option.value"
          :disabled="option.disabled"
        >
          <li
            class="select2-results__option"
            :class="{
              'select2-results__option--highlighted': active,
              'select2-results__option--selected': selected
            }"
          >
            {{ option.label }}
          </li>
        </ComboboxOption>
      </ComboboxOptions>
      <i
        v-if="loading"
        class="spinner fa fa-spinner fa-pulse"
        aria-label="Laddar alternativ"
      />
    </div>
  </Combobox>
</template>
