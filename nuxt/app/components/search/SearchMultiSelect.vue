<script setup lang="ts">
import { computed, ref, useId, watch } from "vue"
import SearchVirtualOptions from "./SearchVirtualOptions.vue"
import { Combobox, ComboboxButton, ComboboxInput, ComboboxLabel, ComboboxOption, ComboboxOptions } from "@headlessui/vue"

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

const props = withDefaults(defineProps<{
  modelValue?: readonly string[]
  single?: boolean
  singleValue?: string | null
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
  preserveSearch?: boolean
  lastActionLabel?: string
}>(), {
  modelValue: () => [],
  single: false,
  singleValue: null,
  optionGroups: () => [],
  accessibleName: undefined,
  searchable: false,
  internalSearch: false,
  loading: false,
  spaceAfterRemove: true,
  persistentInputRow: false,
  hideSelected: false,
  preserveSearch: false,
  lastActionLabel: undefined
})

const emit = defineEmits<{
  "update:modelValue": [value: string[]]
  "update:singleValue": [value: string | null]
  query: [value: string]
  lastAction: []
}>()


const root = ref<HTMLElement | null>(null)
const trigger = ref<InstanceType<typeof ComboboxButton> | null>(null)
const inputId = useId()
const chipClickWasOpen = ref(false)
const query = ref("")
const above = ref(false)
const maxHeight = ref(300)
const controlName = computed(() => props.accessibleName ?? props.placeholder)
const flatOptions = computed(() => props.optionGroups.length
  ? props.optionGroups.flatMap(group => group.options) : props.options)
const knownOptions = new Map<string, SearchMultiSelectOption>()
function rememberOption(option: SearchMultiSelectOption) {
  const remembered = knownOptions.get(option.value)
  if (option.label !== option.value || !remembered) knownOptions.set(option.value, option)
}
watch(flatOptions, options => options.forEach(rememberOption), { immediate: true })
const selectedValues = computed(() => props.single
  ? props.singleValue === null ? [] : [props.singleValue]
  : props.modelValue)
const selectedOptions = computed(() => selectedValues.value.map(value => {
  const current = flatOptions.value.find(option => option.value === value)
  const remembered = knownOptions.get(value)
  if (current?.label === value && remembered && remembered.label !== value) return remembered
  return current ?? remembered ?? { value, label: value }
}))
const groups = computed(() => {
  const search = props.internalSearch ? query.value.trim().toLowerCase() : ""
  const source = props.optionGroups.length ? props.optionGroups : [{ label: "", options: props.options }]
  return source.map(group => {
    let options = group.options.filter(option => (
      (!props.hideSelected || !selectedValues.value.includes(option.value))
      && (!search || option.label.toLowerCase().includes(search))
    ))
    if (search) options = options.toSorted((a, b) => a.label.length - b.label.length)
    return { label: group.label, options }
  }).filter(group => group.options.length)
})
// Actions belong to the same Headless UI navigation order as real choices.
const lastAction = computed<SearchMultiSelectOption>(() => ({ value: `${inputId}-last-action`, label: props.lastActionLabel ?? "" }))
const navigableOptions = computed(() => [
  ...groups.value.flatMap(group => group.options),
  ...(props.lastActionLabel ? [lastAction.value] : [])
])
// Keep the renderer stable while a large catalog is filtered down. Replacing
// it with regular options discards pending boundary focus and virtual ARIA rows.
const windowedOptions = computed(() => !props.optionGroups.length
  && (props.options.length > 500 || navigableOptions.value.length > 500))
