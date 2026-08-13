<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, type CSSProperties } from "vue"

type FocusPart = Readonly<{
  href: string
  label: string
}>

const props = defineProps<{
  barVisible: boolean
  largerSizeEnabled: boolean
  mediaType: "etext" | "faksimil"
  nextHref: string | null
  nightMode: boolean
  parts: FocusPart[]
  previousHref: string | null
  smallerSizeEnabled: boolean
  startHref: string | null
}>()

const emit = defineEmits<{
  adjustText: [delta: number]
  close: []
  navigate: [href: string]
  selectSize: [delta: -1 | 1]
  toggleBar: []
  toggleNight: []
}>()

const settingsOpen = ref(false)
const partsOpen = ref(false)
type FocusViewportStyle = CSSProperties & Record<`--reader-focus-${string}`, string>
const focusViewportStyle = shallowRef<FocusViewportStyle>({})
let focusViewportFrame: number | null = null

function syncFocusViewport(): void {
  const viewport = window.visualViewport
  if (!viewport) {
    focusViewportStyle.value = {}
    return
  }
  focusViewportStyle.value = {
    "--reader-focus-bottom": `${Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height)}px`,
    "--reader-focus-center": `${viewport.offsetLeft + viewport.width / 2}px`,
    "--reader-focus-left": `${viewport.offsetLeft}px`,
    "--reader-focus-right": `${Math.max(0, window.innerWidth - viewport.offsetLeft - viewport.width)}px`,
    "--reader-focus-top": `${viewport.offsetTop}px`,
    "--reader-focus-width": `${viewport.width}px`
  }
}

function scheduleFocusViewportSync(): void {
  if (focusViewportFrame !== null) cancelAnimationFrame(focusViewportFrame)
  focusViewportFrame = requestAnimationFrame(() => {
    focusViewportFrame = null
    syncFocusViewport()
  })
}

onMounted(() => {
  syncFocusViewport()
  document.addEventListener("load", syncFocusViewport, true)
  window.addEventListener("resize", syncFocusViewport)
  window.visualViewport?.addEventListener("resize", syncFocusViewport)
  window.visualViewport?.addEventListener("scroll", syncFocusViewport)
})

onBeforeUnmount(() => {
  if (focusViewportFrame !== null) cancelAnimationFrame(focusViewportFrame)
  document.removeEventListener("load", syncFocusViewport, true)
  window.removeEventListener("resize", syncFocusViewport)
  window.visualViewport?.removeEventListener("resize", syncFocusViewport)
  window.visualViewport?.removeEventListener("scroll", syncFocusViewport)
})

watch(() => props.mediaType, () => {
  settingsOpen.value = false
})
watch(
  [() => props.smallerSizeEnabled, () => props.largerSizeEnabled],
  scheduleFocusViewportSync,
  { flush: "post" }
)

function navigatePage(event: MouseEvent, href: string): void {
  if (
    event.defaultPrevented
    || event.button !== 0
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey
  ) return
  event.preventDefault()
  event.stopPropagation()
  emit("navigate", href)
}
</script>

<template>
  <Teleport to="body">
    <div class="reader-focus-layer" :style="focusViewportStyle" @click.stop>
      <button
        type="button"
        class="focus-bar-toggle"
        :class="{ 'bar-visible': barVisible }"
        :aria-controls="'reader-focus-toolbar'"
        :aria-expanded="barVisible"
        :aria-label="barVisible ? 'Dölj verktygsfält' : 'Visa verktygsfält'"
        @click="emit('toggleBar')"
      ><i class="fa" :class="barVisible ? 'fa-angle-down' : 'fa-angle-up'" aria-hidden="true" /></button>
      <a
        v-if="previousHref"
        class="leftCover"
        :href="previousHref"
        aria-label="Föregående sida"
        @click="navigatePage($event, previousHref)"
      />
      <a
        v-if="nextHref"
        class="rightCover"
        :href="nextHref"
        aria-label="Nästa sida"
        @click="navigatePage($event, nextHref)"
      />

      <div v-show="barVisible" id="reader-focus-toolbar" class="bottomBar" role="toolbar" aria-label="Läsfokus">
        <span class="focus-control-menu focus-settings-menu">
          <button
            type="button"
            class="focus-control-button"
            aria-label="Textinställningar"
            :aria-expanded="settingsOpen"
            @click="settingsOpen = !settingsOpen"
          ><span class="letters sans bold" aria-hidden="true">A a</span></button>
          <span v-if="settingsOpen" class="text_menu text focus-menu">
            <template v-if="mediaType === 'etext'">
              <span class="focus-size-buttons">
                <button type="button" class="small_text btn btn-small" aria-label="Mindre text" @click="emit('adjustText', -0.1)">Mindre<br>text</button>
                <button type="button" class="btn btn-small" aria-label="Större text" @click="emit('adjustText', 0.1)">Större<br>text</button>
              </span>
              <button
                type="button"
                class="night_switch"
                aria-label="Nattläge"
                :aria-pressed="nightMode"
                @click="emit('toggleNight')"
              ><span class="icon" :class="nightMode ? 'off' : 'on'" aria-hidden="true" /><span class="label">{{ nightMode ? "Ljust läge" : "Nattläge" }}</span></button>
            </template>
            <template v-else>
              <button
                type="button"
                aria-label="Mindre bild"
                :disabled="!smallerSizeEnabled"
                @click="emit('selectSize', -1)"
              ><i class="fa fa-search-minus" aria-hidden="true" /></button>
              <button
                type="button"
                aria-label="Större bild"
                :disabled="!largerSizeEnabled"
                @click="emit('selectSize', 1)"
              ><i class="fa fa-search-plus" aria-hidden="true" /></button>
            </template>
          </span>
        </span>

        <a v-if="previousHref" class="nav left" :href="previousHref" aria-label="Föregående sida" @click="navigatePage($event, previousHref)"><i class="fa fa-angle-left" aria-hidden="true" /></a>
        <span v-else class="nav left disabled" aria-hidden="true"><i class="fa fa-angle-left" /></span>{{ " " }}

        <a v-if="nextHref" class="nav right" :href="nextHref" aria-label="Nästa sida" @click="navigatePage($event, nextHref)"><i class="fa fa-angle-right" aria-hidden="true" /></a>
        <span v-else class="nav right disabled" aria-hidden="true"><i class="fa fa-angle-right" /></span>{{ " " }}

        <span class="focus-control-menu focus-parts-menu">
          <button
            type="button"
            class="focus-control-button"
            aria-label="Innehåll i Läsfokus"
            :aria-expanded="partsOpen"
            @click="partsOpen = !partsOpen"
          ><i class="fa fa-list-ul" aria-hidden="true" /></button>
          <span v-if="partsOpen" class="focus-parts focus-menu">
            <NuxtLink v-if="startHref" :to="startHref">Start</NuxtLink>
            <NuxtLink v-for="part in parts" :key="`${part.href}:${part.label}`" :to="part.href">{{ part.label }}</NuxtLink>
          </span>
        </span>

        <button type="button" class="focus-close" aria-label="Stäng Läsfokus" @click="emit('close')"><i class="close_btn fa fa-times" aria-hidden="true" /></button>
      </div>
    </div>
  </Teleport>
</template>
