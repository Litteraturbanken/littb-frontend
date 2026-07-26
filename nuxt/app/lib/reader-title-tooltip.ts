import type { DirectiveBinding, ObjectDirective } from "vue"

const readerTitleTooltipDelay = 500
let readerTitleTooltipSequence = 0

type ReaderTitleTooltipState = {
  content: string
  hovered: boolean
  focused: boolean
  timer: ReturnType<typeof setTimeout> | null
  popup: HTMLDivElement | null
  previousDescribedBy: string | null
  cleanup: () => void
}

const readerTitleTooltipStates = new WeakMap<HTMLElement, ReaderTitleTooltipState>()

function hideReaderTitleTooltip(element: HTMLElement, state: ReaderTitleTooltipState): void {
  if (state.timer) clearTimeout(state.timer)
  state.timer = null
  state.popup?.remove()
  state.popup = null
  if (state.previousDescribedBy === null) element.removeAttribute("aria-describedby")
  else element.setAttribute("aria-describedby", state.previousDescribedBy)
}

function showReaderTitleTooltip(element: HTMLElement, state: ReaderTitleTooltipState): void {
  if (!state.content || state.popup || state.timer || (!state.hovered && !state.focused)) return
  state.timer = setTimeout(() => {
    state.timer = null
    if (!element.isConnected || !state.content || (!state.hovered && !state.focused)) return
    const popup = document.createElement("div")
    const inner = document.createElement("div")
    const arrow = document.createElement("div")
    const id = `reader-title-tooltip-${++readerTitleTooltipSequence}`
    popup.id = id
    popup.className = "tooltip top in reader-title-tooltip"
    popup.role = "tooltip"
    popup.style.position = "fixed"
    popup.style.pointerEvents = "none"
    inner.className = "tooltip-inner"
    inner.textContent = state.content
    arrow.className = "tooltip-arrow"
    popup.append(inner, arrow)
    document.body.append(popup)
    const rect = element.getBoundingClientRect()
    popup.style.left = `${rect.left + rect.width / 2}px`
    popup.style.top = `${rect.top}px`
    popup.style.transform = "translate(-50%, -100%)"
    state.popup = popup
    element.setAttribute("aria-describedby", id)
  }, readerTitleTooltipDelay)
}

function updateReaderTitleTooltipVisibility(
  element: HTMLElement,
  state: ReaderTitleTooltipState
): void {
  if (state.hovered || state.focused) showReaderTitleTooltip(element, state)
  else hideReaderTitleTooltip(element, state)
}

function mountReaderTitleTooltip(
  element: HTMLElement,
  binding: DirectiveBinding<string>
): void {
  const mouseenter = () => {
    state.hovered = true
    updateReaderTitleTooltipVisibility(element, state)
  }
  const mouseleave = () => {
    state.hovered = false
    updateReaderTitleTooltipVisibility(element, state)
  }
  const focus = () => {
    state.focused = true
    updateReaderTitleTooltipVisibility(element, state)
  }
  const blur = () => {
    state.focused = false
    updateReaderTitleTooltipVisibility(element, state)
  }
  const state: ReaderTitleTooltipState = {
    content: binding.value || "",
    hovered: false,
    focused: false,
    timer: null,
    popup: null,
    previousDescribedBy: element.getAttribute("aria-describedby"),
    cleanup: () => {
      for (const [event, handler] of [
        ["mouseenter", mouseenter], ["mouseleave", mouseleave], ["focus", focus], ["blur", blur]
      ] as const) element.removeEventListener(event, handler)
    }
  }
  for (const [event, handler] of [
    ["mouseenter", mouseenter], ["mouseleave", mouseleave], ["focus", focus], ["blur", blur]
  ] as const) element.addEventListener(event, handler)
  readerTitleTooltipStates.set(element, state)
}

export const readerTitleTooltipDirective: ObjectDirective<HTMLElement, string> = {
  getSSRProps(binding) {
    return binding.value ? { "data-reader-title-tooltip-content": binding.value } : {}
  },
  mounted(element, binding) {
    if (binding.value) mountReaderTitleTooltip(element, binding)
  },
  updated(element, binding) {
    const state = readerTitleTooltipStates.get(element)
    if (!state) {
      if (binding.value) mountReaderTitleTooltip(element, binding)
      return
    }
    if (state.content !== binding.value) hideReaderTitleTooltip(element, state)
    state.content = binding.value || ""
    if (!state.content) {
      state.cleanup()
      readerTitleTooltipStates.delete(element)
    } else {
      updateReaderTitleTooltipVisibility(element, state)
    }
  },
  beforeUnmount(element) {
    const state = readerTitleTooltipStates.get(element)
    if (!state) return
    hideReaderTitleTooltip(element, state)
    state.cleanup()
    readerTitleTooltipStates.delete(element)
  }
}
