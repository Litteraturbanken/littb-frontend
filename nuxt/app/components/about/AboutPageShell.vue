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
    <li><NuxtLink :class="{ active: activePage === 'ide' }" :prefetch="false" to="/om/ide">Intro</NuxtLink></li>{{ " " }}
    <li>
      <NuxtLink v-slot="{ href, navigate }" :prefetch="false" custom to="/om/organisation">
        <a :href="href ?? undefined" @click="navigate">Organisation</a>
      </NuxtLink>
    </li>{{ " " }}
    <li><NuxtLink :class="{ active: activePage === 'hjalp' }" :prefetch="false" to="/om/hjalp">Hjälp</NuxtLink></li>{{ " " }}
    <li><NuxtLink :class="{ active: activePage === 'rattigheter' }" :prefetch="false" to="/om/rattigheter">Rättigheter</NuxtLink></li>{{ " " }}
    <li><NuxtLink :class="{ active: activePage === 'tack' }" :prefetch="false" to="/om/tack">Tack</NuxtLink></li>{{ " " }}
    <li><NuxtLink :class="{ active: activePage === 'statistik' }" :prefetch="false" to="/om/statistik">Statistik</NuxtLink></li>{{ " " }}
    <li><NuxtLink :class="{ active: activePage === 'kontakt' }" :prefetch="false" to="/om/kontakt">Kontakt</NuxtLink></li>
  </ul>
  <slot />
</template>
