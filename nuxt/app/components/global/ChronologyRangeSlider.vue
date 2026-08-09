<script setup lang="ts">
type ChronologyEndpoint = "from" | "to"

const props = defineProps<{
  min: number
  max: number
  from: number | string
  to: number | string
  fromLabel: string
  toLabel: string
}>()

const emit = defineEmits<{
  cancel: []
  commit: [endpoint: ChronologyEndpoint, value: string]
  draft: [endpoint: ChronologyEndpoint, value: string]
}>()

const activePointer = ref<{
  endpoint: ChronologyEndpoint
  pointerId: number
  value: string
} | null>(null)

const rangeStyle = computed(() => {
  const span = props.max - props.min
  const percentage = (value: number | string, fallback: number) => {
    const numeric = Number(value)
    if (span <= 0 || !Number.isFinite(numeric)) return fallback
    return Math.max(0, Math.min(100, (numeric - props.min) / span * 100))
  }
  return {
    "--chronology-from": `${percentage(props.from, 0)}%`,
    "--chronology-to": `${percentage(props.to, 100)}%`
  }
})

function pointerYear(event: PointerEvent): number | null {
  if (!(event.currentTarget instanceof HTMLElement)) return null
  const box = event.currentTarget.getBoundingClientRect()
  const usableWidth = Math.max(1, box.width - 20)
  const fraction = Math.max(0, Math.min(1, (event.clientX - box.left - 10) / usableWidth))
  return Math.round(props.min + fraction * (props.max - props.min))
}

function closestEndpoint(year: number): ChronologyEndpoint {
  const from = Number(props.from)
  const fromDistance = Math.abs(year - from)
  const toDistance = Math.abs(year - Number(props.to))
  if (fromDistance < toDistance) return "from"
  if (fromDistance > toDistance) return "to"
  return year < from ? "from" : "to"
}

function boundedValue(endpoint: ChronologyEndpoint, year: number): string {
  const other = Number(endpoint === "from" ? props.to : props.from)
  if (!Number.isFinite(other)) return String(year)
  return String(endpoint === "from" ? Math.min(year, other) : Math.max(year, other))
}

function publishPointerDraft(event: PointerEvent): void {
  const active = activePointer.value
  if (!active) return
  const year = pointerYear(event)
  if (year === null) return
  active.value = boundedValue(active.endpoint, year)
  emit("draft", active.endpoint, active.value)
}

function beginPointer(event: PointerEvent): void {
  const track = event.currentTarget
  if (event.button !== 0 || !(track instanceof HTMLElement)) return
  const year = pointerYear(event)
  if (year === null) return
  event.preventDefault()
  const endpoint = closestEndpoint(year)
  activePointer.value = { endpoint, pointerId: event.pointerId, value: boundedValue(endpoint, year) }
  track.querySelector<HTMLInputElement>(`input[data-range-endpoint="${endpoint}"]`)
    ?.focus({ preventScroll: true })
  track.setPointerCapture(event.pointerId)
  emit("draft", endpoint, activePointer.value.value)
}

function movePointer(event: PointerEvent): void {
  if (activePointer.value?.pointerId !== event.pointerId) return
  publishPointerDraft(event)
}

function finishPointer(event: PointerEvent): void {
  const active = activePointer.value
  if (!active || active.pointerId !== event.pointerId) return
  publishPointerDraft(event)
  const value = activePointer.value?.value ?? active.value
  activePointer.value = null
  emit("commit", active.endpoint, value)
}

function cancelPointer(event: PointerEvent): void {
  if (activePointer.value?.pointerId !== event.pointerId) return
  activePointer.value = null
  emit("cancel")
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}
</script>

<template>
  <div
    class="rzslider"
    :style="rangeStyle"
    @pointerdown="beginPointer"
    @pointermove="movePointer"
    @pointerup="finishPointer"
    @pointercancel="cancelPointer"
    @lostpointercapture="cancelPointer"
  >
    <input
      type="range"
      data-range-endpoint="from"
      :min="min"
      :max="max"
      step="1"
      :value="from"
      :aria-label="fromLabel"
      @input="emit('draft', 'from', inputValue($event))"
      @change="emit('commit', 'from', inputValue($event))"
    >
    <input
      type="range"
      data-range-endpoint="to"
      :min="min"
      :max="max"
      step="1"
      :value="to"
      :aria-label="toLabel"
      @input="emit('draft', 'to', inputValue($event))"
      @change="emit('commit', 'to', inputValue($event))"
    >
  </div>
</template>

<style scoped>
input[type="range"] {
  appearance: none;
  position: absolute;
  top: -2px;
  left: 0;
  width: 100%;
  height: 20px;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  pointer-events: none;
}

input[type="range"]::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 4px;
  background: transparent;
}

input[type="range"]::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: transparent;
}

input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: -6px;
  border: 1px solid darkgrey;
  border-radius: 50%;
  background: white;
  box-shadow: 1px 1px 3px grey;
  pointer-events: auto;
}

input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border: 1px solid darkgrey;
  border-radius: 50%;
  background: white;
  box-shadow: 1px 1px 3px grey;
  pointer-events: auto;
}
</style>
