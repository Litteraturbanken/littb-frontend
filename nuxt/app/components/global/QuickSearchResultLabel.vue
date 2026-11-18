<script setup lang="ts">
const props = defineProps<{
  label: string
  active: boolean
  tooltipContainer: HTMLElement | null
}>()

const rowLabel = useTemplateRef<HTMLElement>("label")
const tooltipElement = useTemplateRef<HTMLElement>("tooltip")
const clipped = ref(false)

watchPostEffect(onCleanup => {
  const tooltip = tooltipElement.value
  const anchor = rowLabel.value?.parentElement
  const list = anchor?.closest(".quick-search-options")
  if (!props.active || !props.label || !anchor || !list) {
    clipped.value = false
    return
  }

  const positionTooltip = () => {
    const row = anchor.getBoundingClientRect()
    const options = list.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight
    const gap = 8

    // The desktop search ellipsizes the whole anchor, including its type label.
    clipped.value = anchor.scrollWidth > anchor.clientWidth && row.bottom > options.top && row.top < options.bottom
    if (!clipped.value || !tooltip) return

    const rightSpace = viewportWidth - row.right - 2 * gap
    const fitsBesideRow = rightSpace >= 192
    tooltip.style.maxWidth = `min(24rem, ${fitsBesideRow ? rightSpace : viewportWidth - 2 * gap}px)`
    const { width, height } = tooltip.getBoundingClientRect()
    const left = fitsBesideRow ? row.right + gap : Math.min(row.left, viewportWidth - width - gap)
    const top = !fitsBesideRow && row.bottom + gap + height <= viewportHeight - gap
      ? row.bottom + gap
      : fitsBesideRow ? row.top : row.top - height - gap
    tooltip.style.left = `${Math.max(gap, left)}px`
    tooltip.style.top = `${Math.max(gap, Math.min(top, viewportHeight - height - gap))}px`
    tooltip.style.visibility = "visible"
  }

  const observer = new ResizeObserver(positionTooltip)
  observer.observe(anchor)
  document.fonts.addEventListener("loadingdone", positionTooltip)
  window.addEventListener("resize", positionTooltip)
  window.addEventListener("scroll", positionTooltip, true)

  positionTooltip()
  onCleanup(() => {
    observer.disconnect()
    document.fonts.removeEventListener("loadingdone", positionTooltip)
    window.removeEventListener("resize", positionTooltip)
    window.removeEventListener("scroll", positionTooltip, true)
  })
})
</script>

<template>
  <span ref="label" class="quick-search-label">{{ label }}</span>
  <Teleport v-if="active && clipped && tooltipContainer" :to="tooltipContainer">
    <!-- The option already exposes the complete text to assistive technology. -->
    <span ref="tooltip" class="quick-search-result-tooltip" aria-hidden="true">{{ label }}</span>
  </Teleport>
</template>

<style scoped>
.quick-search-result-tooltip {
  position: fixed;
  z-index: 1051;
  visibility: hidden;
  width: max-content;
  padding: .4em .65em;
  border-radius: 2px;
  background: #333;
  color: #fff;
  font-size: 1rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
  pointer-events: none;
}
</style>
