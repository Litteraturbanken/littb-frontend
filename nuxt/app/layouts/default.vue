<script setup lang="ts">
import QuickSearch from "../components/global/QuickSearch.vue"
import saLogoUrl from "~/assets/img/SA_logo_type.svg"
</script>

<template>
  <div class="site-shell">
    <div id="leftCorridor">
      <a class="logo_link_monogram block" href="/" aria-label="Litteraturbanken">
        <svg
          class="lb-logo inline-block"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          x="0px"
          y="0px"
          width="360"
          height="280"
          viewBox="70 0 469 600"
          xml:space="preserve"
          preserveAspectRatio="xMinYMin"
          aria-hidden="true"
        >
          <g>
            <path class="b-fill" d="M370.36,577.35c-40.299,0-72.82,2.121-101.808,5.656c-1.414,0,0-3.535,0.707-4.242c63.63-5.655,68.579-4.948,68.579-116.654V250.009c0-111.706-4.242-110.999-69.286-118.069c-0.707,0-1.414-2.828,0-2.828c28.987,3.535,49.489,4.949,89.789,4.949c16.261,0,61.509-2.828,84.133-2.828c74.942,0,137.865,34.643,137.865,101.808c0,43.127-45.248,90.496-108.878,101.102v1.414c91.202-1.414,150.591,44.541,150.591,108.878c0,76.355-63.63,136.451-165.438,136.451C433.282,580.885,386.62,577.35,370.36,577.35z M409.244,336.262c86.961,0,122.312-25.451,122.312-94.737c0-74.942-43.834-101.101-106.05-101.101c-10.605,0-18.383,0-30.401,2.121c-4.949,21.917-7.07,53.025-7.07,106.757v216.342c0,97.566,7.07,106.051,61.51,106.051c79.184,0,120.896-28.279,120.896-115.948c0-72.113-51.611-120.189-161.196-115.948C408.537,339.797,408.537,336.262,409.244,336.262z" />
          </g>
          <g>
            <path class="l-fill" d="M507.364,492.948c-26.784,0-66.216-4.464-119.785-4.464c-73.655,0-154.751,2.231-208.32,5.951c-1.488,0,0-4.464,0.744-4.464c77.376-8.185,78.864-4.464,78.864-122.761v-223.2c0-117.552-3.721-116.809-72.168-124.249c-0.744,0-2.232-2.976-0.744-2.976c31.249,3.72,65.473,5.208,107.137,5.208c31.248,0,67.704-2.232,90.023-5.208c1.488,0,1.488,2.976,0.744,2.976c-71.424,5.952-72.168,11.16-72.168,124.249v223.201c0,96.721,8.185,105.648,47.616,105.648h40.92c117.553,0,119.785-8.929,129.457-52.824c0,0,3.72-0.744,3.72,0c-2.231,19.344-5.952,45.384-10.416,61.008C520.013,491.46,516.291,492.948,507.364,492.948z" />
          </g>
        </svg>
      </a>
      <ul role="navigation" class="mainnav">
        <li><a href="/bibliotek">Biblioteket</a></li>
        <QuickSearch />
        <li><a href="/sök">Sök i texterna</a></li>
        <li><a href="/epub?visa=epub&amp;sort=popularitet">Hämta e-böcker</a></li>
        <li><a href="/presentationer">Presentationer</a></li>
        <li><a href="https://litteraturbanken.se/diktensmuseum/">Diktens museum</a></li>
        <li><a href="/litteraturkartan/">Litteraturkartan</a></li>
        <li><a href="/översättarlexikon/">Översättarlexikon</a></li>
        <li><a href="/bibliotekariesidor/shared-reading/">Shared reading</a></li>
        <li><a href="/dramawebben">Dramawebben</a></li>
        <li><a href="/ljudochbild/">Ljud <em>&amp;</em> bild</a></li>
        <li><a href="/skolan/">Skolan</a></li>
        <li><a href="/om/ide">Om LB</a></li>
      </ul>
      <ul class="start-only uppercase text-sm align-right antialiased mt-2 text-right mr-32 font-display">
        <li><a href="/skolan/lararsida/">Lärare</a></li>
        <li><a href="/bibliotekariesidor/">Bibliotekarier</a></li>
      </ul>
      <ul class="start-only flex space-x-2 uppercase text-sm align-right antialiased justify-end mr-32 font-display">
        <li><a href="/om/english.html">English</a></li>
        <li><a href="/om/deutsch.html">Deutsch</a></li>
        <li><a href="/om/francais.html">Français</a></li>
      </ul>
      <a
        class="sa-logo start-only block text-right mr-32 mt-6 relative left-1"
        href="https://www.svenskaakademien.se"
      >
        <img :src="saLogoUrl" width="90" height="90" alt="Logotyp för Svenska Akademien">
      </a>
      <div id="toolkit" />
    </div>{{ " " }}
    <main id="mainview" role="main"><slot /></main>
    <div id="rightCorridor" class="ml-4 sm:ml-16 relative z-50">
      <div id="toolkit-right" />
    </div>
    <div id="bkgimg" />
  </div>
</template>

<style scoped>
.l-fill { fill: var(--logo-l-color, white); }
.b-fill { fill: var(--logo-b-color, white); }
</style>
