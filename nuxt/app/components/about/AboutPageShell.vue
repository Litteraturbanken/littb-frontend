<script setup lang="ts">
type AboutPage =
  | "ide"
  | "hjalp"
  | "rattigheter"
  | "tack"
  | "statistik"
  | "kontakt"

defineProps<{ activePage: AboutPage | null }>()
</script>

<template>
  <h1>Om Litteraturbanken</h1>
  <ul class="links">
    <li><a :class="{ active: activePage === 'ide' }" href="/om/ide">Intro</a></li>{{ " " }}
    <li><a href="/om/organisation">Organisation</a></li>{{ " " }}
    <li><a :class="{ active: activePage === 'hjalp' }" href="/om/hjalp">Hjälp</a></li>{{ " " }}
    <li><a :class="{ active: activePage === 'rattigheter' }" href="/om/rattigheter">Rättigheter</a></li>{{ " " }}
    <li><a :class="{ active: activePage === 'tack' }" href="/om/tack">Tack</a></li>{{ " " }}
    <li><a :class="{ active: activePage === 'statistik' }" href="/om/statistik">Statistik</a></li>{{ " " }}
    <li><a :class="{ active: activePage === 'kontakt' }" href="/om/kontakt">Kontakt</a></li>
  </ul>
  <slot />
</template>
