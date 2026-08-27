import { describe, expect, onTestFinished, test, vi } from "vitest"

const dictionaryGet = vi.hoisted(() => vi.fn(async () => ({
  data: undefined,
  error: { code: "dictionary_unavailable" }
})))

vi.mock("../../app/composables/useLbApiClient", () => ({
  useLbApiClient: () => ({ GET: dictionaryGet })
}))

async function mountLookup() {
  const [{ createApp, defineComponent, h, nextTick, reactive, ref, shallowRef, computed,
    onBeforeMount, onBeforeUnmount, watch }, { default: LegacyNotice }, {
    default: ReaderDictionaryLookup
  }] = await Promise.all([
    import("vue"),
    import("../../app/components/global/LegacyNotice.vue"),
    import("../../app/components/reader/ReaderDictionaryLookup.vue")
  ])
  const route = reactive({
    fullPath: "/reader",
    hash: "",
    path: "/reader",
    query: {} as Record<string, string | null>
  })
  const router = {
    push: vi.fn(),
    replace: vi.fn()
  }
  const embed = {
    close: vi.fn(),
    frame: ref<HTMLIFrameElement | null>(null),
    handleFrameLoad: vi.fn(),
    session: ref(null),
    start: vi.fn(),
    status: ref("closed")
  }
  vi.stubGlobal("computed", computed)
  vi.stubGlobal("nextTick", nextTick)
  vi.stubGlobal("onBeforeMount", onBeforeMount)
  vi.stubGlobal("onBeforeUnmount", onBeforeUnmount)
  vi.stubGlobal("ref", ref)
  vi.stubGlobal("shallowRef", shallowRef)
  vi.stubGlobal("useHead", vi.fn())
  vi.stubGlobal("useReaderDictionaryEmbed", () => embed)
  vi.stubGlobal("useRoute", () => route)
  vi.stubGlobal("useRouter", () => router)
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { readerDictionaryMode: "legacy" }
  }))
  vi.stubGlobal("watch", watch)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  onTestFinished(() => vi.unstubAllGlobals())

  const target = document.createElement("div")
  const reader = document.createElement("section")
  reader.className = "reader_main"
  reader.innerHTML = '<span class="w">DOKTOR</span>'
  document.body.append(reader, target)
  const app = createApp({ setup: () => () => h(ReaderDictionaryLookup) })
  app.component("LegacyNotice", LegacyNotice)
  app.component("ReaderDictionaryDialog", defineComponent({ setup: () => () => null }))
  const instance = app.mount(target) as unknown as {
    $: { subTree: { component: { setupState: { message: string } } } }
  }
  onTestFinished(() => {
    app.unmount()
    reader.remove()
    target.remove()
  })
  await nextTick()

  const word = reader.querySelector<HTMLElement>(".w")!
  Object.defineProperty(window, "getSelection", {
    configurable: true,
    value: () => ({
      getRangeAt: () => ({
        endContainer: word.firstChild,
        startContainer: word.firstChild
      }),
      isCollapsed: false,
      rangeCount: 1,
      removeAllRanges: vi.fn(),
      toString: () => "DOKTOR"
    })
  })

  async function failLookup(): Promise<void> {
    word.dispatchEvent(new window.Event("dblclick", { bubbles: true }))
    await nextTick()
    document.querySelector<HTMLButtonElement>(".search_dict")?.click()
    await Promise.resolve()
    await nextTick()
    expect(dictionaryGet).toHaveBeenCalled()
  }

  return { app, failLookup, instance, nextTick, route, target }
}

describe("ReaderDictionaryLookup transient notice lifecycle", () => {
  test("route changes clear the visible lookup failure and its timer", async () => {
    vi.useFakeTimers()
    onTestFinished(() => vi.useRealTimers())
    const harness = await mountLookup()
    const baselineTimers = vi.getTimerCount()
    await harness.failLookup()
    expect(harness.target.querySelector('[role="status"]')?.textContent)
      .toBe("Hittade inget uppslag")
    expect(vi.getTimerCount()).toBe(baselineTimers + 1)

    harness.route.fullPath = "/reader?om-boken"
    harness.route.query = { "om-boken": null }
    await harness.nextTick()

    expect(harness.target.querySelector('[role="status"]')?.textContent).toBe("")
    expect(vi.getTimerCount()).toBe(baselineTimers)
  })

  test("unmount clears a pending lookup-message timer", async () => {
    vi.useFakeTimers()
    onTestFinished(() => vi.useRealTimers())
    const harness = await mountLookup()
    const baselineTimers = vi.getTimerCount()
    await harness.failLookup()
    expect(vi.getTimerCount()).toBe(baselineTimers + 1)

    harness.app.unmount()

    expect(harness.instance.$.subTree.component.setupState.message).toBe("")
    expect(vi.getTimerCount()).toBe(baselineTimers)
  })
})
