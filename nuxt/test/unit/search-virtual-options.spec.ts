// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const controls = vi.hoisted(() => ({ scrollToIndex: vi.fn(), focused: [] as string[] }))

// Keep DOM mounting real while controlling the animation-frame boundary. This
// isolates request cancellation from scrolling/measurement timing in a browser.
vi.mock("@tanstack/vue-virtual", async () => {
  const { computed } = await import("vue")
  return {
    defaultRangeExtractor: () => [],
    useVirtualizer: (config: { value: { count: number; getItemKey: (index: number) => string } }) => computed(() => ({
      getTotalSize: () => config.value.count * 28,
      getVirtualItems: () => Array.from({ length: config.value.count }, (_, index) => ({
        index, key: config.value.getItemKey(index), start: index * 28
      })),
      measureElement: () => {},
      scrollToIndex: controls.scrollToIndex,
      isScrolling: false
    }))
  }
})
vi.mock("@headlessui/vue", async () => {
  const { defineComponent, h } = await import("vue")
  return {
    ComboboxOption: defineComponent({
      props: { value: { type: Object, required: true } },
      setup: (props, { slots }) => () => h("div", {
        role: "option", onFocus: () => controls.focused.push(props.value.value)
      }, slots.default?.({ active: false, selected: false }))
    })
  }
})
beforeEach(() => {
  controls.focused.length = 0
  controls.scrollToIndex.mockClear()
  vi.useFakeTimers()
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

async function mountOptions() {
  const [{ createApp, h, nextTick, ref, ssrContextKey }, { default: SearchVirtualOptions }] = await Promise.all([
    import("vue"), import("../../app/components/search/SearchVirtualOptions.vue")
  ])
  const options = ref(Array.from({ length: 60 }, (_, index) => ({ value: `old-${index}`, label: `Author ${index}` })))
  const activeOption = ref<{ value: string; label: string }>()
  const instance = ref<{ focusBoundary: (last: boolean) => Promise<void> } | null>(null)
  const target = document.createElement("div")
  document.body.append(target)
  const app = createApp({ setup: () => () => h(SearchVirtualOptions, { ref: instance, options: options.value, activeOption: activeOption.value }) })
  app.provide(ssrContextKey, { modules: new Set<string>() })
  app.mount(target)
  await nextTick()
  return { options, activeOption, instance, nextTick, unmount: () => { app.unmount(); target.remove() } }
}

describe("virtual option boundary request ownership", () => {
  test("End includes the final action in the logical virtual row count", async () => {
    const mounted = await mountOptions()
    try {
      mounted.options.value.push({ value: "show-all-action", label: "Show all titles" })
      await mounted.nextTick()
      const end = mounted.instance.value!.focusBoundary(true)
      await vi.advanceTimersByTimeAsync(200)
      await end
      expect(controls.scrollToIndex).toHaveBeenLastCalledWith(60, { align: "end" })
      expect(controls.focused).toEqual(["show-all-action"])
    } finally { mounted.unmount() }
  })
  test.each([false, true])("rapid opposing boundaries only activate the latest request (last=%s)", async (last) => {
    const mounted = await mountOptions()
    try {
      const previous = mounted.instance.value!.focusBoundary(!last)
      await mounted.nextTick()
      const latest = mounted.instance.value!.focusBoundary(last)
      await vi.advanceTimersByTimeAsync(200)
      await Promise.all([previous, latest])
      expect(controls.focused).toEqual([last ? "old-59" : "old-0"])
      expect(controls.scrollToIndex).toHaveBeenLastCalledWith(last ? 59 : 0, { align: last ? "end" : "start" })
    } finally { mounted.unmount() }
  })
  test("an already-active first boundary is not reactivated", async () => {
    const mounted = await mountOptions()
    try {
      mounted.activeOption.value = mounted.options.value[0]
      await mounted.nextTick()
      const home = mounted.instance.value!.focusBoundary(false)
      await vi.advanceTimersByTimeAsync(200)
      await home
      expect(controls.focused).toEqual([])
      expect(controls.scrollToIndex).toHaveBeenCalledWith(0, { align: "start" })
    } finally { mounted.unmount() }
  })
  test("an equal option refresh preserves a pending End activation", async () => {
    const mounted = await mountOptions()
    try {
      const end = mounted.instance.value!.focusBoundary(true)
      await mounted.nextTick()
      await vi.advanceTimersByTimeAsync(32)
      // Filter responses rebuild author objects while scrolling settles.
      mounted.options.value = mounted.options.value.map(option => ({ ...option }))
      await mounted.nextTick()
      await vi.advanceTimersByTimeAsync(200)
      await end
      expect(controls.focused).toEqual(["old-59"])
    } finally { mounted.unmount() }
  })
  test("changing the option context cancels a pending boundary activation", async () => {
    const mounted = await mountOptions()
    try {
      const end = mounted.instance.value!.focusBoundary(true)
      await mounted.nextTick()
      const scrollCalls = controls.scrollToIndex.mock.calls.length
      mounted.options.value = mounted.options.value.map((option, index) => ({ ...option, value: `new-${index}` }))
      await mounted.nextTick()
      await vi.advanceTimersByTimeAsync(1100)
      await end
      expect(controls.focused).toEqual([])
      expect(controls.scrollToIndex).toHaveBeenCalledTimes(scrollCalls)
    } finally { mounted.unmount() }
  })
  test("closing the virtual list cancels its pending boundary activation", async () => {
    const mounted = await mountOptions()
    const end = mounted.instance.value!.focusBoundary(true)
    mounted.unmount()
    await vi.advanceTimersByTimeAsync(1100)
    await end
    expect(controls.focused).toEqual([])
    expect(controls.scrollToIndex).not.toHaveBeenCalled()
  })
})
