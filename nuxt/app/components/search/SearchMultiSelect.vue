<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from "vue"
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
  preserveSearch?: boolean
}>(), {
  optionGroups: () => [],
  accessibleName: undefined,
  searchable: false,
  internalSearch: false,
  loading: false,
  spaceAfterRemove: true,
  persistentInputRow: false,
  hideSelected: false,
  preserveSearch: false
})

const emit = defineEmits<{
  "update:modelValue": [value: string[]]
  query: [value: string]
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
const selectedOptions = computed(() => props.modelValue.map(value => {
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
      (!props.hideSelected || !props.modelValue.includes(option.value))
      && (!search || option.label.toLowerCase().includes(search))
    ))
    if (search) options = options.toSorted((a, b) => a.label.length - b.label.length)
    return { label: group.label, options }
  }).filter(group => group.options.length)
})
const windowedOptions = computed(() => props.internalSearch && !props.optionGroups.length && props.options.length > 500)
const virtualList = ref<InstanceType<typeof SearchVirtualOptions> | null>(null)
function selectedLabel(option: SearchMultiSelectOption) {
  return option.selectionLabel ?? option.label
}
function update(values: SearchMultiSelectOption[]) {
  values.forEach(rememberOption)
  const selected = new Set(values.map(option => option.value))
  const known = flatOptions.value.filter(option => selected.has(option.value)).map(option => option.value)
  const unknown = props.modelValue.filter(value => selected.has(value)
    && !flatOptions.value.some(option => option.value === value))
  emit("update:modelValue", [...known, ...unknown])
  clearQuery()
}
function remove(option: SearchMultiSelectOption) {
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
async function keydown(event: KeyboardEvent, open: boolean) {
  if (event.isComposing) return
  if (event.key === "Escape") clearQuery()
  if (event.key === "Tab") {
    // Popup footer actions must not steal the combobox's next Tab stop.
    root.value?.querySelector(".multiselect__content-wrapper")?.setAttribute("inert", "")
    clearQuery()
  }
  if (!(event.target instanceof HTMLInputElement)) return
  if (event.key === "Backspace" && !query.value && selectedOptions.value.length) {
    remove(selectedOptions.value.at(-1)!)
  }
  if (open && virtualList.value && ["Home", "End"].includes(event.key)) {
    event.preventDefault()
    event.stopPropagation()
    await virtualList.value.focusBoundary(event.key === "End")
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
  await nextTick()
}
</script>

<template>
  <span
    :class="$attrs.class"
    :data-library-about-authors="$attrs['data-library-about-authors']"
    :data-library-keywords="$attrs['data-library-keywords']"
    :data-library-languages="$attrs['data-library-languages']"
    :data-library-media="$attrs['data-library-media']"
    :data-library-narrowing="$attrs['data-library-narrowing']"
    :data-preserve-search="preserveSearch || undefined"
    class="filter_select select2 select2-container select2-container--default"
  >
    <Combobox v-slot="{ open, activeOption }" :model-value="selectedOptions" by="value" multiple @update:model-value="update">
      <ComboboxLabel class="sr-only">{{ controlName }}</ComboboxLabel>
      <div
        ref="root"
        class="multiselect select2-selection select2-selection--multiple"
        :class="{ 'multiselect--active': open, 'multiselect--above': above }"
        @mousedown="positionOptions"
        @focusin="positionOptions"
        @keydown.capture="keydown($event, open)"
      >
        <ComboboxButton
          ref="trigger"
          class="select2-selection__arrow multiselect__select"
          :aria-label="`Visa alternativ för ${placeholder}`"
          @click="open && clearQuery()"
        ><b aria-hidden="true" /></ComboboxButton>
        <div class="multiselect__tags">
          <div v-if="selectedOptions.length" class="multiselect__tags-wrap" @pointerdown="chipClickWasOpen = open" @mousedown.prevent @click.prevent.stop="!chipClickWasOpen && toggle()">
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
            :class="selectedOptions.length && persistentInputRow && !open && !preserveSearch
              ? 'search-multiselect__input-row' : 'search-multiselect__native-search'"
            :style="open || selectedOptions.length ? { width: '100%' } : { width: '0', position: 'absolute', padding: '0' }"
            :display-value="() => query"
            :placeholder="placeholder"
            :aria-label="controlName"
            :readonly="!searchable"
            autocomplete="off"
            :spellcheck="false"
            @change="changeQuery"
            @click="clickInput(open)"
            @blur="blurInput"
          />
          <span v-if="!open && !selectedOptions.length" class="multiselect__placeholder" aria-hidden="true" @click="toggle">{{ placeholder }}</span>
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
            :options="groups[0]?.options ?? []"
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
            <li v-if="!groups.length" role="presentation"><span class="multiselect__option">{{ query ? 'Inga matchande alternativ.' : 'Inga alternativ att visa.' }}</span></li>
            <slot name="afterList" />
          </ul>
        </ComboboxOptions>
      </div>
    </Combobox>
  </span>
</template>

<style src="~/assets/styles/search-multi-select.css"></style>
<style scoped>
.multiselect:has(input.multiselect__input:focus-visible) {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
/* The visible row is now the actual accessible combobox input. */
input.search-multiselect__input-row {
  pointer-events: auto;
}
</style>