const virtualList = ref<InstanceType<typeof SearchVirtualOptions> | null>(null)
function selectedLabel(option: SearchMultiSelectOption) {
  return option.selectionLabel ?? option.label
}
function update(value: SearchMultiSelectOption[] | SearchMultiSelectOption | null) {
  if (props.single) {
    const option = !Array.isArray(value) ? value : null
    if (option?.value === lastAction.value.value) { emit("lastAction"); return }
    if (option) rememberOption(option)
    emit("update:singleValue", option?.value ?? null)
    clearQuery()
    return
  }
  const values = Array.isArray(value) ? value : []
  if (values.some(option => option.value === lastAction.value.value)) {
    emit("lastAction")
    return
  }
  values.forEach(rememberOption)
  const selected = new Set(values.map(option => option.value))
  const known = flatOptions.value.filter(option => selected.has(option.value)).map(option => option.value)
  const unknown = props.modelValue.filter(value => selected.has(value)
    && !flatOptions.value.some(option => option.value === value))
  emit("update:modelValue", [...known, ...unknown])
  clearQuery()
}
function remove(option: SearchMultiSelectOption) {
  if (props.single) { emit("update:singleValue", null); clearQuery(); return }
  update(selectedOptions.value.filter(value => value.value !== option.value))
}
function changeQuery(event: Event) {
  query.value = (event.target as HTMLInputElement).value
  emit("query", query.value)
}
function clearQuery() {
  if (props.preserveSearch || !query.value) return
  query.value = ""
  emit("query", "")
}
function positionOptions() {
  const bounds = root.value?.getBoundingClientRect()
  if (!bounds) return
  const below = window.innerHeight - bounds.bottom
  above.value = !(below > 300 || below > bounds.top)
  maxHeight.value = Math.max(0, Math.min((above.value ? bounds.top : below) - 40, 300))
}
function toggle() {
  // Use the public Headless UI button, leaving the open state and focus to it.
  const button = trigger.value?.$el as HTMLButtonElement | undefined
  button?.click()
}
function clickInput(open: boolean) {
  if (!open || !(props.preserveSearch && query.value)) toggle()
}
function blurInput(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget)) clearQuery()
}
// Headless UI owns dismissal, selection, and ordinary keyboard navigation.
// Extend only chip deletion and the legacy page-sized/virtual-boundary movement.
function keydown(event: KeyboardEvent, open: boolean) {
  if (event.isComposing) return
  if (["Escape", "Tab"].includes(event.key)) clearQuery()
  if (!(event.target instanceof HTMLInputElement)) return
  if (!props.single && event.key === "Backspace" && !query.value && selectedOptions.value.length) {
    remove(selectedOptions.value.at(-1)!)
  }
  if (open && virtualList.value && ["Home", "End"].includes(event.key)) {
    event.preventDefault()
    event.stopPropagation()
    void virtualList.value.focusBoundary(event.key === "End")
    return
  }
  if (!open || !["PageDown", "PageUp"].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  const input = event.target as HTMLInputElement
  const list = root.value?.querySelector<HTMLElement>(".multiselect__content-wrapper")
  const options = [...(list?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? [])]
  const current = options.findIndex(option => option.id === input.getAttribute("aria-activedescendant"))
  if (!list || current < 0) return
  const direction = event.key === "PageDown" ? 1 : -1
  const origin = options[current]!.getBoundingClientRect().top
  let target = current
  for (let i = current + direction; i >= 0 && i < options.length; i += direction) {
    target = i
    if (Math.abs(options[i]!.getBoundingClientRect().top - origin) >= list.clientHeight) break
  }
  // Use Headless UI's option activation handler without moving DOM focus
  // away from the combobox input (including in Firefox).
  options[target]!.dispatchEvent(new FocusEvent("focus"))
}
</script>

<template>
  <span
    :class="[$attrs.class, { 'search-multiselect--single': single }]"
    :data-library-about-authors="$attrs['data-library-about-authors']"
    :data-library-keywords="$attrs['data-library-keywords']"
    :data-library-languages="$attrs['data-library-languages']"
    :data-library-media="$attrs['data-library-media']"
    :data-library-narrowing="$attrs['data-library-narrowing']"
    :data-preserve-search="preserveSearch || undefined"
    class="filter_select select2 select2-container select2-container--default"
  >
    <Combobox v-slot="{ open, activeOption }" :model-value="single ? selectedOptions[0] ?? null : selectedOptions" by="value" :multiple="!single" :nullable="single" @update:model-value="update">
      <ComboboxLabel v-if="!single" class="sr-only">{{ controlName }}</ComboboxLabel>
      <div
        ref="root"
        class="multiselect select2-selection"
        :class="{ 'multiselect--active': open, 'multiselect--above': above, 'select2-selection--single': single, 'select2-selection--multiple': !single }"
        @mousedown="positionOptions"
        @focusin="positionOptions"
        @keydown.capture="keydown($event, open)"
      >
        <ComboboxButton
          ref="trigger"
          class="select2-selection__arrow multiselect__select"
          :aria-label="single ? controlName : `Visa alternativ för ${placeholder}`"
          @click="open && clearQuery()"
        ><b aria-hidden="true" /></ComboboxButton>
        <div class="multiselect__tags">
          <div v-if="!single && selectedOptions.length" class="multiselect__tags-wrap" @pointerdown="chipClickWasOpen = open" @mousedown.prevent @click.prevent.stop="!chipClickWasOpen && toggle()">
            <span v-for="option in selectedOptions" :key="option.value" class="select2-selection__choice" :title="option.label">
              <button
                type="button"
                class="select2-selection__choice__remove"
                :aria-label="`Ta bort ${selectedLabel(option)}`"
                @click.stop="remove(option)"
              >{{ "×" }}</button>
              <span class="select2-selection__choice-label">{{ spaceAfterRemove ? " " : "" }}{{ selectedLabel(option) }}</span>
            </span>
          </div>
          <Transition name="multiselect__loading">
            <i v-if="loading" class="spinner fa fa-spinner fa-pulse" aria-label="Laddar alternativ" />
          </Transition>
          <ComboboxInput
            :id="inputId"
            class="multiselect__input select2-search__field"
            :class="!single && selectedOptions.length && persistentInputRow && !open && !preserveSearch
              ? 'search-multiselect__input-row' : 'search-multiselect__native-search'"
            :style="single || open || selectedOptions.length ? { width: '100%' } : { width: '0', position: 'absolute', padding: '0' }"
            :display-value="() => single && !open ? selectedOptions[0] ? selectedLabel(selectedOptions[0]) : '' : query"
            :placeholder="placeholder"
            :aria-label="controlName"
            :readonly="!searchable"
            autocomplete="off"
            :spellcheck="false"
            @change="changeQuery"
            @click="clickInput(open)"
            @blur="blurInput"
          />
          <span v-if="!single && !open && !selectedOptions.length" class="multiselect__placeholder" aria-hidden="true" @click="toggle">{{ placeholder }}</span>
        </div>
        <ComboboxOptions
          as="div"
          :unmount="false"
          :hold="windowedOptions"
          class="multiselect__content-wrapper"
          :style="{ maxHeight: `${maxHeight}px` }"
          :inert="!open || undefined"
        >
          <SearchVirtualOptions
            v-if="windowedOptions && open"
            ref="virtualList"
            :options="navigableOptions"
            :action-value="lastActionLabel ? lastAction.value : undefined"
            :active-option="activeOption"
          />
          <ul v-else-if="!windowedOptions" class="multiselect__content" style="display: inline-block" role="presentation">
            <slot name="beforeList" />
            <template v-for="(group, index) in groups" :key="index">
              <li v-if="group.label" class="multiselect__element" role="presentation">
                <span class="multiselect__option multiselect__option--group multiselect__option--disabled"><span class="select2-results__group">{{ group.label }}</span></span>
              </li>
              <ComboboxOption v-for="(option, optionIndex) in group.options" :key="option.value" v-slot="{ active, selected }" :value="option" :order="index * flatOptions.length + optionIndex" :disabled="option.disabled" class="multiselect__element">
                <span
class="multiselect__option" :class="{
                  'multiselect__option--highlight': active,
                  'multiselect__option--selected': selected,
                  'multiselect__option--disabled': option.disabled
                }"><span class="select2-results__option" :aria-disabled="option.disabled || undefined">{{ option.label }}</span></span>
              </ComboboxOption>
            </template>
            <li v-if="!groups.length" role="presentation"><span class="multiselect__option"><slot name="empty">{{ query ? 'Inga matchande alternativ.' : 'Inga alternativ att visa.' }}</slot></span></li>
            <slot name="afterList" />
            <ComboboxOption v-if="lastActionLabel" v-slot="{ active }" :value="lastAction" :order="flatOptions.length * (groups.length + 1)" class="multiselect__element">
              <span class="multiselect__option title_select_show_all select2-results__option" :class="{ 'multiselect__option--highlight': active }">{{ lastActionLabel }}</span>
            </ComboboxOption>
          </ul>
        </ComboboxOptions>
      </div>
    </Combobox>
  </span>
