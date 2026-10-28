<script setup lang="ts">
// Measured height keeps wrapped/mobile content at its natural size. Only the
// transition clips overflow; menus and other children remain unclipped at rest.
const motion = new WeakMap<HTMLElement, Animation>()
const spacing = new WeakMap<HTMLElement, { marginTop: string, marginBottom: string }>()

function cancel(element: Element): void {
    const panel = element as HTMLElement
    const animation = motion.get(panel)
    if (!animation) return
    const current = getComputedStyle(panel)
    panel.style.height = `${panel.getBoundingClientRect().height}px`
    panel.style.opacity = current.opacity
    panel.style.marginTop = current.marginTop
    panel.style.marginBottom = current.marginBottom
    animation.cancel()
    motion.delete(panel)
}

function animate(element: Element, done: () => void, entering: boolean): void {
    const panel = element as HTMLElement
    panel.inert = !entering
    if (typeof panel.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        done()
        return
    }
    const style = getComputedStyle(panel)
    const interrupted = panel.style.height !== ""
    if (!spacing.has(panel)) spacing.set(panel, { marginTop: style.marginTop, marginBottom: style.marginBottom })
    const expanded = { height: `${panel.scrollHeight}px`, opacity: 1, ...spacing.get(panel)! }
    const collapsed = { height: "0px", opacity: 0, marginTop: "0px", marginBottom: "0px" }
    const current = {
        height: `${panel.getBoundingClientRect().height}px`, opacity: style.opacity,
        marginTop: style.marginTop, marginBottom: style.marginBottom
    }
    panel.style.overflow = "hidden"
    const animation = panel.animate(
        [entering && !interrupted ? collapsed : current, entering ? expanded : collapsed],
        { duration: entering ? 180 : 140, easing: entering ? "cubic-bezier(.2,.7,.2,1)" : "ease-in", fill: "both" }
    )
    motion.set(panel, animation)
    animation.onfinish = () => {
        motion.delete(panel)
        spacing.delete(panel)
        animation.cancel()
        for (const property of ["height", "opacity", "overflow", "margin-top", "margin-bottom"]) panel.style.removeProperty(property)
        done()
    }
}
</script>

<template>
    <Transition
        :css="false"
        @enter="(element, done) => animate(element, done, true)"
        @leave="(element, done) => animate(element, done, false)"
        @enter-cancelled="cancel"
        @leave-cancelled="cancel"
    ><slot /></Transition>
</template>
