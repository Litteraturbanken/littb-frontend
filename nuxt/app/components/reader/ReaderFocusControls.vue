<script setup lang="ts">
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
  toggleNight: []
}>()

const settingsOpen = ref(false)
const partsOpen = ref(false)

watch(() => props.mediaType, () => {
  settingsOpen.value = false
})
</script>

<template>
  <Teleport to="body">
    <div class="reader-focus-layer" @click.stop>
      <a
        v-if="previousHref"
        class="leftCover"
        :href="previousHref"
        aria-label="Föregående sida"
        @click.prevent="emit('navigate', previousHref)"
      />
      <a
        v-if="nextHref"
        class="rightCover"
        :href="nextHref"
        aria-label="Nästa sida"
        @click.prevent="emit('navigate', nextHref)"
      />

      <div v-show="barVisible" class="bottomBar" role="toolbar" aria-label="Läsfokus">
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
                :aria-label="nightMode ? 'Ljust läge' : 'Nattläge'"
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

        <a v-if="previousHref" class="nav left" :href="previousHref" aria-label="Föregående sida" @click.prevent="emit('navigate', previousHref)"><i class="fa fa-angle-left" aria-hidden="true" /></a>
        <span v-else class="nav left disabled" aria-hidden="true"><i class="fa fa-angle-left" /></span>{{ " " }}

        <a v-if="nextHref" class="nav right" :href="nextHref" aria-label="Nästa sida" @click.prevent="emit('navigate', nextHref)"><i class="fa fa-angle-right" aria-hidden="true" /></a>
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
