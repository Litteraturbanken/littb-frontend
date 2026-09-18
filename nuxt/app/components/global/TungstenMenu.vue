<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
const { libraryHref } = useLibraryNavigation()
const { textSearchHref } = useTextSearchNavigation()
</script>

<template>
  <div class="tungsten-mosaic">
    <div class="menu-search-section">
      <QuickSearch v-if="open" inline @closed="emit('navigate')" />
    </div>
    <ul class="tungsten-grid">
      <li class="tile-ebooks"><NuxtLink to="/epub?visa=epub&amp;sort=popularitet" no-prefetch><span><em>Hämta</em> e-böcker</span></NuxtLink></li>
      <li class="tile-new"><NuxtLink to="/bibliotek?visa=latest&amp;sort=nytillkommet" no-prefetch>Nytt</NuxtLink></li>
      <li class="tile-library"><NuxtLink :to="libraryHref" no-prefetch>Biblioteket</NuxtLink></li>
      <li class="tile-audio"><a href="/ljudochbild/">Ljud &amp; Bild</a></li>
      <li class="tile-school"><a href="/skolan/">Skolan</a></li>
      <li class="tile-map"><a href="/litteraturkartan/">Litteraturkartan</a></li>
      <li class="tile-search"><NuxtLink :to="textSearchHref" no-prefetch>Sök i texterna</NuxtLink></li>
      <li class="tile-about"><NuxtLink to="/om/ide" no-prefetch>Om LB</NuxtLink></li>
      <li class="tile-drama"><NuxtLink to="/dramawebben" no-prefetch>Dramawebben</NuxtLink></li>
      <li class="tile-poetry"><a href="/diktensmuseum/">Diktens museum</a></li>
      <li class="tile-presentations"><NuxtLink to="/presentationer" no-prefetch>Presentationer</NuxtLink></li>
      <li class="tile-translators"><a href="/översättarlexikon/">Översättarlexikon</a></li>
      <li class="tile-librarians"><a href="/bibliotekariesidor/">För bibliotekarier</a></li>
      <li class="tile-shared"><a href="/bibliotekariesidor/shared-reading/">Shared<br >reading</a></li>
    </ul>
  </div>
</template>

<style lang="scss">
@media (max-width: 1023px) {
  body #leftCorridor.site-navigation .mobile-navigation-menu {
    .tungsten-mosaic { width: 100%; .menu-search-section { margin-bottom: 2.5cqw; } }
    .tungsten-grid {
      display: grid; width: 100%; max-width: none; gap: 2.5cqw;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-template-rows: 30cqw 32cqw 30cqw 19cqw 44cqw repeat(4, 32cqw) 30cqw;
      li { min-width: 0; max-width: none; }
      a {
        display: flex; position: relative; isolation: isolate;
        width: 100%; height: 100%; min-height: 44px;
        align-items: center; justify-content: center;
        padding: 2cqw; box-sizing: border-box;
        background: var(--tile-image) right center / cover;
        color: white; text-transform: uppercase; text-align: center;
        font: 600 10cqw/1 "Tungsten A", "Tungsten B", "Menu Tungsten Local", "Arial Narrow", sans-serif;
        text-shadow: 0 1px 2px #0006;
        overflow-wrap: anywhere;
        &::before { content: ""; position: absolute; inset: 0; z-index: -1; background: #00000018; }
        &:hover { text-decoration: none; &::before { background: #00000035; } }
        &:focus-visible { outline: 3px solid #ffe16a; outline-offset: -3px; }
      }
      .tile-ebooks { grid-area: 1 / 1 / 2 / 9; --tile-image: url("/assets/menu-tungsten/ebooks.jpg"); a { align-items: flex-start; padding-top: 5cqw; font-size: 9.5cqw; } em { font-weight: 300; font-style: normal; } }
      .tile-new { grid-area: 1 / 9 / 2 / 13; --tile-image: url("/assets/menu-tungsten/new.jpg"); a { font-size: 13cqw; } }
      .tile-library { grid-area: 2 / 1 / 3 / 13; --tile-image: url("/assets/menu-tungsten/library.jpg"); a { font-weight: 100; font-size: 20cqw; justify-content: flex-start; padding-left: 7cqw; } }
      .tile-audio { grid-area: 3 / 1 / 5 / 6; --tile-image: url("/assets/menu-tungsten/audio.jpg"); a { background-position: left center; align-items: flex-end; justify-content: flex-end; padding-bottom: 5cqw; font-size: 8cqw; } }
      .tile-school { grid-area: 3 / 6 / 4 / 13; --tile-image: url("/assets/menu-tungsten/school.jpg"); a { font-size: 18cqw; } }
      .tile-map { grid-area: 4 / 6 / 5 / 13; --tile-image: url("/assets/menu-tungsten/map.jpg"); a { color: #222a1b; text-shadow: none; font-size: 7.2cqw; &::before { background: #ffffff30; } } }
      .tile-search { grid-area: 5 / 1 / 6 / 9; --tile-image: url("/assets/menu-tungsten/search.jpg"); a { align-items: flex-end; padding-bottom: 5cqw; font-size: 10cqw; } }
      .tile-about { grid-area: 5 / 9 / 6 / 13; --tile-image: url("/assets/menu-tungsten/about.jpg"); a { align-items: flex-start; justify-content: flex-start; padding: 5cqw 3cqw; font-size: 9cqw; } }
      .tile-drama { grid-area: 6 / 1 / 7 / 13; --tile-image: url("/assets/menu-tungsten/drama.jpg"); a { justify-content: flex-end; padding-right: 5cqw; font-weight: 300; font-size: 13cqw; } }
      .tile-poetry { grid-area: 7 / 1 / 8 / 13; --tile-image: url("/assets/menu-tungsten/poetry.jpg"); a { font-size: 13cqw; } }
      .tile-presentations { grid-area: 8 / 1 / 9 / 13; --tile-image: url("/assets/menu-tungsten/presentations.jpg"); a { font-size: 12cqw; } }
      .tile-translators { grid-area: 9 / 1 / 10 / 13; --tile-image: url("/assets/menu-tungsten/translators.jpg"); a { font-weight: 300; font-size: 12cqw; } }
      .tile-librarians { grid-area: 10 / 1 / 11 / 9; --tile-image: url("/assets/menu-tungsten/librarians.jpg"); a { font-size: 8cqw; } }
      .tile-shared { grid-area: 10 / 9 / 11 / 13; --tile-image: url("/assets/menu-tungsten/shared-reading.jpg"); a { align-items: flex-start; justify-content: flex-start; padding: 4cqw; text-align: left; font-size: 8cqw; } }
    }
  }
}
</style>
