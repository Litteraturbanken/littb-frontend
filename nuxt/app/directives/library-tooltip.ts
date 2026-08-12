import type { DirectiveBinding, ObjectDirective, VNode } from "vue"

const libraryTooltipDelay = 500
let libraryTooltipSequence = 0

type LibraryTooltipState = {
  content: string
  hovered: boolean
  focused: boolean
  timer: ReturnType<typeof setTimeout> | null
  popup: HTMLDivElement | null
  previousDescribedBy: string | null
  tabIndexOwned: boolean
  cleanup: () => void
}

const libraryTooltipStates = new WeakMap<HTMLElement, LibraryTooltipState>()

const naturallyFocusableTags = new Set(["button", "input", "select", "textarea", "summary"])

function vnodeHasTabIndex(vnode: VNode): boolean {
  return vnode.props != null
    && (Object.hasOwn(vnode.props, "tabindex") || Object.hasOwn(vnode.props, "tabIndex"))
}

function isNaturallyFocusable(element: HTMLElement): boolean {
  const tag = element.localName
  if (naturallyFocusableTags.has(tag)) return true
  if (tag === "a" && element.hasAttribute("href")) return true
  return element.hasAttribute("contenteditable") && element.getAttribute("contenteditable") !== "false"
}

function releaseLibraryTooltipTabIndex(element: HTMLElement, state: LibraryTooltipState): void {
  if (!state.tabIndexOwned) return
  if (element.getAttribute("tabindex") === "0") element.removeAttribute("tabindex")
  state.tabIndexOwned = false
}

function updateLibraryTooltipTabIndex(
  element: HTMLElement,
  state: LibraryTooltipState,
  vnode?: VNode
): void {
  if (vnode && vnodeHasTabIndex(vnode)) {
    state.tabIndexOwned = false
    return
  }
  if (state.tabIndexOwned) {
    if (element.getAttribute("tabindex") !== "0") {
      state.tabIndexOwned = false
      return
    }
    if (!state.content || isNaturallyFocusable(element)) releaseLibraryTooltipTabIndex(element, state)
    return
  }
  if (!state.content || isNaturallyFocusable(element) || element.hasAttribute("tabindex")) return
  element.setAttribute("tabindex", "0")
  state.tabIndexOwned = true
}

function hideLibraryTooltip(element: HTMLElement, state: LibraryTooltipState): void {
  if (state.timer) clearTimeout(state.timer)
  state.timer = null
  state.popup?.remove()
  state.popup = null
  if (state.previousDescribedBy === null) element.removeAttribute("aria-describedby")
  else element.setAttribute("aria-describedby", state.previousDescribedBy)
}

function showLibraryTooltip(element: HTMLElement, state: LibraryTooltipState): void {
  if (!state.content || state.popup || state.timer || (!state.hovered && !state.focused)) return
  state.timer = setTimeout(() => {
    state.timer = null
    if (!element.isConnected || !state.content || (!state.hovered && !state.focused)) return
    const popup = document.createElement("div")
    const inner = document.createElement("div")
    const arrow = document.createElement("div")
    const id = `library-tooltip-${++libraryTooltipSequence}`
    popup.id = id
    popup.className = "tooltip top in library-tooltip"
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
  }, libraryTooltipDelay)
}

function updateLibraryTooltipVisibility(
  element: HTMLElement,
  state: LibraryTooltipState
): void {
  if (state.hovered || state.focused) showLibraryTooltip(element, state)
  else hideLibraryTooltip(element, state)
}

function mountLibraryTooltip(
  element: HTMLElement,
  binding: DirectiveBinding<string>,
  vnode?: VNode
): void {
  const mouseenter = () => {
    state.hovered = true
    updateLibraryTooltipVisibility(element, state)
  }
  const mouseleave = () => {
    state.hovered = false
    updateLibraryTooltipVisibility(element, state)
  }
  const focus = () => {
    state.focused = true
    updateLibraryTooltipVisibility(element, state)
  }
  const blur = () => {
    state.focused = false
    updateLibraryTooltipVisibility(element, state)
  }
  const state: LibraryTooltipState = {
    content: binding.value || "",
    hovered: false,
    focused: false,
    timer: null,
    popup: null,
    previousDescribedBy: element.getAttribute("aria-describedby"),
    tabIndexOwned: Boolean(
      vnode && !vnodeHasTabIndex(vnode) && !isNaturallyFocusable(element)
      && element.getAttribute("tabindex") === "0"
    ),
    cleanup: () => {
      for (const [event, handler] of [
        ["mouseenter", mouseenter],
        ["mouseleave", mouseleave],
        ["focus", focus],
        ["blur", blur]
      ] as const) element.removeEventListener(event, handler)
    }
  }
  for (const [event, handler] of [
    ["mouseenter", mouseenter],
    ["mouseleave", mouseleave],
    ["focus", focus],
    ["blur", blur]
  ] as const) element.addEventListener(event, handler)
  libraryTooltipStates.set(element, state)
  updateLibraryTooltipTabIndex(element, state, vnode)
}

export const libraryTooltipDirective: ObjectDirective<HTMLElement, string> = {
  getSSRProps(binding) {
    return binding.value ? { "data-library-tooltip-content": binding.value } : {}
  },
  mounted(element, binding, vnode) {
    if (binding.value) mountLibraryTooltip(element, binding, vnode)
  },
  updated(element, binding, vnode) {
    const state = libraryTooltipStates.get(element)
    if (!state) {
      if (binding.value) mountLibraryTooltip(element, binding, vnode)
      return
    }
    if (state.content !== binding.value) hideLibraryTooltip(element, state)
    state.content = binding.value || ""
    updateLibraryTooltipTabIndex(element, state, vnode)
    if (!state.content) {
      state.cleanup()
      libraryTooltipStates.delete(element)
    } else updateLibraryTooltipVisibility(element, state)
  },
  beforeUnmount(element) {
    const state = libraryTooltipStates.get(element)
    if (!state) return
    hideLibraryTooltip(element, state)
    releaseLibraryTooltipTabIndex(element, state)
    state.cleanup()
    libraryTooltipStates.delete(element)
  }
}
