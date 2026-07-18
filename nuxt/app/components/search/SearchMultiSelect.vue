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

function openOptions(event: Event) {
  const currentTarget = event.currentTarget
  if (!(currentTarget instanceof HTMLElement)) return
  const selection = currentTarget.closest(".select2-selection") ?? currentTarget
  const button = selection.querySelector<HTMLButtonElement>(".select2-selection__arrow")
  const target = event.target
  if (target instanceof Node && button?.contains(target)) return
  button?.click()
}

function openReadonlyOptions(event: Event) {
  if (!props.searchable) openOptions(event)
}
</script>

<template>
  <Combobox
    :model-value="[...modelValue]"
    multiple
    nullable
    @update:model-value="update"
  >
    <span
      v-bind="$attrs"
      class="filter_select select2 select2-container select2-container--default"
    >
      <span class="selection">
        <span
          class="select2-selection select2-selection--multiple"
          @click="openOptions"
          @keydown.enter.prevent="openReadonlyOptions"
          @keydown.space.prevent="openReadonlyOptions"
        >
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
              </button>{{ spaceAfterRemove ? " " : "" }}{{ selectedLabel(option) }}
            </li>
            <li class="select2-search select2-search--inline">
              <ComboboxInput
                class="select2-search__field"
                :placeholder="placeholder"
                :readonly="!searchable"
                autocomplete="off"
                @click.stop="openOptions"
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
        </span>
      </span>
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
    </span>
  </Combobox>
</template>

<style scoped>
.select2-container {
  box-sizing: border-box;
  display: inline-block;
  position: relative;
  vertical-align: middle;
}

.select2-selection--multiple {
  box-sizing: border-box;
  display: block;
  min-height: 32px;
  cursor: text;
  user-select: none;
}

.select2-selection__rendered {
  box-sizing: border-box;
  display: inline-block;
  width: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden;
  list-style: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select2-selection__rendered > li {
  list-style: none;
}

.select2-selection__choice {
  float: left;
  padding: 0 5px;
  margin-top: 5px;
  border: 1px solid #aaa;
}

.select2-container--default .select2-selection--multiple .select2-selection__choice__remove {
  width: 20.171875px;
  margin-right: -5px;
}

.select2-search--inline {
  float: left;
}

.select2-selection__arrow {
  position: absolute;
  top: 0;
  right: 0;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  border: 0;
}
</style>
