<script setup lang="ts">
import dramawebbenLogo from "~/assets/img/dramawebben_vit.svg"

const props = defineProps<{
  page: "start" | "pjäser" | "om" | "kringtexter"
}>()

const isStartPage = computed(() => props.page === "start")
</script>

<template>
  <div class="cover" :class="{ show: !isStartPage }" />

  <div :class="isStartPage ? 'startpage' : 'subpage'">
    <div class="logo">
      <h1>
        <NuxtLink to="/dramawebben"><img :src="dramawebbenLogo" alt="Dramawebben"></NuxtLink>
      </h1>
      <h2>Fri svensk dramatik <br>hos Litteraturbanken</h2>
    </div>

    <div>
      <ul class="links">
        <li :class="{ active: page === 'pjäser' }">
          <NuxtLink to="/dramawebben/pjäser">Pjäser</NuxtLink>
        </li>{{ " " }}
        <li :class="{ active: page === 'kringtexter' }">
          {{ " " }}<NuxtLink to="/dramawebben/kringtexter">Mer läsning</NuxtLink>
        </li>{{ " " }}
        <li>
          {{ " " }}<NuxtLink to="/s%C3%B6k?avancerad&amp;keywords=keyword:Dramawebben">Sök <span
            v-if="isStartPage"
          >i pjäserna</span></NuxtLink>
        </li>{{ " " }}
        <li>
          {{ " " }}<NuxtLink to="/dramawebben/om">Om <span v-if="isStartPage">dramawebben</span></NuxtLink>
        </li>{{ " " }}
        <li><NuxtLink to="/">Till Litteraturbanken</NuxtLink></li>
      </ul>

      <div class="page_content">
        <slot />
      </div>
    </div>
  </div>
</template>
