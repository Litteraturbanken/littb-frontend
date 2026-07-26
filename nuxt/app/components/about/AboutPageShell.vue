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
    <li><NuxtLink :class="{ active: activePage === 'ide' }" to="/om/ide">Intro</NuxtLink></li>{{ " " }}
    <li><NuxtLink to="/om/organisation">Organisation</NuxtLink></li>{{ " " }}
    <li><NuxtLink :class="{ active: activePage === 'hjalp' }" to="/om/hjalp">Hjälp</NuxtLink></li>{{ " " }}
    <li><NuxtLink :class="{ active: activePage === 'rattigheter' }" to="/om/rattigheter">Rättigheter</NuxtLink></li>{{ " " }}
    <li><NuxtLink :class="{ active: activePage === 'tack' }" to="/om/tack">Tack</NuxtLink></li>{{ " " }}
    <li><NuxtLink :class="{ active: activePage === 'statistik' }" to="/om/statistik">Statistik</NuxtLink></li>{{ " " }}
    <li><NuxtLink :class="{ active: activePage === 'kontakt' }" to="/om/kontakt">Kontakt</NuxtLink></li>
  </ul>
  <slot />
</template>
