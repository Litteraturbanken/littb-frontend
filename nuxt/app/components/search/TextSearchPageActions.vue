<script setup lang="ts">
import { ref, nextTick } from "vue"
const props = defineProps<{ currentPage: number, pageCount: number, ready: boolean }>()
const emit = defineEmits<{ selectPage: [page: number] }>()
const open = ref(false)
const destination = ref("")
const input = ref<HTMLInputElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

async function toggleDestination() {
  open.value = !open.value
  if (open.value) {
    destination.value = String(props.currentPage)
    await nextTick()
    input.value?.select()
  }
}
function closeDestination() {
  open.value = false
  trigger.value?.focus()
}
function submitDestination() {
  const page = Number(destination.value)
  if (!Number.isInteger(page) || page < 1 || page > props.pageCount) return
  closeDestination()
  emit("selectPage", page)
}
</script>

<template>
  <ul class="ctrl" data-text-search-page-actions :inert="!ready" :aria-busy="!ready">
    <li class="arrows">
      <button type="button" rel="prev" class="submit btn navicon left" aria-label="Föregående träffsida" :disabled="currentPage <= 1" @click="emit('selectPage', currentPage - 1)"><i class="fa fa-angle-left" aria-hidden="true" /></button>
      <button type="button" rel="next" class="submit btn navicon" aria-label="Nästa träffsida" :disabled="currentPage >= pageCount" @click="emit('selectPage', currentPage + 1)"><i class="fa fa-angle-right" aria-hidden="true" /></button>
    </li>
    <li><button type="button" :disabled="currentPage <= 1" @click="emit('selectPage', 1)">Gå till första träffen</button></li>
    <li><button type="button" :disabled="currentPage >= pageCount" @click="emit('selectPage', pageCount)">Gå till sista träffen</button></li>
    <li :class="{ open }">
      <button ref="trigger" type="button" :disabled="pageCount <= 1" :aria-expanded="open" aria-controls="text-search-page-destination" @click="toggleDestination">Gå till träffsida . . .</button>
      <form v-if="open" id="text-search-page-destination" @submit.prevent="submitDestination" @keydown.esc.prevent="closeDestination">
        <input ref="input" v-model="destination" type="number" min="1" :max="pageCount" step="1" required aria-label="Träffsida">
        <button type="submit" class="goto-submit" aria-label="Gå till angiven träffsida"><i class="fa fa-angle-double-right" aria-hidden="true" /></button>
      </form>
    </li>
  </ul>
</template>

<style scoped>
.ctrl li:not(.arrows) > button,
.ctrl .goto-submit {
  display: inline;
  width: auto;
  height: auto;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #7a1400;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ctrl li:not(.arrows) > button { white-space: nowrap; }
.ctrl button:disabled { color: #777; cursor: default; }
.ctrl button:focus-visible { outline: 2px solid #7a1400; outline-offset: 2px; }
.ctrl form input[type="number"] {
  width: 4em;
  height: 1.5em;
  margin-left: .4em;
  vertical-align: middle;
  font-size: .8em;
}
.ctrl .goto-submit { margin-left: .3em; }
</style>
