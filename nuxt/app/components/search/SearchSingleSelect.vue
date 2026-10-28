<script setup lang="ts">
import { computed } from "vue"
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/vue"

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  modelValue: string
  options: readonly { value: string, label: string }[]
  accessibleName: string
  displayLabel?: string
  displayTitle?: string
  placeholder?: boolean
  buttonAttrs?: Record<string, string | boolean | undefined>
}>(), {
  displayLabel: undefined,
  displayTitle: undefined,
  placeholder: false,
  buttonAttrs: () => ({})
})
const emit = defineEmits<{ "update:modelValue": [value: string] }>()
const label = computed(() => props.displayLabel ?? props.options.find(option => option.value === props.modelValue)?.label ?? "")
</script>

<template>
  <Listbox v-slot="{ open }" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <div v-bind="$attrs" class="search-single-select select2-container select2-container--default" :class="{ 'select2-container--open': open }">
      <ListboxButton v-bind="buttonAttrs" :aria-label="accessibleName" :value="modelValue" class="select2-selection select2-selection--single">
        <span class="select2-selection__rendered" :class="{ catalog_placeholder: placeholder }" :title="displayTitle">{{ label }}</span>
        <span class="select2-selection__arrow" aria-hidden="true"><b /></span>
      </ListboxButton>
      <ListboxOptions class="library-gender-options select2-dropdown select2-dropdown--below">
        <ListboxOption v-for="option in options" :key="option.value" v-slot="{ active, selected }" :value="option.value" as="template">
          <li class="select2-results__option" :class="{ 'select2-results__option--highlighted': active, 'select2-results__option--selected': selected }">{{ option.label }}</li>
        </ListboxOption>
      </ListboxOptions>
    </div>
  </Listbox>
</template>

<style scoped>
.search-single-select {
    position: relative;
    display: block;
    width: 350px;
    max-width: 100%;
    height: 31px;
    margin: 5px 0;
}

.search-single-select .select2-selection--single {
    box-sizing: border-box;
    display: block;
    width: 100%;
    height: 31px;
    text-align: left;
}

.search-single-select .select2-selection__rendered {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0;
    overflow: visible;
    line-height: 28px;
}

.search-single-select .select2-selection__arrow {
    position: absolute;
    top: 1px;
    right: 1px;
    display: block;
    width: 20px;
    height: 26px;
}

.search-single-select .select2-selection__arrow b {
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

.search-single-select.select2-container--open .select2-selection__arrow b {
    border-color: transparent transparent #888;
    border-width: 0 4px 5px;
}

.search-single-select .library-gender-options {
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


.search-single-select .select2-selection__rendered {
  font-family: "Requiem Text SC A", "Requiem Text SC B";
  font-size: 16px;
  text-transform: lowercase;
}
.search-single-select .catalog_placeholder { color: #999; }
.search-single-select .library-gender-options {
  font-family: "Requiem Text SC A", "Requiem Text SC B";
  text-transform: lowercase;
}
/* The catalog retains its compact existing 34px control row. */
.search-single-select.catalog_select {
  height: 34px;
  margin: 0;
}
.search-single-select.catalog_select .select2-selection--single {
  height: 34px;
  padding: 1px 20px 0 8px;
  border: 1px solid #999 !important;
  background: white;
}
.search-single-select.catalog_select .select2-selection__rendered {
  height: 30px;
  line-height: 30px;
}
.search-single-select.catalog_select .select2-selection__arrow { height: 32px; }
</style>
