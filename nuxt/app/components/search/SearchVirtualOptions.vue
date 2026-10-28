<script setup lang="ts">
// Headless UI Vue 1.7.23 declares a virtual prop but hardcodes its internal
// virtual context to null. Keep this adapter until native support is enabled.
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { ComboboxOption } from "@headlessui/vue"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/vue-virtual"
import type { SearchMultiSelectOption } from "./SearchMultiSelect.vue"

const props = defineProps<{ options: readonly SearchMultiSelectOption[]; activeOption?: unknown }>()
const root = ref<HTMLElement | null>(null)
const pendingFocus = ref<number | null>(null)
let boundaryRequest = 0
function cancelBoundary() {
  boundaryRequest += 1
  pendingFocus.value = null
}
watch(() => props.options, (options, previous) => {
  // Filter responses can replace every author object without changing the list.
  // Only a different navigable context invalidates an in-flight boundary key.
  if (options.length !== previous.length || options.some((option, index) =>
    option.value !== previous[index]?.value || !!option.disabled !== !!previous[index]?.disabled
  )) cancelBoundary()
}, { flush: "sync" })
onBeforeUnmount(cancelBoundary)
const virtualizer = useVirtualizer(computed(() => ({
  count: props.options.length,
  getScrollElement: () => root.value?.parentElement ?? null,
  estimateSize: () => 28,
  overscan: 20,
  // Keep Headless UI's active option registered when scrolling beyond it.
  // Otherwise unregistering it activates another row and scrolls back.
  rangeExtractor: range => {
    const indices = defaultRangeExtractor(range)
    const active = props.options.findIndex(option => option.value === (props.activeOption as SearchMultiSelectOption | undefined)?.value)
    if (active >= 0 && !indices.includes(active)) indices.push(active)
    if (pendingFocus.value !== null && !indices.includes(pendingFocus.value)) indices.push(pendingFocus.value)
    return indices.sort((a, b) => a - b)
  },
  getItemKey: (index: number) => props.options[index]!.value
})))
const items = computed(() => virtualizer.value.getVirtualItems())
function measure(element: unknown) {
  const node = (element as { $el?: HTMLElement } | null)?.$el
  if (node) virtualizer.value.measureElement(node)
}
async function focusBoundary(last: boolean) {
  // A newer key or option context owns both activation and the pinned row.
  // An older Home request must never clear a subsequent End request's pin.
  const request = ++boundaryRequest
  const current = () => request === boundaryRequest
  let index = last ? props.options.length - 1 : 0
  const direction = last ? -1 : 1
  while (props.options[index]?.disabled) index += direction
  if (!props.options[index]) {
    pendingFocus.value = null
    return
  }
  pendingFocus.value = index
  await nextTick()
  if (!current()) return
  virtualizer.value.scrollToIndex(index, { align: last ? "end" : "start" })
  // Scrolling and measuring variable-height rows settles across animation frames.
  for (let frame = 0; frame < 60; frame++) {
    await nextTick()
    if (!current()) return
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    if (!current()) return
    const option = root.value?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    if (!option || frame < 2 || virtualizer.value.isScrolling) continue
    // Headless UI registers newly mounted options on the next animation frame.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    if (!current()) return
    if (!root.value?.contains(option)) continue
    // Keep an already-active boundary stable. Re-dispatching focus would
    // clear Headless UI's default first-option index until its next frame.
    if ((props.activeOption as SearchMultiSelectOption | undefined)?.value !== props.options[index]?.value) {
      // Activate through Headless UI while DOM focus remains on the input.
      option.dispatchEvent(new FocusEvent("focus"))
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      if (!current()) return
    }
    pendingFocus.value = null
    return
  }
  if (current()) pendingFocus.value = null
}
defineExpose({ focusBoundary })
</script>

<template>
  <div ref="root" role="presentation" :style="{ height: options.length ? `${virtualizer.getTotalSize()}px` : undefined, position: 'relative', width: '100%' }">
    <span v-if="!options.length" class="multiselect__option">Inga matchande alternativ.</span>
    <ComboboxOption
      v-for="item in items"
      :key="String(item.key)"
      :ref="measure"
      v-slot="{ active, selected }"
      as="div"
      :value="options[item.index]"
      :disabled="options[item.index]?.disabled"
      :order="item.index"
      :data-index="item.index"
      :aria-setsize="options.length"
      :aria-posinset="item.index + 1"
      class="multiselect__element"
      :style="{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }"
    >
      <span
class="multiselect__option" :class="{
        'multiselect__option--highlight': active,
        'multiselect__option--selected': selected,
        'multiselect__option--disabled': options[item.index]?.disabled
      }"><span class="select2-results__option">{{ options[item.index]?.label }}</span></span>
    </ComboboxOption>
  </div>
</template>
