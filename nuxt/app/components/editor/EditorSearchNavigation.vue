<script setup lang="ts">
import type { components } from "~/lib/api/generated/lbapi"

type WorkSearchHit = components["schemas"]["WorkSearchHit"]

defineProps<{
  activeHit: WorkSearchHit | null
  currentPageName: string | null
  failed: boolean
  loading: boolean
  nextHref: string | null
  nextHit: WorkSearchHit | null
  previousHref: string | null
  previousHit: WorkSearchHit | null
  returnHref: string | null
  totalHits: number | null
}>()

const emit = defineEmits<{
  close: []
  navigate: [index: number]
}>()

const gotoOpen = ref(false)
const gotoOrdinal = ref("")
const gotoInput = ref<HTMLInputElement | null>(null)

function toggleGoto(): void {
  gotoOpen.value = !gotoOpen.value
  if (gotoOpen.value) void nextTick(() => gotoInput.value?.focus())
}

function submitGoto(): void {
  if (!/^[1-9]\d*$/.test(gotoOrdinal.value)) {
    gotoInput.value?.focus()
    return
  }
  emit("navigate", Number(gotoOrdinal.value) - 1)
}

function navigateCached(event: MouseEvent, index: number): void {
  if (
    event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey ||
    event.metaKey || event.shiftKey
  ) return
  event.preventDefault()
  emit("navigate", index)
}
</script>

<template>
  <div>
    <i class="spinner_search fa fa-spinner fa-pulse" :class="{ searching: loading }" aria-hidden="true" />
    <nav id="search_nav" class="active" aria-label="Sökträffsnavigering">
      <div v-if="totalHits !== null" class="text">
        <div><span class="num">{{ totalHits }}</span> {{ totalHits === 1 ? "sökträff" : "sökträffar" }}</div>
        <div v-if="activeHit">Träff <span>{{ activeHit.index + 1 }}</span>, sida {{ currentPageName }}</div>
      </div>
      <p v-else-if="failed" class="text">Sökträffen kunde inte hämtas.</p>
      <ul class="ctrls">
        <li class="arrows">
          <a
            v-if="previousHit && previousHref"
            rel="prev"
            :href="previousHref"
            aria-label="Föregående sökträff"
            @click="navigateCached($event, previousHit.index)"
          ><span class="submit btn navicon navicon-visual left" aria-hidden="true"><i class="fa fa-angle-left" /></span></a>
          <button v-else class="submit btn navicon left" disabled aria-hidden="true" tabindex="-1"><i class="fa fa-angle-left" /></button>{{ " " }}
          <a
            v-if="nextHit && nextHref"
            rel="next"
            :href="nextHref"
            aria-label="Nästa sökträff"
            @click="navigateCached($event, nextHit.index)"
          ><span class="submit btn navicon navicon-visual" aria-hidden="true"><i class="fa fa-angle-right" /></span></a>
          <button v-else class="submit btn navicon" disabled aria-hidden="true" tabindex="-1"><i class="fa fa-angle-right" /></button>
        </li>
        <li><a href="" @click.prevent="emit('navigate', 0)">Gå till första träffen</a></li>
        <li><a href="" @click.prevent="emit('navigate', Math.max((totalHits ?? 1) - 1, 0))">Gå till sista träffen</a></li>
        <li :class="{ open: gotoOpen }">
          <a href="" @click.prevent="toggleGoto">Gå direkt till träff . . .</a>
          <form v-show="gotoOpen" @submit.prevent="submitGoto">
            <input ref="gotoInput" v-model="gotoOrdinal" class="border border-gray-300" type="text" aria-label="Träffnummer">
            <i class="fa fa-angle-double-right" aria-hidden="true" />
          </form>
        </li>
        <li><a href="" @click.prevent="emit('close')">Stäng träffvisningen</a></li>
        <li v-if="returnHref"><NuxtLink :to="returnHref">Tillbaka till sökningen</NuxtLink></li>
      </ul>
    </nav>
  </div>
</template>
