<script setup lang="ts">
import dramawebbenLogo from "~/assets/img/dramawebben_vit.svg"

const props = defineProps<{
  page: "start" | "om" | "kringtexter"
}>()

const isStartPage = computed(() => props.page === "start")
</script>

<template>
  <div class="cover" :class="{ show: !isStartPage }" />

  <div :class="isStartPage ? 'startpage' : 'subpage'">
    <div class="logo">
      <h1>
        <a href="/dramawebben"><img :src="dramawebbenLogo" alt="Dramawebben"></a>
      </h1>
      <h2>Fri svensk dramatik <br>hos Litteraturbanken</h2>
    </div>

    <div>
      <ul class="links">
        <li>
          <a href="/dramawebben/pjäser">Pjäser</a>
        </li>{{ " " }}
        <li :class="{ active: page === 'kringtexter' }">
          {{ " " }}<a href="/dramawebben/kringtexter">Mer läsning</a>
        </li>{{ " " }}
        <li>
          {{ " " }}<a href="/sok?avancerad&amp;keywords=keyword:Dramawebben">Sök <span
            v-if="isStartPage"
          >i pjäserna</span></a>
        </li>{{ " " }}
        <li>
          {{ " " }}<a href="/dramawebben/om">Om <span v-if="isStartPage">dramawebben</span></a>
        </li>{{ " " }}
        <li><a href="/">Till Litteraturbanken</a></li>
      </ul>

      <div class="page_content">
        <slot />
      </div>
    </div>
  </div>
</template>