</template>

<style src="~/assets/styles/search-multi-select.css"></style>
<style scoped>
.search-multiselect--single {
  width: 200px;
  max-width: 100%;
}
.search-multiselect--single .multiselect {
  box-sizing: border-box;
  width: 100%;
  padding: 0;
  min-height: 34px;
  height: 34px;
  border: 1px solid #999 !important;
  background: white;
}
.search-multiselect--single .multiselect__tags {
  display: block;
  height: 32px;
  min-height: 0;
}
.search-multiselect--single .multiselect__select::before { display: none; }
.search-multiselect--single .multiselect input.multiselect__input {
  display: block;
  position: static;
  width: 100%;
  max-width: none;
  min-height: 0;
  height: 32px;
  padding: 0 20px 0 8px;
  margin: 0;
  border: 0;
  background: transparent;
  font-family: "Requiem Text SC A", "Requiem Text SC B";
  font-size: 16px;
  line-height: 30px;
  text-transform: lowercase;
  outline: none;
}
.search-multiselect--single .multiselect__content-wrapper {
  width: 100%;
  border-radius: 0;
  font-family: "Requiem Text SC A", "Requiem Text SC B";
  font-size: 16px;
  line-height: 1.2;
  text-transform: lowercase;
}

/* The visible row is now the actual accessible combobox input. */
input.search-multiselect__input-row {
  pointer-events: auto;
}
</style>
