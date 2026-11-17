// Prototype: animate artwork independently of routing and page data.
// Never return an image/animation promise from a navigation or Nuxt hook.
const FADE_MS = 240
const IMAGE_BUDGET_MS = 150
const BACKGROUND_METADATA_BUDGET_MS = 1000
const HOME_IMAGE_BUDGET_MS = 750

type Background = {
  image: string
  color: string
  position: string
  size: string
  repeat: string
  width: number
  height: number
  left: number
  top: number
}

function readBackground(): { image: string, paints: Background[] } | null {
  const root = document.documentElement
  const body = document.body
  const rootStyle = getComputedStyle(root)
  const bodyStyle = getComputedStyle(body)
  const owner = bodyStyle.backgroundImage !== "none" ? body : root
  const image = (owner === body ? bodyStyle : rootStyle).backgroundImage
  // Only single image backgrounds participate; readers and plain pages stay instant.
  if (!/^url\("[^"\n]+"\)$/.test(image)) return null
  // Mobile paints artwork on both html and body. Preserve both origins,
  // including the root visible through body margins, to avoid a top-edge seam.
  const paints = [root, ...(owner === body ? [body] : [])].map((element): Background => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      image: style.backgroundImage,
      color: style.backgroundColor,
      position: style.backgroundPosition,
      size: style.backgroundSize,
      repeat: style.backgroundRepeat,
      width: rect.width,
      height: Math.max(rect.height, window.innerHeight - rect.top),
      left: style.backgroundAttachment === "fixed" ? 0 : rect.left,
      top: style.backgroundAttachment === "fixed" ? 0 : rect.top
    }
  })
  return { image, paints }
}

export default defineNuxtPlugin(nuxtApp => {
  const router = useRouter()
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let previous: ReturnType<typeof readBackground> = null
  let lastBackground: ReturnType<typeof readBackground> = null
  let layer: HTMLDivElement | null = null
  let animation: Animation | null = null
  let timeout: ReturnType<typeof setTimeout> | undefined
  let revision = 0
  let observer: MutationObserver | undefined

  function cancel() {
    revision += 1
    previous = null
    clearTimeout(timeout)
    animation?.cancel()
    animation = null
    layer?.remove()
    layer = null
    document.body.classList.remove("background-crossfade-active")
  }

  const removeGuard = router.beforeEach((to, from) => {
    cancel()
    if (to.path !== from.path && !reducedMotion.matches) {
      // Home clears its lazy content in onBeforeRouteLeave, before this guard.
      previous = readBackground() ?? (from.path === "/" ? lastBackground : null)
    }
  })
  const removeAfter = router.afterEach((_to, _from, failure) => { if (failure) cancel() })
  const removeError = router.onError(cancel)

  function showOutgoing(old: NonNullable<ReturnType<typeof readBackground>>) {
    if (layer) return layer
    const outgoing = document.createElement("div")
    outgoing.className = "background-crossfade-layer"
    outgoing.setAttribute("aria-hidden", "true")
    for (const paint of old.paints) {
      const surface = document.createElement("div")
      Object.assign(surface.style, {
        position: "absolute",
        backgroundImage: paint.image,
        backgroundColor: paint.color,
        backgroundPosition: paint.position,
        backgroundSize: paint.size,
        backgroundRepeat: paint.repeat,
        width: `${paint.width}px`,
        height: `${paint.height}px`,
        left: `${paint.left}px`,
        top: `${paint.top}px`
      })
      outgoing.append(surface)
    }
    layer = outgoing
    document.body.classList.add("background-crossfade-active")
    document.body.prepend(outgoing)

    return outgoing
  }

  function onBackgroundChange() {
    const next = readBackground()
    if (next) lastBackground = next
    if (!previous || reducedMotion.matches) return
    if (!next) {
      if (router.currentRoute.value.path !== "/") { cancel(); return }
      // Lazy home metadata briefly removes the image. Keep only the artwork;
      // the destination content continues rendering and remains interactive.
      if (!layer) {
        showOutgoing(previous)
        timeout = setTimeout(cancel, BACKGROUND_METADATA_BUDGET_MS)
      }
      return
    }
    if (next.image === previous.image) {
      if (layer) cancel()
      return
    }
    const outgoing = showOutgoing(previous)
    previous = null
    const currentRevision = revision
    clearTimeout(timeout)

    // A slow or failed image skips the effect. The new page is already interactive.
    timeout = setTimeout(cancel, router.currentRoute.value.path === "/"
      ? HOME_IMAGE_BUDGET_MS
      : IMAGE_BUDGET_MS)
    const image = new Image()
    image.src = next.image.slice(5, -2)
    void image.decode().then(() => {
      if (revision !== currentRevision || layer !== outgoing) return
      clearTimeout(timeout)
      animation = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: FADE_MS,
        easing: "ease-out",
        fill: "forwards"
      })
      void animation.finished.then(() => {
        if (revision === currentRevision) cancel()
      }, () => {})
    }, () => { if (revision === currentRevision) cancel() })
  }

  nuxtApp.hook("app:mounted", () => {
    lastBackground = readBackground()
    observer = new MutationObserver(onBackgroundChange)
    for (const target of [document.documentElement, document.body]) {
      observer.observe(target, { attributes: true, attributeFilter: ["style", "class"] })
    }
  })
  reducedMotion.addEventListener("change", cancel)
  window.addEventListener("resize", cancel)
  if (import.meta.hot) import.meta.hot.dispose(() => {
    cancel()
    observer?.disconnect()
    removeGuard()
    removeAfter()
    removeError()
    reducedMotion.removeEventListener("change", cancel)
    window.removeEventListener("resize", cancel)
  })
})
